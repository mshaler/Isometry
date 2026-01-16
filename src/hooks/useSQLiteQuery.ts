import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDatabase } from '../db/DatabaseContext';
import { rowToNode, Node } from '../types/node';

interface QueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
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

  // Use refs to store stable references and avoid infinite loops
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Memoize params string to avoid re-renders
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  const fetchData = useCallback(() => {
    if (!enabled || dbLoading) return;

    setLoading(true);
    setError(null);

    try {
      const rows = execute<Record<string, unknown>>(sql, params);
      const result = transformRef.current ? transformRef.current(rows) : (rows as unknown as T[]);
      setData(result);
    } catch (err) {
      setError(err as Error);
      setData(null);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute, sql, paramsKey, enabled, dbLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading: loading || dbLoading,
    error: error || dbError,
    refetch: fetchData,
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
