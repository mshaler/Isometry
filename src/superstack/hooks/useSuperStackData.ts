/**
 * SuperStack Data Hook
 *
 * React hook for fetching and building SuperStack header data from sql.js.
 * Manages query execution, tree building, loading states, and performance tracking.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDatabaseService } from '../../hooks/database/useDatabaseService';
import {
  buildHeaderDiscoveryQuery,
  type QueryFilter,
  type QueryOptions,
} from '../queries/header-discovery';
import { buildHeaderTree } from '../builders/header-tree-builder';
import type { FacetConfig, HeaderTree, QueryRow } from '../types/superstack';

/**
 * Configuration for useSuperStackData hook.
 */
export interface SuperStackDataConfig {
  /** Facets for row headers (left axis) */
  rowFacets: FacetConfig[];
  /** Facets for column headers (top axis) */
  colFacets: FacetConfig[];
  /** Optional filters to apply */
  filters?: QueryFilter[];
  /** Query options (includeDeleted, limit, cardTypes) */
  options?: QueryOptions;
  /** Enable/disable data fetching (default: true) */
  enabled?: boolean;
  /** Auto-refetch interval in ms (0 = disabled, default: 0) */
  refetchInterval?: number;
}

/**
 * Result returned by useSuperStackData hook.
 */
export interface SuperStackDataResult {
  /** Row header tree (null if not yet loaded) */
  rowTree: HeaderTree | null;
  /** Column header tree (null if not yet loaded) */
  colTree: HeaderTree | null;
  /** Raw query rows (for debugging/advanced use) */
  rows: QueryRow[];
  /** Whether data is currently being fetched */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Function to manually trigger refetch */
  refetch: () => Promise<void>;
  /** Timestamp of last successful fetch */
  lastFetched: Date | null;
  /** Query execution time in ms (null if not yet executed) */
  queryTime: number | null;
}

/**
 * Create empty HeaderTree for initial/empty states.
 */
function createEmptyTree(
  facets: FacetConfig[],
  axis: 'row' | 'column'
): HeaderTree {
  return {
    axis,
    facets,
    roots: [],
    maxDepth: facets.length,
    leafCount: 0,
    leaves: [],
  };
}

/**
 * Hook for fetching SuperStack header data from sql.js.
 *
 * Builds SQL query from facet configurations, executes via useDatabaseService,
 * and transforms results into HeaderTree structures.
 *
 * @param config - Configuration for data fetching
 * @returns SuperStackDataResult with trees, loading state, and metrics
 *
 * @example
 * const { rowTree, colTree, isLoading, queryTime } = useSuperStackData({
 *   rowFacets: [COMMON_FACETS.folder, COMMON_FACETS.tags],
 *   colFacets: [COMMON_FACETS.year, COMMON_FACETS.month],
 * });
 */
export function useSuperStackData(
  config: SuperStackDataConfig
): SuperStackDataResult {
  const db = useDatabaseService();

  // State
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [queryTime, setQueryTime] = useState<number | null>(null);

  // Defaults
  const enabled = config.enabled ?? true;
  const refetchInterval = config.refetchInterval ?? 0;

  // Memoize query to prevent rebuilding on every render
  // This is CRITICAL to prevent infinite re-render loops
  const query = useMemo(() => {
    return buildHeaderDiscoveryQuery(
      config.rowFacets,
      config.colFacets,
      config.filters ?? [],
      config.options ?? {}
    );
  }, [
    // Use JSON serialization for stable dependency comparison
    JSON.stringify(config.rowFacets),
    JSON.stringify(config.colFacets),
    JSON.stringify(config.filters),
    JSON.stringify(config.options),
  ]);

  // Fetch function with performance tracking
  const fetchData = useCallback(async () => {
    // CRITICAL: Check db.isReady() before executing
    if (!db.isReady()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const startTime = performance.now();

    try {
      // Execute query
      const result = db.query(query.sql, query.params);
      const duration = performance.now() - startTime;

      // Convert to QueryRow[]
      const queryRows = (result || []) as QueryRow[];

      setRows(queryRows);
      setQueryTime(duration);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [query.sql, query.params, db]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (enabled && db.isReady()) {
      fetchData();
    }
  }, [enabled, fetchData, db.isReady()]);

  // Optional refetch interval
  useEffect(() => {
    if (!enabled || refetchInterval <= 0) {
      return;
    }

    const interval = setInterval(() => {
      if (db.isReady()) {
        fetchData();
      }
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [enabled, refetchInterval, fetchData, db.isReady()]);

  // Build row tree from rows (memoized)
  const rowTree = useMemo((): HeaderTree | null => {
    if (rows.length === 0 && config.rowFacets.length > 0) {
      // Return empty tree, not null
      return createEmptyTree(config.rowFacets, 'row');
    }
    if (config.rowFacets.length === 0) {
      return createEmptyTree([], 'row');
    }
    return buildHeaderTree(rows, config.rowFacets, 'row');
  }, [rows, JSON.stringify(config.rowFacets)]);

  // Build column tree from rows (memoized)
  const colTree = useMemo((): HeaderTree | null => {
    if (rows.length === 0 && config.colFacets.length > 0) {
      // Return empty tree, not null
      return createEmptyTree(config.colFacets, 'column');
    }
    if (config.colFacets.length === 0) {
      return createEmptyTree([], 'column');
    }
    return buildHeaderTree(rows, config.colFacets, 'column');
  }, [rows, JSON.stringify(config.colFacets)]);

  return {
    rowTree,
    colTree,
    rows,
    isLoading,
    error,
    refetch: fetchData,
    lastFetched,
    queryTime,
  };
}

/**
 * Lightweight hook for fetching only row headers.
 *
 * @param rowFacets - Facets for row headers
 * @param filters - Optional filters
 * @param options - Query options
 * @returns Partial result with rowTree and loading state
 */
export function useRowHeaders(
  rowFacets: FacetConfig[],
  filters?: QueryFilter[],
  options?: QueryOptions
): Pick<SuperStackDataResult, 'rowTree' | 'isLoading' | 'error' | 'refetch'> {
  const result = useSuperStackData({
    rowFacets,
    colFacets: [],
    filters,
    options,
  });

  return {
    rowTree: result.rowTree,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Lightweight hook for fetching only column headers.
 *
 * @param colFacets - Facets for column headers
 * @param filters - Optional filters
 * @param options - Query options
 * @returns Partial result with colTree and loading state
 */
export function useColHeaders(
  colFacets: FacetConfig[],
  filters?: QueryFilter[],
  options?: QueryOptions
): Pick<SuperStackDataResult, 'colTree' | 'isLoading' | 'error' | 'refetch'> {
  const result = useSuperStackData({
    rowFacets: [],
    colFacets,
    filters,
    options,
  });

  return {
    colTree: result.colTree,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}
