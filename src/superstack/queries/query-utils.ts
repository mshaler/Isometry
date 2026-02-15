/**
 * SuperStack Query Utilities
 *
 * Helper functions for creating common facet configurations and validating
 * query setups before execution.
 */

import type { FacetConfig } from '../types/superstack';
import { COMMON_FACETS } from '../config/superstack-defaults';

/**
 * Time hierarchy level options.
 */
export type TimeFacetLevel = 'year' | 'quarter' | 'month' | 'week' | 'day';

/**
 * Category facet level options.
 */
export type CategoryFacetLevel = 'folder' | 'status' | 'tags' | 'type';

/**
 * Create a chain of time facets for hierarchical grouping.
 *
 * @param sourceColumn - Column to extract time from (default: 'created_at')
 * @param levels - Time hierarchy levels to include
 * @returns Array of FacetConfig for the time chain
 *
 * @example
 * // Year → Month grouping
 * createTimeFacetChain('created_at', ['year', 'month'])
 *
 * @example
 * // Quarter → Month grouping on due_at
 * createTimeFacetChain('due_at', ['quarter', 'month'])
 */
export function createTimeFacetChain(
  sourceColumn: string = 'created_at',
  levels: TimeFacetLevel[] = ['year', 'month']
): FacetConfig[] {
  const timeFormats: Record<TimeFacetLevel, string> = {
    year: '%Y',
    quarter: '%Y-%m', // Post-processed to calculate quarter
    month: '%m',
    week: '%W',
    day: '%d',
  };

  const timeNames: Record<TimeFacetLevel, string> = {
    year: 'Year',
    quarter: 'Quarter',
    month: 'Month',
    week: 'Week',
    day: 'Day',
  };

  return levels.map(level => {
    // Start with COMMON_FACETS if available, otherwise create new config
    const baseFacet = COMMON_FACETS[level];
    if (baseFacet) {
      return {
        ...baseFacet,
        sourceColumn, // Override source column
      };
    }

    // Fallback: create config from scratch
    return {
      id: level,
      name: timeNames[level],
      axis: 'T' as const,
      sourceColumn,
      dataType: 'date' as const,
      timeFormat: timeFormats[level],
      sortOrder: 'asc' as const,
    };
  });
}

/**
 * Create a chain of category facets for hierarchical grouping.
 *
 * @param levels - Category hierarchy levels to include
 * @returns Array of FacetConfig for the category chain
 *
 * @example
 * // Folder → Tags grouping
 * createCategoryFacetChain(['folder', 'tags'])
 *
 * @example
 * // Status → Type grouping
 * createCategoryFacetChain(['status', 'type'])
 */
export function createCategoryFacetChain(
  levels: CategoryFacetLevel[] = ['folder', 'tags']
): FacetConfig[] {
  return levels.map(level => {
    const facet = COMMON_FACETS[level];
    if (!facet) {
      throw new Error(`Unknown category facet: ${level}`);
    }
    return { ...facet };
  });
}

/**
 * Validation error for facet configurations.
 */
export interface ValidationError {
  facetId: string;
  field: string;
  message: string;
}

/**
 * Validate an array of facet configurations.
 *
 * Checks for:
 * - Required fields (id, sourceColumn)
 * - Time facets have timeFormat
 * - No duplicate IDs
 * - Valid axis values
 *
 * @param facets - Array of FacetConfig to validate
 * @returns Array of error messages (empty if valid)
 *
 * @example
 * const errors = validateFacetConfigs([facet1, facet2]);
 * if (errors.length > 0) {
 *   console.error('Invalid config:', errors);
 * }
 */
export function validateFacetConfigs(facets: FacetConfig[]): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const facet of facets) {
    // Check required fields
    if (!facet.id) {
      errors.push('Facet missing required field: id');
    }
    if (!facet.sourceColumn) {
      errors.push(`Facet '${facet.id || 'unknown'}' missing required field: sourceColumn`);
    }

    // Check for duplicate IDs
    if (facet.id && seenIds.has(facet.id)) {
      errors.push(`Duplicate facet ID: ${facet.id}`);
    }
    seenIds.add(facet.id);

    // Time facets must have timeFormat
    if (facet.axis === 'T' && !facet.timeFormat) {
      errors.push(`Time facet '${facet.id}' missing required field: timeFormat`);
    }

    // Validate axis value
    const validAxes = ['L', 'A', 'T', 'C', 'H'];
    if (facet.axis && !validAxes.includes(facet.axis)) {
      errors.push(`Facet '${facet.id}' has invalid axis: ${facet.axis}`);
    }

    // Validate dataType
    const validDataTypes = ['text', 'number', 'date', 'select', 'multi_select'];
    if (facet.dataType && !validDataTypes.includes(facet.dataType)) {
      errors.push(`Facet '${facet.id}' has invalid dataType: ${facet.dataType}`);
    }

    // Validate sortOrder
    const validSortOrders = ['asc', 'desc', 'custom'];
    if (facet.sortOrder && !validSortOrders.includes(facet.sortOrder)) {
      errors.push(`Facet '${facet.id}' has invalid sortOrder: ${facet.sortOrder}`);
    }
  }

  return errors;
}

/**
 * Estimate query complexity score.
 *
 * Scores from 1-10 based on:
 * - Base score from facet count (max 4 points)
 * - +2 per multi_select facet (CROSS JOIN expansion)
 * - +0.5 per time facet (strftime computation)
 *
 * @param rowFacets - Row header facets
 * @param colFacets - Column header facets
 * @returns Complexity score from 1-10
 *
 * @example
 * const complexity = estimateQueryComplexity(rowFacets, colFacets);
 * if (complexity > 7) {
 *   console.warn('High complexity query, consider reducing facets');
 * }
 */
export function estimateQueryComplexity(
  rowFacets: FacetConfig[],
  colFacets: FacetConfig[]
): number {
  const allFacets = [...rowFacets, ...colFacets];

  // Base score: 1 point per facet, max 4
  let score = Math.min(allFacets.length, 4);

  // Multi-select penalty: +2 per multi_select (CROSS JOIN is expensive)
  const multiSelectCount = allFacets.filter(f => f.dataType === 'multi_select').length;
  score += multiSelectCount * 2;

  // Time facet penalty: +0.5 per time facet (strftime computation)
  const timeFacetCount = allFacets.filter(f => f.axis === 'T').length;
  score += timeFacetCount * 0.5;

  // Cap at 10
  return Math.min(Math.round(score * 10) / 10, 10);
}

/**
 * Get the most common facet combinations for quick setup.
 */
export const FACET_PRESETS = {
  /**
   * Folder → Tags on rows, Year → Month on columns.
   * Good for organizing cards by category and time.
   */
  categoryByTime: {
    rowFacets: createCategoryFacetChain(['folder', 'tags']),
    colFacets: createTimeFacetChain('created_at', ['year', 'month']),
  },

  /**
   * Status only on rows, no columns.
   * Simple kanban-style grouping.
   */
  statusKanban: {
    rowFacets: createCategoryFacetChain(['status']),
    colFacets: [],
  },

  /**
   * Folder → Status on rows, Year → Quarter on columns.
   * Project management view.
   */
  projectTimeline: {
    rowFacets: createCategoryFacetChain(['folder', 'status']),
    colFacets: createTimeFacetChain('created_at', ['year', 'quarter']),
  },
} as const;
