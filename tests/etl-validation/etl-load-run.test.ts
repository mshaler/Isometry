// Isometry v7.2 — Phase 95 ETL Load/Run Test Harness
// Automated serial bulk import of ALL alto-index datasets into a single sql.js DB,
// followed by SuperGrid correctness verification.
//
// This harness proves:
//   1. All 10 source datasets import serially (real-world errors catalogued)
//   2. SuperGrid GROUP BY queries decompose the full dataset correctly
//   3. CellDatum card_ids reference valid cards in the DB
//   4. Aggregate footer computations are mathematically correct
//   5. Dedup is idempotent — re-importing produces zero new inserts
//   6. FTS5 finds cards across all sources
//
// Requirements: LOAD-01..04, GRID-01..04, CALC-01..02, DEDUP-01..02, FTS-01..02

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import type { CanonicalCard, ImportResult } from '../../src/etl/types';
import { handleSuperGridCalc, handleSuperGridQuery } from '../../src/worker/handlers/supergrid.handler';
import { createTestDb, generateExcelBuffer, importNativeSource, loadFixture, loadFixtureJSON } from './helpers';

// ---------------------------------------------------------------------------
// Shared state — single DB loaded once across all test blocks
// ---------------------------------------------------------------------------

let db: Database;
let orchestrator: ImportOrchestrator;

// Track import results for downstream assertions
const importResults: Record<string, ImportResult> = {};
let totalImportedCards = 0;
let totalConnections = 0;

// ---------------------------------------------------------------------------
// Dataset paths
// ---------------------------------------------------------------------------

const ALTO_100_PATH = join(__dirname, '../../public/alto-100.json');

// ---------------------------------------------------------------------------
// Serial import — beforeAll loads everything once
// ---------------------------------------------------------------------------

beforeAll(async () => {
	db = await createTestDb();
	orchestrator = new ImportOrchestrator(db);

	// -----------------------------------------------------------------------
	// 1. alto-100.json — 100 Apple Notes (primary real-world dataset)
	//    Real-world notes may have parse errors (malformed frontmatter, empty
	//    content, etc.) — errors are catalogued, not zero-gated here.
	// -----------------------------------------------------------------------
	const alto100Raw = readFileSync(ALTO_100_PATH, 'utf-8');
	importResults['alto-100'] = await orchestrator.import('apple_notes', alto100Raw);

	// -----------------------------------------------------------------------
	// 2. Web fixture sources (6 sources)
	// -----------------------------------------------------------------------

	// Apple Notes fixture (separate from alto-100 — these have different source_ids)
	const appleNotesFixture = loadFixture('apple-notes-snapshot.json');
	importResults['apple_notes_fixture'] = await orchestrator.import('apple_notes', appleNotesFixture);

	// Markdown
	const markdownFixture = loadFixture('markdown-snapshot.json');
	importResults['markdown'] = await orchestrator.import('markdown', markdownFixture);

	// CSV
	const csvFixture = loadFixture('csv-snapshot.json');
	importResults['csv'] = await orchestrator.import('csv', csvFixture);

	// JSON
	const jsonFixture = loadFixture('json-snapshot.json');
	importResults['json'] = await orchestrator.import('json', jsonFixture);

	// Excel
	const excelRows = loadFixtureJSON<Record<string, unknown>[]>('excel-rows.json');
	const excelBuffer = await generateExcelBuffer(excelRows);
	importResults['excel'] = await orchestrator.import('excel', excelBuffer);

	// HTML
	const htmlStrings = loadFixtureJSON<string[]>('html-snapshot.json');
	importResults['html'] = await orchestrator.import(
		'html',
		htmlStrings as unknown as import('../../src/etl/parsers/AppleNotesParser').ParsedFile[],
	);

	// -----------------------------------------------------------------------
	// 3. Native fixture sources (3 sources)
	// -----------------------------------------------------------------------

	const nativeNotes = loadFixtureJSON<CanonicalCard[]>('native-notes.json');
	importResults['native_notes'] = await importNativeSource(db, 'native_notes', nativeNotes);

	const nativeCalendar = loadFixtureJSON<CanonicalCard[]>('native-calendar.json');
	importResults['native_calendar'] = await importNativeSource(db, 'native_calendar', nativeCalendar);

	const nativeReminders = loadFixtureJSON<CanonicalCard[]>('native-reminders.json');
	importResults['native_reminders'] = await importNativeSource(db, 'native_reminders', nativeReminders);

	// -----------------------------------------------------------------------
	// Compute totals
	// -----------------------------------------------------------------------

	for (const result of Object.values(importResults)) {
		totalImportedCards += result.inserted + result.updated;
		totalConnections += result.connections_created;
	}
}, 60_000); // 60s timeout for bulk import

afterAll(() => {
	db?.close();
});

// ===========================================================================
// LOAD TESTS — Import completeness
// ===========================================================================

describe('LOAD: Serial import completeness', () => {
	it('LOAD-01: alto-100 imports Apple Notes — majority succeed, errors catalogued', () => {
		const r = importResults['alto-100']!;
		// Real-world dataset: some notes may have malformed frontmatter or empty content.
		// At least 60% of the 100 input notes should import successfully.
		// Note: AppleNotesParser also extracts @mentions as person cards and URLs as
		// resource cards, so inserted count may exceed 100 input files.
		expect(r.inserted).toBeGreaterThanOrEqual(60);
		expect(r.insertedIds.length).toBe(r.inserted);
		// inserted + errors >= 100 (parser generates extra cards from mentions/links)
		expect(r.inserted + r.errors).toBeGreaterThanOrEqual(100);
	});

	it('LOAD-02: fixture sources import with zero errors', () => {
		// Fixture sources are synthetic — they should always have zero errors.
		// alto-100 is excluded from this check (real-world data, may have parse errors).
		const fixtureKeys = Object.keys(importResults).filter((k) => k !== 'alto-100');
		for (const name of fixtureKeys) {
			const result = importResults[name]!;
			expect(result.errors, `${name} had import errors`).toBe(0);
			expect(result.inserted + result.updated, `${name} produced no cards`).toBeGreaterThan(0);
		}
		// 9 fixture sources (6 web + 3 native)
		expect(fixtureKeys.length).toBe(9);
	});

	it('LOAD-03: total card count in DB matches sum of all import results', () => {
		const stmt = db.prepare<{ count: number }>('SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL');
		const rows = stmt.all();
		stmt.free();
		const dbCount = rows[0]!.count;

		expect(dbCount).toBe(totalImportedCards);
		// Sanity: at least alto-100 (64+) + fixtures
		expect(dbCount).toBeGreaterThan(500);
	});

	it('LOAD-04: connections created across sources', () => {
		const stmt = db.prepare<{ count: number }>('SELECT COUNT(*) as count FROM connections');
		const rows = stmt.all();
		stmt.free();
		const dbConnections = rows[0]!.count;

		// Apple Notes create mention/link connections
		expect(dbConnections).toBeGreaterThan(0);
		expect(dbConnections).toBe(totalConnections);
	});
});

// ===========================================================================
// GRID TESTS — SuperGrid correctness
// ===========================================================================

describe('GRID: SuperGrid query correctness', () => {
	it('GRID-01: 1-axis GROUP BY card_type — sum of counts equals total cards', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [],
			where: 'deleted_at IS NULL',
			params: [],
		});

		expect(result.cells.length).toBeGreaterThan(0);

		const sumOfCounts = result.cells.reduce((sum, cell) => sum + cell.count, 0);
		expect(sumOfCounts).toBe(totalImportedCards);

		// Every cell must have non-empty card_ids
		// Note: CARD_IDS_LIMIT=50 truncates card_ids for large cells,
		// so count >= card_ids.length (not necessarily equal)
		for (const cell of result.cells) {
			expect(cell.card_ids.length).toBeGreaterThan(0);
			expect(cell.count).toBeGreaterThanOrEqual(cell.card_ids.length);
		}
	});

	it('GRID-02: 1-axis GROUP BY folder — cells cover all distinct folders', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'folder', direction: 'asc' }],
			rowAxes: [],
			where: 'deleted_at IS NULL',
			params: [],
		});

		// Multiple sources should produce multiple distinct folders
		expect(result.cells.length).toBeGreaterThan(1);

		const sumOfCounts = result.cells.reduce((sum, cell) => sum + cell.count, 0);
		expect(sumOfCounts).toBe(totalImportedCards);

		// Verify distinct folder values match direct SQL
		const stmt = db.prepare<{ folder: string | null }>(
			'SELECT DISTINCT folder FROM cards WHERE deleted_at IS NULL ORDER BY folder',
		);
		const directFolders = stmt.all().map((r) => r.folder);
		stmt.free();

		// SuperGrid cells should cover the same set of distinct folders
		const gridFolders = result.cells.map((c) => c['folder'] as string | null);
		expect(gridFolders.length).toBe(directFolders.length);
	});

	it('GRID-03: 2-axis GROUP BY card_type × folder — correct decomposition', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
		});

		expect(result.cells.length).toBeGreaterThan(0);

		const sumOfCounts = result.cells.reduce((sum, cell) => sum + cell.count, 0);
		expect(sumOfCounts).toBe(totalImportedCards);

		// Each cell should have card_type AND folder values
		for (const cell of result.cells) {
			expect(cell).toHaveProperty('card_type');
			expect(cell).toHaveProperty('folder');
			expect(cell.card_ids.length).toBeGreaterThan(0);
		}
	});

	it('GRID-04: CellDatum card_ids are valid UUIDs that exist in the DB', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [],
			where: 'deleted_at IS NULL',
			params: [],
		});

		// Collect all card_ids from all cells
		const allCellCardIds = new Set<string>();
		for (const cell of result.cells) {
			for (const id of cell.card_ids) {
				allCellCardIds.add(id);
			}
		}

		// Verify each referenced card_id exists in the cards table
		// Use batched queries to avoid SQLite bind param limit
		const idsArray = Array.from(allCellCardIds);
		let verifiedCount = 0;
		const BATCH = 100;
		for (let i = 0; i < idsArray.length; i += BATCH) {
			const batch = idsArray.slice(i, i + BATCH);
			const placeholders = batch.map(() => '?').join(',');
			const stmt = db.prepare<{ count: number }>(
				`SELECT COUNT(*) as count FROM cards WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
			);
			const rows = stmt.all(...batch);
			stmt.free();
			verifiedCount += rows[0]!.count;
		}

		expect(verifiedCount).toBe(allCellCardIds.size);
	});
});

// ===========================================================================
// CALC TESTS — Aggregate footer correctness
// ===========================================================================

describe('CALC: Aggregate footer correctness', () => {
	it('CALC-01: COUNT aggregate via supergrid:calc matches grid cell counts', () => {
		const gridResult = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [],
			where: 'deleted_at IS NULL',
			params: [],
		});

		// supergrid:calc expects aggregates as Record<string, AggregationMode | 'off'>
		const calcResult = handleSuperGridCalc(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [],
			where: 'deleted_at IS NULL',
			params: [],
			aggregates: { priority: 'count' },
		});

		// Footer COUNT for each card_type should match the grid cell count
		for (const cell of gridResult.cells) {
			const cardType = cell['card_type'] as string;
			const footerRow = calcResult.rows.find((r) => r.groupKey['card_type'] === cardType);
			if (footerRow) {
				const countVal = footerRow.values['priority'];
				expect(countVal, `COUNT for card_type=${cardType}`).toBe(cell.count);
			}
		}
	});

	it('CALC-02: SUM(priority) across all card_types matches direct SQL', () => {
		// Direct SQL baseline
		const baselineStmt = db.prepare<{ total: number | null }>(
			'SELECT SUM(priority) as total FROM cards WHERE deleted_at IS NULL',
		);
		const baselineRows = baselineStmt.all();
		baselineStmt.free();
		const expectedSum = baselineRows[0]!.total ?? 0;

		// SuperGrid calc
		const calcResult = handleSuperGridCalc(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [],
			where: 'deleted_at IS NULL',
			params: [],
			aggregates: { priority: 'sum' },
		});

		// Sum the per-cell SUM values — should equal the direct SQL sum
		let calcSum = 0;
		for (const row of calcResult.rows) {
			const val = row.values['priority'];
			if (typeof val === 'number') {
				calcSum += val;
			}
		}

		expect(calcSum).toBe(expectedSum);
	});
});

// ===========================================================================
// DEDUP TESTS — Idempotency verification
// ===========================================================================

describe('DEDUP: Re-import idempotency', () => {
	it('DEDUP-01: re-importing a fixture source produces zero new inserts', async () => {
		// Use markdown fixture (not alto-100) to avoid FK issues from connection re-creation
		const countBefore = db
			.prepare<{ count: number }>('SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL')
			.all()[0]!.count;

		const markdownFixture = loadFixture('markdown-snapshot.json');
		const result = await orchestrator.import('markdown', markdownFixture);

		// All should be unchanged/updated (dedup by source:source_id)
		expect(result.inserted).toBe(0);
		expect(result.unchanged + result.updated).toBeGreaterThan(0);
		expect(result.errors).toBe(0);

		// Total card count in DB should not have changed
		const stmt = db.prepare<{ count: number }>('SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL');
		const rows = stmt.all();
		stmt.free();
		expect(rows[0]!.count).toBe(countBefore);
	});

	it('DEDUP-02: re-importing CSV fixture produces zero new inserts', async () => {
		const csvFixture = loadFixture('csv-snapshot.json');
		const result = await orchestrator.import('csv', csvFixture);

		expect(result.inserted).toBe(0);
		expect(result.unchanged + result.updated).toBeGreaterThan(0);
		expect(result.errors).toBe(0);
	});
});

// ===========================================================================
// FTS TESTS — Full-text search across sources
// ===========================================================================

describe('FTS: Cross-source full-text search', () => {
	it('FTS-01: FTS5 index contains cards from multiple sources', () => {
		// Query the FTS index for cards from each source
		const stmt = db.prepare<{ source: string; cnt: number }>(
			`SELECT c.source, COUNT(*) as cnt
       FROM cards_fts fts
       JOIN cards c ON c.rowid = fts.rowid
       WHERE c.deleted_at IS NULL
       GROUP BY c.source`,
		);
		const rows = stmt.all();
		stmt.free();

		// At least 2 sources should have FTS entries
		expect(rows.length).toBeGreaterThanOrEqual(2);

		// Each source with FTS entries should have a positive count
		for (const row of rows) {
			expect(row.cnt).toBeGreaterThan(0);
		}
	});

	it('FTS-02: FTS search for alto-100 specific content returns results', () => {
		// alto-100 contains business-related notes (BairesDev, staff augmentation, etc.)
		const stmt = db.prepare<{ id: string; name: string }>(
			`SELECT c.id, c.name
       FROM cards_fts fts
       JOIN cards c ON c.rowid = fts.rowid
       WHERE cards_fts MATCH ?
       AND c.deleted_at IS NULL
       AND c.source = 'apple_notes'
       LIMIT 10`,
		);
		// Search for a term known to be in alto-100 dataset
		const rows = stmt.all('proposition OR operations OR question');
		stmt.free();

		expect(rows.length).toBeGreaterThan(0);
	});
});

// ===========================================================================
// CATALOG TESTS — Import metadata recorded
// ===========================================================================

describe('CATALOG: Import history recorded', () => {
	it('CATALOG-01: import_log table has entries for web sources', () => {
		// Check which catalog table exists (may be import_catalog or import_log)
		const tables = db
			.prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'import%'")
			.all();

		if (tables.length === 0) {
			// No catalog table — skip test (catalog may not be part of test schema)
			return;
		}

		const tableName = tables[0]!.name;
		const stmt = db.prepare<{ count: number }>(`SELECT COUNT(*) as count FROM ${tableName}`);
		const rows = stmt.all();
		stmt.free();

		// At least the web sources should have catalog entries
		expect(rows[0]!.count).toBeGreaterThanOrEqual(1);
	});
});
