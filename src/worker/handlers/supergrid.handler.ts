// Isometry v5 — Phase 16 SuperGrid Handler
// Handlers for supergrid:query and db:distinct-values Worker message types.
//
// supergrid:query: Executes buildSuperGridQuery() and returns cells with card_ids as string[].
// db:distinct-values: Returns sorted distinct values for a valid axis column.
//
// Both handlers validate axis fields via the allowlist (D-003 SQL safety).

import { buildSuperGridQuery } from '../../views/supergrid/SuperGridQuery';
import { validateAxisField } from '../../providers/allowlist';
import type { Database } from '../../database/Database';
import type { WorkerPayloads, WorkerResponses, CellDatum } from '../protocol';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert columnar result set (from db.exec) to row objects.
 * Zips column names with each row's values array.
 */
function columnarToRows(
  results: { columns: string[]; values: unknown[][] }[]
): Record<string, unknown>[] {
  if (results.length === 0 || !results[0]!.values || results[0]!.values.length === 0) {
    return [];
  }

  const { columns, values } = results[0]!;
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]!] = row[i];
    }
    return obj;
  });
}

// ---------------------------------------------------------------------------
// supergrid:query
// ---------------------------------------------------------------------------

/**
 * Handle supergrid:query request.
 * Calls buildSuperGridQuery() to get parameterized SQL, executes it,
 * and transforms GROUP_CONCAT card_ids from comma-string to string[].
 *
 * @throws {Error} "SQL safety violation:..." if any axis field is invalid
 *   (thrown by buildSuperGridQuery → validateAxisField internally)
 */
export function handleSuperGridQuery(
  db: Database,
  payload: WorkerPayloads['supergrid:query']
): WorkerResponses['supergrid:query'] {
  // buildSuperGridQuery validates axes internally via validateAxisField (DRY)
  const { sql, params } = buildSuperGridQuery(payload);

  // Execute the compiled query using prepare+all pattern (same as handleDbQuery).
  // db.exec() in the Vite-prebundled sql.js browser build returns results with
  // missing `values` property, causing columnarToRows to crash. The prepare().all()
  // loop uses step()+getAsObject() which reliably returns row objects in all environments.
  const stmt = db.prepare<Record<string, unknown>>(sql);
  const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
  stmt.free();

  // Transform rows to CellDatum[] — split card_ids and cast count
  const cells: CellDatum[] = rows.map(row => {
    const cardIdsRaw = row['card_ids'];
    const card_ids: string[] =
      typeof cardIdsRaw === 'string'
        ? cardIdsRaw.split(',').filter(Boolean)
        : [];

    const count = typeof row['count'] === 'number' ? row['count'] : 0;

    // Build CellDatum with all axis columns + count + card_ids
    const cell: CellDatum = { ...row, count, card_ids };
    return cell;
  });

  // Phase 25 SRCH-04 — compute matchedCardIds per cell when search is active
  const trimmedSearch = payload.searchTerm?.trim() ?? '';
  if (trimmedSearch) {
    // Secondary FTS5 query: get all card IDs that match the search term
    const ftsResults = db.exec(
      'SELECT c.id FROM cards_fts JOIN cards c ON c.rowid = cards_fts.rowid WHERE cards_fts MATCH ? AND c.deleted_at IS NULL',
      [trimmedSearch]
    );
    const matchedSet = new Set<string>();
    if (ftsResults.length > 0 && ftsResults[0]!.values) {
      for (const row of ftsResults[0]!.values) {
        if (typeof row[0] === 'string') matchedSet.add(row[0]);
      }
    }

    // Annotate each cell with which of its card_ids matched FTS
    for (const cell of cells) {
      cell['matchedCardIds'] = cell.card_ids.filter(id => matchedSet.has(id));
    }

    return { cells, searchTerms: [trimmedSearch] };
  }

  return { cells };
}

// ---------------------------------------------------------------------------
// db:distinct-values
// ---------------------------------------------------------------------------

/**
 * Handle db:distinct-values request.
 * Returns sorted distinct string values for a valid axis column,
 * scoped to the optional WHERE filter.
 *
 * @throws {Error} "SQL safety violation:..." if column is not in the axis allowlist
 */
export function handleDistinctValues(
  db: Database,
  payload: WorkerPayloads['db:distinct-values']
): WorkerResponses['db:distinct-values'] {
  // Validate column against allowlist FIRST (SQL injection defense — column interpolated)
  validateAxisField(payload.column);

  // Build query with optional WHERE filter
  const whereClause = payload.where
    ? ` AND ${payload.where}`
    : '';

  const sql = `SELECT DISTINCT ${payload.column} FROM cards WHERE deleted_at IS NULL${whereClause} ORDER BY ${payload.column} ASC`;
  const params = payload.params ?? [];

  // Execute and extract flat string array
  const results = db.exec(sql, params as import('sql.js').BindParams);

  if (results.length === 0 || results[0]!.values.length === 0) {
    return { values: [] };
  }

  // Extract first column values, filtering nulls
  const values: string[] = results[0]!.values
    .map(row => row[0])
    .filter((v): v is string => typeof v === 'string');

  return { values };
}
