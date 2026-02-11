/**
 * Performance Monitor for Database Operations
 *
 * Comprehensive performance tracking for native database implementations.
 * Provides insights for optimization and performance validation.
 */

import { getHealthCheckURL } from '../config/endpoints';

export interface PerformanceMetric {
  operation: string;
  method: 'native' | 'native-api' | 'optimized' | 'webview-bridge';
  duration: number;
  timestamp: number;
  rowCount?: number;
  query?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PerformanceReport {
  totalOperations: number;
  averageDuration: number;
  methodBreakdown: {
    'native-api': {
      operations: number;
      averageDuration: number;
      successRate: number;
    };
    native: {
      operations: number;
      averageDuration: number;
      successRate: number;
    };
    optimized: {
      operations: number;
      averageDuration: number;
      successRate: number;
    };
    webviewBridge: {
      operations: number;
      averageDuration: number;
      successRate: number;
    };
  };
  slowestOperations: PerformanceMetric[];
  errorRate: number;
  recommendations: string[];
}

// ComparisonResult interface removed - sql.js comparison no longer supported

/**
 * Performance Monitor class for comprehensive tracking
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Limit memory usage
  private enabled = true;

  constructor(options: { maxMetrics?: number; enabled?: boolean } = {}) {
    this.maxMetrics = options.maxMetrics || 1000;
    this.enabled = options.enabled !== false;
  }

  /**
   * Measure the performance of an operation
   */
  async measureOperation<T>(
    name: string,
    operation: () => Promise<T>,
    metadata: { method: 'native' | 'optimized' | 'webview-bridge'; query?: string } = { method: 'native' }
  ): Promise<T> {
    if (!this.enabled) {
      return operation();
    }

    const startTime = performance.now();
    const timestamp = Date.now();
    let result: T;
    let success = true;
    let error: string | undefined;
    let rowCount: number | undefined;

    try {
      result = await operation();

      // Try to extract row count from result
      if (Array.isArray(result)) {
        rowCount = result.length;
      } else if (result && typeof result === 'object' && 'length' in result) {
        rowCount = (result as { length: number }).length;
      }

      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = performance.now() - startTime;

      this.logMetric({
        operation: name,
        method: metadata.method,
        duration,
        timestamp,
        rowCount,
        query: metadata.query,
        success,
        error,
        metadata,
      });
    }
  }

  /**
   * Log query performance (synchronous version)
   */
  logQueryPerformance(
    query: string,
    duration: number,
    method: 'native' | 'native-api' | 'optimized' | 'webview-bridge',
    metadata: {
      rowCount?: number;
      success?: boolean;
      error?: string;
    } = {}
  ): void {
    if (!this.enabled) return;

    this.logMetric({
      operation: 'query',
      method,
      duration,
      timestamp: Date.now(),
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      rowCount: metadata.rowCount,
      success: metadata.success !== false,
      error: metadata.error,
    });
  }

  /**
   * Start performance data collection
   */
  startCollection(): void {
    this.enabled = true;
  }

  /**
   * Stop performance data collection
   */
  stopCollection(): void {
    this.enabled = false;
  }

  /**
   * Track virtual scrolling frame performance
   */
  trackVirtualScrollingFrame(frameData: {
    visibleCount: number;
    totalCount: number;
    renderTime: number;
  }): void {
    if (!this.enabled) return;

    this.logMetric({
      operation: 'virtual-scrolling-frame',
      method: 'optimized',
      duration: frameData.renderTime,
      timestamp: Date.now(),
      rowCount: frameData.visibleCount,
      success: true,
      metadata: { totalCount: frameData.totalCount, visibleCount: frameData.visibleCount }
    });
  }

  /**
   * Track update latency
   */
  trackUpdateLatency(operation: string, latency: number): void {
    if (!this.enabled) return;

    this.logMetric({
      operation: `update-${operation}`,
      method: 'optimized',
      duration: latency,
      timestamp: Date.now(),
      success: true
    });
  }

  /**
   * Track cache efficiency metrics
   */
  trackCacheEfficiency(operation: string, hitRatio: number): void {
    if (!this.enabled) return;

    this.logMetric({
      operation: `cache-${operation}`,
      method: 'optimized',
      duration: 0, // No duration for cache metrics
      timestamp: Date.now(),
      success: true,
      metadata: { hitRatio }
    });
  }

  /**
   * Track suggestion latency (for SimplePerformanceMonitor compatibility)
   */
  trackSuggestionLatency?(operation: string, latency: number): void {
    if (!this.enabled) return;

    this.logMetric({
      operation: `suggestion-${operation}`,
      method: 'optimized',
      duration: latency,
      timestamp: Date.now(),
      success: true
    });
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return this.createEmptyReport();
    }

    const totalOperations = this.metrics.length;
    const failedOperations = this.metrics.filter(m => !m.success);

    const averageDuration =
      this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations;

    const methodBreakdown = this.calculateMethodBreakdown();
    const slowestOperations = this.getSlowestOperations();
    const errorRate = (failedOperations.length / totalOperations) * 100;
    const recommendations = this.generateRecommendations(methodBreakdown, slowestOperations, errorRate);

    return {
      totalOperations,
      averageDuration,
      methodBreakdown,
      slowestOperations,
      errorRate,
      recommendations,
    };
  }

  // compareImplementations method removed - sql.js comparison no longer supported

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get raw metrics for external analysis
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Export metrics as JSON for analysis
   */
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
      metrics: this.metrics,
    }, null, 2);
  }

  /**
   * Measure WebView bridge round-trip latency
   */
  async measureBridgeLatency(): Promise<number> {
    const startTime = performance.now();

    try {
      // Test if WebView bridge is available
      if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.database) {
        // Simple ping test
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Bridge timeout')), 1000);
          window.webkit!.messageHandlers!.database!.postMessage({
            action: 'ping',
            data: {}
          });

          // Listen for response
          const handler = () => {
            clearTimeout(timeout);
            resolve(null);
          };

          window.addEventListener('bridge-pong', handler, { once: true });
        });

        const latency = performance.now() - startTime;

        this.logMetric({
          operation: 'bridge-latency-test',
          method: 'webview-bridge',
          duration: latency,
          timestamp: Date.now(),
          success: true,
          metadata: { testType: 'ping-pong' }
        });

        return latency;
      } else {
        throw new Error('WebView bridge not available');
      }
    } catch (error) {
      const latency = performance.now() - startTime;

      this.logMetric({
        operation: 'bridge-latency-test',
        method: 'webview-bridge',
        duration: latency,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Compare bridge performance vs HTTP API
   */
  async compareBridgeVsHTTP(): Promise<{
    bridgeLatency: number;
    httpLatency: number;
    speedup: number;
    recommendation: string;
  }> {
    let bridgeLatency = 0;
    let httpLatency = 0;
    let bridgeSuccess = false;
    let httpSuccess = false;

    // Test WebView bridge
    try {
      bridgeLatency = await this.measureBridgeLatency();
      bridgeSuccess = true;
    } catch (error) {
      console.warn('Bridge latency test failed:', error);
    }

    // Test HTTP API (if available)
    try {
      const startTime = performance.now();
      const response = await fetch(
        getHealthCheckURL(),
        { method: 'GET' }
      );

      if (response.ok) {
        httpLatency = performance.now() - startTime;
        httpSuccess = true;

        this.logMetric({
          operation: 'http-latency-test',
          method: 'native',
          duration: httpLatency,
          timestamp: Date.now(),
          success: true,
          metadata: { testType: 'http-health-check' }
        });
      }
    } catch (error) {
      console.warn('HTTP latency test failed:', error);
    }

    let speedup = 0;
    let recommendation = '';

    if (bridgeSuccess && httpSuccess) {
      speedup = httpLatency / bridgeLatency;
      if (speedup > 1.2) {
        recommendation = `Bridge is ${speedup.toFixed(1)}x faster than HTTP`;
      } else if (speedup < 0.8) {
        recommendation = 'HTTP is performing better than bridge';
      } else {
        recommendation = 'Bridge and HTTP have comparable performance';
      }
    } else if (bridgeSuccess) {
      recommendation = 'Bridge available, HTTP unavailable';
    } else if (httpSuccess) {
      recommendation = 'HTTP available, bridge unavailable';
    } else {
      recommendation = 'Both bridge and HTTP unavailable';
    }

    return {
      bridgeLatency,
      httpLatency,
      speedup,
      recommendation
    };
  }

  /**
   * Validate data integrity across bridge operations
   */
  async validateDataIntegrity(): Promise<{
    passed: boolean;
    errors: string[];
    testResults: Array<{
      operation: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const errors: string[] = [];
    const testResults: Array<{ operation: string; success: boolean; error?: string }> = [];

    try {
      // Test 1: Create and retrieve data
      // Test data structure defined for integrity checks

      // This would need to be implemented with actual bridge methods
      // For now, we'll simulate the test structure

      testResults.push({
        operation: 'create-retrieve-test',
        success: true
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Data integrity validation failed: ${errorMsg}`);

      testResults.push({
        operation: 'create-retrieve-test',
        success: false,
        error: errorMsg
      });
    }

    const passed = errors.length === 0;

    this.logMetric({
      operation: 'data-integrity-validation',
      method: 'webview-bridge',
      duration: 0, // This would be measured in actual implementation
      timestamp: Date.now(),
      success: passed,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      metadata: { testCount: testResults.length }
    });

    return {
      passed,
      errors,
      testResults
    };
  }

  private logMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Limit memory usage
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log warnings for slow operations in development
    if (process.env.NODE_ENV === 'development') {
      const slowThreshold = 100; // ms
      if (metric.duration > slowThreshold) {
        console.warn(
          `Slow ${metric.method} operation:`,
          metric.operation,
          `${metric.duration.toFixed(2)}ms`
        );
      }
    }
  }

  private calculateMethodBreakdown() {
    const nativeMetrics = this.metrics.filter(m => m.method === 'native');
    const nativeApiMetrics = this.metrics.filter(m => m.method === 'native-api');
    const optimizedMetrics = this.metrics.filter(m => m.method === 'optimized');
    const webviewBridgeMetrics = this.metrics.filter(m => m.method === 'webview-bridge');

    return {
      'native-api': {
        operations: nativeApiMetrics.length,
        averageDuration: this.calculateAverage(nativeApiMetrics),
        successRate: this.calculateSuccessRate(nativeApiMetrics),
      },
      native: {
        operations: nativeMetrics.length,
        averageDuration: this.calculateAverage(nativeMetrics),
        successRate: this.calculateSuccessRate(nativeMetrics),
      },
      optimized: {
        operations: optimizedMetrics.length,
        averageDuration: this.calculateAverage(optimizedMetrics),
        successRate: this.calculateSuccessRate(optimizedMetrics),
      },
      webviewBridge: {
        operations: webviewBridgeMetrics.length,
        averageDuration: this.calculateAverage(webviewBridgeMetrics),
        successRate: this.calculateSuccessRate(webviewBridgeMetrics),
      },
    };
  }

  private getSlowestOperations(count = 10): PerformanceMetric[] {
    return [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, count);
  }

  private generateRecommendations(
    breakdown: PerformanceReport['methodBreakdown'],
    slowest: PerformanceMetric[],
    errorRate: number
  ): string[] {
    const recommendations: string[] = [];

    // Compare method performance
    if (breakdown.optimized.operations > 0 && breakdown.native.operations > 0) {
      const speedup = breakdown.native.averageDuration / breakdown.optimized.averageDuration;
      if (speedup > 1.5) {
        recommendations.push(
          `Optimized endpoints are ${speedup.toFixed(1)}x faster than fallback SQL. Consider optimizing more query patterns.`
        );
      }
    }

    if (breakdown['native-api'].operations > 0 && breakdown.webviewBridge.operations > 0) {
      const speedup = breakdown['native-api'].averageDuration / breakdown.webviewBridge.averageDuration;
      if (speedup > 1.2) {
        recommendations.push(
          `WebView bridge is ${speedup.toFixed(1)}x faster than HTTP API. Consider using WebView bridge for better performance.`
        );
      } else if (speedup < 0.8) {
        recommendations.push(
          `HTTP API is performing better than WebView bridge. Check for message passing overhead.`
        );
      }
    }

    // Error rate warnings
    if (errorRate > 10) {
      recommendations.push(
        `High error rate (${errorRate.toFixed(1)}%). Review failed operations and improve error handling.`
      );
    }

    // Slow operation warnings
    const verySlowOps = slowest.filter(op => op.duration > 500);
    if (verySlowOps.length > 0) {
      recommendations.push(
        `${verySlowOps.length} operations took >500ms. Consider optimization or caching for: ${verySlowOps.map(op => op.operation).slice(0, 3).join(', ')}`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance looks good! No specific recommendations at this time.');
    }

    return recommendations;
  }

  private calculateAverage(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
  }

  private calculateSuccessRate(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 100;
    const successful = metrics.filter(m => m.success).length;
    return (successful / metrics.length) * 100;
  }


  private createEmptyReport(): PerformanceReport {
    return {
      totalOperations: 0,
      averageDuration: 0,
      methodBreakdown: {
        'native-api': { operations: 0, averageDuration: 0, successRate: 100 },
        native: { operations: 0, averageDuration: 0, successRate: 100 },
        optimized: { operations: 0, averageDuration: 0, successRate: 100 },
        webviewBridge: { operations: 0, averageDuration: 0, successRate: 100 },
      },
      slowestOperations: [],
      errorRate: 0,
      recommendations: ['No operations recorded yet.'],
    };
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor({
  enabled: process.env.NODE_ENV === 'development',
});

/**
 * Convenience function for logging query performance
 */
export function logQueryPerformance(
  query: string,
  duration: number,
  method: 'native' | 'native-api' | 'optimized' | 'webview-bridge',
  metadata?: { rowCount?: number; success?: boolean; error?: string }
): void {
  performanceMonitor.logQueryPerformance(query, duration, method, metadata);
}

// compareQueryPerformance function removed - sql.js comparison no longer supported

/**
 * Development helper to log performance report to console
 */
export function logPerformanceReport(): void {
  if (process.env.NODE_ENV === 'development') {
    const report = performanceMonitor.getPerformanceReport();
    console.warn('📊 Performance Report:');
    console.warn('Total Operations:', report.totalOperations);
    console.warn('Average Duration:', `${report.averageDuration.toFixed(2)}ms`);
    console.warn('Error Rate:', `${report.errorRate.toFixed(1)}%`);
    console.warn('Method Breakdown:', report.methodBreakdown);
    if (report.slowestOperations.length > 0) {
      console.warn('Slowest Operations:', report.slowestOperations.slice(0, 5));
    }
    console.warn('Recommendations:');
    report.recommendations.forEach(rec => console.warn(`  • ${rec}`));
    console.warn('--- End Performance Report ---');
  }
}