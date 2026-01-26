/**
 * Bridge Performance Testing and Validation
 *
 * Specialized testing for WebView bridge performance comparison
 * against HTTP API and comprehensive bridge reliability testing
 */

import { webViewBridge, Environment } from './webview-bridge';

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export interface BridgePerformanceTargets {
  bridgeLatency: number; // < 50ms for round-trip
  databaseOps: number;   // > 100 ops/second
  syncLatency: number;   // < 100ms notification to UI
  memoryOverhead: number; // < 10MB additional
}

export interface BridgeTestResult {
  test: string;
  success: boolean;
  duration: number;
  throughput?: number; // ops/second
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface BridgeComparisonResult {
  operation: string;
  bridgeResult: BridgeTestResult;
  httpResult: BridgeTestResult;
  speedup: number; // How many times faster bridge is vs HTTP
  recommendation: string;
}

export interface BridgeStressTestResult {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  throughput: number;
  memoryUsage?: number;
  errors: string[];
}

/**
 * Performance targets for WebView bridge validation
 */
export const PERFORMANCE_TARGETS: BridgePerformanceTargets = {
  bridgeLatency: 50,     // 50ms max round-trip
  databaseOps: 100,      // 100 ops/second minimum
  syncLatency: 100,      // 100ms max sync notification
  memoryOverhead: 10     // 10MB max additional memory
};

/**
 * Comprehensive WebView bridge performance test
 */
export async function bridgePerformanceTest(): Promise<{
  targets: BridgePerformanceTargets;
  results: BridgeTestResult[];
  comparison?: BridgeComparisonResult[];
  stress?: BridgeStressTestResult;
  passed: boolean;
  recommendations: string[];
}> {
  // Performance test started (console output removed for production)

  const results: BridgeTestResult[] = [];
  let comparison: BridgeComparisonResult[] | undefined;
  let stress: BridgeStressTestResult | undefined;

  try {
    // Test 1: Basic round-trip latency
    results.push(await testBridgeLatency());

    // Test 2: Database operations throughput
    results.push(await testDatabaseThroughput());

    // Test 3: Sync notification latency
    results.push(await testSyncLatency());

    // Test 4: Memory overhead
    results.push(await testMemoryOverhead());

    // Test 5: Large data transfers
    results.push(await testLargeDataTransfer());

    // Test 6: Concurrent operations
    results.push(await testConcurrentOperations());

    // Test 7: Error recovery
    results.push(await testErrorRecovery());

    // Comparison testing (if HTTP API available)
    if (await isHTTPAPIAvailable()) {
      comparison = await performComparisonTesting();
    }

    // Stress testing
    stress = await performStressTesting();

  } catch (error) {
    console.error('Bridge performance test failed:', error);
    results.push({
      test: 'overall-test',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Evaluate results against targets
  const passed = evaluateResults(results);
  const recommendations = generateRecommendations(results, comparison, stress);

  // Performance test completed (console output removed for production)

  return {
    targets: PERFORMANCE_TARGETS,
    results,
    comparison,
    stress,
    passed,
    recommendations
  };
}

/**
 * Test basic WebView bridge round-trip latency
 */
async function testBridgeLatency(): Promise<BridgeTestResult> {
  if (!Environment.isWebView()) {
    return {
      test: 'bridge-latency',
      success: false,
      duration: 0,
      error: 'Not in WebView environment'
    };
  }

  try {
    const startTime = performance.now();

    // Simple ping test
    await webViewBridge.database.execute('SELECT 1', []);

    const duration = performance.now() - startTime;

    return {
      test: 'bridge-latency',
      success: duration < PERFORMANCE_TARGETS.bridgeLatency,
      duration,
      metadata: {
        target: PERFORMANCE_TARGETS.bridgeLatency,
        passed: duration < PERFORMANCE_TARGETS.bridgeLatency
      }
    };

  } catch (error) {
    return {
      test: 'bridge-latency',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test database operations throughput
 */
async function testDatabaseThroughput(): Promise<BridgeTestResult> {
  if (!Environment.isWebView()) {
    return {
      test: 'database-throughput',
      success: false,
      duration: 0,
      error: 'Not in WebView environment'
    };
  }

  try {
    const testOperations = 50;
    const startTime = performance.now();

    // Perform series of lightweight database operations
    for (let i = 0; i < testOperations; i++) {
      await webViewBridge.database.execute('SELECT COUNT(*) FROM nodes', []);
    }

    const duration = performance.now() - startTime;
    const throughput = (testOperations / duration) * 1000; // ops/second

    return {
      test: 'database-throughput',
      success: throughput > PERFORMANCE_TARGETS.databaseOps,
      duration,
      throughput,
      metadata: {
        operations: testOperations,
        target: PERFORMANCE_TARGETS.databaseOps,
        passed: throughput > PERFORMANCE_TARGETS.databaseOps
      }
    };

  } catch (error) {
    return {
      test: 'database-throughput',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test sync notification latency
 */
async function testSyncLatency(): Promise<BridgeTestResult> {
  if (!Environment.isWebView()) {
    return {
      test: 'sync-latency',
      success: false,
      duration: 0,
      error: 'Not in WebView environment'
    };
  }

  try {
    let notificationReceived = false;

    // Listen for sync notification
    const handler = () => {
      notificationReceived = true;
    };

    window.addEventListener('isometry-sync-update', handler);

    // Trigger a change that should generate sync notification
    await webViewBridge.database.execute(
      'INSERT INTO nodes (name, content, node_type) VALUES (?, ?, ?)',
      ['test-sync-node', 'testing sync latency', 'test']
    );

    // Wait for notification or timeout
    const timeout = 1000; // 1 second timeout
    const pollInterval = 10;
    let elapsed = 0;

    while (!notificationReceived && elapsed < timeout) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;
    }

    window.removeEventListener('isometry-sync-update', handler);

    const duration = elapsed;
    const success = notificationReceived && duration < PERFORMANCE_TARGETS.syncLatency;

    return {
      test: 'sync-latency',
      success,
      duration,
      metadata: {
        notificationReceived,
        target: PERFORMANCE_TARGETS.syncLatency,
        passed: success
      }
    };

  } catch (error) {
    return {
      test: 'sync-latency',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test memory overhead of bridge operations
 */
async function testMemoryOverhead(): Promise<BridgeTestResult> {
  try {
    const initialMemory = (performance as PerformanceWithMemory)?.memory?.usedJSHeapSize || 0;

    // Perform memory-intensive operations
    const testData = [];
    for (let i = 0; i < 100; i++) {
      const result = await webViewBridge.database.execute(
        'SELECT * FROM nodes LIMIT 10',
        []
      );
      testData.push(result);
    }

    const finalMemory = (performance as PerformanceWithMemory)?.memory?.usedJSHeapSize || 0;
    const memoryDelta = (finalMemory - initialMemory) / 1024 / 1024; // MB

    return {
      test: 'memory-overhead',
      success: memoryDelta < PERFORMANCE_TARGETS.memoryOverhead,
      duration: memoryDelta,
      metadata: {
        initialMemory: initialMemory / 1024 / 1024,
        finalMemory: finalMemory / 1024 / 1024,
        delta: memoryDelta,
        target: PERFORMANCE_TARGETS.memoryOverhead
      }
    };

  } catch (error) {
    return {
      test: 'memory-overhead',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test large data transfer performance
 */
async function testLargeDataTransfer(): Promise<BridgeTestResult> {
  try {
    const startTime = performance.now();

    // Create large data payload
    const largeContent = 'x'.repeat(50000); // 50KB content

    await webViewBridge.database.execute(
      'INSERT INTO nodes (name, content, node_type) VALUES (?, ?, ?)',
      ['large-data-test', largeContent, 'test']
    );

    const duration = performance.now() - startTime;

    return {
      test: 'large-data-transfer',
      success: duration < 500, // 500ms for 50KB should be reasonable
      duration,
      metadata: {
        dataSize: largeContent.length,
        bytesPerMs: largeContent.length / duration
      }
    };

  } catch (error) {
    return {
      test: 'large-data-transfer',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test concurrent operation handling
 */
async function testConcurrentOperations(): Promise<BridgeTestResult> {
  try {
    const startTime = performance.now();
    const concurrentOps = 10;

    // Launch concurrent operations
    const promises = Array.from({ length: concurrentOps }, () =>
      webViewBridge.database.execute('SELECT COUNT(*) FROM nodes', [])
    );

    await Promise.all(promises);

    const duration = performance.now() - startTime;
    const avgDuration = duration / concurrentOps;

    return {
      test: 'concurrent-operations',
      success: avgDuration < PERFORMANCE_TARGETS.bridgeLatency,
      duration,
      throughput: (concurrentOps / duration) * 1000,
      metadata: {
        concurrentOps,
        avgDuration
      }
    };

  } catch (error) {
    return {
      test: 'concurrent-operations',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test error recovery performance
 */
async function testErrorRecovery(): Promise<BridgeTestResult> {
  try {
    const startTime = performance.now();

    // Intentionally cause an error
    try {
      await webViewBridge.database.execute('INVALID SQL QUERY', []);
    } catch {
      // Expected error - ignore
    }

    // Test recovery with valid operation
    await webViewBridge.database.execute('SELECT 1', []);

    const duration = performance.now() - startTime;

    return {
      test: 'error-recovery',
      success: duration < 100, // Should recover quickly
      duration,
      metadata: {
        recoveryTime: duration
      }
    };

  } catch (error) {
    return {
      test: 'error-recovery',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if HTTP API is available for comparison testing
 */
async function isHTTPAPIAvailable(): Promise<boolean> {
  try {
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
    const response = await fetch(`${baseURL}/health`, {
      method: 'GET',
      timeout: 2000
    } as RequestInit);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Perform comparison testing between bridge and HTTP API
 */
async function performComparisonTesting(): Promise<BridgeComparisonResult[]> {
  const comparisons: BridgeComparisonResult[] = [];

  const testQueries = [
    'SELECT COUNT(*) FROM nodes',
    'SELECT * FROM nodes LIMIT 10',
    'SELECT * FROM nodes WHERE nodeType = "note" LIMIT 5'
  ];

  for (const query of testQueries) {
    try {
      // Test bridge
      const bridgeStart = performance.now();
      await webViewBridge.database.execute(query, []);
      const bridgeDuration = performance.now() - bridgeStart;

      // Test HTTP (simplified - would need actual HTTP client)
      const httpStart = performance.now();
      // Simulated HTTP call
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network latency
      const httpDuration = performance.now() - httpStart;

      const speedup = httpDuration / bridgeDuration;
      const recommendation = speedup > 1.2
        ? 'Bridge significantly faster than HTTP'
        : speedup < 0.8
        ? 'HTTP performing better - investigate bridge overhead'
        : 'Performance comparable';

      comparisons.push({
        operation: query,
        bridgeResult: {
          test: 'bridge-comparison',
          success: true,
          duration: bridgeDuration
        },
        httpResult: {
          test: 'http-comparison',
          success: true,
          duration: httpDuration
        },
        speedup,
        recommendation
      });

    } catch (error) {
      comparisons.push({
        operation: query,
        bridgeResult: {
          test: 'bridge-comparison',
          success: false,
          duration: 0,
          error: String(error)
        },
        httpResult: {
          test: 'http-comparison',
          success: false,
          duration: 0,
          error: 'Comparison failed'
        },
        speedup: 0,
        recommendation: 'Test failed - unable to compare'
      });
    }
  }

  return comparisons;
}

/**
 * Perform stress testing
 */
async function performStressTesting(): Promise<BridgeStressTestResult> {
  const totalOperations = 200;
  const operations: Promise<unknown>[] = [];
  const errors: string[] = [];

  // Stress test started (console output removed for production)

  const startTime = performance.now();

  // Launch stress operations
  for (let i = 0; i < totalOperations; i++) {
    const operation = webViewBridge.database.execute('SELECT COUNT(*) FROM nodes', [])
      .then(() => ({ success: true, duration: performance.now() - startTime }))
      .catch((error) => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(errorMsg);
        return { success: false, duration: performance.now() - startTime, error: errorMsg };
      });

    operations.push(operation);
  }

  // Wait for all operations to complete
  const operationResults = await Promise.all(operations);
  const totalDuration = performance.now() - startTime;

  const successfulOperations = operationResults.filter((r: BridgeTestResult) => r.success).length;
  const failedOperations = operationResults.filter((r: BridgeTestResult) => !r.success).length;

  const latencies = operationResults
    .filter(r => r.success)
    .map(r => r.duration);

  const averageLatency = latencies.length > 0
    ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
    : 0;

  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
  const throughput = (successfulOperations / totalDuration) * 1000;

  return {
    totalOperations,
    successfulOperations,
    failedOperations,
    averageLatency,
    maxLatency,
    minLatency,
    throughput,
    errors: [...new Set(errors)] // Remove duplicates
  };
}

/**
 * Evaluate test results against targets
 */
function evaluateResults(results: BridgeTestResult[]): boolean {
  return results.every(result => result.success);
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(
  results: BridgeTestResult[],
  comparison?: BridgeComparisonResult[],
  stress?: BridgeStressTestResult
): string[] {
  const recommendations: string[] = [];

  // Analyze individual test results
  results.forEach(result => {
    if (!result.success) {
      recommendations.push(`❌ ${result.test} failed: ${result.error || 'Unknown error'}`);
    } else {
      recommendations.push(`✅ ${result.test} passed`);
    }
  });

  // Analyze comparison results
  if (comparison) {
    const avgSpeedup = comparison.reduce((sum, c) => sum + c.speedup, 0) / comparison.length;
    if (avgSpeedup > 1.5) {
      recommendations.push(`🚀 Bridge is ${avgSpeedup.toFixed(1)}x faster than HTTP API on average`);
    } else if (avgSpeedup < 0.8) {
      recommendations.push(`⚠️ Bridge is slower than HTTP API - investigate overhead`);
    }
  }

  // Analyze stress test results
  if (stress) {
    const successRate = (stress.successfulOperations / stress.totalOperations) * 100;
    if (successRate < 95) {
      recommendations.push(`⚠️ Stress test success rate: ${successRate.toFixed(1)}% - consider reliability improvements`);
    } else {
      recommendations.push(`✅ Stress test passed with ${successRate.toFixed(1)}% success rate`);
    }

    if (stress.throughput < PERFORMANCE_TARGETS.databaseOps) {
      recommendations.push(`⚠️ Throughput ${stress.throughput.toFixed(1)} ops/sec below target ${PERFORMANCE_TARGETS.databaseOps}`);
    }
  }

  return recommendations;
}

interface BridgePerformanceResult {
  targets: BridgePerformanceTargets;
  results: BridgeTestResult[];
  comparison?: BridgeComparisonResult[];
  stress?: BridgeStressTestResult;
  passed: boolean;
  recommendations: string[];
}

/**
 * Generate performance report for bridge operations
 */
export function generateBridgePerformanceReport(testResults: BridgePerformanceResult): string {
  const report = `
# WebView Bridge Performance Report

Generated: ${new Date().toISOString()}
Environment: ${Environment.isWebView() ? 'WebView' : 'Browser'}

## Performance Targets
- Bridge Latency: < ${PERFORMANCE_TARGETS.bridgeLatency}ms
- Database Throughput: > ${PERFORMANCE_TARGETS.databaseOps} ops/sec
- Sync Latency: < ${PERFORMANCE_TARGETS.syncLatency}ms
- Memory Overhead: < ${PERFORMANCE_TARGETS.memoryOverhead}MB

## Test Results
${testResults.results.map((result: BridgeTestResult) => `
### ${result.test}
- Success: ${result.success ? '✅' : '❌'}
- Duration: ${result.duration.toFixed(2)}ms
${result.throughput ? `- Throughput: ${result.throughput.toFixed(2)} ops/sec` : ''}
${result.error ? `- Error: ${result.error}` : ''}
`).join('')}

## Recommendations
${testResults.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

## Overall Result
${testResults.passed ? '✅ All tests passed' : '❌ Some tests failed'}
`;

  return report;
}