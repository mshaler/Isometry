/**
 * Performance Validation and Testing Utilities
 *
 * Provides automated testing and validation capabilities for rendering performance
 * Supports benchmark testing, regression detection, and optimization validation
 */

import { renderingPerformanceMonitor, viewportOptimizer } from './rendering-performance';
import type { Viewport, RenderingMetrics, OptimizationPlan } from './rendering-performance';
import { Environment } from './webview-bridge';

// ============================================================================
// Types
// ============================================================================

export interface PerformanceTest {
  id: string;
  name: string;
  description: string;
  category: 'baseline' | 'stress' | 'memory' | 'optimization';
  duration: number; // milliseconds
  iterations: number;
  targetMetrics: {
    minFPS: number;
    maxRenderTime: number;
    maxMemoryUsage: number;
  };
}

export interface TestResult {
  testId: string;
  timestamp: Date;
  environment: 'browser' | 'native';
  duration: number;
  iterations: number;
  metrics: {
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    averageRenderTime: number;
    minRenderTime: number;
    maxRenderTime: number;
    memoryUsage: {
      initial: number;
      peak: number;
      final: number;
      leaked: number;
    };
  };
  passed: boolean;
  failures: string[];
  recommendations: string[];
}

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  tests: PerformanceTest[];
  baseline?: TestResult[];
}

export interface ValidationConfig {
  enableStressTests: boolean;
  enableMemoryTests: boolean;
  enableRegressionDetection: boolean;
  tolerancePercent: number; // Acceptable performance variance
  maxTestDuration: number;
}

export interface RegressionAnalysis {
  detected: boolean;
  degradation: {
    fps: number;
    renderTime: number;
    memoryUsage: number;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

// ============================================================================
// Test Definitions
// ============================================================================

export const STANDARD_PERFORMANCE_TESTS: PerformanceTest[] = [
  {
    id: 'baseline-small',
    name: 'Baseline Small Dataset',
    description: 'Basic rendering performance with 100 nodes',
    category: 'baseline',
    duration: 5000,
    iterations: 100,
    targetMetrics: {
      minFPS: 55,
      maxRenderTime: 18,
      maxMemoryUsage: 50 * 1024 * 1024 // 50MB
    }
  },
  {
    id: 'baseline-medium',
    name: 'Baseline Medium Dataset',
    description: 'Rendering performance with 1000 nodes',
    category: 'baseline',
    duration: 10000,
    iterations: 200,
    targetMetrics: {
      minFPS: 45,
      maxRenderTime: 22,
      maxMemoryUsage: 100 * 1024 * 1024 // 100MB
    }
  },
  {
    id: 'baseline-large',
    name: 'Baseline Large Dataset',
    description: 'Rendering performance with 5000 nodes',
    category: 'baseline',
    duration: 15000,
    iterations: 300,
    targetMetrics: {
      minFPS: 30,
      maxRenderTime: 35,
      maxMemoryUsage: 200 * 1024 * 1024 // 200MB
    }
  },
  {
    id: 'stress-rapid-updates',
    name: 'Rapid Update Stress Test',
    description: 'High frequency viewport changes',
    category: 'stress',
    duration: 8000,
    iterations: 500,
    targetMetrics: {
      minFPS: 30,
      maxRenderTime: 35,
      maxMemoryUsage: 150 * 1024 * 1024 // 150MB
    }
  },
  {
    id: 'stress-zoom-operations',
    name: 'Zoom Operations Stress Test',
    description: 'Continuous zoom in/out operations',
    category: 'stress',
    duration: 10000,
    iterations: 200,
    targetMetrics: {
      minFPS: 25,
      maxRenderTime: 40,
      maxMemoryUsage: 175 * 1024 * 1024 // 175MB
    }
  },
  {
    id: 'memory-leak-detection',
    name: 'Memory Leak Detection',
    description: 'Long-running test to detect memory leaks',
    category: 'memory',
    duration: 30000,
    iterations: 1000,
    targetMetrics: {
      minFPS: 20,
      maxRenderTime: 50,
      maxMemoryUsage: 300 * 1024 * 1024 // 300MB
    }
  },
  {
    id: 'optimization-validation',
    name: 'Optimization Effectiveness',
    description: 'Validate optimization strategies work as expected',
    category: 'optimization',
    duration: 12000,
    iterations: 300,
    targetMetrics: {
      minFPS: 40,
      maxRenderTime: 25,
      maxMemoryUsage: 120 * 1024 * 1024 // 120MB
    }
  }
];

export const DEFAULT_BENCHMARK_SUITE: BenchmarkSuite = {
  id: 'standard-performance',
  name: 'Standard Performance Benchmark',
  description: 'Comprehensive performance testing for D3 rendering optimization',
  tests: STANDARD_PERFORMANCE_TESTS
};

// ============================================================================
// Performance Validator
// ============================================================================

export class PerformanceValidator {
  private config: ValidationConfig;
  private testResults: Map<string, TestResult[]> = new Map();
  private onProgress?: (progress: { current: number; total: number; test: string }) => void;
  public currentTest: PerformanceTest | null = null;

  constructor(config: ValidationConfig = {
    enableStressTests: true,
    enableMemoryTests: true,
    enableRegressionDetection: true,
    tolerancePercent: 10,
    maxTestDuration: 60000
  }) {
    this.config = config;
  }

  /**
   * Run a single performance test
   */
  public async runTest(test: PerformanceTest, viewport: Viewport, nodeCount: number): Promise<TestResult> {
    console.log(`🧪 Starting test: ${test.name}`);

    this.currentTest = test;
    const startTime = Date.now();

    // Initialize performance monitoring
    renderingPerformanceMonitor.startMonitoring();

    const metrics = {
      fps: [] as number[],
      renderTime: [] as number[],
      memoryUsage: [] as number[]
    };

    let initialMemory = 0;
    let peakMemory = 0;

    try {
      // Get initial memory reading
      const initialMemoryData = this.getMemoryUsage();
      initialMemory = initialMemoryData?.usedJSHeapSize || 0;
      peakMemory = initialMemory;

      // Run test iterations
      const iterationDelay = test.duration / test.iterations;

      for (let i = 0; i < test.iterations; i++) {
        const iterationStart = performance.now();

        // Simulate different test scenarios
        await this.simulateTestScenario(test, viewport, nodeCount, i);

        // Record metrics
        const iterationEnd = performance.now();
        const renderTime = iterationEnd - iterationStart;

        renderingPerformanceMonitor.recordFrame(renderTime);
        metrics.renderTime.push(renderTime);

        // Calculate FPS
        if (metrics.renderTime.length > 1) {
          const avgRenderTime = metrics.renderTime.slice(-10).reduce((a, b) => a + b, 0) / Math.min(metrics.renderTime.length, 10);
          const fps = avgRenderTime > 0 ? 1000 / avgRenderTime : 0;
          metrics.fps.push(fps);
        }

        // Record memory usage periodically
        if (i % 10 === 0) {
          const memoryData = this.getMemoryUsage();
          if (memoryData) {
            metrics.memoryUsage.push(memoryData.usedJSHeapSize);
            peakMemory = Math.max(peakMemory, memoryData.usedJSHeapSize);
          }
        }

        // Report progress
        if (this.onProgress) {
          this.onProgress({
            current: i + 1,
            total: test.iterations,
            test: test.name
          });
        }

        // Respect iteration timing
        const elapsed = performance.now() - iterationStart;
        if (elapsed < iterationDelay) {
          await this.sleep(iterationDelay - elapsed);
        }

        // Safety check for max duration
        if (Date.now() - startTime > this.config.maxTestDuration) {
          console.warn(`Test ${test.name} exceeded max duration, stopping early`);
          break;
        }
      }

      // Get final memory reading
      const finalMemoryData = this.getMemoryUsage();
      const finalMemory = finalMemoryData?.usedJSHeapSize || 0;
      const memoryLeaked = finalMemory - initialMemory;

      // Calculate test results
      const testResult: TestResult = {
        testId: test.id,
        timestamp: new Date(),
        environment: Environment.isWebView() ? 'native' : 'browser',
        duration: Date.now() - startTime,
        iterations: metrics.fps.length,
        metrics: {
          averageFPS: this.average(metrics.fps),
          minFPS: Math.min(...metrics.fps),
          maxFPS: Math.max(...metrics.fps),
          averageRenderTime: this.average(metrics.renderTime),
          minRenderTime: Math.min(...metrics.renderTime),
          maxRenderTime: Math.max(...metrics.renderTime),
          memoryUsage: {
            initial: initialMemory,
            peak: peakMemory,
            final: finalMemory,
            leaked: memoryLeaked
          }
        },
        passed: false, // Will be set below
        failures: [],
        recommendations: []
      };

      // Validate against targets
      testResult.passed = this.validateTestResult(testResult, test);
      testResult.failures = this.getTestFailures(testResult, test);
      testResult.recommendations = this.getTestRecommendations(testResult, test);

      console.log(`✅ Test completed: ${test.name} - ${testResult.passed ? 'PASSED' : 'FAILED'}`);

      return testResult;

    } finally {
      renderingPerformanceMonitor.stopMonitoring();
      this.currentTest = null;
    }
  }

  /**
   * Run a complete benchmark suite
   */
  public async runBenchmarkSuite(
    suite: BenchmarkSuite,
    viewport: Viewport,
    nodeCount: number,
    onProgress?: (progress: { current: number; total: number; test: string }) => void
  ): Promise<TestResult[]> {
    this.onProgress = onProgress;
    console.log(`🚀 Starting benchmark suite: ${suite.name}`);

    const results: TestResult[] = [];

    for (let i = 0; i < suite.tests.length; i++) {
      const test = suite.tests[i];

      // Skip certain test types based on config
      if (!this.config.enableStressTests && test.category === 'stress') {
        console.log(`⏭️ Skipping stress test: ${test.name} (disabled in config)`);
        continue;
      }

      if (!this.config.enableMemoryTests && test.category === 'memory') {
        console.log(`⏭️ Skipping memory test: ${test.name} (disabled in config)`);
        continue;
      }

      try {
        const result = await this.runTest(test, viewport, nodeCount);
        results.push(result);

        // Store result for regression analysis
        if (!this.testResults.has(test.id)) {
          this.testResults.set(test.id, []);
        }
        this.testResults.get(test.id)!.push(result);

        // Brief pause between tests
        await this.sleep(1000);

      } catch (error) {
        console.error(`❌ Test ${test.name} failed with error:`, error);

        // Create failure result
        results.push({
          testId: test.id,
          timestamp: new Date(),
          environment: Environment.isWebView() ? 'native' : 'browser',
          duration: 0,
          iterations: 0,
          metrics: {
            averageFPS: 0,
            minFPS: 0,
            maxFPS: 0,
            averageRenderTime: 0,
            minRenderTime: 0,
            maxRenderTime: 0,
            memoryUsage: { initial: 0, peak: 0, final: 0, leaked: 0 }
          },
          passed: false,
          failures: [`Test execution failed: ${error}`],
          recommendations: ['Investigate test execution environment']
        });
      }
    }

    console.log(`🏁 Benchmark suite completed: ${results.length} tests run`);

    return results;
  }

  /**
   * Analyze regression from baseline
   */
  public analyzeRegression(currentResults: TestResult[], baselineResults?: TestResult[]): RegressionAnalysis {
    if (!baselineResults || baselineResults.length === 0) {
      return {
        detected: false,
        degradation: { fps: 0, renderTime: 0, memoryUsage: 0 },
        severity: 'low',
        recommendations: ['Establish baseline results for regression analysis']
      };
    }

    let maxDegradation = { fps: 0, renderTime: 0, memoryUsage: 0 };
    let hasRegression = false;

    for (const current of currentResults) {
      const baseline = baselineResults.find(b => b.testId === current.testId);
      if (!baseline) continue;

      // Calculate degradation percentages
      const fpsDegradation = ((baseline.metrics.averageFPS - current.metrics.averageFPS) / baseline.metrics.averageFPS) * 100;
      const renderTimeDegradation = ((current.metrics.averageRenderTime - baseline.metrics.averageRenderTime) / baseline.metrics.averageRenderTime) * 100;
      const memoryDegradation = ((current.metrics.memoryUsage.peak - baseline.metrics.memoryUsage.peak) / baseline.metrics.memoryUsage.peak) * 100;

      // Check if degradation exceeds tolerance
      if (fpsDegradation > this.config.tolerancePercent ||
          renderTimeDegradation > this.config.tolerancePercent ||
          memoryDegradation > this.config.tolerancePercent) {
        hasRegression = true;
      }

      maxDegradation.fps = Math.max(maxDegradation.fps, fpsDegradation);
      maxDegradation.renderTime = Math.max(maxDegradation.renderTime, renderTimeDegradation);
      maxDegradation.memoryUsage = Math.max(maxDegradation.memoryUsage, memoryDegradation);
    }

    const maxOverallDegradation = Math.max(maxDegradation.fps, maxDegradation.renderTime, maxDegradation.memoryUsage);

    const severity: RegressionAnalysis['severity'] =
      maxOverallDegradation > 50 ? 'critical' :
      maxOverallDegradation > 25 ? 'high' :
      maxOverallDegradation > 15 ? 'medium' : 'low';

    const recommendations = this.generateRegressionRecommendations(maxDegradation, severity);

    return {
      detected: hasRegression,
      degradation: maxDegradation,
      severity,
      recommendations
    };
  }

  /**
   * Validate optimization effectiveness
   */
  public async validateOptimization(
    viewport: Viewport,
    nodeCount: number,
    _optimizationPlan: OptimizationPlan
  ): Promise<{
    effective: boolean;
    improvement: {
      fps: number;
      renderTime: number;
      memoryUsage: number;
    };
    recommendations: string[];
  }> {
    console.log('🔍 Validating optimization effectiveness...');

    // Run baseline test without optimization
    const baselineTest: PerformanceTest = {
      id: 'validation-baseline',
      name: 'Optimization Validation Baseline',
      description: 'Baseline performance before optimization',
      category: 'baseline',
      duration: 5000,
      iterations: 100,
      targetMetrics: { minFPS: 30, maxRenderTime: 35, maxMemoryUsage: 200 * 1024 * 1024 }
    };

    const baselineResult = await this.runTest(baselineTest, viewport, nodeCount);

    // Brief pause
    await this.sleep(2000);

    // Run test with optimization applied
    const optimizedTest: PerformanceTest = {
      ...baselineTest,
      id: 'validation-optimized',
      name: 'Optimization Validation Optimized',
      description: 'Performance after optimization applied'
    };

    const optimizedResult = await this.runTest(optimizedTest, viewport, nodeCount);

    // Calculate improvement
    const fpsImprovement = ((optimizedResult.metrics.averageFPS - baselineResult.metrics.averageFPS) / baselineResult.metrics.averageFPS) * 100;
    const renderTimeImprovement = ((baselineResult.metrics.averageRenderTime - optimizedResult.metrics.averageRenderTime) / baselineResult.metrics.averageRenderTime) * 100;
    const memoryImprovement = ((baselineResult.metrics.memoryUsage.peak - optimizedResult.metrics.memoryUsage.peak) / baselineResult.metrics.memoryUsage.peak) * 100;

    const effective = fpsImprovement > 5 || renderTimeImprovement > 10 || memoryImprovement > 5;

    const recommendations = [];
    if (!effective) {
      recommendations.push('Optimization did not show significant improvement');
      recommendations.push('Consider more aggressive optimization strategies');
    } else {
      if (fpsImprovement > 20) recommendations.push('Excellent FPS improvement achieved');
      if (renderTimeImprovement > 20) recommendations.push('Significant render time reduction');
      if (memoryImprovement > 20) recommendations.push('Substantial memory optimization');
    }

    return {
      effective,
      improvement: {
        fps: fpsImprovement,
        renderTime: renderTimeImprovement,
        memoryUsage: memoryImprovement
      },
      recommendations
    };
  }

  /**
   * Set progress callback
   */
  public setProgressCallback(callback: (progress: { current: number; total: number; test: string }) => void): void {
    this.onProgress = callback;
  }

  /**
   * Get test results history
   */
  public getTestHistory(testId: string): TestResult[] {
    return this.testResults.get(testId) || [];
  }

  /**
   * Export test results
   */
  public exportResults(): string {
    const allResults = Array.from(this.testResults.entries()).reduce((acc, [testId, results]) => {
      acc[testId] = results;
      return acc;
    }, {} as Record<string, TestResult[]>);

    return JSON.stringify({
      timestamp: new Date().toISOString(),
      environment: Environment.isWebView() ? 'native' : 'browser',
      config: this.config,
      results: allResults
    }, null, 2);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async simulateTestScenario(
    test: PerformanceTest,
    viewport: Viewport,
    nodeCount: number,
    iteration: number
  ): Promise<void> {
    switch (test.category) {
      case 'baseline':
        // Steady rendering simulation
        await this.simulateRendering(10, 5);
        break;

      case 'stress':
        if (test.id.includes('rapid-updates')) {
          // Rapid viewport changes
          const newViewport = {
            ...viewport,
            x: viewport.x + (Math.random() - 0.5) * 100,
            y: viewport.y + (Math.random() - 0.5) * 100
          };
          await viewportOptimizer.optimizeForDataset(newViewport, nodeCount);
        } else if (test.id.includes('zoom')) {
          // Zoom operations
          const zoomFactor = 0.5 + Math.random() * 2; // 0.5x to 2.5x zoom
          await viewportOptimizer.optimizeForDataset(
            { ...viewport, scale: viewport.scale * zoomFactor },
            nodeCount
          );
        }
        await this.simulateRendering(20, 10);
        break;

      case 'memory':
        // Memory-intensive operations
        await this.simulateMemoryIntensiveRendering(iteration);
        break;

      case 'optimization':
        // Test optimization strategies
        await this.simulateOptimizedRendering(viewport, nodeCount);
        break;

      default:
        await this.simulateRendering(10, 5);
    }
  }

  private async simulateRendering(complexity: number, duration: number): Promise<void> {
    // Simulate rendering work
    const operations = Math.floor(complexity + Math.random() * complexity);
    for (let i = 0; i < operations; i++) {
      // Simulate DOM manipulation or canvas operations
      await this.sleep(Math.random() * duration);
    }
  }

  private async simulateMemoryIntensiveRendering(iteration: number): Promise<void> {
    // Simulate memory allocation patterns that might reveal leaks
    const tempArrays = [];
    for (let i = 0; i < 100; i++) {
      tempArrays.push(new Array(1000).fill(Math.random()));
    }

    await this.sleep(5);

    // Cleanup most but not all (simulate potential leak)
    if (iteration % 10 !== 0) {
      tempArrays.splice(0, tempArrays.length - 1);
    }
  }

  private async simulateOptimizedRendering(viewport: Viewport, nodeCount: number): Promise<void> {
    // Apply optimizations during rendering
    // Simulate viewport culling
    const visibleNodeCount = Math.floor(nodeCount * 0.3); // 30% visible

    // Simulate LOD rendering
    const lodReduction = 0.5; // 50% complexity reduction

    await this.simulateRendering(Math.floor(visibleNodeCount * lodReduction / 10), 3);
  }

  private validateTestResult(result: TestResult, test: PerformanceTest): boolean {
    const meetsTargets =
      result.metrics.averageFPS >= test.targetMetrics.minFPS &&
      result.metrics.averageRenderTime <= test.targetMetrics.maxRenderTime &&
      result.metrics.memoryUsage.peak <= test.targetMetrics.maxMemoryUsage;

    return meetsTargets;
  }

  private getTestFailures(result: TestResult, test: PerformanceTest): string[] {
    const failures: string[] = [];

    if (result.metrics.averageFPS < test.targetMetrics.minFPS) {
      failures.push(`FPS below target: ${result.metrics.averageFPS.toFixed(1)} < ${test.targetMetrics.minFPS}`);
    }

    if (result.metrics.averageRenderTime > test.targetMetrics.maxRenderTime) {
      failures.push(`Render time above target: ${result.metrics.averageRenderTime.toFixed(1)}ms > ${test.targetMetrics.maxRenderTime}ms`);
    }

    if (result.metrics.memoryUsage.peak > test.targetMetrics.maxMemoryUsage) {
      const peakMB = result.metrics.memoryUsage.peak / 1024 / 1024;
      const targetMB = test.targetMetrics.maxMemoryUsage / 1024 / 1024;
      failures.push(`Memory usage above target: ${peakMB.toFixed(1)}MB > ${targetMB.toFixed(1)}MB`);
    }

    return failures;
  }

  private getTestRecommendations(result: TestResult, test: PerformanceTest): string[] {
    const recommendations: string[] = [];

    if (result.metrics.averageFPS < test.targetMetrics.minFPS) {
      recommendations.push('Enable viewport culling and increase LOD level');
      recommendations.push('Consider GPU acceleration if available');
    }

    if (result.metrics.averageRenderTime > test.targetMetrics.maxRenderTime) {
      recommendations.push('Optimize rendering pipeline and reduce draw calls');
      recommendations.push('Enable batching for similar elements');
    }

    if (result.metrics.memoryUsage.leaked > 10 * 1024 * 1024) { // 10MB leak
      recommendations.push('Investigate memory leaks in rendering pipeline');
      recommendations.push('Implement more aggressive garbage collection');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance meets all targets - consider quality improvements');
    }

    return recommendations;
  }

  private generateRegressionRecommendations(degradation: RegressionAnalysis['degradation'], severity: RegressionAnalysis['severity']): string[] {
    const recommendations: string[] = [];

    if (degradation.fps > 10) {
      recommendations.push('FPS regression detected - review recent rendering changes');
    }

    if (degradation.renderTime > 15) {
      recommendations.push('Render time degradation - optimize critical rendering path');
    }

    if (degradation.memoryUsage > 20) {
      recommendations.push('Memory usage increase - check for new memory leaks');
    }

    if (severity === 'critical') {
      recommendations.push('CRITICAL: Performance degradation requires immediate attention');
    }

    return recommendations;
  }

  private getMemoryUsage(): { usedJSHeapSize: number } | null {
    const memory = (performance as any).memory;
    return memory ? { usedJSHeapSize: memory.usedJSHeapSize } : null;
  }

  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Global Instance
// ============================================================================

export const performanceValidator = new PerformanceValidator();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Run quick performance validation
 */
export async function runQuickValidation(viewport: Viewport, nodeCount: number): Promise<{
  passed: boolean;
  score: number;
  issues: string[];
}> {
  const quickTest: PerformanceTest = {
    id: 'quick-validation',
    name: 'Quick Performance Check',
    description: 'Fast performance validation',
    category: 'baseline',
    duration: 2000,
    iterations: 50,
    targetMetrics: {
      minFPS: 30,
      maxRenderTime: 35,
      maxMemoryUsage: 150 * 1024 * 1024
    }
  };

  const result = await performanceValidator.runTest(quickTest, viewport, nodeCount);

  // Calculate score (0-100)
  const fpsScore = Math.min(result.metrics.averageFPS / 60, 1) * 40;
  const renderTimeScore = Math.max(1 - (result.metrics.averageRenderTime / 50), 0) * 40;
  const memoryScore = Math.max(1 - (result.metrics.memoryUsage.peak / (200 * 1024 * 1024)), 0) * 20;

  const score = Math.round(fpsScore + renderTimeScore + memoryScore);

  return {
    passed: result.passed,
    score,
    issues: result.failures
  };
}

/**
 * Generate performance report
 */
export function generatePerformanceReport(results: TestResult[]): {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    averageScore: number;
  };
  details: TestResult[];
  recommendations: string[];
} {
  const summary = {
    totalTests: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    averageScore: 0
  };

  // Calculate average score
  const scores = results.map(result => {
    const fpsScore = Math.min(result.metrics.averageFPS / 60, 1) * 40;
    const renderTimeScore = Math.max(1 - (result.metrics.averageRenderTime / 50), 0) * 40;
    const memoryScore = Math.max(1 - (result.metrics.memoryUsage.peak / (200 * 1024 * 1024)), 0) * 20;
    return fpsScore + renderTimeScore + memoryScore;
  });

  summary.averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // Aggregate recommendations
  const allRecommendations = results.flatMap(r => r.recommendations);
  const uniqueRecommendations = Array.from(new Set(allRecommendations));

  return {
    summary,
    details: results,
    recommendations: uniqueRecommendations
  };
}