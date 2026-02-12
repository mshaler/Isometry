import { useMemo } from 'react';
import { useDatabaseService } from '@/hooks';

export interface FacetValue {
  value: string;
  count: number;
  color?: string;
}

export interface FacetValuesResult {
  values: FacetValue[];
  totalCount: number;
  isLoading: boolean;
}

/**
 * useFacetValues - Hook for retrieving facet value counts
 *
 * Queries sql.js for distinct values of a given facet/column
 * and their card counts. Used by Category slider sub-sections.
 *
 * @param facet - The facet to query (e.g., 'folder', 'tags', 'status')
 * @param limit - Maximum values to return (default: 20)
 */
export function useFacetValues(
  facet: string,
  limit: number = 20
): FacetValuesResult {
  const databaseService = useDatabaseService();

  return useMemo(() => {
    const emptyResult: FacetValuesResult = {
      values: [],
      totalCount: 0,
      isLoading: false,
    };

    if (!databaseService?.isReady()) {
      return { ...emptyResult, isLoading: true };
    }

    try {
      // Map facet names to actual column names
      const columnMap: Record<string, { column: string; isJson: boolean }> = {
        folder: { column: 'folder', isJson: false },
        status: { column: 'status', isJson: false },
        tags: { column: 'tags', isJson: true },
        priority: { column: 'priority', isJson: false },
        importance: { column: 'importance', isJson: false },
        source: { column: 'source', isJson: false },
      };

      const facetConfig = columnMap[facet];
      if (!facetConfig) {
        console.warn(`useFacetValues: Unknown facet "${facet}"`);
        return emptyResult;
      }

      const { column, isJson } = facetConfig;

      if (isJson) {
        // For JSON array columns like tags, we need to unnest
        // sql.js doesn't have json_each, so we'll parse in JS
        const allRows = databaseService.query(`
          SELECT ${column}
          FROM nodes
          WHERE ${column} IS NOT NULL
            AND ${column} != ''
            AND ${column} != '[]'
            AND deleted_at IS NULL
        `);

        // Aggregate tag counts in JavaScript
        const tagCounts = new Map<string, number>();
        for (const row of allRows || []) {
          const tagsValue = (row as Record<string, unknown>)[column];
          if (typeof tagsValue === 'string') {
            try {
              const tags = JSON.parse(tagsValue) as string[];
              for (const tag of tags) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
              }
            } catch {
              // Not valid JSON, treat as single value
              tagCounts.set(tagsValue, (tagCounts.get(tagsValue) || 0) + 1);
            }
          }
        }

        // Convert to sorted array
        const values: FacetValue[] = Array.from(tagCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);

        const totalCount = values.reduce((sum, v) => sum + v.count, 0);

        return {
          values,
          totalCount,
          isLoading: false,
        };
      }

      // Standard column query with GROUP BY
      const result = databaseService.query(`
        SELECT
          ${column} as value,
          COUNT(*) as count
        FROM nodes
        WHERE ${column} IS NOT NULL
          AND ${column} != ''
          AND deleted_at IS NULL
        GROUP BY ${column}
        ORDER BY count DESC
        LIMIT ?
      `, [limit]);

      if (!result || result.length === 0) {
        return emptyResult;
      }

      const values: FacetValue[] = result.map((row: Record<string, unknown>) => {
        const value = (row.value as string) || '(empty)';
        const count = row.count as number;
        return {
          value,
          count,
          color: getFacetColor(facet, value),
        };
      });

      const totalCount = values.reduce((sum, v) => sum + v.count, 0);

      return {
        values,
        totalCount,
        isLoading: false,
      };
    } catch (error) {
      console.error('useFacetValues error:', error);
      return emptyResult;
    }
  }, [databaseService, facet, limit]);
}

/**
 * Get semantic color for known facet values
 */
function getFacetColor(facet: string, value: string): string | undefined {
  // Status colors
  if (facet === 'status') {
    const statusColors: Record<string, string> = {
      'todo': '#6B7280',      // gray
      'in_progress': '#3B82F6', // blue
      'done': '#10B981',      // green
      'blocked': '#EF4444',   // red
      'archived': '#9CA3AF',  // light gray
    };
    return statusColors[value.toLowerCase()];
  }

  // Priority colors
  if (facet === 'priority') {
    const priorityColors: Record<string, string> = {
      'critical': '#DC2626',  // red-600
      'high': '#F97316',      // orange-500
      'medium': '#EAB308',    // yellow-500
      'low': '#22C55E',       // green-500
      'none': '#9CA3AF',      // gray-400
    };
    return priorityColors[value.toLowerCase()];
  }

  return undefined;
}
