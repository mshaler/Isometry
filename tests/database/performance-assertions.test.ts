// tests/database/performance-assertions.test.ts
// Automated pass/fail enforcement for all 4 PERF requirements.
// Uses performance.now() timing with p95 calculation to assert latency thresholds.
//
// Why a separate assertion test (not just bench()):
//   Vitest bench() provides human-readable percentile tables but does NOT support
//   programmatic assertions on percentile values (no expect(p99).toBeLessThan()).
//   This file provides the automated quality gate that CI can use to block merges.
//
// p95 calculation:
//   Sort samples, take the value at ceil(0.95 * n) - 1 index.
//   With 100 samples: ceil(95) - 1 = 94 → the 95th sample in sorted order.
//
// Thresholds (from REQUIREMENTS.md):
//   PERF-01: Card insert p95 <10ms   (single card, warmed 10K-card database)
//   PERF-02: Bulk insert p95 <1s     (1000 cards in single transaction)
//   PERF-03: FTS search p95 <100ms   (10K cards, 3-word query)
//   PERF-04: Graph traversal p95 <500ms (10K cards / 50K connections, depth 3)

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard } from '../../src/database/queries/cards';
import { connectedCards } from '../../src/database/queries/graph';
import { searchCards } from '../../src/database/queries/search';
import { type SeedResult, seedDatabase } from './seed';

// ---------------------------------------------------------------------------
// p95 helper
// ---------------------------------------------------------------------------

function computeP95(samples: number[]): number {
	const sorted = [...samples].sort((a, b) => a - b);
	const idx = Math.ceil(0.95 * sorted.length) - 1;
	return sorted[Math.max(0, idx)] ?? 0;
}

// ---------------------------------------------------------------------------
// Shared setup: seed once for all assertion tests
// ---------------------------------------------------------------------------

let db: Database;
let seed: SeedResult;

beforeAll(async () => {
	db = new Database();
	await db.initialize();
	seed = seedDatabase(db);
}, 60_000); // 60s for seeding

afterAll(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// PERF-01: Single card insert p95 <10ms
// ---------------------------------------------------------------------------

describe('PERF-01: single card insert p95 <10ms', () => {
	it('p95 of 100 single card inserts is less than 10ms', () => {
		const samples: number[] = [];
		for (let i = 0; i < 100; i++) {
			const start = performance.now();
			createCard(db, {
				name: `PerfAssert ${i} ${Math.random()}`,
				content: 'Performance assertion card — single insert timing',
				card_type: 'note',
				folder: 'perf-assert',
			});
			samples.push(performance.now() - start);
		}
		const p95 = computeP95(samples);
		// Uncomment to debug: console.log('PERF-01 p95:', p95.toFixed(2), 'ms');
		expect(p95).toBeLessThan(10);
	});
});

// ---------------------------------------------------------------------------
// PERF-02: Bulk 1000-card insert p95 <1000ms (1 second)
// ---------------------------------------------------------------------------

describe('PERF-02: bulk 1000-card insert p95 <1s', () => {
	it('p95 of 20 bulk-1000-insert iterations is less than 1000ms', () => {
		const samples: number[] = [];
		for (let iter = 0; iter < 20; iter++) {
			const now = new Date().toISOString();
			const start = performance.now();
			db.run('BEGIN');
			for (let i = 0; i < 1000; i++) {
				db.run(
					`INSERT INTO cards(id, card_type, name, content, created_at, modified_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
					[
						crypto.randomUUID(),
						'note',
						`BulkAssert ${iter}-${i} ${Math.random()}`,
						'Bulk insert assertion card — performance threshold validation',
						now,
						now,
					],
				);
			}
			db.run('COMMIT');
			samples.push(performance.now() - start);
		}
		const p95 = computeP95(samples);
		// Uncomment to debug: console.log('PERF-02 p95:', p95.toFixed(2), 'ms');
		expect(p95).toBeLessThan(1000);
	}, 120_000); // 2 minutes for 20 bulk iterations
});

// ---------------------------------------------------------------------------
// PERF-03: FTS search p95 <100ms on 10K cards
// ---------------------------------------------------------------------------

describe('PERF-03: FTS search p95 <100ms', () => {
	it('p95 of 100 FTS searches on 10K-card database is less than 100ms', () => {
		const samples: number[] = [];
		for (let i = 0; i < 100; i++) {
			const start = performance.now();
			searchCards(db, 'knowledge management system', 20);
			samples.push(performance.now() - start);
		}
		const p95 = computeP95(samples);
		// Uncomment to debug: console.log('PERF-03 p95:', p95.toFixed(2), 'ms');
		expect(p95).toBeLessThan(100);
	});
});

// ---------------------------------------------------------------------------
// PERF-04: Graph traversal depth 3 p95 <500ms
// ---------------------------------------------------------------------------

describe('PERF-04: graph traversal depth 3 p95 <500ms', () => {
	it('p95 of 50 graph traversals (depth 3, hub card) is less than 500ms', () => {
		const samples: number[] = [];
		for (let i = 0; i < 50; i++) {
			const start = performance.now();
			connectedCards(db, seed.hubCardId, 3);
			samples.push(performance.now() - start);
		}
		const p95 = computeP95(samples);
		// Uncomment to debug: console.log('PERF-04 p95:', p95.toFixed(2), 'ms');
		expect(p95).toBeLessThan(500);
	});
});
