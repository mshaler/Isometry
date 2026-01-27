import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNotebook } from '../contexts/NotebookContext';

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory: PerformanceMemory;
}

export interface PerformanceMetrics {
  renderTime: number; // ms
  memoryUsage: number; // MB
  queryTime: number; // ms
  frameRate: number; // fps
  bundleSize: number; // KB
  componentCount: number;
  reRenderCount: number;
  lastMeasurement: Date;
}

export interface OptimizationSuggestion {
  type: 'virtualization' | 'memoization' | 'debouncing' | 'lazy-loading' | 'bundle-splitting';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  implementation: string;
}

export interface PerformanceAlert {
  level: 'info' | 'warning' | 'error';
  message: string;
  metric: keyof PerformanceMetrics;
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface UseNotebookPerformanceReturn {
  metrics: PerformanceMetrics;
  suggestions: OptimizationSuggestion[];
  alerts: PerformanceAlert[];
  isMonitoring: boolean;

  // Actions
  startMonitoring: () => void;
  stopMonitoring: () => void;
  measureRender: (componentName: string, _duration: number) => void;
  measureQuery: (queryName: string, _duration: number) => void;
  clearMetrics: () => void;
  exportMetrics: () => string;

  // Performance status
  performanceScore: number; // 0-100
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  bottlenecks: string[];
}

// Performance thresholds for 60fps target
const PERFORMANCE_THRESHOLDS = {
  renderTime: 16, // 16ms for 60fps
  memoryUsage: 50, // 50MB max per component
  queryTime: 100, // 100ms max for queries
  frameRate: 55, // Minimum 55fps
  bundleSize: 2000, // 2MB max bundle size
  componentCount: 100, // Max components before virtualization
  reRenderCount: 10, // Max re-renders per second
};

/**
 * Hook for monitoring and optimizing notebook component performance
 */
export function useNotebookPerformance(componentName: string): UseNotebookPerformanceReturn {
  const { cards } = useNotebook();

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    queryTime: 0,
    frameRate: 60,
    bundleSize: 0,
    componentCount: 1,
    reRenderCount: 0,
    lastMeasurement: new Date()
  });

  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const frameTimesRef = useRef<number[]>([]);
  const renderCountRef = useRef(0);
  const queryTimesRef = useRef<Map<string, number[]>>(new Map());
  const renderTimesRef = useRef<Map<string, number[]>>(new Map());
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const performanceObserverRef = useRef<PerformanceObserver | null>(null);

  // Start performance monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);

    // Monitor frame rate
    const measureFrameRate = () => {
      const now = performance.now();
      frameTimesRef.current.push(now);

      // Keep only last 60 frames
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Calculate FPS from frame times
      if (frameTimesRef.current.length >= 2) {
        const duration = frameTimesRef.current[frameTimesRef.current.length - 1] - frameTimesRef.current[0];
        const fps = (frameTimesRef.current.length - 1) / (duration / 1000);

        setMetrics(prev => ({ ...prev, frameRate: Math.round(fps) }));

        // Alert if FPS drops below threshold
        if (fps < PERFORMANCE_THRESHOLDS.frameRate) {
          addAlert('warning', `Frame rate dropped to ${fps.toFixed(1)} fps`, 'frameRate', fps, PERFORMANCE_THRESHOLDS.frameRate);
        }
      }

      if (isMonitoring) {
        requestAnimationFrame(measureFrameRate);
      }
    };

    requestAnimationFrame(measureFrameRate);

    // Monitor memory usage
    const measureMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as PerformanceWithMemory).memory;
        const usedMB = memory.usedJSHeapSize / (1024 * 1024);

        setMetrics(prev => ({ ...prev, memoryUsage: Math.round(usedMB) }));

        if (usedMB > PERFORMANCE_THRESHOLDS.memoryUsage) {
          addAlert('error', `Memory usage is ${usedMB.toFixed(1)} MB`, 'memoryUsage', usedMB, PERFORMANCE_THRESHOLDS.memoryUsage);
        }
      }
    };

    // Monitor component count and re-renders
    const measureComponents = () => {
      renderCountRef.current++;
      const reRendersPerSecond = renderCountRef.current;

      setMetrics(prev => ({
        ...prev,
        componentCount: cards.length,
        reRenderCount: reRendersPerSecond,
        lastMeasurement: new Date()
      }));

      if (reRendersPerSecond > PERFORMANCE_THRESHOLDS.reRenderCount) {
        addAlert('warning', `High re-render rate: ${reRendersPerSecond}/sec`, 'reRenderCount', reRendersPerSecond, PERFORMANCE_THRESHOLDS.reRenderCount);
      }

      // Reset counter every second
      renderCountRef.current = 0;
    };

    // Set up periodic measurements
    monitoringIntervalRef.current = setInterval(() => {
      measureMemory();
      measureComponents();
    }, 1000);

    // Set up Performance Observer for more detailed metrics
    if ('PerformanceObserver' in window) {
      try {
        performanceObserverRef.current = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.name.includes(componentName)) {
              measureRender(entry.name, entry.duration);
            }
          }
        });

        performanceObserverRef.current.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (error) {
        console.warn('Performance Observer not fully supported:', error);
      }
    }

  }, [isMonitoring, componentName, cards.length]);

  // Stop performance monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);

    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }

    if (performanceObserverRef.current) {
      performanceObserverRef.current.disconnect();
      performanceObserverRef.current = null;
    }

    frameTimesRef.current = [];
    renderCountRef.current = 0;
  }, []);

  // Measure render performance
  const measureRender = useCallback((renderComponentName: string, _duration: number) => {
    const times = renderTimesRef.current.get(renderComponentName) || [];
    times.push(_duration);

    // Keep only last 10 measurements
    if (times.length > 10) {
      times.shift();
    }

    renderTimesRef.current.set(renderComponentName, times);

    // Update average render time
    const avgRenderTime = times.reduce((sum, time) => sum + time, 0) / times.length;

    setMetrics(prev => ({ ...prev, renderTime: Math.round(avgRenderTime) }));

    // Alert if render time exceeds threshold
    if (avgRenderTime > PERFORMANCE_THRESHOLDS.renderTime) {
      addAlert('warning', `Slow render: ${avgRenderTime.toFixed(1)}ms for ${renderComponentName}`, 'renderTime', avgRenderTime, PERFORMANCE_THRESHOLDS.renderTime);

      // In development, log detailed warning
      if (process.env.NODE_ENV === 'development') {
        console.warn(`🐌 Slow render detected in ${renderComponentName}:`, {
          duration: `${avgRenderTime.toFixed(1)}ms`,
          threshold: `${PERFORMANCE_THRESHOLDS.renderTime}ms`,
          suggestion: 'Consider memoization or virtualization'
        });
      }
    }
  }, []);

  // Measure query performance
  const measureQuery = useCallback((queryName: string, _duration: number) => {
    const times = queryTimesRef.current.get(queryName) || [];
    times.push(_duration);

    // Keep only last 5 measurements
    if (times.length > 5) {
      times.shift();
    }

    queryTimesRef.current.set(queryName, times);

    // Update average query time
    const avgQueryTime = times.reduce((sum, time) => sum + time, 0) / times.length;

    setMetrics(prev => ({ ...prev, queryTime: Math.round(avgQueryTime) }));

    // Alert if query time exceeds threshold
    if (avgQueryTime > PERFORMANCE_THRESHOLDS.queryTime) {
      addAlert('error', `Slow query: ${avgQueryTime.toFixed(1)}ms for ${queryName}`, 'queryTime', avgQueryTime, PERFORMANCE_THRESHOLDS.queryTime);

      if (process.env.NODE_ENV === 'development') {
        console.warn(`🐌 Slow query detected: ${queryName}`, {
          duration: `${avgQueryTime.toFixed(1)}ms`,
          threshold: `${PERFORMANCE_THRESHOLDS.queryTime}ms`,
          suggestion: 'Consider query optimization or indexing'
        });
      }
    }
  }, []);

  // Add performance alert
  const addAlert = useCallback((
    level: PerformanceAlert['level'],
    message: string,
    metric: keyof PerformanceMetrics,
    value: number,
    threshold: number
  ) => {
    const alert: PerformanceAlert = {
      level,
      message,
      metric,
      value,
      threshold,
      timestamp: new Date()
    };

    setAlerts(prev => {
      // Avoid duplicate alerts for same metric within 5 seconds
      const recentAlert = prev.find(a =>
        a.metric === metric &&
        Date.now() - a.timestamp.getTime() < 5000
      );

      if (recentAlert) return prev;

      const newAlerts = [...prev, alert];

      // Keep only last 20 alerts
      if (newAlerts.length > 20) {
        newAlerts.shift();
      }

      return newAlerts;
    });
  }, []);

  // Clear all metrics and alerts
  const clearMetrics = useCallback(() => {
    setMetrics({
      renderTime: 0,
      memoryUsage: 0,
      queryTime: 0,
      frameRate: 60,
      bundleSize: 0,
      componentCount: 1,
      reRenderCount: 0,
      lastMeasurement: new Date()
    });

    setAlerts([]);
    frameTimesRef.current = [];
    renderTimesRef.current.clear();
    queryTimesRef.current.clear();
  }, []);

  // Export metrics as JSON
  const exportMetrics = useCallback(() => {
    return JSON.stringify({
      component: componentName,
      metrics,
      alerts,
      timestamp: new Date().toISOString(),
      renderTimes: Object.fromEntries(renderTimesRef.current),
      queryTimes: Object.fromEntries(queryTimesRef.current)
    }, null, 2);
  }, [componentName, metrics, alerts]);

  // Calculate optimization suggestions
  const suggestions = useMemo((): OptimizationSuggestion[] => {
    const suggestions: OptimizationSuggestion[] = [];

    // Suggest virtualization for large lists
    if (metrics.componentCount > PERFORMANCE_THRESHOLDS.componentCount) {
      suggestions.push({
        type: 'virtualization',
        priority: 'high',
        description: `Large component count (${metrics.componentCount}) detected`,
        impact: 'Reduces DOM nodes and improves render performance',
        implementation: 'Use react-window or react-virtualized for list components'
      });
    }

    // Suggest memoization for slow renders
    if (metrics.renderTime > PERFORMANCE_THRESHOLDS.renderTime) {
      suggestions.push({
        type: 'memoization',
        priority: 'high',
        description: `Slow render time (${metrics.renderTime}ms) detected`,
        impact: 'Prevents unnecessary re-renders',
        implementation: 'Add React.memo, useMemo, and useCallback'
      });
    }

    // Suggest debouncing for high re-render rate
    if (metrics.reRenderCount > PERFORMANCE_THRESHOLDS.reRenderCount) {
      suggestions.push({
        type: 'debouncing',
        priority: 'medium',
        description: `High re-render rate (${metrics.reRenderCount}/sec) detected`,
        impact: 'Reduces render frequency for user inputs',
        implementation: 'Use debounced handlers for search and input fields'
      });
    }

    // Suggest lazy loading for large bundle
    if (metrics.bundleSize > PERFORMANCE_THRESHOLDS.bundleSize) {
      suggestions.push({
        type: 'lazy-loading',
        priority: 'medium',
        description: `Large bundle size (${metrics.bundleSize}KB) detected`,
        impact: 'Reduces initial load time',
        implementation: 'Use React.lazy and dynamic imports for components'
      });
    }

    // Suggest memory optimization
    if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.memoryUsage) {
      suggestions.push({
        type: 'memoization',
        priority: 'critical',
        description: `High memory usage (${metrics.memoryUsage}MB) detected`,
        impact: 'Prevents memory leaks and improves stability',
        implementation: 'Add cleanup functions and WeakMap caching'
      });
    }

    return suggestions;
  }, [metrics]);

  // Calculate performance score (0-100)
  const performanceScore = useMemo(() => {
    let score = 100;

    // Deduct points for each metric exceeding threshold
    if (metrics.renderTime > PERFORMANCE_THRESHOLDS.renderTime) {
      score -= Math.min(30, (metrics.renderTime - PERFORMANCE_THRESHOLDS.renderTime) * 2);
    }

    if (metrics.frameRate < PERFORMANCE_THRESHOLDS.frameRate) {
      score -= Math.min(25, (PERFORMANCE_THRESHOLDS.frameRate - metrics.frameRate) * 2);
    }

    if (metrics.queryTime > PERFORMANCE_THRESHOLDS.queryTime) {
      score -= Math.min(20, (metrics.queryTime - PERFORMANCE_THRESHOLDS.queryTime) / 10);
    }

    if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.memoryUsage) {
      score -= Math.min(15, (metrics.memoryUsage - PERFORMANCE_THRESHOLDS.memoryUsage));
    }

    if (metrics.reRenderCount > PERFORMANCE_THRESHOLDS.reRenderCount) {
      score -= Math.min(10, metrics.reRenderCount - PERFORMANCE_THRESHOLDS.reRenderCount);
    }

    return Math.max(0, Math.round(score));
  }, [metrics]);

  // Calculate performance grade
  const performanceGrade = useMemo((): 'A' | 'B' | 'C' | 'D' | 'F' => {
    if (performanceScore >= 90) return 'A';
    if (performanceScore >= 80) return 'B';
    if (performanceScore >= 70) return 'C';
    if (performanceScore >= 60) return 'D';
    return 'F';
  }, [performanceScore]);

  // Identify bottlenecks
  const bottlenecks = useMemo(() => {
    const bottlenecks: string[] = [];

    if (metrics.renderTime > PERFORMANCE_THRESHOLDS.renderTime) {
      bottlenecks.push(`Render performance (${metrics.renderTime}ms)`);
    }

    if (metrics.frameRate < PERFORMANCE_THRESHOLDS.frameRate) {
      bottlenecks.push(`Frame rate (${metrics.frameRate} fps)`);
    }

    if (metrics.queryTime > PERFORMANCE_THRESHOLDS.queryTime) {
      bottlenecks.push(`Query performance (${metrics.queryTime}ms)`);
    }

    if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.memoryUsage) {
      bottlenecks.push(`Memory usage (${metrics.memoryUsage}MB)`);
    }

    return bottlenecks;
  }, [metrics]);

  // Auto-start monitoring in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      startMonitoring();

      return () => {
        stopMonitoring();
      };
    }
  }, [startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    metrics,
    suggestions,
    alerts,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    measureRender,
    measureQuery,
    clearMetrics,
    exportMetrics,
    performanceScore,
    performanceGrade,
    bottlenecks
  };
}