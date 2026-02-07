/**
 * Rendering Performance Utilities for React D3 Canvas
 *
 * Provides performance monitoring, optimization strategies, and native bridge integration
 * for achieving 60fps rendering targets with large datasets
 */

import { performanceMonitor } from './performance-monitor';
import { Environment, webViewBridge } from './webview-bridge';

// ============================================================================
// Types
// ============================================================================

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface RenderingMetrics {
  frameRate: number;
  renderTime: number;
  memoryUsage: number;
  culledElements: number;
  renderedElements: number;
  lodLevel: number;
  gpuUtilization: number;
  performance60FPS: boolean;
}

export interface OptimizationStrategy {
  cullingEnabled: boolean;
  lodLevel: number;
  batchSize: number;
  memoryStrategy: 'normal' | 'balanced' | 'conservative' | 'aggressive';
  targetFPS: number;
  gpuAcceleration: boolean;
}

export interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  leakDetected: boolean;
}

export interface LODConfiguration {
  level: number;
  simplificationRatio: number;
  renderDistance: number;
  elementThreshold: number;
}

export interface PerformanceAlert {
  type: 'performance' | 'memory' | 'optimization';
  severity: 'low' | 'medium' | 'high';
  message: string;
  recommendation: string;
  timestamp: number;
}

// ============================================================================
// Rendering Performance Monitor
// ============================================================================

export class RenderingPerformanceMonitor {
  private frameRateHistory: number[] = [];
  private renderTimeHistory: number[] = [];
  private memoryReadings: MemoryMetrics[] = [];
  private lastFrameTime: number = 0;
  private alerts: PerformanceAlert[] = [];
  private isMonitoring: boolean = false;

  // Configuration
  private readonly maxHistorySize = 60; // 1 second at 60fps
  private readonly targetFrameTime = 16.67; // 60fps target in ms
  private readonly alertThresholds = {
    frameTime: 20, // ms
    memoryUsage: 100 * 1024 * 1024, // 100MB
    frameRateDrops: 5 // consecutive drops
  };

  // Bridge integration
  private bridgeAvailable: boolean = false;

  constructor() {
    this.bridgeAvailable = Environment.isWebView() && !!(window as any)._isometryBridge?.d3rendering;

    if (this.bridgeAvailable) {
      console.log('🚀 Native rendering optimization bridge available');
    }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.frameRateHistory = [];
    this.renderTimeHistory = [];
    this.memoryReadings = [];
    this.alerts = [];

    console.log('📊 Rendering performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): RenderingMetrics | null {
    if (!this.isMonitoring) return null;

    this.isMonitoring = false;

    const metrics = this.calculateCurrentMetrics();
    console.log('📊 Rendering performance monitoring stopped', metrics);

    return metrics;
  }

  /**
   * Record frame rendering performance
   */
  recordFrame(renderTime: number): void {
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

    // Send to native bridge if available
    if (this.bridgeAvailable) {
      this.recordFramePerformanceNative(renderTime);
    }

    // Check for performance alerts
    this.checkPerformanceAlerts(renderTime);

    // Record in global performance monitor
    performanceMonitor.recordRender(renderTime, 1);
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): MemoryMetrics | null {
    const memory = (performance as any).memory;
    if (!memory) return null;

    const metrics: MemoryMetrics = {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      leakDetected: this.detectMemoryLeak(memory.usedJSHeapSize)
    };

    this.memoryReadings.push(metrics);
    if (this.memoryReadings.length > 20) {
      this.memoryReadings.shift();
    }

    return metrics;
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
  getAlerts(): PerformanceAlert[] {
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
      : 0;

    const avgRenderTime = this.renderTimeHistory.length > 0
      ? this.renderTimeHistory.reduce((a, b) => a + b, 0) / this.renderTimeHistory.length
      : 0;

    const latestMemory = this.memoryReadings[this.memoryReadings.length - 1];
    const memoryUsage = latestMemory ? latestMemory.usedJSHeapSize : 0;

    return {
      frameRate: avgFPS,
      renderTime: avgRenderTime,
      memoryUsage,
      culledElements: 0, // Will be provided by native bridge
      renderedElements: 0, // Will be provided by native bridge
      lodLevel: 1, // Will be provided by native bridge
      gpuUtilization: 0, // Will be provided by native bridge
      performance60FPS: avgRenderTime < this.targetFrameTime
    };
  }

  // Memory leak detection - preserved for future memory monitoring
   
  private detectMemoryLeak(_currentUsage: number): boolean {
    if (this.memoryReadings.length < 10) return false;

    // Simple leak detection: continuous growth over time
    const recentReadings = this.memoryReadings.slice(-10).map(m => m.usedJSHeapSize);
    const growthCount = recentReadings.slice(1).reduce((count, current, index) => {
      return current > recentReadings[index] ? count + 1 : count;
    }, 0);

    return growthCount > 7; // If 7 out of 9 readings show growth
  }

  private checkPerformanceAlerts(renderTime: number): void {
    // Frame time alert
    if (renderTime > this.alertThresholds.frameTime) {
      this.addAlert({
        type: 'performance',
        severity: renderTime > this.alertThresholds.frameTime * 2 ? 'high' : 'medium',
        message: `Frame render time ${renderTime.toFixed(1)}ms exceeds target`,
        recommendation: 'Consider enabling viewport culling or increasing LOD level',
        timestamp: Date.now()
      });
    }

    // Memory alert
    const latestMemory = this.memoryReadings[this.memoryReadings.length - 1];
    if (latestMemory && latestMemory.usedJSHeapSize > this.alertThresholds.memoryUsage) {
      this.addAlert({
        type: 'memory',
        severity: latestMemory.leakDetected ? 'high' : 'medium',
        message: `High memory usage: ${(latestMemory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`,
        recommendation: latestMemory.leakDetected ? 'Memory leak detected - investigate object retention' : 'Consider memory optimization strategies',
        timestamp: Date.now()
      });
    }

    // Frame rate consistency alert
    if (this.frameRateHistory.length >= 10) {
      const recentFrames = this.frameRateHistory.slice(-10);
      const dropsBelow50 = recentFrames.filter(fps => fps < 50).length;

      if (dropsBelow50 >= this.alertThresholds.frameRateDrops) {
        this.addAlert({
          type: 'performance',
          severity: 'high',
          message: `${dropsBelow50} frame rate drops below 50fps in last 10 frames`,
          recommendation: 'Enable aggressive performance optimizations',
          timestamp: Date.now()
        });
      }
    }
  }

  private addAlert(alert: PerformanceAlert): void {
    // Avoid duplicate alerts within 5 seconds
    const recentAlert = this.alerts.find(a =>
      a.type === alert.type &&
      Date.now() - a.timestamp < 5000
    );

    if (!recentAlert) {
      this.alerts.push(alert);

      // Limit alerts history
      if (this.alerts.length > 20) {
        this.alerts.shift();
      }

      console.warn(`🚨 Performance Alert: ${alert.message}`);
    }
  }

  private async recordFramePerformanceNative(renderTime: number): Promise<void> {
    if (!this.bridgeAvailable) return;

    try {
      await webViewBridge.d3rendering.recordFramePerformance({
        renderTime: renderTime / 1000 // Convert to seconds
      });
    } catch (error) {
      console.warn('Failed to record frame performance in native bridge:', error);
    }
  }
}

// ============================================================================
// Viewport Optimizer
// ============================================================================

export class ViewportOptimizer {
  private lastOptimization: number = 0;
  private optimizationDebounceMs = 100;
  private bridgeAvailable: boolean;

  constructor() {
    this.bridgeAvailable = Environment.isWebView() && !!(window as any)._isometryBridge?.d3rendering;
  }

  /**
   * Optimize viewport settings for performance
   */
  async optimizeForDataset(
    viewport: Viewport,
    nodeCount: number,
    targetFPS: number = 60
  ): Promise<OptimizationStrategy> {
    // Debounce optimization calls
    const now = Date.now();
    if (now - this.lastOptimization < this.optimizationDebounceMs) {
      return this.getDefaultStrategy();
    }
    this.lastOptimization = now;

    if (this.bridgeAvailable) {
      try {
        const result = await webViewBridge.d3rendering.optimizeViewport({
          viewport,
          nodeCount,
          targetFPS
        });

        return {
          cullingEnabled: result.optimizationSettings.cullingEnabled,
          lodLevel: result.optimizationSettings.lodLevel,
          batchSize: result.optimizationSettings.batchSize,
          memoryStrategy: result.optimizationSettings.memoryStrategy as 'normal' | 'balanced' | 'conservative' | 'aggressive',
          targetFPS: result.optimizationSettings.targetFPS,
          gpuAcceleration: result.optimizationSettings.gpuAcceleration
        };
      } catch (error) {
        console.warn('Native viewport optimization failed, using fallback:', error);
      }
    }

    // Fallback optimization logic
    return this.calculateOptimizationStrategy(viewport, nodeCount, targetFPS);
  }

  /**
   * Calculate culling bounds for viewport
   */
  calculateCullingBounds(viewport: Viewport, margin: number = 0.2): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    const marginX = viewport.width * margin;
    const marginY = viewport.height * margin;

    return {
      minX: viewport.x - marginX,
      maxX: viewport.x + viewport.width + marginX,
      minY: viewport.y - marginY,
      maxY: viewport.y + viewport.height + marginY
    };
  }

  /**
   * Determine if element should be culled
   */
  shouldCullElement(
    elementBounds: { x: number; y: number; width?: number; height?: number },
    cullingBounds: ReturnType<typeof this.calculateCullingBounds>
  ): boolean {
    const elementRight = elementBounds.x + (elementBounds.width || 0);
    const elementBottom = elementBounds.y + (elementBounds.height || 0);

    return elementBounds.x > cullingBounds.maxX ||
           elementRight < cullingBounds.minX ||
           elementBounds.y > cullingBounds.maxY ||
           elementBottom < cullingBounds.minY;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private getDefaultStrategy(): OptimizationStrategy {
    return {
      cullingEnabled: true,
      lodLevel: 1,
      batchSize: 100,
      memoryStrategy: 'balanced',
      targetFPS: 60,
      gpuAcceleration: false
    };
  }

  private calculateOptimizationStrategy(
    viewport: Viewport,
    nodeCount: number,
    targetFPS: number
  ): OptimizationStrategy {
    // Determine strategy based on dataset size and viewport
    let lodLevel = 0;
    let batchSize = 50;
    let memoryStrategy: OptimizationStrategy['memoryStrategy'] = 'normal';

    if (nodeCount > 5000) {
      lodLevel = viewport.scale < 0.5 ? 3 : 2;
      batchSize = 200;
      memoryStrategy = 'aggressive';
    } else if (nodeCount > 1000) {
      lodLevel = viewport.scale < 0.3 ? 2 : 1;
      batchSize = 150;
      memoryStrategy = 'conservative';
    } else if (nodeCount > 500) {
      lodLevel = viewport.scale < 0.2 ? 1 : 0;
      batchSize = 100;
      memoryStrategy = 'balanced';
    }

    return {
      cullingEnabled: nodeCount > 100,
      lodLevel,
      batchSize,
      memoryStrategy,
      targetFPS,
      gpuAcceleration: nodeCount > 1000
    };
  }
}

// ============================================================================
// Memory Usage Tracker
// ============================================================================

export class MemoryUsageTracker {
  private monitorInterval: number | null = null;
  private onLeakDetected?: (metrics: MemoryMetrics) => void;
  private bridgeAvailable: boolean;

  constructor() {
    this.bridgeAvailable = Environment.isWebView() && !!(window as any)._isometryBridge?.d3rendering;
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs: number = 5000, onLeakDetected?: (metrics: MemoryMetrics) => void): void {
    this.onLeakDetected = onLeakDetected;

    this.monitorInterval = window.setInterval(() => {
      const metrics = this.getCurrentMemoryMetrics();
      if (metrics) {
        this.processMemoryMetrics(metrics);
      }
    }, intervalMs);

    console.log('🧠 Memory usage monitoring started');
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log('🧠 Memory usage monitoring stopped');
    }
  }

  /**
   * Get current memory metrics
   */
  getCurrentMemoryMetrics(): MemoryMetrics | null {
    const memory = (performance as any).memory;
    if (!memory) return null;

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      leakDetected: false // Will be determined by analysis
    };
  }

  /**
   * Force garbage collection (Chrome only)
   */
  forceGarbageCollection(): boolean {
    if ((window as any).gc) {
      (window as any).gc();
      console.log('🗑️ Forced garbage collection');
      return true;
    }
    return false;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async processMemoryMetrics(metrics: MemoryMetrics): Promise<void> {
    // Send to native bridge for analysis
    if (this.bridgeAvailable) {
      try {
        const result = await webViewBridge.d3rendering.manageMemory({
          memoryUsage: metrics.usedJSHeapSize,
          leakDetected: metrics.leakDetected
        });

        if (result.memoryStrategy === 'aggressive' && this.onLeakDetected) {
          this.onLeakDetected({ ...metrics, leakDetected: true });
        }
      } catch (error) {
        console.warn('Failed to send memory metrics to native bridge:', error);
      }
    }

    // Local analysis
    const usageMB = metrics.usedJSHeapSize / 1024 / 1024;
    if (usageMB > 100) {
      console.warn(`🧠 High memory usage: ${usageMB.toFixed(1)}MB`);
    }
  }
}

// ============================================================================
// Batching Optimizer
// ============================================================================

export class BatchingOptimizer {
  private pendingOperations: Array<() => void> = [];
  private batchTimeout: number | null = null;
  private readonly batchDelay = 16; // One frame at 60fps

  /**
   * Add operation to batch
   */
  addToBatch(operation: () => void): void {
    this.pendingOperations.push(operation);

    if (!this.batchTimeout) {
      this.batchTimeout = window.setTimeout(() => {
        this.executeBatch();
      }, this.batchDelay);
    }
  }

  /**
   * Force execute current batch
   */
  executeBatch(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const operations = this.pendingOperations.splice(0);

    if (operations.length > 0) {
      const startTime = performance.now();

      operations.forEach(operation => operation());

      const duration = performance.now() - startTime;
      console.debug(`📦 Executed batch of ${operations.length} operations in ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Clear pending operations
   */
  clearBatch(): void {
    this.pendingOperations = [];

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
}

// ============================================================================
// Global Instances
// ============================================================================

export const renderingPerformanceMonitor = new RenderingPerformanceMonitor();
export const viewportOptimizer = new ViewportOptimizer();
export const memoryUsageTracker = new MemoryUsageTracker();
export const batchingOptimizer = new BatchingOptimizer();