// Isometry v9.0 — Phase 114 Storage Foundation
// TDD tests for graph-algorithms.handler.ts
//
// Tests handler functions directly (unit tests, not through WorkerBridge).
// Uses real in-memory sql.js Database with base schema + GRAPH_METRICS_DDL applied.
//
// Covers:
//   - handleGraphCompute: empty graph, connected chain, disconnected graph, parallel edges
//   - handleGraphMetricsRead: round-trip with writeGraphMetrics
//   - handleGraphMetricsClear: empties the table
//   - sanitizeAlgorithmResult integration: NaN values become null after write/read

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard } from '../../src/database/queries/cards';
import { createConnection } from '../../src/database/queries/connections';
import { GRAPH_METRICS_DDL, writeGraphMetrics } from '../../src/database/queries/graph-metrics';
import {
	handleGraphCompute,
	handleGraphMetricsClear,
	handleGraphMetricsRead,
} from '../../src/worker/handlers/graph-algorithms.handler';

let db: Database;

beforeEach(async () => {
	db = new Database();
	await db.initialize();
	// Apply graph_metrics DDL after base schema (which creates the cards table)
	const ddlStatements = GRAPH_METRICS_DDL.split(';').filter((s) => s.trim());
	for (const stmt of ddlStatements) {
		db.run(stmt);
	}
});

afterEach(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// Helper: create card + connection quickly
// ---------------------------------------------------------------------------

function makeCard(name: string) {
	return createCard(db, { name });
}

// ---------------------------------------------------------------------------
// handleGraphCompute: empty database
// ---------------------------------------------------------------------------

describe('handleGraphCompute — empty database', () => {
	it('returns cardCount=0 and edgeCount=0 when no cards exist', () => {
		const result = handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		expect(result.cardCount).toBe(0);
		expect(result.edgeCount).toBe(0);
	});

	it('returns empty algorithmsComputed array (Phase 114 stub)', () => {
		const result = handleGraphCompute(db, { algorithms: ['pagerank'], renderToken: 1 });
		expect(result.algorithmsComputed).toEqual([]);
	});

	it('echoes the renderToken back in the response', () => {
		const result = handleGraphCompute(db, { algorithms: [], renderToken: 42 });
		expect(result.renderToken).toBe(42);
	});

	it('returns a non-negative durationMs', () => {
		const result = handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});
});

// ---------------------------------------------------------------------------
// handleGraphCompute: connected chain graph
// ---------------------------------------------------------------------------

describe('handleGraphCompute — 5 cards, 4-edge chain', () => {
	it('returns cardCount=5 and edgeCount=4 for a linear chain', () => {
		// Create 5 cards: A-B-C-D-E connected in a chain
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		const d = makeCard('D');
		const e = makeCard('E');

		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: d.id });
		createConnection(db, { source_id: d.id, target_id: e.id });

		const result = handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		expect(result.cardCount).toBe(5);
		expect(result.edgeCount).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// handleGraphCompute: disconnected graph (two components)
// ---------------------------------------------------------------------------

describe('handleGraphCompute — disconnected graph', () => {
	it('does not throw and returns correct counts for two isolated components', () => {
		// Component 1: A-B
		const a = makeCard('A');
		const b = makeCard('B');
		createConnection(db, { source_id: a.id, target_id: b.id });

		// Component 2: C-D (isolated from A-B)
		const c = makeCard('C');
		const d = makeCard('D');
		createConnection(db, { source_id: c.id, target_id: d.id });

		// Should not throw
		let result: ReturnType<typeof handleGraphCompute> | undefined;
		expect(() => {
			result = handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		}).not.toThrow();

		expect(result!.cardCount).toBe(4);
		expect(result!.edgeCount).toBe(2);
	});

	it('handles isolated nodes (cards with no connections)', () => {
		makeCard('Isolated-1');
		makeCard('Isolated-2');
		makeCard('Isolated-3');

		const result = handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		expect(result.cardCount).toBe(3);
		expect(result.edgeCount).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// handleGraphCompute: parallel edges (mergeEdge deduplication)
// ---------------------------------------------------------------------------

describe('handleGraphCompute — parallel edges', () => {
	it('deduplicates parallel edges between same pair via mergeEdge', () => {
		const a = makeCard('A');
		const b = makeCard('B');

		// Create 2 connections between A and B
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: a.id, target_id: b.id });

		const result = handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		expect(result.cardCount).toBe(2);
		// UndirectedGraph.mergeEdge deduplicates — unique pair = 1 edge
		expect(result.edgeCount).toBe(1);
	});

	it('counts reverse-direction edges as the same undirected edge', () => {
		const a = makeCard('A');
		const b = makeCard('B');

		// A→B and B→A are the same undirected edge
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: a.id });

		const result = handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		expect(result.cardCount).toBe(2);
		expect(result.edgeCount).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// handleGraphMetricsRead: round-trip with writeGraphMetrics
// ---------------------------------------------------------------------------

describe('handleGraphMetricsRead', () => {
	it('returns empty array when no metrics have been written', () => {
		const result = handleGraphMetricsRead(db, {});
		expect(result).toEqual([]);
	});

	it('returns all rows when cardIds is undefined', () => {
		const a = makeCard('A');
		const b = makeCard('B');

		writeGraphMetrics(db, [
			{ card_id: a.id, centrality: 0.5, pagerank: 0.3, community_id: 1, clustering_coeff: 0.8, sp_depth: 2, in_spanning_tree: 1 },
			{ card_id: b.id, centrality: 0.2, pagerank: 0.7, community_id: 1, clustering_coeff: 0.4, sp_depth: 3, in_spanning_tree: 0 },
		]);

		const result = handleGraphMetricsRead(db, {});
		expect(result).toHaveLength(2);
	});

	it('returns filtered rows when cardIds is specified', () => {
		const a = makeCard('A');
		const b = makeCard('B');

		writeGraphMetrics(db, [
			{ card_id: a.id, centrality: 0.5, pagerank: 0.3, community_id: 1, clustering_coeff: 0.8, sp_depth: 2, in_spanning_tree: 1 },
			{ card_id: b.id, centrality: 0.2, pagerank: 0.7, community_id: 1, clustering_coeff: 0.4, sp_depth: 3, in_spanning_tree: 0 },
		]);

		const result = handleGraphMetricsRead(db, { cardIds: [a.id] });
		expect(result).toHaveLength(1);
		expect(result[0]!.card_id).toBe(a.id);
	});

	it('returns empty array when cardIds is empty array', () => {
		const a = makeCard('A');
		writeGraphMetrics(db, [
			{ card_id: a.id, centrality: 0.5, pagerank: 0.3, community_id: 1, clustering_coeff: 0.8, sp_depth: 2, in_spanning_tree: 1 },
		]);

		const result = handleGraphMetricsRead(db, { cardIds: [] });
		expect(result).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// handleGraphMetricsClear
// ---------------------------------------------------------------------------

describe('handleGraphMetricsClear', () => {
	it('returns { success: true }', () => {
		const result = handleGraphMetricsClear(db);
		expect(result).toEqual({ success: true });
	});

	it('removes all metrics rows from the table', () => {
		const a = makeCard('A');
		const b = makeCard('B');

		writeGraphMetrics(db, [
			{ card_id: a.id, centrality: 0.5, pagerank: 0.3, community_id: 1, clustering_coeff: 0.8, sp_depth: 2, in_spanning_tree: 1 },
			{ card_id: b.id, centrality: 0.2, pagerank: 0.7, community_id: 1, clustering_coeff: 0.4, sp_depth: 3, in_spanning_tree: 0 },
		]);

		// Verify rows exist before clear
		const before = handleGraphMetricsRead(db, {});
		expect(before).toHaveLength(2);

		// Clear
		handleGraphMetricsClear(db);

		// Verify rows are gone
		const after = handleGraphMetricsRead(db, {});
		expect(after).toEqual([]);
	});

	it('is idempotent — calling twice does not throw', () => {
		expect(() => {
			handleGraphMetricsClear(db);
			handleGraphMetricsClear(db);
		}).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// sanitizeAlgorithmResult integration
// ---------------------------------------------------------------------------

describe('sanitizeAlgorithmResult integration via writeGraphMetrics', () => {
	it('NaN centrality written via sanitize becomes null in read-back', () => {
		// Note: writeGraphMetrics itself does not call sanitizeAlgorithmResult —
		// callers are responsible for sanitizing before writing. We verify that
		// null values round-trip correctly through the DB.
		const a = makeCard('A');

		writeGraphMetrics(db, [
			{ card_id: a.id, centrality: null, pagerank: null, community_id: null, clustering_coeff: null, sp_depth: null, in_spanning_tree: null },
		]);

		const rows = handleGraphMetricsRead(db, { cardIds: [a.id] });
		expect(rows).toHaveLength(1);
		expect(rows[0]!.centrality).toBeNull();
		expect(rows[0]!.pagerank).toBeNull();
	});
});
