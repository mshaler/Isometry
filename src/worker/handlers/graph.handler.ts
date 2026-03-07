// Isometry v5 — Phase 3 Graph Handlers
// Thin wrappers around v0.1 graph traversal functions.

import type { Database } from '../../database/Database';
import * as graph from '../../database/queries/graph';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

/**
 * Handle graph:connected request.
 * Returns cards reachable from a starting node up to maxDepth hops.
 */
export function handleGraphConnected(
	db: Database,
	payload: WorkerPayloads['graph:connected'],
): WorkerResponses['graph:connected'] {
	return graph.connectedCards(db, payload.startId, payload.maxDepth);
}

/**
 * Handle graph:shortestPath request.
 * Returns ordered array of card IDs forming shortest path, or null.
 */
export function handleGraphShortestPath(
	db: Database,
	payload: WorkerPayloads['graph:shortestPath'],
): WorkerResponses['graph:shortestPath'] {
	return graph.shortestPath(db, payload.fromId, payload.toId);
}
