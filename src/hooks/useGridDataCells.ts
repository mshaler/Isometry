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
 * Compute path values from a node record based on facets
 *
 * Extracts values from the node for each facet in order, forming a path array.
 * Handles null/undefined values and multi_select JSON arrays.
 *
 * @param node - Node record from SQLite query
 * @param facets - Ordered facets defining the path hierarchy
 * @returns Array of string values forming the path
 */
export function computeNodePath(
  node: Record<string, unknown>,
  facets: FacetConfig[]
): string[] {
  return facets.map(facet => {
    const rawValue = node[facet.sourceColumn];

    // Handle null/undefined
    if (rawValue === null || rawValue === undefined) {
      return '(empty)';
    }

    // Handle multi_select dataType - extract first value from JSON array
    if (facet.dataType === 'multi_select' && typeof rawValue === 'string') {
      try {
        const parsed = JSON.parse(rawValue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return String(parsed[0]);
        }
      } catch {
        // Fall through to string conversion
      }
    }

    // Convert to string
    return String(rawValue);
  });
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

      const sql = `
        SELECT ${selectColumns.join(', ')}
        FROM nodes n
        WHERE ${whereParts.join(' AND ')}
      `.trim();

      // Execute query
      const rows = execute(sql, queryParams);

      // Transform rows to DataCell[]
      return rows.map(row => {
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
    } catch (error) {
      console.error('[useGridDataCells] Query failed:', error);
      return [];
    }
  }, [db, execute, rowFacets, colFacets, whereClause, parameters, nodeType]);
}
