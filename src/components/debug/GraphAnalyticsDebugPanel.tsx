/**
 * Graph Analytics Debug Panel - Re-export from modular implementation
 *
 * This file now delegates to the modular GraphAnalyticsDebugPanel implementation
 * in the GraphAnalytics/ directory for better maintainability.
 */

// Re-export everything from the modular implementation
export * from './GraphAnalytics';
export { GraphAnalyticsDebugPanel as default } from './GraphAnalytics';