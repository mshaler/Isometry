/**
 * Simple Performance Monitor for sql.js + D3.js
 *
 * Essential performance monitoring without bridge dependencies
 * Focus on core metrics: query time, memory usage, render performance
 */

// No bridge dependencies - direct sql.js + D3.js access

export interface SimplePerformanceAlert {
  id: string;
  type: 'query' | 'memory' | 'render' | 'error';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
  resolved?: boolean;
}

export interface SimpleSessionMetrics {
  // Core metrics
  queryTimeAvg: number;
  queryTimeMax: number;
  memoryUsageMB: number;
  renderTimeAvg: number;
  frameRate: number;

  // Counts
  queryCount: number;
  renderCount: number;
  errorCount: number;
}

export interface SimplePerformanceConfig {
  alertThresholds: {
    queryTime: number;     // ms
    memoryUsage: number;   // MB
    renderTime: number;    // ms
  };
  maxAlerts: number;
  sampleRate: number; // 0.1 = 10%
}

const DEFAULT_CONFIG: SimplePerformanceConfig = {
  alertThresholds: {
    queryTime: 100,    // 100ms
    memoryUsage: 200,  // 200MB
    renderTime: 20     // 20ms = ~50fps
  },
  maxAlerts: 20,
  sampleRate: 1.0 // 100% in simplified mode
};

/**
 * Simple Performance Monitor
 */
export class SimplePerformanceMonitor {
  private config: SimplePerformanceConfig;
  private isMonitoring = false;
  private sessionStartTime = 0;
  private alerts = new Map<string, SimplePerformanceAlert>();

  // Metrics tracking
  private queryTimes: number[] = [];
  private memoryReadings: number[] = [];
  private renderTimes: number[] = [];
  private frameRates: number[] = [];
  private errorCount = 0;

  constructor(config?: Partial<SimplePerformanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    // Sampling check
    if (Math.random() > this.config.sampleRate) {
      console.log('Performance monitoring skipped (sampling)');
      return;
    }

    console.log('🚀 Starting simple performance monitoring...');

    this.isMonitoring = true;
    this.sessionStartTime = Date.now();
    this.resetMetrics();
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring(): Promise<SimpleSessionMetrics | null> {
    if (!this.isMonitoring) {
      return null;
    }

    console.log('🛑 Stopping simple performance monitoring...');

    this.isMonitoring = false;

    const sessionMetrics = this.calculateSessionMetrics();

    // Generate simple report
    this.generateSimpleReport(sessionMetrics);

    return sessionMetrics;
  }

  /**
   * Record SQL query performance
   */
  recordQuery(latency: number, success: boolean = true): void {
    if (!this.isMonitoring) return;

    this.queryTimes.push(latency);

    if (!success) {
      this.errorCount++;
    }

    // Check query time threshold
    if (latency > this.config.alertThresholds.queryTime) {
      this.createAlert('query', 'medium', `Slow query: ${latency.toFixed(1)}ms`);
    }
  }

  /**
   * Record render performance
   */
  recordRender(latency: number): void {
    if (!this.isMonitoring) return;

    this.renderTimes.push(latency);

    // Estimate frame rate
    if (latency > 0) {
      const fps = 1000 / latency;
      this.frameRates.push(fps);
    }

    // Check render time threshold
    if (latency > this.config.alertThresholds.renderTime) {
      this.createAlert('render', 'medium', `Slow render: ${latency.toFixed(1)}ms`);
    }
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): number {
    const memory = (performance as any).memory;
    if (!memory) return 0;

    const usageMB = memory.usedJSHeapSize / 1024 / 1024;
    this.memoryReadings.push(usageMB);

    // Check memory threshold
    if (usageMB > this.config.alertThresholds.memoryUsage) {
      this.createAlert('memory', 'medium', `High memory: ${usageMB.toFixed(1)}MB`);
    }

    return usageMB;
  }

  /**
   * Record an error
   */
  recordError(error: string): void {
    if (!this.isMonitoring) return;

    this.errorCount++;
    this.createAlert('error', 'high', `Error: ${error}`);
  }

  /**
   * Get current alerts
   */
  getAlerts(): SimplePerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
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
  getCurrentMetrics(): SimpleSessionMetrics | null {
    if (!this.isMonitoring) {
      return null;
    }
    return this.calculateSessionMetrics();
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private createAlert(type: SimplePerformanceAlert['type'], severity: SimplePerformanceAlert['severity'], message: string): void {
    const alertId = `${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Limit number of alerts
    if (this.alerts.size >= this.config.maxAlerts) {
      // Remove oldest alert
      const oldestAlert = Array.from(this.alerts.values())[0];
      this.alerts.delete(oldestAlert.id);
    }

    const alert: SimplePerformanceAlert = {
      id: alertId,
      type,
      severity,
      message,
      timestamp: Date.now()
    };

    this.alerts.set(alertId, alert);
    console.warn(`⚠️ Performance Alert [${severity}]: ${message}`);

    // Dispatch event for UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('simple-performance-alert', { detail: alert }));
    }
  }

  private calculateSessionMetrics(): SimpleSessionMetrics {
    return {
      queryTimeAvg: this.average(this.queryTimes),
      queryTimeMax: this.queryTimes.length > 0 ? Math.max(...this.queryTimes) : 0,
      memoryUsageMB: this.memoryReadings.length > 0 ? this.memoryReadings[this.memoryReadings.length - 1] : 0,
      renderTimeAvg: this.average(this.renderTimes),
      frameRate: this.average(this.frameRates),
      queryCount: this.queryTimes.length,
      renderCount: this.renderTimes.length,
      errorCount: this.errorCount
    };
  }

  private generateSimpleReport(metrics: SimpleSessionMetrics): void {
    const duration = (Date.now() - this.sessionStartTime) / 1000;

    console.group('📊 Simple Performance Report');
    console.log(`Duration: ${duration.toFixed(1)}s`);
    console.log(`Queries: ${metrics.queryCount} (avg: ${metrics.queryTimeAvg.toFixed(1)}ms, max: ${metrics.queryTimeMax.toFixed(1)}ms)`);
    console.log(`Renders: ${metrics.renderCount} (avg: ${metrics.renderTimeAvg.toFixed(1)}ms, fps: ${metrics.frameRate.toFixed(1)})`);
    console.log(`Memory: ${metrics.memoryUsageMB.toFixed(1)}MB`);
    console.log(`Errors: ${metrics.errorCount}`);
    console.log(`Alerts: ${this.getAlerts().length}`);
    console.groupEnd();
  }

  private resetMetrics(): void {
    this.queryTimes = [];
    this.memoryReadings = [];
    this.renderTimes = [];
    this.frameRates = [];
    this.errorCount = 0;
    this.alerts.clear();
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }
}

/**
 * Global simple performance monitor instance
 */
export const simplePerformanceMonitor = new SimplePerformanceMonitor();

/**
 * Utility functions for common monitoring patterns
 */
export function monitorSQLQuery<T>(queryFn: () => T, queryName?: string): T {
  const start = performance.now();
  try {
    const result = queryFn();
    const duration = performance.now() - start;
    simplePerformanceMonitor.recordQuery(duration, true);

    if (duration > 50) { // Log slow queries
      console.log(`🐌 Slow query${queryName ? ` (${queryName})` : ''}: ${duration.toFixed(1)}ms`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    simplePerformanceMonitor.recordQuery(duration, false);
    simplePerformanceMonitor.recordError(`Query failed: ${error}`);
    throw error;
  }
}

export function monitorD3Render<T>(renderFn: () => T, renderName?: string): T {
  const start = performance.now();
  try {
    const result = renderFn();
    const duration = performance.now() - start;
    simplePerformanceMonitor.recordRender(duration);

    if (duration > 16) { // Log slow renders (60fps = 16ms)
      console.log(`🎨 Slow render${renderName ? ` (${renderName})` : ''}: ${duration.toFixed(1)}ms`);
    }

    return result;
  } catch (error) {
    simplePerformanceMonitor.recordError(`Render failed: ${error}`);
    throw error;
  }
}

export function getPerformanceHealth(): {
  isHealthy: boolean;
  score: number; // 0-100
  issues: string[];
} {
  const metrics = simplePerformanceMonitor.getCurrentMetrics();
  if (!metrics) {
    return { isHealthy: false, score: 0, issues: ['Monitoring not active'] };
  }

  let score = 100;
  const issues: string[] = [];

  // Query performance (30 points)
  if (metrics.queryTimeAvg > 100) {
    score -= 30;
    issues.push(`Slow queries: ${metrics.queryTimeAvg.toFixed(1)}ms avg`);
  } else if (metrics.queryTimeAvg > 50) {
    score -= 15;
    issues.push(`Query performance could be better`);
  }

  // Render performance (30 points)
  if (metrics.renderTimeAvg > 30) {
    score -= 30;
    issues.push(`Slow renders: ${metrics.renderTimeAvg.toFixed(1)}ms avg`);
  } else if (metrics.frameRate < 45) {
    score -= 15;
    issues.push(`Frame rate below 45fps`);
  }

  // Memory usage (25 points)
  if (metrics.memoryUsageMB > 300) {
    score -= 25;
    issues.push(`High memory usage: ${metrics.memoryUsageMB.toFixed(1)}MB`);
  } else if (metrics.memoryUsageMB > 200) {
    score -= 12;
    issues.push(`Elevated memory usage`);
  }

  // Error rate (15 points)
  if (metrics.errorCount > 0) {
    const errorRate = (metrics.errorCount / Math.max(1, metrics.queryCount + metrics.renderCount)) * 100;
    if (errorRate > 5) {
      score -= 15;
      issues.push(`High error rate: ${errorRate.toFixed(1)}%`);
    } else if (errorRate > 1) {
      score -= 8;
      issues.push(`Some errors detected`);
    }
  }

  return {
    isHealthy: score >= 80 && issues.length === 0,
    score: Math.max(0, score),
    issues
  };
}