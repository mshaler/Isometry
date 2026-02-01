/**
 * React hook for live database queries with automatic UI updates
 *
 * Integrates with ChangeNotificationBridge for real-time change notifications
 * through the optimized WebView bridge infrastructure with sequence tracking
 * for race condition prevention.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { webViewBridge } from '../utils/webview-bridge';
import { useLiveDataContext } from '../context/LiveDataContext';
import { useCleanupManager, useUnmountDetection, useMemoryProfiler } from '../utils/memory-management';

export interface LiveQueryOptions {
  /** Initial query parameters */
  params?: unknown[];
  /** Whether to automatically start the query on mount */
  autoStart?: boolean;
  /** Debounce interval for rapid updates (ms) */
  debounceMs?: number;
  /** Custom error handler */
  onError?: (error: Error) => void;
  /** Custom change handler (called before state update) */
  onChange?: (data: unknown[]) => void;
}

export interface LiveQueryResult<T = unknown> {
  /** Current query results */
  data: T[] | null;
  /** Loading state */
  loading: boolean;
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
}

/**
 * Hook for live database queries with real-time updates
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
    autoStart = true,
    debounceMs = 100,
    onError,
    onChange
  } = options;

  // State
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(autoStart);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [observationId, setObservationId] = useState<string | null>(null);

  // Context
  const { subscribe, unsubscribe, isConnected } = useLiveDataContext();

  // Memory management and cleanup
  const cleanupManager = useCleanupManager();
  const isMounted = useUnmountDetection();
  const { renderCount } = useMemoryProfiler('useLiveQuery');
  const { getMemoryMetrics } = useMemoryMonitor({
    warningThreshold: 50,
    criticalThreshold: 100,
    enableLogging: true
  });

  // Refs for cleanup and debouncing
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSequenceNumber = useRef<number>(0);

  // Handle live data updates with sequence tracking
  const handleLiveUpdate = useCallback((updateData: {
    sequenceNumber: number;
    results: T[];
    observationId: string;
  }) => {
    if (!isMounted()) return;

    // Sequence number validation for race condition prevention
    if (updateData.sequenceNumber <= lastSequenceNumber.current) {
      console.warn('[useLiveQuery] Ignoring out-of-order update:', {
        received: updateData.sequenceNumber,
        last: lastSequenceNumber.current,
        sql: sql.slice(0, 50)
      });
      return;
    }

    lastSequenceNumber.current = updateData.sequenceNumber;

    // Debounce rapid updates
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (!isMounted()) return;

      const results = updateData.results as T[];

      // Call custom change handler
      onChange?.(results);

      // Update state
      setData(results);
      setLoading(false);
      setError(null);
    }, debounceMs);

    // Register timeout cleanup
    cleanupManager.register(() => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    });
  }, [sql, debounceMs, onChange, isMounted, cleanupManager]);

  // Handle live data errors
  const handleLiveError = useCallback((errorData: {
    error: string;
    observationId: string;
  }) => {
    if (!isMounted()) return;

    const errorMessage = `Live query error: ${errorData.error}`;
    setError(errorMessage);
    setLoading(false);

    // Call custom error handler
    onError?.(new Error(errorMessage));
  }, [onError, isMounted]);

  // Execute initial query
  const executeQuery = useCallback(async (): Promise<T[]> => {
    try {
      setLoading(true);
      setError(null);

      const results = await webViewBridge.database.execute(sql, params) as T[];

      if (!isMounted()) return [];

      setData(results);
      return results;
    } catch (err) {
      if (!isMounted()) return [];

      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return [];
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, [sql, params, onError, isMounted]);

  // Start live observation
  const startLive = useCallback(async () => {
    if (isLive || !isConnected) return;

    try {
      // First execute query to get initial data
      await executeQuery();

      // Subscribe to live updates
      const subscriptionId = subscribe(
        sql,
        params,
        handleLiveUpdate,
        handleLiveError
      );

      // Register bridge callback cleanup
      cleanupManager.registerBridgeCallback(
        { subscriptionId, sql },
        () => {
          if (subscriptionId) {
            unsubscribe(subscriptionId);
          }
        }
      );

      setObservationId(subscriptionId);
      setIsLive(true);

      console.log('[useLiveQuery] Started live observation:', {
        sql: sql.slice(0, 50),
        subscriptionId
      });
    } catch (err) {
      console.error('[useLiveQuery] Failed to start live observation:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [sql, params, isLive, isConnected, subscribe, unsubscribe, executeQuery, handleLiveUpdate, handleLiveError, onError, cleanupManager]);

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

  // Manual refetch
  const refetch = useCallback(async () => {
    await executeQuery();
  }, [executeQuery]);

  // Effect for auto-start
  useEffect(() => {
    if (autoStart && !isLive && isConnected) {
      startLive();
    }
  }, [autoStart, isLive, isConnected, startLive]);

  // Effect for connection state changes
  useEffect(() => {
    if (!isConnected && isLive) {
      // Connection lost - stop live updates but keep data
      stopLive();
    } else if (isConnected && autoStart && !isLive) {
      // Connection restored - restart live updates
      startLive();
    }
  }, [isConnected, isLive, autoStart, startLive, stopLive]);

  // Register cleanup with cleanup manager
  useEffect(() => {
    cleanupManager.register(() => {
      stopLive();
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    });
  }, [cleanupManager, stopLive]);

  return {
    data,
    loading,
    error,
    isLive,
    refetch,
    startLive,
    stopLive,
    observationId
  };
}

/**
 * Simplified hook for live queries that always start immediately
 */
export function useLiveNodes<T = unknown>(
  sql: string,
  params: unknown[] = []
): Pick<LiveQueryResult<T>, 'data' | 'loading' | 'error' | 'refetch'> {
  const result = useLiveQuery<T>(sql, { params, autoStart: true });

  return {
    data: result.data,
    loading: result.loading,
    error: result.error,
    refetch: result.refetch
  };
}

/**
 * Hook for live query with manual control (doesn't auto-start)
 */
export function useLiveQueryManual<T = unknown>(
  sql: string,
  options: Omit<LiveQueryOptions, 'autoStart'> = {}
): LiveQueryResult<T> {
  return useLiveQuery<T>(sql, { ...options, autoStart: false });
}