/**
 * Database Hook Types
 *
 * Type definitions for database hooks and query functionality
 */

import type { InvalidationStrategy } from '../../utils/cacheInvalidation';

export interface LiveQueryOptions {
  /** Initial query parameters */
  params?: unknown[];
  /** Initial query parameters (alias for backward compatibility) */
  queryParams?: unknown[];
  /** Whether to automatically start the query on mount */
  autoStart?: boolean;
  /** Debounce interval for rapid updates (ms) */
  debounceMs?: number;
  /** Custom error handler */
  onError?: (error: Error) => void;
  /** Custom change handler (called before state update) */
  onChange?: (data: unknown[]) => void;
  /** Enable intelligent caching with TanStack Query (default: true) */
  enableCache?: boolean;
  /** Custom cache key override (auto-generated if not provided) */
  cacheKey?: string[];
  /** Cache stale time override (default: 5 minutes) */
  staleTime?: number;
  /** Cache garbage collection time override (default: 10 minutes) */
  gcTime?: number;
  /** Automatic invalidation strategy for mutations (default: 'related') */
  invalidationStrategy?: InvalidationStrategy;
  /** Enable automatic cache invalidation on mutations (default: true) */
  autoInvalidate?: boolean;
  /** Enable background sync for offline/online scenarios (default: true) */
  enableBackgroundSync?: boolean;
  /** Background sync configuration */
  backgroundSyncConfig?: {
    retryAttempts?: number;
    retryDelay?: number;
    enableOfflineQueue?: boolean;
  };
  /** Connection state monitoring configuration */
  connectionStateConfig?: {
    enableReconnect?: boolean;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
  };
}

export interface LiveQueryResult<T = unknown> {
  /** Current query data */
  data: T[] | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether the query has been run at least once */
  isInitialized: boolean;
  /** Whether data is stale and being revalidated */
  isValidating: boolean;
  /** Whether the query is currently active (listening for changes) */
  isActive: boolean;
  /** Current connection state to the database */
  connectionState: 'connected' | 'disconnected' | 'reconnecting';
  /** Background sync status */
  syncStatus: 'idle' | 'syncing' | 'error';
  /** Pending operations count (for offline scenarios) */
  pendingOperations: number;
  
  // Control functions
  /** Manually trigger a refresh of the query */
  refresh: () => Promise<void>;
  /** Start the live query (if autoStart is false) */
  start: () => void;
  /** Stop the live query */
  stop: () => void;
  /** Update query parameters and re-run */
  updateParams: (newParams: unknown[]) => void;
  /** Force cache invalidation and refresh */
  invalidateAndRefresh: () => Promise<void>;
  /** Get cache information */
  getCacheInfo: () => {
    lastUpdated: Date | null;
    hitCount: number;
    missCount: number;
    size: number;
  };
  /** Manual optimistic update */
  optimisticUpdate: (updateFn: (current: T[] | null) => T[] | null) => void;
  /** Rollback last optimistic update */
  rollbackOptimisticUpdate: () => void;
  /** Clear local cache for this query */
  clearCache: () => void;
  /** Enable/disable background sync */
  toggleBackgroundSync: (enabled: boolean) => void;
}

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';
export type SyncStatus = 'idle' | 'syncing' | 'error';
