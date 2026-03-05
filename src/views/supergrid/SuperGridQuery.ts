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
import type { AxisMapping, TimeGranularity } from '../../providers/types';

// ---------------------------------------------------------------------------
// Internal constants (Phase 22 Plan 02 — DENS-01)
// ---------------------------------------------------------------------------

/**
 * Time fields that can be wrapped with strftime() GROUP BY expressions.
 * Only these fields are eligible for granularity-based query rewriting.
 */
const ALLOWED_TIME_FIELDS = new Set(['created_at', 'modified_at', 'due_at']);

/**
 * strftime() patterns for time hierarchy collapse (DENS-01).
 * Mirrors DensityProvider.STRFTIME_PATTERNS — kept local to avoid cross-module coupling.
 * Validation happens on raw field name BEFORE these patterns are applied.
 */
const STRFTIME_PATTERNS: Record<string, (field: string) => string> = {
  day:     (field: string) => `strftime('%Y-%m-%d', ${field})`,
  week:    (field: string) => `strftime('%Y-W%W', ${field})`,
  month:   (field: string) => `strftime('%Y-%m', ${field})`,
  quarter: (field: string) => `strftime('%Y', ${field}) || '-Q' || ((CAST(strftime('%m', ${field}) AS INT) - 1) / 3 + 1)`,
  year:    (field: string) => `strftime('%Y', ${field})`,
};

/**
 * Compile an axis field expression.
 * If granularity is set AND the field is a time field, wraps it in the
 * appropriate strftime() expression. Otherwise returns the raw field name.
 *
 * CRITICAL: validateAxisField(field) MUST be called BEFORE this function.
 * The strftime expression is NOT in the allowlist — validation must happen
 * on the raw field name to avoid false SQL safety violations.
 */
function compileAxisExpr(field: string, granularity: TimeGranularity | null | undefined): string {
  if (granularity && ALLOWED_TIME_FIELDS.has(field)) {
    const pattern = STRFTIME_PATTERNS[granularity];
    if (pattern) return pattern(field);
  }
  return field;
}

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
  /**
   * Phase 22 DENS-01 — optional time hierarchy granularity.
   * When set and a time-field axis (created_at / modified_at / due_at) is present,
   * rewrites GROUP BY via strftime() to collapse day-level rows into the requested level.
   * Non-time axes are unaffected. Null or undefined = no granularity wrapping.
   */
  granularity?: TimeGranularity | null;
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
  const granularity = config.granularity ?? null;

  // Validate all axis fields against the allowlist FIRST (D-003 SQL safety).
  // CRITICAL: Validation MUST use raw field names — strftime expressions are not in the
  // allowlist. compileAxisExpr() is called AFTER validation.
  for (const axis of [...colAxes, ...rowAxes]) {
    validateAxisField(axis.field); // throws "SQL safety violation:..." if invalid
  }

  // Build SELECT fields: compile each axis field (may wrap in strftime for time fields)
  // Raw field name used as alias (e.g., `strftime('%Y-%m', created_at) AS created_at`)
  const allAxes = [...colAxes, ...rowAxes];
  const selectParts = allAxes.map(ax => {
    const expr = compileAxisExpr(ax.field, granularity);
    // If expression differs from raw field name, use field name as alias for downstream consumers
    return expr !== ax.field ? `${expr} AS ${ax.field}` : expr;
  });

  const selectClause = selectParts.length > 0
    ? selectParts.join(', ')
    : 'NULL';

  // Build WHERE clause
  const baseWhere = 'deleted_at IS NULL';
  const filterWhere = where ? ` AND ${where}` : '';
  const fullWhere = baseWhere + filterWhere;

  // Build GROUP BY clause using compiled expressions (same as SELECT expressions, without alias)
  const groupByExprs = allAxes.map(ax => compileAxisExpr(ax.field, granularity));
  const groupByClause = groupByExprs.length > 0
    ? `GROUP BY ${groupByExprs.join(', ')}`
    : '';

  // Build ORDER BY clause using compiled expressions (consistent with GROUP BY)
  const orderByParts = allAxes.map(ax => {
    const expr = compileAxisExpr(ax.field, granularity);
    return `${expr} ${ax.direction.toUpperCase()}`;
  });
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
