/**
 * PAFV Projection Hooks for SuperGrid Integration
 *
 * These hooks provide sql.js-powered data projections for the SuperGrid
 * using LATCH (Location, Alphabet, Time, Category, Hierarchy) filtering
 * and PAFV (Planes, Axes, Facets, Values) spatial mapping.
 */

import { useCallback, useMemo } from 'react';
import { useSQLiteQuery, QueryState, QueryOptions } from './useSQLiteQuery';

// ============================================================================
// PAFV Projection Types
// ============================================================================

export interface PAFVProjectionParams {
  xAxis: string;
  yAxis: string;
  zAxis?: string;
  filterClause?: string;
  groupByClause?: string;
}

export interface GridCell {
  id: string;
  x: string | number;
  y: string | number;
  z?: string | number;
  nodeCount: number;
  nodeIds: string[];
  nodeNames: string[];
  aggregateData: {
    avgPriority: number;
    statusCounts: Record<string, number>;
    tagCounts: Record<string, number>;
  };
}

export interface AxisValue {
  value: string;
  count: number;
}

export interface Facet {
  id: string;
  name: string;
  axis: string;
  sourceColumn: string;
  facetType: string;
  enabled: boolean;
}

// ============================================================================
// PAFV Projection Hook
// ============================================================================

/**
 * Main SuperGrid data projection hook using PAFV axis mapping
 * Maps LATCH dimensions to spatial planes with sql.js direct queries
 */
export function usePAFVProjection(
  params: PAFVProjectionParams,
  options: Omit<QueryOptions<GridCell>, 'transform'> = {}
): QueryState<GridCell> {
  const { xAxis, yAxis, zAxis, filterClause = '1=1', groupByClause } = params;

  const sql = useMemo(() => {
    const whereClause = `WHERE ${filterClause} AND deleted_at IS NULL`;
    const groupBy = groupByClause
      ? `GROUP BY ${groupByClause}, ${xAxis}, ${yAxis}${zAxis ? ', ' + zAxis : ''}`
      : `GROUP BY ${xAxis}, ${yAxis}${zAxis ? ', ' + zAxis : ''}`;

    return `
      SELECT
        ${xAxis} as x_value,
        ${yAxis} as y_value,
        ${zAxis ? `${zAxis} as z_value,` : ''}
        COUNT(*) as node_count,
        GROUP_CONCAT(id) as node_ids,
        GROUP_CONCAT(name, '|') as node_names,
        AVG(priority) as avg_priority,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_count,
        GROUP_CONCAT(DISTINCT tags) as all_tags
      FROM nodes
      ${whereClause}
      ${groupBy}
      ORDER BY ${yAxis}, ${xAxis}${zAxis ? ', ' + zAxis : ''}
    `;
  }, [xAxis, yAxis, zAxis, filterClause, groupByClause]);

  const transform = useCallback((rows: Record<string, unknown>[]): GridCell[] => {
    return rows.map((row) => {
      const nodeIds = (row.node_ids as string)?.split(',').filter(Boolean) || [];
      const nodeNames = (row.node_names as string)?.split('|').filter(Boolean) || [];
      const allTags = (row.all_tags as string)?.split(',').filter(Boolean) || [];

      // Build tag counts from concatenated tags
      const tagCounts: Record<string, number> = {};
      allTags.forEach(tag => {
        const cleanTag = tag.trim();
        if (cleanTag) {
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        }
      });

      return {
        id: `${row.x_value}-${row.y_value}${zAxis ? '-' + row.z_value : ''}`,
        x: row.x_value as string | number,
        y: row.y_value as string | number,
        z: zAxis ? (row.z_value as string | number) : undefined,
        nodeCount: Number(row.node_count) || 0,
        nodeIds,
        nodeNames,
        aggregateData: {
          avgPriority: Number(row.avg_priority) || 0,
          statusCounts: {
            active: Number(row.active_count) || 0,
            in_progress: Number(row.in_progress_count) || 0,
            completed: Number(row.completed_count) || 0,
            blocked: Number(row.blocked_count) || 0,
          },
          tagCounts
        }
      };
    });
  }, [zAxis]);

  return useSQLiteQuery<GridCell>(sql, [], { ...options, transform });
}

// ============================================================================
// Axis Value Discovery Hooks
// ============================================================================

/**
 * Get distinct values for a column to populate axis dropdowns
 */
export function useAxisValues(
  columnName: string,
  enabled: boolean = true
): QueryState<AxisValue> {
  const sql = useMemo(() => `
    SELECT
      ${columnName} as value,
      COUNT(*) as count
    FROM nodes
    WHERE deleted_at IS NULL
      AND ${columnName} IS NOT NULL
      AND ${columnName} != ''
    GROUP BY ${columnName}
    ORDER BY count DESC, value ASC
    LIMIT 50
  `, [columnName]);

  const transform = useCallback((rows: Record<string, unknown>[]): AxisValue[] => {
    return rows.map(row => ({
      value: String(row.value || ''),
      count: Number(row.count) || 0
    }));
  }, []);

  return useSQLiteQuery(sql, [], { enabled, transform });
}

/**
 * Get facets configuration for PAFV axis mapping
 */
export function useFacets(): QueryState<Facet> {
  const sql = `
    SELECT id, name, axis, source_column, facet_type, enabled
    FROM facets
    WHERE enabled = 1
    ORDER BY sort_order, name
  `;

  const transform = useCallback((rows: Record<string, unknown>[]): Facet[] => {
    return rows.map(row => ({
      id: String(row.id),
      name: String(row.name),
      axis: String(row.axis),
      sourceColumn: String(row.source_column),
      facetType: String(row.facet_type),
      enabled: Boolean(row.enabled)
    }));
  }, []);

  return useSQLiteQuery(sql, [], { transform });
}

// ============================================================================
// FTS5-Enhanced Search for SuperGrid
// ============================================================================

/**
 * Search nodes with LIKE and return grid-compatible results
 * Temporarily using LIKE search instead of FTS5 for basic sql.js compatibility
 */
export function useSearchProjection(
  searchQuery: string,
  pafvParams?: Omit<PAFVProjectionParams, 'filterClause'>,
  enabled: boolean = true
): QueryState<GridCell> {
  const { xAxis = 'folder', yAxis = 'status', zAxis } = pafvParams || {};

  const sql = useMemo(() => {
    const likeQuery = `
      SELECT n.*,
             CASE
               WHEN n.name LIKE ? THEN 1.0
               WHEN n.summary LIKE ? THEN 0.8
               WHEN n.content LIKE ? THEN 0.6
               ELSE 0.4
             END as search_rank
      FROM nodes n
      WHERE (
        n.name LIKE ? OR
        n.summary LIKE ? OR
        n.content LIKE ?
      )
      AND n.deleted_at IS NULL
    `;

    const groupBy = `GROUP BY ${xAxis}, ${yAxis}${zAxis ? ', ' + zAxis : ''}`;

    return `
      WITH search_results AS (${likeQuery})
      SELECT
        ${xAxis} as x_value,
        ${yAxis} as y_value,
        ${zAxis ? `${zAxis} as z_value,` : ''}
        COUNT(*) as node_count,
        GROUP_CONCAT(id) as node_ids,
        GROUP_CONCAT(name, '|') as node_names,
        AVG(priority) as avg_priority,
        AVG(search_rank) as avg_search_rank,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_count,
        GROUP_CONCAT(DISTINCT tags) as all_tags
      FROM search_results
      ${groupBy}
      ORDER BY avg_search_rank DESC, ${yAxis}, ${xAxis}${zAxis ? ', ' + zAxis : ''}
    `;
  }, [xAxis, yAxis, zAxis, searchQuery]);

  const transform = useCallback((rows: Record<string, unknown>[]): GridCell[] => {
    return rows.map((row) => {
      const nodeIds = (row.node_ids as string)?.split(',').filter(Boolean) || [];
      const nodeNames = (row.node_names as string)?.split('|').filter(Boolean) || [];
      const allTags = (row.all_tags as string)?.split(',').filter(Boolean) || [];

      // Build tag counts from concatenated tags
      const tagCounts: Record<string, number> = {};
      allTags.forEach(tag => {
        const cleanTag = tag.trim();
        if (cleanTag) {
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        }
      });

      return {
        id: `search-${row.x_value}-${row.y_value}${zAxis ? '-' + row.z_value : ''}`,
        x: row.x_value as string | number,
        y: row.y_value as string | number,
        z: zAxis ? (row.z_value as string | number) : undefined,
        nodeCount: Number(row.node_count) || 0,
        nodeIds,
        nodeNames,
        aggregateData: {
          avgPriority: Number(row.avg_priority) || 0,
          statusCounts: {
            active: Number(row.active_count) || 0,
            in_progress: Number(row.in_progress_count) || 0,
            completed: Number(row.completed_count) || 0,
            blocked: Number(row.blocked_count) || 0,
          },
          tagCounts
        }
      };
    });
  }, [zAxis]);

  const searchPattern = `%${searchQuery}%`;
  return useSQLiteQuery<GridCell>(sql, [
    searchPattern, searchPattern, searchPattern,  // For CASE ranking
    searchPattern, searchPattern, searchPattern   // For WHERE clause
  ], {
    enabled: enabled && searchQuery.length > 0,
    transform
  });
}

// ============================================================================
// Time-series Projection for Temporal Views
// ============================================================================

/**
 * Time-based projection for timeline and calendar views
 */
export function useTimeProjection(
  timeField: string = 'created_at',
  granularity: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'day',
  categoryField?: string,
  enabled: boolean = true
): QueryState<GridCell> {
  const sql = useMemo(() => {
    const timeFormat = {
      day: `date(${timeField})`,
      week: `date(${timeField}, 'weekday 0', '-6 days')`,
      month: `strftime('%Y-%m', ${timeField})`,
      quarter: `strftime('%Y-Q', ${timeField}) || CASE
        WHEN CAST(strftime('%m', ${timeField}) AS INTEGER) <= 3 THEN '1'
        WHEN CAST(strftime('%m', ${timeField}) AS INTEGER) <= 6 THEN '2'
        WHEN CAST(strftime('%m', ${timeField}) AS INTEGER) <= 9 THEN '3'
        ELSE '4' END`,
      year: `strftime('%Y', ${timeField})`
    };

    const groupByFields = categoryField
      ? `${timeFormat[granularity]}, ${categoryField}`
      : timeFormat[granularity];

    return `
      SELECT
        ${timeFormat[granularity]} as x_value,
        ${categoryField || `'all'`} as y_value,
        COUNT(*) as node_count,
        GROUP_CONCAT(id) as node_ids,
        GROUP_CONCAT(name, '|') as node_names,
        AVG(priority) as avg_priority,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_count,
        GROUP_CONCAT(DISTINCT tags) as all_tags
      FROM nodes
      WHERE deleted_at IS NULL
        AND ${timeField} IS NOT NULL
      GROUP BY ${groupByFields}
      ORDER BY ${timeFormat[granularity]}${categoryField ? `, ${categoryField}` : ''}
    `;
  }, [timeField, granularity, categoryField]);

  const transform = useCallback((rows: Record<string, unknown>[]): GridCell[] => {
    return rows.map((row) => {
      const nodeIds = (row.node_ids as string)?.split(',').filter(Boolean) || [];
      const nodeNames = (row.node_names as string)?.split('|').filter(Boolean) || [];
      const allTags = (row.all_tags as string)?.split(',').filter(Boolean) || [];

      const tagCounts: Record<string, number> = {};
      allTags.forEach(tag => {
        const cleanTag = tag.trim();
        if (cleanTag) {
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        }
      });

      return {
        id: `time-${row.x_value}-${row.y_value}`,
        x: row.x_value as string,
        y: row.y_value as string,
        nodeCount: Number(row.node_count) || 0,
        nodeIds,
        nodeNames,
        aggregateData: {
          avgPriority: Number(row.avg_priority) || 0,
          statusCounts: {
            active: Number(row.active_count) || 0,
            in_progress: Number(row.in_progress_count) || 0,
            completed: Number(row.completed_count) || 0,
            blocked: Number(row.blocked_count) || 0,
          },
          tagCounts
        }
      };
    });
  }, []);

  return useSQLiteQuery<GridCell>(sql, [], { enabled, transform });
}