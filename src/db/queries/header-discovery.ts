/**
 * Header Discovery Query Generator
 *
 * Generates SQL queries for SuperStack header discovery based on facet configuration.
 * Dispatches on facet.dataType to build appropriate GROUP BY queries for:
 * - Time facets (date) → strftime extraction
 * - Multi-select facets (tags) → json_each explosion
 * - Simple facets (text, select, number) → direct COALESCE grouping
 *
 * Phase 90-01: SQL Integration for SuperStack headers
 */

import type { FacetConfig } from '../../superstack/types/superstack';

/**
 * Build SQL query to discover unique header values for a single facet.
 * Dispatches on facet.dataType to generate appropriate SQL.
 *
 * @param facet - FacetConfig defining the facet to query
 * @returns SQL query string that returns { value, card_count } rows
 * @throws TypeError if dataType is unsupported or required fields are missing
 */
export function buildHeaderDiscoveryQuery(facet: FacetConfig): string {
  const { sourceColumn, dataType, timeFormat } = facet;

  // Defensive: empty sourceColumn returns empty result
  if (!sourceColumn) {
    return 'SELECT NULL as value, 0 as card_count WHERE 1=0';
  }

  // Dispatch on dataType
  switch (dataType) {
    case 'date':
      return buildDateFacetQuery(sourceColumn, timeFormat);

    case 'multi_select':
      return buildMultiSelectQuery(sourceColumn);

    case 'text':
    case 'select':
    case 'number':
      return buildSimpleFacetQuery(sourceColumn);

    default:
      throw new TypeError(`Unsupported dataType: ${dataType}`);
  }
}

/**
 * Build SQL query for time facets using strftime extraction.
 *
 * @param column - Source column name (e.g., 'created_at')
 * @param timeFormat - strftime format string (e.g., '%Y', '%B', '%Q')
 * @returns SQL query with appropriate time extraction
 * @throws TypeError if timeFormat is missing
 */
function buildDateFacetQuery(column: string, timeFormat?: string): string {
  if (!timeFormat) {
    throw new TypeError('Missing timeFormat for date facet');
  }

  // Quarter requires special formula
  if (timeFormat === '%Q') {
    const quarterFormula = `'Q' || ((CAST(strftime('%m', ${column}) AS INTEGER) - 1) / 3 + 1)`;
    return `
      SELECT ${quarterFormula} as value, COUNT(*) as card_count
      FROM nodes
      WHERE deleted_at IS NULL AND ${column} IS NOT NULL
      GROUP BY value
      ORDER BY value DESC
    `.trim();
  }

  // Month name requires numeric ordering
  if (timeFormat === '%B') {
    return `
      SELECT strftime('%B', ${column}) as value, COUNT(*) as card_count
      FROM nodes
      WHERE deleted_at IS NULL AND ${column} IS NOT NULL
      GROUP BY value
      ORDER BY strftime('%m', ${column})
    `.trim();
  }

  // Standard strftime formats (year, week, etc.)
  return `
    SELECT strftime('${timeFormat}', ${column}) as value, COUNT(*) as card_count
    FROM nodes
    WHERE deleted_at IS NULL AND ${column} IS NOT NULL
    GROUP BY value
    ORDER BY value DESC
  `.trim();
}

/**
 * Build SQL query for multi-select facets (tags) using json_each.
 *
 * @param column - Source column containing JSON array
 * @returns SQL query that explodes array and groups by value
 */
function buildMultiSelectQuery(column: string): string {
  return `
    SELECT json_each.value, COUNT(*) as card_count
    FROM nodes, json_each(nodes.${column})
    WHERE nodes.deleted_at IS NULL
      AND nodes.${column} IS NOT NULL
      AND nodes.${column} != '[]'
    GROUP BY json_each.value
    ORDER BY card_count DESC
  `.trim();
}

/**
 * Build SQL query for simple facets (text, select, number).
 *
 * @param column - Source column name
 * @returns SQL query with COALESCE for NULL handling
 */
function buildSimpleFacetQuery(column: string): string {
  return `
    SELECT COALESCE(${column}, 'Unassigned') as value, COUNT(*) as card_count
    FROM nodes
    WHERE deleted_at IS NULL
    GROUP BY value
    ORDER BY card_count DESC
  `.trim();
}

/**
 * Generate SQL fragment for a single facet's SELECT clause.
 * Used by buildStackedHeaderQuery to compose multi-facet queries.
 *
 * @param facet - FacetConfig to generate SELECT fragment for
 * @param alias - Column alias for the output
 * @returns SQL fragment for SELECT clause
 */
export function buildFacetSelect(facet: FacetConfig, alias?: string): string {
  const { sourceColumn, dataType, timeFormat } = facet;
  const outputAlias = alias || facet.id;

  switch (dataType) {
    case 'date': {
      if (!timeFormat) {
        throw new TypeError('Missing timeFormat for date facet');
      }
      // Quarter requires special formula
      if (timeFormat === '%Q') {
        const quarterFormula = `'Q' || ((CAST(strftime('%m', ${sourceColumn}) AS INTEGER) - 1) / 3 + 1)`;
        return `${quarterFormula} as ${outputAlias}`;
      }
      return `strftime('${timeFormat}', ${sourceColumn}) as ${outputAlias}`;
    }

    case 'multi_select':
      // Note: multi_select requires special FROM clause handling (json_each)
      // This SELECT fragment assumes FROM clause includes json_each join
      return `json_each.value as ${outputAlias}`;

    case 'text':
    case 'select':
    case 'number':
      return `COALESCE(${sourceColumn}, 'Unassigned') as ${outputAlias}`;

    default:
      throw new TypeError(`Unsupported dataType: ${dataType}`);
  }
}

/**
 * Build SQL query for stacked multi-facet header discovery.
 * Handles up to 3 facet levels (e.g., year > quarter > month).
 *
 * @param facets - Array of FacetConfig in hierarchy order (outermost first)
 * @returns SQL query that returns all facet columns plus card_count
 */
export function buildStackedHeaderQuery(facets: FacetConfig[]): string {
  if (facets.length === 0) {
    return 'SELECT 0 as card_count WHERE 1=0';
  }

  // Single facet - delegate to buildHeaderDiscoveryQuery
  if (facets.length === 1) {
    return buildHeaderDiscoveryQuery(facets[0]);
  }

  // Multi-facet stacking
  const selectFragments: string[] = [];
  const groupByFragments: string[] = [];
  let fromClause = 'FROM nodes';
  let hasMultiSelect = false;

  facets.forEach((facet, index) => {
    const alias = `facet_${index}`;

    // Build SELECT fragment
    selectFragments.push(buildFacetSelect(facet, alias));

    // Track for GROUP BY (same as SELECT without 'as alias')
    if (facet.dataType === 'multi_select') {
      hasMultiSelect = true;
      groupByFragments.push('json_each.value');
    } else if (facet.dataType === 'date' && facet.timeFormat === '%Q') {
      const quarterFormula = `'Q' || ((CAST(strftime('%m', ${facet.sourceColumn}) AS INTEGER) - 1) / 3 + 1)`;
      groupByFragments.push(quarterFormula);
    } else if (facet.dataType === 'date' && facet.timeFormat) {
      groupByFragments.push(`strftime('${facet.timeFormat}', ${facet.sourceColumn})`);
    } else {
      groupByFragments.push(`COALESCE(${facet.sourceColumn}, 'Unassigned')`);
    }
  });

  // Handle multi_select in FROM clause
  if (hasMultiSelect) {
    const multiSelectFacet = facets.find(f => f.dataType === 'multi_select');
    if (multiSelectFacet) {
      fromClause = `FROM nodes, json_each(nodes.${multiSelectFacet.sourceColumn})`;
    }
  }

  // Build WHERE clause
  const whereConditions = ['nodes.deleted_at IS NULL'];
  facets.forEach(facet => {
    whereConditions.push(`nodes.${facet.sourceColumn} IS NOT NULL`);
    if (facet.dataType === 'multi_select') {
      whereConditions.push(`nodes.${facet.sourceColumn} != '[]'`);
    }
  });

  // Assemble query
  return `
    SELECT
      ${selectFragments.join(',\n      ')},
      COUNT(*) as card_count
    ${fromClause}
    WHERE ${whereConditions.join(' AND ')}
    GROUP BY ${groupByFragments.join(', ')}
    ORDER BY card_count DESC
  `.trim();
}
