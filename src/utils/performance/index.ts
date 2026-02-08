// Simplified performance monitoring exports for sql.js direct access
export {
  simplePerformanceValidator,
  runQuickValidation,
  calculatePerformanceScore,
  type SimplePerformanceTest,
  type SimpleTestResult,
  type QuickValidationResult
} from './performance-validation';

export {
  simplePerformanceBenchmarks,
  createSimpleBaseline,
  runQuickBenchmark,
  type SimpleBaselineMetrics,
  type SimplePerformanceBaseline,
  type SimpleRegressionReport,
  type SimplePerformanceComparison
} from './performance-benchmarks';

export {
  simplePerformanceMonitor,
  monitorSQLQuery,
  monitorD3Render,
  getPerformanceHealth,
  type SimplePerformanceAlert,
  type SimpleSessionMetrics,
  type SimplePerformanceConfig
} from './performance-monitor';

export {
  simpleRenderingMonitor,
  simpleMemoryTracker,
  startPerformanceMonitoring,
  stopPerformanceMonitoring,
  recordD3Render,
  getPerformanceStatus,
  type RenderingMetrics,
  type SimpleAlert
} from './rendering-performance';

// Legacy exports for backward compatibility (use simple versions instead)
import { simplePerformanceValidator } from './performance-validation';
import { simpleRenderingMonitor } from './rendering-performance';

export const performanceValidator = simplePerformanceValidator;
export const renderingPerformanceMonitor = simpleRenderingMonitor;

// Re-export memory management utilities if they exist
export { CleanupStack, createCleanupStack, useCleanupEffect, useWebSocketCleanup } from './memoryManagement';