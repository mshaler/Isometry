/**
 * Performance Monitor for Production Environment
 *
 * Real-time performance tracking, alerting, and regression detection for production systems
 */

import React from 'react';
import { performanceBenchmarks, type BaselineMetrics } from './performance-benchmarks';
import { Environment } from './webview-bridge';
import { DatabaseMode } from '../contexts/EnvironmentContext';

// Extension of Performance API to include memory information
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'regression' | 'threshold' | 'error' | 'memory';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  current: number;
  baseline?: number;
  threshold?: number;
  message: string;
  timestamp: number;
  resolved?: boolean;
}

export interface PerformanceSession {
  id: string;
  startTime: number;
  endTime?: number;
  metrics: SessionMetrics;
  alerts: PerformanceAlert[];
  environment: string;
}

export interface SessionMetrics {
  // Core performance metrics
  frameRateMin: number;
  frameRateAvg: number;
  frameRateMax: number;
  memoryUsageMin: number;
  memoryUsageAvg: number;
  memoryUsageMax: number;
  memoryLeaks: number;

  // User interaction metrics
  inputLatencyP50: number;
  inputLatencyP90: number;
  inputLatencyP99: number;

  // Database metrics
  queryCount: number;
  queryLatencyAvg: number;
  queryErrorRate: number;

  // Sync metrics
  syncOperations: number;
  syncFailures: number;
  syncLatencyAvg: number;

  // UI metrics
  renderCount: number;
  renderLatencyAvg: number;
  layoutShifts: number;
}

export interface PerformanceConfig {
  enableRealTimeMonitoring: boolean;
  alertThresholds: Record<string, number>;
  sampleRate: number; // 0.1 = 10% sampling
  maxSessionDuration: number; // milliseconds
  maxAlerts: number;
  enableMemoryProfiling: boolean;
  enableRegressionDetection: boolean;
}

const DEFAULT_CONFIG: PerformanceConfig = {
  enableRealTimeMonitoring: true,
  alertThresholds: {
    frameRate: 30, // FPS below 30
    memoryUsage: 100, // MB above 100
    inputLatency: 100, // ms above 100
    queryLatency: 1000, // ms above 1 second
    syncLatency: 500, // ms above 500
    errorRate: 5 // % above 5%
  },
  sampleRate: 0.1, // 10% sampling in production
  maxSessionDuration: 30 * 60 * 1000, // 30 minutes
  maxAlerts: 50,
  enableMemoryProfiling: Environment.isWebView(),
  enableRegressionDetection: true
};

/**
 * Production Performance Monitor
 */
export class PerformanceMonitor {
  private config: PerformanceConfig;
  private isMonitoring = false;
  private currentSession: PerformanceSession | null = null;
  private alerts = new Map<string, PerformanceAlert>();
  // private metricsBuffer: SessionMetrics[] = [];

  // Monitoring intervals
  private frameRateMonitor: number | null = null;
  private memoryMonitor: NodeJS.Timeout | null = null;
  private regressionChecker: NodeJS.Timeout | null = null;

  // Performance observers
  private performanceObserver: PerformanceObserver | null = null;
  // private intersectionObserver: IntersectionObserver | null = null;

  // Metrics tracking
  private frameRates: number[] = [];
  private memoryReadings: number[] = [];
  private inputLatencies: number[] = [];
  private queryMetrics: { latency: number; success: boolean }[] = [];
  private syncMetrics: { latency: number; success: boolean }[] = [];
  private renderMetrics: { latency: number; count: number }[] = [];

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupPerformanceObservers();
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    // Sampling check - only monitor a percentage of sessions
    if (Math.random() > this.config.sampleRate) {
      console.log('Performance monitoring skipped (sampling)');
      return;
    }

    console.log('🚀 Starting performance monitoring...');

    this.isMonitoring = true;
    this.currentSession = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      metrics: this.createEmptyMetrics(),
      alerts: [],
      environment: Environment.isWebView() ? 'native' : 'browser'
    };

    // Start monitoring intervals
    this.startFrameRateMonitoring();
    this.startMemoryMonitoring();
    this.startRegressionDetection();

    // Auto-stop after max duration
    setTimeout(() => {
      this.stopMonitoring();
    }, this.config.maxSessionDuration);
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring(): Promise<PerformanceSession | null> {
    if (!this.isMonitoring || !this.currentSession) {
      return null;
    }

    console.log('🛑 Stopping performance monitoring...');

    this.isMonitoring = false;

    // Stop intervals
    if (this.frameRateMonitor) {
      cancelAnimationFrame(this.frameRateMonitor);
      this.frameRateMonitor = null;
    }
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
    }
    if (this.regressionChecker) {
      clearInterval(this.regressionChecker);
      this.regressionChecker = null;
    }

    // Finalize session
    this.currentSession.endTime = Date.now();
    this.currentSession.metrics = this.calculateSessionMetrics();
    this.currentSession.alerts = Array.from(this.alerts.values());

    const session = this.currentSession;

    // Store performance baseline if enabled
    if (this.config.enableRegressionDetection) {
      await this.storePerformanceBaseline(session.metrics);
    }

    // Generate performance report
    this.generatePerformanceReport(session);

    // Reset for next session
    this.currentSession = null;
    this.alerts.clear();
    this.resetMetricsBuffers();

    return session;
  }

  /**
   * Record database query performance
   */
  recordDatabaseQuery(latency: number, success: boolean): void {
    if (!this.isMonitoring) return;

    this.queryMetrics.push({ latency, success });

    // Check thresholds
    if (latency > this.config.alertThresholds.queryLatency) {
      this.createAlert('threshold', 'medium', 'queryLatency', latency, {
        threshold: this.config.alertThresholds.queryLatency,
        message: `Database query latency ${latency}ms exceeds threshold ${this.config.alertThresholds.queryLatency}ms`
      });
    }
  }

  /**
   * Record sync operation performance
   */
  recordSyncOperation(latency: number, success: boolean): void {
    if (!this.isMonitoring) return;

    this.syncMetrics.push({ latency, success });

    if (latency > this.config.alertThresholds.syncLatency) {
      this.createAlert('threshold', 'medium', 'syncLatency', latency, {
        threshold: this.config.alertThresholds.syncLatency,
        message: `Sync latency ${latency}ms exceeds threshold ${this.config.alertThresholds.syncLatency}ms`
      });
    }
  }

  /**
   * Record user input latency
   */
  recordInputLatency(latency: number): void {
    if (!this.isMonitoring) return;

    this.inputLatencies.push(latency);

    if (latency > this.config.alertThresholds.inputLatency) {
      this.createAlert('threshold', 'medium', 'inputLatency', latency, {
        threshold: this.config.alertThresholds.inputLatency,
        message: `Input latency ${latency}ms affects user experience`
      });
    }
  }

  /**
   * Record render performance
   */
  recordRender(latency: number, componentCount: number): void {
    if (!this.isMonitoring) return;

    this.renderMetrics.push({ latency, count: componentCount });
  }

  /**
   * Get current performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve performance alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      console.log(`✅ Performance alert resolved: ${alert.message}`);
    }
  }

  /**
   * Get current session metrics
   */
  getCurrentMetrics(): SessionMetrics | null {
    if (!this.currentSession) {
      return null;
    }
    return this.calculateSessionMetrics();
  }

  /**
   * Force performance regression check
   */
  async checkPerformanceRegression(): Promise<void> {
    if (!this.config.enableRegressionDetection || !this.currentSession) {
      return;
    }

    try {
      // Get baseline metrics
      const currentMetrics = this.calculateSessionMetrics();
      const baselineMetrics = this.createBaselineFromSession(currentMetrics);

      // Compare against stored baselines
      const comparison = await performanceBenchmarks.compareAgainstBaseline(
        DatabaseMode.WEBVIEW_BRIDGE,
        baselineMetrics
      );

      // Create alerts for regressions
      for (const detail of comparison.regression.details) {
        if (detail.severity === 'severe' || detail.severity === 'moderate') {
          this.createAlert('regression', detail.severity === 'severe' ? 'high' : 'medium', detail.metric, detail.current, {
            baseline: detail.baseline,
            message: `Performance regression: ${detail.metric} degraded by ${detail.change.toFixed(1)}%`
          });
        }
      }
    } catch (error) {
      console.warn('Performance regression check failed:', error);
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setupPerformanceObservers(): void {
    if (typeof window === 'undefined') return;

    try {
      // Performance Observer for navigation and resource timing
      if ('PerformanceObserver' in window) {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure') {
              this.recordRender(entry.duration, 1);
            } else if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              console.log(`Navigation timing: ${navEntry.loadEventEnd - navEntry.loadEventStart}ms`);
            }
          }
        });

        this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
      }

      // Layout shift detection (commented out - not implemented yet)
      // if ('IntersectionObserver' in window) {
      //   this.intersectionObserver = new IntersectionObserver((entries) => {
      //     // Track layout shifts for stability metrics
      //     for (const entry of entries) {
      //       if (entry.intersectionRatio !== 1) {
      //         // Layout shift detected - would need more sophisticated tracking
      //       }
      //     }
      //   });
      // }
    } catch (error) {
      console.warn('Failed to setup performance observers:', error);
    }
  }

  private startFrameRateMonitoring(): void {
    let frameCount = 0;
    let lastTime = performance.now();

    const monitorFrame = () => {
      const currentTime = performance.now();
      frameCount++;

      // Calculate FPS every second
      if (currentTime - lastTime >= 1000) {
        const fps = frameCount;
        this.frameRates.push(fps);
        frameCount = 0;
        lastTime = currentTime;

        // Check threshold
        if (fps < this.config.alertThresholds.frameRate) {
          this.createAlert('threshold', 'medium', 'frameRate', fps, {
            threshold: this.config.alertThresholds.frameRate,
            message: `Frame rate dropped to ${fps} FPS`
          });
        }
      }

      if (this.isMonitoring) {
        this.frameRateMonitor = requestAnimationFrame(monitorFrame);
      }
    };

    this.frameRateMonitor = requestAnimationFrame(monitorFrame);
  }

  private startMemoryMonitoring(): void {
    if (!this.config.enableMemoryProfiling) return;

    this.memoryMonitor = setInterval(() => {
      const memoryInfo = (performance as PerformanceWithMemory).memory;
      if (memoryInfo) {
        const usedMB = memoryInfo.usedJSHeapSize / 1024 / 1024;
        this.memoryReadings.push(usedMB);

        if (usedMB > this.config.alertThresholds.memoryUsage) {
          this.createAlert('memory', 'high', 'memoryUsage', usedMB, {
            threshold: this.config.alertThresholds.memoryUsage,
            message: `Memory usage ${usedMB.toFixed(1)}MB exceeds threshold`
          });
        }
      }
    }, 5000); // Check every 5 seconds
  }

  private startRegressionDetection(): void {
    if (!this.config.enableRegressionDetection) return;

    this.regressionChecker = setInterval(() => {
      this.checkPerformanceRegression();
    }, 60000); // Check every minute
  }

  private createAlert(type: PerformanceAlert['type'], severity: PerformanceAlert['severity'], metric: string, current: number, options: {
    baseline?: number;
    threshold?: number;
    message: string;
  }): void {
    const alertId = `${type}-${metric}-${Date.now()}`;

    if (this.alerts.size >= this.config.maxAlerts) {
      // Remove oldest alert
      const oldestAlert = Array.from(this.alerts.values())[0];
      this.alerts.delete(oldestAlert.id);
    }

    const alert: PerformanceAlert = {
      id: alertId,
      type,
      severity,
      metric,
      current,
      baseline: options.baseline,
      threshold: options.threshold,
      message: options.message,
      timestamp: Date.now()
    };

    this.alerts.set(alertId, alert);
    console.warn(`⚠️ Performance Alert [${severity}]: ${options.message}`);

    // Dispatch event for UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-alert', { detail: alert }));
    }
  }

  private calculateSessionMetrics(): SessionMetrics {
    return {
      frameRateMin: this.frameRates.length > 0 ? Math.min(...this.frameRates) : 0,
      frameRateAvg: this.frameRates.length > 0
        ? this.frameRates.reduce((a, b) => a + b, 0) / this.frameRates.length
        : 0,
      frameRateMax: this.frameRates.length > 0 ? Math.max(...this.frameRates) : 0,

      memoryUsageMin: this.memoryReadings.length > 0 ? Math.min(...this.memoryReadings) : 0,
      memoryUsageAvg: this.memoryReadings.length > 0
        ? this.memoryReadings.reduce((a, b) => a + b, 0) / this.memoryReadings.length
        : 0,
      memoryUsageMax: this.memoryReadings.length > 0 ? Math.max(...this.memoryReadings) : 0,
      memoryLeaks: this.detectMemoryLeaks(),

      inputLatencyP50: this.calculatePercentile(this.inputLatencies, 50),
      inputLatencyP90: this.calculatePercentile(this.inputLatencies, 90),
      inputLatencyP99: this.calculatePercentile(this.inputLatencies, 99),

      queryCount: this.queryMetrics.length,
      queryLatencyAvg: this.queryMetrics.length > 0
        ? this.queryMetrics.reduce((a, b) => a + b.latency, 0) / this.queryMetrics.length
        : 0,
      queryErrorRate: this.queryMetrics.length > 0
        ? (this.queryMetrics.filter(q => !q.success).length / this.queryMetrics.length) * 100
        : 0,

      syncOperations: this.syncMetrics.length,
      syncFailures: this.syncMetrics.filter(s => !s.success).length,
      syncLatencyAvg: this.syncMetrics.length > 0
        ? this.syncMetrics.reduce((a, b) => a + b.latency, 0) / this.syncMetrics.length
        : 0,

      renderCount: this.renderMetrics.length,
      renderLatencyAvg: this.renderMetrics.length > 0
        ? this.renderMetrics.reduce((a, b) => a + b.latency, 0) / this.renderMetrics.length
        : 0,
      layoutShifts: 0 // Would need more sophisticated tracking
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private detectMemoryLeaks(): number {
    if (this.memoryReadings.length < 10) return 0;

    // Simple leak detection: continuous growth over time
    const recent = this.memoryReadings.slice(-10);
    const trend = recent.slice(1).reduce((leaks, current, index) => {
      return current > recent[index] ? leaks + 1 : leaks;
    }, 0);

    return trend > 7 ? 1 : 0; // If 7 out of 9 readings show growth
  }

  private createEmptyMetrics(): SessionMetrics {
    return {
      frameRateMin: 0,
      frameRateAvg: 0,
      frameRateMax: 0,
      memoryUsageMin: 0,
      memoryUsageAvg: 0,
      memoryUsageMax: 0,
      memoryLeaks: 0,
      inputLatencyP50: 0,
      inputLatencyP90: 0,
      inputLatencyP99: 0,
      queryCount: 0,
      queryLatencyAvg: 0,
      queryErrorRate: 0,
      syncOperations: 0,
      syncFailures: 0,
      syncLatencyAvg: 0,
      renderCount: 0,
      renderLatencyAvg: 0,
      layoutShifts: 0
    };
  }

  private createBaselineFromSession(metrics: SessionMetrics): BaselineMetrics {
    return {
      bridgeLatency: metrics.inputLatencyP90,
      databaseLatency: metrics.queryLatencyAvg,
      syncLatency: metrics.syncLatencyAvg,
      uiLatency: metrics.renderLatencyAvg,
      databaseThroughput: metrics.queryCount > 0
        ? (metrics.queryCount / ((this.currentSession!.endTime || Date.now()) - this.currentSession!.startTime)) * 1000
        : 0,
      syncThroughput: metrics.syncOperations > 0
        ? (metrics.syncOperations
          / ((this.currentSession!.endTime || Date.now()) - this.currentSession!.startTime)) * 1000
        : 0,
      memoryUsage: metrics.memoryUsageAvg,
      memoryLeakRate: metrics.memoryLeaks,
      fps: metrics.frameRateAvg,
      frameDrops: Math.max(0, 60 - metrics.frameRateMin),
      successRate: metrics.queryCount > 0
        ? ((metrics.queryCount - (metrics.queryCount * metrics.queryErrorRate / 100)) / metrics.queryCount) * 100
        : 100,
      errorRate: metrics.queryErrorRate
    };
  }

  private async storePerformanceBaseline(metrics: SessionMetrics): Promise<void> {
    try {
      const baselineMetrics = this.createBaselineFromSession(metrics);
      await performanceBenchmarks.storeBaseline(DatabaseMode.WEBVIEW_BRIDGE, baselineMetrics, {
        testCases: metrics.queryCount + metrics.syncOperations,
        duration: (this.currentSession!.endTime || Date.now()) - this.currentSession!.startTime,
        dataSize: metrics.queryCount,
        concurrency: 1,
        notes: `Production session: ${this.currentSession!.id}`
      });
    } catch (error) {
      console.warn('Failed to store performance baseline:', error);
    }
  }

  private generatePerformanceReport(session: PerformanceSession): void {
    const duration = (session.endTime! - session.startTime) / 1000;

    console.log(`📊 Performance Report - Session ${session.id.slice(-8)}`);
    console.log(`Duration: ${duration.toFixed(1)}s`);
    console.log(`Frame Rate: ${session.metrics.frameRateMin}-${session.metrics.frameRateMax} FPS (avg: ${session.metrics.frameRateAvg.toFixed(1)})`);
    console.log(`Memory: ${session.metrics.memoryUsageMin.toFixed(1)}-${session.metrics.memoryUsageMax.toFixed(1)} MB (avg: ${session.metrics.memoryUsageAvg.toFixed(1)})`);
    console.log(`Input Latency P90: ${session.metrics.inputLatencyP90.toFixed(1)}ms`);
    console.log(`Query Performance: ${session.metrics.queryCount} queries, ${session.metrics.queryLatencyAvg.toFixed(1)}ms avg, ${session.metrics.queryErrorRate.toFixed(1)}% error rate`);
    console.log(`Sync Performance: ${session.metrics.syncOperations} operations, ${session.metrics.syncFailures} failures`);
    console.log(`Alerts: ${session.alerts.length}`);
  }

  private resetMetricsBuffers(): void {
    this.frameRates = [];
    this.memoryReadings = [];
    this.inputLatencies = [];
    this.queryMetrics = [];
    this.syncMetrics = [];
    this.renderMetrics = [];
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitoring() {
  const [alerts, setAlerts] = React.useState<PerformanceAlert[]>([]);
  const [currentMetrics, setCurrentMetrics] = React.useState<SessionMetrics | null>(null);

  React.useEffect(() => {
    const handleAlert = (event: CustomEvent) => {
      setAlerts(prev => [...prev, event.detail]);
    };

    window.addEventListener('performance-alert', handleAlert as EventListener);
    return () => window.removeEventListener('performance-alert', handleAlert as EventListener);
  }, []);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMetrics(performanceMonitor.getCurrentMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    alerts,
    currentMetrics,
    startMonitoring: () => performanceMonitor.startMonitoring(),
    stopMonitoring: () => performanceMonitor.stopMonitoring(),
    recordDatabaseQuery: (latency: number, success: boolean) =>
      performanceMonitor.recordDatabaseQuery(latency, success),
    recordSyncOperation: (latency: number, success: boolean) =>
      performanceMonitor.recordSyncOperation(latency, success),
    recordInputLatency: (latency: number) =>
      performanceMonitor.recordInputLatency(latency),
    resolveAlert: (alertId: string) =>
      performanceMonitor.resolveAlert(alertId),
    checkRegression: () =>
      performanceMonitor.checkPerformanceRegression()
  };
}