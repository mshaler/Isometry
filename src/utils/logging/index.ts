// Export from logger (main implementation)
export {
  bridgeLogger as mainBridgeLogger,
  performanceLogger as mainPerformanceLogger
} from './logger';

// Export from dev-logger (dev implementation)
export {
  bridgeLogger as devBridgeLogger,
  performanceLogger as devPerformanceLogger,
  contextLogger,
  createLogger
} from './dev-logger';

// Export other modules
export * from './logging-strategy';
export * from './analytics';