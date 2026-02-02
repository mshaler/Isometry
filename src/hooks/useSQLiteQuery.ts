import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDatabase } from '../db/DatabaseContext';
import { rowToNode, Node } from '../types/node';
import { translateQuery, OptimizedCall, SQLCall } from '../db/QueryTranslation';
import { useQueryCacheRegistration, CacheTags, type CacheTag } from './useCacheInvalidation';

// Environment variable detection for API mode
const USE_NATIVE_API = import.meta.env.REACT_APP_USE_NATIVE_API === 'true';

export interface QueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  optimized?: boolean; // True if query used optimized endpoint
  duration?: number; // Query execution time in milliseconds
}

interface QueryOptions<T> {
  enabled?: boolean;
  transform?: (rows: Record<string, unknown>[]) => T[];
  cacheTags?: CacheTag[];
  fallbackData?: T[];
}

export function useSQLiteQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  fallbackDataOrOptions?: T[] | QueryOptions<T>
): QueryState<T> {
  // Handle legacy API where third parameter was fallback data
  let options: QueryOptions<T> = {};
  let fallbackData: T[] | null = null;

  if (Array.isArray(fallbackDataOrOptions)) {
    fallbackData = fallbackDataOrOptions;
  } else if (fallbackDataOrOptions) {
    options = fallbackDataOrOptions;
    fallbackData = options.fallbackData || null;
  }
  const { execute, loading: dbLoading, error: dbError } = useDatabase();
  const { enabled = true, transform, cacheTags } = options;

  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [optimized, setOptimized] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);

  // Use refs to store stable references and avoid infinite loops
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Memoize params string to avoid re-renders
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    // If database is loading or not available and we have fallback data, use it
    if (dbLoading && fallbackData) {
      setData(fallbackData);
      setLoading(false);
      setError(null);
      return;
    }

    if (dbLoading) return;

    setLoading(true);
    setError(null);
    setOptimized(false);
    setDuration(0);

    const startTime = performance.now();

    try {
      let rows: Record<string, unknown>[];
      let wasOptimized = false;

      if (USE_NATIVE_API) {
        // Try to optimize the query first
        const translation = translateQuery(sql, params);

        if (translation.type === 'endpoint') {
          // Use optimized endpoint
          const apiCall = translation as OptimizedCall;
          const response = await fetch(`http://localhost:8080${apiCall.url}`, {
            method: apiCall.method,
            headers: apiCall.body ? { 'Content-Type': 'application/json' } : undefined,
            body: apiCall.body ? JSON.stringify(apiCall.body) : undefined,
          });

          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }

          const apiResponse = await response.json();
          rows = apiResponse.success ? apiResponse.data : [];
          wasOptimized = true;
        } else {
          // Fallback to SQL execution
          const sqlCall = translation as SQLCall;
          rows = await (execute as (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>)(
            sqlCall.sql,
            sqlCall.params
          );
        }
      } else {
        // SQL.js mode - direct execution
        rows = (execute as (sql: string, params?: unknown[]) => Record<string, unknown>[])(sql, params);
      }

      const endTime = performance.now();
      const queryDuration = endTime - startTime;

      const result = transformRef.current ? transformRef.current(rows) : (rows as unknown as T[]);

      // Use fallback data if query returns empty results and fallback is available
      if (result.length === 0 && fallbackData && fallbackData.length > 0) {
        setData(fallbackData);
      } else {
        setData(result);
      }
      setOptimized(wasOptimized);
      setDuration(queryDuration);

      // Log performance in development mode
      if (import.meta.env.DEV) {
        console.log('Query Performance:', {
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          optimized: wasOptimized,
          duration: `${queryDuration.toFixed(2)}ms`,
          rowCount: rows.length,
        });
      }
    } catch (err) {
      setError(err as Error);
      // Use fallback data if available when query fails
      if (fallbackData && fallbackData.length > 0) {
        setData(fallbackData);
        setError(null); // Clear error since we have fallback data
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [execute, sql, paramsKey, enabled, dbLoading, fallbackData]);

  // Register for cache invalidation (empty array if no cacheTags provided)
  const finalCacheTags = useMemo(() => cacheTags || [], [cacheTags]);
  useQueryCacheRegistration(finalCacheTags, fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading: loading || dbLoading,
    error: error || dbError,
    refetch: fetchData,
    optimized,
    duration,
  };
}

// Transform function defined outside to be stable
const nodeTransform = (rows: Record<string, unknown>[]) => rows.map(rowToNode);

// Convenience hook for node queries
export function useNodes(
  whereClause: string = '1=1',
  params: unknown[] = [],
  options: Omit<QueryOptions<Node>, 'transform'> = {},
  fallbackNodes?: Node[]
): QueryState<Node> {
  const sql = useMemo(() => `
    SELECT * FROM nodes
    WHERE ${whereClause} AND deleted_at IS NULL
    ORDER BY modified_at DESC
  `, [whereClause]);

  // Add default cache tags for nodes if not provided
  const cacheTags = useMemo(() =>
    options.cacheTags || CacheTags.allNodes(),
    [options.cacheTags]
  );

  // Use options approach to include transform, cacheTags, and fallbackData
  const queryOptions: QueryOptions<Node> = {
    ...options,
    transform: nodeTransform,
    cacheTags,
    fallbackData: fallbackNodes,
  };

  return useSQLiteQuery<Node>(sql, params, queryOptions);
}
