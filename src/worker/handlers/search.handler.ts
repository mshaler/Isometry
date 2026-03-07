// Isometry v5 — Phase 3 Search Handlers
// Thin wrapper around v0.1 FTS5 search function.

import type { Database } from '../../database/Database';
import * as search from '../../database/queries/search';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

/**
 * Handle search:cards request.
 * Returns BM25-ranked search results with snippets.
 */
export function handleSearchCards(
	db: Database,
	payload: WorkerPayloads['search:cards'],
): WorkerResponses['search:cards'] {
	return search.searchCards(db, payload.query, payload.limit);
}
