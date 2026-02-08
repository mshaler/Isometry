import { useState, useEffect, useCallback, useMemo } from 'react';
import { connectionSuggestionService, ConnectionSuggestion, SuggestionPerformanceMetrics } from '../../services/ConnectionSuggestionService';
import { queryCacheService, CacheEffectiveness } from '../../services/QueryCacheService';
import { performanceMonitor, AnalyticsMetrics, OptimizationSuggestion } from '../../utils/performance/performance-monitor';
import { graphAnalytics, GraphMetrics, SuggestionOptions } from '../../services/GraphAnalyticsAdapter';

// Hook state interfaces
interface GraphAnalyticsState {
  suggestions: ConnectionSuggestion[];
  metrics: AnalyticsMetrics | null;
  graphMetrics: GraphMetrics | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
}

interface ConnectionSuggestionsState {
  suggestions: ConnectionSuggestion[];
  isLoading: boolean;
  error: string | null;
  confidence: number;
  hasMore: boolean;
  loadRemaining: (() => Promise<void>) | null;
}

interface GraphMetricsState {
  performance: AnalyticsMetrics | null;
  cache: CacheEffectiveness | null;
  suggestions: SuggestionPerformanceMetrics | null;
  optimizations: OptimizationSuggestion[];
  isLoading: boolean;
  error: string | null;
  lastRefresh: number;
}

// React error boundary integration
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  maxRetries: number;
}

/**
 * Comprehensive React hook for graph analytics integration with automatic
 * suggestion loading, caching, performance monitoring, and error handling
 */
export function useGraphAnalytics(nodeId?: string): GraphAnalyticsState & {
  // Actions
  refreshSuggestions: (options?: SuggestionOptions) => Promise<void>;
  trackSuggestionAccepted: (suggestionId: string) => void;
  clearCache: () => void;

  // Real-time updates
  subscribeToUpdates: (callback: (suggestions: ConnectionSuggestion[]) => void) => () => void;

  // Performance insights
  getPerformanceInsights: () => {
    cacheEfficiency: number;
    averageLatency: number;
    recommendedActions: string[];
  };
} {
  const [state, setState] = useState<GraphAnalyticsState>({
    suggestions: [],
    metrics: null,
    graphMetrics: null,
    isLoading: false,
    error: null,
    lastUpdated: 0
  });

  const [, setErrorBoundary] = useState<ErrorBoundaryState>({
    hasError: false,
    error: null,
    retryCount: 0,
    maxRetries: 3
  });

  // Memoized options to prevent unnecessary re-renders
  const defaultOptions = useMemo(() => ({
    maxSuggestions: 10,
    minConfidence: 0.3,
    excludeExistingConnections: true
  }), []);

  // Load suggestions with error handling and retry logic
  const loadSuggestions = useCallback(async (options: SuggestionOptions = defaultOptions) => {
    if (!nodeId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const startTime = performance.now();

      // Load suggestions with performance tracking
      const suggestions = await connectionSuggestionService.suggestConnections(nodeId, options);
      const latency = performance.now() - startTime;

      // Track performance
      graphPerformanceMonitor.trackSuggestionLatency(nodeId, latency, suggestions.length);

      setState(prev => ({
        ...prev,
        suggestions,
        isLoading: false,
        lastUpdated: Date.now()
      }));

      // Reset error boundary on success
      setErrorBoundary(prev => ({ ...prev, hasError: false, error: null, retryCount: 0 }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));

      // Error boundary logic
      setErrorBoundary(prev => {
        const newRetryCount = prev.retryCount + 1;

        if (newRetryCount < prev.maxRetries) {
          // Automatic retry with exponential backoff
          setTimeout(() => {
            loadSuggestions(options);
          }, Math.pow(2, newRetryCount) * 1000);
        }

        return {
          hasError: true,
          error: error instanceof Error ? error : new Error(errorMessage),
          retryCount: newRetryCount,
          maxRetries: prev.maxRetries
        };
      });
    }
  }, [nodeId, defaultOptions]);

  // Load analytics metrics
  const loadMetrics = useCallback(async () => {
    try {
      const [analyticsMetrics, graphMetrics] = await Promise.all([
        graphPerformanceMonitor.getAnalyticsMetrics(),
        graphAnalytics.getGraphMetrics()
      ]);

      setState(prev => ({
        ...prev,
        metrics: analyticsMetrics,
        graphMetrics
      }));

    } catch (error) {
      console.warn('Failed to load graph metrics:', error);
    }
  }, []);

  // Refresh suggestions
  const refreshSuggestions = useCallback(async (options?: SuggestionOptions) => {
    await loadSuggestions({ ...defaultOptions, ...options });
  }, [loadSuggestions, defaultOptions]);

  // Track suggestion acceptance for accuracy metrics
  const trackSuggestionAccepted = useCallback((suggestionId: string) => {
    if (nodeId) {
      connectionSuggestionService.trackSuggestionAccepted(nodeId, suggestionId);
    }
  }, [nodeId]);

  // Clear all caches
  const clearCache = useCallback(() => {
    queryCacheService.clear();
    // Also trigger cache refresh
    if (nodeId) {
      loadSuggestions();
    }
  }, [nodeId, loadSuggestions]);

  // Subscribe to real-time updates
  const subscribeToUpdates = useCallback((
    callback: (suggestions: ConnectionSuggestion[]) => void
  ) => {
    return connectionSuggestionService.subscribe((suggestions: ConnectionSuggestion[], subscribedNodeId: string) => {
      if (!nodeId || subscribedNodeId === nodeId) {
        callback(suggestions);

        // Update local state if this is for current node
        if (subscribedNodeId === nodeId) {
          setState(prev => ({
            ...prev,
            suggestions,
            lastUpdated: Date.now()
          }));
        }
      }
    });
  }, [nodeId]);

  // Performance insights
  const getPerformanceInsights = useCallback(() => {
    const metrics = state.metrics;
    if (!metrics) {
      return {
        cacheEfficiency: 0,
        averageLatency: 0,
        recommendedActions: ['Load analytics data first']
      };
    }

    const cacheEfficiency = metrics.cacheHitRate.overall;
    const averageLatency = metrics.suggestionLatency.average;
    const recommendedActions: string[] = [];

    if (cacheEfficiency < 0.8) {
      recommendedActions.push('Increase cache TTL or pre-warm frequently accessed data');
    }

    if (averageLatency > 100) {
      recommendedActions.push('Enable background pre-computation for suggestions');
    }

    if (metrics.memoryUsage.totalMB > 50) {
      recommendedActions.push('Enable cache compression or reduce cache size');
    }

    return {
      cacheEfficiency,
      averageLatency,
      recommendedActions
    };
  }, [state.metrics]);

  // Load initial data
  useEffect(() => {
    if (nodeId) {
      loadSuggestions();
    }
    loadMetrics();

    // Set up periodic metrics refresh
    const metricsInterval = setInterval(loadMetrics, 30000); // Every 30 seconds

    return () => {
      clearInterval(metricsInterval);
    };
  }, [nodeId, loadSuggestions, loadMetrics]);

  // Graph change listener for cache invalidation
  useEffect(() => {
    // In a real implementation, this would listen to graph mutation events
    // TODO: Implement graph change listener for cache invalidation
    // Would refresh suggestions when related graph changes occur

    return () => {
      // Cleanup listener
    };
  }, [nodeId, loadSuggestions]);

  return {
    ...state,
    refreshSuggestions,
    trackSuggestionAccepted,
    clearCache,
    subscribeToUpdates,
    getPerformanceInsights
  };
}

/**
 * Specialized hook for connection suggestions with progressive loading
 * and confidence-based filtering
 */
export function useConnectionSuggestions(
  nodeId: string,
  options: SuggestionOptions = {}
): ConnectionSuggestionsState & {
  refreshSuggestions: () => Promise<void>;
  loadHighConfidence: () => Promise<void>;
  filterByConfidence: (minConfidence: number) => ConnectionSuggestion[];
  acceptSuggestion: (suggestionId: string) => void;
} {
  const [state, setState] = useState<ConnectionSuggestionsState>({
    suggestions: [],
    isLoading: false,
    error: null,
    confidence: options.minConfidence || 0.3,
    hasMore: false,
    loadRemaining: null
  });

  // Memoized options
  const memoizedOptions = useMemo(() => ({
    maxSuggestions: 10,
    minConfidence: 0.3,
    excludeExistingConnections: true,
    ...options
  }), [options]);

  // Progressive loading implementation
  const loadSuggestionsProgressive = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await connectionSuggestionService.progressiveLoad(nodeId, memoizedOptions);

      setState(prev => ({
        ...prev,
        suggestions: result.highConfidence,
        isLoading: false,
        hasMore: true,
        loadRemaining: async () => {
          const remaining = await result.loadRemaining();
          setState(current => ({
            ...current,
            suggestions: [...current.suggestions, ...remaining],
            hasMore: false,
            loadRemaining: null
          }));
        }
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load suggestions';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        hasMore: false,
        loadRemaining: null
      }));
    }
  }, [nodeId, memoizedOptions]);

  // Load high confidence suggestions only
  const loadHighConfidence = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const highConfidenceOptions = {
        ...memoizedOptions,
        minConfidence: Math.max(memoizedOptions.minConfidence || 0.3, 0.7),
        maxSuggestions: Math.min(memoizedOptions.maxSuggestions || 10, 5)
      };

      const suggestions = await connectionSuggestionService.suggestConnections(nodeId, highConfidenceOptions);

      setState(prev => ({
        ...prev,
        suggestions,
        isLoading: false,
        hasMore: false,
        loadRemaining: null
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load high confidence suggestions'
      }));
    }
  }, [nodeId, memoizedOptions]);

  // Filter suggestions by confidence threshold
  const filterByConfidence = useCallback((minConfidence: number): ConnectionSuggestion[] => {
    return state.suggestions.filter(suggestion => suggestion.confidence >= minConfidence);
  }, [state.suggestions]);

  // Accept suggestion and track for accuracy
  const acceptSuggestion = useCallback((suggestionId: string) => {
    connectionSuggestionService.trackSuggestionAccepted(nodeId, suggestionId);
  }, [nodeId]);

  // Refresh suggestions
  const refreshSuggestions = useCallback(async () => {
    await loadSuggestionsProgressive();
  }, [loadSuggestionsProgressive]);

  // Initial load
  useEffect(() => {
    loadSuggestionsProgressive();
  }, [loadSuggestionsProgressive]);

  return {
    ...state,
    refreshSuggestions,
    loadHighConfidence,
    filterByConfidence,
    acceptSuggestion
  };
}

/**
 * Hook for comprehensive graph metrics and performance monitoring
 * with real-time updates and optimization recommendations
 */
export function useGraphMetrics(): GraphMetricsState & {
  refreshMetrics: () => Promise<void>;
  exportMetrics: () => Promise<Record<string, unknown>>;
  getOptimizationPriority: () => OptimizationSuggestion[];
  enableRealTimeMonitoring: () => () => void;
} {
  const [state, setState] = useState<GraphMetricsState>({
    performance: null,
    cache: null,
    suggestions: null,
    optimizations: [],
    isLoading: false,
    error: null,
    lastRefresh: 0
  });

  // Load comprehensive metrics
  const loadMetrics = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [performance, cache, suggestions, optimizations] = await Promise.all([
        graphPerformanceMonitor.getAnalyticsMetrics(),
        queryCacheService.getCacheEffectiveness(),
        connectionSuggestionService.getPerformanceMetrics(),
        graphPerformanceMonitor.generateOptimizationSuggestions()
      ]);

      setState(prev => ({
        ...prev,
        performance,
        cache,
        suggestions,
        optimizations,
        isLoading: false,
        lastRefresh: Date.now()
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load metrics'
      }));
    }
  }, []);

  // Export metrics for analysis
  const exportMetrics = useCallback(async () => {
    const exported = graphPerformanceMonitor.exportMetrics();
    return {
      ...exported,
      cache: await queryCacheService.getStats(),
      suggestions: connectionSuggestionService.getPerformanceMetrics()
    };
  }, []);

  // Get optimization suggestions sorted by priority
  const getOptimizationPriority = useCallback((): OptimizationSuggestion[] => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return [...state.optimizations].sort((a, b) =>
      priorityOrder[b.priority] - priorityOrder[a.priority]
    );
  }, [state.optimizations]);

  // Enable real-time monitoring
  const enableRealTimeMonitoring = useCallback(() => {
    const interval = setInterval(loadMetrics, 5000); // Every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }, [loadMetrics]);

  // Refresh metrics
  const refreshMetrics = useCallback(async () => {
    await loadMetrics();
  }, [loadMetrics]);

  // Initial load
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return {
    ...state,
    refreshMetrics,
    exportMetrics,
    getOptimizationPriority,
    enableRealTimeMonitoring
  };
}

/**
 * Development mode hook for debugging graph analytics state
 * with React DevTools integration
 */
interface GraphAnalyticsDebugInfo {
  cacheStats: {
    entries?: number;
    memoryUsageMB?: number;
    hitRate?: number;
    averageResponseTime?: number;
    operationsInFlight?: number;
  };
  performanceHistory: {
    suggestionLatencyTrend?: number[];
    cacheHitRateTrend?: number[];
    memoryUsageTrend?: number[];
    throughputTrend?: number[];
  };
  errorLogs: any[];
  operationsInFlight: number;
}

export function useGraphAnalyticsDebug() {
  const [debugInfo, setDebugInfo] = useState<GraphAnalyticsDebugInfo>({
    cacheStats: {},
    performanceHistory: {},
    errorLogs: [],
    operationsInFlight: 0
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const updateDebugInfo = async () => {
      try {
        const [cacheStats, performanceHistory] = await Promise.all([
          queryCacheService.getStats(),
          graphPerformanceMonitor.getPerformanceTrends()
        ]);

        setDebugInfo(prev => ({
          ...prev,
          cacheStats,
          performanceHistory,
          operationsInFlight: Object.keys(cacheStats).length
        }));

      } catch (error) {
        console.warn('Debug info update failed:', error);
      }
    };

    const interval = setInterval(updateDebugInfo, 2000);
    updateDebugInfo(); // Initial load

    // Expose debug info to window for React DevTools
    if (typeof window !== 'undefined') {
      (window as unknown as { __GRAPH_DEBUG: unknown }).__GRAPH_DEBUG = debugInfo;
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        delete (window as unknown as { __GRAPH_DEBUG?: unknown }).__GRAPH_DEBUG;
      }
    };
  }, [debugInfo]);

  return debugInfo;
}