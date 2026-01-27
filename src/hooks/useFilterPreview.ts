import { useState, useEffect, useRef } from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { compileFilters } from '@/filters/compiler';
import type { FilterState } from '@/types/filter';

/**
 * useFilterPreview Hook
 *
 * Provides real-time preview of filter results with debouncing.
 * Runs SQL query with filter WHERE clause and returns count of matching nodes.
 *
 * Features:
 * - Debounced queries (300ms default) - prevents excessive SQL on every keystroke
 * - Returns preview count: "1,234 notes match these filters"
 * - Loading state during query execution
 * - Error handling for invalid filters
 *
 * Performance:
 * - Debouncing avoids hammering SQLite on every keystroke
 * - COUNT(*) query is fast even on large datasets
 * - Can increase debounce to 500ms if preview queries are slow
 *
 * Usage:
 * ```tsx
 * const { count, isLoading } = useFilterPreview(previewFilters, 300);
 * ```
 */

interface UseFilterPreviewResult {
  count: number | null;
  isLoading: boolean;
  error: string | null;
}

export function useFilterPreview(
  filters: FilterState | null,
  debounceMs: number = 300
): UseFilterPreviewResult {
  const { execute } = useDatabase();
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If no filters, show total count
    if (!filters) {
      setCount(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Set loading state immediately
    setIsLoading(true);
    setError(null);

    // Debounce the query
    debounceTimerRef.current = setTimeout(async () => {
      if (!db) {
        setError('Database not initialized');
        setIsLoading(false);
        return;
      }

      try {
        // Build SQL WHERE clause from filters
        const { sql, params } = compileFilters(filters);

        // Execute COUNT query
        const query = `
          SELECT COUNT(*) as count
          FROM nodes
          WHERE ${sql}
        `;

        const rowsResult = execute<{ count: number }>(query, params);

        // Handle both sync (sql.js) and async (native API) execute results
        const rows = Array.isArray(rowsResult) ? rowsResult : await rowsResult;

        if (rows.length > 0) {
          const countValue = rows[0].count;
          setCount(countValue);
        } else {
          setCount(0);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Filter preview query error:', err);
        setError(err instanceof Error ? err.message : 'Query failed');
        setIsLoading(false);
      }
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filters, db, debounceMs]);

  return { count, isLoading, error };
}
