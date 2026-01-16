import { useState, useEffect, useMemo } from 'react';
import { getDatabase } from '@/db/init';

interface QueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for executing SQLite queries with automatic re-execution on param changes
 * @param sql SQL query string with ? placeholders
 * @param params Parameter values to bind
 * @returns Query state with data, loading, and error
 */
export function useSQLiteQuery<T>(
  sql: string,
  params: any[] = []
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  // Memoize params to prevent unnecessary re-renders
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  useEffect(() => {
    let cancelled = false;

    async function executeQuery() {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const db = getDatabase();

        if (!db) {
          throw new Error('Database not initialized');
        }

        // Execute query with parameters
        // sql.js exec returns array of result objects with columns and values
        const results = db.exec(sql, params);

        if (cancelled) return;

        // Transform results to array of objects
        if (results.length === 0) {
          setState({ data: [] as T[], loading: false, error: null });
          return;
        }

        const { columns, values } = results[0];
        const data = values.map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          columns.forEach((col: string, i: number) => {
            obj[col] = row[i];
          });
          return obj as T;
        });

        setState({ data, loading: false, error: null });
      } catch (error) {
        if (!cancelled) {
          setState({ data: null, loading: false, error: error as Error });
        }
      }
    }

    executeQuery();
    return () => {
      cancelled = true;
    };
  }, [sql, paramsKey]);

  return state;
}
