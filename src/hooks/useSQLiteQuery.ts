import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // Track previous values for dependency comparison
  const _paramsRef = useRef(params);
  const _sqlRef = useRef(sql);
  _paramsRef.current = params;
  _sqlRef.current = sql;
  
  const fetchData = useCallback(() => {
    if (!enabled || dbLoading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const rows = execute<Record<string, unknown>>(sql, params);
      const result = transform ? transform(rows) : (rows as unknown as T[]);
      setData(result);
    } catch (err) {
      setError(err as Error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [execute, sql, JSON.stringify(params), enabled, dbLoading, transform]);
  
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

// Convenience hook for node queries
export function useNodes(
  whereClause: string = '1=1',
  params: unknown[] = [],
  options: Omit<QueryOptions<Node>, 'transform'> = {}
): QueryState<Node> {
  const sql = `
    SELECT * FROM nodes 
    WHERE ${whereClause} AND deleted_at IS NULL
    ORDER BY modified_at DESC
  `;
  
  return useSQLiteQuery<Node>(sql, params, {
    ...options,
    transform: (rows) => rows.map(rowToNode),
  });
}
