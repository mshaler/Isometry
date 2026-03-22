// Isometry v9.0 — Phase 114 Storage Foundation
// Graph Algorithm Stub Handler
//
// Implements GFND-02: Worker-side graphology UndirectedGraph construction
// and graph_metrics persistence round-trip.
//
// Phase 114 is a STUB — no algorithm execution.
// Returns node/edge counts to validate the full round-trip:
//   protocol > bridge > worker > graphology > response
//
// Phase 115 will add the 6 algorithm implementations into this handler.

import UndirectedGraph from 'graphology';

import type { Database } from '../../database/Database';
import {
	clearGraphMetrics,
	readAllGraphMetrics,
	readGraphMetrics,
} from '../../database/queries/graph-metrics';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

// ---------------------------------------------------------------------------
// handleGraphCompute
// ---------------------------------------------------------------------------

/**
 * Build a graphology UndirectedGraph from the connections table and return
 * node/edge counts.
 *
 * Phase 114 stub: validates the full round-trip without executing any
 * algorithm. Phase 115 will drop algorithm implementations here.
 *
 * @param db      - Database instance
 * @param payload - Algorithm selection and render token
 * @returns       - Compute summary (stub: algorithmsComputed is always [])
 */
export function handleGraphCompute(
	db: Database,
	payload: WorkerPayloads['graph:compute'],
): WorkerResponses['graph:compute'] {
	const start = performance.now();

	// Read all non-deleted card IDs
	const cardResult = db.exec('SELECT id FROM cards WHERE deleted_at IS NULL');
	const nodeRows = cardResult[0]?.values ?? [];

	// Read all connections
	const edgeResult = db.exec('SELECT source_id, target_id FROM connections');
	const edgeRows = edgeResult[0]?.values ?? [];

	// Build UndirectedGraph
	const g = new UndirectedGraph();

	for (const row of nodeRows) {
		const cardId = row[0] as string;
		g.addNode(cardId);
	}

	for (const row of edgeRows) {
		const sourceId = row[0] as string;
		const targetId = row[1] as string;
		// mergeEdge handles parallel edges silently (deduplicates to unique pairs)
		g.mergeEdge(sourceId, targetId);
	}

	const durationMs = Math.round(performance.now() - start);

	return {
		cardCount: g.order,
		edgeCount: g.size,
		algorithmsComputed: [], // Phase 114 stub — no algorithms executed
		durationMs,
		renderToken: payload.renderToken,
	};
}

// ---------------------------------------------------------------------------
// handleGraphMetricsRead
// ---------------------------------------------------------------------------

/**
 * Read graph metrics rows from graph_metrics table.
 *
 * If cardIds is provided and non-empty, returns only those rows.
 * If cardIds is undefined or empty, returns all rows.
 *
 * @param db      - Database instance
 * @param payload - Optional card ID filter
 * @returns       - Array of metric rows
 */
export function handleGraphMetricsRead(
	db: Database,
	payload: WorkerPayloads['graph:metrics-read'],
): WorkerResponses['graph:metrics-read'] {
	if (payload.cardIds !== undefined && payload.cardIds.length > 0) {
		return readGraphMetrics(db, payload.cardIds);
	}
	return readAllGraphMetrics(db);
}

// ---------------------------------------------------------------------------
// handleGraphMetricsClear
// ---------------------------------------------------------------------------

/**
 * Delete all rows from the graph_metrics table.
 *
 * Called when the user explicitly triggers a metrics clear, or when
 * the graph structure changes enough to invalidate all metrics.
 *
 * @param db - Database instance
 * @returns  - Success indicator
 */
export function handleGraphMetricsClear(db: Database): WorkerResponses['graph:metrics-clear'] {
	clearGraphMetrics(db);
	return { success: true };
}
