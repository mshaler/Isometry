/**
 * useDataInspector Hook
 *
 * Manages Data Inspector state including SQL input, query execution,
 * result sorting, and export functionality.
 */

import { useState, useCallback } from 'react';
import { useSQLite } from '@/db/SQLiteProvider';
import { executeQuery, exportToCSV, exportToJSON, QueryResult } from '@/services/query-executor';

/**
 * Sort configuration for result table
 */
export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

/**
 * Hook return type
 */
export interface UseDataInspectorResult {
  sql: string;
  setSql: (sql: string) => void;
  result: QueryResult | null;
  error: string | null;
  isExecuting: boolean;
  sortConfig: SortConfig | null;
  runQuery: () => void;
  sortBy: (column: string) => void;
  exportCSV: () => void;
  exportJSON: () => void;
}

/**
 * Hook for managing Data Inspector state and operations
 *
 * SYNC-01 note: DataInspector is query-on-demand (user presses Ctrl+Enter).
 * It does NOT need auto-refresh because:
 * 1. Each runQuery() call reads the current database state via execute()
 * 2. Users explicitly trigger queries when they want fresh results
 * 3. Real-time updates would be distracting in a SQL exploration interface
 *
 * The execute() function always reads from the live sql.js database,
 * so results are always current at query time.
 */
export function useDataInspector(): UseDataInspectorResult {
  // useSQLite provides the `execute` function that runs SQL against sql.js
  // This is passed to executeQuery which wraps it with validation and timing
  const { execute, loading: dbLoading, error: dbError } = useSQLite();

  const [sql, setSql] = useState('SELECT * FROM nodes LIMIT 10');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const runQuery = useCallback(() => {
    if (dbLoading) return;

    setIsExecuting(true);
    setError(null);

    try {
      // Pass the useSQLite execute function to executeQuery service
      // executeQuery({ execute }, sql) wraps db.execute with validation and timing
      const queryResult = executeQuery({ execute }, sql);
      setResult(queryResult);
      setSortConfig(null); // Reset sort on new query
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
      setResult(null);
    } finally {
      setIsExecuting(false);
    }
  }, [execute, sql, dbLoading]);

  const sortBy = useCallback((column: string) => {
    if (!result) return;

    const newDirection: 'asc' | 'desc' =
      sortConfig?.column === column && sortConfig.direction === 'asc' ? 'desc' : 'asc';

    const sortedRows = [...result.rows].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];

      // Handle nulls - nulls sort to end
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return newDirection === 'asc' ? 1 : -1;
      if (bVal === null) return newDirection === 'asc' ? -1 : 1;

      // Compare based on type
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return newDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return newDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    setResult({ ...result, rows: sortedRows });
    setSortConfig({ column, direction: newDirection });
  }, [result, sortConfig]);

  const handleExportCSV = useCallback(() => {
    if (result) exportToCSV(result);
  }, [result]);

  const handleExportJSON = useCallback(() => {
    if (result) exportToJSON(result);
  }, [result]);

  return {
    sql,
    setSql,
    result,
    error: error || (dbError?.message ?? null),
    isExecuting: isExecuting || dbLoading,
    sortConfig,
    runQuery,
    sortBy,
    exportCSV: handleExportCSV,
    exportJSON: handleExportJSON
  };
}
