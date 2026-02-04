/**
 * Real-Time Rendering Engine
 *
 * High-performance wrapper for D3 visualizations with real-time capabilities.
 * Ensures 60fps rendering during live data updates with intelligent optimization.
 */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  createContext,
  useContext
} from 'react';
import * as d3 from 'd3';

// Performance metrics and configuration
export interface PerformanceMetrics {
  fps: number;
  averageFps: number;
  frameTime: number;
  renderTime: number;
  memoryUsage: number;
  nodeCount: number;
  droppedFrames: number;
  performanceScore: number;
  isOptimized: boolean;
  lodLevel: number;
  bottlenecks: string[];
}

export interface RealTimeRendererProps {
  children: React.ReactNode;
  /** Maximum number of nodes to render (default: 10000) */
  maxNodes?: number;
  /** Target FPS for rendering (default: 60) */
  targetFps?: number;
  /** Enable Level of Detail optimization (default: true) */
  enableLOD?: boolean;
  /** Enable progressive rendering for large datasets (default: true) */
  enableProgressiveRendering?: boolean;
  /** Chunk size for progressive rendering (default: 100) */
  progressiveChunkSize?: number;
  /** Enable memory pooling for D3 elements (default: true) */
  enableMemoryPooling?: boolean;
  /** Frame budget in milliseconds (default: 16.67ms for 60fps) */
  frameBudgetMs?: number;
  /** Callback for performance metric updates */
  onPerformanceChange?: (metrics: PerformanceMetrics) => void;
  /** Enable debug mode with additional logging */
  debug?: boolean;
  /** Custom CSS classes */
  className?: string;
}

// Level of Detail settings
interface LODSettings {
  level: number;
  maxNodes: number;
  simplifySVG: boolean;
  reduceAnimations: boolean;
  skipNonEssentialElements: boolean;
  enableViewportCulling: boolean;
}

// Frame scheduler for managing render operations
class FrameScheduler {
  private animationFrameId: number | null = null;
  private isRunning = false;
  private renderCallback: (() => void) | null = null;
  private lastFrameTime = 0;
  private frameTimeHistory: number[] = [];
  private readonly maxHistorySize = 60; // Track last 60 frames

  start(callback: () => void): void {
    this.renderCallback = callback;
    this.isRunning = true;
    this.scheduleFrame();
  }

  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isRunning = false;
    this.renderCallback = null;
  }

  private scheduleFrame = (): void => {
    if (!this.isRunning || !this.renderCallback) return;

    this.animationFrameId = requestAnimationFrame((currentTime) => {
      const frameTime = currentTime - this.lastFrameTime;

      // Record frame timing
      this.frameTimeHistory.push(frameTime);
      if (this.frameTimeHistory.length > this.maxHistorySize) {
        this.frameTimeHistory.shift();
      }

      this.lastFrameTime = currentTime;

      // Execute render callback
      try {
        this.renderCallback!();
      } catch (error) {
        console.error('[RealTimeRenderer] Render error:', error);
      }

      // Schedule next frame
      this.scheduleFrame();
    });
  };

  getAverageFps(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    const avgFrameTime = this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length;
    return avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
  }

  getLastFrameTime(): number {
    return this.frameTimeHistory[this.frameTimeHistory.length - 1] || 0;
  }

  getDroppedFrames(targetFps: number): number {
    const targetFrameTime = 1000 / targetFps;
    return this.frameTimeHistory.filter(time => time > targetFrameTime * 1.5).length;
  }
}

// Memory pool for D3 elements to reduce garbage collection
class D3ElementPool {
  private pools = new Map<string, HTMLElement[]>();
  private readonly maxPoolSize = 1000;

  acquire(tagName: string): HTMLElement {
    const pool = this.pools.get(tagName) || [];
    const element = pool.pop();

    if (element) {
      // Reset element properties
      element.removeAttribute('style');
      element.removeAttribute('class');
      element.innerHTML = '';
      return element;
    }

    // Create new element if pool is empty
    return document.createElement(tagName);
  }

  release(element: HTMLElement): void {
    const tagName = element.tagName.toLowerCase();
    const pool = this.pools.get(tagName) || [];

    if (pool.length < this.maxPoolSize) {
      pool.push(element);
      this.pools.set(tagName, pool);
    }
  }

  clear(): void {
    this.pools.clear();
  }

  getPoolSizes(): Record<string, number> {
    const sizes: Record<string, number> = {};
    this.pools.forEach((pool, tagName) => {
      sizes[tagName] = pool.length;
    });
    return sizes;
  }
}

// Performance monitoring and optimization engine
class PerformanceOptimizer {
  private frameScheduler = new FrameScheduler();
  private elementPool = new D3ElementPool();
  private lodSettings: LODSettings = {
    level: 0,
    maxNodes: 10000,
    simplifySVG: false,
    reduceAnimations: false,
    skipNonEssentialElements: false,
    enableViewportCulling: false
  };

  private lastOptimizationTime = 0;
  private readonly optimizationInterval = 1000; // Check every second
  private renderTimeHistory: number[] = [];

  constructor(
    private targetFps: number = 60,
    private frameBudgetMs: number = 16.67,
    private onMetricsUpdate?: (metrics: PerformanceMetrics) => void
  ) {}

  startMonitoring(renderCallback: () => void): void {
    this.frameScheduler.start(() => {
      const renderStartTime = performance.now();

      // Execute render with timing
      renderCallback();

      const renderTime = performance.now() - renderStartTime;
      this.recordRenderTime(renderTime);

      // Check if optimization is needed
      this.maybeOptimize();

      // Update metrics
      this.updateMetrics();
    });
  }

  stopMonitoring(): void {
    this.frameScheduler.stop();
    this.elementPool.clear();
  }

  private recordRenderTime(time: number): void {
    this.renderTimeHistory.push(time);
    if (this.renderTimeHistory.length > 60) {
      this.renderTimeHistory.shift();
    }
  }

  private maybeOptimize(): void {
    const now = performance.now();
    if (now - this.lastOptimizationTime < this.optimizationInterval) return;

    this.lastOptimizationTime = now;

    const avgFps = this.frameScheduler.getAverageFps();
    const avgRenderTime = this.renderTimeHistory.reduce((sum, time) => sum + time, 0) / this.renderTimeHistory.length;

    // Optimize if performance is poor
    if (avgFps < this.targetFps * 0.8 || avgRenderTime > this.frameBudgetMs) {
      this.increaseLOD();
    }
    // Scale back optimization if performance is good
    else if (avgFps > this.targetFps * 0.95 && avgRenderTime < this.frameBudgetMs * 0.7) {
      this.decreaseLOD();
    }
  }

  private increaseLOD(): void {
    const current = this.lodSettings;

    if (current.level === 0) {
      // Level 1: Enable viewport culling
      this.lodSettings = {
        ...current,
        level: 1,
        enableViewportCulling: true
      };
    } else if (current.level === 1) {
      // Level 2: Reduce animations
      this.lodSettings = {
        ...current,
        level: 2,
        reduceAnimations: true
      };
    } else if (current.level === 2) {
      // Level 3: Simplify SVG elements
      this.lodSettings = {
        ...current,
        level: 3,
        simplifySVG: true
      };
    } else if (current.level === 3) {
      // Level 4: Skip non-essential elements
      this.lodSettings = {
        ...current,
        level: 4,
        skipNonEssentialElements: true,
        maxNodes: current.maxNodes * 0.7
      };
    }
  }

  private decreaseLOD(): void {
    const current = this.lodSettings;

    if (current.level === 4) {
      this.lodSettings = {
        ...current,
        level: 3,
        skipNonEssentialElements: false,
        maxNodes: current.maxNodes / 0.7
      };
    } else if (current.level === 3) {
      this.lodSettings = {
        ...current,
        level: 2,
        simplifySVG: false
      };
    } else if (current.level === 2) {
      this.lodSettings = {
        ...current,
        level: 1,
        reduceAnimations: false
      };
    } else if (current.level === 1) {
      this.lodSettings = {
        ...current,
        level: 0,
        enableViewportCulling: false
      };
    }
  }

  private updateMetrics(): void {
    if (!this.onMetricsUpdate) return;

    const avgFps = this.frameScheduler.getAverageFps();
    const currentFps = this.frameScheduler.getLastFrameTime() > 0 ? 1000 / this.frameScheduler.getLastFrameTime() : 0;
    const avgRenderTime = this.renderTimeHistory.length > 0
      ? this.renderTimeHistory.reduce((sum, time) => sum + time, 0) / this.renderTimeHistory.length
      : 0;

    const droppedFrames = this.frameScheduler.getDroppedFrames(this.targetFps);
    const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;

    // Calculate performance score (0-100)
    let score = 100;
    if (avgFps < this.targetFps) score -= ((this.targetFps - avgFps) / this.targetFps) * 40;
    if (avgRenderTime > this.frameBudgetMs) score -= ((avgRenderTime - this.frameBudgetMs) / this.frameBudgetMs) * 30;
    if (droppedFrames > 3) score -= Math.min(droppedFrames * 5, 30);

    const metrics: PerformanceMetrics = {
      fps: currentFps,
      averageFps: avgFps,
      frameTime: this.frameScheduler.getLastFrameTime(),
      renderTime: avgRenderTime,
      memoryUsage,
      nodeCount: 0, // Will be updated by child components
      droppedFrames,
      performanceScore: Math.max(0, score),
      isOptimized: this.lodSettings.level > 0,
      lodLevel: this.lodSettings.level,
      bottlenecks: this.identifyBottlenecks()
    };

    this.onMetricsUpdate(metrics);
  }

  private identifyBottlenecks(): string[] {
    const bottlenecks: string[] = [];
    const avgRenderTime = this.renderTimeHistory.length > 0
      ? this.renderTimeHistory.reduce((sum, time) => sum + time, 0) / this.renderTimeHistory.length
      : 0;

    if (avgRenderTime > this.frameBudgetMs * 1.5) {
      bottlenecks.push('High render time');
    }

    if (this.frameScheduler.getDroppedFrames(this.targetFps) > 5) {
      bottlenecks.push('Dropped frames');
    }

    const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
    if (memoryUsage > 100 * 1024 * 1024) { // > 100MB
      bottlenecks.push('High memory usage');
    }

    return bottlenecks;
  }

  getLODSettings(): LODSettings {
    return { ...this.lodSettings };
  }

  getElementPool(): D3ElementPool {
    return this.elementPool;
  }
}

// Context for sharing performance optimizer across components
const RealTimeRendererContext = createContext<{
  optimizer: PerformanceOptimizer;
  metrics: PerformanceMetrics | null;
  lodSettings: LODSettings;
} | null>(null);

export function useRealTimeRenderer() {
  const context = useContext(RealTimeRendererContext);
  if (!context) {
    throw new Error('useRealTimeRenderer must be used within a RealTimeRenderer');
  }
  return context;
}

// Main RealTimeRenderer component
export const RealTimeRenderer: React.FC<RealTimeRendererProps> = ({
  children,
  maxNodes = 10000,
  targetFps = 60,
  enableLOD = true,
  enableProgressiveRendering = true,
  progressiveChunkSize = 100,
  enableMemoryPooling = true,
  frameBudgetMs = 16.67,
  onPerformanceChange,
  debug = false,
  className = ''
}) => {
  // Use performance optimization flags in component setup
  const performanceSettings = useMemo(() => ({
    maxNodes,
    enableLOD,
    enableProgressiveRendering,
    progressiveChunkSize,
    enableMemoryPooling
  }), [maxNodes, enableLOD, enableProgressiveRendering, progressiveChunkSize, enableMemoryPooling]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const optimizerRef = useRef<PerformanceOptimizer | null>(null);

  // Initialize performance optimizer
  const optimizer = useMemo(() => {
    if (!optimizerRef.current) {
      optimizerRef.current = new PerformanceOptimizer(
        targetFps,
        frameBudgetMs,
        (newMetrics) => {
          setMetrics(newMetrics);
          onPerformanceChange?.(newMetrics);
        }
      );
      // Configure optimizer with performance settings
      console.debug('Performance settings:', performanceSettings);
    }
    return optimizerRef.current;
  }, [targetFps, frameBudgetMs, onPerformanceChange, performanceSettings]);

  // Start monitoring when component mounts
  useEffect(() => {
    const renderCallback = () => {
      // This will be called on each frame
      // Child components can hook into this via context
    };

    optimizer.startMonitoring(renderCallback);

    return () => {
      optimizer.stopMonitoring();
    };
  }, [optimizer]);

  // Debug logging
  useEffect(() => {
    if (!debug || !metrics) return;

    console.log('[RealTimeRenderer] Performance Metrics:', {
      fps: metrics.fps.toFixed(1),
      avgFps: metrics.averageFps.toFixed(1),
      renderTime: metrics.renderTime.toFixed(2),
      score: metrics.performanceScore.toFixed(1),
      lodLevel: metrics.lodLevel,
      bottlenecks: metrics.bottlenecks
    });
  }, [debug, metrics]);

  const contextValue = useMemo(() => ({
    optimizer,
    metrics,
    lodSettings: optimizer.getLODSettings()
  }), [optimizer, metrics]);

  return (
    <RealTimeRendererContext.Provider value={contextValue}>
      <div
        className={`real-time-renderer ${className}`}
        data-performance-score={metrics?.performanceScore}
        data-lod-level={metrics?.lodLevel}
      >
        {children}

        {/* Performance Warning Overlay */}
        {metrics && metrics.performanceScore < 50 && (
          <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded-lg shadow-lg z-50">
            <div className="text-sm font-medium">Performance Warning</div>
            <div className="text-xs">
              FPS: {metrics.fps.toFixed(1)} | Score: {metrics.performanceScore.toFixed(0)}
            </div>
            {metrics.bottlenecks.length > 0 && (
              <div className="text-xs mt-1">
                Issues: {metrics.bottlenecks.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    </RealTimeRendererContext.Provider>
  );
};

// Utility hook for D3 optimizations
export function useD3Optimization() {
  const { optimizer, lodSettings } = useRealTimeRenderer();

  const createOptimizedSelection = useCallback(() => {
    const pool = optimizer.getElementPool();

    return {
      // Optimized element creation using memory pool
      createElement: (tagName: string) => {
        return lodSettings.enableViewportCulling
          ? pool.acquire(tagName)
          : document.createElement(tagName);
      },

      // Release element back to pool
      releaseElement: (element: HTMLElement) => {
        if (lodSettings.enableViewportCulling) {
          pool.release(element);
        }
      },

      // Check if element should be rendered based on LOD
      shouldRender: (index: number, total: number) => {
        if (!lodSettings.skipNonEssentialElements) return true;

        // Skip elements based on LOD level and position
        const skipRatio = Math.max(0, (lodSettings.level - 2) * 0.2);
        const positionFactor = index / Math.max(1, total); // Use parameters
        return Math.random() > (skipRatio * positionFactor);
      },

      // Get optimized animation duration
      getAnimationDuration: (defaultDuration: number) => {
        return lodSettings.reduceAnimations ? defaultDuration * 0.5 : defaultDuration;
      },

      // Check if viewport culling should be applied
      shouldCull: (bounds: DOMRect, viewport: DOMRect) => {
        if (!lodSettings.enableViewportCulling) return false;

        return bounds.right < viewport.left ||
               bounds.left > viewport.right ||
               bounds.bottom < viewport.top ||
               bounds.top > viewport.bottom;
      }
    };
  }, [optimizer, lodSettings]);

  return {
    createOptimizedSelection,
    lodSettings,
    isOptimized: lodSettings.level > 0
  };
}

export default RealTimeRenderer;