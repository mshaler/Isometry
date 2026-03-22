/**
 * Isometry v5 — Phase 109 ETL Test Helpers
 *
 * Extends the E2E helper library for ETL-specific operations:
 *   - importNativeCards: inject CanonicalCard[] through bridge (same path as native adapters)
 *   - assertCatalogRow: verify import provenance in catalog tables
 *   - resetDatabase: clear cards/connections for test isolation
 */

import { type Page, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// CanonicalCard type alias (mirrors src/etl/types.ts CanonicalCard)
// Defined here to avoid importing from src/ in E2E helpers
// ---------------------------------------------------------------------------

export interface CanonicalCard {
	// Identity
	id: string;
	card_type: string;

	// Content
	name: string;
	content: string | null;
	summary: string | null;

	// Location
	latitude: number | null;
	longitude: number | null;
	location_name: string | null;

	// Time
	created_at: string;
	modified_at: string;
	due_at: string | null;
	completed_at: string | null;
	event_start: string | null;
	event_end: string | null;

	// Category
	folder: string | null;
	tags: string[];
	status: string | null;

	// Hierarchy
	priority: number;
	sort_order: number;

	// Resource
	url: string | null;
	mime_type: string | null;

	// Collection
	is_collective: boolean;

	// Source (required for ETL deduplication)
	source: string;
	source_id: string;
	source_url: string | null;

	// Lifecycle
	deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// importNativeCards
// ---------------------------------------------------------------------------

/**
 * Inject CanonicalCard[] through the existing etl:import-native Worker handler.
 * This is the same code path used by Swift native adapters — bypasses file parsing.
 *
 * @param page        Playwright page with app loaded and __isometry ready
 * @param cards       Pre-parsed canonical cards to import
 * @param sourceType  Source type string (e.g. 'native_notes', 'native_reminders')
 * @returns           ImportResult summary { inserted, updated, errors }
 */
export async function importNativeCards(
	page: Page,
	cards: CanonicalCard[],
	sourceType: string,
): Promise<{ inserted: number; updated: number; errors: number }> {
	const result = await page.evaluate(
		async ({ cards, sourceType }) => {
			const { bridge, coordinator } = (window as any).__isometry;
			const r = await bridge.send('etl:import-native', { cards, sourceType });
			coordinator.scheduleUpdate();
			return { inserted: r.inserted, updated: r.updated, errors: r.errors };
		},
		{ cards, sourceType },
	);

	// Wait for view to re-render after coordinator scheduleUpdate
	await page.waitForTimeout(500);
	return result;
}

// ---------------------------------------------------------------------------
// assertCatalogRow
// ---------------------------------------------------------------------------

/**
 * Assert that the import catalog tables reflect a successful import.
 *
 * Checks:
 *   1. import_sources table has an entry for the given source_type
 *   2. import_runs table has an entry with card_count >= expectedMinCards
 *   3. cards table has at least expectedMinCards rows with matching source
 *
 * Uses window.__isometry.queryAll() (exposed in Phase 109 Task 1).
 * Throws with clear Playwright assertion messages on failure.
 *
 * @param page             Playwright page with app loaded and __isometry ready
 * @param sourceType       Source type string to look up in catalog
 * @param expectedMinCards Minimum number of cards expected in each table
 */
export async function assertCatalogRow(
	page: Page,
	sourceType: string,
	expectedMinCards: number,
): Promise<void> {
	// 1. Verify import_sources has an entry for this source type
	const sourcesResult = await page.evaluate(async (st) => {
		const { queryAll } = (window as any).__isometry;
		return queryAll('SELECT * FROM import_sources WHERE source_type = ?', [st]);
	}, sourceType);

	expect(
		(sourcesResult as { rows: unknown[] }).rows.length,
		`Expected import_sources to have at least 1 row for source_type='${sourceType}'`,
	).toBeGreaterThanOrEqual(1);

	// 2. Verify import_runs has an entry with cards_inserted >= expectedMinCards
	// JOIN with import_sources to filter by source_type (import_runs stores source_id FK)
	const runsResult = await page.evaluate(async (st) => {
		const { queryAll } = (window as any).__isometry;
		return queryAll(
			`SELECT ir.* FROM import_runs ir
       JOIN import_sources s ON ir.source_id = s.id
       WHERE s.source_type = ? ORDER BY ir.started_at DESC LIMIT 1`,
			[st],
		);
	}, sourceType);

	expect(
		(runsResult as { rows: unknown[] }).rows.length,
		`Expected import_runs to have at least 1 row for source_type='${sourceType}'`,
	).toBe(1);

	const runRow = (runsResult as { rows: Record<string, unknown>[] }).rows[0];
	const cardCount = (runRow?.cards_inserted as number) ?? 0;
	expect(
		cardCount,
		`Expected import_runs.cards_inserted >= ${expectedMinCards} for source_type='${sourceType}', got ${cardCount}`,
	).toBeGreaterThanOrEqual(expectedMinCards);

	// 3. Verify cards table has at least expectedMinCards rows with this source
	const cardsResult = await page.evaluate(async (st) => {
		const { queryAll } = (window as any).__isometry;
		return queryAll(
			'SELECT COUNT(*) as cnt FROM cards WHERE source = ? AND deleted_at IS NULL',
			[st],
		);
	}, sourceType);

	const cnt = ((cardsResult as { rows: Record<string, unknown>[] }).rows[0]?.cnt as number) ?? 0;
	expect(
		cnt,
		`Expected cards table to have >= ${expectedMinCards} rows for source='${sourceType}', got ${cnt}`,
	).toBeGreaterThanOrEqual(expectedMinCards);
}

// ---------------------------------------------------------------------------
// resetDatabase
// ---------------------------------------------------------------------------

/**
 * Clear all cards and connections tables for test isolation.
 * Also clears catalog tables if they exist (import_runs, import_sources, datasets).
 *
 * Uses window.__isometry.exec() (exposed in Phase 109 Task 1).
 * Catalog table deletions are wrapped in try/catch to handle table-may-not-exist.
 *
 * @param page Playwright page with app loaded and __isometry ready
 */
export async function resetDatabase(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const { exec, coordinator } = (window as any).__isometry;

		// Core tables always present
		await exec('DELETE FROM connections');
		await exec('DELETE FROM cards');

		// Catalog tables may not exist in all builds
		try { await exec('DELETE FROM datasets'); } catch { /* table may not exist */ }
		try { await exec('DELETE FROM import_runs'); } catch { /* table may not exist */ }
		try { await exec('DELETE FROM import_sources'); } catch { /* table may not exist */ }

		coordinator.scheduleUpdate();
	});

	// Wait for view to settle after coordinator scheduleUpdate
	await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// importAltoIndex
// ---------------------------------------------------------------------------

/**
 * Import all 11 alto-index subdirectory fixture types as a single batch.
 * Reads each fixture JSON from tests/fixtures/alto-index/, merges all cards
 * into one array, and calls importNativeCards with sourceType='alto_index'.
 *
 * This mirrors real usage: alto-index is always imported as one batch via
 * the etl:import-native handler with sourceType='alto_index'.
 *
 * @param page Playwright page with app loaded and __isometry ready
 * @returns ImportResult summary { inserted, updated, errors }
 */
export async function importAltoIndex(
	page: Page,
): Promise<{ inserted: number; updated: number; errors: number }> {
	const fixtureDir = path.resolve(__dirname, '..', '..', 'tests', 'fixtures', 'alto-index');

	const fixtureFiles = [
		'notes.json',
		'contacts.json',
		'calendar.json',
		'messages.json',
		'books.json',
		'calls.json',
		'safari-history.json',
		'kindle.json',
		'reminders.json',
		'safari-bookmarks.json',
		'voice-memos.json',
	];

	const allCards: CanonicalCard[] = [];
	for (const file of fixtureFiles) {
		const filePath = path.join(fixtureDir, file);
		const raw = fs.readFileSync(filePath, 'utf-8');
		const cards = JSON.parse(raw) as CanonicalCard[];
		allCards.push(...cards);
	}

	return importNativeCards(page, allCards, 'alto_index');
}
