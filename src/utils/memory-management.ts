/**
 * Memory Management Utilities
 *
 * Comprehensive memory monitoring and cleanup utilities designed for WebView
 * bridge environments. Prevents cross-bridge reference cycles and provides
 * automated cleanup patterns with React DevTools Profiler integration.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * Memory monitoring configuration
 */
interface MemoryMonitorConfig {
  /** Memory threshold for warnings (MB) */
  warningThreshold: number;
  /** Memory threshold for aggressive cleanup (MB) */
  criticalThreshold: number;
  /** Monitoring interval (ms) */
  monitoringInterval: number;
  /** Enable detailed logging */
  enableLogging: boolean;
}

const DEFAULT_CONFIG: MemoryMonitorConfig = {
  warningThreshold: 50, // 50MB
  criticalThreshold: 100, // 100MB
  monitoringInterval: 10000, // 10 seconds
  enableLogging: import.meta.env.DEV
};

/**
 * Memory metrics interface
 */
export interface MemoryMetrics {
  /** Used JS heap size in MB */
  usedJSHeapSize: number;
  /** Total JS heap size in MB */
  totalJSHeapSize: number;
  /** JS heap size limit in MB */
  jsHeapSizeLimit: number;
  /** Memory pressure level */
  pressureLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Timestamp of measurement */
  timestamp: number;
  /** Bridge reference count (estimated) */
  estimatedBridgeReferences: number;
}

/**
 * Memory pressure detection and monitoring hook
 */
export function useMemoryMonitor(config: Partial<MemoryMonitorConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const metricsHistory = useRef<MemoryMetrics[]>([]);
  const warningCallback = useRef<((metrics: MemoryMetrics) => void) | null>(null);
  const abortController = useRef<AbortController>(new AbortController());

  const getMemoryMetrics = useCallback((): MemoryMetrics | null => {
    if (!('memory' in performance)) {
      return null;
    }

    const memory = (performance as any).memory;
    const usedJSHeapSize = memory.usedJSHeapSize / (1024 * 1024);
    const totalJSHeapSize = memory.totalJSHeapSize / (1024 * 1024);
    const jsHeapSizeLimit = memory.jsHeapSizeLimit / (1024 * 1024);

    // Estimate bridge references by counting global references
    const estimatedBridgeReferences = estimateBridgeReferences();

    // Determine pressure level
    let pressureLevel: MemoryMetrics['pressureLevel'] = 'low';
    if (usedJSHeapSize > finalConfig.criticalThreshold) {
      pressureLevel = 'critical';
    } else if (usedJSHeapSize > finalConfig.warningThreshold) {
      pressureLevel = 'high';
    } else if (usedJSHeapSize > finalConfig.warningThreshold * 0.7) {
      pressureLevel = 'medium';
    }

    return {
      usedJSHeapSize,
      totalJSHeapSize,
      jsHeapSizeLimit,
      pressureLevel,
      timestamp: Date.now(),
      estimatedBridgeReferences
    };
  }, [finalConfig]);

  const startMonitoring = useCallback(() => {
    const interval = setInterval(() => {
      if (abortController.current.signal.aborted) {
        clearInterval(interval);
        return;
      }

      const metrics = getMemoryMetrics();
      if (!metrics) return;

      // Store metrics history (keep last 50 measurements)
      metricsHistory.current.push(metrics);
      if (metricsHistory.current.length > 50) {
        metricsHistory.current.shift();
      }

      // Log if enabled
      if (finalConfig.enableLogging && metrics.pressureLevel !== 'low') {
        console.warn('[Memory Monitor]', {
          usage: `${metrics.usedJSHeapSize.toFixed(1)}MB`,
          pressure: metrics.pressureLevel,
          bridgeRefs: metrics.estimatedBridgeReferences
        });
      }

      // Trigger warning callback
      if (warningCallback.current && metrics.pressureLevel === 'critical') {
        warningCallback.current(metrics);
      }
    }, finalConfig.monitoringInterval);

    return () => {
      clearInterval(interval);
    };
  }, [finalConfig, getMemoryMetrics]);

  const setWarningCallback = useCallback((callback: (metrics: MemoryMetrics) => void) => {
    warningCallback.current = callback;
  }, []);

  const getMetricsHistory = useCallback(() => [...metricsHistory.current], []);

  const forceGarbageCollection = useCallback(() => {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
      if (finalConfig.enableLogging) {
        console.log('[Memory Monitor] Forced garbage collection');
      }
    }
  }, [finalConfig]);

  // Cleanup effect
  useEffect(() => {
    const cleanup = startMonitoring();

    return () => {
      cleanup();
      abortController.current.abort();
      // Create new controller for next mount
      abortController.current = new AbortController();
    };
  }, [startMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortController.current.abort();
    };
  }, []);

  return {
    getMemoryMetrics,
    setWarningCallback,
    getMetricsHistory,
    forceGarbageCollection,
    isMonitoring: !abortController.current.signal.aborted
  };
}

/**
 * Cleanup manager for handling complex cleanup scenarios
 */
export function createCleanupManager() {
  const cleanupTasks = new Set<() => void>();
  const abortController = new AbortController();
  const bridgeCallbacks = new WeakMap<object, Set<() => void>>();

  return {
    /**
     * Register a cleanup task
     */
    register(cleanup: () => void): () => void {
      cleanupTasks.add(cleanup);
      return () => {
        cleanupTasks.delete(cleanup);
      };
    },

    /**
     * Register a bridge callback with automatic cleanup
     */
    registerBridgeCallback<T extends object>(
      context: T,
      callback: () => void
    ): () => void {
      if (!bridgeCallbacks.has(context)) {
        bridgeCallbacks.set(context, new Set());
      }
      bridgeCallbacks.get(context)!.add(callback);

      return () => {
        const callbacks = bridgeCallbacks.get(context);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            bridgeCallbacks.delete(context);
          }
        }
      };
    },

    /**
     * Get abort signal for cancellable operations
     */
    getAbortSignal(): AbortSignal {
      return abortController.signal;
    },

    /**
     * Check if cleanup manager is still active
     */
    isActive(): boolean {
      return !abortController.signal.aborted;
    },

    /**
     * Execute all cleanup tasks
     */
    cleanup(): void {
      // Execute all registered cleanup tasks
      for (const cleanup of cleanupTasks) {
        try {
          cleanup();
        } catch (error) {
          console.error('[Cleanup Manager] Cleanup task failed:', error);
        }
      }

      // Clear all bridge callbacks
      for (const [context, callbacks] of bridgeCallbacks) {
        for (const callback of callbacks) {
          try {
            callback();
          } catch (error) {
            console.error('[Cleanup Manager] Bridge callback cleanup failed:', error);
          }
        }
        callbacks.clear();
      }

      // Abort all pending operations
      abortController.abort();

      // Clear collections
      cleanupTasks.clear();
      bridgeCallbacks = new WeakMap();
    }
  };
}

/**
 * React hook for automatic cleanup management with AbortController pattern
 */
export function useCleanupManager() {
  const manager = useMemo(() => createCleanupManager(), []);

  useEffect(() => {
    return () => {
      manager.cleanup();
    };
  }, [manager]);

  return manager;
}

/**
 * Estimate bridge references by checking global object properties
 * This is a heuristic approach - actual count may vary
 */
function estimateBridgeReferences(): number {
  let count = 0;

  try {
    // Check for common bridge-related global properties
    if (typeof window !== 'undefined') {
      // WebView bridge specific checks
      if ('webkit' in window) count++;
      if ('webViewBridge' in window) count++;
      if ('bridge' in window) count++;

      // Check for callback registrations
      const globalObj = window as any;
      for (const key of Object.keys(globalObj)) {
        if (key.includes('callback') || key.includes('bridge') || key.includes('native')) {
          const value = globalObj[key];
          if (typeof value === 'function' || (value && typeof value === 'object')) {
            count++;
          }
        }
      }
    }
  } catch (error) {
    // Silently handle errors in bridge reference counting
    if (import.meta.env.DEV) {
      console.debug('[Memory] Bridge reference counting failed:', error);
    }
  }

  return count;
}

/**
 * React DevTools Profiler integration for memory leak detection
 */
export function useMemoryProfiler(componentName: string, enabled: boolean = import.meta.env.DEV) {
  const renderCount = useRef(0);
  const mountTime = useRef(Date.now());
  const lastMemoryCheck = useRef<MemoryMetrics | null>(null);

  useEffect(() => {
    if (!enabled) return;

    renderCount.current++;

    // Check memory on every 10th render
    if (renderCount.current % 10 === 0) {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const currentMetrics: MemoryMetrics = {
          usedJSHeapSize: memory.usedJSHeapSize / (1024 * 1024),
          totalJSHeapSize: memory.totalJSHeapSize / (1024 * 1024),
          jsHeapSizeLimit: memory.jsHeapSizeLimit / (1024 * 1024),
          pressureLevel: 'low',
          timestamp: Date.now(),
          estimatedBridgeReferences: estimateBridgeReferences()
        };

        // Compare with last check
        if (lastMemoryCheck.current) {
          const memoryDelta = currentMetrics.usedJSHeapSize - lastMemoryCheck.current.usedJSHeapSize;
          const timeDelta = currentMetrics.timestamp - lastMemoryCheck.current.timestamp;

          if (memoryDelta > 5 && timeDelta > 0) { // >5MB increase
            console.warn(`[Memory Profiler] ${componentName} possible leak:`, {
              memoryIncrease: `${memoryDelta.toFixed(1)}MB`,
              timeElapsed: `${(timeDelta / 1000).toFixed(1)}s`,
              renders: renderCount.current
            });
          }
        }

        lastMemoryCheck.current = currentMetrics;
      }
    }
  });

  useEffect(() => {
    return () => {
      if (enabled) {
        const sessionDuration = Date.now() - mountTime.current;
        console.log(`[Memory Profiler] ${componentName} unmounted:`, {
          totalRenders: renderCount.current,
          sessionDuration: `${(sessionDuration / 1000).toFixed(1)}s`,
          avgRenderInterval: renderCount.current > 0 ? `${(sessionDuration / renderCount.current).toFixed(1)}ms` : 'N/A'
        });
      }
    };
  }, [componentName, enabled]);

  return {
    renderCount: renderCount.current,
    sessionDuration: Date.now() - mountTime.current
  };
}

/**
 * Timeout-based cleanup for stale operations
 */
export function useTimeoutCleanup<T>(
  operation: (() => Promise<T>) | null,
  timeout: number = 30000, // 30 seconds default
  onTimeout?: () => void
): [() => Promise<T | null>, boolean] {
  const activeOperations = useRef(new Set<() => void>());
  const isStale = useRef(false);

  const wrappedOperation = useCallback(async (): Promise<T | null> => {
    if (!operation) return null;

    let timeoutId: NodeJS.Timeout;
    let isCompleted = false;

    const cleanup = () => {
      isCompleted = true;
      clearTimeout(timeoutId);
      activeOperations.current.delete(cleanup);
    };

    activeOperations.current.add(cleanup);

    // Set timeout
    timeoutId = setTimeout(() => {
      if (!isCompleted) {
        isStale.current = true;
        cleanup();
        onTimeout?.();
      }
    }, timeout);

    try {
      const result = await operation();
      if (!isCompleted) {
        cleanup();
        return result;
      }
      return null;
    } catch (error) {
      if (!isCompleted) {
        cleanup();
      }
      throw error;
    }
  }, [operation, timeout, onTimeout]);

  // Cleanup all operations on unmount
  useEffect(() => {
    return () => {
      for (const cleanup of activeOperations.current) {
        cleanup();
      }
      activeOperations.current.clear();
    };
  }, []);

  return [wrappedOperation, isStale.current];
}

/**
 * Utility for detecting component unmount to prevent state updates
 */
export function useUnmountDetection(): () => boolean {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => isMountedRef.current, []);
}