// Isometry v5 — Graph Traversal Queries
// Implements PERF-04 functional behavior: depth-limited traversal and shortest path.
//
// Pattern: Pass Database instance to every function (no module-level state).
// Uses recursive CTEs running entirely within SQLite/WASM (no JS-side BFS/DFS).
// Connection indexes (idx_conn_source, idx_conn_target) accelerate traversal.

import type { Database } from '../Database';
import type { CardWithDepth } from './types';
import { rowToCard } from './helpers';
import type { SqlValue } from 'sql.js';

// ---------------------------------------------------------------------------
// connectedCards — Depth-limited bidirectional graph traversal
// ---------------------------------------------------------------------------

/**
 * Return all cards reachable from startId up to maxDepth hops, with depth info.
 *
 * Key properties:
 * - UNION (not UNION ALL) provides automatic cycle prevention by deduplicating
 *   (card_id, depth) pairs within the recursive CTE (Pitfall 5 from research).
 * - Bidirectional: follows both outgoing (source_id=card_id) and incoming
 *   (target_id=card_id) edges.
 * - Excludes the start card from results.
 * - Excludes soft-deleted cards (deleted_at IS NULL).
 * - Returns minimum depth for each reachable card (BFS-like ordering).
 * - Returns empty array when maxDepth <= 0.
 *
 * Performance: at 10K cards / 50K connections, idx_conn_source and
 * idx_conn_target indexes are used per recursive step. p95 threshold
 * (<500ms) is validated in Plan 05's benchmark suite.
 */
export function connectedCards(
  db: Database,
  startId: string,
  maxDepth: number = 3
): CardWithDepth[] {
  if (maxDepth <= 0) return [];

  // UNION (not UNION ALL) prevents revisiting the same node (cycle prevention).
  // The CTE deduplicates on (card_id, depth) pairs: since depth is monotonically
  // increasing and UNION removes duplicates, each card_id appears at its minimum depth.
  // UNION (not UNION ALL) deduplicates on (card_id, depth) pairs in the CTE.
  // However, the same card may be reachable at multiple depth levels via different paths.
  // We use a subquery to get the minimum depth per card, then join back to cards.
  const result = db.exec(
    `WITH RECURSIVE traversal(card_id, depth) AS (
       -- Base case: start node at depth 0
       SELECT ?, 0
       UNION
       -- Recursive case: follow connections bidirectionally
       SELECT
         CASE
           WHEN c.source_id = t.card_id THEN c.target_id
           ELSE c.source_id
         END,
         t.depth + 1
       FROM traversal t
       JOIN connections c ON c.source_id = t.card_id OR c.target_id = t.card_id
       WHERE t.depth < ?
     ),
     min_depth AS (
       -- Collapse to minimum depth per card_id, excluding the start node
       SELECT card_id, MIN(depth) AS depth
       FROM traversal
       WHERE card_id != ?
       GROUP BY card_id
     )
     SELECT cards.*, min_depth.depth
     FROM min_depth
     JOIN cards ON cards.id = min_depth.card_id
     WHERE cards.deleted_at IS NULL
     ORDER BY min_depth.depth, cards.name`,
    [startId, maxDepth, startId]
  );

  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    const depth = obj['depth'] as number;
    return { card: rowToCard(obj as Record<string, SqlValue>), depth };
  });
}

// ---------------------------------------------------------------------------
// shortestPath — Find the shortest path between two cards
// ---------------------------------------------------------------------------

/**
 * Return the ordered array of card IDs forming the shortest path from fromId to toId,
 * or null if no path exists.
 *
 * Special cases:
 * - fromId === toId: returns [] (same card, zero-length path)
 * - toId not reachable from fromId: returns null
 * - toId does not exist: returns null
 *
 * Implementation: BFS via recursive CTE with path string accumulation.
 * The path is stored as comma-separated IDs in a TEXT column.
 * A LIKE check prevents revisiting already-visited nodes (avoids cycles without
 * relying on UNION dedup, since UNION would collapse distinct paths sharing a node).
 *
 * Hard-limits to depth 10 to prevent unbounded recursion on large graphs.
 * This matches the p95 use case: most meaningful shortest paths are < 10 hops.
 */
export function shortestPath(
  db: Database,
  fromId: string,
  toId: string
): string[] | null {
  if (fromId === toId) return [];

  // BFS via recursive CTE with path accumulation.
  // Path stored as comma-separated IDs: "A,B,C"
  // LIKE check prevents revisiting: "path NOT LIKE '%,nextId,%' AND path NOT LIKE '%,nextId'"
  const result = db.exec(
    `WITH RECURSIVE pathfinder(card_id, path, depth) AS (
       -- Base case: start at fromId with initial path
       SELECT ?, ?, 0
       UNION
       -- Recursive case: extend path by one hop
       SELECT
         CASE
           WHEN c.source_id = p.card_id THEN c.target_id
           ELSE c.source_id
         END,
         p.path || ',' ||
         CASE
           WHEN c.source_id = p.card_id THEN c.target_id
           ELSE c.source_id
         END,
         p.depth + 1
       FROM pathfinder p
       JOIN connections c ON c.source_id = p.card_id OR c.target_id = p.card_id
       WHERE p.depth < 10
         AND p.path NOT LIKE '%,' ||
           CASE
             WHEN c.source_id = p.card_id THEN c.target_id
             ELSE c.source_id
           END || ',%'
         AND p.path NOT LIKE '%,' ||
           CASE
             WHEN c.source_id = p.card_id THEN c.target_id
             ELSE c.source_id
           END
     )
     SELECT path FROM pathfinder
     WHERE card_id = ?
     ORDER BY depth
     LIMIT 1`,
    [fromId, fromId, toId]
  );

  if (!result[0]?.values[0]) return null;
  const pathStr = result[0].values[0][0] as string;
  return pathStr.split(',');
}
