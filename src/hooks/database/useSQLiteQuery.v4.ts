import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSQLite } from '../db/SQLiteProvider';
import { rowToNode, Node } from '../types/node';
import { devLogger } from '../utils/logging/dev-logger';

/**
 * useSQLiteQuery v4 - Bridge Elimination Edition
 *
 * Direct sql.js access according to CLAUDE.md architecture:
 * - Synchronous database queries (no promises, no callbacks)
 * - Direct D3.js data binding capability
 * - Zero serialization overhead
 * - Single memory space execution
 */

export interface QueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  duration?: number; // Query execution time in milliseconds
}

interface QueryOptions<T> {
  enabled?: boolean;
  transform?: (rows: Record<string, unknown>[]) => T[];
  fallbackData?: T[];
  enableLogging?: boolean;
}

export function useSQLiteQueryV4<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  options: QueryOptions<T> = {}
): QueryState<T> {
  const { execute, loading: dbLoading, error: dbError } = useSQLite();
  const {
    enabled = true,
    transform,
    fallbackData,
    enableLogging = import.meta.env.DEV
  } = options;

  const [data, setData] = useState<T[] | null>(fallbackData || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [duration, setDuration] = useState<number>(0);

  // Memoize params to avoid re-renders on array reference changes
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  const executeQuery = useCallback(() => {
    if (!enabled || dbLoading || dbError) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startTime = performance.now();

      // Direct sql.js execution - synchronous, same memory space
      const rows = execute(sql, params);

      const endTime = performance.now();
      const queryDuration = endTime - startTime;

      // Apply transform if provided, otherwise cast to T[]
      const result = transform ? transform(rows) : (rows as unknown as T[]);

      setData(result);
      setDuration(queryDuration);

      if (enableLogging) {
        devLogger.data('SQL Query (v4)', {
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          params,
          resultCount: result.length,
          duration: `${queryDuration.toFixed(2)}ms`,
          directAccess: true
        });
      }

    } catch (err) {
      console.error('💥 SQL Query Error (v4):', { sql, params, error: err });
      setError(err as Error);

      // Use fallback data if available
      if (fallbackData) {
        setData(fallbackData);
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [execute, sql, paramsKey, enabled, dbLoading, dbError, transform, fallbackData, enableLogging]);

  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  const refetch = useCallback(() => {
    executeQuery();
  }, [executeQuery]);

  return {
    data,
    loading: loading || dbLoading,
    error: error || dbError,
    refetch,
    duration,
  };
}

// Transform function for node queries (stable reference)
const nodeTransform = (rows: Record<string, unknown>[]) => rows.map(rowToNode);

/**
 * Convenience hook for node queries with automatic transform
 * Replaces the old useNodes hook with sql.js direct access
 */
export function useNodesV4(
  whereClause: string = '1=1',
  params: unknown[] = [],
  options: Omit<QueryOptions<Node>, 'transform'> = {}
): QueryState<Node> {
  const sql = useMemo(() => `
    SELECT * FROM nodes
    WHERE ${whereClause} AND deleted_at IS NULL
    ORDER BY modified_at DESC
  `, [whereClause]);

  return useSQLiteQueryV4<Node>(sql, params, {
    ...options,
    transform: nodeTransform,
  });
}

/**
 * Hook for FTS5 full-text search queries
 */
export function useFTS5SearchV4(
  searchQuery: string,
  options: Omit<QueryOptions<Node>, 'transform'> = {}
): QueryState<Node> {
  const sql = useMemo(() => `
    SELECT n.*
    FROM nodes_fts
    JOIN nodes n ON nodes_fts.rowid = n.rowid
    WHERE nodes_fts MATCH ? AND n.deleted_at IS NULL
    ORDER BY rank
  `, []);

  const params = useMemo(() => [searchQuery], [searchQuery]);

  return useSQLiteQueryV4<Node>(sql, params, {
    ...options,
    transform: nodeTransform,
    enabled: searchQuery.length > 2, // Only search with 3+ characters
  });
}

/**
 * Hook for recursive graph traversal using CTEs
 */
export function useGraphTraversalV4(
  startNodeId: string,
  edgeTypes: string[] = ['LINK', 'NEST', 'SEQUENCE', 'AFFINITY'],
  maxDepth: number = 3,
  options: Omit<QueryOptions<Node>, 'transform'> = {}
): QueryState<Node> {
  const sql = useMemo(() => `
    WITH RECURSIVE reachable(id, depth) AS (
      SELECT ?, 0
      UNION ALL
      SELECT e.target_id, r.depth + 1
      FROM reachable r
      JOIN edges e ON e.source_id = r.id
      WHERE r.depth < ? AND e.edge_type IN (${edgeTypes.map(() => '?').join(', ')})
    )
    SELECT DISTINCT n.*
    FROM reachable r
    JOIN nodes n ON n.id = r.id
    WHERE n.deleted_at IS NULL
    ORDER BY r.depth, n.modified_at DESC
  `, [edgeTypes.join(',')]);

  const params = useMemo(() => [startNodeId, maxDepth, ...edgeTypes], [startNodeId, maxDepth, edgeTypes]);

  return useSQLiteQueryV4<Node>(sql, params, {
    ...options,
    transform: nodeTransform,
    enabled: !!startNodeId,
  });
}

/**
 * Hook for PAFV-filtered queries (LATCH filtering)
 */
export function usePAFVFilteredNodesV4(
  latchFilters: Record<string, unknown>,
  options: Omit<QueryOptions<Node>, 'transform'> = {}
): QueryState<Node> {
  const { whereClause, params } = useMemo(() => {
    const conditions: string[] = ['deleted_at IS NULL'];
    const queryParams: unknown[] = [];

    // Location filters
    if (latchFilters.location) {
      conditions.push('location_name = ?');
      queryParams.push(latchFilters.location);
    }

    // Alphabet filters (name/content search)
    if (latchFilters.search) {
      conditions.push('(name LIKE ? OR content LIKE ?)');
      const searchPattern = `%${latchFilters.search}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    // Time filters
    if (latchFilters.createdAfter) {
      conditions.push('created_at >= ?');
      queryParams.push(latchFilters.createdAfter);
    }

    if (latchFilters.createdBefore) {
      conditions.push('created_at <= ?');
      queryParams.push(latchFilters.createdBefore);
    }

    // Category filters
    if (latchFilters.folder) {
      conditions.push('folder = ?');
      queryParams.push(latchFilters.folder);
    }

    if (latchFilters.status) {
      conditions.push('status = ?');
      queryParams.push(latchFilters.status);
    }

    // Hierarchy filters
    if (latchFilters.minPriority !== undefined) {
      conditions.push('priority >= ?');
      queryParams.push(latchFilters.minPriority);
    }

    return {
      whereClause: conditions.join(' AND '),
      params: queryParams
    };
  }, [latchFilters]);

  return useNodesV4(whereClause, params, options);
}