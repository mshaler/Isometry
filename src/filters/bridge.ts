/**
 * React Filter Bridge Integration
 *
 * Provides seamless integration between React FilterContext and native SQLite database
 * through WebView bridge messaging. Supports real-time filter synchronization with
 * debouncing, error handling, and performance monitoring.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { FilterState, CompiledQuery } from '../types/filter';
import type { Node } from '../types/node';
import { compileFilters } from './compiler';

// Use existing bridge types without redeclaring Window interface

// TypeScript interfaces for bridge communication
interface FilterExecuteParams {
  sql: string;
  params: (string | number | boolean | null)[];
  limit?: number;
  offset?: number;
  sequenceId?: string;
}

interface FilterExecuteResult {
  success: boolean;
  results: Node[];
  count: number;
  duration?: number;
  sequenceId?: string;
}

interface FilterStatistics {
  cacheHitRate: number;
  averageQueryTime: number;
  totalQueries: number;
  commonPatterns: string[];
}

interface BridgeFilterState {
  filteredNodes: Node[];
  isLoading: boolean;
  error: string | null;
  lastSequenceId: string | null;
  statistics?: FilterStatistics;
}

// Bridge error types
export class BridgeFilterError extends Error {
  constructor(message: string, public code: string = 'BRIDGE_ERROR') {
    super(message);
    this.name = 'BridgeFilterError';
  }
}

// Bridge availability detection
export function isBridgeAvailable(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    window._isometryBridge?.environment?.isNative &&
    window._isometryBridge?.sendMessage
  );
}

/**
 * Core FilterBridge class for managing React to native filter communication
 */
export class FilterBridge {
  private sequenceCounter: number = 0;
  private pendingRequests: Map<string, AbortController> = new Map();
  private cache: Map<string, FilterExecuteResult> = new Map();
  private readonly cacheMaxSize = 50;
  private readonly requestTimeout = 30000; // 30 seconds

  /**
   * Generate unique sequence ID for request correlation
   */
  private generateSequenceId(): string {
    return `filter_${++this.sequenceCounter}_${Date.now()}`;
  }

  /**
   * Create cache key from filter parameters
   */
  private createCacheKey(sql: string, params: any[]): string {
    return `${sql}:${JSON.stringify(params)}`;
  }

  /**
   * Execute filter query with caching and error handling
   */
  async executeFilter(
    filters: FilterState,
    options: { limit?: number; offset?: number } = {}
  ): Promise<FilterExecuteResult> {
    if (!isBridgeAvailable()) {
      throw new BridgeFilterError('Bridge not available', 'BRIDGE_UNAVAILABLE');
    }

    // Compile filters to SQL
    const compiled: CompiledQuery = compileFilters(filters);
    if (!compiled.sql || compiled.sql.trim() === '') {
      // Return empty result for empty filters
      return {
        success: true,
        results: [],
        count: 0,
        duration: 0
      };
    }

    const { limit = 1000, offset = 0 } = options;
    const cacheKey = this.createCacheKey(compiled.sql, compiled.params);

    // Check cache first (only for first page)
    if (offset === 0 && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return { ...cached, duration: 0 }; // Cache hit
    }

    const sequenceId = this.generateSequenceId();
    const controller = new AbortController();
    this.pendingRequests.set(sequenceId, controller);

    try {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.requestTimeout);

      // Execute filter via bridge
      const params: FilterExecuteParams = {
        sql: compiled.sql,
        params: compiled.params,
        limit,
        offset,
        sequenceId
      };

      const startTime = performance.now();
      const result = await window._isometryBridge!.sendMessage('filters', 'executeFilter', params) as FilterExecuteResult;
      const duration = performance.now() - startTime;

      clearTimeout(timeoutId);

      if (controller.signal.aborted) {
        throw new BridgeFilterError('Request was cancelled', 'REQUEST_CANCELLED');
      }

      if (!result.success) {
        throw new BridgeFilterError('Filter execution failed on native side', 'EXECUTION_FAILED');
      }

      // Update cache for successful first page results
      if (offset === 0 && result.results.length > 0) {
        this.updateCache(cacheKey, { ...result, duration });
      }

      return { ...result, duration };

    } catch (error) {
      if (error instanceof BridgeFilterError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new BridgeFilterError('Filter request timed out', 'TIMEOUT');
      }

      throw new BridgeFilterError(
        `Bridge communication failed: ${(error as Error).message}`,
        'BRIDGE_COMMUNICATION_ERROR'
      );
    } finally {
      this.pendingRequests.delete(sequenceId);
    }
  }

  /**
   * Get filter performance statistics
   */
  async getStatistics(): Promise<FilterStatistics | null> {
    if (!isBridgeAvailable()) {
      return null;
    }

    try {
      return await window._isometryBridge!.sendMessage('filters', 'getFilterStatistics', {}) as FilterStatistics;
    } catch (error) {
      console.warn('Failed to get filter statistics:', error);
      return null;
    }
  }

  /**
   * Cancel all pending filter requests
   */
  async cancelPendingRequests(): Promise<void> {
    // Cancel local requests
    for (const [, controller] of this.pendingRequests) {
      controller.abort();
    }
    this.pendingRequests.clear();

    // Cancel native requests if bridge is available
    if (isBridgeAvailable()) {
      try {
        await window._isometryBridge!.sendMessage('filters', 'cancelPendingRequests', {});
      } catch (error) {
        console.warn('Failed to cancel native pending requests:', error);
      }
    }
  }

  /**
   * Clear filter result cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update cache with LRU eviction
   */
  private updateCache(key: string, result: FilterExecuteResult): void {
    if (this.cache.size >= this.cacheMaxSize) {
      // Remove oldest entry (first in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, result);
  }
}

/**
 * React hook for bridge-based filter execution with debouncing and state management
 */
export function useBridgeFilters(
  filters: FilterState,
  debounceMs: number = 300
): BridgeFilterState & {
  executeFilter: (overrideFilters?: FilterState) => Promise<void>;
  cancelRequests: () => Promise<void>;
  clearCache: () => void;
  bridge: FilterBridge;
} {
  const [state, setState] = useState<BridgeFilterState>({
    filteredNodes: [],
    isLoading: false,
    error: null,
    lastSequenceId: null
  });

  const bridgeRef = useRef<FilterBridge>(new FilterBridge());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Execute filter with debouncing
  const executeFilter = useCallback(async (overrideFilters?: FilterState) => {
    const targetFilters = overrideFilters || filters;

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      const result = await bridgeRef.current.executeFilter(targetFilters);

      setState(prev => ({
        ...prev,
        filteredNodes: result.results,
        isLoading: false,
        lastSequenceId: result.sequenceId || null,
        error: null
      }));

      // Update statistics if available
      const stats = await bridgeRef.current.getStatistics();
      if (stats) {
        setState(prev => ({ ...prev, statistics: stats }));
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown filter error'
      }));
    }
  }, [filters]);

  // Debounced filter execution on filter changes
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced execution
    debounceTimerRef.current = setTimeout(() => {
      executeFilter();
    }, debounceMs);

    // Cleanup on unmount or filter change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filters, executeFilter, debounceMs]);

  // Cancel requests utility
  const cancelRequests = useCallback(async () => {
    await bridgeRef.current.cancelPendingRequests();
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  // Clear cache utility
  const clearCache = useCallback(() => {
    bridgeRef.current.clearCache();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      bridgeRef.current.cancelPendingRequests();
    };
  }, []);

  return {
    ...state,
    executeFilter,
    cancelRequests,
    clearCache,
    bridge: bridgeRef.current
  };
}

/**
 * Simple hook to check bridge availability for UI feedback
 */
export function useBridgeAvailability() {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const checkAvailability = () => {
      setIsAvailable(isBridgeAvailable());
    };

    // Check immediately
    checkAvailability();

    // Listen for bridge ready event
    const handleBridgeReady = () => {
      checkAvailability();
    };

    window.addEventListener('isometry-bridge-ready', handleBridgeReady);

    return () => {
      window.removeEventListener('isometry-bridge-ready', handleBridgeReady);
    };
  }, []);

  return isAvailable;
}

// Legacy compatibility exports
export { FilterBridge as default };
export type { FilterExecuteParams, FilterExecuteResult, FilterStatistics };