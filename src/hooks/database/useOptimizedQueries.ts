/**
 * Optimized Query Hooks for Common Data Access Patterns
 *
 * High-level hooks that use optimized native endpoints instead of raw SQL queries.
 * Maintains exact same interfaces as raw SQL usage while providing performance benefits.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSQLite } from '../../db/SQLiteProvider';
import { translateQuery, OptimizedCall, SQLCall } from '../../db/QueryTranslation';
import { rowToNode, Node } from '../../types/node';
import { useQueryCacheRegistration, useCacheInvalidation, CacheTags, type CacheTag } from './useCacheInvalidation';
import { buildAPIURL } from '../../config/endpoints';

// Environment variable detection for API mode
const USE_NATIVE_API = process.env.REACT_APP_USE_NATIVE_API === 'true';

export interface NodesQueryOptions {
  folder?: string;
  type?: string;
  deleted?: boolean;
  limit?: number;
  enabled?: boolean;
}

export interface NotebookCardsQueryOptions {
  folder?: string;
  search?: string;
  sort?: string;
  limit?: number;
  enabled?: boolean;
}

export interface SearchOptions {
  tables?: string[]; // ['nodes', 'notebook_cards']
  limit?: number;
  enabled?: boolean;
  debounceMs?: number;
}

export interface OptimizedQueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  fromCache?: boolean;
  optimized?: boolean; // True if query used optimized endpoint
}

/**
 * Hook for loading nodes with intelligent query optimization
 * Routes to optimized /api/nodes endpoint when possible
 */
export function useNodes(options: NodesQueryOptions = {}): OptimizedQueryState<Node> {
  const {
    folder,
    type,
    deleted = false,
    limit,
    enabled = true,
  } = options;

  const { execute, loading: dbLoading, error: dbError } = useSQLite();
  const [data, setData] = useState<Node[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [optimized, setOptimized] = useState<boolean>(false);

  const sql = useMemo(() => {
    let whereClause = deleted ? '1=1' : 'deleted_at IS NULL';
    const params: unknown[] = [];

    if (folder !== undefined) {
      whereClause += ' AND folder = ?';
      params.push(folder);
    }

    if (type) {
      whereClause += ' AND node_type = ?';
      params.push(type);
    }

    let query = `SELECT * FROM nodes WHERE ${whereClause} ORDER BY modified_at DESC`;

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    return { query, params };
  }, [folder, type, deleted, limit]);

  const fetchData = useCallback(async () => {
    if (!enabled || dbLoading) return;

    setLoading(true);
    setError(null);
    setOptimized(false);

    try {
      let rows: Record<string, unknown>[];
      let wasOptimized = false;

      if (USE_NATIVE_API) {
        // Try to optimize the query
        const translation = translateQuery(sql.query, sql.params);

        if (translation.type === 'endpoint') {
          // Use optimized endpoint
          const apiCall = translation as OptimizedCall;
          const response = await fetch(buildAPIURL(apiCall.url), {
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
          rows = await (execute as unknown as (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>)(
            sqlCall.sql,
            sqlCall.params
          );
        }
      } else {
        // SQL.js mode - direct execution
        rows = (execute as (sql: string, params?: unknown[]) => Record<string, unknown>[])(sql.query, sql.params);
      }

      const nodes = rows.map(rowToNode);
      setData(nodes);
      setOptimized(wasOptimized);
    } catch (err) {
      console.error('useNodes error:', err);
      setError(err as Error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [execute, sql.query, sql.params, enabled, dbLoading]);

  // Register for cache invalidation
  const cacheTags = useMemo(() => CacheTags.nodesByFolder(folder), [folder]);
  useQueryCacheRegistration(cacheTags, fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading: loading || dbLoading,
    error: error || dbError,
    refetch: fetchData,
    optimized,
  };
}

/**
 * Hook for loading notebook cards with optimization
 * Routes to optimized /api/notebook-cards endpoint when possible
 */
export function useNotebookCards(
  options: NotebookCardsQueryOptions = {}
): OptimizedQueryState<Record<string, unknown>> {
  const {
    folder,
    search,
    sort = 'modified_at',
    limit,
    enabled = true,
  } = options;

  const { execute, loading: dbLoading, error: dbError } = useSQLite();
  const [data, setData] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [optimized, setOptimized] = useState<boolean>(false);

  const sql = useMemo(() => {
    let whereClause = 'deleted_at IS NULL';
    const params: unknown[] = [];

    if (folder !== undefined) {
      whereClause += ' AND folder = ?';
      params.push(folder);
    }

    if (search) {
      whereClause += ' AND content LIKE ?';
      params.push(`%${search}%`);
    }

    let query = `SELECT * FROM notebook_cards WHERE ${whereClause}`;

    if (sort) {
      const direction = sort.startsWith('-') ? 'ASC' : 'DESC';
      const column = sort.replace(/^-/, '');
      query += ` ORDER BY ${column} ${direction}`;
    }

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    return { query, params };
  }, [folder, search, sort, limit]);

  const fetchData = useCallback(async () => {
    if (!enabled || dbLoading) return;

    setLoading(true);
    setError(null);
    setOptimized(false);

    try {
      let rows: Record<string, unknown>[];
      let wasOptimized = false;

      if (USE_NATIVE_API) {
        // Try to optimize the query
        const translation = translateQuery(sql.query, sql.params);

        if (translation.type === 'endpoint') {
          // Use optimized endpoint
          const apiCall = translation as OptimizedCall;
          const response = await fetch(buildAPIURL(apiCall.url), {
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
          rows = await (execute as unknown as (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>)(
            sqlCall.sql,
            sqlCall.params
          );
        }
      } else {
        // SQL.js mode - direct execution
        rows = (execute as (sql: string, params?: unknown[]) => Record<string, unknown>[])(sql.query, sql.params);
      }

      setData(rows);
      setOptimized(wasOptimized);
    } catch (err) {
      console.error('useNotebookCards error:', err);
      setError(err as Error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [execute, sql.query, sql.params, enabled, dbLoading]);

  // Register for cache invalidation
  const cacheTags = useMemo(() => CacheTags.allCards(), []);
  useQueryCacheRegistration(cacheTags, fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading: loading || dbLoading,
    error: error || dbError,
    refetch: fetchData,
    optimized,
  };
}

/**
 * Hook for FTS5 search with automatic debouncing and optimization
 * Routes to optimized /api/search endpoint for better performance
 */
export function useSearch(query: string, options: SearchOptions = {}): OptimizedQueryState<Record<string, unknown>> {
  const {
    tables = ['nodes', 'notebook_cards'],
    limit = 50,
    enabled = true,
    debounceMs = 300,
  } = options;

  const { execute, loading: dbLoading, error: dbError } = useSQLite();
  const [data, setData] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [optimized, setOptimized] = useState<boolean>(false);

  // Debounced query
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const debounceTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, debounceMs]);

  const sql = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return { query: '', params: [] };
    }

    // Build FTS5 search query
    const searchQueries = tables.map(table => {
      return `SELECT *, '${table}' as source_table FROM ${table}_fts WHERE ${table}_fts MATCH ?`;
    });

    const query = searchQueries.join(' UNION ALL ') + ` ORDER BY rank LIMIT ${limit}`;
    const params = tables.map(() => debouncedQuery);

    return { query, params };
  }, [debouncedQuery, tables, limit]);

  const fetchData = useCallback(async () => {
    if (!enabled || dbLoading || !sql.query || !debouncedQuery.trim()) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setOptimized(false);

    try {
      let rows: Record<string, unknown>[];
      let wasOptimized = false;

      if (USE_NATIVE_API) {
        // Try to optimize the search query
        const translation = translateQuery(sql.query, sql.params);

        if (translation.type === 'endpoint') {
          // Use optimized search endpoint
          const apiCall = translation as OptimizedCall;
          const response = await fetch(buildAPIURL(apiCall.url), {
            method: apiCall.method,
            headers: apiCall.body ? { 'Content-Type': 'application/json' } : undefined,
            body: apiCall.body ? JSON.stringify(apiCall.body) : undefined,
          });

          if (!response.ok) {
            throw new Error(`Search API error: ${response.status}`);
          }

          const apiResponse = await response.json();
          rows = apiResponse.success ? apiResponse.data : [];
          wasOptimized = true;
        } else {
          // Fallback to SQL execution
          const sqlCall = translation as SQLCall;
          rows = await (execute as unknown as (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>)(
            sqlCall.sql,
            sqlCall.params
          );
        }
      } else {
        // SQL.js mode - direct execution
        rows = (execute as (sql: string, params?: unknown[]) => Record<string, unknown>[])(sql.query, sql.params);
      }

      setData(rows);
      setOptimized(wasOptimized);
    } catch (err) {
      console.error('useSearch error:', err);
      setError(err as Error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [execute, sql.query, sql.params, enabled, dbLoading, debouncedQuery]);

  // Register for cache invalidation
  const searchCacheTags = useMemo(() => CacheTags.searchResults(debouncedQuery), [debouncedQuery]);
  useQueryCacheRegistration(searchCacheTags, fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading: loading || dbLoading,
    error: error || dbError,
    refetch: fetchData,
    optimized,
  };
}

/**
 * Hook for optimistic mutations with automatic cache invalidation
 */
export function useOptimisticMutation<T>(
  mutationFn: () => Promise<T>,
  invalidationTags: CacheTag[] = []
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { invalidate } = useCacheInvalidation();

  const mutate = useCallback(async (): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await mutationFn();

      // Invalidate specified cache tags
      if (invalidationTags.length > 0) {
        invalidate(invalidationTags);
      }

      return result;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [mutationFn, invalidationTags, invalidate]);

  return {
    mutate,
    loading,
    error,
  };
}

/**
 * Convenience hooks for specific common patterns
 */

export function useAllNodes(options: Omit<NodesQueryOptions, 'folder'> = {}) {
  return useNodes(options);
}

export function useFolderNodes(folder: string, options: Omit<NodesQueryOptions, 'folder'> = {}) {
  return useNodes({ ...options, folder });
}

export function useRecentNodes(limit: number = 20, options: Omit<NodesQueryOptions, 'limit'> = {}) {
  return useNodes({ ...options, limit });
}

export function useRecentNotebookCards(limit: number = 20, options: Omit<NotebookCardsQueryOptions, 'limit'> = {}) {
  return useNotebookCards({ ...options, limit });
}

/**
 * Main optimized queries hook that provides access to all optimized query functions
 */
export function useOptimizedQueries() {
  return {
    useNodes,
    useNotebookCards,
    useSearch,
    useAllNodes,
    useFolderNodes,
    useRecentNodes,
    useRecentNotebookCards,
  };
}