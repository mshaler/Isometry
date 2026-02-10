/**
 * D3 Performance Optimization Suite - Refactored
 *
 * High-performance optimization utilities for D3 visualizations.
 * Now organized into focused, reusable modules.
 */

// Re-export all performance optimization modules
export * from './object-pooling';
export * from './texture-cache';
export * from './spatial-index';
export * from './transition-manager';

// Utility Functions
export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Performance Monitoring
export interface NativeRenderingMetrics {
  timestamp: number;
  renderTime: number;
  commandCount: number;
  memoryUsage: number; // bytes
  cacheHitRate: number; // 0.0 to 1.0
  frameRate: number;
  droppedFrames: number;
  complexity: {
    pathCommandCount: number;
    simpleShapeCount: number;
    textCommandCount: number;
    transformCount: number;
    complexityScore: number; // 0.0 to 10.0
  };
}

export interface PerformanceComparison {
  domRendering: {
    avgRenderTime: number;
    avgFrameRate: number;
    memoryUsage: number;
  };
  nativeRendering: NativeRenderingMetrics | null;
  recommendation: 'dom' | 'native' | 'hybrid';
  reasoning: string;
  expectedImprovement: number; // percentage
}

export function performanceComparison(
  domMetrics: { renderTime: number; frameRate: number; memoryUsage: number },
  nativeMetrics: NativeRenderingMetrics | null,
  datasetSize: number,
  complexity: number
): PerformanceComparison {
  // Base comparison data
  const comparison: PerformanceComparison = {
    domRendering: {
      avgRenderTime: domMetrics.renderTime,
      avgFrameRate: domMetrics.frameRate,
      memoryUsage: domMetrics.memoryUsage
    },
    nativeRendering: nativeMetrics,
    recommendation: 'dom',
    reasoning: 'Default DOM rendering',
    expectedImprovement: 0
  };

  // If no native metrics available, stick with DOM
  if (!nativeMetrics) {
    comparison.reasoning = 'Native rendering not available';
    return comparison;
  }

  // Performance analysis factors
  const domSlow = domMetrics.renderTime > 0.0167; // > 16ms (60fps)
  const nativeFaster = nativeMetrics.renderTime < domMetrics.renderTime;
  const largeDataset = datasetSize > 1000;
  const highComplexity = complexity > 5.0;

  // Decision logic
  if (largeDataset && highComplexity && nativeFaster) {
    comparison.recommendation = 'native';
    comparison.reasoning = 'Large dataset with high complexity benefits from native rendering';
    comparison.expectedImprovement = Math.min(
      ((domMetrics.renderTime - nativeMetrics.renderTime) / domMetrics.renderTime) * 100,
      200 // Cap at 200% improvement
    );
  } else if (domSlow && nativeFaster) {
    comparison.recommendation = 'native';
    comparison.reasoning = 'DOM rendering performance below target, native faster';
    comparison.expectedImprovement = ((domMetrics.renderTime - nativeMetrics.renderTime) / domMetrics.renderTime) * 100;
  } else if (largeDataset && !nativeFaster) {
    comparison.recommendation = 'hybrid';
    comparison.reasoning = 'Large dataset with mixed performance - use viewport culling with DOM';
    comparison.expectedImprovement = 25;
  } else {
    comparison.recommendation = 'dom';
    comparison.reasoning = 'DOM rendering sufficient for current dataset and complexity';
  }

  return comparison;
}

interface PerformanceMetric {
  name: string;
  startTime: number;
  duration?: number;
  samples: number[];
  lastUpdated: number;
}

export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric>();
  private frameTimeHistory: number[] = [];
  private lastFrameTime = 0;
  private maxHistorySize = 60; // Keep 60 samples for FPS calculation
  private nativeMetrics: NativeRenderingMetrics | null = null;
  private lastNativeUpdate = 0;

  startMetric(name: string): void {
    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      samples: [],
      lastUpdated: Date.now()
    });
  }

  endMetric(name: string): number {
    const metric = this.metrics.get(name);
    if (!metric) return 0;

    const duration = performance.now() - metric.startTime;
    metric.duration = duration;
    metric.samples.push(duration);
    metric.lastUpdated = Date.now();

    // Keep only recent samples
    if (metric.samples.length > this.maxHistorySize) {
      metric.samples.shift();
    }

    return duration;
  }

  updateNativeMetrics(metrics: NativeRenderingMetrics): void {
    this.nativeMetrics = metrics;
    this.lastNativeUpdate = Date.now();
  }

  getNativeMetrics(): NativeRenderingMetrics | null {
    // Return null if metrics are stale (older than 5 seconds)
    if (!this.nativeMetrics || Date.now() - this.lastNativeUpdate > 5000) {
      return null;
    }
    return this.nativeMetrics;
  }

  recordFrameTime(): number {
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const frameTime = now - this.lastFrameTime;
      this.frameTimeHistory.push(frameTime);

      if (this.frameTimeHistory.length > this.maxHistorySize) {
        this.frameTimeHistory.shift();
      }
    }

    this.lastFrameTime = now;
    return this.getFPS();
  }

  getFPS(): number {
    if (this.frameTimeHistory.length === 0) return 0;

    const averageFrameTime = this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length;
    return 1000 / averageFrameTime;
  }

  getMetricStats(name: string): { average: number; min: number; max: number; latest: number; samples: number } | null {
    const metric = this.metrics.get(name);
    if (!metric || metric.samples.length === 0) return null;

    const samples = metric.samples;
    const average = samples.reduce((sum, val) => sum + val, 0) / samples.length;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const latest = samples[samples.length - 1];

    return { average, min, max, latest, samples: samples.length };
  }

  getMemoryUsage(): { used: number; total: number; percentage: number } {
    const memory = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
    if (memory) {
      return {
        used: memory.usedJSHeapSize / 1024 / 1024, // MB
        total: memory.totalJSHeapSize / 1024 / 1024, // MB
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      };
    }
    return { used: 0, total: 0, percentage: 0 };
  }

  clear(): void {
    this.metrics.clear();
    this.frameTimeHistory = [];
    this.lastFrameTime = 0;
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Simple performance measurement utility for compatibility
 */
export function measurePerformance<T>(
  name: string,
  fn: () => T
): { result: T; duration: number } {
  performanceMonitor.startMetric(name);
  const result = fn();
  const duration = performanceMonitor.endMetric(name);
  return { result, duration };
}