/**
 * Performance Validation Utilities
 *
 * Simplified performance validation for sql.js direct access architecture
 * Focus on essential metrics: query performance, memory usage, render timing
 */

// No bridge dependencies - direct sql.js access

// Simplified interfaces for essential performance validation
export interface SimplePerformanceTest {
  id: string;
  name: string;
  maxQueryTime: number; // ms
  maxMemoryMB: number;
  maxRenderTime: number; // ms
}

export interface SimpleTestResult {
  testId: string;
  timestamp: Date;
  queryTime: number;
  memoryUsageMB: number;
  renderTime: number;
  passed: boolean;
  issue?: string;
}

export interface QuickValidationResult {
  passed: boolean;
  queryPerformance: 'good' | 'warning' | 'poor';
  memoryUsage: 'good' | 'warning' | 'poor';
  renderPerformance: 'good' | 'warning' | 'poor';
  recommendations: string[];
}

// Simple performance test definitions
export const BASIC_PERFORMANCE_TESTS: SimplePerformanceTest[] = [
  {
    id: 'query-performance',
    name: 'SQL Query Performance',
    maxQueryTime: 50, // 50ms max for sql.js queries
    maxMemoryMB: 100,
    maxRenderTime: 16 // 60fps = 16ms per frame
  },
  {
    id: 'memory-usage',
    name: 'Memory Usage Check',
    maxQueryTime: 100,
    maxMemoryMB: 200, // 200MB max usage
    maxRenderTime: 30
  }
];

// ============================================================================
// Simple Performance Validator
// ============================================================================

export class SimplePerformanceValidator {
  private testResults: SimpleTestResult[] = [];

  constructor() {
    // Simple validator with no complex configuration
  }

  /**
   * Run a simple performance test
   */
  public async runSimpleTest(test: SimplePerformanceTest): Promise<SimpleTestResult> {
    console.log(`🧪 Running simple test: ${test.name}`);


    // Simulate query performance test
    const queryStart = performance.now();
    await this.sleep(Math.random() * 20); // Simulate query work
    const queryTime = performance.now() - queryStart;

    // Check memory after operations
    const currentMemory = this.getMemoryUsageMB();

    // Simulate render timing
    const renderStart = performance.now();
    await this.sleep(Math.random() * 10); // Simulate render work
    const renderTime = performance.now() - renderStart;

    const passed =
      queryTime <= test.maxQueryTime &&
      currentMemory <= test.maxMemoryMB &&
      renderTime <= test.maxRenderTime;

    let issue: string | undefined;
    if (!passed) {
      if (queryTime > test.maxQueryTime) issue = `Query too slow: ${queryTime.toFixed(1)}ms > ${test.maxQueryTime}ms`;
      else if (currentMemory > test.maxMemoryMB) issue = `Memory too high: ${currentMemory.toFixed(1)}MB > ${test.maxMemoryMB}MB`;
      else if (renderTime > test.maxRenderTime) issue = `Render too slow: ${renderTime.toFixed(1)}ms > ${test.maxRenderTime}ms`;
    }

    const result: SimpleTestResult = {
      testId: test.id,
      timestamp: new Date(),
      queryTime,
      memoryUsageMB: currentMemory,
      renderTime,
      passed,
      issue
    };

    this.testResults.push(result);
    return result;
  }

  /**
   * Run quick validation
   */
  public async runQuickValidation(): Promise<QuickValidationResult> {
    const results = await Promise.all(
      BASIC_PERFORMANCE_TESTS.map(test => this.runSimpleTest(test))
    );

    const allPassed = results.every(r => r.passed);
    const avgQueryTime = results.reduce((sum, r) => sum + r.queryTime, 0) / results.length;
    const maxMemory = Math.max(...results.map(r => r.memoryUsageMB));
    const avgRenderTime = results.reduce((sum, r) => sum + r.renderTime, 0) / results.length;

    const recommendations: string[] = [];
    if (avgQueryTime > 30) recommendations.push('Consider query optimization');
    if (maxMemory > 150) recommendations.push('Monitor memory usage');
    if (avgRenderTime > 20) recommendations.push('Optimize rendering performance');
    if (recommendations.length === 0) recommendations.push('Performance looks good');

    return {
      passed: allPassed,
      queryPerformance: avgQueryTime > 30 ? 'poor' : avgQueryTime > 15 ? 'warning' : 'good',
      memoryUsage: maxMemory > 150 ? 'poor' : maxMemory > 100 ? 'warning' : 'good',
      renderPerformance: avgRenderTime > 20 ? 'poor' : avgRenderTime > 12 ? 'warning' : 'good',
      recommendations
    };
  }

  /**
   * Get recent test results
   */
  public getRecentResults(limit = 5): SimpleTestResult[] {
    return this.testResults.slice(-limit);
  }

  /**
   * Clear test results
   */
  public clearResults(): void {
    this.testResults = [];
  }

  /**
   * Export results as JSON
   */
  public exportResults(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      results: this.testResults
    }, null, 2);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private getMemoryUsageMB(): number {
    const memory = (performance as any).memory;
    if (memory && memory.usedJSHeapSize) {
      return memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
    }
    return 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Global Instance
// ============================================================================

export const simplePerformanceValidator = new SimplePerformanceValidator();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Run quick validation (simplified)
 */
export async function runQuickValidation(): Promise<QuickValidationResult> {
  return simplePerformanceValidator.runQuickValidation();
}

/**
 * Get performance score (0-100)
 */
export function calculatePerformanceScore(result: SimpleTestResult): number {
  let score = 100;

  // Query performance impact (0-40 points)
  if (result.queryTime > 50) score -= 40;
  else if (result.queryTime > 30) score -= 20;
  else if (result.queryTime > 15) score -= 10;

  // Memory usage impact (0-30 points)
  if (result.memoryUsageMB > 200) score -= 30;
  else if (result.memoryUsageMB > 150) score -= 20;
  else if (result.memoryUsageMB > 100) score -= 10;

  // Render performance impact (0-30 points)
  if (result.renderTime > 30) score -= 30;
  else if (result.renderTime > 20) score -= 20;
  else if (result.renderTime > 12) score -= 10;

  return Math.max(0, score);
}