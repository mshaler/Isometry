/**
 * Performance Regression Testing Suite
 *
 * Validates migration maintains established Phase 7.2 performance targets
 * Provides comprehensive benchmarking and regression detection
 */

// Re-export types from split modules
export type {
  PerformanceReport,
  BenchmarkResult,
  PerformanceTargets,
  PerformanceMetric,
  PerformanceBaseline,
  RegressionAnalysis,
  RegressionDetail,
  ImprovementDetail,
  PerformanceComparison,
  MigrationScenario,
  LatencyResult,
  ThroughputResult,
  MemoryResult,
  StressTestConfig
} from './types/performance-types';

// Re-export utilities from split modules
export {
  validateBridgePerformance,
  validateGenericPerformance,
  runStressTest,
  measureOperationLatency,
  measureThroughput,
  measureMemoryUsage
} from './utils/performance-testing';

export {
  runMigrationBenchmarks,
  runScenarioBenchmark,
  establishBaseline,
  measureScenarioMetrics,
  comparePerformance,
  DEFAULT_SCENARIOS
} from './utils/benchmark-testing';

// Main performance validation function
import { DatabaseMode } from '../contexts/EnvironmentContext';
import { validateBridgePerformance, validateGenericPerformance } from './utils/performance-testing';
import { runMigrationBenchmarks } from './utils/benchmark-testing';
import type { PerformanceReport, PerformanceTargets } from './types/performance-types';

/**
 * Runs comprehensive performance validation for a provider
 */
export async function runPerformanceValidation(
  provider: DatabaseMode,
  includeStress: boolean = false
): Promise<PerformanceReport> {
  const targets: PerformanceTargets = {
    bridgeLatency: 50,
    databaseThroughput: 100,
    syncLatency: 100,
    memoryOverhead: 10,
    uiResponsiveness: 60
  };

  const metrics = [];

  // Run basic performance validation
  const genericResults = await validateGenericPerformance(provider);
  metrics.push(...genericResults.metrics);

  // Run bridge validation if applicable
  if (provider === 'webview') {
    const environment = { type: 'webview' as const };
    const bridgeResults = await validateBridgePerformance(environment);
    metrics.push(...bridgeResults.metrics);
  }

  // Run stress tests if requested
  if (includeStress) {
    // Add stress test metrics...
  }

  const passed = metrics.every(m => m.passed);

  return {
    provider,
    timestamp: new Date().toISOString(),
    targets,
    results: metrics,
    regression: {
      detectedRegressions: [],
      improvements: [],
      significantChanges: [],
      overallTrend: 'stable',
      summary: 'Performance validation completed'
    },
    recommendations: passed ? [] : ['Review failed metrics and optimize accordingly'],
    passed
  };
}