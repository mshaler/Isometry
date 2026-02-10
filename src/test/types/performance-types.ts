/**
 * Performance Testing Types
 *
 * Type definitions for performance regression testing
 */

import { DatabaseMode } from '../../contexts/EnvironmentContext';

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
  established: string; // ISO date
  metrics: PerformanceMetric[];
  environment: string;
  version: string;
  notes: string;
}

export interface RegressionAnalysis {
  detectedRegressions: RegressionDetail[];
  improvements: ImprovementDetail[];
  significantChanges: PerformanceMetric[];
  overallTrend: 'improving' | 'stable' | 'regressing';
  summary: string;
}

export interface RegressionDetail {
  metric: string;
  previousValue: number;
  currentValue: number;
  degradationPercent: number;
  severity: 'minor' | 'moderate' | 'severe';
}

export interface ImprovementDetail {
  metric: string;
  previousValue: number;
  currentValue: number;
  improvementPercent: number;
}

export interface PerformanceComparison {
  improvementCount: number;
  regressionCount: number;
  stableCount: number;
  overallScore: number; // 0-100
}

export interface MigrationScenario {
  name: string;
  description: string;
  dataSize: 'small' | 'medium' | 'large' | 'xl';
  complexity: 'simple' | 'moderate' | 'complex';
  expectedDuration: number; // seconds
}

export interface LatencyResult {
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  samples: number[];
}

export interface ThroughputResult {
  opsPerSecond: number;
  totalOperations: number;
  duration: number;
  peakThroughput: number;
}

export interface MemoryResult {
  peakMemoryUsage: number;
  averageMemoryUsage: number;
  memoryLeaks: boolean;
  gcPressure: number;
}

export interface StressTestConfig {
  duration: number; // seconds
  concurrency: number;
  operationMix: {
    reads: number; // percentage
    writes: number; // percentage
    queries: number; // percentage
  };
  dataVolume: number; // MB
}
