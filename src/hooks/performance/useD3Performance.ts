/**
 * D3 Performance Monitoring Hook
 *
 * Provides visualization-specific performance tracking for D3 components
 * including frame rate monitoring, render time tracking, memory usage,
 * and integration with DataFlowMonitor.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface D3PerformanceMetrics {
  currentFps: number;
  averageFps: number;
  renderTime: number;
  memoryUsage: number;
  nodeCount: number;
  isPerformant: boolean;
}

interface PerformanceState {
  frameCount: number;
  lastFrameTime: number;
  fpsHistory: number[];
  renderTimeHistory: number[];
  lastRenderStart: number;
  memoryBaseline: number;
}

const FPS_HISTORY_SIZE = 60; // 1 second at 60fps
const RENDER_TIME_HISTORY_SIZE = 30;
const PERFORMANCE_THRESHOLD_FPS = 30;
const PERFORMANCE_THRESHOLD_RENDER_MS = 16; // 16ms for 60fps

/**
 * Hook for monitoring D3 visualization performance
 */
export function useD3Performance(target?: SVGElement | HTMLElement): D3PerformanceMetrics {
  const [metrics, setMetrics] = useState<D3PerformanceMetrics>({
    currentFps: 0,
    averageFps: 0,
    renderTime: 0,
    memoryUsage: 0,
    nodeCount: 0,
    isPerformant: true
  });

  const stateRef = useRef<PerformanceState>({
    frameCount: 0,
    lastFrameTime: performance.now(),
    fpsHistory: [],
    renderTimeHistory: [],
    lastRenderStart: 0,
    memoryBaseline: 0
  });

  const animationFrameRef = useRef<number>();

  // Initialize memory baseline
  useEffect(() => {
    if ('memory' in performance && (performance as any).memory) {
      stateRef.current.memoryBaseline = (performance as any).memory.usedJSHeapSize;
    }
  }, []);

  // Start render time tracking
  const startRenderTracking = useCallback(() => {
    stateRef.current.lastRenderStart = performance.now();
  }, []);

  // End render time tracking
  const endRenderTracking = useCallback(() => {
    if (stateRef.current.lastRenderStart === 0) return;

    const renderTime = performance.now() - stateRef.current.lastRenderStart;
    const state = stateRef.current;

    // Update render time history
    state.renderTimeHistory.push(renderTime);
    if (state.renderTimeHistory.length > RENDER_TIME_HISTORY_SIZE) {
      state.renderTimeHistory.shift();
    }

    // Reset tracking
    state.lastRenderStart = 0;

    // Update metrics if we have enough data
    if (state.renderTimeHistory.length > 5) {
      const avgRenderTime = state.renderTimeHistory.reduce((sum, time) => sum + time, 0)
        / state.renderTimeHistory.length;

      setMetrics(prev => ({
        ...prev,
        renderTime: avgRenderTime,
        isPerformant: prev.averageFps >= PERFORMANCE_THRESHOLD_FPS && avgRenderTime <= PERFORMANCE_THRESHOLD_RENDER_MS
      }));
    }
  }, []);

  // FPS monitoring loop
  const monitorFPS = useCallback(() => {
    const now = performance.now();
    const state = stateRef.current;

    state.frameCount++;
    const deltaTime = now - state.lastFrameTime;

    if (deltaTime >= 1000) { // Update every second
      const currentFps = Math.round((state.frameCount * 1000) / deltaTime);

      // Update FPS history
      state.fpsHistory.push(currentFps);
      if (state.fpsHistory.length > FPS_HISTORY_SIZE) {
        state.fpsHistory.shift();
      }

      // Calculate average FPS
      const avgFps = state.fpsHistory.reduce((sum, fps) => sum + fps, 0) / state.fpsHistory.length;

      // Get memory usage
      let memoryUsage = 0;
      if ('memory' in performance && (performance as any).memory) {
        const memory = (performance as any).memory;
        memoryUsage = (memory.usedJSHeapSize - state.memoryBaseline) / (1024 * 1024); // MB
      }

      // Count nodes in target element
      let nodeCount = 0;
      if (target) {
        const nodes = target.querySelectorAll('circle, rect, path, line, text, g[data-node]');
        nodeCount = nodes.length;
      }

      // Update metrics
      setMetrics(prev => ({
        currentFps,
        averageFps: avgFps,
        renderTime: prev.renderTime,
        memoryUsage,
        nodeCount,
        isPerformant: avgFps >= PERFORMANCE_THRESHOLD_FPS && prev.renderTime <= PERFORMANCE_THRESHOLD_RENDER_MS
      }));

      // Reset for next measurement
      state.frameCount = 0;
      state.lastFrameTime = now;
    }

    // Continue monitoring
    animationFrameRef.current = requestAnimationFrame(monitorFPS);
  }, [target]);

  // Start monitoring when target is available
  useEffect(() => {
    if (target) {
      // Reset state
      stateRef.current = {
        frameCount: 0,
        lastFrameTime: performance.now(),
        fpsHistory: [],
        renderTimeHistory: [],
        lastRenderStart: 0,
        memoryBaseline: stateRef.current.memoryBaseline
      };

      // Start monitoring
      animationFrameRef.current = requestAnimationFrame(monitorFPS);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [target, monitorFPS]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Expose render tracking methods for D3 components
  useEffect(() => {
    if (target) {
      // Add tracking methods to target element for D3 components to use
      (target as any).__d3Performance = {
        startRender: startRenderTracking,
        endRender: endRenderTracking
      };
    }

    return () => {
      if (target && (target as any).__d3Performance) {
        delete (target as any).__d3Performance;
      }
    };
  }, [target, startRenderTracking, endRenderTracking]);

  return metrics;
}

/**
 * Enhanced version that integrates with DataFlowMonitor
 */
export function useD3PerformanceWithMonitor(
  target?: SVGElement | HTMLElement,
  subscriptionId?: string
): D3PerformanceMetrics & {
  reportToMonitor: (additionalData?: Record<string, unknown>) => void;
} {
  const baseMetrics = useD3Performance(target);

  const reportToMonitor = useCallback((additionalData?: Record<string, unknown>) => {
    if (subscriptionId) {
      // Dispatch custom event for DataFlowMonitor
      window.dispatchEvent(new CustomEvent('d3-performance-update', {
        detail: {
          subscriptionId,
          performance: {
            ...baseMetrics,
            timestamp: Date.now(),
            ...additionalData
          }
        }
      }));
    }
  }, [subscriptionId, baseMetrics]);

  // Auto-report every 5 seconds
  useEffect(() => {
    if (subscriptionId) {
      const interval = setInterval(() => {
        reportToMonitor();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [subscriptionId, reportToMonitor]);

  return {
    ...baseMetrics,
    reportToMonitor
  };
}

export default useD3Performance;