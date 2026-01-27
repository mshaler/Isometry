/**
 * Performance Benchmarks Utility
 *
 * Stores performance baselines and provides automated regression detection
 * Integrates with BridgePerformanceMonitor for comprehensive analysis
 */

import { DatabaseMode } from '../contexts/EnvironmentContext';
import { Environment } from './webview-bridge';
import { performanceLogger } from './logger';

interface BridgePerformanceResults {
  bridgeLatency?: number;
  databaseLatency?: number;
  syncLatency?: number;
  uiLatency?: number;
  databaseThroughput?: number;
  syncThroughput?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  networkLatency?: number;
  diskIO?: number;
  results?: Array<{
    test: string;
    duration: number;
    success: boolean;
  }>;
  stress?: {
    throughput: number;
    successfulOperations: number;
    failedOperations: number;
    totalOperations: number;
  };
}

export interface PerformanceBaseline {
  id: string;
  provider: DatabaseMode;
  timestamp: string;
  version: string;
  environment: EnvironmentInfo;
  metrics: BaselineMetrics;
  metadata: BaselineMetadata;
}

export interface BaselineMetrics {
  // Latency metrics (milliseconds)
  bridgeLatency: number;
  databaseLatency: number;
  syncLatency: number;
  uiLatency: number;

  // Throughput metrics (operations per second)
  databaseThroughput: number;
  syncThroughput: number;

  // Memory metrics (megabytes)
  memoryUsage: number;
  memoryLeakRate: number;

  // UI performance metrics
  fps: number;
  frameDrops: number;

  // Reliability metrics (percentages)
  successRate: number;
  errorRate: number;
}

export interface EnvironmentInfo {
  platform: 'iOS' | 'macOS' | 'browser';
  version: string;
  device: string;
  isSimulator: boolean;
  debugMode: boolean;
}

export interface BaselineMetadata {
  testCases: number;
  duration: number;
  dataSize: number;
  concurrency: number;
  notes?: string;
}

export interface RegressionReport {
  hasRegression: boolean;
  regressionCount: number;
  improvementCount: number;
  overallScore: number;
  details: RegressionDetail[];
  recommendations: string[];
  summary: string;
}

export interface RegressionDetail {
  metric: string;
  baseline: number;
  current: number;
  change: number; // percentage
  severity: 'improvement' | 'minor' | 'moderate' | 'severe';
  threshold: number;
  recommendation?: string;
}

export interface PerformanceComparison {
  baseline: PerformanceBaseline;
  current: BaselineMetrics;
  regression: RegressionReport;
  timestamp: string;
}

/**
 * Performance Benchmarks Manager
 */
export class PerformanceBenchmarks {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private readonly storageKey = 'isometry-performance-baselines';
  private readonly regressionThresholds = {
    minor: 5,     // 5% degradation
    moderate: 15, // 15% degradation
    severe: 30    // 30% degradation
  };

  constructor() {
    this.loadBaselines();
  }

  /**
   * Store performance baseline for future comparisons
   */
  async storeBaseline(
    provider: DatabaseMode,
    metrics: BaselineMetrics,
    metadata?: Partial<BaselineMetadata>
  ): Promise<string> {
    const id = this.generateBaselineId(provider);
    const environment = await this.getCurrentEnvironment();

    const baseline: PerformanceBaseline = {
      id,
      provider,
      timestamp: new Date().toISOString(),
      version: this.getCurrentVersion(),
      environment,
      metrics,
      metadata: {
        testCases: metadata?.testCases || 0,
        duration: metadata?.duration || 0,
        dataSize: metadata?.dataSize || 0,
        concurrency: metadata?.concurrency || 1,
        notes: metadata?.notes
      }
    };

    this.baselines.set(id, baseline);
    this.saveBaselines();

    performanceLogger.info(`Performance baseline stored: ${id}`);
    return id;
  }

  /**
   * Compare current performance against stored baseline
   */
  async compareAgainstBaseline(
    provider: DatabaseMode,
    currentMetrics: BaselineMetrics,
    baselineId?: string
  ): Promise<PerformanceComparison> {
    const baseline = baselineId
      ? this.baselines.get(baselineId)
      : this.getLatestBaseline(provider);

    if (!baseline) {
      throw new Error(`No baseline found for provider: ${provider}`);
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
   * Detect performance regressions automatically
   */
  detectRegressions(baseline: BaselineMetrics, current: BaselineMetrics): RegressionReport {
    return this.analyzeRegression(baseline, current);
  }

  /**
   * Get performance recommendations based on metrics
   */
  generateRecommendations(comparison: PerformanceComparison): string[] {
    const recommendations: string[] = [];

    for (const detail of comparison.regression.details) {
      if (detail.severity === 'severe' || detail.severity === 'moderate') {
        if (detail.recommendation) {
          recommendations.push(detail.recommendation);
        } else {
          recommendations.push(`Address ${detail.severity} regression in ${detail.metric}: ${detail.change.toFixed(1)}% degradation`);
        }
      }
    }

    // Performance-specific recommendations
    const current = comparison.current;
    if (current.bridgeLatency > 50) {
      recommendations.push('🔧 Bridge latency is high - optimize MessageHandler communication');
    }
    if (current.databaseThroughput < 100) {
      recommendations.push('📊 Database throughput is low - review query optimization');
    }
    if (current.memoryUsage > 50) {
      recommendations.push('💾 Memory usage is high - investigate memory leaks');
    }
    if (current.fps < 55) {
      recommendations.push('🎨 UI performance is low - optimize rendering operations');
    }
    if (current.successRate < 95) {
      recommendations.push('⚠️ Success rate is low - improve error handling');
    }

    // If no issues found
    if (recommendations.length === 0) {
      recommendations.push('✅ Performance is within acceptable range');
    }

    return recommendations;
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(): {
    baselines: PerformanceBaseline[];
    environment: EnvironmentInfo;
    timestamp: string;
  } {
    return {
      baselines: Array.from(this.baselines.values()),
      environment: Environment.isWebView() ? {
        platform: Environment.info().platform as 'iOS' | 'macOS',
        version: Environment.info().version,
        device: 'native-app',
        isSimulator: false,
        debugMode: false
      } : {
        platform: 'browser',
        version: navigator.userAgent,
        device: 'browser',
        isSimulator: false,
        debugMode: process.env.NODE_ENV === 'development'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import performance baselines from external source
   */
  importPerformanceData(data: { baselines: PerformanceBaseline[] }): void {
    for (const baseline of data.baselines) {
      this.baselines.set(baseline.id, baseline);
    }
    this.saveBaselines();
    performanceLogger.info(`Imported ${data.baselines.length} performance baselines`);
  }

  /**
   * Clear all stored baselines
   */
  clearBaselines(): void {
    this.baselines.clear();
    this.saveBaselines();
    performanceLogger.info('All performance baselines cleared');
  }

  /**
   * Get all baselines for a provider
   */
  getBaselinesForProvider(provider: DatabaseMode): PerformanceBaseline[] {
    return Array.from(this.baselines.values())
      .filter(baseline => baseline.provider === provider)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(provider: DatabaseMode, metric: keyof BaselineMetrics): {
    metric: string;
    data: { timestamp: string; value: number }[];
    trend: 'improving' | 'stable' | 'degrading';
  } {
    const baselines = this.getBaselinesForProvider(provider);
    const data = baselines.map(baseline => ({
      timestamp: baseline.timestamp,
      value: baseline.metrics[metric]
    }));

    // Calculate trend
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (data.length > 1) {
      const first = data[data.length - 1].value;
      const last = data[0].value;
      const change = ((last - first) / first) * 100;

      if (change < -this.regressionThresholds.minor) {
        trend = 'degrading';
      } else if (change > this.regressionThresholds.minor) {
        // For some metrics, higher is better (e.g., fps, throughput)
        // For others, lower is better (e.g., latency, memory)
        const higherIsBetter = ['databaseThroughput', 'syncThroughput', 'fps', 'successRate'].includes(metric);
        trend = higherIsBetter ? 'improving' : 'degrading';
      }
    }

    return {
      metric,
      data,
      trend
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private generateBaselineId(provider: DatabaseMode): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${provider}-${timestamp}-${random}`;
  }

  private async getCurrentEnvironment(): Promise<EnvironmentInfo> {
    if (Environment.isWebView()) {
      const info = Environment.info();
      return {
        platform: info.platform as 'iOS' | 'macOS',
        version: info.version,
        device: 'native-app',
        isSimulator: false, // Would need to detect this
        debugMode: false    // Would need to detect this
      };
    } else {
      return {
        platform: 'browser',
        version: navigator.userAgent,
        device: 'browser',
        isSimulator: false,
        debugMode: process.env.NODE_ENV === 'development'
      };
    }
  }

  private getCurrentVersion(): string {
    return process.env.REACT_APP_VERSION || '1.0.0';
  }

  private getLatestBaseline(provider: DatabaseMode): PerformanceBaseline | undefined {
    const baselines = this.getBaselinesForProvider(provider);
    return baselines[0]; // Already sorted by timestamp desc
  }

  private analyzeRegression(baseline: BaselineMetrics, current: BaselineMetrics): RegressionReport {
    const details: RegressionDetail[] = [];
    let regressionCount = 0;
    let improvementCount = 0;

    // Analyze each metric
    for (const [metric, currentValue] of Object.entries(current) as [keyof BaselineMetrics, number][]) {
      const baselineValue = baseline[metric];
      if (baselineValue === undefined || currentValue === undefined) continue;

      const change = ((currentValue - baselineValue) / baselineValue) * 100;

      let severity: RegressionDetail['severity'] = 'minor';
      const threshold = this.regressionThresholds.minor;

      // Determine if higher or lower values are better for this metric
      const lowerIsBetter = ['bridgeLatency', 'databaseLatency', 'syncLatency', 'uiLatency',
                             'memoryUsage', 'memoryLeakRate', 'frameDrops', 'errorRate'].includes(metric);

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
        // For throughput/fps/success metrics, decreases are bad
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
        severity,
        threshold,
        recommendation: this.getMetricRecommendation(metric, severity, change)
      });
    }

    const hasRegression = regressionCount > 0;
    const overallScore = this.calculateOverallScore(details);
    const summary = this.generateSummary(regressionCount, improvementCount, overallScore);

    return {
      hasRegression,
      regressionCount,
      improvementCount,
      overallScore,
      details,
      recommendations: this.generateDetailRecommendations(details),
      summary
    };
  }

  private getMetricRecommendation(metric: string, severity: RegressionDetail['severity'], _change: number): string | undefined {
    if (severity === 'improvement' || severity === 'minor') return undefined;

    const recommendations: Record<string, string> = {
      bridgeLatency: 'Optimize WebView MessageHandler communication and reduce bridge overhead',
      databaseLatency: 'Review database queries and consider adding indexes or query optimization',
      syncLatency: 'Improve sync coordination and reduce change notification delays',
      memoryUsage: 'Investigate memory leaks and optimize data structures',
      databaseThroughput: 'Optimize database operations and consider connection pooling',
      fps: 'Reduce rendering overhead and optimize UI updates during database operations',
      successRate: 'Improve error handling and retry mechanisms',
      errorRate: 'Investigate and fix underlying error conditions'
    };

    return recommendations[metric];
  }

  private calculateOverallScore(details: RegressionDetail[]): number {
    let totalScore = 100;

    for (const detail of details) {
      const impact = this.getMetricImpact(detail.metric);
      const penalty = this.getSeverityPenalty(detail.severity) * impact;
      totalScore -= penalty;
    }

    return Math.max(0, Math.min(100, totalScore));
  }

  private getMetricImpact(metric: string): number {
    // Weight different metrics by their impact on user experience
    const impacts: Record<string, number> = {
      bridgeLatency: 1.0,
      databaseLatency: 0.8,
      syncLatency: 0.6,
      uiLatency: 1.0,
      fps: 1.0,
      memoryUsage: 0.4,
      databaseThroughput: 0.8,
      successRate: 1.2,
      errorRate: 1.2
    };

    return impacts[metric] || 0.5;
  }

  private getSeverityPenalty(severity: RegressionDetail['severity']): number {
    const penalties = {
      improvement: -5, // Negative penalty (bonus)
      minor: 10,
      moderate: 25,
      severe: 50
    };

    return penalties[severity] || 0;
  }

  private generateSummary(regressionCount: number, improvementCount: number, overallScore: number): string {
    if (overallScore >= 90) {
      return `✅ Excellent performance: ${improvementCount} improvements, ${regressionCount} regressions`;
    } else if (overallScore >= 75) {
      return `✅ Good performance: ${improvementCount} improvements, ${regressionCount} regressions`;
    } else if (overallScore >= 60) {
      return `⚠️ Fair performance: ${regressionCount} regressions detected, consider optimization`;
    } else {
      return `❌ Poor performance: ${regressionCount} significant regressions, optimization required`;
    }
  }

  private generateDetailRecommendations(details: RegressionDetail[]): string[] {
    return details
      .filter(detail => detail.recommendation && detail.severity !== 'improvement')
      .map(detail => detail.recommendation!)
      .filter((recommendation, index, array) => array.indexOf(recommendation) === index); // Remove duplicates
  }

  private loadBaselines(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.baselines = new Map(data.baselines || []);
      }
    } catch (error) {
      performanceLogger.warn('Failed to load performance baselines', { error: error as Error });
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
      performanceLogger.warn('Failed to save performance baselines', { error: error as Error });
    }
  }
}

/**
 * Global performance benchmarks instance
 */
export const performanceBenchmarks = new PerformanceBenchmarks();

/**
 * Helper function to create baseline metrics from bridge performance results
 */
export function createBaselineFromBridgeResults(results: BridgePerformanceResults): BaselineMetrics {
  const defaultMetrics: BaselineMetrics = {
    bridgeLatency: 50,
    databaseLatency: 30,
    syncLatency: 100,
    uiLatency: 16,
    databaseThroughput: 100,
    syncThroughput: 50,
    memoryUsage: 10,
    memoryLeakRate: 0,
    fps: 60,
    frameDrops: 0,
    successRate: 100,
    errorRate: 0
  };

  // Extract metrics from bridge performance results
  if (results && results.results) {
    for (const result of results.results) {
      switch (result.test) {
        case 'bridge-latency':
          defaultMetrics.bridgeLatency = result.duration;
          break;
        case 'sync-latency':
          defaultMetrics.syncLatency = result.duration;
          break;
        case 'memory-overhead':
          defaultMetrics.memoryUsage = result.duration; // Duration represents MB in this test
          break;
      }
    }
  }

  if (results && results.stress) {
    defaultMetrics.databaseThroughput = results.stress.throughput;
    defaultMetrics.successRate = (results.stress.successfulOperations / results.stress.totalOperations) * 100;
    defaultMetrics.errorRate = (results.stress.failedOperations / results.stress.totalOperations) * 100;
  }

  return defaultMetrics;
}