// Isometry v5 — Phase 7 SuperGridQuery
// Multi-axis GROUP BY query builder for SuperGrid.
//
// Design:
//   - Builds a parameterized SQL query that groups cards by both column and row axes
//   - All field names validated against ALLOWED_AXIS_FIELDS (D-003 SQL safety)
//   - Values are always parameterized (no dynamic SQL construction from user input)
//   - SuperGridQuery is a standalone utility — NOT imported by SuperGrid.ts in this plan
//   - SuperGrid.ts uses in-memory card filtering (cards come from coordinator)
//   - SuperGridQuery will be wired in a future plan when SuperGrid queries the Worker directly
//
// Requirements: REND-02

import { validateAxisField } from '../../providers/allowlist';
import type { AxisMapping } from '../../providers/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for building a SuperGrid GROUP BY query.
 */
export interface SuperGridQueryConfig {
  /** Up to 3 column axis mappings (primary, secondary, tertiary) */
  colAxes: AxisMapping[];
  /** Up to 3 row axis mappings (primary, secondary, tertiary) */
  rowAxes: AxisMapping[];
  /** SQL WHERE clause fragment from FilterProvider.compile() (may be empty string) */
  where: string;
  /** Parameterized values corresponding to the WHERE clause placeholders */
  params: unknown[];
}

/**
 * Compiled SuperGrid query ready for Worker execution.
 */
export interface CompiledSuperGridQuery {
  sql: string;
  params: unknown[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a parameterized GROUP BY SQL query for SuperGrid.
 *
 * The query returns one row per unique (col_axis..., row_axis...) combination
 * with COUNT(*) and GROUP_CONCAT(id) for client-side card assignment.
 *
 * @param config - Column axes, row axes, WHERE clause, and params
 * @returns Compiled SQL + params ready for Worker
 * @throws {Error} If any axis field fails allowlist validation (SQL safety violation)
 *
 * @example
 * buildSuperGridQuery({
 *   colAxes: [{ field: 'card_type', direction: 'asc' }],
 *   rowAxes: [{ field: 'folder', direction: 'asc' }],
 *   where: '',
 *   params: [],
 * })
 * // → SELECT card_type, folder, COUNT(*) AS count, GROUP_CONCAT(id) AS card_ids
 * //    FROM cards WHERE deleted_at IS NULL GROUP BY card_type, folder
 * //    ORDER BY card_type ASC, folder ASC
 */
export function buildSuperGridQuery(config: SuperGridQueryConfig): CompiledSuperGridQuery {
  const { colAxes, rowAxes, where, params } = config;

  // Validate all axis fields against the allowlist (D-003 SQL safety)
  for (const axis of [...colAxes, ...rowAxes]) {
    validateAxisField(axis.field); // throws "SQL safety violation:..." if invalid
  }

  // Build SELECT fields: all axis fields + aggregates
  const selectFields = [...colAxes, ...rowAxes].map(ax => ax.field);
  const selectClause = selectFields.length > 0
    ? selectFields.join(', ')
    : 'NULL';

  // Build WHERE clause
  const baseWhere = 'deleted_at IS NULL';
  const filterWhere = where ? ` AND ${where}` : '';
  const fullWhere = baseWhere + filterWhere;

  // Build GROUP BY clause
  const groupByFields = selectFields;
  const groupByClause = groupByFields.length > 0
    ? `GROUP BY ${groupByFields.join(', ')}`
    : '';

  // Build ORDER BY clause from axis directions
  const orderByParts = [...colAxes, ...rowAxes].map(ax => `${ax.field} ${ax.direction.toUpperCase()}`);
  const orderByClause = orderByParts.length > 0
    ? `ORDER BY ${orderByParts.join(', ')}`
    : '';

  const sql = [
    `SELECT ${selectClause}, COUNT(*) AS count, GROUP_CONCAT(id) AS card_ids`,
    'FROM cards',
    `WHERE ${fullWhere}`,
    groupByClause,
    orderByClause,
  ]
    .filter(Boolean)
    .join('\n');

  return { sql, params: [...params] };
}
