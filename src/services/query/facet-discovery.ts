/**
 * Facet Discovery Service
 *
 * Phase 100-02: Schema-on-read facet value discovery
 *
 * Purpose: Query actual data to discover available filter values for LATCH facets.
 * Replaces hardcoded dropdown options with dynamic discovery from the cards table.
 *
 * Key features:
 * - Generic discovery for any column (folder, status, priority, tags)
 * - Multi-select handling via json_each (tags arrays)
 * - Count-based ordering (most common values first)
 * - Safety guards (json_valid, null exclusion, limit)
 */

import type { Database } from 'sql.js';

// ============================================================================
// Types
// ============================================================================

/** A discovered facet value with usage count */
export interface DiscoveredValue {
  value: string;
  count: number;
}

/** Options for facet value discovery */
export interface DiscoveryOptions {
  /** Exclude null/empty values (default: true) */
  excludeNull?: boolean;
  /** Maximum number of values to return (default: 100) */
  limit?: number;
  /** Whether this is a multi-select column (JSON array) */
  isMultiSelect?: boolean;
}

/** SQL value types (matches sql.js BindParams) */
type SqlValue = number | string | Uint8Array | null;

/** Query result for testability */
export interface DiscoveryQuery {
  sql: string;
  params: SqlValue[];
}

// ============================================================================
// Query Builders
// ============================================================================

/**
 * Build SQL query for facet value discovery.
 * Returns query object for testing and execution.
 *
 * @param column - Column name in cards table
 * @param options - Discovery options
 * @returns Query with SQL and params
 */
export function buildFacetDiscoveryQuery(
  column: string,
  options: DiscoveryOptions = {}
): DiscoveryQuery {
  const { excludeNull = true, limit = 100, isMultiSelect = false } = options;

  if (isMultiSelect) {
    // Multi-select pattern: explode JSON array via json_each
    // CRITICAL: json_valid() guards against malformed data
    let sql = `
      SELECT je.value, COUNT(*) as count
      FROM cards
      CROSS JOIN json_each(cards.${column}) AS je
      WHERE deleted_at IS NULL
        AND ${column} IS NOT NULL
        AND json_valid(${column})
    `;

    if (excludeNull) {
      sql += `\n        AND je.value IS NOT NULL AND je.value != ''`;
    }

    sql += `
      GROUP BY je.value
      ORDER BY count DESC
      LIMIT ?
    `;

    return { sql, params: [limit] };
  } else {
    // Standard column: GROUP BY column value
    let sql = `
      SELECT DISTINCT ${column} as value, COUNT(*) as count
      FROM cards
      WHERE deleted_at IS NULL
    `;

    if (excludeNull) {
      sql += `\n        AND ${column} IS NOT NULL AND ${column} != ''`;
    }

    sql += `
      GROUP BY ${column}
      ORDER BY count DESC
      LIMIT ?
    `;

    return { sql, params: [limit] };
  }
}

// ============================================================================
// Discovery Functions
// ============================================================================

/**
 * Discover folder values from cards table.
 * Returns distinct folders ordered by usage count.
 *
 * @param db - sql.js Database instance
 * @returns Array of discovered folder values with counts
 */
export function discoverFolderValues(db: Database): DiscoveredValue[] {
  return discoverFacetValues(db, 'folder');
}

/**
 * Discover status values from cards table.
 * Returns distinct statuses ordered by usage count.
 *
 * @param db - sql.js Database instance
 * @returns Array of discovered status values with counts
 */
export function discoverStatusValues(db: Database): DiscoveredValue[] {
  return discoverFacetValues(db, 'status');
}

/**
 * Generic facet value discovery for any column.
 * Works for standard columns and multi-select (JSON array) columns.
 *
 * @param db - sql.js Database instance
 * @param column - Column name to discover values from
 * @param options - Discovery options (excludeNull, limit, isMultiSelect)
 * @returns Array of discovered values with counts
 */
export function discoverFacetValues(
  db: Database,
  column: string,
  options: DiscoveryOptions = {}
): DiscoveredValue[] {
  try {
    const { sql, params } = buildFacetDiscoveryQuery(column, options);

    const result = db.exec(sql, params);

    if (!result[0] || !result[0].values || result[0].values.length === 0) {
      return [];
    }

    // Transform SQL results to DiscoveredValue format
    const columns = result[0].columns;
    const valueIdx = columns.indexOf('value');
    const countIdx = columns.indexOf('count');

    return result[0].values.map((row) => ({
      value: String(row[valueIdx] ?? ''),
      count: Number(row[countIdx] ?? 0),
    }));
  } catch (error) {
    console.warn(`[FacetDiscovery] Query failed for column "${column}":`, error);
    return [];
  }
}
