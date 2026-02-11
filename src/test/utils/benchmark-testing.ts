/**
 * Benchmark Testing Utilities
 *
 * Utilities for benchmarking and migration scenario testing
 */

import { DatabaseMode } from '../../contexts/EnvironmentContext';
import { devLogger } from '../../utils/logging/dev-logger';
import type {
  BenchmarkResult,
  MigrationScenario,
  PerformanceBaseline,
  PerformanceComparison,
  PerformanceMetric
} from '../types/performance-types';

/**
 * Runs comprehensive migration scenario benchmarks
 */
export async function runMigrationBenchmarks(
  sourceProvider: DatabaseMode,
  targetProvider: DatabaseMode,
  scenarios: MigrationScenario[] = DEFAULT_SCENARIOS
): Promise<BenchmarkResult[]> {
  devLogger.info(`Running migration benchmarks: ${sourceProvider} → ${targetProvider}`);
  
  const results: BenchmarkResult[] = [];
  
  for (const scenario of scenarios) {
    const result = await runScenarioBenchmark(scenario, sourceProvider, targetProvider);
    results.push(result);
  }
  
  return results;
}

/**
 * Runs benchmark for a specific scenario
 */
export async function runScenarioBenchmark(
  scenario: MigrationScenario,
  sourceProvider: DatabaseMode,
  targetProvider: DatabaseMode
): Promise<BenchmarkResult> {
  devLogger.info(`Benchmarking scenario: ${scenario.name}`);
  
  // Get baseline metrics
  const baseline = await establishBaseline(scenario, sourceProvider);
  
  // Run current metrics
  const current = await measureScenarioMetrics(scenario, targetProvider);
  
  // Compare results
  const comparison = comparePerformance(baseline.metrics, current);
  
  return {
    scenario,
    baseline,
    current,
    comparison,
    passed: comparison.overallScore >= 80 // 80% threshold
  };
}

/**
 * Establishes performance baseline for scenario
 */
export async function establishBaseline(
  scenario: MigrationScenario,
  provider: DatabaseMode
): Promise<PerformanceBaseline> {
  const metrics = await measureScenarioMetrics(scenario, provider);
  
  return {
    provider,
    established: new Date().toISOString(),
    metrics,
    environment: 'test',
    version: '1.0.0',
    notes: `Baseline for ${scenario.name}`
  };
}

/**
 * Measures performance metrics for a scenario
 */
export async function measureScenarioMetrics(
  scenario: MigrationScenario,
  provider: DatabaseMode
): Promise<PerformanceMetric[]> {
  const metrics: PerformanceMetric[] = [];
  
  // Simulate scenario execution and measurement
  const executionTime = await simulateScenarioExecution(scenario, provider);
  
  metrics.push({
    name: 'execution-time',
    value: executionTime,
    unit: 'ms',
    target: scenario.expectedDuration * 1000,
    passed: executionTime <= scenario.expectedDuration * 1000,
    deviation: ((executionTime - scenario.expectedDuration * 1000) / (scenario.expectedDuration * 1000)) * 100,
    timestamp: new Date().toISOString()
  });
  
  // Add more scenario-specific metrics here...
  
  return metrics;
}

/**
 * Compares current performance against baseline
 */
export function comparePerformance(
  baseline: PerformanceMetric[],
  current: PerformanceMetric[]
): PerformanceComparison {
  let improvementCount = 0;
  let regressionCount = 0;
  let stableCount = 0;
  
  // Compare metrics by name
  for (const currentMetric of current) {
    const baselineMetric = baseline.find(m => m.name === currentMetric.name);
    
    if (baselineMetric) {
      const change = ((currentMetric.value - baselineMetric.value) / baselineMetric.value) * 100;
      
      if (Math.abs(change) < 5) {
        stableCount++;
      } else if (change > 0) {
        // For metrics where lower is better (like latency), increase is regression
        if (currentMetric.unit === 'ms' || currentMetric.unit === 'MB') {
          regressionCount++;
        } else {
          improvementCount++;
        }
      } else {
        // For metrics where lower is better, decrease is improvement
        if (currentMetric.unit === 'ms' || currentMetric.unit === 'MB') {
          improvementCount++;
        } else {
          regressionCount++;
        }
      }
    } else {
      stableCount++; // New metric, consider stable
    }
  }
  
  const totalCount = improvementCount + regressionCount + stableCount;
  const overallScore = totalCount > 0 
    ? ((improvementCount + stableCount) / totalCount) * 100 
    : 100;
  
  return {
    improvementCount,
    regressionCount,
    stableCount,
    overallScore
  };
}

// Helper functions
async function simulateScenarioExecution(
  scenario: MigrationScenario,
  provider: DatabaseMode
): Promise<number> {
  const baseTime = getBaseExecutionTime(scenario);
  const providerMultiplier = getProviderMultiplier(provider);
  const complexityMultiplier = getComplexityMultiplier(scenario.complexity);
  
  return baseTime * providerMultiplier * complexityMultiplier + Math.random() * 100;
}

function getBaseExecutionTime(scenario: MigrationScenario): number {
  const sizeMultipliers = {
    small: 100,
    medium: 500,
    large: 2000,
    xl: 10000
  };
  
  return sizeMultipliers[scenario.dataSize];
}

function getProviderMultiplier(provider: DatabaseMode): number {
  return provider === DatabaseMode.WEBVIEW_BRIDGE ? 0.5 : 1.0;
}

function getComplexityMultiplier(complexity: MigrationScenario['complexity']): number {
  const complexityMultipliers = {
    simple: 1.0,
    moderate: 1.5,
    complex: 2.5
  };
  
  return complexityMultipliers[complexity];
}

// Default test scenarios
const DEFAULT_SCENARIOS: MigrationScenario[] = [
  {
    name: 'small-dataset-migration',
    description: 'Migration of small dataset with basic relationships',
    dataSize: 'small',
    complexity: 'simple',
    expectedDuration: 5
  },
  {
    name: 'medium-dataset-migration',
    description: 'Migration of medium dataset with moderate complexity',
    dataSize: 'medium',
    complexity: 'moderate',
    expectedDuration: 15
  },
  {
    name: 'large-dataset-migration',
    description: 'Migration of large dataset with complex relationships',
    dataSize: 'large',
    complexity: 'complex',
    expectedDuration: 60
  },
  {
    name: 'xl-dataset-migration',
    description: 'Migration of extra-large dataset with maximum complexity',
    dataSize: 'xl',
    complexity: 'complex',
    expectedDuration: 300
  }
];

export { DEFAULT_SCENARIOS };
