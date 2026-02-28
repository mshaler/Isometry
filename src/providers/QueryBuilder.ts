// Isometry v5 — Phase 4 QueryBuilder
// The sole SQL assembly point — composes provider compile() outputs into complete queries.
//
// Design:
//   - Accepts only FilterProvider, PAFVProvider, and DensityProvider
//   - All SQL fragments come exclusively from provider compile() outputs
//   - No raw SQL parameter, no customWhere, no escape hatch of any kind
//   - buildCardQuery(), buildCountQuery(), buildGroupedQuery() are the only public methods
//   - Does NOT execute queries — returns {sql, params} objects for WorkerBridge
//
// Requirements: PROV-01, PROV-03, PROV-07

import type { FilterProvider } from './FilterProvider';
import type { PAFVProvider } from './PAFVProvider';
import type { DensityProvider } from './DensityProvider';

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

/**
 * A compiled SQL query ready to be sent to the Worker.
 * sql contains parameterized SQL (? placeholders), params are the bound values.
 */
export interface CompiledQuery {
  /** Parameterized SQL statement — safe for execution via WorkerBridge */
  sql: string;
  /** Bound parameter values in the order they appear in sql */
  params: unknown[];
}

// ---------------------------------------------------------------------------
// Options types
// ---------------------------------------------------------------------------

/**
 * Options for buildCardQuery().
 */
export interface CardQueryOptions {
  /** Maximum number of rows to return */
  limit?: number;
  /** Number of rows to skip (requires limit) */
  offset?: number;
  /** When true, removes the deleted_at IS NULL clause from WHERE */
  includeDeleted?: boolean;
}

// ---------------------------------------------------------------------------
// QueryBuilder
// ---------------------------------------------------------------------------

/**
 * Assembles complete SQL queries by composing provider compile() outputs.
 *
 * This is the airtight boundary between the provider layer and SQL execution.
 * Every SQL fragment comes from a provider's compile() method. No raw SQL
 * can enter from outside — there is no escape hatch.
 *
 * Usage:
 * ```typescript
 * const qb = new QueryBuilder(filterProvider, axisProvider, densityProvider);
 * const { sql, params } = qb.buildCardQuery({ limit: 50 });
 * await bridge.send('db:exec', { sql, params });
 * ```
 */
export class QueryBuilder {
  constructor(
    private readonly filter: FilterProvider,
    private readonly axis: PAFVProvider,
    private readonly density: DensityProvider
  ) {}

  // ---------------------------------------------------------------------------
  // buildCardQuery
  // ---------------------------------------------------------------------------

  /**
   * Build a SELECT * query for card list views.
   *
   * Composes:
   *   - FilterProvider.compile() → WHERE clause + params
   *   - PAFVProvider.compile() → ORDER BY clause
   *   - limit/offset options → LIMIT/OFFSET clauses
   *
   * @param options - Optional limit, offset, includeDeleted
   * @returns CompiledQuery with parameterized SQL and bound params
   */
  buildCardQuery(options: CardQueryOptions = {}): CompiledQuery {
    const { limit, offset, includeDeleted = false } = options;

    // Get provider fragments
    const compiledFilter = this.filter.compile();
    const compiledAxis = this.axis.compile();

    // Build SQL parts
    const parts: string[] = ['SELECT * FROM cards'];
    const params: unknown[] = [];

    // WHERE clause
    const whereClause = buildWhereClause(compiledFilter.where, compiledFilter.params, includeDeleted);
    if (whereClause !== null) {
      parts.push(`WHERE ${whereClause.sql}`);
      params.push(...whereClause.params);
    }

    // ORDER BY clause (from PAFVProvider)
    if (compiledAxis.orderBy !== '') {
      parts.push(`ORDER BY ${compiledAxis.orderBy}`);
    }

    // LIMIT clause
    if (limit !== undefined) {
      parts.push('LIMIT ?');
      params.push(limit);
    }

    // OFFSET clause (only valid with LIMIT, but we accept it regardless)
    if (offset !== undefined) {
      parts.push('OFFSET ?');
      params.push(offset);
    }

    return { sql: parts.join(' '), params };
  }

  // ---------------------------------------------------------------------------
  // buildCountQuery
  // ---------------------------------------------------------------------------

  /**
   * Build a SELECT COUNT(*) query for total card count.
   *
   * Same WHERE as buildCardQuery() but:
   *   - Returns COUNT(*) as count
   *   - No ORDER BY (irrelevant for count)
   *   - No LIMIT/OFFSET (counts all matching rows)
   *
   * @returns CompiledQuery with parameterized SQL and bound params
   */
  buildCountQuery(): CompiledQuery {
    const compiledFilter = this.filter.compile();

    const parts: string[] = ['SELECT COUNT(*) as count FROM cards'];
    const params: unknown[] = [];

    // WHERE clause (always uses deleted_at IS NULL — includeDeleted not supported for count)
    const whereClause = buildWhereClause(compiledFilter.where, compiledFilter.params, false);
    if (whereClause !== null) {
      parts.push(`WHERE ${whereClause.sql}`);
      params.push(...whereClause.params);
    }

    return { sql: parts.join(' '), params };
  }

  // ---------------------------------------------------------------------------
  // buildGroupedQuery
  // ---------------------------------------------------------------------------

  /**
   * Build a SELECT query with GROUP BY for grouped views (Kanban, Calendar, etc.).
   *
   * GROUP BY source priority:
   *   1. PAFVProvider.compile().groupBy (explicit axis grouping)
   *   2. DensityProvider.compile().groupExpr (time-based grouping)
   *   3. No GROUP BY if both are empty
   *
   * @returns CompiledQuery with parameterized SQL and bound params
   */
  buildGroupedQuery(): CompiledQuery {
    const compiledFilter = this.filter.compile();
    const compiledAxis = this.axis.compile();
    const compiledDensity = this.density.compile();

    const parts: string[] = ['SELECT * FROM cards'];
    const params: unknown[] = [];

    // WHERE clause
    const whereClause = buildWhereClause(compiledFilter.where, compiledFilter.params, false);
    if (whereClause !== null) {
      parts.push(`WHERE ${whereClause.sql}`);
      params.push(...whereClause.params);
    }

    // GROUP BY: prefer axis groupBy, fall back to density groupExpr
    const groupByExpr = compiledAxis.groupBy !== ''
      ? compiledAxis.groupBy
      : compiledDensity.groupExpr !== ''
        ? compiledDensity.groupExpr
        : '';

    if (groupByExpr !== '') {
      parts.push(`GROUP BY ${groupByExpr}`);
    }

    return { sql: parts.join(' '), params };
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Build a WHERE clause, optionally stripping the deleted_at IS NULL base condition.
 *
 * FilterProvider always includes 'deleted_at IS NULL' as the first clause.
 * When includeDeleted is true, we strip it to allow soft-deleted records.
 *
 * Returns null if the resulting WHERE is empty (no clause needed).
 */
function buildWhereClause(
  where: string,
  params: unknown[],
  includeDeleted: boolean
): { sql: string; params: unknown[] } | null {
  if (!includeDeleted) {
    // Standard case: use WHERE as-is from FilterProvider
    if (where === '') return null;
    return { sql: where, params: [...params] };
  }

  // includeDeleted: strip 'deleted_at IS NULL' from the where string
  // FilterProvider always produces 'deleted_at IS NULL' at the start, so:
  // - 'deleted_at IS NULL' alone → empty WHERE
  // - 'deleted_at IS NULL AND ...' → strip prefix, keep the rest
  let stripped = where;
  if (stripped === 'deleted_at IS NULL') {
    return null;
  }
  if (stripped.startsWith('deleted_at IS NULL AND ')) {
    stripped = stripped.slice('deleted_at IS NULL AND '.length);
  }

  if (stripped === '') return null;
  return { sql: stripped, params: [...params] };
}
