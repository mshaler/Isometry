// tests/profiling/etl-batch-size.test.ts
// Phase 77-01: ETL batch size comparison benchmark (IMPT-01).
//
// Measures SQLiteWriter.writeCards throughput at 20K cards for batchSize 100, 500, 1000.
// Single shared DB instance per Phase 74 convention (prevents WASM heap OOM).
//
// Run with: npx vitest run tests/profiling/etl-batch-size.test.ts
//
// Parser throughput baselines (IMPT-03) are captured in etl-smoke.bench.ts.
// See that file for json/markdown/csv/apple_notes at 1K/5K/20K measurements.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { SQLiteWriter } from '../../src/etl/SQLiteWriter';
import type { CanonicalCard } from '../../src/etl/types';
import { clearTraces } from '../../src/profiling/PerfTrace';

// ---------------------------------------------------------------------------
// Card generator — produces CanonicalCard objects with all required fields
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

function genCards(count: number, prefix = 'card'): CanonicalCard[] {
	const ts = '2026-01-01T00:00:00Z';
	return Array.from({ length: count }, (_, i) => ({
		id: `${prefix}-${i}-${Math.random().toString(36).slice(2)}`,
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
		source_id: `${prefix}-${i}`,
		source_url: null,
		deleted_at: null,
	}));
}

// ---------------------------------------------------------------------------
// Batch size comparison — 20K cards at batchSize 100, 500, 1000
// ---------------------------------------------------------------------------

describe('ETL Batch Size Comparison (20K cards)', () => {
	let db: Database;
	const results: Array<{ batchSize: number; ms: number; rate: number }> = [];

	beforeAll(async () => {
		db = new Database();
		await db.initialize();
	}, 120_000);

	afterAll(() => {
		// Log comparison summary after all 3 runs
		console.log('\n--- ETL Batch Size Comparison (20K cards) ---');
		for (const r of results) {
			console.log(`  batchSize=${r.batchSize}: ${r.ms.toFixed(0)}ms (${r.rate.toFixed(0)} cards/s)`);
		}
		if (results.length === 3) {
			const winner = results.reduce((a, b) => (a.rate > b.rate ? a : b));
			console.log(`  Winner: batchSize=${winner.batchSize} at ${winner.rate.toFixed(0)} cards/s`);
		}
		console.log('----------------------------------------------\n');
		db.close();
	});

	for (const batchSize of [100, 500, 1000]) {
		it(`batchSize=${batchSize} at 20K cards`, async () => {
			// Clear previous run's cards (never close+reopen DB per Phase 74 OOM rule)
			db.run('DELETE FROM cards WHERE 1=1');
			clearTraces();

			const cards = genCards(20_000, `bs${batchSize}`);
			const writer = new SQLiteWriter(db, batchSize);

			const t0 = performance.now();
			await writer.writeCards(cards, true);
			const ms = performance.now() - t0;
			const rate = (20_000 / ms) * 1000;

			console.log(`  batchSize=${batchSize}: ${ms.toFixed(0)}ms (${rate.toFixed(0)} cards/s)`);
			results.push({ batchSize, ms, rate });

			// Verify all 20K cards written
			const countResult = db.exec('SELECT COUNT(*) FROM cards WHERE deleted_at IS NULL');
			const count = countResult[0]!.values[0]![0] as number;
			expect(count).toBe(20_000);
		}, 120_000);
	}
});
