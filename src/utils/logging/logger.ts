/**
 * Structured Logging System
 * Replaces console.log/warn/error with production-ready logging
 * Features: log levels, environment detection, structured output
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enablePersistence: boolean;
  maxEntries: number;
  categories: string[];
}

class Logger {
  private config: LoggerConfig;
  private entries: LogEntry[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: this.getDefaultLevel(),
      enableConsole: true,
      enablePersistence: false,
      maxEntries: 1000,
      categories: [],
      ...config
    };
  }

  private getDefaultLevel(): LogLevel {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      return LogLevel.WARN;
    }
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return LogLevel.ERROR;
    }
    return LogLevel.DEBUG;
  }

  private shouldLog(level: LogLevel, category: string): boolean {
    if (level > this.config.level) return false;
    if (this.config.categories.length > 0 && !this.config.categories.includes(category)) {
      return false;
    }
    return true;
  }

  private createEntry(
    level: LogLevel,
    category: string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context,
      error
    };
  }

  private logEntry(entry: LogEntry): void {
    // Store in memory
    if (this.config.enablePersistence) {
      this.entries.unshift(entry);
      if (this.entries.length > this.config.maxEntries) {
        this.entries = this.entries.slice(0, this.config.maxEntries);
      }
    }

    // Output to console if enabled
    if (this.config.enableConsole) {
      const prefix = `[${entry.category}]`;
      const message = entry.context
        ? `${entry.message} ${JSON.stringify(entry.context)}`
        : entry.message;

      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(prefix, message, entry.error);
          break;
        case LogLevel.WARN:
          console.warn(prefix, message);
          break;
        case LogLevel.INFO:
          console.warn(prefix, message);
          break;
        case LogLevel.DEBUG:
        case LogLevel.TRACE:
          console.warn(prefix, message);
          break;
      }
    }
  }

  // Public API
  error(category: string, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(LogLevel.ERROR, category)) return;
    this.logEntry(this.createEntry(LogLevel.ERROR, category, message, context, error));
  }

  warn(category: string, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.WARN, category)) return;
    this.logEntry(this.createEntry(LogLevel.WARN, category, message, context));
  }

  info(category: string, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.INFO, category)) return;
    this.logEntry(this.createEntry(LogLevel.INFO, category, message, context));
  }

  debug(category: string, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.DEBUG, category)) return;
    this.logEntry(this.createEntry(LogLevel.DEBUG, category, message, context));
  }

  trace(category: string, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.TRACE, category)) return;
    this.logEntry(this.createEntry(LogLevel.TRACE, category, message, context));
  }

  // Configuration
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  setCategories(categories: string[]): void {
    this.config.categories = categories;
  }

  enableConsole(enabled: boolean): void {
    this.config.enableConsole = enabled;
  }

  // Utility methods
  getEntries(count?: number): LogEntry[] {
    return count ? this.entries.slice(0, count) : [...this.entries];
  }

  clearEntries(): void {
    this.entries = [];
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Create default logger instance
export const logger = new Logger();

// Convenience functions for common categories
export const dbLogger = {
  error: (msg: string, ctx?: Record<string, unknown>, err?: Error) => logger.error('database', msg, ctx, err),
  warn: (msg: string, ctx?: Record<string, unknown>) => logger.warn('database', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => logger.info('database', msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => logger.debug('database', msg, ctx)
};

export const bridgeLogger = {
  error: (msg: string, ctx?: Record<string, unknown>, err?: Error) => logger.error('bridge', msg, ctx, err),
  warn: (msg: string, ctx?: Record<string, unknown>) => logger.warn('bridge', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => logger.info('bridge', msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => logger.debug('bridge', msg, ctx)
};

export const performanceLogger = {
  error: (msg: string, ctx?: Record<string, unknown>, err?: Error) => logger.error('performance', msg, ctx, err),
  warn: (msg: string, ctx?: Record<string, unknown>) => logger.warn('performance', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => logger.info('performance', msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => logger.debug('performance', msg, ctx)
};

export const uiLogger = {
  error: (msg: string, ctx?: Record<string, unknown>, err?: Error) => logger.error('ui', msg, ctx, err),
  warn: (msg: string, ctx?: Record<string, unknown>) => logger.warn('ui', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => logger.info('ui', msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => logger.debug('ui', msg, ctx)
};

// Re-export devLogger from dev-logger for backwards compatibility
export { devLogger } from './dev-logger';