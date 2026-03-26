// Isometry v9.0 — Phase 114 Storage Foundation
// Graph Metrics Query Module
//
// Implements GFND-01: graph_metrics persistence layer with DDL, typed helpers.
//
// Pattern: Pass Database instance to every function (no module-level state).
// Uses INSERT OR REPLACE for idempotent writes (matching ui_state, import catalog patterns).
// Batch size 1000 matches the ETL batchSize pattern.

import type { Database } from '../Database';

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

/**
 * DDL string for the graph_metrics table and its indexes.
 *
 * Create at Worker init time alongside cards/connections/FTS5
 * (CREATE TABLE IF NOT EXISTS is safe to run on every init).
 *
 * Columns:
 *   card_id          - FK to cards(id), cascades on delete
 *   centrality       - Betweenness centrality score (REAL)
 *   pagerank         - PageRank score (REAL)
 *   community_id     - Louvain community assignment (INTEGER)
 *   clustering_coeff - Local clustering coefficient (REAL)
 *   sp_depth         - Shortest path depth from source (INTEGER)
 *   in_spanning_tree - 1 if edge in MST, 0 otherwise (INTEGER)
 *   computed_at      - ISO 8601 timestamp of computation (TEXT)
 *
 * Indexes cover Phase 116 PAFV axis/GROUP BY query patterns:
 *   community_id — GROUP BY community partition queries
 *   centrality   — ORDER BY / filter on centrality
 *   pagerank     — ORDER BY / filter on pagerank
 */
export const GRAPH_METRICS_DDL = `CREATE TABLE IF NOT EXISTS graph_metrics (
  card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  centrality REAL DEFAULT NULL,
  pagerank REAL DEFAULT NULL,
  community_id INTEGER DEFAULT NULL,
  clustering_coeff REAL DEFAULT NULL,
  sp_depth INTEGER DEFAULT NULL,
  in_spanning_tree INTEGER DEFAULT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gm_community ON graph_metrics(community_id);
CREATE INDEX IF NOT EXISTS idx_gm_pagerank ON graph_metrics(pagerank);
CREATE INDEX IF NOT EXISTS idx_gm_centrality ON graph_metrics(centrality);`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Typed row shape for graph_metrics table.
 * All 6 metric fields are nullable — partial algorithm results are valid.
 * computed_at is optional on input (set automatically by writeGraphMetrics).
 */
export interface GraphMetricsRow {
	card_id: string;
	centrality: number | null;
	pagerank: number | null;
	community_id: number | null;
	clustering_coeff: number | null;
	sp_depth: number | null;
	in_spanning_tree: number | null;
	computed_at?: string;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Upsert a batch of graph metric rows into graph_metrics.
 *
 * Uses INSERT OR REPLACE for idempotent writes — calling twice with the same
 * card_id updates the row rather than throwing a constraint error.
 *
 * Wraps all inserts in a single transaction (batched at 1000 rows,
 * matching ETL batchSize pattern) for performance.
 *
 * @param db    - Database instance
 * @param rows  - Array of metric rows to upsert
 */
export function writeGraphMetrics(db: Database, rows: GraphMetricsRow[]): void {
	if (rows.length === 0) return;

	const BATCH_SIZE = 1000;
	const now = new Date().toISOString();

	const doWrite = db.transaction(() => {
		for (let i = 0; i < rows.length; i += BATCH_SIZE) {
			const batch = rows.slice(i, i + BATCH_SIZE);
			for (const row of batch) {
				db.run(
					`INSERT OR REPLACE INTO graph_metrics
            (card_id, centrality, pagerank, community_id, clustering_coeff, sp_depth, in_spanning_tree, computed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						row.card_id,
						row.centrality ?? null,
						row.pagerank ?? null,
						row.community_id ?? null,
						row.clustering_coeff ?? null,
						row.sp_depth ?? null,
						row.in_spanning_tree ?? null,
						row.computed_at ?? now,
					],
				);
			}
		}
	});

	doWrite();
}

// ---------------------------------------------------------------------------
// Read (filtered by cardIds)
// ---------------------------------------------------------------------------

/**
 * Read graph metrics for a specific set of card IDs.
 *
 * Returns empty array when cardIds is empty (avoids invalid SQL
 * for IN () with no values).
 *
 * @param db      - Database instance
 * @param cardIds - Array of card IDs to filter by
 * @returns       - Array of GraphMetricsRow for matching cards
 */
export function readGraphMetrics(db: Database, cardIds: string[]): GraphMetricsRow[] {
	if (cardIds.length === 0) return [];

	const placeholders = cardIds.map(() => '?').join(', ');
	const result = db.exec(
		`SELECT card_id, centrality, pagerank, community_id, clustering_coeff, sp_depth, in_spanning_tree, computed_at
     FROM graph_metrics
     WHERE card_id IN (${placeholders})`,
		cardIds,
	);

	if (!result[0]) return [];
	return mapResultToRows(result[0]);
}

// ---------------------------------------------------------------------------
// Read all
// ---------------------------------------------------------------------------

/**
 * Read all graph metrics rows (used by graph:metrics-read when no cardIds filter).
 *
 * @param db - Database instance
 * @returns  - All GraphMetricsRow objects in the table
 */
export function readAllGraphMetrics(db: Database): GraphMetricsRow[] {
	const result = db.exec(
		`SELECT card_id, centrality, pagerank, community_id, clustering_coeff, sp_depth, in_spanning_tree, computed_at
     FROM graph_metrics`,
	);

	if (!result[0]) return [];
	return mapResultToRows(result[0]);
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

/**
 * Delete all rows from graph_metrics.
 *
 * Used when the user explicitly triggers a metrics clear, or when
 * the graph structure changes significantly enough to invalidate all metrics.
 *
 * @param db - Database instance
 */
export function clearGraphMetrics(db: Database): void {
	db.run('DELETE FROM graph_metrics');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map a sql.js exec() result set to an array of GraphMetricsRow objects.
 */
function mapResultToRows(result: { columns: string[]; values: unknown[][] }): GraphMetricsRow[] {
	const { columns, values } = result;
	return values.map((rawRow) => {
		const obj: Record<string, unknown> = {};
		columns.forEach((col, i) => {
			obj[col] = rawRow[i];
		});
		const mapped: GraphMetricsRow = {
			card_id: obj['card_id'] as string,
			centrality: (obj['centrality'] as number | null) ?? null,
			pagerank: (obj['pagerank'] as number | null) ?? null,
			community_id: (obj['community_id'] as number | null) ?? null,
			clustering_coeff: (obj['clustering_coeff'] as number | null) ?? null,
			sp_depth: (obj['sp_depth'] as number | null) ?? null,
			in_spanning_tree: (obj['in_spanning_tree'] as number | null) ?? null,
		};
		const computedAt = obj['computed_at'];
		if (typeof computedAt === 'string') {
			mapped.computed_at = computedAt;
		}
		return mapped;
	});
}
