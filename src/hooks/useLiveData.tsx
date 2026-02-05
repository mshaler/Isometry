/**
 * Live Data Hook for Real-Time Data Subscriptions
 *
 * Provides real-time data subscriptions with automatic invalidation,
 * performance monitoring, and graceful degradation. Integrates with
 * existing WebView bridge infrastructure.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useBridgeDatabase } from './useBridgeDatabase';
import type { DatabaseResult } from './useBridgeDatabase';

export interface LiveDataSubscription<T = unknown> {
  id: string;
  query: string;
  params?: unknown[];
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  updateCount: number;
  latency: number;
}

export interface LiveDataOptions {
  /** Minimum interval between updates in milliseconds (default: 100) */
  throttleMs?: number;
  /** Whether to enable automatic polling (default: false) */
  enablePolling?: boolean;
  /** Polling interval in milliseconds (default: 5000) */
  pollingIntervalMs?: number;
  /** Maximum number of retries on error (default: 3) */
  maxRetries?: number;
  /** Whether to track performance metrics (default: true) */
  trackPerformance?: boolean;
  /** Callback for performance events */
  onPerformanceUpdate?: (metrics: LiveDataPerformanceMetrics) => void;
  /** Callback for data updates (backward compatibility) */
  onUpdate?: Function;
}

export interface LiveDataPerformanceMetrics {
  subscriptionId: string;
  updateCount: number;
  averageLatency: number;
  lastLatency: number;
  errorCount: number;
  lastError: string | null;
  cacheHitRate: number;
  totalDataTransferred: number;
  eventCount: number; // Total events processed
  outOfOrderPercentage: number; // Percentage of out-of-order events
}

interface SubscriptionState<T> {
  subscription: LiveDataSubscription<T>;
  cancelToken: AbortController;
  retryCount: number;
  lastQueryHash: string;
  latencyHistory: number[];
  errorCount: number;
  cacheHits: number;
  dataSize: number;
}

/**
 * Performance monitoring for live data subscriptions
 */
class LiveDataPerformanceMonitor {
  private metrics: Map<string, LiveDataPerformanceMetrics> = new Map();

  recordUpdate(
    subscriptionId: string,
    latency: number,
    dataSize: number,
    isError: boolean,
    errorMessage?: string
  ): void {
    const existing = this.metrics.get(subscriptionId);

    if (!existing) {
      this.metrics.set(subscriptionId, {
        subscriptionId,
        updateCount: 1,
        averageLatency: latency,
        lastLatency: latency,
        errorCount: isError ? 1 : 0,
        lastError: errorMessage || null,
        cacheHitRate: 0,
        totalDataTransferred: dataSize,
        eventCount: 1,
        outOfOrderPercentage: 0
      });
    } else {
      const newUpdateCount = existing.updateCount + 1;
      const newAverage = ((existing.averageLatency * existing.updateCount) + latency) / newUpdateCount;
      const newEventCount = existing.eventCount + 1;
      // Simple placeholder calculation for out-of-order percentage
      const outOfOrderEvents = Math.max(0, existing.errorCount - existing.updateCount * 0.1);
      const newOutOfOrderPercentage = (outOfOrderEvents / newEventCount) * 100;

      this.metrics.set(subscriptionId, {
        ...existing,
        updateCount: newUpdateCount,
        averageLatency: newAverage,
        lastLatency: latency,
        errorCount: isError ? existing.errorCount + 1 : existing.errorCount,
        lastError: isError ? (errorMessage || existing.lastError) : existing.lastError,
        totalDataTransferred: existing.totalDataTransferred + dataSize,
        eventCount: newEventCount,
        outOfOrderPercentage: newOutOfOrderPercentage
      });
    }
  }

  recordCacheHit(subscriptionId: string): void {
    const existing = this.metrics.get(subscriptionId);
    if (existing) {
      // Calculate new cache hit rate based on updateCount
      const totalRequests = existing.updateCount + 1;
      const cacheHits = Math.round(existing.cacheHitRate * existing.updateCount) + 1;
      const newCacheHitRate = cacheHits / totalRequests;

      this.metrics.set(subscriptionId, {
        ...existing,
        cacheHitRate: newCacheHitRate
      });
    }
  }

  getMetrics(subscriptionId: string): LiveDataPerformanceMetrics | null {
    return this.metrics.get(subscriptionId) || null;
  }

  getAllMetrics(): LiveDataPerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }

  clearMetrics(subscriptionId?: string): void {
    if (subscriptionId) {
      this.metrics.delete(subscriptionId);
    } else {
      this.metrics.clear();
    }
  }
}

// Global performance monitor instance
const performanceMonitor = new LiveDataPerformanceMonitor();

/**
 * Cache for query results to reduce unnecessary network requests
 */
class LiveDataCache {
  private cache = new Map<string, { data: unknown; timestamp: number; hash: string }>();
  private readonly TTL_MS = 10000; // 10 second TTL

  get<T>(queryHash: string): T | null {
    const cached = this.cache.get(queryHash);
    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.TTL_MS) {
      this.cache.delete(queryHash);
      return null;
    }

    return cached.data as T;
  }

  set(queryHash: string, data: unknown): void {
    this.cache.set(queryHash, {
      data,
      timestamp: Date.now(),
      hash: queryHash
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // Invalidate entries matching pattern
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
const dataCache = new LiveDataCache();

/**
 * Generate hash for query and parameters
 */
function generateQueryHash(query: string, params?: unknown[]): string {
  const content = JSON.stringify({ query, params });
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Calculate data size for performance tracking
 */
function calculateDataSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 0;
  }
}

/**
 * Hook for real-time data subscriptions with live updates
 */
export function useLiveData<T = unknown>(
  query: string,
  params?: unknown[],
  options: LiveDataOptions = {}
): LiveDataSubscription<T> {
  const {
    throttleMs = 100,
    enablePolling = false,
    pollingIntervalMs = 5000,
    maxRetries = 3,
    trackPerformance = true,
    onPerformanceUpdate
  } = options;

  const database = useBridgeDatabase();
  const [subscription, setSubscription] = useState<LiveDataSubscription<T>>(() => {
    const id = `live_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id,
      query,
      params,
      data: null,
      isLoading: true,
      error: null,
      lastUpdated: null,
      updateCount: 0,
      latency: 0
    };
  });

  const subscriptionStateRef = useRef<SubscriptionState<T> | null>(null);
  const throttleTimerRef = useRef<NodeJS.Timeout>();
  const pollingTimerRef = useRef<NodeJS.Timeout>();

  // Initialize subscription state
  const initializeSubscription = useCallback(() => {
    const queryHash = generateQueryHash(query, params);

    subscriptionStateRef.current = {
      subscription: { ...subscription, query, params },
      cancelToken: new AbortController(),
      retryCount: 0,
      lastQueryHash: queryHash,
      latencyHistory: [],
      errorCount: 0,
      cacheHits: 0,
      dataSize: 0
    };
  }, [subscription, query, params]);

  // Execute query with performance tracking
  const executeQuery = useCallback(async (bypassCache = false): Promise<void> => {
    const state = subscriptionStateRef.current;
    if (!state || state.cancelToken.signal.aborted) return;

    const startTime = performance.now();
    const queryHash = generateQueryHash(query, params);

    try {
      // Check cache first
      if (!bypassCache) {
        const cached = dataCache.get<T>(queryHash);
        if (cached) {
          const latency = performance.now() - startTime;

          setSubscription(prev => ({
            ...prev,
            data: cached,
            isLoading: false,
            error: null,
            lastUpdated: new Date(),
            updateCount: prev.updateCount + 1,
            latency
          }));

          if (trackPerformance) {
            performanceMonitor.recordCacheHit(state.subscription.id);
            const metrics = performanceMonitor.getMetrics(state.subscription.id);
            if (metrics && onPerformanceUpdate) {
              onPerformanceUpdate(metrics);
            }
          }
          return;
        }
      }

      // Execute fresh query
      const result: DatabaseResult<T> = await database.executeQuery(query, params);
      const latency = performance.now() - startTime;

      if (state.cancelToken.signal.aborted) return;

      if (result.success && result.data !== undefined) {
        // Cache successful result
        dataCache.set(queryHash, result.data);

        // Calculate data size
        const dataSize = calculateDataSize(result.data);

        // Update subscription
        setSubscription(prev => ({
          ...prev,
          data: result.data!,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
          updateCount: prev.updateCount + 1,
          latency
        }));

        // Reset retry count on success
        state.retryCount = 0;

        // Track performance
        if (trackPerformance) {
          performanceMonitor.recordUpdate(
            state.subscription.id,
            latency,
            dataSize,
            false
          );

          const metrics = performanceMonitor.getMetrics(state.subscription.id);
          if (metrics && onPerformanceUpdate) {
            onPerformanceUpdate(metrics);
          }
        }

      } else {
        throw new Error(result.error || 'Query failed');
      }

    } catch (error) {
      const latency = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (state.cancelToken.signal.aborted) return;

      // Increment retry count
      state.retryCount++;
      state.errorCount++;

      // Track error performance
      if (trackPerformance) {
        performanceMonitor.recordUpdate(
          state.subscription.id,
          latency,
          0,
          true,
          errorMessage
        );
      }

      // Check if we should retry
      if (state.retryCount < maxRetries) {
        // Exponential backoff for retries
        const retryDelay = Math.min(1000 * Math.pow(2, state.retryCount - 1), 10000);
        setTimeout(() => {
          if (!state.cancelToken.signal.aborted) {
            executeQuery(bypassCache);
          }
        }, retryDelay);
        return;
      }

      // Max retries reached, update with error
      setSubscription(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        latency
      }));
    }
  }, [query, params, database, maxRetries, trackPerformance, onPerformanceUpdate]);

  // Throttled query execution
  const executeQueryThrottled = useCallback((bypassCache = false) => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
    }

    throttleTimerRef.current = setTimeout(() => {
      executeQuery(bypassCache);
    }, throttleMs);
  }, [executeQuery, throttleMs]);

  // Listen for bridge change notifications
  useEffect(() => {
    const handleDataChange = (event: CustomEvent) => {
      const { table } = event.detail;

      // Invalidate relevant cache entries
      if (table === 'nodes' || table === 'edges') {
        dataCache.invalidate(table);
        executeQueryThrottled(true); // Force refresh
      }
    };

    // Listen for native change notifications
    window.addEventListener('isometry-data-change', handleDataChange as EventListener);

    return () => {
      window.removeEventListener('isometry-data-change', handleDataChange as EventListener);
    };
  }, [executeQueryThrottled]);

  // Setup polling if enabled
  useEffect(() => {
    if (!enablePolling) return;

    pollingTimerRef.current = setInterval(() => {
      executeQueryThrottled(false);
    }, pollingIntervalMs);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [enablePolling, pollingIntervalMs, executeQueryThrottled]);

  // Initialize and execute initial query
  useEffect(() => {
    initializeSubscription();
    executeQuery(false);

    return () => {
      // Cleanup on unmount
      if (subscriptionStateRef.current) {
        subscriptionStateRef.current.cancelToken.abort();
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [initializeSubscription, executeQuery]);

  // Update subscription when query or params change
  useEffect(() => {
    const newQueryHash = generateQueryHash(query, params);
    const currentState = subscriptionStateRef.current;

    if (currentState && currentState.lastQueryHash !== newQueryHash) {
      // Query changed, reset and execute
      currentState.lastQueryHash = newQueryHash;
      currentState.retryCount = 0;
      setSubscription(prev => ({
        ...prev,
        query,
        params,
        isLoading: true,
        error: null
      }));
      executeQuery(false);
    }
  }, [query, params, executeQuery]);

  return subscription;
}

/**
 * Hook to get performance metrics for all active subscriptions
 */
export function useLiveDataMetrics(): {
  metrics: LiveDataPerformanceMetrics[];
  clearMetrics: (subscriptionId?: string) => void;
  cacheSize: number;
  invalidateCache: (pattern?: string) => void;
} {
  const [metrics, setMetrics] = useState<LiveDataPerformanceMetrics[]>([]);

  // Update metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(performanceMonitor.getAllMetrics());
    };

    // Initial update
    updateMetrics();

    // Update every 2 seconds
    const intervalId = setInterval(updateMetrics, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const clearMetrics = useCallback((subscriptionId?: string) => {
    performanceMonitor.clearMetrics(subscriptionId);
    setMetrics(performanceMonitor.getAllMetrics());
  }, []);

  const invalidateCache = useCallback((pattern?: string) => {
    dataCache.invalidate(pattern);
  }, []);

  return {
    metrics,
    clearMetrics,
    cacheSize: dataCache.size(),
    invalidateCache
  };
}

/**
 * Utility function to manually invalidate live data subscriptions
 */
export function invalidateLiveData(pattern?: string): void {
  dataCache.invalidate(pattern);

  // Dispatch custom event for subscriptions to refresh
  window.dispatchEvent(new CustomEvent('isometry-cache-invalidate', {
    detail: { pattern }
  }));
}

export default useLiveData;