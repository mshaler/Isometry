// tests/profiling/budget.test.ts
// Phase 75: Performance budget assertions (TDD red step).
//
// SQL query and ETL import budgets derived from Phase 74 BOTTLENECKS.md.
// Some tests FAIL intentionally today — they become GREEN after Phase 76/77 optimizations.
//
// Run with: npx vitest run tests/profiling/budget.test.ts

import { afterAll, beforeAll, describe, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import type { ParsedFile } from '../../src/etl/parsers/AppleNotesParser';
import {
	BUDGET_ETL_20K_MS,
	BUDGET_QUERY_FTS_20K_MS,
	BUDGET_QUERY_GROUP_BY_20K_MS,
	BUDGET_QUERY_STATUS_20K_MS,
	BUDGET_QUERY_STRFTIME_20K_MS,
} from '../../src/profiling/PerfBudget';
import { clearTraces } from '../../src/profiling/PerfTrace';
import { seedDatabase } from '../database/seed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function p99(samples: number[]): number {
	const sorted = [...samples].sort((a, b) => a - b);
	const idx = Math.ceil(sorted.length * 0.99) - 1;
	return sorted[Math.max(0, idx)] ?? 0;
}

function measureQuery(db: Database, sql: string, iterations = 50): number {
	const samples: number[] = [];
	for (let i = 0; i < iterations; i++) {
		const t0 = performance.now();
		db.exec(sql);
		samples.push(performance.now() - t0);
	}
	return p99(samples);
}

// ---------------------------------------------------------------------------
// ETL data generators (from etl-smoke.bench.ts)
// ---------------------------------------------------------------------------

const CARD_TYPES = ['note', 'task', 'event', 'resource'];
const FOLDERS = ['work', 'personal', 'research', 'archive'];
const WORDS = ['knowledge', 'management', 'system', 'project', 'planning', 'data', 'analysis', 'design'];

function rw(): string {
	return WORDS[Math.floor(Math.random() * WORDS.length)] ?? 'knowledge';
}
function rs(n: number): string {
	return Array.from({ length: n }, () => rw()).join(' ');
}

function genAN(count: number): ParsedFile[] {
	return Array.from({ length: count }, (_, i) => ({
		path: `note-${i}-${Math.random().toString(36).slice(2)}.md`,
		content: `---\ntitle: Note ${i}\ncreated: 2026-01-01T00:00:00Z\n---\n\n${rs(20)}`,
	}));
}
function genCSV(count: number): ParsedFile[] {
	const rows = ['name,content,card_type,folder'];
	for (let i = 0; i < count; i++) {
		rows.push(`"${rw()} ${rw()} ${i} ${Date.now()}","${rs(10)}","${CARD_TYPES[i % 4]!}","${FOLDERS[i % 4]!}"`);
	}
	return [{ path: `import-${Date.now()}.csv`, content: rows.join('\n') }];
}
function genJSON(count: number): string {
	return JSON.stringify(
		Array.from({ length: count }, (_, i) => ({
			name: `${rw()} ${rw()} ${i} ${Date.now()}`,
			content: rs(15),
			card_type: CARD_TYPES[i % 4],
			folder: FOLDERS[i % 4],
		})),
	);
}
function genMD(count: number): ParsedFile[] {
	return Array.from({ length: count }, (_, i) => ({
		path: `doc-${i}-${Math.random().toString(36).slice(2)}.md`,
		content: `# ${rw()} ${rw()} ${i}\n\n${rs(20)}\n`,
	}));
}

async function timeImport(db: Database, type: string, data: unknown): Promise<number> {
	const orch = new ImportOrchestrator(db);
	const t0 = performance.now();
	await orch.import(type, data as ParsedFile[]);
	const elapsed = performance.now() - t0;
	clearTraces();
	return elapsed;
}

// ---------------------------------------------------------------------------
// SQL Query Budget Tests — 20K cards
// Intentionally FAILING today: GROUP BY folder+card_type (24.93ms > 12ms budget)
// Intentionally FAILING today: GROUP BY strftime month (20.64ms > 10ms budget)
// Intentionally PASSING today: GROUP BY status (1.87ms < 5ms budget)
// Intentionally PASSING today: FTS 3-word (1.70ms < 5ms budget)
// ---------------------------------------------------------------------------

describe('SQL Query Budgets (20K cards)', () => {
	let db: Database;

	beforeAll(async () => {
		db = new Database();
		await db.initialize();
		seedDatabase(db, { cardCount: 20_000 });
	}, 120_000);

	afterAll(() => {
		db.close();
	});

	it('GROUP BY folder, card_type p99 < BUDGET_QUERY_GROUP_BY_20K_MS', () => {
		const p99val = measureQuery(
			db,
			'SELECT folder, card_type, COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL GROUP BY folder, card_type',
		);
		expect(p99val).toBeLessThan(BUDGET_QUERY_GROUP_BY_20K_MS);
	}, 120_000);

	it('GROUP BY strftime month p99 < BUDGET_QUERY_STRFTIME_20K_MS', () => {
		const p99val = measureQuery(
			db,
			"SELECT strftime('%Y-%m', created_at) as month, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY month",
		);
		expect(p99val).toBeLessThan(BUDGET_QUERY_STRFTIME_20K_MS);
	}, 120_000);

	it('GROUP BY status p99 < BUDGET_QUERY_STATUS_20K_MS', () => {
		const p99val = measureQuery(
			db,
			'SELECT status, COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL GROUP BY status',
		);
		expect(p99val).toBeLessThan(BUDGET_QUERY_STATUS_20K_MS);
	}, 120_000);

	it('FTS 3-word search p99 < BUDGET_QUERY_FTS_20K_MS', () => {
		const p99val = measureQuery(db, "SELECT rowid FROM cards_fts WHERE cards_fts MATCH 'knowledge management system'");
		expect(p99val).toBeLessThan(BUDGET_QUERY_FTS_20K_MS);
	}, 120_000);
});

// ---------------------------------------------------------------------------
// ETL Import Budget Tests — 20K cards
// Intentionally FAILING today: json (1771ms > 1000ms budget)
// Intentionally FAILING today: markdown (1059ms > 1000ms budget)
// Intentionally PASSING today: apple_notes (182ms < 1000ms budget)
// Intentionally PASSING today: csv (767ms < 1000ms budget)
// ---------------------------------------------------------------------------

describe('ETL Import Budgets (20K cards)', () => {
	let db: Database;

	beforeAll(async () => {
		db = new Database();
		await db.initialize();
	}, 120_000);

	afterAll(() => {
		db.close();
	});

	it('apple_notes 20K < BUDGET_ETL_20K_MS', async () => {
		const elapsed = await timeImport(db, 'apple_notes', genAN(20_000));
		expect(elapsed).toBeLessThan(BUDGET_ETL_20K_MS);
	}, 120_000);

	it('csv 20K < BUDGET_ETL_20K_MS', async () => {
		const elapsed = await timeImport(db, 'csv', genCSV(20_000));
		expect(elapsed).toBeLessThan(BUDGET_ETL_20K_MS);
	}, 120_000);

	it('json 20K < BUDGET_ETL_20K_MS', async () => {
		const elapsed = await timeImport(db, 'json', genJSON(20_000));
		expect(elapsed).toBeLessThan(BUDGET_ETL_20K_MS);
	}, 120_000);

	it('markdown 20K < BUDGET_ETL_20K_MS', async () => {
		const elapsed = await timeImport(db, 'markdown', genMD(20_000));
		expect(elapsed).toBeLessThan(BUDGET_ETL_20K_MS);
	}, 120_000);
});
