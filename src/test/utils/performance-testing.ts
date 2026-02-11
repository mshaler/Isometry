/**
 * Performance Testing Utilities
 *
 * Core utilities for performance validation and regression testing
 */

import {
  bridgePerformanceTest,
  PERFORMANCE_TARGETS,
  BridgeStressTestResult
} from '../../utils/bridge-performance';
import { DatabaseMode } from '../../contexts/EnvironmentContext';
import { Environment } from '../../utils/webview-bridge';
import { devLogger } from '../../utils/logging/dev-logger';
import type {
  PerformanceReport,
  PerformanceMetric,
  RegressionAnalysis,
  LatencyResult,
  ThroughputResult,
  MemoryResult,
  StressTestConfig
} from '../types/performance-types';

/**
 * Validates bridge performance meets targets
 */
export async function validateBridgePerformance(
  environment: Environment
): Promise<{ metrics: PerformanceMetric[]; passed: boolean }> {
  devLogger.info('Validating bridge performance');
  
  const metrics: PerformanceMetric[] = [];
  let passed = true;

  // Test basic latency
  const latencyResults = await bridgePerformanceTest(environment, 'basic');
  const latencyPassed = latencyResults.averageLatency <= PERFORMANCE_TARGETS.bridgeLatency;

  metrics.push({
    name: 'bridge-latency',
    value: latencyResults.averageLatency,
    unit: 'ms',
    target: PERFORMANCE_TARGETS.bridgeLatency,
    passed: latencyPassed,
    deviation: ((latencyResults.averageLatency - PERFORMANCE_TARGETS.bridgeLatency) / PERFORMANCE_TARGETS.bridgeLatency) * 100,
    timestamp: new Date().toISOString()
  });

  if (!latencyPassed) {
    passed = false;
  }

  // Test stress conditions
  const bridgeResults = await bridgePerformanceTest(environment, 'stress') as BridgeStressTestResult;
  
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

/**
 * Validates generic performance for any provider
 */
export async function validateGenericPerformance(
  provider: DatabaseMode
): Promise<{ metrics: PerformanceMetric[]; passed: boolean }> {
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

/**
 * Runs comprehensive performance stress test
 */
export async function runStressTest(
  provider: DatabaseMode,
  config: StressTestConfig
): Promise<PerformanceReport> {
  devLogger.info(`Running stress test for ${provider}`);

  const metrics: PerformanceMetric[] = [];
  
  // Memory testing
  const memoryResult = await measureMemoryUsage(provider, config);
  const memoryPassed = memoryResult.peakMemoryUsage <= PERFORMANCE_TARGETS.memoryOverhead;
  
  metrics.push({
    name: 'peak-memory',
    value: memoryResult.peakMemoryUsage,
    unit: 'MB',
    target: PERFORMANCE_TARGETS.memoryOverhead,
    passed: memoryPassed,
    deviation: ((memoryResult.peakMemoryUsage - PERFORMANCE_TARGETS.memoryOverhead) / PERFORMANCE_TARGETS.memoryOverhead) * 100,
    timestamp: new Date().toISOString()
  });
  
  // Add other stress test metrics here...
  
  const passed = metrics.every(m => m.passed);
  
  return {
    provider,
    timestamp: new Date().toISOString(),
    targets: {
      bridgeLatency: PERFORMANCE_TARGETS.bridgeLatency,
      databaseThroughput: PERFORMANCE_TARGETS.databaseOps,
      syncLatency: PERFORMANCE_TARGETS.syncLatency,
      memoryOverhead: PERFORMANCE_TARGETS.memoryOverhead,
      uiResponsiveness: 60
    },
    results: metrics,
    regression: analyzeRegressions(metrics, []),
    recommendations: generateRecommendations(metrics),
    passed
  };
}

// Helper functions
export async function measureOperationLatency(_provider: DatabaseMode): Promise<LatencyResult> {
  const samples: number[] = [];
  
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    // Simulate operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    const end = performance.now();
    samples.push(end - start);
  }
  
  samples.sort((a, b) => a - b);
  
  return {
    averageLatency: samples.reduce((a, b) => a + b) / samples.length,
    p50Latency: samples[Math.floor(samples.length * 0.5)],
    p95Latency: samples[Math.floor(samples.length * 0.95)],
    p99Latency: samples[Math.floor(samples.length * 0.99)],
    samples
  };
}

export async function measureThroughput(_provider: DatabaseMode): Promise<ThroughputResult> {
  const duration = 10; // seconds
  let operations = 0;
  const start = Date.now();
  
  while (Date.now() - start < duration * 1000) {
    // Simulate operation
    await new Promise(resolve => setTimeout(resolve, 1));
    operations++;
  }
  
  const actualDuration = (Date.now() - start) / 1000;
  
  return {
    opsPerSecond: operations / actualDuration,
    totalOperations: operations,
    duration: actualDuration,
    peakThroughput: operations / actualDuration
  };
}

export async function measureMemoryUsage(_provider: DatabaseMode, _config: StressTestConfig): Promise<MemoryResult> {
  // Mock memory measurement
  return {
    peakMemoryUsage: Math.random() * 100, // MB
    averageMemoryUsage: Math.random() * 50, // MB
    memoryLeaks: false,
    gcPressure: Math.random() * 10
  };
}

function getGenericLatencyTarget(provider: DatabaseMode): number {
  return provider === DatabaseMode.WEBVIEW_BRIDGE ? 10 : 50; // ms
}

function getThroughputTarget(provider: DatabaseMode): number {
  return provider === DatabaseMode.WEBVIEW_BRIDGE ? 1000 : 100; // ops/sec
}

function analyzeRegressions(_current: PerformanceMetric[], _baseline: PerformanceMetric[]): RegressionAnalysis {
  // Mock regression analysis
  return {
    detectedRegressions: [],
    improvements: [],
    significantChanges: [],
    overallTrend: 'stable',
    summary: 'No significant regressions detected'
  };
}

function generateRecommendations(metrics: PerformanceMetric[]): string[] {
  const recommendations: string[] = [];
  
  for (const metric of metrics) {
    if (!metric.passed) {
      recommendations.push(`Improve ${metric.name}: target ${metric.target}${metric.unit}, actual ${metric.value}${metric.unit}`);
    }
  }
  
  return recommendations;
}
