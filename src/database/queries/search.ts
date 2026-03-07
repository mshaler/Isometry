// Isometry v5 — FTS5 Full-Text Search
// Implements SRCH-01 through SRCH-04.
//
// Pattern: Pass Database instance to every function (no module-level state).
// Uses db.exec() for SELECT with FTS5 MATCH.
//
// Key design decisions:
//   - JOIN on c.rowid = cards_fts.rowid (NEVER on c.id) — D-004
//   - ORDER BY rank (FTS5 virtual column, not bm25()) — faster with LIMIT
//   - BM25 score convention: FTS5 makes scores negative; more negative = better match
//   - snippet(-1, ...) lets SQLite auto-select the best matching column
//   - AND c.deleted_at IS NULL in the JOIN — Pitfall 1 from research

import type { SqlValue } from 'sql.js';
import type { Database } from '../Database';
import { rowToCard } from './helpers';
import type { SearchResult } from './types';

// ---------------------------------------------------------------------------
// SRCH-01: BM25-ranked results
// SRCH-02: rowid joins (c.rowid = cards_fts.rowid, never id)
// SRCH-03: Snippets with <mark> highlighted match context
// SRCH-04: Limit parameter caps result count
// ---------------------------------------------------------------------------

/**
 * Full-text search over cards using FTS5 BM25 ranking with snippet highlighting.
 *
 * Returns results ordered by BM25 rank ascending (best match first — FTS5 rank
 * is negative, so ascending order gives the most-negative score first).
 *
 * SRCH-02 critical: JOIN uses `c.rowid = cards_fts.rowid`, never `c.id`.
 * The FTS5 rowid is the SQLite internal rowid of the `cards` table row.
 *
 * Soft-deleted cards are excluded via `AND c.deleted_at IS NULL` on the
 * JOIN target (not on the FTS MATCH predicate — see Pitfall 1 from research).
 *
 * @param db    - Database instance (initialized)
 * @param query - FTS5 query string (supports implicit AND, OR, phrase queries)
 * @param limit - Maximum results to return (default 20)
 * @returns     - Array of SearchResult with card, BM25 rank, and snippet
 */
export function searchCards(db: Database, query: string, limit: number = 20): SearchResult[] {
	// SRCH-01 guard: empty or whitespace-only query returns no results
	if (!query.trim()) return [];

	// CRITICAL (SRCH-02): JOIN on rowid, NEVER on id
	// CRITICAL (SRCH-01): ORDER BY rank (FTS5 virtual column), not ORDER BY bm25(cards_fts)
	//   - rank is an optimized alias that FTS5 pre-computes; faster than calling bm25() inline
	//   - Ascending order: FTS5 rank is negative, most-negative = best match comes first
	// snippet() params: table, column_index, open_mark, close_mark, ellipsis, max_tokens
	//   - column_index -1: auto-select column with best match (per FTS5 docs)
	//   - max_tokens 32: ~32 tokens of context surrounding the match
	const result = db.exec(
		`SELECT c.*,
            rank,
            snippet(cards_fts, -1, '<mark>', '</mark>', '...', 32) AS snippet_text
     FROM cards_fts
     JOIN cards c ON c.rowid = cards_fts.rowid
     WHERE cards_fts MATCH ?
       AND c.deleted_at IS NULL
     ORDER BY rank
     LIMIT ?`,
		[query, limit],
	);

	if (!result[0]) return [];

	const { columns, values } = result[0];
	return values.map((row) => {
		const obj: Record<string, unknown> = {};
		columns.forEach((col, i) => {
			obj[col] = row[i];
		});
		return {
			card: rowToCard(obj as Record<string, SqlValue>),
			rank: obj['rank'] as number,
			snippet: obj['snippet_text'] as string,
		};
	});
}
