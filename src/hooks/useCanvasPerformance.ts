/**
 * Canvas Performance Monitoring Hook
 *
 * Comprehensive performance monitoring for the Canvas component with real-time
 * FPS tracking, memory usage monitoring, and automatic performance profiling.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export interface CanvasPerformanceMetrics {
  /** Current frames per second */
  fps: number;
  /** Average FPS over last 60 frames */
  averageFps: number;
  /** Current render time in milliseconds */
  renderTime: number;
  /** Average render time over recent frames */
  averageRenderTime: number;
  /** Current memory usage in bytes */
  memoryUsage: number;
  /** Number of DOM nodes currently rendered */
  domNodeCount: number;
  /** Number of data nodes being processed */
  nodeCount: number;
  /** Data throughput (nodes processed per second) */
  nodesThroughput: number;
  /** Overall performance score (0-100) */
  performanceScore: number;
  /** Current performance quality level */
  qualityLevel: 'high' | 'medium' | 'low' | 'critical';
  /** Identified performance bottlenecks */
  bottlenecks: string[];
  /** Whether automatic optimization is active */
  autoOptimizeActive: boolean;
  /** Performance trend over time */
  trend: 'improving' | 'stable' | 'degrading';
  /** Detailed breakdown of render phases */
  renderBreakdown: RenderPhaseMetrics;
}

export interface RenderPhaseMetrics {
  dataProcessing: number;
  domManipulation: number;
  painting: number;
  layoutRecalc: number;
  scriptExecution: number;
}

export interface CanvasPerformanceOptions {
  /** Target FPS for performance scoring (default: 60) */
  targetFps?: number;
  /** How often to update metrics in ms (default: 1000) */
  updateInterval?: number;
  /** Number of frames to average over (default: 60) */
  sampleSize?: number;
  /** Enable automatic quality adjustment (default: true) */
  enableAutoOptimize?: boolean;
  /** Memory usage warning threshold in MB (default: 100) */
  memoryWarningThreshold?: number;
  /** Enable detailed render phase timing (default: false) */
  enableDetailedTiming?: boolean;
  /** Callback for performance warnings */
  onPerformanceWarning?: (issue: string, severity: 'warning' | 'critical') => void;
}

// Performance data collection and analysis
class CanvasPerformanceAnalyzer {
  private frameTimeHistory: number[] = [];
  private renderTimeHistory: number[] = [];
  private memoryHistory: number[] = [];
  private nodeCountHistory: number[] = [];
  private lastFrameTime = 0;
  private lastNodeCount = 0;
  private lastUpdateTime = 0;
  private animationFrameId: number | null = null;
  private isMonitoring = false;

  // Performance tracking
  private performanceObserver: PerformanceObserver | null = null;
  private renderPhaseMetrics: RenderPhaseMetrics = {
    dataProcessing: 0,
    domManipulation: 0,
    painting: 0,
    layoutRecalc: 0,
    scriptExecution: 0
  };

  constructor(
    private sampleSize: number = 60,
    private enableDetailedTiming: boolean = false
  ) {
    this.setupPerformanceObserver();
  }

  private setupPerformanceObserver(): void {
    if (!this.enableDetailedTiming || typeof PerformanceObserver === 'undefined') {
      return;
    }

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        entries.forEach((entry) => {
          switch (entry.entryType) {
            case 'measure':
              this.processMeasureEntry(entry as PerformanceMeasure);
              break;
            case 'paint':
              this.processPaintEntry(entry as PerformanceEntry);
              break;
            case 'layout-shift':
              this.processLayoutEntry(entry);
              break;
          }
        });
      });

      this.performanceObserver.observe({
        entryTypes: ['measure', 'paint', 'layout-shift']
      });
    } catch (error) {
      console.warn('[CanvasPerformance] Performance Observer not supported:', error);
    }
  }

  private processMeasureEntry(entry: PerformanceMeasure): void {
    const { name, duration } = entry;

    if (name.includes('data-processing')) {
      this.renderPhaseMetrics.dataProcessing = duration;
    } else if (name.includes('dom-manipulation')) {
      this.renderPhaseMetrics.domManipulation = duration;
    } else if (name.includes('script-execution')) {
      this.renderPhaseMetrics.scriptExecution = duration;
    }
  }

  private processPaintEntry(entry: PerformanceEntry): void {
    if (entry.name === 'first-contentful-paint' || entry.name === 'largest-contentful-paint') {
      this.renderPhaseMetrics.painting = entry.startTime;
    }
  }

  private processLayoutEntry(entry: PerformanceEntry): void {
    this.renderPhaseMetrics.layoutRecalc = entry.startTime;
  }

  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    this.measureFrame();
  }

  stop(): void {
    this.isMonitoring = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }

  private measureFrame = (): void => {
    if (!this.isMonitoring) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;

    // Record frame time
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.sampleSize) {
      this.frameTimeHistory.shift();
    }

    this.lastFrameTime = now;

    // Schedule next measurement
    this.animationFrameId = requestAnimationFrame(this.measureFrame);
  };

  recordRenderTime(time: number): void {
    this.renderTimeHistory.push(time);
    if (this.renderTimeHistory.length > this.sampleSize) {
      this.renderTimeHistory.shift();
    }
  }

  recordNodeCount(count: number): void {
    this.nodeCountHistory.push(count);
    if (this.nodeCountHistory.length > this.sampleSize) {
      this.nodeCountHistory.shift();
    }
    this.lastNodeCount = count;
  }

  recordMemoryUsage(): void {
    const memoryInfo = (performance as any).memory;
    if (memoryInfo) {
      this.memoryHistory.push(memoryInfo.usedJSHeapSize);
      if (this.memoryHistory.length > this.sampleSize) {
        this.memoryHistory.shift();
      }
    }
  }

  getMetrics(): CanvasPerformanceMetrics {
    const fps = this.frameTimeHistory.length > 0
      ? 1000 / (this.frameTimeHistory[this.frameTimeHistory.length - 1] || 16.67)
      : 0;

    const averageFps = this.frameTimeHistory.length > 0
      ? 1000 / (this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length)
      : 0;

    const renderTime = this.renderTimeHistory[this.renderTimeHistory.length - 1] || 0;
    const averageRenderTime = this.renderTimeHistory.length > 0
      ? this.renderTimeHistory.reduce((sum, time) => sum + time, 0) / this.renderTimeHistory.length
      : 0;

    const memoryUsage = this.memoryHistory[this.memoryHistory.length - 1] || 0;
    const nodeCount = this.nodeCountHistory[this.nodeCountHistory.length - 1] || 0;

    // Calculate throughput (nodes per second)
    const nodesThroughput = this.calculateThroughput();

    // Calculate performance score
    const performanceScore = this.calculatePerformanceScore(averageFps, averageRenderTime, memoryUsage);

    // Determine quality level
    const qualityLevel = this.determineQualityLevel(performanceScore, averageFps);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(averageFps, averageRenderTime, memoryUsage);

    // Calculate trend
    const trend = this.calculateTrend();

    return {
      fps,
      averageFps,
      renderTime,
      averageRenderTime,
      memoryUsage,
      domNodeCount: this.getDOMNodeCount(),
      nodeCount,
      nodesThroughput,
      performanceScore,
      qualityLevel,
      bottlenecks,
      autoOptimizeActive: false, // Will be set by the hook
      trend,
      renderBreakdown: { ...this.renderPhaseMetrics }
    };
  }

  private calculateThroughput(): number {
    const now = performance.now();
    const timeDiff = now - this.lastUpdateTime;

    if (timeDiff === 0 || this.nodeCountHistory.length < 2) return 0;

    const nodeCountDiff = this.lastNodeCount - (this.nodeCountHistory[0] || 0);
    this.lastUpdateTime = now;

    return (nodeCountDiff / timeDiff) * 1000; // nodes per second
  }

  private calculatePerformanceScore(averageFps: number, averageRenderTime: number, memoryUsage: number): number {
    let score = 100;

    // FPS penalty (40% weight)
    if (averageFps < 60) {
      score -= ((60 - averageFps) / 60) * 40;
    }

    // Render time penalty (30% weight)
    if (averageRenderTime > 16.67) {
      score -= ((averageRenderTime - 16.67) / 16.67) * 30;
    }

    // Memory penalty (20% weight)
    const memoryMB = memoryUsage / (1024 * 1024);
    if (memoryMB > 50) {
      score -= Math.min((memoryMB - 50) / 50 * 20, 20);
    }

    // Stability penalty (10% weight)
    const fpsStability = this.calculateFPSStability();
    if (fpsStability < 0.8) {
      score -= (1 - fpsStability) * 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateFPSStability(): number {
    if (this.frameTimeHistory.length < 10) return 1;

    const fps = this.frameTimeHistory.map(time => 1000 / time);
    const avgFps = fps.reduce((sum, f) => sum + f, 0) / fps.length;
    const variance = fps.reduce((sum, f) => sum + Math.pow(f - avgFps, 2), 0) / fps.length;
    const standardDeviation = Math.sqrt(variance);

    // Lower standard deviation = higher stability
    return Math.max(0, 1 - (standardDeviation / avgFps));
  }

  private determineQualityLevel(score: number, averageFps: number): 'high' | 'medium' | 'low' | 'critical' {
    if (score >= 80 && averageFps >= 55) return 'high';
    if (score >= 60 && averageFps >= 45) return 'medium';
    if (score >= 40 && averageFps >= 30) return 'low';
    return 'critical';
  }

  private identifyBottlenecks(averageFps: number, averageRenderTime: number, memoryUsage: number): string[] {
    const bottlenecks: string[] = [];

    if (averageFps < 45) {
      bottlenecks.push('Low FPS');
    }

    if (averageRenderTime > 25) {
      bottlenecks.push('Slow rendering');
    }

    const memoryMB = memoryUsage / (1024 * 1024);
    if (memoryMB > 100) {
      bottlenecks.push('High memory usage');
    }

    if (this.calculateFPSStability() < 0.7) {
      bottlenecks.push('Unstable frame rate');
    }

    if (this.getDOMNodeCount() > 5000) {
      bottlenecks.push('Too many DOM nodes');
    }

    return bottlenecks;
  }

  private calculateTrend(): 'improving' | 'stable' | 'degrading' {
    if (this.frameTimeHistory.length < 30) return 'stable';

    const recent = this.frameTimeHistory.slice(-15);
    const older = this.frameTimeHistory.slice(-30, -15);

    const recentAvg = recent.reduce((sum, time) => sum + time, 0) / recent.length;
    const olderAvg = older.reduce((sum, time) => sum + time, 0) / older.length;

    const improvement = (olderAvg - recentAvg) / olderAvg;

    if (improvement > 0.05) return 'improving';
    if (improvement < -0.05) return 'degrading';
    return 'stable';
  }

  private getDOMNodeCount(): number {
    return document.getElementsByTagName('*').length;
  }

  cleanup(): void {
    this.stop();
    this.frameTimeHistory = [];
    this.renderTimeHistory = [];
    this.memoryHistory = [];
    this.nodeCountHistory = [];
  }
}

/**
 * Canvas Performance Monitoring Hook
 */
export function useCanvasPerformance(options: CanvasPerformanceOptions = {}) {
  const {
    updateInterval = 1000,
    sampleSize = 60,
    memoryWarningThreshold = 100,
    enableDetailedTiming = false,
    onPerformanceWarning
  } = options;

  const [metrics, setMetrics] = useState<CanvasPerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [autoOptimizeActive, setAutoOptimizeActive] = useState(false);

  const analyzerRef = useRef<CanvasPerformanceAnalyzer | null>(null);
  const updateTimerRef = useRef<NodeJS.Timeout>();

  // Initialize analyzer
  const analyzer = useMemo(() => {
    if (!analyzerRef.current) {
      analyzerRef.current = new CanvasPerformanceAnalyzer(sampleSize, enableDetailedTiming);
    }
    return analyzerRef.current;
  }, [sampleSize, enableDetailedTiming]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    analyzer.start();
    setIsMonitoring(true);

    // Update metrics periodically
    updateTimerRef.current = setInterval(() => {
      const currentMetrics = analyzer.getMetrics();
      setMetrics({ ...currentMetrics, autoOptimizeActive });

      // Check for performance warnings
      if (onPerformanceWarning) {
        const { performanceScore, qualityLevel, bottlenecks } = currentMetrics;

        if (qualityLevel === 'critical') {
          onPerformanceWarning('Performance critical - consider reducing data complexity', 'critical');
        } else if (performanceScore < 50) {
          onPerformanceWarning(`Performance degraded: ${bottlenecks.join(', ')}`, 'warning');
        }

        const memoryMB = currentMetrics.memoryUsage / (1024 * 1024);
        if (memoryMB > memoryWarningThreshold) {
          onPerformanceWarning(`High memory usage: ${memoryMB.toFixed(1)}MB`, 'warning');
        }
      }
    }, updateInterval);
  }, [isMonitoring, analyzer, updateInterval, autoOptimizeActive, onPerformanceWarning, memoryWarningThreshold]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;

    analyzer.stop();
    setIsMonitoring(false);

    if (updateTimerRef.current) {
      clearInterval(updateTimerRef.current);
    }
  }, [isMonitoring, analyzer]);

  // Record render timing
  const recordRender = useCallback((renderTime: number, nodeCount: number) => {
    analyzer.recordRenderTime(renderTime);
    analyzer.recordNodeCount(nodeCount);
    analyzer.recordMemoryUsage();
  }, [analyzer]);

  // Auto-optimization control
  const enableAutoOptimization = useCallback(() => {
    setAutoOptimizeActive(true);
  }, []);

  const disableAutoOptimization = useCallback(() => {
    setAutoOptimizeActive(false);
  }, []);

  // Get quality recommendations
  const getOptimizationRecommendations = useCallback((): string[] => {
    if (!metrics) return [];

    const recommendations: string[] = [];

    if (metrics.averageFps < 45) {
      recommendations.push('Enable Level of Detail (LOD) rendering');
      recommendations.push('Reduce number of rendered elements');
    }

    if (metrics.averageRenderTime > 25) {
      recommendations.push('Use requestAnimationFrame for animations');
      recommendations.push('Batch DOM updates');
    }

    if (metrics.memoryUsage > 100 * 1024 * 1024) {
      recommendations.push('Enable object pooling');
      recommendations.push('Clean up unused references');
    }

    if (metrics.domNodeCount > 5000) {
      recommendations.push('Implement virtual scrolling');
      recommendations.push('Use viewport culling');
    }

    return recommendations;
  }, [metrics]);

  // Performance summary for display
  const getPerformanceSummary = useCallback(() => {
    if (!metrics) return null;

    return {
      status: metrics.qualityLevel,
      score: Math.round(metrics.performanceScore),
      fps: Math.round(metrics.averageFps),
      renderTime: Math.round(metrics.averageRenderTime),
      memoryMB: Math.round(metrics.memoryUsage / (1024 * 1024)),
      nodeCount: metrics.nodeCount,
      issues: metrics.bottlenecks.length,
      trend: metrics.trend
    };
  }, [metrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
      analyzer.cleanup();
    };
  }, [stopMonitoring, analyzer]);

  return {
    metrics,
    isMonitoring,
    autoOptimizeActive,
    startMonitoring,
    stopMonitoring,
    recordRender,
    enableAutoOptimization,
    disableAutoOptimization,
    getOptimizationRecommendations,
    getPerformanceSummary
  };
}

export default useCanvasPerformance;