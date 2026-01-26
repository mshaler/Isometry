/**
 * Performance Regression Testing Suite
 *
 * Validates migration maintains established Phase 7.2 performance targets
 * Provides comprehensive benchmarking and regression detection
 */

import {
  bridgePerformanceTest,
  PERFORMANCE_TARGETS,
  BridgeTestResult,
  BridgeStressTestResult,
  BridgeComparisonResult
} from '../utils/bridge-performance';
import { DatabaseMode } from '../contexts/EnvironmentContext';
import { Environment } from '../utils/webview-bridge';

export interface PerformanceReport {
  provider: DatabaseMode;
  timestamp: string;
  targets: PerformanceTargets;
  results: PerformanceMetric[];
  regression: RegressionAnalysis;
  recommendations: string[];
  passed: boolean;
}

export interface BenchmarkResult {
  scenario: MigrationScenario;
  baseline: PerformanceBaseline;
  current: PerformanceMetric[];
  comparison: PerformanceComparison;
  passed: boolean;
}

export interface PerformanceTargets {
  bridgeLatency: number;      // < 50ms round-trip
  databaseThroughput: number; // > 100 ops/sec
  syncLatency: number;        // < 100ms
  memoryOverhead: number;     // < 10MB
  uiResponsiveness: number;   // 60fps target
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  target: number;
  passed: boolean;
  deviation: number; // percentage from target
  timestamp: string;
}

export interface PerformanceBaseline {
  provider: DatabaseMode;
  timestamp: string;
  metrics: Record<string, number>;
  environment: {
    platform: string;
    version: string;
    hardware: string;
  };
}

export interface RegressionAnalysis {
  hasRegression: boolean;
  regressionThreshold: number; // 10% by default
  regressions: RegressionDetail[];
  improvements: ImprovementDetail[];
  summary: string;
}

export interface RegressionDetail {
  metric: string;
  baseline: number;
  current: number;
  degradation: number; // percentage
  severity: 'minor' | 'moderate' | 'severe';
}

export interface ImprovementDetail {
  metric: string;
  baseline: number;
  current: number;
  improvement: number; // percentage
}

export interface PerformanceComparison {
  speedup: number;
  memoryEfficiency: number;
  reliabilityScore: number;
  overallScore: number;
}

export interface MigrationScenario {
  name: string;
  fromProvider: DatabaseMode;
  toProvider: DatabaseMode;
  dataSize: 'small' | 'medium' | 'large';
  operationType: 'read' | 'write' | 'mixed';
  concurrency: 'single' | 'low' | 'high';
}

/**
 * Validate performance targets against established Phase 7.2 baselines
 */
export async function validatePerformanceTargets(provider: DatabaseMode): Promise<PerformanceReport> {
  console.log(`🎯 Validating performance targets for ${provider}...`);

  const timestamp = new Date().toISOString();
  const targets = getTargetsForProvider(provider);
  const results: PerformanceMetric[] = [];
  let passed = true;

  try {
    // Bridge-specific testing for WebView provider
    if (provider === DatabaseMode.WEBVIEW_BRIDGE && Environment.isWebView()) {
      const bridgeResults = await validateBridgePerformance();
      results.push(...bridgeResults.metrics);
      if (!bridgeResults.passed) {
        passed = false;
      }
    }

    // Generic performance validation for all providers
    const genericResults = await validateGenericPerformance(provider);
    results.push(...genericResults.metrics);
    if (!genericResults.passed) {
      passed = false;
    }

    // UI responsiveness testing
    const uiResults = await validateUIResponsiveness(provider);
    results.push(...uiResults.metrics);
    if (!uiResults.passed) {
      passed = false;
    }

    // Memory efficiency testing
    const memoryResults = await validateMemoryEfficiency(provider);
    results.push(...memoryResults.metrics);
    if (!memoryResults.passed) {
      passed = false;
    }

    // Generate regression analysis
    const regression = await analyzeRegressions(provider, results);

    // Generate recommendations
    const recommendations = generatePerformanceRecommendations(results, regression);

    return {
      provider,
      timestamp,
      targets,
      results,
      regression,
      recommendations,
      passed
    };

  } catch (error) {
    console.error('Performance validation failed:', error);
    return {
      provider,
      timestamp,
      targets,
      results: [],
      regression: {
        hasRegression: true,
        regressionThreshold: 10,
        regressions: [{
          metric: 'overall',
          baseline: 0,
          current: 0,
          degradation: 100,
          severity: 'severe'
        }],
        improvements: [],
        summary: `Validation failed: ${error instanceof Error ? error.message : String(error)}`
      },
      recommendations: ['Fix validation errors before proceeding with migration'],
      passed: false
    };
  }
}

/**
 * Benchmark migration path performance
 */
export async function benchmarkMigrationPath(scenario: MigrationScenario): Promise<BenchmarkResult> {
  console.log(`📊 Benchmarking migration: ${scenario.name}`);

  try {
    // Establish baseline performance
    const baseline = await establishPerformanceBaseline(scenario.fromProvider);

    // Perform migration benchmark
    const migrationStart = performance.now();
    const migrationResults = await performMigrationBenchmark(scenario);
    const migrationDuration = performance.now() - migrationStart;

    // Measure target provider performance
    const targetResults = await measureProviderPerformance(scenario.toProvider, scenario);

    // Compare performance
    const comparison = compareMigrationPerformance(baseline.metrics, targetResults, migrationDuration);

    return {
      scenario,
      baseline,
      current: targetResults,
      comparison,
      passed: comparison.overallScore > 0.8 // 80% threshold
    };

  } catch (error) {
    console.error('Migration benchmark failed:', error);
    return {
      scenario,
      baseline: createEmptyBaseline(scenario.fromProvider),
      current: [],
      comparison: {
        speedup: 0,
        memoryEfficiency: 0,
        reliabilityScore: 0,
        overallScore: 0
      },
      passed: false
    };
  }
}

/**
 * Detect performance regressions from baseline
 */
export async function detectRegressions(baseline: PerformanceBaseline): Promise<RegressionAnalysis> {
  console.log('🔍 Detecting performance regressions...');

  try {
    const currentMetrics = await measureCurrentPerformance(baseline.provider);
    const regressionThreshold = 10; // 10% degradation threshold

    const regressions: RegressionDetail[] = [];
    const improvements: ImprovementDetail[] = [];

    for (const [metric, baselineValue] of Object.entries(baseline.metrics)) {
      const currentValue = currentMetrics[metric];
      if (currentValue === undefined) continue;

      const change = ((currentValue - baselineValue) / baselineValue) * 100;

      if (change < -regressionThreshold) {
        // Performance degradation
        regressions.push({
          metric,
          baseline: baselineValue,
          current: currentValue,
          degradation: Math.abs(change),
          severity: getSeverity(Math.abs(change))
        });
      } else if (change > regressionThreshold) {
        // Performance improvement
        improvements.push({
          metric,
          baseline: baselineValue,
          current: currentValue,
          improvement: change
        });
      }
    }

    const hasRegression = regressions.length > 0;
    const summary = generateRegressionSummary(regressions, improvements);

    return {
      hasRegression,
      regressionThreshold,
      regressions,
      improvements,
      summary
    };

  } catch (error) {
    return {
      hasRegression: true,
      regressionThreshold: 10,
      regressions: [],
      improvements: [],
      summary: `Regression analysis failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Stress test migration under extreme load
 */
export async function stressTestMigration(loadLevel: 'light' | 'heavy' | 'extreme'): Promise<{
  loadLevel: string;
  results: BridgeStressTestResult;
  performanceImpact: number;
  passed: boolean;
}> {
  console.log(`💪 Stress testing migration: ${loadLevel} load`);

  try {
    const operationCounts = {
      light: 100,
      heavy: 500,
      extreme: 1000
    };

    const operationCount = operationCounts[loadLevel];
    const stressResults = await performStressTest(operationCount);

    // Calculate performance impact
    const expectedThroughput = PERFORMANCE_TARGETS.databaseOps;
    const actualThroughput = stressResults.throughput;
    const performanceImpact = ((actualThroughput - expectedThroughput) / expectedThroughput) * 100;

    // Determine if test passed
    const minSuccessRate = loadLevel === 'extreme' ? 90 : 95; // Lower threshold for extreme load
    const successRate = (stressResults.successfulOperations / stressResults.totalOperations) * 100;
    const passed = successRate >= minSuccessRate && actualThroughput >= expectedThroughput * 0.8;

    return {
      loadLevel,
      results: stressResults,
      performanceImpact,
      passed
    };

  } catch (error) {
    return {
      loadLevel,
      results: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        throughput: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      },
      performanceImpact: -100,
      passed: false
    };
  }
}

// =============================================================================
// Bridge Performance Validation
// =============================================================================

async function validateBridgePerformance(): Promise<{ metrics: PerformanceMetric[]; passed: boolean }> {
  const bridgeResults = await bridgePerformanceTest();
  const metrics: PerformanceMetric[] = [];
  let passed = true;

  // Convert bridge test results to performance metrics
  for (const result of bridgeResults.results) {
    const target = getTargetForTest(result.test);
    const metricPassed = result.success && result.duration <= target;

    metrics.push({
      name: result.test,
      value: result.duration,
      unit: 'ms',
      target,
      passed: metricPassed,
      deviation: ((result.duration - target) / target) * 100,
      timestamp: new Date().toISOString()
    });

    if (!metricPassed) {
      passed = false;
    }
  }

  // Add throughput metric if available from stress test
  if (bridgeResults.stress) {
    const throughputPassed = bridgeResults.stress.throughput >= PERFORMANCE_TARGETS.databaseOps;
    metrics.push({
      name: 'database-throughput',
      value: bridgeResults.stress.throughput,
      unit: 'ops/sec',
      target: PERFORMANCE_TARGETS.databaseOps,
      passed: throughputPassed,
      deviation: ((bridgeResults.stress.throughput - PERFORMANCE_TARGETS.databaseOps) / PERFORMANCE_TARGETS.databaseOps) * 100,
      timestamp: new Date().toISOString()
    });

    if (!throughputPassed) {
      passed = false;
    }
  }

  return { metrics, passed };
}

// =============================================================================
// Generic Performance Validation
// =============================================================================

async function validateGenericPerformance(provider: DatabaseMode): Promise<{ metrics: PerformanceMetric[]; passed: boolean }> {
  const metrics: PerformanceMetric[] = [];
  let passed = true;

  // Test basic operation latency
  const latencyResult = await measureOperationLatency(provider);
  const latencyTarget = getGenericLatencyTarget(provider);
  const latencyPassed = latencyResult.averageLatency <= latencyTarget;

  metrics.push({
    name: 'operation-latency',
    value: latencyResult.averageLatency,
    unit: 'ms',
    target: latencyTarget,
    passed: latencyPassed,
    deviation: ((latencyResult.averageLatency - latencyTarget) / latencyTarget) * 100,
    timestamp: new Date().toISOString()
  });

  if (!latencyPassed) {
    passed = false;
  }

  // Test throughput
  const throughputResult = await measureThroughput(provider);
  const throughputTarget = getThroughputTarget(provider);
  const throughputPassed = throughputResult.opsPerSecond >= throughputTarget;

  metrics.push({
    name: 'throughput',
    value: throughputResult.opsPerSecond,
    unit: 'ops/sec',
    target: throughputTarget,
    passed: throughputPassed,
    deviation: ((throughputResult.opsPerSecond - throughputTarget) / throughputTarget) * 100,
    timestamp: new Date().toISOString()
  });

  if (!throughputPassed) {
    passed = false;
  }

  return { metrics, passed };
}

// =============================================================================
// UI Responsiveness Testing
// =============================================================================

async function validateUIResponsiveness(provider: DatabaseMode): Promise<{ metrics: PerformanceMetric[]; passed: boolean }> {
  const metrics: PerformanceMetric[] = [];
  let passed = true;

  try {
    // Measure rendering performance during database operations
    const renderingTest = await measureRenderingPerformance(provider);
    const fpsTarget = 60; // 60 FPS target
    const fpsPassed = renderingTest.averageFPS >= fpsTarget * 0.9; // 90% of target

    metrics.push({
      name: 'ui-fps',
      value: renderingTest.averageFPS,
      unit: 'fps',
      target: fpsTarget,
      passed: fpsPassed,
      deviation: ((renderingTest.averageFPS - fpsTarget) / fpsTarget) * 100,
      timestamp: new Date().toISOString()
    });

    // Measure input latency
    const inputLatency = await measureInputLatency(provider);
    const latencyTarget = 16; // 16ms for 60fps
    const latencyPassed = inputLatency <= latencyTarget;

    metrics.push({
      name: 'input-latency',
      value: inputLatency,
      unit: 'ms',
      target: latencyTarget,
      passed: latencyPassed,
      deviation: ((inputLatency - latencyTarget) / latencyTarget) * 100,
      timestamp: new Date().toISOString()
    });

    passed = fpsPassed && latencyPassed;

  } catch (error) {
    console.warn('UI responsiveness testing failed:', error);
    passed = false;
  }

  return { metrics, passed };
}

// =============================================================================
// Memory Efficiency Testing
// =============================================================================

async function validateMemoryEfficiency(provider: DatabaseMode): Promise<{ metrics: PerformanceMetric[]; passed: boolean }> {
  const metrics: PerformanceMetric[] = [];
  let passed = true;

  try {
    // Measure memory usage during operations
    const memoryTest = await measureMemoryUsage(provider);
    const memoryTarget = PERFORMANCE_TARGETS.memoryOverhead * 1024 * 1024; // Convert MB to bytes
    const memoryPassed = memoryTest.peakUsage <= memoryTarget;

    metrics.push({
      name: 'memory-overhead',
      value: memoryTest.peakUsage / 1024 / 1024, // Convert to MB
      unit: 'MB',
      target: PERFORMANCE_TARGETS.memoryOverhead,
      passed: memoryPassed,
      deviation: ((memoryTest.peakUsage - memoryTarget) / memoryTarget) * 100,
      timestamp: new Date().toISOString()
    });

    // Check for memory leaks
    const leakTest = await detectMemoryLeaks(provider);
    const leaksPassed = !leakTest.hasLeaks;

    metrics.push({
      name: 'memory-leaks',
      value: leakTest.growthRate,
      unit: '%',
      target: 0,
      passed: leaksPassed,
      deviation: leakTest.growthRate,
      timestamp: new Date().toISOString()
    });

    passed = memoryPassed && leaksPassed;

  } catch (error) {
    console.warn('Memory efficiency testing failed:', error);
    passed = false;
  }

  return { metrics, passed };
}

// =============================================================================
// Supporting Functions
// =============================================================================

function getTargetsForProvider(provider: DatabaseMode): PerformanceTargets {
  return {
    bridgeLatency: PERFORMANCE_TARGETS.bridgeLatency,
    databaseThroughput: provider === DatabaseMode.WEBVIEW_BRIDGE ? PERFORMANCE_TARGETS.databaseOps : PERFORMANCE_TARGETS.databaseOps * 0.8,
    syncLatency: PERFORMANCE_TARGETS.syncLatency,
    memoryOverhead: PERFORMANCE_TARGETS.memoryOverhead,
    uiResponsiveness: 60
  };
}

function getTargetForTest(testName: string): number {
  const targets: Record<string, number> = {
    'bridge-latency': PERFORMANCE_TARGETS.bridgeLatency,
    'database-throughput': PERFORMANCE_TARGETS.databaseOps,
    'sync-latency': PERFORMANCE_TARGETS.syncLatency,
    'memory-overhead': PERFORMANCE_TARGETS.memoryOverhead,
    'large-data-transfer': 500,
    'concurrent-operations': PERFORMANCE_TARGETS.bridgeLatency,
    'error-recovery': 100
  };

  return targets[testName] || 100;
}

function getGenericLatencyTarget(provider: DatabaseMode): number {
  switch (provider) {
    case DatabaseMode.WEBVIEW_BRIDGE:
      return 50;
    case DatabaseMode.HTTP_API:
      return 100;
    // SQL.js mode no longer supported
    default:
      return 25;
  }
}

function getThroughputTarget(provider: DatabaseMode): number {
  switch (provider) {
    case DatabaseMode.WEBVIEW_BRIDGE:
      return 100;
    case DatabaseMode.HTTP_API:
      return 50;
    // SQL.js mode no longer supported
    default:
      return 200;
  }
}

function getSeverity(degradation: number): 'minor' | 'moderate' | 'severe' {
  if (degradation < 15) return 'minor';
  if (degradation < 30) return 'moderate';
  return 'severe';
}

function generateRegressionSummary(regressions: RegressionDetail[], improvements: ImprovementDetail[]): string {
  if (regressions.length === 0 && improvements.length === 0) {
    return 'No significant performance changes detected';
  }

  let summary = '';

  if (regressions.length > 0) {
    const severeRegressions = regressions.filter(r => r.severity === 'severe');
    if (severeRegressions.length > 0) {
      summary += `⚠️ ${severeRegressions.length} severe regression(s) detected. `;
    }
    summary += `${regressions.length} total regression(s). `;
  }

  if (improvements.length > 0) {
    summary += `✅ ${improvements.length} improvement(s) detected.`;
  }

  return summary.trim();
}

function generatePerformanceRecommendations(metrics: PerformanceMetric[], regression: RegressionAnalysis): string[] {
  const recommendations: string[] = [];

  // Analyze failed metrics
  const failedMetrics = metrics.filter(m => !m.passed);
  for (const metric of failedMetrics) {
    switch (metric.name) {
      case 'bridge-latency':
        recommendations.push('🔧 Bridge latency exceeds target - consider optimizing MessageHandler communication');
        break;
      case 'database-throughput':
        recommendations.push('📊 Database throughput below target - review query optimization and indexing');
        break;
      case 'memory-overhead':
        recommendations.push('💾 Memory usage exceeds limit - investigate potential memory leaks');
        break;
      case 'ui-fps':
        recommendations.push('🎨 UI performance below target - optimize rendering during database operations');
        break;
    }
  }

  // Analyze regressions
  for (const regr of regression.regressions) {
    if (regr.severity === 'severe') {
      recommendations.push(`⚠️ Severe regression in ${regr.metric}: ${regr.degradation.toFixed(1)}% degradation`);
    }
  }

  // General recommendations if no specific issues
  if (recommendations.length === 0 && metrics.every(m => m.passed)) {
    recommendations.push('✅ All performance targets met - migration ready');
  }

  return recommendations;
}

// =============================================================================
// Mock Implementations (would be replaced with actual measurements)
// =============================================================================

async function establishPerformanceBaseline(provider: DatabaseMode): Promise<PerformanceBaseline> {
  return {
    provider,
    timestamp: new Date().toISOString(),
    metrics: {
      latency: 30,
      throughput: 120,
      memory: 8,
      fps: 58
    },
    environment: {
      platform: Environment.info().platform,
      version: Environment.info().version,
      hardware: 'mock-hardware'
    }
  };
}

async function performMigrationBenchmark(scenario: MigrationScenario): Promise<void> {
  // Mock migration benchmark
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function measureProviderPerformance(provider: DatabaseMode, scenario: MigrationScenario): Promise<PerformanceMetric[]> {
  return [
    {
      name: 'migration-latency',
      value: 45,
      unit: 'ms',
      target: 50,
      passed: true,
      deviation: -10,
      timestamp: new Date().toISOString()
    }
  ];
}

async function measureCurrentPerformance(provider: DatabaseMode): Promise<Record<string, number>> {
  return {
    latency: 35,
    throughput: 110,
    memory: 9,
    fps: 57
  };
}

async function performStressTest(operationCount: number): Promise<BridgeStressTestResult> {
  return {
    totalOperations: operationCount,
    successfulOperations: Math.floor(operationCount * 0.95),
    failedOperations: Math.floor(operationCount * 0.05),
    averageLatency: 45,
    maxLatency: 120,
    minLatency: 15,
    throughput: 95,
    errors: []
  };
}

async function measureOperationLatency(provider: DatabaseMode): Promise<{ averageLatency: number }> {
  return { averageLatency: 40 };
}

async function measureThroughput(provider: DatabaseMode): Promise<{ opsPerSecond: number }> {
  return { opsPerSecond: 110 };
}

async function measureRenderingPerformance(provider: DatabaseMode): Promise<{ averageFPS: number }> {
  return { averageFPS: 58 };
}

async function measureInputLatency(provider: DatabaseMode): Promise<number> {
  return 14;
}

async function measureMemoryUsage(provider: DatabaseMode): Promise<{ peakUsage: number }> {
  return { peakUsage: 8 * 1024 * 1024 }; // 8MB
}

async function detectMemoryLeaks(provider: DatabaseMode): Promise<{ hasLeaks: boolean; growthRate: number }> {
  return { hasLeaks: false, growthRate: 0.1 };
}

function createEmptyBaseline(provider: DatabaseMode): PerformanceBaseline {
  return {
    provider,
    timestamp: new Date().toISOString(),
    metrics: {},
    environment: {
      platform: 'unknown',
      version: '0.0.0',
      hardware: 'unknown'
    }
  };
}

function compareMigrationPerformance(
  baseline: Record<string, number>,
  current: PerformanceMetric[],
  migrationDuration: number
): PerformanceComparison {
  return {
    speedup: 1.1,
    memoryEfficiency: 0.95,
    reliabilityScore: 0.96,
    overallScore: 0.87
  };
}