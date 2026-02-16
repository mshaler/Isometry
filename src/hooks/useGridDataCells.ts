/**
 * useGridDataCells Hook
 *
 * Queries SQLite for nodes and transforms them into DataCell[] format for SuperGridCSS.
 * This hook bridges the SQLite query results to the SuperGridCSS data format.
 *
 * Phase 106-02: Data cell query hook for grid population
 */

import { useMemo } from 'react';
import { useSQLite } from '@/db/SQLiteProvider';
import type { DataCell } from '@/components/supergrid/types';
import type { FacetConfig } from '@/superstack/types/superstack';
import { superGridLogger } from '@/utils/dev-logger';

/**
 * Options for useGridDataCells hook
 */
export interface UseGridDataCellsOptions {
  /** Row facets for computing rowPath */
  rowFacets: FacetConfig[];

  /** Column facets for computing colPath */
  colFacets: FacetConfig[];

  /** Optional WHERE clause to filter nodes */
  whereClause?: string;

  /** Parameters for the WHERE clause */
  parameters?: (string | number)[];

  /** Optional node_type filter */
  nodeType?: string;
}

/**
 * Format a date value to match header tree strftime format.
 * Mirrors the SQL strftime() function used in header discovery.
 *
 * @param value - Date string (ISO format or similar)
 * @param timeFormat - strftime format (e.g., '%Y', '%B', '%Q')
 * @returns Formatted date string matching header tree
 */
function formatDateValue(value: string, timeFormat: string): string {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '(invalid)';

    switch (timeFormat) {
      case '%Y': // Year
        return String(date.getFullYear());
      case '%m': // Month number (01-12)
        return String(date.getMonth() + 1).padStart(2, '0');
      case '%B': // Month name
        return date.toLocaleString('en-US', { month: 'long' });
      case '%Q': // Quarter
        return `Q${Math.floor(date.getMonth() / 3) + 1}`;
      case '%W': {
        // ISO week number calculation
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return String(Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)).padStart(2, '0');
      }
      default:
        return String(date.getFullYear()); // Fallback to year
    }
  } catch {
    return '(invalid)';
  }
}

/**
 * Compute path values from a node record based on facets
 *
 * Extracts values from the node for each facet in order, forming a path array.
 * Handles:
 * - null/undefined values → '(empty)'
 * - multi_select JSON arrays → first value
 * - date facets with timeFormat → formatted to match header tree
 * - path-separated values → split into multiple path segments
 *
 * @param node - Node record from SQLite query
 * @param facets - Ordered facets defining the path hierarchy
 * @returns Array of string values forming the path
 */
export function computeNodePath(
  node: Record<string, unknown>,
  facets: FacetConfig[]
): string[] {
  const result: string[] = [];

  for (const facet of facets) {
    const rawValue = node[facet.sourceColumn];

    // Handle null/undefined
    if (rawValue === null || rawValue === undefined) {
      result.push('(empty)');
      continue;
    }

    // Handle date facets with timeFormat
    if (facet.dataType === 'date' && facet.timeFormat && typeof rawValue === 'string') {
      result.push(formatDateValue(rawValue, facet.timeFormat));
      continue;
    }

    // Handle multi_select dataType - extract first value from JSON array
    if (facet.dataType === 'multi_select' && typeof rawValue === 'string') {
      try {
        const parsed = JSON.parse(rawValue);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0) {
            result.push(String(parsed[0]));
          } else {
            // Empty array - treat as "(empty)" to match header exclusion
            result.push('(empty)');
          }
          continue;
        }
      } catch {
        // Fall through to string conversion
      }
    }

    // Handle path-separated values (e.g., folder with pathSeparator: '/')
    if (facet.pathSeparator && typeof rawValue === 'string') {
      const segments = rawValue.split(facet.pathSeparator).filter(s => s.length > 0);
      if (segments.length > 0) {
        result.push(...segments);
        continue;
      }
    }

    // Default: convert to string
    result.push(String(rawValue));
  }

  return result;
}

/**
 * Hook to query nodes and transform to DataCell[] for SuperGridCSS
 *
 * Queries SQLite for nodes matching the provided filters, then transforms
 * each node into a DataCell with rowPath/colPath computed from facets.
 *
 * @param options - Configuration for data query and path computation
 * @returns Array of DataCell objects ready for SuperGridCSS rendering
 */
export function useGridDataCells(options: UseGridDataCellsOptions): DataCell[] {
  const { rowFacets, colFacets, whereClause, parameters = [], nodeType } = options;
  const { db, execute } = useSQLite();

  return useMemo(() => {
    // Early return if database not ready
    if (!db || typeof execute !== 'function') {
      return [];
    }

    // Early return if no facets provided
    if (rowFacets.length === 0 || colFacets.length === 0) {
      return [];
    }

    try {
      // Build SQL query
      const selectColumns = [
        'n.id',
        'n.name',
        'n.folder',
        'n.tags',
        'n.status',
        'n.priority',
        'n.created_at',
        'n.modified_at',
        'n.node_type'
      ];

      // Build WHERE clause
      const whereParts = ['n.deleted_at IS NULL'];
      const queryParams: (string | number)[] = [];

      if (whereClause) {
        whereParts.push(whereClause);
        queryParams.push(...parameters);
      }

      if (nodeType) {
        whereParts.push('n.node_type = ?');
        queryParams.push(nodeType);
      }

      // MEMORY GUARD: Limit rows to prevent OOM on large datasets
      // 10,000 rows × ~500 bytes/row = ~5MB memory footprint
      const ROW_LIMIT = 10000;

      const sql = `
        SELECT ${selectColumns.join(', ')}
        FROM nodes n
        WHERE ${whereParts.join(' AND ')}
        LIMIT ${ROW_LIMIT}
      `.trim();

      // Execute query
      const rows = execute(sql, queryParams);

      // Warn if limit was hit
      if (rows.length === ROW_LIMIT) {
        console.warn(`[useGridDataCells] Row limit hit (${ROW_LIMIT}). Some data may not be displayed.`);
      }

      superGridLogger.debug('[useGridDataCells] Query result:', {
        rowCount: rows.length,
        rowFacets: rowFacets.map(f => ({
          id: f.id, sourceColumn: f.sourceColumn, dataType: f.dataType,
          pathSeparator: f.pathSeparator, timeFormat: f.timeFormat
        })),
        colFacets: colFacets.map(f => ({
          id: f.id, sourceColumn: f.sourceColumn, dataType: f.dataType,
          pathSeparator: f.pathSeparator, timeFormat: f.timeFormat
        })),
        sampleRow: rows[0],
      });

      // Transform rows to DataCell[]
      const cells = rows.map(row => {
        const node: Record<string, unknown> = {
          id: row.id,
          name: row.name,
          folder: row.folder,
          tags: row.tags,
          status: row.status,
          priority: row.priority,
          created_at: row.created_at,
          modified_at: row.modified_at,
          node_type: row.node_type
        };

        const rowPath = computeNodePath(node, rowFacets);
        const colPath = computeNodePath(node, colFacets);

        return {
          rowPath,
          colPath,
          value: node.name as string,
          rawValue: node
        };
      });

      // Debug: log sample paths with raw values for diagnosis
      if (cells.length > 0) {
        const uniqueRowPaths = new Set(cells.map(c => c.rowPath.join('/')));
        const uniqueColPaths = new Set(cells.map(c => c.colPath.join('/')));
        superGridLogger.debug('[useGridDataCells] Path analysis:', {
          totalCells: cells.length,
          uniqueRowPaths: uniqueRowPaths.size,
          uniqueColPaths: uniqueColPaths.size,
          sampleRowPaths: Array.from(uniqueRowPaths).slice(0, 5),
          sampleColPaths: Array.from(uniqueColPaths).slice(0, 5),
          samples: cells.slice(0, 3).map(c => ({
            rowPath: c.rowPath,
            colPath: c.colPath,
            key: `${c.rowPath.join('/')}::${c.colPath.join('/')}`,
            rawTags: (c.rawValue as Record<string, unknown>)?.tags,
            rawFolder: (c.rawValue as Record<string, unknown>)?.folder,
          })),
        });
      }

      return cells;
    } catch (error) {
      console.error('[useGridDataCells] Query failed:', error);
      return [];
    }
  }, [db, execute, rowFacets, colFacets, whereClause, parameters, nodeType]);
}
