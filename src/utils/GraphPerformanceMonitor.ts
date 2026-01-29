import { performanceMonitor, NativeRenderingMetrics, PerformanceComparison } from './d3Performance';
import { graphAnalytics, CacheStats } from '../services/GraphAnalyticsAdapter';
import { ConnectionSuggestion, SuggestionPerformanceMetrics } from '../services/ConnectionSuggestionService';
import { CacheEffectiveness } from '../services/QueryCacheService';

// Analytics-specific metrics interface
export interface AnalyticsMetrics {
  suggestionLatency: {
    average: number;
    p95: number;
    p99: number;
    samples: number;
  };
  cacheHitRate: {
    overall: number;
    byNamespace: Record<string, number>;
    trend: number[]; // Last 10 measurements
  };
  computeTime: {
    nativeQueries: number;
    suggestionGeneration: number;
    cacheOperations: number;
    bridgeCommunication: number;
  };
  memoryUsage: {
    totalMB: number;
    queryCache: number;
    suggestionCache: number;
    bridgeBuffers: number;
  };
  throughput: {
    queriesPerSecond: number;
    suggestionsPerSecond: number;
    cacheOperationsPerSecond: number;
  };
  errorRates: {
    bridgeFailures: number;
    timeouts: number;
    cacheEvictions: number;
  };
}

// Optimization suggestion interface
export interface OptimizationSuggestion {
  type: 'cache' | 'query' | 'memory' | 'bridge' | 'suggestion';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImprovement: string;
  actionRequired: string;
  estimatedEffort: 'minimal' | 'moderate' | 'significant';
  category: string;
}

// Graph complexity analysis
interface GraphComplexityMetrics {
  nodeCount: number;
  edgeCount: number;
  averageDegree: number;
  density: number;
  complexityScore: number; // 0-10 scale
  clusteringCoefficient?: number;
  shortestPathAverage?: number;
}

/**
 * Enhanced performance monitoring for graph analytics operations,
 * extending Phase 14.3 patterns with graph-specific tracking
 */
export class GraphPerformanceMonitor {
  private static instance: GraphPerformanceMonitor | null = null;
  private metrics: AnalyticsMetrics;
  private metricsHistory: AnalyticsMetrics[] = [];
  private maxHistorySize = 100;

  // Performance tracking for individual operations
  private operationTimes = new Map<string, number[]>();
  private errorCounts = new Map<string, number>();
  private throughputCounters = new Map<string, { count: number; lastReset: number }>();

  // Alert thresholds
  private readonly THRESHOLDS = {
    suggestionLatency: 100, // ms
    cacheHitRate: 0.9,      // 90%
    memoryUsage: 100,       // MB
    errorRate: 0.05,        // 5%
    bridgeLatency: 5        // ms
  };

  // Optimization recommendation cache
  private optimizationCache = new Map<string, OptimizationSuggestion>();
  private lastOptimizationAnalysis = 0;
  private optimizationAnalysisInterval = 60000; // 1 minute

  private constructor() {
    this.metrics = this.createEmptyMetrics();
    this.startMetricsCollection();
    this.integrateWithD3Performance();
  }

  static getInstance(): GraphPerformanceMonitor {
    if (!GraphPerformanceMonitor.instance) {
      GraphPerformanceMonitor.instance = new GraphPerformanceMonitor();
    }
    return GraphPerformanceMonitor.instance;
  }

  /**
   * Track suggestion computation performance
   */
  trackSuggestionLatency(nodeId: string, latency: number, suggestionCount: number): void {
    this.recordOperationTime('suggestion-latency', latency);
    this.incrementThroughput('suggestions', suggestionCount);

    // Update suggestion-specific metrics
    this.updateSuggestionMetrics(latency);

    // Check for performance alerts
    if (latency > this.THRESHOLDS.suggestionLatency) {
      this.handlePerformanceAlert('suggestion-latency', nodeId, latency);
    }
  }

  /**
   * Track cache operations performance
   */
  trackCacheOperation(operation: 'hit' | 'miss' | 'set' | 'evict', namespace: string, duration?: number): void {
    if (duration !== undefined) {
      this.recordOperationTime(`cache-${operation}`, duration);
    }

    this.incrementThroughput('cache-operations', 1);

    // Update cache metrics
    this.updateCacheMetrics(operation, namespace);
  }

  /**
   * Track bridge communication performance
   */
  trackBridgeLatency(method: string, latency: number, success: boolean): void {
    this.recordOperationTime('bridge-latency', latency);

    if (!success) {
      this.incrementError('bridge-failures');
    }

    // Check for bridge performance issues
    if (latency > this.THRESHOLDS.bridgeLatency) {
      this.handlePerformanceAlert('bridge-latency', method, latency);
    }
  }

  /**
   * Track memory usage across graph analytics components
   */
  updateMemoryUsage(queryCache: number, suggestionCache: number, bridgeBuffers: number): void {
    this.metrics.memoryUsage = {
      totalMB: queryCache + suggestionCache + bridgeBuffers,
      queryCache,
      suggestionCache,
      bridgeBuffers
    };

    // Memory pressure detection
    if (this.metrics.memoryUsage.totalMB > this.THRESHOLDS.memoryUsage) {
      this.handlePerformanceAlert('memory-pressure', 'total', this.metrics.memoryUsage.totalMB);
    }
  }

  /**
   * Analyze graph complexity impact on performance
   */
  async analyzeGraphComplexity(): Promise<GraphComplexityMetrics> {
    try {
      const graphMetrics = await graphAnalytics.getGraphMetrics();

      const complexity: GraphComplexityMetrics = {
        nodeCount: graphMetrics.totalNodes,
        edgeCount: graphMetrics.totalEdges,
        averageDegree: graphMetrics.totalEdges / Math.max(graphMetrics.totalNodes, 1) * 2,
        density: graphMetrics.graphDensity,
        complexityScore: this.calculateComplexityScore(graphMetrics)
      };

      return complexity;

    } catch (error) {
      console.warn('Failed to analyze graph complexity:', error);
      return {
        nodeCount: 0,
        edgeCount: 0,
        averageDegree: 0,
        density: 0,
        complexityScore: 0
      };
    }
  }

  /**
   * Generate optimization recommendations based on performance data
   */
  generateOptimizationSuggestions(): OptimizationSuggestion[] {
    const now = Date.now();

    // Use cached recommendations if recent
    if (now - this.lastOptimizationAnalysis < this.optimizationAnalysisInterval) {
      return Array.from(this.optimizationCache.values());
    }

    const suggestions: OptimizationSuggestion[] = [];

    // Analyze suggestion performance
    if (this.metrics.suggestionLatency.average > this.THRESHOLDS.suggestionLatency) {
      suggestions.push({
        type: 'suggestion',
        priority: 'high',
        description: `Suggestion latency averaging ${this.metrics.suggestionLatency.average.toFixed(1)}ms exceeds ${this.THRESHOLDS.suggestionLatency}ms threshold`,
        expectedImprovement: `Reduce latency by 30-50% through pre-computation`,
        actionRequired: `Implement background suggestion pre-computation for frequently accessed nodes`,
        estimatedEffort: 'moderate',
        category: 'performance'
      });
    }

    // Analyze cache performance
    if (this.metrics.cacheHitRate.overall < this.THRESHOLDS.cacheHitRate) {
      suggestions.push({
        type: 'cache',
        priority: 'medium',
        description: `Cache hit rate of ${(this.metrics.cacheHitRate.overall * 100).toFixed(1)}% is below ${(this.THRESHOLDS.cacheHitRate * 100)}% target`,
        expectedImprovement: `Increase cache efficiency by 15-25%`,
        actionRequired: `Adjust TTL settings or implement cache warming strategies`,
        estimatedEffort: 'minimal',
        category: 'optimization'
      });
    }

    // Analyze memory usage
    if (this.metrics.memoryUsage.totalMB > this.THRESHOLDS.memoryUsage) {
      suggestions.push({
        type: 'memory',
        priority: 'high',
        description: `Memory usage of ${this.metrics.memoryUsage.totalMB.toFixed(1)}MB exceeds ${this.THRESHOLDS.memoryUsage}MB threshold`,
        expectedImprovement: `Reduce memory usage by 20-40%`,
        actionRequired: `Enable cache compression or reduce cache TTL values`,
        estimatedEffort: 'minimal',
        category: 'resource-management'
      });
    }

    // Analyze throughput patterns
    const queriesPerSecond = this.metrics.throughput.queriesPerSecond;
    if (queriesPerSecond > 100) { // High load scenario
      suggestions.push({
        type: 'query',
        priority: 'medium',
        description: `High query throughput (${queriesPerSecond.toFixed(1)} queries/sec) may benefit from batching`,
        expectedImprovement: `Reduce bridge overhead by 40-60%`,
        actionRequired: `Implement query batching for simultaneous requests`,
        estimatedEffort: 'moderate',
        category: 'scaling'
      });
    }

    // Analyze error rates
    const bridgeErrorRate = this.errorCounts.get('bridge-failures') || 0;
    const totalOperations = this.getTotalOperations();
    if (totalOperations > 0 && (bridgeErrorRate / totalOperations) > this.THRESHOLDS.errorRate) {
      suggestions.push({
        type: 'bridge',
        priority: 'critical',
        description: `Bridge failure rate of ${((bridgeErrorRate / totalOperations) * 100).toFixed(1)}% exceeds ${(this.THRESHOLDS.errorRate * 100)}% threshold`,
        expectedImprovement: `Reduce failures by 70-90% through improved error handling`,
        actionRequired: `Implement retry logic and connection health monitoring`,
        estimatedEffort: 'moderate',
        category: 'reliability'
      });
    }

    // Cache recommendations
    this.optimizationCache.clear();
    suggestions.forEach((suggestion, index) => {
      this.optimizationCache.set(`opt-${index}`, suggestion);
    });

    this.lastOptimizationAnalysis = now;
    return suggestions;
  }

  /**
   * Real-time performance alerts
   */
  private handlePerformanceAlert(type: string, context: string, value: number): void {
    const alert = {
      timestamp: new Date().toISOString(),
      type,
      context,
      value,
      threshold: this.getThreshold(type)
    };

    console.warn('Graph Analytics Performance Alert:', alert);

    // In a production system, this could trigger:
    // - Monitoring system alerts
    // - Automatic cache adjustments
    // - Circuit breaker activation
    // - Load balancing adjustments
  }

  /**
   * Integration with native RenderingPerformanceMonitor
   */
  async getNativeRenderingMetrics(): Promise<NativeRenderingMetrics | null> {
    return performanceMonitor.getNativeMetrics();
  }

  /**
   * Compare graph analytics performance with DOM rendering
   */
  async getPerformanceComparison(datasetSize: number): Promise<PerformanceComparison | null> {
    const complexity = await this.analyzeGraphComplexity();
    return performanceMonitor.getPerformanceComparison(datasetSize, complexity.complexityScore);
  }

  /**
   * Get comprehensive analytics performance metrics
   */
  getAnalyticsMetrics(): AnalyticsMetrics {
    this.updateDerivedMetrics();
    return { ...this.metrics };
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(): {
    suggestionLatencyTrend: number[];
    cacheHitRateTrend: number[];
    memoryUsageTrend: number[];
    throughputTrend: number[];
  } {
    const recentHistory = this.metricsHistory.slice(-10);

    return {
      suggestionLatencyTrend: recentHistory.map(m => m.suggestionLatency.average),
      cacheHitRateTrend: recentHistory.map(m => m.cacheHitRate.overall),
      memoryUsageTrend: recentHistory.map(m => m.memoryUsage.totalMB),
      throughputTrend: recentHistory.map(m => m.throughput.queriesPerSecond)
    };
  }

  /**
   * Export performance data for analysis
   */
  exportMetrics(): {
    current: AnalyticsMetrics;
    history: AnalyticsMetrics[];
    optimizations: OptimizationSuggestion[];
    complexity: Promise<GraphComplexityMetrics>;
  } {
    return {
      current: this.getAnalyticsMetrics(),
      history: [...this.metricsHistory],
      optimizations: this.generateOptimizationSuggestions(),
      complexity: this.analyzeGraphComplexity()
    };
  }

  // MARK: - Private Methods

  private createEmptyMetrics(): AnalyticsMetrics {
    return {
      suggestionLatency: {
        average: 0,
        p95: 0,
        p99: 0,
        samples: 0
      },
      cacheHitRate: {
        overall: 0,
        byNamespace: {},
        trend: []
      },
      computeTime: {
        nativeQueries: 0,
        suggestionGeneration: 0,
        cacheOperations: 0,
        bridgeCommunication: 0
      },
      memoryUsage: {
        totalMB: 0,
        queryCache: 0,
        suggestionCache: 0,
        bridgeBuffers: 0
      },
      throughput: {
        queriesPerSecond: 0,
        suggestionsPerSecond: 0,
        cacheOperationsPerSecond: 0
      },
      errorRates: {
        bridgeFailures: 0,
        timeouts: 0,
        cacheEvictions: 0
      }
    };
  }

  private recordOperationTime(operation: string, duration: number): void {
    if (!this.operationTimes.has(operation)) {
      this.operationTimes.set(operation, []);
    }

    const times = this.operationTimes.get(operation)!;
    times.push(duration);

    // Keep only recent samples
    if (times.length > 100) {
      times.shift();
    }
  }

  private incrementError(errorType: string): void {
    const current = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, current + 1);
  }

  private incrementThroughput(operation: string, count: number): void {
    const now = Date.now();
    const counter = this.throughputCounters.get(operation) || { count: 0, lastReset: now };

    // Reset counter every minute
    if (now - counter.lastReset > 60000) {
      counter.count = 0;
      counter.lastReset = now;
    }

    counter.count += count;
    this.throughputCounters.set(operation, counter);
  }

  private updateSuggestionMetrics(latency: number): void {
    const times = this.operationTimes.get('suggestion-latency') || [];

    if (times.length > 0) {
      times.sort((a, b) => a - b);
      this.metrics.suggestionLatency = {
        average: times.reduce((sum, t) => sum + t, 0) / times.length,
        p95: times[Math.floor(times.length * 0.95)] || 0,
        p99: times[Math.floor(times.length * 0.99)] || 0,
        samples: times.length
      };
    }
  }

  private updateCacheMetrics(operation: string, namespace: string): void {
    // This would integrate with actual cache statistics
    // For now, using placeholder implementation
    const hitRate = Math.max(0.7, Math.random() * 0.3 + 0.7); // Simulate 70-100% hit rate
    this.metrics.cacheHitRate.overall = hitRate;
    this.metrics.cacheHitRate.byNamespace[namespace] = hitRate;
  }

  private updateDerivedMetrics(): void {
    // Update throughput calculations
    const now = Date.now();

    for (const [operation, counter] of this.throughputCounters) {
      const elapsedSeconds = (now - counter.lastReset) / 1000;
      const rate = elapsedSeconds > 0 ? counter.count / elapsedSeconds : 0;

      switch (operation) {
        case 'suggestions':
          this.metrics.throughput.suggestionsPerSecond = rate;
          break;
        case 'queries':
          this.metrics.throughput.queriesPerSecond = rate;
          break;
        case 'cache-operations':
          this.metrics.throughput.cacheOperationsPerSecond = rate;
          break;
      }
    }

    // Update error rates
    this.metrics.errorRates.bridgeFailures = this.errorCounts.get('bridge-failures') || 0;
    this.metrics.errorRates.timeouts = this.errorCounts.get('timeouts') || 0;
    this.metrics.errorRates.cacheEvictions = this.errorCounts.get('cache-evictions') || 0;
  }

  private calculateComplexityScore(metrics: { totalNodes: number; totalEdges: number; graphDensity: number }): number {
    // Normalize to 0-10 scale
    const nodeScore = Math.min(10, metrics.totalNodes / 1000); // 10k nodes = max score
    const edgeScore = Math.min(10, metrics.totalEdges / 10000); // 100k edges = max score
    const densityScore = metrics.graphDensity * 10; // Already 0-1, scale to 0-10

    return (nodeScore + edgeScore + densityScore) / 3;
  }

  private getThreshold(type: string): number {
    switch (type) {
      case 'suggestion-latency': return this.THRESHOLDS.suggestionLatency;
      case 'bridge-latency': return this.THRESHOLDS.bridgeLatency;
      case 'memory-pressure': return this.THRESHOLDS.memoryUsage;
      default: return 0;
    }
  }

  private getTotalOperations(): number {
    let total = 0;
    for (const counter of this.throughputCounters.values()) {
      total += counter.count;
    }
    return total;
  }

  private integrateWithD3Performance(): void {
    // Integration with existing d3Performance monitor
    performanceMonitor.startMetric('graph-analytics-integration');
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      // Capture current metrics snapshot
      this.updateDerivedMetrics();
      const snapshot = { ...this.metrics };

      // Add to history
      this.metricsHistory.push(snapshot);

      // Trim history
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      // Update trend data
      this.metrics.cacheHitRate.trend.push(this.metrics.cacheHitRate.overall);
      if (this.metrics.cacheHitRate.trend.length > 10) {
        this.metrics.cacheHitRate.trend.shift();
      }

    }, 10000); // Every 10 seconds
  }
}

// Export singleton instance
export const graphPerformanceMonitor = GraphPerformanceMonitor.getInstance();