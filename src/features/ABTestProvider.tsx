/**
 * A/B Testing System
 *
 * Main entry point for A/B testing functionality
 */

// Re-export types
export type {
  ABTest,
  ABTestConfiguration,
  ABTestVariant,
  UserAssignment,
  UserCriteria,
  ConversionEvent,
  TestMetrics,
  MetricValue,
  ExperimentAnalysis,
  ABTestContextValue,
  ExperimentStatus,
  AnalysisStatus,
  CriteriaType,
  ComparisonOperator,
  RiskLevel
} from './abtest/types';

// Re-export context
export { ABTestContext } from './abtest/context';

// Re-export provider
export { ABTestProvider } from './abtest/ABTestProvider';

// Re-export hooks
export {
  useABTest,
  useABTestVariant,
  useIsInABTest,
  useABTestConversion,
  useABTestManagement,
  useABTestAnalytics,
  // Aliases for backward compatibility
  useABTests,
  useExperimentVariant
} from './abtest/hooks';