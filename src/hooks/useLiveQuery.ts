/**
 * React hook for live database queries with automatic UI updates
 *
 * Integrates with ChangeNotificationBridge for real-time change notifications
 * through the optimized WebView bridge infrastructure with sequence tracking
 * for race condition prevention.
 *
 * Enhanced with TanStack Query intelligent caching for stale-while-revalidate
 * patterns and instant cached responses.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveDataContext } from '../contexts/LiveDataContext';
import { useDatabase } from '../db/DatabaseContext';
import { queryKeys } from '../services/queryClient';
import {
  createCacheInvalidationManager,
  createOptimisticUpdateManager,
  type InvalidationStrategy
} from '../utils/cacheInvalidation';
import { useBackgroundSync } from './useBackgroundSync';
import { useCleanupEffect, createCleanupStack } from '../utils/memoryManagement';
import { memoryManager } from '../utils/bridge-optimization/memory-manager';

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
  /** Enable background sync for mutations (default: true) */
  enableBackgroundSync?: boolean;
  /** Background sync configuration */
  backgroundSyncConfig?: {
    maxQueueSize?: number;
    enableOptimisticUpdates?: boolean;
    retryFailedOnMount?: boolean;
  };
  /** Connection state awareness configuration */
  connectionStateConfig?: {
    enableAdaptiveSync?: boolean;
    fastConnectionThreshold?: number; // ms
    slowConnectionThreshold?: number; // ms
  };
}

export interface LiveQueryResult<T = unknown> {
  /** Current query results */
  data: T[] | null;
  /** Loading state */
  loading: boolean;
  /** Loading state alias for backward compatibility */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Whether the query is actively being observed */
  isLive: boolean;
  /** Refetch the query manually */
  refetch: () => Promise<void>;
  /** Start live observation */
  startLive: () => void;
  /** Stop live observation */
  stopLive: () => void;
  /** Current observation ID for debugging */
  observationId: string | null;
  /** Whether data is coming from cache */
  isFromCache?: boolean;
  /** Whether data is stale and being revalidated */
  isStale?: boolean;
  /** Cache hit rate for this query */
  cacheHitRate?: number;
  /** Invalidate cache for this query */
  invalidateCache: () => void;
  /** Invalidate related queries based on operation */
  invalidateRelated: (operation: 'node' | 'edge', data?: any) => Promise<void>;
  /** Update data optimistically with rollback capability */
  updateOptimistically: <TData = T>(update: Partial<TData>, rollbackKey?: string) => void;
  /** Rollback optimistic update */
  rollbackOptimisticUpdate: (rollbackKey: string) => void;
  /** Queue mutation for background sync */
  queueBackgroundSync: (operation: 'node' | 'edge', type: 'create' | 'update' | 'delete', data: any) => string;
  /** Background sync queue state */
  backgroundSyncState?: {
    pending: number;
    processing: number;
    failed: number;
    isOnline: boolean;
  };
  /** Connection state information */
  connectionState?: {
    quality: 'fast' | 'slow' | 'offline';
    latency: number;
    adaptiveSyncEnabled: boolean;
  };
  /** Optimistic update management */
  optimisticState?: {
    pending: number;
    hasChanges: boolean;
    lastUpdate: Date | null;
  };
}

/**
 * Generate a cache key for a SQL query and its parameters
 */
function generateQueryHash(sql: string, params: unknown[]): string {
  // Simple hash for SQL + params - in production, consider using a better hash function
  const content = sql + JSON.stringify(params);
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString();
}

/**
 * Hook for live database queries with real-time updates and intelligent caching
 *
 * @param sql SQL query to execute and observe
 * @param options Query options and callbacks
 * @returns Live query result with data, loading, and control functions
 */
export function useLiveQuery<T = unknown>(
  sql: string,
  options: LiveQueryOptions = {}
): LiveQueryResult<T> {
  const {
    params = [],
    queryParams,
    autoStart = true,
    debounceMs = 100,
    onError,
    onChange,
    enableCache = true,
    cacheKey,
    staleTime = 5 * 60 * 1000, // 5 minutes
    gcTime = 10 * 60 * 1000, // 10 minutes
    invalidationStrategy = 'related',
    autoInvalidate = true,
    enableBackgroundSync = true,
    backgroundSyncConfig = {},
    connectionStateConfig = {}
  } = options;

  // Resolve parameters (support both params and queryParams for backward compatibility)
  const finalParams = queryParams || params;

  // TanStack Query client for cache management
  const queryClient = useQueryClient();

  // Background sync integration
  const backgroundSync = useBackgroundSync({
    autoStart: enableBackgroundSync,
    enableOptimisticUpdates: backgroundSyncConfig.enableOptimisticUpdates ?? true,
    maxQueueSize: backgroundSyncConfig.maxQueueSize ?? 100,
    retryFailedOnMount: backgroundSyncConfig.retryFailedOnMount ?? true
  });

  // Cleanup stack for memory management
  const cleanupStack = useMemo(() => createCleanupStack(), []);

  // Generate query key for cache
  const queryHash = generateQueryHash(sql, finalParams);
  const defaultCacheKey = queryKeys.liveQuery(sql, finalParams);
  const finalCacheKey = cacheKey || defaultCacheKey;

  // Cache invalidation managers (created once per hook instance)
  const invalidationManager = useMemo(() =>
    createCacheInvalidationManager(queryClient), [queryClient]
  );
  const optimisticManager = useMemo(() =>
    createOptimisticUpdateManager(queryClient), [queryClient]
  );

  // State for live updates
  const [isLive, setIsLive] = useState(false);
  const [observationId, setObservationId] = useState<string | null>(null);
  const [cacheHitCount, setCacheHitCount] = useState(0);
  const [totalQueries, setTotalQueries] = useState(0);

  // Optimistic updates state (SYNC-02)
  const [optimisticUpdates, setOptimisticUpdates] = useState(new Map<string, any>());
  const [optimisticPendingCount, setOptimisticPendingCount] = useState(0);
  const [lastOptimisticUpdate, setLastOptimisticUpdate] = useState<Date | null>(null);

  // Connection state awareness (SYNC-04)
  const [connectionQuality, setConnectionQuality] = useState<'fast' | 'slow' | 'offline'>('fast');
  const [connectionLatency, setConnectionLatency] = useState(0);
  const [adaptiveSyncEnabled, setAdaptiveSyncEnabled] = useState(
    connectionStateConfig.enableAdaptiveSync !== false
  );

  // Context
  const { subscribe, unsubscribe, isConnected } = useLiveDataContext();
  const database = useDatabase();

  // Refs for cleanup and debouncing
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSequenceNumber = useRef<number>(0);
  const mountedRef = useRef(true);

  // Correlation ID tracking (SYNC-05)
  const correlationIds = useRef<Set<string>>(new Set());
  const operationMap = useRef(new Map<string, { operation: string; timestamp: number }>());

  // Core query function that integrates with TanStack Query
  const queryFunction = useCallback(async (): Promise<T[]> => {
    setTotalQueries(prev => prev + 1);

    try {
      const results = database.execute(sql, finalParams) as T[];

      // Call custom change handler
      onChange?.(results);

      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      throw err;
    }
  }, [sql, finalParams, onChange, onError, database]);

  // TanStack Query for intelligent caching
  const tanstackQuery = useQuery({
    queryKey: finalCacheKey,
    queryFn: queryFunction,
    staleTime,
    gcTime,
    enabled: enableCache && autoStart,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry client errors, retry network errors up to 2 times
      if (error && typeof error === 'object' && 'status' in error) {
        const status = error.status as number;
        if (status >= 400 && status < 500) return false;
      }
      return failureCount < 2;
    }
  });

  // Track cache hits
  useEffect(() => {
    if (tanstackQuery.data && !tanstackQuery.isFetching && !tanstackQuery.isLoading) {
      setCacheHitCount(prev => prev + 1);
    }
  }, [tanstackQuery.data, tanstackQuery.isFetching, tanstackQuery.isLoading]);

  // Monitor connection quality based on latency
  const monitorConnectionQuality = useCallback((latency: number) => {
    setConnectionLatency(latency);

    const fastThreshold = connectionStateConfig.fastConnectionThreshold || 100;
    const slowThreshold = connectionStateConfig.slowConnectionThreshold || 500;

    let newQuality: 'fast' | 'slow' | 'offline';
    if (!isConnected) {
      newQuality = 'offline';
    } else if (latency <= fastThreshold) {
      newQuality = 'fast';
    } else if (latency <= slowThreshold) {
      newQuality = 'slow';
    } else {
      newQuality = 'slow'; // Very slow is still 'slow'
    }

    if (newQuality !== connectionQuality) {
      setConnectionQuality(newQuality);
      console.log(`[useLiveQuery] Connection quality changed: ${connectionQuality} → ${newQuality} (${latency}ms)`);
    }
  }, [connectionStateConfig, isConnected, connectionQuality]);

  // Handle live data updates with sequence tracking and correlation IDs
  const handleLiveUpdate = useCallback((updateData: {
    sequenceNumber: number;
    results: unknown[];
    observationId: string;
    correlationId?: string;
  }) => {
    if (!mountedRef.current) return;

    // Correlation ID tracking (SYNC-05)
    if (updateData.correlationId) {
      correlationIds.current.add(updateData.correlationId);

      // Check if this correlates with a known operation
      if (operationMap.current.has(updateData.correlationId)) {
        const operation = operationMap.current.get(updateData.correlationId)!;
        const latency = Date.now() - operation.timestamp;
        console.log(`[useLiveQuery] Operation completed: ${operation.operation} in ${latency}ms`);

        // Monitor connection quality
        monitorConnectionQuality(latency);

        // Remove completed operation
        operationMap.current.delete(updateData.correlationId);
      }
    }

    // Sequence number validation for race condition prevention
    if (updateData.sequenceNumber <= lastSequenceNumber.current) {
      console.warn('[useLiveQuery] Ignoring out-of-order update:', {
        received: updateData.sequenceNumber,
        last: lastSequenceNumber.current,
        sql: sql.slice(0, 50),
        correlationId: updateData.correlationId
      });
      return;
    }

    lastSequenceNumber.current = updateData.sequenceNumber;

    // Debounce rapid updates
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;

      let results = updateData.results as T[];

      // Merge with optimistic updates (SYNC-02)
      if (optimisticUpdates.size > 0) {
        const mergedResults = results.map(item => {
          const optimisticUpdate = optimisticUpdates.get((item as any).id);
          if (optimisticUpdate) {
            console.log('[useLiveQuery] Merging optimistic update for item:', (item as any).id);
            return { ...item, ...optimisticUpdate };
          }
          return item;
        });

        // Clear resolved optimistic updates
        const resolvedIds = new Set(results.map(item => (item as any).id));
        for (const [id, _] of optimisticUpdates) {
          if (resolvedIds.has(id)) {
            setOptimisticUpdates(prev => {
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
            setOptimisticPendingCount(prev => Math.max(0, prev - 1));
          }
        }

        results = mergedResults;
      }

      // Adapt sync behavior based on connection quality (SYNC-04)
      if (adaptiveSyncEnabled) {
        if (connectionQuality === 'slow') {
          // Increase debounce for slow connections
          const adaptiveDebounce = debounceMs * 2;
          console.log(`[useLiveQuery] Adapted debounce for slow connection: ${adaptiveDebounce}ms`);
        } else if (connectionQuality === 'offline') {
          // Queue for later when connection restored
          console.log('[useLiveQuery] Offline - update queued');
          return;
        }
      }

      // Update TanStack Query cache with live data
      if (enableCache) {
        queryClient.setQueryData(finalCacheKey, results);
      }

      // Call custom change handler
      onChange?.(results);
    }, debounceMs);
  }, [
    sql, debounceMs, onChange, enableCache, finalCacheKey, queryClient,
    optimisticUpdates, adaptiveSyncEnabled, connectionQuality, monitorConnectionQuality
  ]);

  // Handle live data errors
  const handleLiveError = useCallback((errorData: {
    error: string;
    observationId: string;
  }) => {
    if (!mountedRef.current) return;

    const errorMessage = `Live query error: ${errorData.error}`;

    // Invalidate query on live error to force refetch
    if (enableCache) {
      queryClient.invalidateQueries({ queryKey: finalCacheKey });
    }

    // Call custom error handler
    onError?.(new Error(errorMessage));
  }, [onError, enableCache, finalCacheKey, queryClient]);

  // Start live observation
  const startLive = useCallback(async () => {
    if (isLive || !isConnected) return;

    try {
      // Subscribe to live updates
      const subscriptionId = await subscribe(
        sql,
        finalParams,
        handleLiveUpdate,
        handleLiveError
      );

      // Register bridge callback cleanup with correlation ID
      const correlationId = `live-query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      memoryManager.registerBridgeCallback(
        'subscription',
        { subscriptionId, sql },
        () => {
          if (subscriptionId) {
            unsubscribe(subscriptionId);
          }
        },
        correlationId
      );

      setObservationId(subscriptionId);
      setIsLive(true);

      console.log('[useLiveQuery] Started live observation:', {
        sql: sql.slice(0, 50),
        subscriptionId,
        correlationId
      });
    } catch (err) {
      console.error('[useLiveQuery] Failed to start live observation:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [sql, finalParams, isLive, isConnected, subscribe, handleLiveUpdate, handleLiveError, onError]);

  // Stop live observation
  const stopLive = useCallback(() => {
    if (!isLive || !observationId) return;

    unsubscribe(observationId);
    setObservationId(null);
    setIsLive(false);

    // Clear debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    console.log('[useLiveQuery] Stopped live observation:', observationId);
  }, [isLive, observationId, unsubscribe]);

  // Manual refetch - use TanStack Query refetch if cache is enabled
  const refetch = useCallback(async () => {
    if (enableCache) {
      await tanstackQuery.refetch();
    } else {
      // Fallback to direct query execution
      await queryFunction();
    }
  }, [enableCache, tanstackQuery, queryFunction]);

  // Invalidate cache function
  const invalidateCache = useCallback(() => {
    if (enableCache) {
      queryClient.invalidateQueries({ queryKey: finalCacheKey });
    }
  }, [enableCache, queryClient, finalCacheKey]);

  // Invalidate related queries based on operation
  const invalidateRelated = useCallback(async (operation: 'node' | 'edge', data?: any) => {
    if (!autoInvalidate || !enableCache) return;

    try {
      if (operation === 'node') {
        await invalidationManager.invalidateForNodeOperation(
          data || { type: 'update' },
          invalidationStrategy
        );
      } else if (operation === 'edge') {
        await invalidationManager.invalidateForEdgeOperation(
          data || { type: 'update' },
          invalidationStrategy
        );
      }
    } catch (err) {
      console.error('[useLiveQuery] Cache invalidation failed:', err);
    }
  }, [autoInvalidate, enableCache, invalidationManager, invalidationStrategy]);

  // Enhanced optimistic update function (SYNC-02)
  const updateOptimistically = useCallback(<TData = T>(
    update: Partial<TData>,
    rollbackKey?: string
  ) => {
    if (!enableCache) {
      console.warn('[useLiveQuery] Optimistic updates require cache to be enabled');
      return;
    }

    // Store optimistic update for later reconciliation
    if (update && typeof update === 'object' && 'id' in update) {
      const id = (update as any).id;
      const correlationId = rollbackKey || `optimistic-${Date.now()}-${id}`;

      // Track optimistic update
      setOptimisticUpdates(prev => {
        const next = new Map(prev);
        next.set(id, update);
        return next;
      });

      setOptimisticPendingCount(prev => prev + 1);
      setLastOptimisticUpdate(new Date());

      // Track operation for correlation
      operationMap.current.set(correlationId, {
        operation: 'optimistic-update',
        timestamp: Date.now()
      });

      console.log('[useLiveQuery] Applied optimistic update:', {
        id,
        correlationId,
        update
      });
    }

    // Apply immediate UI update to cache
    queryClient.setQueryData(finalCacheKey, (old: TData[] | undefined) => {
      if (!old || !Array.isArray(old)) return old;

      // If update has an ID, update specific item
      if (update && typeof update === 'object' && 'id' in update) {
        return old.map((item: any) =>
          item.id === (update as any).id ? { ...item, ...update } : item
        ) as TData[];
      }

      // Otherwise, update all items
      return old.map((item: any) => ({ ...item, ...update })) as TData[];
    });
  }, [enableCache, queryClient, finalCacheKey]);

  // Enhanced rollback optimistic update function
  const rollbackOptimisticUpdate = useCallback((rollbackKey: string) => {
    if (!enableCache) return;

    // Find and remove optimistic update by rollback key or ID
    let removedId: string | null = null;

    setOptimisticUpdates(prev => {
      const next = new Map(prev);
      for (const [id, _] of prev) {
        const correlationId = `optimistic-${Date.now()}-${id}`;
        if (correlationId.includes(rollbackKey) || id === rollbackKey) {
          next.delete(id);
          removedId = id;
          break;
        }
      }
      return next;
    });

    if (removedId) {
      setOptimisticPendingCount(prev => Math.max(0, prev - 1));
      console.log('[useLiveQuery] Rolled back optimistic update:', { rollbackKey, id: removedId });

      // Refresh data from cache to remove optimistic changes
      queryClient.invalidateQueries({ queryKey: finalCacheKey });
    }

    // Also call the original rollback for compatibility
    optimisticManager.rollbackOptimisticUpdate(rollbackKey);
  }, [enableCache, optimisticManager, queryClient, finalCacheKey]);

  // Queue background sync for mutations
  const queueBackgroundSync = useCallback((
    operation: 'node' | 'edge',
    type: 'create' | 'update' | 'delete',
    data: any
  ): string => {
    if (!enableBackgroundSync) {
      throw new Error('Background sync is disabled for this query');
    }

    // Queue the appropriate sync operation
    if (operation === 'node') {
      return backgroundSync.queueNodeSync(type, data, {
        userInitiated: true,
        priority: 'high'
      });
    } else {
      return backgroundSync.queueEdgeSync(type, data, {
        userInitiated: true,
        priority: 'high'
      });
    }
  }, [enableBackgroundSync, backgroundSync]);

  // Effect for auto-start
  useEffect(() => {
    if (autoStart && !isLive && isConnected) {
      startLive();
    }
  }, [autoStart, isLive, isConnected, startLive]);

  // Effect for connection state changes
  useEffect(() => {
    if (!isConnected && isLive) {
      // Connection lost - stop live updates but keep cached data
      stopLive();
    } else if (isConnected && autoStart && !isLive) {
      // Connection restored - restart live updates
      startLive();
    }
  }, [isConnected, isLive, autoStart, startLive, stopLive]);

  // Cleanup effect with memory management
  useCleanupEffect(() => {
    // Add WebView bridge subscription cleanup
    if (observationId) {
      cleanupStack.addSubscription({
        unsubscribe: () => unsubscribe(observationId)
      });
    }

    // Add debounce timer cleanup
    if (debounceTimer.current) {
      cleanupStack.addTimer(debounceTimer.current);
    }

    // Add memory pressure callback for this query
    const memoryPressureCleanup = memoryManager.addMemoryPressureCallback((metrics, activeCallbacks) => {
      if (!mountedRef.current) return;

      // Cancel observations during critical memory pressure
      if (metrics.pressureLevel === 'critical' && isLive) {
        console.warn('[useLiveQuery] Critical memory pressure detected, canceling live observation:', {
          sql: sql.slice(0, 50),
          usage: `${metrics.usedJSHeapSize.toFixed(1)}MB`,
          activeCallbacks: activeCallbacks.length
        });
        stopLive();
      }
    });

    return () => {
      mountedRef.current = false;
      stopLive();
      cleanupStack.destroy();
      memoryPressureCleanup(); // Cleanup memory pressure callback

      // Trigger bridge callback cleanup for this component
      if (observationId) {
        memoryManager.cleanupBridgeCallbacks();
      }
    };
  }, [observationId, stopLive, cleanupStack, sql, isLive], 'LiveQuery:Cleanup');

  // Calculate cache hit rate
  const cacheHitRate = totalQueries > 0 ? (cacheHitCount / totalQueries) * 100 : 0;

  // Determine data source and state
  const isFromCache = enableCache && tanstackQuery.data && !tanstackQuery.isFetching;
  const isStale = enableCache && tanstackQuery.isStale;
  const finalData = enableCache ? (tanstackQuery.data || null) : null;
  const finalLoading = enableCache ? tanstackQuery.isLoading : false;
  const finalError = enableCache ? tanstackQuery.error?.message || null : null;

  return {
    data: finalData,
    loading: finalLoading,
    isLoading: finalLoading, // Alias for backward compatibility
    error: finalError,
    isLive,
    refetch,
    startLive,
    stopLive,
    observationId,
    isFromCache,
    isStale,
    cacheHitRate: Math.round(cacheHitRate * 100) / 100,
    invalidateCache,
    invalidateRelated,
    updateOptimistically,
    rollbackOptimisticUpdate,
    queueBackgroundSync,
    backgroundSyncState: enableBackgroundSync ? {
      pending: backgroundSync.queueState.pending,
      processing: backgroundSync.queueState.processing,
      failed: backgroundSync.queueState.failed,
      isOnline: backgroundSync.isOnline
    } : undefined,
    // New sync optimization features
    connectionState: {
      quality: connectionQuality,
      latency: connectionLatency,
      adaptiveSyncEnabled
    },
    optimisticState: {
      pending: optimisticPendingCount,
      hasChanges: optimisticUpdates.size > 0,
      lastUpdate: lastOptimisticUpdate
    }
  };
}

/**
 * Simplified hook for live queries that always start immediately
 * Maintains backward compatibility while adding cache benefits
 */
export function useLiveNodes<T = unknown>(
  sql: string,
  params: unknown[] = []
): Pick<LiveQueryResult<T>, 'data' | 'loading' | 'isLoading' | 'error' | 'refetch'> {
  const result = useLiveQuery<T>(sql, { params, autoStart: true, enableCache: true });

  return {
    data: result.data,
    loading: result.loading,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch
  };
}

/**
 * Hook for live query with manual control (doesn't auto-start)
 * Enables caching by default for manual queries
 */
export function useLiveQueryManual<T = unknown>(
  sql: string,
  options: Omit<LiveQueryOptions, 'autoStart'> = {}
): LiveQueryResult<T> {
  return useLiveQuery<T>(sql, {
    ...options,
    autoStart: false,
    enableCache: options.enableCache !== false // Default to true unless explicitly false
  });
}

/**
 * Legacy hook for backward compatibility - no caching, direct WebView bridge
 * Use only when caching is not desired
 */
export function useLiveQueryLegacy<T = unknown>(
  sql: string,
  options: LiveQueryOptions = {}
): LiveQueryResult<T> {
  return useLiveQuery<T>(sql, {
    ...options,
    enableCache: false // Force disable caching for legacy behavior
  });
}