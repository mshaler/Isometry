import { useState, useEffect, useMemo } from 'react';
import { useSQLiteQuery } from './useSQLiteQuery';
import type { Card } from '../../types/card';

/**
 * FTS5 search result - Card with relevance score.
 * Uses cards_fts virtual table for full-text search.
 */
export type FTS5Result = Card & {
  rank: number; // FTS5 relevance score (lower is more relevant)
};

export interface FTS5SearchState {
  results: FTS5Result[];
  isSearching: boolean;
  error: Error | null;
  hasQuery: boolean;
}

/**
 * Hook for FTS5 full-text search with debouncing
 *
 * Features:
 * - 300ms debouncing to reduce query load
 * - Relevance ranking (FTS5's built-in rank)
 * - Loading state during debounce period
 * - Error handling for invalid queries
 * - Supports FTS5 operators (AND/OR/NOT/phrase/prefix)
 *
 * @param searchTerm - User search query
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns { results, isSearching, error, hasQuery }
 */
export function useFTS5Search(
  searchTerm: string | undefined,
  debounceMs = 300
): FTS5SearchState {
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Debounce the search term
  useEffect(() => {
    if (searchTerm === undefined || searchTerm === '') {
      setDebouncedTerm(undefined);
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      setIsDebouncing(false);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm, debounceMs]);

  // Build FTS5 query
  const { sql, params } = useMemo(() => {
    if (!debouncedTerm || debouncedTerm.trim().length === 0) {
      return { sql: '', params: [] };
    }

    // Query with FTS5 rank for relevance sorting
    // rank is a negative number (more negative = more relevant)
    // Uses cards/cards_fts (migrated from nodes/nodes_fts in Phase 84)
    const query = `
      SELECT
        cards.*,
        rank AS rank
      FROM cards
      JOIN cards_fts ON cards.id = cards_fts.rowid
      WHERE cards_fts MATCH ?
        AND cards.deleted_at IS NULL
      ORDER BY rank
      LIMIT 100
    `;

    const fts5Query = buildSimpleFTS5Query(debouncedTerm);
    return { sql: query, params: [fts5Query] };
  }, [debouncedTerm]);

  // Execute query
  const { data, loading, error } = useSQLiteQuery<FTS5Result>(sql, params);

  return {
    results: data || [],
    isSearching: isDebouncing || loading,
    error: error || null,
    hasQuery: !!debouncedTerm && debouncedTerm.trim().length > 0,
  };
}

/**
 * Build simple FTS5 query (escape special chars)
 * For advanced queries, users can use the full filter compiler
 */
function buildSimpleFTS5Query(input: string): string {
  // Trim input
  const trimmed = input.trim();

  // Check if user is using operators
  const hasOperators = /\b(AND|OR|NOT)\b|["*()]/.test(trimmed);

  if (hasOperators) {
    // Return as-is (user knows FTS5 syntax)
    return trimmed;
  }

  // Simple search: escape special chars and join with spaces (implicit AND)
  const words = trimmed.split(/\s+/);
  const escaped = words
    .map(word => word.replace(/["*()-]/g, ''))
    .filter(word => word.length > 0);

  return escaped.join(' ');
}
