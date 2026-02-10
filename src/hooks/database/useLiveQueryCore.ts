/**
 * Core Live Query Hook
 *
 * Main implementation of the live query hook with caching and real-time updates
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveDataContext } from '../../contexts/LiveDataContext';
import { useDatabase } from '../../db/DatabaseContext';
import { queryKeys } from '../../services/query/queryClient';
import {
  createCacheInvalidationManager,
  createOptimisticUpdateManager
} from '../../utils/cacheInvalidation';
import { useBackgroundSync } from './useBackgroundSync';
import { useCleanupEffect, createCleanupStack } from '../../utils/memoryManagement';
import { memoryManager } from '../../utils/bridge-optimization/memory-manager';
import { devLogger } from '../../utils/logging';
import type {
  LiveQueryOptions,
  LiveQueryResult,
  ConnectionState,
  SyncStatus
} from './types';

/**
 * Core live query hook with real-time updates and intelligent caching
 * 
 * @param sql - SQL query string
 * @param options - Configuration options
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
  
  // Database and live data contexts
  const { db } = useDatabase();
  const liveDataContext = useLiveDataContext();
  
  // State management
  const [isActive, setIsActive] = useState(autoStart);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingOperations, setPendingOperations] = useState(0);
  
  // Refs for stable references
  const optionsRef = useRef(options);
  const cleanupStackRef = useRef(createCleanupStack());
  
  // Generate cache key
  const generatedCacheKey = useMemo(() => {
    if (cacheKey) return cacheKey;
    return queryKeys.liveQuery(sql, finalParams);
  }, [sql, finalParams, cacheKey]);
  
  // Cache managers
  const invalidationManager = useMemo(() => 
    createCacheInvalidationManager({
      strategy: invalidationStrategy,
      queryClient,
      cacheKey: generatedCacheKey
    }), [invalidationStrategy, queryClient, generatedCacheKey]
  );
  
  const optimisticManager = useMemo(() => 
    createOptimisticUpdateManager({
      queryClient,
      cacheKey: generatedCacheKey
    }), [queryClient, generatedCacheKey]
  );
  
  // Background sync
  const backgroundSync = useBackgroundSync({
    enabled: enableBackgroundSync,
    ...backgroundSyncConfig,
    onSyncStatusChange: setSyncStatus,
    onPendingOperationsChange: setPendingOperations
  });
  
  // TanStack Query for data fetching
  const queryResult = useQuery({
    queryKey: generatedCacheKey,
    queryFn: async () => {
      if (!db) throw new Error('Database not available');
      
      try {
        const result = await db.exec(sql, finalParams);
        return result[0]?.values || [];
      } catch (error) {
        devLogger.error('Live query execution failed:', error);
        throw error;
      }
    },
    enabled: isActive && !!db,
    staleTime,
    gcTime,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
  
  // Effect for handling data changes
  useEffect(() => {
    if (queryResult.data && onChange) {
      onChange(queryResult.data);
    }
  }, [queryResult.data, onChange]);
  
  // Effect for error handling
  useEffect(() => {
    if (queryResult.error && onError) {
      onError(queryResult.error as Error);
    }
  }, [queryResult.error, onError]);
  
  // Control functions
  const refresh = useCallback(async () => {
    await queryResult.refetch();
  }, [queryResult.refetch]);
  
  const start = useCallback(() => {
    setIsActive(true);
  }, []);
  
  const stop = useCallback(() => {
    setIsActive(false);
  }, []);
  
  const updateParams = useCallback((newParams: unknown[]) => {
    // This would trigger a re-render with new params
    // Implementation depends on how params are managed
  }, []);
  
  const invalidateAndRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: generatedCacheKey });
    await queryResult.refetch();
  }, [queryClient, generatedCacheKey, queryResult.refetch]);
  
  const getCacheInfo = useCallback(() => {
    const cacheData = queryClient.getQueryData(generatedCacheKey);
    const queryState = queryClient.getQueryState(generatedCacheKey);
    
    return {
      lastUpdated: queryState?.dataUpdatedAt ? new Date(queryState.dataUpdatedAt) : null,
      hitCount: 0, // Would need to track this separately
      missCount: 0, // Would need to track this separately
      size: cacheData ? JSON.stringify(cacheData).length : 0
    };
  }, [queryClient, generatedCacheKey]);
  
  const optimisticUpdate = useCallback((updateFn: (current: T[] | null) => T[] | null) => {
    optimisticManager.update(updateFn);
  }, [optimisticManager]);
  
  const rollbackOptimisticUpdate = useCallback(() => {
    optimisticManager.rollback();
  }, [optimisticManager]);
  
  const clearCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: generatedCacheKey });
  }, [queryClient, generatedCacheKey]);
  
  const toggleBackgroundSync = useCallback((enabled: boolean) => {
    backgroundSync.toggle(enabled);
  }, [backgroundSync]);
  
  // Cleanup effect
  useCleanupEffect(() => {
    const cleanup = cleanupStackRef.current;
    
    return () => {
      cleanup.executeAll();
      memoryManager.cleanup();
    };
  });
  
  // Return result
  return {
    data: queryResult.data as T[] || null,
    isLoading: queryResult.isLoading,
    error: queryResult.error as Error | null,
    isInitialized: queryResult.isFetched,
    isValidating: queryResult.isFetching && !queryResult.isLoading,
    isActive,
    connectionState,
    syncStatus,
    pendingOperations,
    
    // Control functions
    refresh,
    start,
    stop,
    updateParams,
    invalidateAndRefresh,
    getCacheInfo,
    optimisticUpdate,
    rollbackOptimisticUpdate,
    clearCache,
    toggleBackgroundSync
  };
}
