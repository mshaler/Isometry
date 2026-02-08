/**
 * Database Performance Monitor Stub
 * Simplified version for database operations
 */

import { devLogger } from '../logging/dev-logger';

export interface DatabasePerformanceMetrics {
  queryTime: number;
  resultCount: number;
  cacheHit: boolean;
  timestamp: number;
}

export class DatabasePerformanceMonitor {
  private metrics: DatabasePerformanceMetrics[] = [];

  recordQuery(queryTime: number, resultCount: number, cacheHit: boolean): void {
    const metric: DatabasePerformanceMetrics = {
      queryTime,
      resultCount,
      cacheHit,
      timestamp: Date.now()
    };
    
    this.metrics.push(metric);
    
    if (queryTime > 100) {
      devLogger.warn('Slow database query: ' + queryTime.toFixed(1) + 'ms', { resultCount, cacheHit });
    }
  }

  getMetrics(): DatabasePerformanceMetrics[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}

export const dbPerformanceMonitor = new DatabasePerformanceMonitor();
export default dbPerformanceMonitor;
