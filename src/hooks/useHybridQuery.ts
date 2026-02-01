/**
 * Hybrid Query Hook - Research Pattern 1
 *
 * Combines TanStack Query caching with existing useLiveQuery infrastructure.
 * Uses conditional delegation to prevent cache system conflicts by exclusively
 * using either live data or cached data based on live state configuration.
 */

import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useLiveQuery, LiveQueryOptions, LiveQueryResult } from './useLiveQuery';
import { webViewBridge } from '../utils/webview-bridge';
import { QueryKey } from '../cache/queryCacheIntegration';

export interface HybridQueryOptions {
  /** TanStack Query configuration */
  staleTime?: number;
  gcTime?: number;
  /** Live query configuration */
  enableLive?: boolean;
  liveOptions?: Omit<LiveQueryOptions, 'autoStart'>;
  /** Query function override (defaults to webViewBridge.database.execute) */
  queryFn?: () => Promise<unknown>;
}

export interface HybridQueryResult<T> {
  /** Current query results */
  data: T[] | null;
  /** Loading state */
  loading: boolean;
  /** Error state (string for live, Error for cached) */
  error: string | Error | null;
  /** Whether currently using live updates */
  isLive: boolean;
  /** Whether data is stale (TanStack Query concept) */
  isStale?: boolean;
  /** Whether data is being fetched in background */
  isFetching?: boolean;
  /** Refetch function */
  refetch: () => Promise<void> | Promise<UseQueryResult<T[], Error>>;
  /** Manual live control functions */
  startLive?: () => void;
  stopLive?: () => void;
  /** Current source of data for debugging */
  dataSource: 'live' | 'cached';
}

/**
 * Hybrid caching hook implementing research Pattern 1
 *
 * Prevents cache system conflicts by exclusive data source delegation:
 * - When enableLive=true: Uses useLiveQuery, disables TanStack Query
 * - When enableLive=false: Uses TanStack Query, disables live updates
 *
 * @param queryKey TanStack Query key for cache identification
 * @param sql SQL query to execute
 * @param params Query parameters
 * @param options Hybrid query configuration
 * @returns Unified query result interface
 */
export function useHybridQuery<T = unknown>(
  queryKey: QueryKey,
  sql: string,
  params: unknown[] = [],
  options: HybridQueryOptions = {}
): HybridQueryResult<T> {
  const {
    staleTime = 1000 * 60 * 5, // 5 minutes (research recommendation)
    gcTime = 1000 * 60 * 30,   // 30 minutes (research recommendation)
    enableLive = true,
    liveOptions = {},
    queryFn
  } = options;

  // Live query hook (always created but conditionally used)
  const liveResult = useLiveQuery<T>(sql, {
    params,
    autoStart: enableLive,
    ...liveOptions
  });

  // TanStack Query hook (always created but conditionally enabled)
  const cachedResult = useQuery<T[], Error>({
    queryKey: [...queryKey, ...params], // Include params in cache key
    queryFn: queryFn || (() => webViewBridge.database.execute(sql, params) as Promise<T[]>),
    staleTime,
    gcTime,
    enabled: !enableLive, // Only enabled when live updates are disabled
    initialData: enableLive ? undefined : (liveResult.data as T[] || undefined),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry on bridge connection errors immediately
      if (error?.message?.includes('bridge') || error?.message?.includes('connection')) {
        return failureCount < 1;
      }
      return failureCount < 3;
    }
  });

  // Exclusive delegation based on live state
  if (enableLive) {
    // Use live query system
    return {
      data: liveResult.data,
      loading: liveResult.loading,
      error: liveResult.error,
      isLive: liveResult.isLive,
      isStale: false, // Live data is never stale
      isFetching: liveResult.loading,
      refetch: liveResult.refetch,
      startLive: liveResult.startLive,
      stopLive: liveResult.stopLive,
      dataSource: 'live'
    };
  } else {
    // Use TanStack Query caching system
    return {
      data: cachedResult.data || null,
      loading: cachedResult.isLoading,
      error: cachedResult.error,
      isLive: false,
      isStale: cachedResult.isStale,
      isFetching: cachedResult.isFetching,
      refetch: () => cachedResult.refetch(),
      dataSource: 'cached'
    };
  }
}

/**
 * Simplified hybrid hook for node queries with smart defaults
 */
export function useHybridNodes<T = unknown>(
  folder?: string,
  options: Omit<HybridQueryOptions, 'queryKey'> = {}
): HybridQueryResult<T> {
  const sql = folder
    ? 'SELECT * FROM nodes WHERE folder = ? ORDER BY created_at DESC'
    : 'SELECT * FROM nodes ORDER BY created_at DESC';
  const params = folder ? [folder] : [];
  const queryKey = folder ? ['nodes', folder] : ['nodes'];

  return useHybridQuery<T>(queryKey as QueryKey, sql, params, options);
}

/**
 * Simplified hybrid hook for card queries with smart defaults
 */
export function useHybridCards<T = unknown>(
  type?: string,
  options: Omit<HybridQueryOptions, 'queryKey'> = {}
): HybridQueryResult<T> {
  const sql = type
    ? 'SELECT * FROM notebook_cards WHERE type = ? ORDER BY created_at DESC'
    : 'SELECT * FROM notebook_cards ORDER BY created_at DESC';
  const params = type ? [type] : [];
  const queryKey = type ? ['cards', 'type', type] : ['cards'];

  return useHybridQuery<T>(queryKey as QueryKey, sql, params, options);
}

/**
 * Hybrid search hook with query-specific caching
 */
export function useHybridSearch<T = unknown>(
  searchQuery: string,
  options: Omit<HybridQueryOptions, 'queryKey'> = {}
): HybridQueryResult<T> {
  const sql = `
    SELECT n.*,
           snippet(nodes_fts, -1, '<mark>', '</mark>', '...', 32) as snippet,
           rank
    FROM nodes_fts
    JOIN nodes n ON nodes_fts.rowid = n.id
    WHERE nodes_fts MATCH ?
    ORDER BY rank;
  `;
  const params = [searchQuery];
  const queryKey = ['search', searchQuery];

  return useHybridQuery<T>(queryKey as QueryKey, sql, params, {
    ...options,
    // Search results benefit from longer stale time since content changes less frequently
    staleTime: options.staleTime || 1000 * 60 * 10, // 10 minutes for search
  });
}

/**
 * Performance monitoring hook for hybrid queries
 * Tracks whether live or cached mode is more efficient for specific queries
 */
export function useHybridQueryMetrics(queryKey: QueryKey) {
  // This could be expanded to track performance metrics
  // and automatically suggest optimal caching strategies
  return {
    suggestedMode: 'live' as 'live' | 'cached',
    averageResponseTime: 0,
    cacheHitRate: 0,
    recommendSwitchToCache: false,
    recommendSwitchToLive: false
  };
}