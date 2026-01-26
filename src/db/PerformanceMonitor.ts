/**
 * Performance Monitor for Database Operations
 *
 * Comprehensive performance tracking and comparison between sql.js and native API
 * implementations. Provides insights for optimization and migration validation.
 */

export interface PerformanceMetric {
  operation: string;
  method: 'sql.js' | 'native' | 'optimized';
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
    sqljs: {
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
  };
  slowestOperations: PerformanceMetric[];
  errorRate: number;
  recommendations: string[];
}

export interface ComparisonResult {
  operation: string;
  sqlJsResult: {
    duration: number;
    success: boolean;
    data?: unknown;
    error?: string;
  };
  nativeResult: {
    duration: number;
    success: boolean;
    data?: unknown;
    error?: string;
  };
  speedup?: number; // How many times faster native is
  consistent: boolean; // Whether results are identical
}

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
    metadata: { method: 'sql.js' | 'native' | 'optimized'; query?: string } = { method: 'sql.js' }
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
    method: 'sql.js' | 'native' | 'optimized',
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
   * Get comprehensive performance report
   */
  getPerformanceReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return this.createEmptyReport();
    }

    const totalOperations = this.metrics.length;
    const successfulOperations = this.metrics.filter(m => m.success);
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

  /**
   * Compare sql.js vs native implementation performance
   */
  async compareImplementations(
    sql: string,
    params: unknown[] = [],
    sqlJsExecute: (sql: string, params?: unknown[]) => unknown,
    nativeExecute: (sql: string, params?: unknown[]) => Promise<unknown>
  ): Promise<ComparisonResult> {
    const operation = `compare: ${sql.substring(0, 50)}...`;

    let sqlJsResult: ComparisonResult['sqlJsResult'];
    let nativeResult: ComparisonResult['nativeResult'];

    // Test sql.js
    try {
      const result = await this.measureOperation(
        operation + ' (sql.js)',
        async () => sqlJsExecute(sql, params),
        { method: 'sql.js', query: sql }
      );

      sqlJsResult = {
        duration: this.getLastMetricDuration('sql.js'),
        success: true,
        data: result,
      };
    } catch (error) {
      sqlJsResult = {
        duration: this.getLastMetricDuration('sql.js'),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Test native
    try {
      const result = await this.measureOperation(
        operation + ' (native)',
        async () => nativeExecute(sql, params),
        { method: 'native', query: sql }
      );

      nativeResult = {
        duration: this.getLastMetricDuration('native'),
        success: true,
        data: result,
      };
    } catch (error) {
      nativeResult = {
        duration: this.getLastMetricDuration('native'),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Calculate speedup and consistency
    let speedup: number | undefined;
    let consistent = false;

    if (sqlJsResult.success && nativeResult.success) {
      speedup = sqlJsResult.duration / nativeResult.duration;
      consistent = this.compareResults(sqlJsResult.data, nativeResult.data);
    }

    return {
      operation,
      sqlJsResult,
      nativeResult,
      speedup,
      consistent,
    };
  }

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
    const sqlJsMetrics = this.metrics.filter(m => m.method === 'sql.js');
    const nativeMetrics = this.metrics.filter(m => m.method === 'native');
    const optimizedMetrics = this.metrics.filter(m => m.method === 'optimized');

    return {
      sqljs: {
        operations: sqlJsMetrics.length,
        averageDuration: this.calculateAverage(sqlJsMetrics),
        successRate: this.calculateSuccessRate(sqlJsMetrics),
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

    if (breakdown.sqljs.operations > 0 && breakdown.native.operations > 0) {
      const speedup = breakdown.sqljs.averageDuration / breakdown.native.averageDuration;
      if (speedup > 1.2) {
        recommendations.push(
          `Native implementation is ${speedup.toFixed(1)}x faster than sql.js. Migration provides significant performance benefits.`
        );
      } else if (speedup < 0.8) {
        recommendations.push(
          `SQL.js is performing better than native implementation. Check for network latency or optimization opportunities.`
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

  private getLastMetricDuration(method: 'sql.js' | 'native' | 'optimized'): number {
    for (let i = this.metrics.length - 1; i >= 0; i--) {
      if (this.metrics[i].method === method) {
        return this.metrics[i].duration;
      }
    }
    return 0;
  }

  private compareResults(result1: unknown, result2: unknown): boolean {
    try {
      return JSON.stringify(result1) === JSON.stringify(result2);
    } catch {
      return false; // Can't serialize for comparison
    }
  }

  private createEmptyReport(): PerformanceReport {
    return {
      totalOperations: 0,
      averageDuration: 0,
      methodBreakdown: {
        sqljs: { operations: 0, averageDuration: 0, successRate: 100 },
        native: { operations: 0, averageDuration: 0, successRate: 100 },
        optimized: { operations: 0, averageDuration: 0, successRate: 100 },
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
  method: 'sql.js' | 'native' | 'optimized',
  metadata?: { rowCount?: number; success?: boolean; error?: string }
): void {
  performanceMonitor.logQueryPerformance(query, duration, method, metadata);
}

/**
 * Performance comparison utility
 */
export async function compareQueryPerformance(
  sql: string,
  params: unknown[] = [],
  sqlJsExecute: (sql: string, params?: unknown[]) => unknown,
  nativeExecute: (sql: string, params?: unknown[]) => Promise<unknown>
): Promise<ComparisonResult> {
  return performanceMonitor.compareImplementations(sql, params, sqlJsExecute, nativeExecute);
}

/**
 * Development helper to log performance report to console
 */
export function logPerformanceReport(): void {
  if (process.env.NODE_ENV === 'development') {
    const report = performanceMonitor.getPerformanceReport();
    console.group('📊 Performance Report');
    console.log('Total Operations:', report.totalOperations);
    console.log('Average Duration:', `${report.averageDuration.toFixed(2)}ms`);
    console.log('Error Rate:', `${report.errorRate.toFixed(1)}%`);
    console.table(report.methodBreakdown);
    if (report.slowestOperations.length > 0) {
      console.log('Slowest Operations:', report.slowestOperations.slice(0, 5));
    }
    console.log('Recommendations:');
    report.recommendations.forEach(rec => console.log(`  • ${rec}`));
    console.groupEnd();
  }
}