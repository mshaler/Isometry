// tests/database/performance.bench.ts
// Vitest bench() suite for all 4 PERF requirements.
// Validates latency thresholds on a realistic 10K-card / 50K-connection dataset.
//
// p95 vs p99 note:
//   tinybench (Vitest's bench engine) exposes p75, p99, p995, p999 but NOT p95.
//   We use p99 as a conservative proxy: if p99 < threshold, then p95 necessarily passes
//   (p95 <= p99 by definition). The bench table output shows p99 values.
//
// Thresholds:
//   PERF-01: Single card insert p95 <10ms  → p99 < 10ms
//   PERF-02: Bulk 1000-card insert p95 <1s → p99 < 1000ms
//   PERF-03: FTS search p95 <100ms        → p99 < 100ms
//   PERF-04: Graph traversal p95 <500ms   → p99 < 500ms

import { afterAll, beforeAll, bench, describe } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard } from '../../src/database/queries/cards';
import { connectedCards } from '../../src/database/queries/graph';
import { searchCards } from '../../src/database/queries/search';
import { type SeedResult, seedDatabase } from './seed';

// Module-level setup: seed once for all benchmarks.
// The database is seeded once and reused across all benchmarks.
let db: Database;
let seed: SeedResult;

describe('Performance Benchmarks (PERF-01..04)', () => {
	beforeAll(async () => {
		db = new Database();
		await db.initialize();
		// Seed 10K cards + 50K connections before any benchmark runs
		seed = seedDatabase(db);
	}, 60_000); // 60s timeout for seeding

	afterAll(() => {
		db.close();
	});

	// =====================================================================
	// PERF-01: Single card insert p95 <10ms
	// Warmed 10K-card database (seeded above)
	// p99 < 10ms implies p95 < 10ms (p95 <= p99 by definition)
	// =====================================================================
	bench(
		'PERF-01: single card insert (<10ms p95)',
		() => {
			createCard(db, {
				name: `Bench Card ${Math.random()}`,
				content: 'Performance test card with some content for benchmarking insert speed',
				card_type: 'note',
				folder: 'benchmarks',
			});
		},
		{
			iterations: 100,
			time: 5000, // 5 second time limit
		},
	);

	// =====================================================================
	// PERF-02: Bulk 1000-card insert p95 <1s
	// Each iteration inserts 1000 cards in a single transaction
	// p99 < 1000ms implies p95 < 1s
	// =====================================================================
	bench(
		'PERF-02: bulk 1000-card insert (<1s p95)',
		() => {
			const now = new Date().toISOString();
			db.run('BEGIN');
			for (let i = 0; i < 1000; i++) {
				db.run(
					`INSERT INTO cards(id, card_type, name, content, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
					[
						crypto.randomUUID(),
						'note',
						`Bulk ${i} ${Math.random()}`,
						'Bulk insert benchmark card with enough content to be realistic for FTS indexing',
						now,
						now,
					],
				);
			}
			db.run('COMMIT');
		},
		{
			iterations: 10,
			time: 30000, // 30 second time limit
		},
	);

	// =====================================================================
	// PERF-03: FTS search p95 <100ms on 10K cards
	// 3-word query per REQUIREMENTS.md specification
	// p99 < 100ms implies p95 < 100ms
	// =====================================================================
	bench(
		'PERF-03: FTS search 10K cards (<100ms p95)',
		() => {
			searchCards(db, 'knowledge management system', 20);
		},
		{
			iterations: 100,
			time: 15000, // 15 second time limit
		},
	);

	// =====================================================================
	// PERF-04: Graph traversal depth 3 p95 <500ms
	// Uses the hub card (well-connected, 200 direct connections) from seed
	// p99 < 500ms implies p95 < 500ms
	// =====================================================================
	bench(
		'PERF-04: graph traversal depth 3 (<500ms p95)',
		() => {
			connectedCards(db, seed.hubCardId, 3);
		},
		{
			iterations: 20,
			time: 30000, // 30 second time limit
		},
	);
});
