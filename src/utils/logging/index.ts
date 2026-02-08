// Export from logger (main implementation)
export {
  bridgeLogger as mainBridgeLogger,
  performanceLogger as mainPerformanceLogger
} from './logger';

// Export from dev-logger (dev implementation)
export {
  bridgeLogger,
  performanceLogger,
  contextLogger,
  createLogger
} from './dev-logger';

// Export other modules
export * from './logging-strategy';
export * from './analytics';