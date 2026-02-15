/**
 * Live Query Hook Variants
 *
 * Specialized versions of the live query hook for specific use cases.
 * Updated in Phase 84 to use cards/connections tables.
 */

import { useLiveQuery } from './useLiveQueryCore';
import type { LiveQueryOptions, LiveQueryResult } from './types';
import type { Card } from '../../types/card';

/**
 * Specialized hook for querying cards with common defaults.
 * Uses cards table (migrated from nodes in Phase 84).
 */
export function useLiveCards(
  whereClause: string = '',
  params: unknown[] = [],
  options: Omit<LiveQueryOptions, 'params'> = {}
): LiveQueryResult<Card> {
  const sql = `
    SELECT * FROM cards
    WHERE deleted_at IS NULL
    ${whereClause ? `AND (${whereClause})` : ''}
    ORDER BY created_at DESC
  `;

  return useLiveQuery<Card>(sql, { ...options, params });
}

/**
 * @deprecated Use useLiveCards instead. Will be removed in Phase 85.
 * Specialized hook for querying nodes with common defaults.
 */
export function useLiveNodes<T = unknown>(
  whereClause: string = '',
  params: unknown[] = [],
  options: Omit<LiveQueryOptions, 'params'> = {}
): LiveQueryResult<T> {
  // Delegate to useLiveCards internally for backward compatibility
  const sql = `
    SELECT * FROM cards
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
