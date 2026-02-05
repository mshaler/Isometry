/**
 * Bridge Memory Manager
 *
 * Extends the existing memory management infrastructure with bridge-specific cleanup
 * functionality to prevent memory leaks during concurrent real-time operations
 * and component lifecycle management.
 *
 * Integrates with existing memory pressure thresholds (50MB warning, 100MB critical)
 * and performance monitoring infrastructure from Phase 21.
 */

import { useEffect, useRef } from 'react';

/**
 * Memory metrics interface for bridge memory management
 */
export interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  pressureLevel: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  estimatedBridgeReferences: number;
}

/**
 * Bridge callback registration interface
 */
export interface BridgeCallbackRegistration {
  id: string;
  type: 'subscription' | 'observation' | 'query' | 'sync';
  context: object;
  cleanup: () => void;
  createdAt: number;
  isActive: boolean;
  memoryFootprint?: number; // Estimated memory usage in bytes
}

/**
 * Bridge memory pressure callback interface
 */
export interface BridgeMemoryPressureCallback {
  (metrics: MemoryMetrics, activeCallbacks: BridgeCallbackRegistration[]): void;
}

/**
 * Bridge memory cleanup statistics
 */
export interface BridgeCleanupStats {
  totalCallbacks: number;
  activeCallbacks: number;
  cleanedCallbacks: number;
  memoryFreed: number; // Estimated bytes
  lastCleanup: number; // Timestamp
  cleanupDuration: number; // Milliseconds
  pressureLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Bridge Memory Manager class that coordinates cleanup operations
 * across WebView bridge subscriptions, observations, and pending operations.
 */
export class BridgeMemoryManager {
  private callbacks = new Map<string, BridgeCallbackRegistration>();
  private correlationMap = new Map<string, string[]>(); // Track related callbacks
  private abortControllers = new Map<string, AbortController>();
  private memoryPressureCallbacks = new Set<BridgeMemoryPressureCallback>();
  private cleanupStats: BridgeCleanupStats = {
    totalCallbacks: 0,
    activeCallbacks: 0,
    cleanedCallbacks: 0,
    memoryFreed: 0,
    lastCleanup: 0,
    cleanupDuration: 0,
    pressureLevel: 'low'
  };

  private readonly CLEANUP_BATCH_SIZE = 10; // Max callbacks to clean per batch

  constructor() {
    this.initializeMemoryMonitoring();
  }

  /**
   * Initialize memory monitoring and pressure callbacks
   */
  private initializeMemoryMonitoring(): void {
    // This will be used by consumers to set up memory monitoring
    // The actual monitoring is handled by the memory-management module
  }

  /**
   * Register a bridge callback for lifecycle tracking
   * @param type Type of bridge operation
   * @param context Context object for tracking (e.g., component instance, query object)
   * @param cleanup Cleanup function to call when releasing resources
   * @param correlationId Optional correlation ID for grouping related operations
   * @returns Registration ID for later cleanup
   */
  registerBridgeCallback(
    type: BridgeCallbackRegistration['type'],
    context: object,
    cleanup: () => void,
    correlationId?: string
  ): string {
    const id = `bridge-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const registration: BridgeCallbackRegistration = {
      id,
      type,
      context,
      cleanup,
      createdAt: now,
      isActive: true,
      memoryFootprint: this.estimateMemoryFootprint(context)
    };

    this.callbacks.set(id, registration);
    this.cleanupStats.totalCallbacks++;
    this.cleanupStats.activeCallbacks++;

    // Track correlation if provided
    if (correlationId) {
      if (!this.correlationMap.has(correlationId)) {
        this.correlationMap.set(correlationId, []);
      }
      this.correlationMap.get(correlationId)!.push(id);
    }

    // Create abort controller for this callback
    this.abortControllers.set(id, new AbortController());

    console.log('[BridgeMemoryManager] Registered callback:', {
      id,
      type,
      correlationId,
      memoryFootprint: registration.memoryFootprint,
      activeCallbacks: this.cleanupStats.activeCallbacks
    });

    return id;
  }

  /**
   * Unregister a specific bridge callback
   * @param callbackId ID returned from registerBridgeCallback
   */
  unregisterBridgeCallback(callbackId: string): boolean {
    const registration = this.callbacks.get(callbackId);
    if (!registration || !registration.isActive) {
      return false;
    }

    try {
      // Mark as inactive before cleanup to prevent double cleanup
      registration.isActive = false;

      // Execute cleanup function
      registration.cleanup();

      // Abort any pending operations
      const controller = this.abortControllers.get(callbackId);
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }

      // Update stats
      this.cleanupStats.activeCallbacks--;
      this.cleanupStats.cleanedCallbacks++;
      this.cleanupStats.memoryFreed += registration.memoryFootprint || 0;

      // Clean up tracking
      this.callbacks.delete(callbackId);
      this.abortControllers.delete(callbackId);

      // Clean up correlation tracking
      for (const [correlationId, callbackIds] of this.correlationMap) {
        const index = callbackIds.indexOf(callbackId);
        if (index >= 0) {
          callbackIds.splice(index, 1);
          if (callbackIds.length === 0) {
            this.correlationMap.delete(correlationId);
          }
          break;
        }
      }

      console.log('[BridgeMemoryManager] Unregistered callback:', {
        id: callbackId,
        type: registration.type,
        activeCallbacks: this.cleanupStats.activeCallbacks
      });

      return true;
    } catch (error) {
      console.error('[BridgeMemoryManager] Cleanup failed for callback:', callbackId, error);
      return false;
    }
  }

  /**
   * Clean up all bridge callbacks and release resources
   * This is the main method called during memory pressure or component unmount
   */
  cleanupBridgeCallbacks(): BridgeCleanupStats {
    const startTime = Date.now();
    let cleanedCount = 0;
    let memoryFreed = 0;

    console.log('[BridgeMemoryManager] Starting bridge callback cleanup:', {
      totalCallbacks: this.callbacks.size,
      activeCallbacks: this.cleanupStats.activeCallbacks
    });

    // Process callbacks in batches to prevent blocking
    const activeCallbacks = Array.from(this.callbacks.values()).filter(cb => cb.isActive);

    for (let i = 0; i < activeCallbacks.length && i < this.CLEANUP_BATCH_SIZE; i++) {
      const registration = activeCallbacks[i];

      if (this.unregisterBridgeCallback(registration.id)) {
        cleanedCount++;
        memoryFreed += registration.memoryFootprint || 0;
      }
    }

    // Update cleanup stats
    const duration = Date.now() - startTime;
    this.cleanupStats.lastCleanup = Date.now();
    this.cleanupStats.cleanupDuration = duration;

    console.log('[BridgeMemoryManager] Bridge callback cleanup complete:', {
      cleaned: cleanedCount,
      duration: `${duration}ms`,
      memoryFreed: `${(memoryFreed / 1024).toFixed(1)}KB`,
      remaining: this.cleanupStats.activeCallbacks
    });

    return { ...this.cleanupStats };
  }

  /**
   * Add a memory pressure callback that will be notified when memory pressure is detected
   * @param callback Function to call when memory pressure occurs
   */
  addMemoryPressureCallback(callback: BridgeMemoryPressureCallback): () => void {
    this.memoryPressureCallbacks.add(callback);

    return () => {
      this.memoryPressureCallbacks.delete(callback);
    };
  }

  /**
   * Notify all memory pressure callbacks about current memory state
   * This method is called by the memory monitoring system
   * @param metrics Current memory metrics
   */
  notifyMemoryPressure(metrics: MemoryMetrics): void {
    this.cleanupStats.pressureLevel = metrics.pressureLevel;

    // Get current active callbacks
    const activeCallbacks = Array.from(this.callbacks.values()).filter(cb => cb.isActive);

    // Notify all registered callbacks
    for (const callback of this.memoryPressureCallbacks) {
      try {
        callback(metrics, activeCallbacks);
      } catch (error) {
        console.error('[BridgeMemoryManager] Memory pressure callback failed:', error);
      }
    }

    // Automatic cleanup on critical memory pressure
    if (metrics.pressureLevel === 'critical') {
      console.warn('[BridgeMemoryManager] Critical memory pressure detected, triggering automatic cleanup');
      this.cleanupBridgeCallbacks();
    }
  }

  /**
   * Get abort controller for a specific callback
   * @param callbackId Callback registration ID
   */
  getAbortController(callbackId: string): AbortController | undefined {
    return this.abortControllers.get(callbackId);
  }

  /**
   * Get callbacks by correlation ID
   * @param correlationId Correlation ID to look up
   */
  getCorrelatedCallbacks(correlationId: string): BridgeCallbackRegistration[] {
    const callbackIds = this.correlationMap.get(correlationId) || [];
    return callbackIds
      .map(id => this.callbacks.get(id))
      .filter((cb): cb is BridgeCallbackRegistration => cb !== undefined && cb.isActive);
  }

  /**
   * Get current cleanup statistics
   */
  getCleanupStats(): BridgeCleanupStats {
    return { ...this.cleanupStats };
  }

  /**
   * Get all active callbacks (for debugging)
   */
  getActiveCallbacks(): BridgeCallbackRegistration[] {
    return Array.from(this.callbacks.values()).filter(cb => cb.isActive);
  }

  /**
   * Estimate memory footprint of a context object
   * This is a heuristic approach - actual memory usage may vary
   */
  private estimateMemoryFootprint(context: object): number {
    try {
      // Simple heuristic: estimate based on object properties and values
      const jsonString = JSON.stringify(context);
      return jsonString.length * 2; // Rough estimate: 2 bytes per character
    } catch (error) {
      // If object is not serializable, use a default estimate
      return 1024; // 1KB default
    }
  }

  /**
   * Force cleanup of inactive callbacks (cleanup dead references)
   */
  purgeInactiveCallbacks(): number {
    let purged = 0;

    for (const [id, registration] of this.callbacks) {
      if (!registration.isActive) {
        this.callbacks.delete(id);
        this.abortControllers.delete(id);
        purged++;
      }
    }

    if (purged > 0) {
      console.log('[BridgeMemoryManager] Purged inactive callbacks:', purged);
    }

    return purged;
  }
}

// Singleton instance for global bridge memory management
export const bridgeMemoryManager = new BridgeMemoryManager();

/**
 * Simple memory monitoring utility
 */
function getCurrentMemoryMetrics(): MemoryMetrics | null {
  if (!('memory' in performance)) {
    return null;
  }

  const memory = (performance as any).memory;
  const usedJSHeapSize = memory.usedJSHeapSize / (1024 * 1024);
  const totalJSHeapSize = memory.totalJSHeapSize / (1024 * 1024);
  const jsHeapSizeLimit = memory.jsHeapSizeLimit / (1024 * 1024);

  // Estimate bridge references by counting global references
  let estimatedBridgeReferences = 0;
  try {
    if (typeof window !== 'undefined') {
      // Check for common bridge-related global properties
      if ('webkit' in window) estimatedBridgeReferences++;
      if ('webViewBridge' in window) estimatedBridgeReferences++;
      if ('bridge' in window) estimatedBridgeReferences++;
    }
  } catch (error) {
    // Silently handle errors in bridge reference counting
  }

  // Determine pressure level
  let pressureLevel: MemoryMetrics['pressureLevel'] = 'low';
  if (usedJSHeapSize > 100) { // 100MB critical threshold
    pressureLevel = 'critical';
  } else if (usedJSHeapSize > 50) { // 50MB warning threshold
    pressureLevel = 'high';
  } else if (usedJSHeapSize > 35) { // 35MB medium threshold
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
}

/**
 * React hook that integrates bridge memory management with component lifecycle
 * This provides the main integration point for React components
 */
export function useBridgeMemoryManager() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Set up memory pressure callback integration
  useEffect(() => {
    const cleanup = bridgeMemoryManager.addMemoryPressureCallback(
      (metrics, activeCallbacks) => {
        console.log('[useBridgeMemoryManager] Memory pressure detected:', {
          pressure: metrics.pressureLevel,
          usage: `${metrics.usedJSHeapSize.toFixed(1)}MB`,
          activeCallbacks: activeCallbacks.length,
          bridgeReferences: metrics.estimatedBridgeReferences
        });

        // Additional cleanup logic can be added here
        if (metrics.pressureLevel === 'critical' && activeCallbacks.length > 20) {
          console.warn('[useBridgeMemoryManager] High callback count during critical memory pressure, triggering aggressive cleanup');
          bridgeMemoryManager.cleanupBridgeCallbacks();
        }
      }
    );

    return cleanup;
  }, []);

  // Set up memory monitoring
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const metrics = getCurrentMemoryMetrics();
      if (metrics && (metrics.pressureLevel === 'high' || metrics.pressureLevel === 'critical')) {
        bridgeMemoryManager.notifyMemoryPressure(metrics);
      }
    }, 10000); // Check every 10 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    registerCallback: bridgeMemoryManager.registerBridgeCallback.bind(bridgeMemoryManager),
    unregisterCallback: bridgeMemoryManager.unregisterBridgeCallback.bind(bridgeMemoryManager),
    cleanupAll: bridgeMemoryManager.cleanupBridgeCallbacks.bind(bridgeMemoryManager),
    getStats: bridgeMemoryManager.getCleanupStats.bind(bridgeMemoryManager),
    addMemoryPressureCallback: bridgeMemoryManager.addMemoryPressureCallback.bind(bridgeMemoryManager)
  };
}

// Re-export for easier imports
export { bridgeMemoryManager as memoryManager };