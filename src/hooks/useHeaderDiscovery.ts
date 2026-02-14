/**
 * useHeaderDiscovery - React hook for SQL-driven header discovery
 *
 * Manages loading state and error handling for header discovery queries.
 * Implements:
 * - SQL-04: Loading state during discovery
 * - SQL-05: Empty datasets handled gracefully (empty tree, not null)
 *
 * Phase 90-02: Tree Builder from Query Results
 */

import { useState, useEffect, useCallback } from 'react';
import type { Database } from 'sql.js';
import type { FacetConfig, HeaderTree } from '../superstack/types/superstack';
import { headerDiscoveryService } from '../services/supergrid/HeaderDiscoveryService';

/**
 * Result type for useHeaderDiscovery hook.
 */
export interface UseHeaderDiscoveryResult {
  /** Column header tree (Y-axis in PAFV) */
  columnTree: HeaderTree | null;
  /** Row header tree (X-axis in PAFV) */
  rowTree: HeaderTree | null;
  /** True during header discovery query execution */
  isLoading: boolean;
  /** Error if query execution failed */
  error: Error | null;
  /** Manually trigger re-discovery */
  refresh: () => void;
}

/**
 * React hook for header discovery with loading state management.
 * Implements SQL-04 (loading state) and SQL-05 (empty datasets).
 *
 * @param db - sql.js Database instance (from useSQLite)
 * @param columnFacets - Facet configurations for column headers (Y-axis)
 * @param rowFacets - Facet configurations for row headers (X-axis)
 * @returns Header trees with loading/error state
 *
 * @example
 * ```tsx
 * const { db } = useSQLite();
 * const { columnTree, rowTree, isLoading, error } = useHeaderDiscovery(
 *   db,
 *   [{ id: 'folder', name: 'Folder', axis: 'C', sourceColumn: 'folder', dataType: 'select', sortOrder: 'asc' }],
 *   [{ id: 'status', name: 'Status', axis: 'C', sourceColumn: 'status', dataType: 'select', sortOrder: 'asc' }]
 * );
 * ```
 */
export function useHeaderDiscovery(
  db: Database | null,
  columnFacets: FacetConfig[],
  rowFacets: FacetConfig[]
): UseHeaderDiscoveryResult {
  const [columnTree, setColumnTree] = useState<HeaderTree | null>(null);
  const [rowTree, setRowTree] = useState<HeaderTree | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const discoverHeaders = useCallback(() => {
    if (!db) {
      setColumnTree(null);
      setRowTree(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Note: sql.js queries are synchronous, but we wrap in try-catch
    // and use state to provide loading feedback for UI
    try {
      headerDiscoveryService.setDatabase(db);

      // Discover column headers (Y-Plane in PAFV)
      const cols =
        columnFacets.length > 0
          ? headerDiscoveryService.discoverHeaders(columnFacets, 'column')
          : null;

      // Discover row headers (X-Plane in PAFV)
      const rows =
        rowFacets.length > 0
          ? headerDiscoveryService.discoverHeaders(rowFacets, 'row')
          : null;

      setColumnTree(cols);
      setRowTree(rows);
    } catch (err) {
      setError(err as Error);
      setColumnTree(null);
      setRowTree(null);
    } finally {
      setIsLoading(false);
    }
  }, [db, columnFacets, rowFacets]);

  // Discover headers when dependencies change
  useEffect(() => {
    discoverHeaders();
  }, [discoverHeaders]);

  return {
    columnTree,
    rowTree,
    isLoading,
    error,
    refresh: discoverHeaders,
  };
}
