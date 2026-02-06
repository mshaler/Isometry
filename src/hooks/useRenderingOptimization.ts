/**
 * React Hook for Rendering Optimization
 *
 * Provides real-time rendering optimization for D3 canvas components
 * Integrates with native bridge for maximum performance
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  renderingPerformanceMonitor,
  viewportOptimizer,
  memoryUsageTracker,
  batchingOptimizer,
  type Viewport,
  type RenderingMetrics,
  type OptimizationStrategy,
  type PerformanceAlert,
  type LODConfiguration,
  type MemoryMetrics
} from '../utils/rendering-performance';
import { Environment, webViewBridge } from '../utils/webview-bridge';

// ============================================================================
// Types
// ============================================================================

export interface RenderingOptimizationConfig {
  viewport: Viewport;
  nodeCount: number;
  targetFPS: number;
  enableAutoOptimization: boolean;
  memoryMonitoring: boolean;
  performanceAlerting: boolean;
}

export interface OptimizationPlan {
  strategy: OptimizationStrategy;
  cullingBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  lodConfig: LODConfiguration;
  memoryStrategy: string;
  estimatedPerformance: {
    expectedFPS: number;
    memoryReduction: number;
    renderingLoad: number;
  };
}

export interface RenderingOptimizationState {
  // Current optimization settings
  optimizedViewport: Viewport;
  lodLevel: number;
  shouldBatch: boolean;
  memoryStrategy: string;

  // Performance metrics
  performanceMetrics: RenderingMetrics;
  alerts: PerformanceAlert[];

  // Optimization status
  isOptimizing: boolean;
  bridgeConnected: boolean;
  lastOptimizationTime: number;

  // Memory monitoring
  memoryMetrics: MemoryMetrics | null;
  memoryPressure: number;
}

export interface RenderingOptimizationActions {
  // Optimization control
  optimizeForDataset: (nodes: any[]) => Promise<OptimizationPlan>;
  updateViewport: (viewport: Partial<Viewport>) => void;
  setTargetFPS: (fps: number) => void;

  // Performance monitoring
  recordFrame: (renderTime: number) => void;
  recordMemoryUsage: () => MemoryMetrics | null;
  clearAlerts: () => void;

  // Optimization actions
  applyOptimizations: (plan: OptimizationPlan) => void;
  resetOptimizations: () => void;
  forceGarbageCollection: () => boolean;

  // Bridge integration
  getBenchmarkResults: () => Promise<RenderingMetrics>;
  getOptimizationRecommendations: () => Promise<string[]>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useRenderingOptimization(config: RenderingOptimizationConfig): RenderingOptimizationState & RenderingOptimizationActions {

  // ========================================================================
  // State
  // ========================================================================

  const [state, setState] = useState<RenderingOptimizationState>(() => ({
    optimizedViewport: config.viewport,
    lodLevel: 1,
    shouldBatch: config.nodeCount > 100,
    memoryStrategy: 'balanced',

    performanceMetrics: {
      frameRate: 0,
      renderTime: 0,
      memoryUsage: 0,
      culledElements: 0,
      renderedElements: 0,
      lodLevel: 1,
      gpuUtilization: 0,
      performance60FPS: false
    },
    alerts: [],

    isOptimizing: false,
    bridgeConnected: Environment.isWebView() && !!(window as any)._isometryBridge?.d3rendering,
    lastOptimizationTime: 0,

    memoryMetrics: null,
    memoryPressure: 0
  }));

  // ========================================================================
  // Refs
  // ========================================================================

  const configRef = useRef(config);
  const optimizationTimeoutRef = useRef<number | null>(null);
  const performanceIntervalRef = useRef<number | null>(null);

  // ========================================================================
  // Effects
  // ========================================================================

  // Update config ref
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Start performance monitoring
  useEffect(() => {
    if (config.performanceAlerting || config.memoryMonitoring) {
      renderingPerformanceMonitor.startMonitoring();

      if (config.memoryMonitoring) {
        memoryUsageTracker.startMonitoring(5000, (metrics) => {
          if (metrics.leakDetected) {
            setState(prev => ({
              ...prev,
              alerts: [...prev.alerts, {
                type: 'memory',
                severity: 'high',
                message: 'Memory leak detected',
                recommendation: 'Consider calling forceGarbageCollection()',
                timestamp: Date.now()
              }]
            }));
          }
        });
      }

      // Start performance metrics polling
      performanceIntervalRef.current = window.setInterval(() => {
        const metrics = renderingPerformanceMonitor.getCurrentMetrics();
        const alerts = renderingPerformanceMonitor.getAlerts();
        const memoryMetrics = memoryUsageTracker.getCurrentMemoryMetrics();

        setState(prev => ({
          ...prev,
          performanceMetrics: metrics,
          alerts,
          memoryMetrics,
          memoryPressure: memoryMetrics
            ? Math.min(1, memoryMetrics.usedJSHeapSize / memoryMetrics.jsHeapSizeLimit)
            : 0
        }));
      }, 1000);
    }

    return () => {
      renderingPerformanceMonitor.stopMonitoring();
      memoryUsageTracker.stopMonitoring();

      if (performanceIntervalRef.current) {
        clearInterval(performanceIntervalRef.current);
      }
    };
  }, [config.performanceAlerting, config.memoryMonitoring]);

  // Auto-optimization based on performance
  useEffect(() => {
    if (!config.enableAutoOptimization) return;

    const { frameRate, renderTime } = state.performanceMetrics;

    // Trigger optimization if performance degrades
    if (frameRate < config.targetFPS * 0.8 || renderTime > 20) {
      if (Date.now() - state.lastOptimizationTime > 5000) { // Debounce 5 seconds
        triggerAutoOptimization();
      }
    }
  }, [state.performanceMetrics, config.enableAutoOptimization, config.targetFPS]);

  // ========================================================================
  // Actions
  // ========================================================================

  const optimizeForDataset = useCallback(async (nodes: any[]): Promise<OptimizationPlan> => {
    setState(prev => ({ ...prev, isOptimizing: true }));

    try {
      const strategy = await viewportOptimizer.optimizeForDataset(
        configRef.current.viewport,
        nodes.length,
        configRef.current.targetFPS
      );

      const cullingBounds = viewportOptimizer.calculateCullingBounds(
        configRef.current.viewport,
        0.2 // 20% margin
      );

      // Get LOD configuration from native bridge if available
      let lodConfig: LODConfiguration = {
        level: strategy.lodLevel,
        simplificationRatio: 1.0 - (strategy.lodLevel * 0.25),
        renderDistance: 1.0,
        elementThreshold: nodes.length
      };

      if (state.bridgeConnected) {
        try {
          const lodResult = await webViewBridge.d3rendering.updateLOD({
            zoomLevel: configRef.current.viewport.scale,
            nodeCount: nodes.length
          });
          lodConfig = lodResult.lodConfiguration;
        } catch (error) {
          console.warn('Failed to get native LOD configuration:', error);
        }
      }

      const optimizationPlan: OptimizationPlan = {
        strategy,
        cullingBounds,
        lodConfig,
        memoryStrategy: strategy.memoryStrategy,
        estimatedPerformance: {
          expectedFPS: estimatePerformance(strategy, nodes.length),
          memoryReduction: estimateMemoryReduction(strategy),
          renderingLoad: estimateRenderingLoad(strategy, nodes.length)
        }
      };

      setState(prev => ({
        ...prev,
        isOptimizing: false,
        lastOptimizationTime: Date.now()
      }));

      return optimizationPlan;

    } catch (error) {
      console.error('Optimization failed:', error);
      setState(prev => ({ ...prev, isOptimizing: false }));
      throw error;
    }
  }, [state.bridgeConnected]);

  const updateViewport = useCallback((viewportUpdate: Partial<Viewport>) => {
    const newViewport = { ...state.optimizedViewport, ...viewportUpdate };

    setState(prev => ({
      ...prev,
      optimizedViewport: newViewport
    }));

    // Debounced re-optimization
    if (optimizationTimeoutRef.current) {
      clearTimeout(optimizationTimeoutRef.current);
    }

    optimizationTimeoutRef.current = window.setTimeout(() => {
      if (configRef.current.enableAutoOptimization) {
        triggerAutoOptimization();
      }
    }, 250);
  }, [state.optimizedViewport]);

  const setTargetFPS = useCallback((fps: number) => {
    configRef.current = { ...configRef.current, targetFPS: fps };

    if (configRef.current.enableAutoOptimization) {
      triggerAutoOptimization();
    }
  }, []);

  const recordFrame = useCallback((renderTime: number) => {
    renderingPerformanceMonitor.recordFrame(renderTime);
  }, []);

  const recordMemoryUsage = useCallback(() => {
    const metrics = renderingPerformanceMonitor.recordMemoryUsage();

    if (metrics) {
      setState(prev => ({
        ...prev,
        memoryMetrics: metrics,
        memoryPressure: Math.min(1, metrics.usedJSHeapSize / metrics.jsHeapSizeLimit)
      }));
    }

    return metrics;
  }, []);

  const clearAlerts = useCallback(() => {
    renderingPerformanceMonitor.clearAlerts();
    setState(prev => ({ ...prev, alerts: [] }));
  }, []);

  const applyOptimizations = useCallback((plan: OptimizationPlan) => {
    setState(prev => ({
      ...prev,
      lodLevel: plan.lodConfig.level,
      shouldBatch: plan.strategy.batchSize > 50,
      memoryStrategy: plan.memoryStrategy,
      optimizedViewport: prev.optimizedViewport // Keep current viewport
    }));

    console.log('🎯 Applied optimization plan:', plan);
  }, []);

  const resetOptimizations = useCallback(() => {
    setState(prev => ({
      ...prev,
      lodLevel: 0,
      shouldBatch: false,
      memoryStrategy: 'normal',
      optimizedViewport: configRef.current.viewport
    }));

    console.log('🔄 Reset optimizations to defaults');
  }, []);

  const forceGarbageCollection = useCallback(() => {
    const success = memoryUsageTracker.forceGarbageCollection();

    // Clear batch operations to free memory
    batchingOptimizer.clearBatch();

    // Record memory after GC
    setTimeout(() => {
      recordMemoryUsage();
    }, 100);

    return success;
  }, [recordMemoryUsage]);

  const getBenchmarkResults = useCallback(async (): Promise<RenderingMetrics> => {
    if (state.bridgeConnected) {
      try {
        const result = await webViewBridge.d3rendering.getBenchmarkResults({});
        const report = result.performanceReport as any;
        // Ensure the bridge report has all required RenderingMetrics properties
        return {
          frameRate: report.frameRate || 0,
          renderTime: report.renderTime || 0,
          memoryUsage: report.memoryUsage || 0,
          culledElements: report.culledElements || 0,
          renderedElements: report.renderedElements || 0,
          lodLevel: report.lodLevel || 1,
          gpuUtilization: report.gpuUtilization || 0,
          performance60FPS: report.performance60FPS || false
        };
      } catch (error) {
        console.warn('Failed to get native benchmark results:', error);
      }
    }

    return renderingPerformanceMonitor.getCurrentMetrics();
  }, [state.bridgeConnected]);

  const getOptimizationRecommendations = useCallback(async (): Promise<string[]> => {
    if (state.bridgeConnected) {
      try {
        const result = await webViewBridge.d3rendering.getOptimizationRecommendations({});
        return result.recommendations;
      } catch (error) {
        console.warn('Failed to get native optimization recommendations:', error);
      }
    }

    return generateLocalRecommendations(state.performanceMetrics, configRef.current);
  }, [state.bridgeConnected, state.performanceMetrics]);

  // ========================================================================
  // Helper Functions
  // ========================================================================

  const triggerAutoOptimization = useCallback(async () => {
    try {
      // Simple auto-optimization based on current performance
      const currentFPS = state.performanceMetrics.frameRate;
      const targetFPS = configRef.current.targetFPS;

      if (currentFPS < targetFPS * 0.8) {
        // Performance is poor, increase optimizations
        setState(prev => ({
          ...prev,
          lodLevel: Math.min(prev.lodLevel + 1, 3),
          shouldBatch: true,
          memoryStrategy: prev.memoryStrategy === 'normal' ? 'balanced' :
                        prev.memoryStrategy === 'balanced' ? 'conservative' : 'aggressive'
        }));

        console.log('🎯 Auto-optimization: increased aggressiveness due to low FPS');
      } else if (currentFPS > targetFPS * 1.1) {
        // Performance is good, reduce optimizations for quality
        setState(prev => ({
          ...prev,
          lodLevel: Math.max(prev.lodLevel - 1, 0),
          memoryStrategy: prev.memoryStrategy === 'aggressive' ? 'conservative' :
                        prev.memoryStrategy === 'conservative' ? 'balanced' : 'normal'
        }));

        console.log('🎯 Auto-optimization: decreased aggressiveness due to high FPS');
      }

      setState(prev => ({ ...prev, lastOptimizationTime: Date.now() }));

    } catch (error) {
      console.error('Auto-optimization failed:', error);
    }
  }, [state.performanceMetrics.frameRate]);

  // ========================================================================
  // Return Hook Interface
  // ========================================================================

  return {
    // State
    ...state,

    // Actions
    optimizeForDataset,
    updateViewport,
    setTargetFPS,
    recordFrame,
    recordMemoryUsage,
    clearAlerts,
    applyOptimizations,
    resetOptimizations,
    forceGarbageCollection,
    getBenchmarkResults,
    getOptimizationRecommendations
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function estimatePerformance(strategy: OptimizationStrategy, nodeCount: number): number {
  let baseFPS = strategy.targetFPS;

  // Reduce FPS based on dataset size
  if (nodeCount > 5000) baseFPS *= 0.6;
  else if (nodeCount > 2000) baseFPS *= 0.7;
  else if (nodeCount > 1000) baseFPS *= 0.8;
  else if (nodeCount > 500) baseFPS *= 0.9;

  // Apply optimization benefits
  if (strategy.cullingEnabled) baseFPS *= 1.3;
  if (strategy.lodLevel > 0) baseFPS *= 1 + (strategy.lodLevel * 0.15);
  if (strategy.batchSize > 100) baseFPS *= 1.1;
  if (strategy.gpuAcceleration) baseFPS *= 1.2;

  return Math.min(baseFPS, strategy.targetFPS * 1.1);
}

function estimateMemoryReduction(strategy: OptimizationStrategy): number {
  let reduction = 0;

  if (strategy.cullingEnabled) reduction += 30;
  if (strategy.lodLevel > 0) reduction += strategy.lodLevel * 15;
  if (strategy.memoryStrategy === 'conservative') reduction += 20;
  else if (strategy.memoryStrategy === 'aggressive') reduction += 40;

  return Math.min(reduction, 70); // Max 70% reduction
}

function estimateRenderingLoad(strategy: OptimizationStrategy, nodeCount: number): number {
  let load = Math.min(nodeCount / 1000, 1); // Normalized load

  // Apply optimization reductions
  if (strategy.cullingEnabled) load *= 0.7;
  if (strategy.lodLevel > 0) load *= 1 - (strategy.lodLevel * 0.2);
  if (strategy.batchSize > 100) load *= 0.9;

  return Math.max(load, 0.1); // Min 10% load
}

function generateLocalRecommendations(metrics: RenderingMetrics, config: RenderingOptimizationConfig): string[] {
  const recommendations: string[] = [];

  if (!metrics.performance60FPS) {
    recommendations.push('Enable viewport culling to improve frame rate');
  }

  if (metrics.memoryUsage > 100 * 1024 * 1024) { // > 100MB
    recommendations.push('High memory usage detected - consider memory optimizations');
  }

  if (config.nodeCount > 1000 && metrics.lodLevel === 0) {
    recommendations.push('Large dataset detected - enable LOD management');
  }

  if (metrics.frameRate < config.targetFPS * 0.5) {
    recommendations.push('Poor performance - enable aggressive optimization mode');
  }

  if (recommendations.length === 0) {
    recommendations.push('Performance is optimal');
  }

  return recommendations;
}