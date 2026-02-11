/**
 * Simple Performance Benchmarks for sql.js + D3.js
 *
 * Basic performance baseline storage and comparison for sql.js direct access
 * No bridge dependencies - focus on essential metrics
 */

// No bridge dependencies - direct sql.js access
import { performanceLogger } from '@/utils/logging/dev-logger';

export interface SimpleBaselineMetrics {
  // Core performance metrics (milliseconds)
  queryLatency: number;
  renderLatency: number;

  // Memory metrics (megabytes)
  memoryUsage: number;

  // Throughput metrics
  queryThroughput: number; // operations per second
  renderThroughput: number;

  // Reliability metrics (percentages)
  successRate: number;
  errorRate: number;
}

export interface SimplePerformanceBaseline {
  id: string;
  timestamp: string;
  environment: string;
  metrics: SimpleBaselineMetrics;
  metadata: {
    testCases: number;
    duration: number;
    notes?: string;
  };
}

export interface SimpleRegressionDetail {
  metric: string;
  baseline: number;
  current: number;
  change: number; // percentage
  severity: 'improvement' | 'minor' | 'moderate' | 'severe';
}

export interface SimpleRegressionReport {
  hasRegression: boolean;
  overallScore: number; // 0-100
  details: SimpleRegressionDetail[];
  recommendations: string[];
}

export interface SimplePerformanceComparison {
  baseline: SimplePerformanceBaseline;
  current: SimpleBaselineMetrics;
  regression: SimpleRegressionReport;
  timestamp: string;
}

/**
 * Simple Performance Benchmarks Manager
 */
export class SimplePerformanceBenchmarks {
  private baselines: Map<string, SimplePerformanceBaseline> = new Map();
  private readonly storageKey = 'isometry-simple-performance-baselines';
  private readonly regressionThresholds = {
    minor: 10,     // 10% degradation
    moderate: 25,  // 25% degradation
    severe: 50     // 50% degradation
  };

  constructor() {
    this.loadBaselines();
  }

  /**
   * Store performance baseline for future comparisons
   */
  storeBaseline(
    metrics: SimpleBaselineMetrics,
    metadata?: Partial<{ testCases: number; duration: number; notes: string }>
  ): string {
    const id = this.generateBaselineId();

    const baseline: SimplePerformanceBaseline = {
      id,
      timestamp: new Date().toISOString(),
      environment: typeof window !== 'undefined' ? 'browser' : 'node',
      metrics,
      metadata: {
        testCases: metadata?.testCases || 0,
        duration: metadata?.duration || 0,
        notes: metadata?.notes
      }
    };

    this.baselines.set(id, baseline);
    this.saveBaselines();

    performanceLogger.debug(`Performance baseline stored: ${id}`);
    return id;
  }

  /**
   * Compare current performance against stored baseline
   */
  compareAgainstBaseline(
    currentMetrics: SimpleBaselineMetrics,
    baselineId?: string
  ): SimplePerformanceComparison | null {
    const baseline = baselineId
      ? this.baselines.get(baselineId)
      : this.getLatestBaseline();

    if (!baseline) {
      console.warn('No baseline found for comparison');
      return null;
    }

    const regression = this.analyzeRegression(baseline.metrics, currentMetrics);

    return {
      baseline,
      current: currentMetrics,
      regression,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(baseline: SimpleBaselineMetrics, current: SimpleBaselineMetrics): SimpleRegressionReport {
    return this.analyzeRegression(baseline, current);
  }

  /**
   * Get all stored baselines
   */
  getAllBaselines(): SimplePerformanceBaseline[] {
    return Array.from(this.baselines.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Clear all baselines
   */
  clearBaselines(): void {
    this.baselines.clear();
    this.saveBaselines();
    performanceLogger.debug('All performance baselines cleared');
  }

  /**
   * Export baselines as JSON
   */
  exportBaselines(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      baselines: Array.from(this.baselines.values())
    }, null, 2);
  }

  /**
   * Import baselines from JSON
   */
  importBaselines(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed.baselines && Array.isArray(parsed.baselines)) {
        this.baselines.clear();
        for (const baseline of parsed.baselines) {
          this.baselines.set(baseline.id, baseline);
        }
        this.saveBaselines();
        performanceLogger.debug(`Imported ${parsed.baselines.length} performance baselines`);
      }
    } catch (error) {
      console.error('Failed to import baselines:', error);
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private generateBaselineId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `baseline-${timestamp}-${random}`;
  }

  private getLatestBaseline(): SimplePerformanceBaseline | undefined {
    const baselines = this.getAllBaselines();
    return baselines[0]; // Already sorted by timestamp desc
  }

  private analyzeRegression(baseline: SimpleBaselineMetrics, current: SimpleBaselineMetrics): SimpleRegressionReport {
    const details: SimpleRegressionDetail[] = [];
    let regressionCount = 0;
    let improvementCount = 0;

    // Analyze each metric
    for (const [metric, currentValue] of Object.entries(current) as [keyof SimpleBaselineMetrics, number][]) {
      const baselineValue = baseline[metric];
      if (baselineValue === undefined || currentValue === undefined) continue;

      const change = ((currentValue - baselineValue) / baselineValue) * 100;

      let severity: SimpleRegressionDetail['severity'] = 'minor';

      // Determine if higher or lower values are better for this metric
      const lowerIsBetter = ['queryLatency', 'renderLatency', 'memoryUsage', 'errorRate'].includes(metric);

      // Determine severity and direction
      if (lowerIsBetter) {
        // For latency/memory/error metrics, increases are bad
        if (change > this.regressionThresholds.severe) {
          severity = 'severe';
          regressionCount++;
        } else if (change > this.regressionThresholds.moderate) {
          severity = 'moderate';
          regressionCount++;
        } else if (change > this.regressionThresholds.minor) {
          severity = 'minor';
          regressionCount++;
        } else if (change < -this.regressionThresholds.minor) {
          severity = 'improvement';
          improvementCount++;
        }
      } else {
        // For throughput/success metrics, decreases are bad
        if (change < -this.regressionThresholds.severe) {
          severity = 'severe';
          regressionCount++;
        } else if (change < -this.regressionThresholds.moderate) {
          severity = 'moderate';
          regressionCount++;
        } else if (change < -this.regressionThresholds.minor) {
          severity = 'minor';
          regressionCount++;
        } else if (change > this.regressionThresholds.minor) {
          severity = 'improvement';
          improvementCount++;
        }
      }

      details.push({
        metric,
        baseline: baselineValue,
        current: currentValue,
        change,
        severity
      });
    }

    const hasRegression = regressionCount > 0;
    const overallScore = this.calculateOverallScore(details);
    const recommendations = this.generateRecommendations(details);

    return {
      hasRegression,
      overallScore,
      details,
      recommendations
    };
  }

  private calculateOverallScore(details: SimpleRegressionDetail[]): number {
    let totalScore = 100;

    for (const detail of details) {
      const penalty = this.getSeverityPenalty(detail.severity);
      totalScore -= penalty;
    }

    return Math.max(0, Math.min(100, totalScore));
  }

  private getSeverityPenalty(severity: SimpleRegressionDetail['severity']): number {
    const penalties = {
      improvement: -5, // Negative penalty (bonus)
      minor: 10,
      moderate: 25,
      severe: 50
    };

    return penalties[severity] || 0;
  }

  private generateRecommendations(details: SimpleRegressionDetail[]): string[] {
    const recommendations: string[] = [];

    const severeIssues = details.filter(d => d.severity === 'severe');
    const moderateIssues = details.filter(d => d.severity === 'moderate');

    if (severeIssues.length > 0) {
      recommendations.push(`🚨 Severe regressions detected in: ${severeIssues.map(d => d.metric).join(', ')}`);
    }

    if (moderateIssues.length > 0) {
      recommendations.push(`⚠️ Moderate regressions detected in: ${moderateIssues.map(d => d.metric).join(', ')}`);
    }

    // Specific recommendations based on metrics
    for (const detail of details) {
      if (detail.severity === 'severe' || detail.severity === 'moderate') {
        if (detail.metric === 'queryLatency') {
          recommendations.push('🔧 Optimize SQL queries and consider indexing');
        } else if (detail.metric === 'renderLatency') {
          recommendations.push('🎨 Optimize D3.js rendering and reduce DOM manipulations');
        } else if (detail.metric === 'memoryUsage') {
          recommendations.push('💾 Investigate memory leaks and optimize data structures');
        } else if (detail.metric === 'errorRate') {
          recommendations.push('🔍 Review error handling and data validation');
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Performance is stable or improved');
    }

    return Array.from(new Set(recommendations)); // Remove duplicates
  }

  private loadBaselines(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.baselines = new Map(data.baselines || []);
        performanceLogger.debug(`Loaded ${this.baselines.size} performance baselines`);
      }
    } catch (error) {
      console.warn('Failed to load performance baselines:', error);
      this.baselines = new Map();
    }
  }

  private saveBaselines(): void {
    try {
      const data = {
        baselines: Array.from(this.baselines.entries()),
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save performance baselines:', error);
    }
  }
}

/**
 * Global simple performance benchmarks instance
 */
export const simplePerformanceBenchmarks = new SimplePerformanceBenchmarks();

/**
 * Create baseline metrics from current performance data
 */
export function createSimpleBaseline(metrics: {
  avgQueryTime: number;
  avgRenderTime: number;
  memoryUsageMB: number;
  queryCount: number;
  renderCount: number;
  errorCount: number;
  duration: number; // milliseconds
}): SimpleBaselineMetrics {
  const totalOperations = metrics.queryCount + metrics.renderCount;
  const errorRate = totalOperations > 0 ? (metrics.errorCount / totalOperations) * 100 : 0;
  const successRate = 100 - errorRate;

  const durationSeconds = metrics.duration / 1000;
  const queryThroughput = durationSeconds > 0 ? metrics.queryCount / durationSeconds : 0;
  const renderThroughput = durationSeconds > 0 ? metrics.renderCount / durationSeconds : 0;

  return {
    queryLatency: metrics.avgQueryTime,
    renderLatency: metrics.avgRenderTime,
    memoryUsage: metrics.memoryUsageMB,
    queryThroughput,
    renderThroughput,
    successRate,
    errorRate
  };
}

/**
 * Quick performance benchmark
 */
export async function runQuickBenchmark(): Promise<SimpleBaselineMetrics> {
  const startTime = performance.now();

  // Simulate some operations
  const queryTimes: number[] = [];
  const renderTimes: number[] = [];

  // Simulate 10 query operations
  for (let i = 0; i < 10; i++) {
    const queryStart = performance.now();
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10)); // Simulate query
    const queryTime = performance.now() - queryStart;
    queryTimes.push(queryTime);
  }

  // Simulate 10 render operations
  for (let i = 0; i < 10; i++) {
    const renderStart = performance.now();
    await new Promise(resolve => setTimeout(resolve, Math.random() * 5)); // Simulate render
    const renderTime = performance.now() - renderStart;
    renderTimes.push(renderTime);
  }

  const duration = performance.now() - startTime;
  const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
  const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;

  // Get current memory usage
  const memory = (performance as any).memory;
  const memoryUsageMB = memory ? memory.usedJSHeapSize / 1024 / 1024 : 0;

  return createSimpleBaseline({
    avgQueryTime,
    avgRenderTime,
    memoryUsageMB,
    queryCount: queryTimes.length,
    renderCount: renderTimes.length,
    errorCount: 0,
    duration
  });
}