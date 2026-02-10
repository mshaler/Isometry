/**
 * Rendering Performance Utilities for D3.js + sql.js
 *
 * Simplified performance monitoring for direct sql.js access
 * Focus on essential metrics: frame rate, memory usage, render timing
 */

// No bridge dependencies - direct access to sql.js and D3.js
import { performanceLogger } from '@/utils/logging/dev-logger';

// ============================================================================
// Types
// ============================================================================

export interface RenderingMetrics {
  frameRate: number;
  renderTime: number;
  memoryUsageMB: number;
  elementsRendered: number;
  queryTime: number;
}

export interface SimpleAlert {
  type: 'performance' | 'memory';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
  recommendation?: string;
}

// Alias for compatibility
export type PerformanceAlert = SimpleAlert;

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

// ============================================================================
// Simple Rendering Performance Monitor
// ============================================================================

export class SimpleRenderingPerformanceMonitor {
  private frameRateHistory: number[] = [];
  private renderTimeHistory: number[] = [];
  private queryTimeHistory: number[] = [];
  private lastFrameTime: number = 0;
  private alerts: SimpleAlert[] = [];
  private isMonitoring: boolean = false;

  // Configuration
  private readonly maxHistorySize = 60; // 1 second at 60fps

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.frameRateHistory = [];
    this.renderTimeHistory = [];
    this.queryTimeHistory = [];
    this.alerts = [];

    performanceLogger.debug('Simple rendering performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): RenderingMetrics | null {
    if (!this.isMonitoring) return null;

    this.isMonitoring = false;

    const metrics = this.calculateCurrentMetrics();
    performanceLogger.debug('Simple rendering performance monitoring stopped', { metrics });

    return metrics;
  }

  /**
   * Record frame rendering performance
   */
  recordFrame(renderTime: number, _elementsRendered = 1): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();

    // Calculate frame rate
    if (this.lastFrameTime > 0) {
      const frameInterval = currentTime - this.lastFrameTime;
      const fps = 1000 / frameInterval;

      this.frameRateHistory.push(fps);
      if (this.frameRateHistory.length > this.maxHistorySize) {
        this.frameRateHistory.shift();
      }
    }

    this.lastFrameTime = currentTime;

    // Record render time
    this.renderTimeHistory.push(renderTime);
    if (this.renderTimeHistory.length > this.maxHistorySize) {
      this.renderTimeHistory.shift();
    }

    // Check for performance alerts
    this.checkPerformanceAlerts(renderTime);
  }

  /**
   * Record SQL query performance
   */
  recordQuery(queryTime: number): void {
    if (!this.isMonitoring) return;

    this.queryTimeHistory.push(queryTime);
    if (this.queryTimeHistory.length > this.maxHistorySize) {
      this.queryTimeHistory.shift();
    }

    // Alert for slow queries
    if (queryTime > 100) { // 100ms threshold
      this.addAlert({
        type: 'performance',
        severity: queryTime > 500 ? 'high' : 'medium',
        message: `Slow SQL query: ${queryTime.toFixed(1)}ms`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): number {
    const memory = (performance as any).memory;
    if (!memory) return 0;

    const usageMB = memory.usedJSHeapSize / 1024 / 1024;

    // Alert for high memory usage
    if (usageMB > 200) {
      this.addAlert({
        type: 'memory',
        severity: usageMB > 400 ? 'high' : 'medium',
        message: `High memory usage: ${usageMB.toFixed(1)}MB`,
        timestamp: Date.now()
      });
    }

    return usageMB;
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): RenderingMetrics {
    return this.calculateCurrentMetrics();
  }

  /**
   * Get performance alerts
   */
  getAlerts(): SimpleAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear performance alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private calculateCurrentMetrics(): RenderingMetrics {
    const avgFPS = this.frameRateHistory.length > 0
      ? this.frameRateHistory.reduce((a, b) => a + b, 0) / this.frameRateHistory.length
      : 60;

    const avgRenderTime = this.renderTimeHistory.length > 0
      ? this.renderTimeHistory.reduce((a, b) => a + b, 0) / this.renderTimeHistory.length
      : 0;

    const avgQueryTime = this.queryTimeHistory.length > 0
      ? this.queryTimeHistory.reduce((a, b) => a + b, 0) / this.queryTimeHistory.length
      : 0;

    const memoryUsageMB = this.recordMemoryUsage();

    return {
      frameRate: avgFPS,
      renderTime: avgRenderTime,
      memoryUsageMB,
      elementsRendered: this.renderTimeHistory.length,
      queryTime: avgQueryTime
    };
  }

  private checkPerformanceAlerts(renderTime: number): void {
    // Frame time alert
    if (renderTime > 20) { // 20ms = ~50fps
      this.addAlert({
        type: 'performance',
        severity: renderTime > 50 ? 'high' : 'medium',
        message: `Slow frame render: ${renderTime.toFixed(1)}ms`,
        timestamp: Date.now()
      });
    }

    // Frame rate consistency alert
    if (this.frameRateHistory.length >= 10) {
      const recentFrames = this.frameRateHistory.slice(-10);
      const dropsBelow50 = recentFrames.filter(fps => fps < 50).length;

      if (dropsBelow50 >= 5) {
        this.addAlert({
          type: 'performance',
          severity: 'high',
          message: `${dropsBelow50} frame rate drops below 50fps`,
          timestamp: Date.now()
        });
      }
    }
  }

  private addAlert(alert: SimpleAlert): void {
    // Avoid duplicate alerts within 5 seconds
    const recentAlert = this.alerts.find(a =>
      a.type === alert.type &&
      Date.now() - a.timestamp < 5000
    );

    if (!recentAlert) {
      this.alerts.push(alert);

      // Limit alerts history
      if (this.alerts.length > 10) {
        this.alerts.shift();
      }

      console.warn(`⚠️ Performance Alert: ${alert.message}`);
    }
  }
}

// ============================================================================
// Simple Memory Tracker
// ============================================================================

export class SimpleMemoryTracker {
  private monitorInterval: NodeJS.Timeout | null = null;
  private onHighUsage?: (usageMB: number) => void;

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs: number = 5000, onHighUsage?: (usageMB: number) => void): void {
    this.onHighUsage = onHighUsage;

    this.monitorInterval = setInterval(() => {
      const usageMB = this.getCurrentMemoryMB();
      if (usageMB > 200 && this.onHighUsage) {
        this.onHighUsage(usageMB);
      }
    }, intervalMs);

    performanceLogger.debug('Simple memory monitoring started');
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      performanceLogger.debug('Simple memory monitoring stopped');
    }
  }

  /**
   * Get current memory usage in MB
   */
  getCurrentMemoryMB(): number {
    const memory = (performance as any).memory;
    if (!memory) return 0;

    return memory.usedJSHeapSize / 1024 / 1024;
  }

  /**
   * Force garbage collection (Chrome only)
   */
  forceGarbageCollection(): boolean {
    if ((window as any).gc) {
      (window as any).gc();
      performanceLogger.debug('Forced garbage collection');
      return true;
    }
    return false;
  }
}

// ============================================================================
// Types used by useRenderingOptimization hook
// ============================================================================

export interface OptimizationStrategy {
  targetFPS: number;
  lodLevel: number;
  cullingEnabled: boolean;
  batchSize: number;
  gpuAcceleration: boolean;
  memoryStrategy: string;
}

export interface LODConfiguration {
  level: number;
  simplificationRatio: number;
  renderDistance: number;
  elementThreshold: number;
}

export interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  leakDetected: boolean;
}

// ============================================================================
// Viewport Optimizer
// ============================================================================

class ViewportOptimizer {
  async optimizeForDataset(
    _viewport: Viewport,
    nodeCount: number,
    targetFPS: number
  ): Promise<OptimizationStrategy> {
    return {
      targetFPS,
      lodLevel: nodeCount > 1000 ? 2 : nodeCount > 500 ? 1 : 0,
      cullingEnabled: nodeCount > 200,
      batchSize: Math.min(nodeCount, 100),
      gpuAcceleration: false,
      memoryStrategy: nodeCount > 2000 ? 'conservative' : 'balanced'
    };
  }

  calculateCullingBounds(
    viewport: Viewport,
    margin: number
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    const marginX = viewport.width * margin;
    const marginY = viewport.height * margin;
    return {
      minX: viewport.x - marginX,
      maxX: viewport.x + viewport.width + marginX,
      minY: viewport.y - marginY,
      maxY: viewport.y + viewport.height + marginY
    };
  }
}

// ============================================================================
// Memory Usage Tracker (Extended)
// ============================================================================

class MemoryUsageTracker {
  private monitorInterval: NodeJS.Timeout | null = null;

  startMonitoring(intervalMs: number = 5000, onUpdate?: (metrics: MemoryMetrics) => void): void {
    this.monitorInterval = setInterval(() => {
      const metrics = this.getCurrentMemoryMetrics();
      if (metrics && onUpdate) {
        onUpdate(metrics);
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  getCurrentMemoryMetrics(): MemoryMetrics | null {
    const memory = (performance as any).memory;
    if (!memory) return null;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit || 2147483648,
      leakDetected: false
    };
  }

  forceGarbageCollection(): boolean {
    if ((window as any).gc) {
      (window as any).gc();
      return true;
    }
    return false;
  }
}

// ============================================================================
// Batching Optimizer
// ============================================================================

class BatchingOptimizer {
  private batchQueue: (() => void)[] = [];

  addToBatch(operation: () => void): void {
    this.batchQueue.push(operation);
  }

  processBatch(): void {
    const batch = [...this.batchQueue];
    this.batchQueue = [];
    batch.forEach(op => op());
  }

  clearBatch(): void {
    this.batchQueue = [];
  }
}

// ============================================================================
// Global Instances
// ============================================================================

export const viewportOptimizer = new ViewportOptimizer();
export const memoryUsageTracker = new MemoryUsageTracker();
export const batchingOptimizer = new BatchingOptimizer();


export const simpleRenderingMonitor = new SimpleRenderingPerformanceMonitor();
export const simpleMemoryTracker = new SimpleMemoryTracker();

// Aliases for compatibility
export const renderingPerformanceMonitor = simpleRenderingMonitor;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Start basic performance monitoring
 */
export function startPerformanceMonitoring(): void {
  simpleRenderingMonitor.startMonitoring();
  simpleMemoryTracker.startMonitoring(10000); // Check every 10 seconds
}

/**
 * Stop basic performance monitoring
 */
export function stopPerformanceMonitoring(): RenderingMetrics | null {
  simpleMemoryTracker.stopMonitoring();
  return simpleRenderingMonitor.stopMonitoring();
}

/**
 * Record performance for a D3.js render operation
 */
export function recordD3Render(renderTimeMs: number, elementCount: number, queryTimeMs = 0): void {
  simpleRenderingMonitor.recordFrame(renderTimeMs, elementCount);
  if (queryTimeMs > 0) {
    simpleRenderingMonitor.recordQuery(queryTimeMs);
  }
}

/**
 * Get current performance status
 */
export function getPerformanceStatus(): {
  isHealthy: boolean;
  metrics: RenderingMetrics;
  issues: string[];
} {
  const metrics = simpleRenderingMonitor.getCurrentMetrics();
  const alerts = simpleRenderingMonitor.getAlerts();

  const isHealthy =
    metrics.frameRate >= 50 &&
    metrics.renderTime <= 20 &&
    metrics.memoryUsageMB <= 200 &&
    metrics.queryTime <= 50;

  const issues = alerts.map(alert => alert.message);

  return {
    isHealthy,
    metrics,
    issues
  };
}