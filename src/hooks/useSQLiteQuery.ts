import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSQLite } from '../db/SQLiteProvider';
import { rowToNode, Node } from '../types/node';
import { devLogger } from '../utils/dev-logger';

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

  // Use sql.js SQLiteProvider directly - bridge eliminated!
  const { execute, loading: dbLoading, error: dbError } = useSQLite();
  const { enabled = true, transform } = options;

  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [duration, setDuration] = useState<number>(0);

  // Memoize params string to avoid re-renders
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  const fetchData = useCallback(() => {
    if (!enabled) return;

    // If database is loading and we have fallback data, use it
    if (dbLoading && fallbackData) {
      setData(fallbackData);
      setLoading(false);
      setError(null);
      return;
    }

    if (dbLoading) return;

    setLoading(true);
    setError(null);
    setDuration(0);

    const startTime = performance.now();

    try {
      // Direct synchronous sql.js execution - no bridge, no promises!
      const rows = execute(sql, params);
      const endTime = performance.now();
      const queryDuration = endTime - startTime;

      const result = transform ? transform(rows) : (rows as unknown as T[]);

      // Use fallback data if query returns empty results and fallback is available
      if (result.length === 0 && fallbackData && fallbackData.length > 0) {
        setData(fallbackData);
      } else {
        setData(result);
      }

      setDuration(queryDuration);

      // Log performance in development mode
      if (import.meta.env.DEV) {
        devLogger.data('sql.js Query', {
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          params: params.length > 0 ? params : undefined,
          duration: `${queryDuration.toFixed(2)}ms`,
          rowCount: rows.length,
          synchronous: true,
        });
      }

    } catch (err) {
      console.error('💥 sql.js Query Error:', { sql, params, error: err });
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
  }, [execute, sql, paramsKey, enabled, dbLoading, fallbackData, transform]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading: loading || dbLoading,
    error: error || dbError,
    refetch: fetchData,
    duration,
  };
}

// Transform function defined outside to be stable
const nodeTransform = (rows: Record<string, unknown>[]) => rows.map(rowToNode);

// Convenience hook for node queries with LATCH filtering
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

  // Use options approach to include transform and fallbackData
  const queryOptions: QueryOptions<Node> = {
    ...options,
    transform: nodeTransform,
    fallbackData: fallbackNodes,
  };

  return useSQLiteQuery<Node>(sql, params, queryOptions);
}

// Convenience hook for GRAPH queries using recursive CTEs
export function useGraphTraversal(
  startNodeId: string,
  maxDepth: number = 3,
  edgeTypes: string[] = ['LINK', 'NEST', 'SEQUENCE', 'AFFINITY']
): QueryState<Node> {
  const sql = useMemo(() => `
    WITH RECURSIVE graph_traversal(id, depth, path) AS (
      -- Start with the root node
      SELECT ?, 0, ?
      UNION ALL
      -- Traverse edges recursively
      SELECT e.target_id, gt.depth + 1, gt.path || ' -> ' || e.target_id
      FROM graph_traversal gt
      JOIN edges e ON e.source_id = gt.id
      WHERE gt.depth < ?
        AND e.edge_type IN (${edgeTypes.map(() => '?').join(', ')})
    )
    SELECT DISTINCT n.*
    FROM graph_traversal gt
    JOIN nodes n ON n.id = gt.id
    WHERE n.deleted_at IS NULL
    ORDER BY gt.depth, n.name
  `, [maxDepth, ...edgeTypes]);

  return useSQLiteQuery<Node>(
    sql,
    [startNodeId, startNodeId, maxDepth, ...edgeTypes],
    { transform: nodeTransform }
  );
}

// Convenience hook for full-text search (will work when FTS5 is available)
export function useSearchNodes(
  searchQuery: string,
  enabled: boolean = true
): QueryState<Node> {
  const sql = useMemo(() => `
    SELECT n.* FROM nodes n
    WHERE (
      n.name LIKE ? OR
      n.content LIKE ? OR
      n.summary LIKE ?
    )
    AND n.deleted_at IS NULL
    ORDER BY
      CASE
        WHEN n.name LIKE ? THEN 1
        WHEN n.summary LIKE ? THEN 2
        ELSE 3
      END,
      n.modified_at DESC
    LIMIT 100
  `, [searchQuery]);

  const searchPattern = `%${searchQuery}%`;
  return useSQLiteQuery<Node>(
    sql,
    [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern],
    {
      enabled: enabled && searchQuery.length > 0,
      transform: nodeTransform
    }
  );
}
