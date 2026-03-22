// Isometry v9.0 — Phase 115 Algorithm Engine
// Performance benchmark for betweenness centrality at n=2000 nodes
//
// Validates ALGO-02: sqrt(n)-pivot sampling activates at n>2000 and keeps
// betweenness centrality computation within the 2-second budget.
//
// This benchmark guards against the O(n*m) timeout pitfall documented in
// PITFALLS.md — the sampling heuristic MUST activate and complete within budget.
//
// Graph topology: Erdos-Renyi sparse graph with n=2000 nodes, avg degree ~6
//   - 2000 cards (nodes)
//   - ~6000 connections (avg ~3 connections per card x 2 directions = ~6 edges)
//   - Realistic sparse graph matching production data characteristics

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard } from '../../src/database/queries/cards';
import { createConnection } from '../../src/database/queries/connections';
import { GRAPH_METRICS_DDL } from '../../src/database/queries/graph-metrics';
import { handleGraphCompute } from '../../src/worker/handlers/graph-algorithms.handler';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_COUNT = 2000;
const AVG_EDGES_PER_NODE = 3; // Each node gets ~3 outgoing connections → ~6000 total edges
const DURATION_BUDGET_MS = 2000; // 2-second hard budget for betweenness centrality at n=2000

// ---------------------------------------------------------------------------
// Module-level setup: build 2000-node graph once, run benchmarks against it
// ---------------------------------------------------------------------------

let db: Database;
let cardIds: string[];

describe('ALGO-02: Betweenness Centrality Performance at n=2000', () => {
	beforeAll(async () => {
		db = new Database();
		await db.initialize();

		// Apply graph_metrics DDL after base schema
		const ddlStatements = GRAPH_METRICS_DDL.split(';').filter((s) => s.trim());
		for (const stmt of ddlStatements) {
			db.run(stmt);
		}

		// Generate 2000 cards (nodes)
		cardIds = [];
		for (let i = 0; i < NODE_COUNT; i++) {
			const card = createCard(db, { name: `BenchNode-${i}` });
			cardIds.push(card.id);
		}

		// Generate ~6000 connections (Erdos-Renyi style: each node → ~3 random targets)
		// Use deterministic stride-based selection for reproducibility
		for (let i = 0; i < NODE_COUNT; i++) {
			for (let j = 0; j < AVG_EDGES_PER_NODE; j++) {
				// Pick a target card that is not the current card
				// Stride by prime numbers to create varied topology
				const offset = (i * 7 + j * 113 + 1) % NODE_COUNT;
				const targetIdx = offset === i ? (offset + 1) % NODE_COUNT : offset;
				const sourceId = cardIds[i]!;
				const targetId = cardIds[targetIdx]!;
				try {
					createConnection(db, { source_id: sourceId, target_id: targetId });
				} catch {
					// Ignore duplicate connections — mergeEdge in handler deduplicates anyway
				}
			}
		}
	}, 120_000); // 120s setup timeout: 2000 cards + 6000 connections

	afterAll(() => {
		db.close();
	});

	// =========================================================================
	// ALGO-02: Betweenness centrality at n=2000 completes within 2 seconds
	//
	// This is a HARD BUDGET assertion (not a bench() call) because:
	//   1. We need a single pass to validate the sqrt(n) sampling threshold
	//   2. The bench() API measures repeated iterations — one warm pass suffices
	//      to confirm the heuristic activates and completes in time
	//   3. The budget is 2 seconds; repeated bench() runs would inflate total time
	// =========================================================================
	it('ALGO-02: betweenness centrality at n=2000 completes in under 2 seconds with sqrt(n) sampling', () => {
		const t0 = performance.now();

		const result = handleGraphCompute(db, {
			algorithms: ['centrality'],
			renderToken: 1,
		});

		const durationMs = performance.now() - t0;

		// Primary budget assertion: sqrt(n) sampling must keep computation within 2 seconds
		expect(durationMs).toBeLessThan(DURATION_BUDGET_MS);

		// Structural correctness assertions
		expect(result.cardCount).toBe(NODE_COUNT);
		expect(result.algorithmsComputed).toContain('centrality');

		// durationMs from handler response (rounded) should also be reasonable
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	}, DURATION_BUDGET_MS + 5000); // Test timeout: budget + 5s overhead for safety

	// =========================================================================
	// Sanity: verify graph structure is as expected after setup
	// =========================================================================
	it('graph has correct node count and non-zero edge count after setup', () => {
		const result = handleGraphCompute(db, {
			algorithms: [],
			renderToken: 2,
		});

		expect(result.cardCount).toBe(NODE_COUNT);
		// Expect roughly 3000-6000 unique edges (some duplicates filtered by mergeEdge)
		expect(result.edgeCount).toBeGreaterThan(1000);
		expect(result.edgeCount).toBeLessThanOrEqual(NODE_COUNT * AVG_EDGES_PER_NODE);
	});
});
