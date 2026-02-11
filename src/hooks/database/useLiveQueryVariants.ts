/**
 * Live Query Hook Variants
 *
 * Specialized versions of the live query hook for specific use cases
 */

import { useLiveQuery } from './useLiveQueryCore';
import type { LiveQueryOptions, LiveQueryResult } from './types';

/**
 * Specialized hook for querying nodes with common defaults
 */
export function useLiveNodes<T = unknown>(
  whereClause: string = '',
  params: unknown[] = [],
  options: Omit<LiveQueryOptions, 'params'> = {}
): LiveQueryResult<T> {
  const sql = `
    SELECT * FROM nodes 
    WHERE deleted_at IS NULL
    ${whereClause ? `AND (${whereClause})` : ''}
    ORDER BY created_at DESC
  `;
  
  return useLiveQuery<T>(sql, { ...options, params });
}

/**
 * Manual control version of live query (autoStart: false)
 */
export function useLiveQueryManual<T = unknown>(
  sql: string,
  options: LiveQueryOptions = {}
): LiveQueryResult<T> {
  return useLiveQuery<T>(sql, { ...options, autoStart: false });
}

/**
 * Legacy version with backward compatibility
 */
export function useLiveQueryLegacy<T = unknown>(
  sql: string,
  params: unknown[] = [],
  options: Omit<LiveQueryOptions, 'params'> = {}
): LiveQueryResult<T> {
  return useLiveQuery<T>(sql, { 
    ...options, 
    params,
    enableCache: false, // Legacy behavior
    enableBackgroundSync: false // Legacy behavior
  });
}

/**
 * High-performance version with optimized settings
 */
export function useLiveQueryOptimized<T = unknown>(
  sql: string,
  options: LiveQueryOptions = {}
): LiveQueryResult<T> {
  return useLiveQuery<T>(sql, {
    ...options,
    debounceMs: 50, // Faster updates
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    invalidationStrategy: 'graph-wide'
  });
}

/**
 * Offline-first version with enhanced background sync
 */
export function useLiveQueryOffline<T = unknown>(
  sql: string,
  options: LiveQueryOptions = {}
): LiveQueryResult<T> {
  return useLiveQuery<T>(sql, {
    ...options,
    enableBackgroundSync: true,
    backgroundSyncConfig: {
      retryAttempts: 5,
      retryDelay: 2000,
      enableOfflineQueue: true
    },
    connectionStateConfig: {
      enableReconnect: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: 10
    }
  });
}

/**
 * Read-only version with longer cache times
 */
export function useLiveQueryReadOnly<T = unknown>(
  sql: string,
  options: LiveQueryOptions = {}
): LiveQueryResult<T> {
  return useLiveQuery<T>(sql, {
    ...options,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    autoInvalidate: false // Don't auto-invalidate for read-only queries
  });
}
