// Isometry v9.0 — Phase 114 Storage Foundation
// TDD tests for graph_metrics query module.
//
// Setup: Fresh in-memory Database per test with base schema + GRAPH_METRICS_DDL applied.
// Cards are created first to satisfy the FK constraint on graph_metrics.card_id.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard } from '../../src/database/queries/cards';
import type { GraphMetricsRow } from '../../src/database/queries/graph-metrics';
import {
	clearGraphMetrics,
	GRAPH_METRICS_DDL,
	readAllGraphMetrics,
	readGraphMetrics,
	writeGraphMetrics,
} from '../../src/database/queries/graph-metrics';

let db: Database;

beforeEach(async () => {
	db = new Database();
	await db.initialize();
	// Apply graph_metrics DDL after base schema (which creates the cards table)
	db.run(GRAPH_METRICS_DDL);
});

afterEach(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// DDL structure tests
// ---------------------------------------------------------------------------

describe('GRAPH_METRICS_DDL', () => {
	it('contains CREATE TABLE IF NOT EXISTS graph_metrics', () => {
		expect(GRAPH_METRICS_DDL).toContain('CREATE TABLE IF NOT EXISTS graph_metrics');
	});

	it('contains card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE', () => {
		expect(GRAPH_METRICS_DDL).toContain('card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE');
	});

	it('contains centrality REAL DEFAULT NULL', () => {
		expect(GRAPH_METRICS_DDL).toContain('centrality REAL DEFAULT NULL');
	});

	it('contains pagerank REAL DEFAULT NULL', () => {
		expect(GRAPH_METRICS_DDL).toContain('pagerank REAL DEFAULT NULL');
	});

	it('contains community_id INTEGER DEFAULT NULL', () => {
		expect(GRAPH_METRICS_DDL).toContain('community_id INTEGER DEFAULT NULL');
	});

	it('contains clustering_coeff REAL DEFAULT NULL', () => {
		expect(GRAPH_METRICS_DDL).toContain('clustering_coeff REAL DEFAULT NULL');
	});

	it('contains sp_depth INTEGER DEFAULT NULL', () => {
		expect(GRAPH_METRICS_DDL).toContain('sp_depth INTEGER DEFAULT NULL');
	});

	it('contains in_spanning_tree INTEGER DEFAULT NULL', () => {
		expect(GRAPH_METRICS_DDL).toContain('in_spanning_tree INTEGER DEFAULT NULL');
	});

	it('contains computed_at column', () => {
		expect(GRAPH_METRICS_DDL).toContain('computed_at');
	});

	it('contains idx_gm_community index', () => {
		expect(GRAPH_METRICS_DDL).toContain('idx_gm_community');
	});

	it('contains idx_gm_pagerank index', () => {
		expect(GRAPH_METRICS_DDL).toContain('idx_gm_pagerank');
	});

	it('contains idx_gm_centrality index', () => {
		expect(GRAPH_METRICS_DDL).toContain('idx_gm_centrality');
	});
});

// ---------------------------------------------------------------------------
// writeGraphMetrics + readGraphMetrics
// ---------------------------------------------------------------------------

describe('writeGraphMetrics and readGraphMetrics', () => {
	it('inserts rows and retrieves them by card_id array', () => {
		const card1 = createCard(db, { name: 'Card 1' });
		const card2 = createCard(db, { name: 'Card 2' });

		const rows: GraphMetricsRow[] = [
			{
				card_id: card1.id,
				centrality: 0.5,
				pagerank: 0.25,
				community_id: 1,
				clustering_coeff: 0.8,
				sp_depth: 2,
				in_spanning_tree: 1,
			},
			{
				card_id: card2.id,
				centrality: 0.3,
				pagerank: 0.1,
				community_id: 2,
				clustering_coeff: 0.4,
				sp_depth: 3,
				in_spanning_tree: 0,
			},
		];

		writeGraphMetrics(db, rows);
		const result = readGraphMetrics(db, [card1.id, card2.id]);

		expect(result).toHaveLength(2);
		const r1 = result.find((r) => r.card_id === card1.id)!;
		expect(r1.centrality).toBe(0.5);
		expect(r1.pagerank).toBe(0.25);
		expect(r1.community_id).toBe(1);
		expect(r1.clustering_coeff).toBe(0.8);
		expect(r1.sp_depth).toBe(2);
		expect(r1.in_spanning_tree).toBe(1);
	});

	it('uses INSERT OR REPLACE — writing same card_id twice is idempotent (updates values)', () => {
		const card = createCard(db, { name: 'Card A' });

		writeGraphMetrics(db, [
			{
				card_id: card.id,
				centrality: 0.1,
				pagerank: null,
				community_id: null,
				clustering_coeff: null,
				sp_depth: null,
				in_spanning_tree: null,
			},
		]);
		writeGraphMetrics(db, [
			{
				card_id: card.id,
				centrality: 0.9,
				pagerank: 0.5,
				community_id: 3,
				clustering_coeff: null,
				sp_depth: null,
				in_spanning_tree: null,
			},
		]);

		const result = readGraphMetrics(db, [card.id]);
		expect(result).toHaveLength(1);
		const r = result[0]!;
		expect(r.centrality).toBe(0.9);
		expect(r.pagerank).toBe(0.5);
		expect(r.community_id).toBe(3);
	});

	it('returns empty array for empty cardIds input', () => {
		const result = readGraphMetrics(db, []);
		expect(result).toEqual([]);
	});

	it('handles partial algorithm results (only pagerank set, others null)', () => {
		const card = createCard(db, { name: 'Card X' });

		writeGraphMetrics(db, [
			{
				card_id: card.id,
				centrality: null,
				pagerank: 0.42,
				community_id: null,
				clustering_coeff: null,
				sp_depth: null,
				in_spanning_tree: null,
			},
		]);

		const result = readGraphMetrics(db, [card.id]);
		expect(result).toHaveLength(1);
		const r = result[0]!;
		expect(r.centrality).toBeNull();
		expect(r.pagerank).toBe(0.42);
		expect(r.community_id).toBeNull();
		expect(r.clustering_coeff).toBeNull();
		expect(r.sp_depth).toBeNull();
		expect(r.in_spanning_tree).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// clearGraphMetrics
// ---------------------------------------------------------------------------

describe('clearGraphMetrics', () => {
	it('drops all rows, readGraphMetrics returns empty array after clear', () => {
		const card1 = createCard(db, { name: 'Card 1' });
		const card2 = createCard(db, { name: 'Card 2' });

		writeGraphMetrics(db, [
			{
				card_id: card1.id,
				centrality: 0.5,
				pagerank: null,
				community_id: null,
				clustering_coeff: null,
				sp_depth: null,
				in_spanning_tree: null,
			},
			{
				card_id: card2.id,
				centrality: 0.3,
				pagerank: null,
				community_id: null,
				clustering_coeff: null,
				sp_depth: null,
				in_spanning_tree: null,
			},
		]);

		clearGraphMetrics(db);

		const result = readGraphMetrics(db, [card1.id, card2.id]);
		expect(result).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// readAllGraphMetrics
// ---------------------------------------------------------------------------

describe('readAllGraphMetrics', () => {
	it('returns all rows when no filter is provided', () => {
		const card1 = createCard(db, { name: 'Card 1' });
		const card2 = createCard(db, { name: 'Card 2' });
		const card3 = createCard(db, { name: 'Card 3' });

		writeGraphMetrics(db, [
			{
				card_id: card1.id,
				centrality: 0.9,
				pagerank: 0.1,
				community_id: 1,
				clustering_coeff: null,
				sp_depth: null,
				in_spanning_tree: null,
			},
			{
				card_id: card2.id,
				centrality: 0.5,
				pagerank: 0.2,
				community_id: 1,
				clustering_coeff: null,
				sp_depth: null,
				in_spanning_tree: null,
			},
			{
				card_id: card3.id,
				centrality: 0.1,
				pagerank: 0.3,
				community_id: 2,
				clustering_coeff: null,
				sp_depth: null,
				in_spanning_tree: null,
			},
		]);

		const result = readAllGraphMetrics(db);
		expect(result).toHaveLength(3);
	});

	it('returns empty array when no metrics exist', () => {
		const result = readAllGraphMetrics(db);
		expect(result).toEqual([]);
	});
});
