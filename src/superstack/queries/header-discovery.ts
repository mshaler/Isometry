/**
 * SuperStack SQL Query Builders
 *
 * Generate parameterized SQL queries for SuperStack header discovery.
 * Queries extract unique facet combinations with card counts from the cards table.
 *
 * Key features:
 * - Multi-select facets use json_each() CROSS JOIN for array expansion
 * - Time facets use strftime() for date extraction
 * - All queries are parameterized to prevent SQL injection
 * - Deleted cards are excluded by default
 */

import type { FacetConfig } from '../types/superstack';

/**
 * Filter operator types for query filtering.
 */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'between'
  | 'in';

/**
 * Query filter configuration.
 */
export interface QueryFilter {
  /** Facet ID to filter on */
  facetId: string;
  /** Filter operator */
  operator: FilterOperator;
  /** Filter value(s) - array for 'in' and 'between' operators */
  value: string | number | (string | number)[];
}

/**
 * Query options for customizing behavior.
 */
export interface QueryOptions {
  /** Include soft-deleted cards (default: false) */
  includeDeleted?: boolean;
  /** Maximum number of results */
  limit?: number;
  /** Card types to include (default: all types) */
  cardTypes?: string[];
}

/**
 * Built query result containing SQL and parameters.
 */
export interface BuiltQuery {
  /** Parameterized SQL query string */
  sql: string;
  /** Parameter values in order */
  params: (string | number)[];
}

/**
 * Track multi-select facets for CROSS JOIN alias coordination.
 */
interface MultiSelectInfo {
  facet: FacetConfig;
  index: number;
  alias: string;
}

/**
 * Build SELECT clause for a single facet.
 *
 * @param facet - The facet configuration
 * @param multiSelectIndex - Index for json_each alias (if multi_select)
 * @returns SQL SELECT fragment for this facet
 */
function buildSelectClause(
  facet: FacetConfig,
  multiSelectIndex: number | null
): string {
  // Multi-select facets: use alias from CROSS JOIN
  if (facet.dataType === 'multi_select' && multiSelectIndex !== null) {
    return `je${multiSelectIndex}.value AS ${facet.id}`;
  }

  // Time facets: use strftime for date extraction
  if (facet.axis === 'T' && facet.timeFormat) {
    return `strftime('${facet.timeFormat}', cards.${facet.sourceColumn}) AS ${facet.id}`;
  }

  // Default: direct column reference
  return `cards.${facet.sourceColumn} AS ${facet.id}`;
}

/**
 * Get the appropriate column reference for GROUP BY clause.
 *
 * @param facet - The facet configuration
 * @param multiSelectIndex - Index for json_each alias (if multi_select)
 * @returns SQL column reference for GROUP BY
 */
function getGroupByColumn(
  facet: FacetConfig,
  multiSelectIndex: number | null
): string {
  // Multi-select: use alias value
  if (facet.dataType === 'multi_select' && multiSelectIndex !== null) {
    return `je${multiSelectIndex}.value`;
  }

  // Time facets: need to repeat strftime (can't use alias in GROUP BY)
  if (facet.axis === 'T' && facet.timeFormat) {
    return `strftime('${facet.timeFormat}', cards.${facet.sourceColumn})`;
  }

  // Default: direct column reference
  return `cards.${facet.sourceColumn}`;
}

/**
 * Build WHERE clause fragment for a single filter.
 *
 * @param filter - The filter configuration
 * @param allFacets - All facets for looking up source columns
 * @param multiSelectMap - Map of facet IDs to their json_each indices
 * @returns Object with SQL fragment and params
 */
function buildFilterClause(
  filter: QueryFilter,
  allFacets: FacetConfig[],
  multiSelectMap: Map<string, number>
): { sql: string; params: (string | number)[] } {
  const facet = allFacets.find(f => f.id === filter.facetId);
  const params: (string | number)[] = [];

  // Determine column reference
  let column: string;
  if (facet?.dataType === 'multi_select') {
    const index = multiSelectMap.get(filter.facetId);
    column = index !== undefined ? `je${index}.value` : `cards.${filter.facetId}`;
  } else if (facet?.axis === 'T' && facet.timeFormat) {
    column = `strftime('${facet.timeFormat}', cards.${facet.sourceColumn})`;
  } else {
    column = `cards.${filter.facetId}`;
  }

  switch (filter.operator) {
    case 'eq':
      params.push(filter.value as string | number);
      return { sql: `${column} = ?`, params };

    case 'neq':
      params.push(filter.value as string | number);
      return { sql: `${column} != ?`, params };

    case 'contains':
      params.push(`%${filter.value}%`);
      return { sql: `${column} LIKE ?`, params };

    case 'gt':
      params.push(filter.value as string | number);
      return { sql: `${column} > ?`, params };

    case 'lt':
      params.push(filter.value as string | number);
      return { sql: `${column} < ?`, params };

    case 'gte':
      params.push(filter.value as string | number);
      return { sql: `${column} >= ?`, params };

    case 'lte':
      params.push(filter.value as string | number);
      return { sql: `${column} <= ?`, params };

    case 'between': {
      const values = filter.value as (string | number)[];
      params.push(values[0], values[1]);
      return { sql: `${column} BETWEEN ? AND ?`, params };
    }

    case 'in': {
      const values = filter.value as (string | number)[];
      const placeholders = values.map(() => '?').join(', ');
      params.push(...values);
      return { sql: `${column} IN (${placeholders})`, params };
    }

    default:
      return { sql: '1=1', params: [] };
  }
}

/**
 * Build header discovery query for SuperStack.
 *
 * Generates a GROUP BY query that returns unique facet combinations
 * with card counts. Supports multi-select facets via json_each() CROSS JOIN
 * and time facets via strftime() extraction.
 *
 * @param rowFacets - Facets for row headers (left axis)
 * @param colFacets - Facets for column headers (top axis)
 * @param filters - Optional filters to apply
 * @param options - Query options (includeDeleted, limit, cardTypes)
 * @returns BuiltQuery with SQL and params
 */
export function buildHeaderDiscoveryQuery(
  rowFacets: FacetConfig[],
  colFacets: FacetConfig[],
  filters: QueryFilter[] = [],
  options: QueryOptions = {}
): BuiltQuery {
  const allFacets = [...rowFacets, ...colFacets];
  const params: (string | number)[] = [];

  // Track multi-select facets for CROSS JOIN coordination
  const multiSelectFacets: MultiSelectInfo[] = [];
  allFacets.forEach((facet) => {
    if (facet.dataType === 'multi_select') {
      multiSelectFacets.push({
        facet,
        index: multiSelectFacets.length,
        alias: `je${multiSelectFacets.length}`,
      });
    }
  });

  // Create map for quick lookup
  const multiSelectMap = new Map<string, number>();
  multiSelectFacets.forEach(info => {
    multiSelectMap.set(info.facet.id, info.index);
  });

  // Build SELECT clause
  const selectClauses = allFacets.map(facet => {
    const msIndex = multiSelectMap.get(facet.id) ?? null;
    return buildSelectClause(facet, msIndex);
  });
  selectClauses.push('COUNT(*) AS card_count');

  // Build FROM clause with CROSS JOINs for multi-select facets
  let fromClause = 'FROM cards';
  multiSelectFacets.forEach(info => {
    fromClause += `\n  CROSS JOIN json_each(cards.${info.facet.sourceColumn}) AS ${info.alias}`;
  });

  // Build WHERE clause
  const whereClauses: string[] = [];

  // Exclude deleted cards by default
  if (!options.includeDeleted) {
    whereClauses.push('cards.deleted_at IS NULL');
  }

  // Filter by card types if specified
  if (options.cardTypes && options.cardTypes.length > 0) {
    const placeholders = options.cardTypes.map(() => '?').join(', ');
    whereClauses.push(`cards.card_type IN (${placeholders})`);
    params.push(...options.cardTypes);
  }

  // Apply user filters
  for (const filter of filters) {
    const { sql: filterSql, params: filterParams } = buildFilterClause(
      filter,
      allFacets,
      multiSelectMap
    );
    whereClauses.push(filterSql);
    params.push(...filterParams);
  }

  // Build GROUP BY clause
  const groupByClauses = allFacets.map(facet => {
    const msIndex = multiSelectMap.get(facet.id) ?? null;
    return getGroupByColumn(facet, msIndex);
  });

  // Build ORDER BY clause (same as GROUP BY)
  const orderByClauses = allFacets.map(facet => {
    const msIndex = multiSelectMap.get(facet.id) ?? null;
    const column = getGroupByColumn(facet, msIndex);
    return facet.sortOrder === 'desc' ? `${column} DESC` : column;
  });

  // Assemble query
  let sql = `SELECT\n  ${selectClauses.join(',\n  ')}\n${fromClause}`;

  if (whereClauses.length > 0) {
    sql += `\nWHERE ${whereClauses.join('\n  AND ')}`;
  }

  sql += `\nGROUP BY ${groupByClauses.join(', ')}`;
  sql += '\nHAVING card_count > 0';
  sql += `\nORDER BY ${orderByClauses.join(', ')}`;

  // Apply limit if specified
  if (options.limit) {
    sql += `\nLIMIT ${options.limit}`;
  }

  return { sql, params };
}

/**
 * Build query for a single axis (convenience wrapper).
 *
 * @param facets - Facets for the single axis
 * @param filters - Optional filters
 * @param options - Query options
 * @returns BuiltQuery with SQL and params
 */
export function buildSingleAxisQuery(
  facets: FacetConfig[],
  filters: QueryFilter[] = [],
  options: QueryOptions = {}
): BuiltQuery {
  return buildHeaderDiscoveryQuery(facets, [], filters, options);
}

/**
 * Build aggregate query for summary statistics.
 *
 * Returns total cards, unique folders, date range, and average priority.
 *
 * @param filters - Optional filters to apply
 * @param options - Query options
 * @returns BuiltQuery with SQL and params
 */
export function buildAggregateQuery(
  filters: QueryFilter[] = [],
  options: QueryOptions = {}
): BuiltQuery {
  const params: (string | number)[] = [];

  // Build WHERE clause
  const whereClauses: string[] = [];

  if (!options.includeDeleted) {
    whereClauses.push('cards.deleted_at IS NULL');
  }

  if (options.cardTypes && options.cardTypes.length > 0) {
    const placeholders = options.cardTypes.map(() => '?').join(', ');
    whereClauses.push(`cards.card_type IN (${placeholders})`);
    params.push(...options.cardTypes);
  }

  // Note: Aggregate queries typically don't use the same filter structure
  // as header discovery, but we support basic filters for consistency
  for (const filter of filters) {
    if (filter.operator === 'eq') {
      whereClauses.push(`cards.${filter.facetId} = ?`);
      params.push(filter.value as string | number);
    }
  }

  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
SELECT
  COUNT(*) AS total_cards,
  COUNT(DISTINCT folder) AS unique_folders,
  COUNT(DISTINCT status) AS unique_statuses,
  MIN(created_at) AS earliest_date,
  MAX(created_at) AS latest_date,
  AVG(priority) AS avg_priority
FROM cards
${whereClause}
  `.trim();

  return { sql, params };
}
