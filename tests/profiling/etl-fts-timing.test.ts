// tests/profiling/etl-fts-timing.test.ts
// Phase 77-01: FTS stage isolation timing (IMPT-02).
//
// Measures time spent in each FTS lifecycle stage (disable/rebuild/restore)
// during a 20K-card bulk import. Logs individual durations and FTS overhead
// as percentage of total import time.
//
// Run with: npx vitest run tests/profiling/etl-fts-timing.test.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { SQLiteWriter } from '../../src/etl/SQLiteWriter';
import type { CanonicalCard } from '../../src/etl/types';
import { clearTraces, getTraces } from '../../src/profiling/PerfTrace';

// ---------------------------------------------------------------------------
// Card generator
// ---------------------------------------------------------------------------

const CARD_TYPES = ['note', 'task', 'event', 'resource'] as const;
const FOLDERS = ['work', 'personal', 'research', 'archive'];
const WORDS = ['knowledge', 'management', 'system', 'project', 'planning', 'data', 'analysis', 'design'];

function rw(): string {
	return WORDS[Math.floor(Math.random() * WORDS.length)] ?? 'knowledge';
}
function rs(n: number): string {
	return Array.from({ length: n }, () => rw()).join(' ');
}

function genCards(count: number): CanonicalCard[] {
	const ts = '2026-01-01T00:00:00Z';
	return Array.from({ length: count }, (_, i) => ({
		id: `fts-timing-${i}-${Math.random().toString(36).slice(2)}`,
		card_type: CARD_TYPES[i % 4]!,
		name: `${rw()} ${rw()} ${i}`,
		content: rs(15),
		summary: null,
		latitude: null,
		longitude: null,
		location_name: null,
		created_at: ts,
		modified_at: ts,
		due_at: null,
		completed_at: null,
		event_start: null,
		event_end: null,
		folder: FOLDERS[i % 4] ?? 'work',
		tags: [],
		status: null,
		priority: 0,
		sort_order: i,
		url: null,
		mime_type: null,
		is_collective: false,
		source: 'json',
		source_id: `fts-timing-${i}`,
		source_url: null,
		deleted_at: null,
	}));
}

// ---------------------------------------------------------------------------
// FTS stage isolation test
// ---------------------------------------------------------------------------

describe('FTS Stage Isolation Timing (20K bulk import)', () => {
	let db: Database;

	beforeAll(async () => {
		db = new Database();
		await db.initialize();
	}, 120_000);

	afterAll(() => {
		db.close();
	});

	beforeEach(() => {
		// Clean traces before each test for accurate measurements
		clearTraces();
	});

	it('measures individual FTS stage durations and overhead percentage', async () => {
		// Clean slate before import
		db.run('DELETE FROM cards WHERE 1=1');
		clearTraces();

		const cards = genCards(20_000);
		const writer = new SQLiteWriter(db);

		const t0 = performance.now();
		await writer.writeCards(cards, true);
		const totalMs = performance.now() - t0;

		// Read FTS stage traces
		const disableEntries = getTraces('etl:fts:disable');
		const rebuildEntries = getTraces('etl:fts:rebuild');
		const restoreEntries = getTraces('etl:fts:restore');

		const disableMs = disableEntries[0]?.duration ?? 0;
		const rebuildMs = rebuildEntries[0]?.duration ?? 0;
		const restoreMs = restoreEntries[0]?.duration ?? 0;
		const ftsTotalMs = disableMs + rebuildMs + restoreMs;
		const ftsOverheadPct = totalMs > 0 ? ((ftsTotalMs / totalMs) * 100).toFixed(1) : '0.0';

		console.log('\n--- FTS Stage Timing (20K bulk import) ---');
		console.log(`  Total import:     ${totalMs.toFixed(0)}ms`);
		console.log(`  etl:fts:disable:  ${disableMs.toFixed(2)}ms`);
		console.log(`  etl:fts:rebuild:  ${rebuildMs.toFixed(2)}ms`);
		console.log(`  etl:fts:restore:  ${restoreMs.toFixed(2)}ms`);
		console.log(`  FTS total:        ${ftsTotalMs.toFixed(2)}ms (${ftsOverheadPct}% of import)`);
		console.log('------------------------------------------\n');

		// All three FTS stages must have been traced
		expect(disableEntries.length).toBeGreaterThan(0);
		expect(rebuildEntries.length).toBeGreaterThan(0);
		expect(restoreEntries.length).toBeGreaterThan(0);

		// Durations must be non-negative
		expect(disableMs).toBeGreaterThanOrEqual(0);
		expect(rebuildMs).toBeGreaterThanOrEqual(0);
		expect(restoreMs).toBeGreaterThanOrEqual(0);

		// FTS overhead must be less than 100% (insert batches take some time too)
		const overheadNum = Number(ftsOverheadPct);
		expect(overheadNum).toBeLessThan(100);
	}, 120_000);
});
