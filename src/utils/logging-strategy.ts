/**
 * Production Logging Strategy & Performance Optimization
 *
 * Provides centralized logging configuration optimized for production performance
 * and development debugging. Replaces scattered console statements with structured,
 * categorized logging that can be filtered and configured by environment.
 */

import { logger, LogLevel } from './logger';

// Environment-specific logging configurations
export const LOGGING_CONFIGS = {
  production: {
    level: LogLevel.WARN,
    enableConsole: false,
    enablePersistence: true,
    maxEntries: 500,
    categories: ['error-reporting', 'performance', 'security']
  },

  development: {
    level: LogLevel.DEBUG,
    enableConsole: true,
    enablePersistence: true,
    maxEntries: 2000,
    categories: [] // All categories enabled
  },

  test: {
    level: LogLevel.ERROR,
    enableConsole: false,
    enablePersistence: false,
    maxEntries: 100,
    categories: ['error-reporting']
  }
} as const;

// Performance-optimized logging categories
export const LOG_CATEGORIES = {
  // Critical infrastructure (always logged in production)
  BRIDGE: 'bridge',
  DATABASE: 'database',
  SECURITY: 'security',
  ERROR_REPORTING: 'error-reporting',

  // Performance monitoring (configurable by environment)
  PERFORMANCE: 'performance',
  ANALYTICS: 'analytics',

  // Development/debugging (disabled in production)
  UI: 'ui',
  STORAGE: 'storage',
  CONFIGURATION: 'configuration',
  SYNC: 'sync'
} as const;

/**
 * Initialize logging configuration based on environment
 */
export function initializeLogging(): void {
  const env = process.env.NODE_ENV || 'development';
  const config = LOGGING_CONFIGS[env as keyof typeof LOGGING_CONFIGS] || LOGGING_CONFIGS.development;

  logger.setLevel(config.level);
  logger.enableConsole(config.enableConsole);
  logger.setCategories(config.categories);
}

/**
 * Performance-optimized loggers for each category
 * Pre-configured for production use
 */
export const loggers = {
  // High-priority infrastructure logging
  bridge: {
    error: (msg: string, context?: Record<string, unknown>, error?: Error) =>
      logger.error(LOG_CATEGORIES.BRIDGE, msg, context, error),
    warn: (msg: string, context?: Record<string, unknown>) =>
      logger.warn(LOG_CATEGORIES.BRIDGE, msg, context),
    info: (msg: string, context?: Record<string, unknown>) =>
      logger.info(LOG_CATEGORIES.BRIDGE, msg, context),
    debug: (msg: string, context?: Record<string, unknown>) =>
      logger.debug(LOG_CATEGORIES.BRIDGE, msg, context)
  },

  database: {
    error: (msg: string, context?: Record<string, unknown>, error?: Error) =>
      logger.error(LOG_CATEGORIES.DATABASE, msg, context, error),
    warn: (msg: string, context?: Record<string, unknown>) =>
      logger.warn(LOG_CATEGORIES.DATABASE, msg, context),
    info: (msg: string, context?: Record<string, unknown>) =>
      logger.info(LOG_CATEGORIES.DATABASE, msg, context),
    debug: (msg: string, context?: Record<string, unknown>) =>
      logger.debug(LOG_CATEGORIES.DATABASE, msg, context)
  },

  security: {
    error: (msg: string, context?: Record<string, unknown>, error?: Error) =>
      logger.error(LOG_CATEGORIES.SECURITY, msg, context, error),
    warn: (msg: string, context?: Record<string, unknown>) =>
      logger.warn(LOG_CATEGORIES.SECURITY, msg, context),
    info: (msg: string, context?: Record<string, unknown>) =>
      logger.info(LOG_CATEGORIES.SECURITY, msg, context),
    debug: (msg: string, context?: Record<string, unknown>) =>
      logger.debug(LOG_CATEGORIES.SECURITY, msg, context)
  },

  // Performance monitoring (optimized for metrics)
  performance: {
    error: (msg: string, context?: Record<string, unknown>, error?: Error) =>
      logger.error(LOG_CATEGORIES.PERFORMANCE, msg, context, error),
    warn: (msg: string, context?: Record<string, unknown>) =>
      logger.warn(LOG_CATEGORIES.PERFORMANCE, msg, context),
    info: (msg: string, context?: Record<string, unknown>) =>
      logger.info(LOG_CATEGORIES.PERFORMANCE, msg, context),
    debug: (msg: string, context?: Record<string, unknown>) =>
      logger.debug(LOG_CATEGORIES.PERFORMANCE, msg, context)
  },

  // Low-priority development logging
  ui: {
    error: (msg: string, context?: Record<string, unknown>, error?: Error) =>
      logger.error(LOG_CATEGORIES.UI, msg, context, error),
    warn: (msg: string, context?: Record<string, unknown>) =>
      logger.warn(LOG_CATEGORIES.UI, msg, context),
    info: (msg: string, context?: Record<string, unknown>) =>
      logger.info(LOG_CATEGORIES.UI, msg, context),
    debug: (msg: string, context?: Record<string, unknown>) =>
      logger.debug(LOG_CATEGORIES.UI, msg, context)
  }
};

/**
 * Console statement replacement helpers
 */
export const consoleReplacements = {
  /**
   * Replace console.log with appropriate logger based on context
   */
  log: (category: string, message: string, context?: Record<string, unknown>) => {
    logger.info(category, message, context);
  },

  /**
   * Replace console.warn with structured warning
   */
  warn: (category: string, message: string, context?: Record<string, unknown>, error?: Error) => {
    logger.warn(category, message, context, error);
  },

  /**
   * Replace console.error with structured error logging
   */
  error: (category: string, message: string, context?: Record<string, unknown>, error?: Error) => {
    logger.error(category, message, context, error);
  },

  /**
   * Replace console.debug with structured debug logging
   */
  debug: (category: string, message: string, context?: Record<string, unknown>) => {
    logger.debug(category, message, context);
  }
};

/**
 * Performance impact tracking for logging operations
 */
export class LoggingPerformanceMonitor {
  private metrics = {
    totalLogs: 0,
    logsByLevel: new Map<LogLevel, number>(),
    averageLatency: 0,
    peakLatency: 0
  };

  trackLogOperation<T>(operation: () => T): T {
    const startTime = performance.now();
    this.metrics.totalLogs++;

    try {
      return operation();
    } finally {
      const duration = performance.now() - startTime;
      this.updateLatencyMetrics(duration);
    }
  }

  private updateLatencyMetrics(duration: number): void {
    this.metrics.peakLatency = Math.max(this.metrics.peakLatency, duration);

    // Simple rolling average
    const weight = 0.1;
    this.metrics.averageLatency = (this.metrics.averageLatency * (1 - weight)) + (duration * weight);
  }

  getMetrics() {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics.totalLogs = 0;
    this.metrics.logsByLevel.clear();
    this.metrics.averageLatency = 0;
    this.metrics.peakLatency = 0;
  }
}

// Global logging performance monitor
export const loggingPerformanceMonitor = new LoggingPerformanceMonitor();

// Initialize logging on import
initializeLogging();