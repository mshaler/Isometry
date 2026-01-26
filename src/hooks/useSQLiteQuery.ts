import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDatabase } from '../db/DatabaseContext';
import { rowToNode, Node } from '../types/node';
import { translateQuery, TranslationResult, OptimizedCall, SQLCall } from '../db/QueryTranslation';

// Environment variable detection for API mode
const USE_NATIVE_API = process.env.REACT_APP_USE_NATIVE_API === 'true';

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
}

export function useSQLiteQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  options: QueryOptions<T> = {}
): QueryState<T> {
  const { execute, loading: dbLoading, error: dbError } = useDatabase();
  const { enabled = true, transform } = options;

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
    if (!enabled || dbLoading) return;

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
      setData(result);
      setOptimized(wasOptimized);
      setDuration(queryDuration);

      // Log performance in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('Query Performance:', {
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          optimized: wasOptimized,
          duration: `${queryDuration.toFixed(2)}ms`,
          rowCount: rows.length,
        });
      }
    } catch (err) {
      setError(err as Error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [execute, sql, paramsKey, enabled, dbLoading]);

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
  options: Omit<QueryOptions<Node>, 'transform'> = {}
): QueryState<Node> {
  const sql = useMemo(() => `
    SELECT * FROM nodes
    WHERE ${whereClause} AND deleted_at IS NULL
    ORDER BY modified_at DESC
  `, [whereClause]);

  return useSQLiteQuery<Node>(sql, params, {
    ...options,
    transform: nodeTransform,
  });
}
