/**
 * Development Logger - Simple console logging for development
 * Provides structured logging with levels and context
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  component?: string;
  module?: string;
  action?: string;
  [key: string]: unknown;
}

export interface DevLogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  setLevel(level: LogLevel): void;
  enabled: boolean;

  // Extended methods for D3 components
  data(message: string, context?: LogContext): void;
  metrics(message: string, context?: LogContext): void;
  setup(message: string, context?: LogContext): void;
  state(message: string, context?: LogContext): void;
  render(message: string, context?: LogContext): void;
  inspect(message: string, context?: LogContext): void;
}

class SimpleDevLogger implements DevLogger {
  private level: LogLevel = 'info';
  public enabled = process.env.NODE_ENV === 'development';

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, context?: LogContext): void {
    if (this.enabled && this.shouldLog('debug')) {
      // eslint-disable-next-line no-restricted-syntax
      console.debug(`🔍 ${message}`, context || '');
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.enabled && this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(`ℹ️ ${message}`, context || '');
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.enabled && this.shouldLog('warn')) {
      console.warn(`⚠️ ${message}`, context || '');
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.enabled && this.shouldLog('error')) {
      console.error(`❌ ${message}`, context || '');
    }
  }

  // Extended methods for D3 components (using debug level)
  data(message: string, context?: LogContext): void {
    if (this.enabled && this.shouldLog('debug')) {
      // eslint-disable-next-line no-restricted-syntax
      console.debug(`📊 DATA: ${message}`, context || '');
    }
  }

  metrics(message: string, context?: LogContext): void {
    if (this.enabled && this.shouldLog('debug')) {
      // eslint-disable-next-line no-restricted-syntax
      console.debug(`📈 METRICS: ${message}`, context || '');
    }
  }

  setup(message: string, context?: LogContext): void {
    if (this.enabled && this.shouldLog('debug')) {
      // eslint-disable-next-line no-restricted-syntax
      console.debug(`🔧 SETUP: ${message}`, context || '');
    }
  }

  state(message: string, context?: LogContext): void {
    if (this.enabled && this.shouldLog('debug')) {
      // eslint-disable-next-line no-restricted-syntax
      console.debug(`🔄 STATE: ${message}`, context || '');
    }
  }

  render(message: string, context?: LogContext): void {
    if (this.enabled && this.shouldLog('debug')) {
      // eslint-disable-next-line no-restricted-syntax
      console.debug(`🎨 RENDER: ${message}`, context || '');
    }
  }

  inspect(message: string, context?: LogContext): void {
    if (this.enabled && this.shouldLog('debug')) {
      // eslint-disable-next-line no-restricted-syntax
      console.debug(`🔍 INSPECT: ${message}`, context || '');
    }
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return levels[messageLevel] >= levels[this.level];
  }
}

// Main logger instance
export const devLogger = new SimpleDevLogger();

// Specialized logger instances for different contexts
export const contextLogger = new SimpleDevLogger();
export const bridgeLogger = new SimpleDevLogger();
export const performanceLogger = new SimpleDevLogger();
export const superGridLogger = new SimpleDevLogger();

// Factory function to create loggers with specific contexts
export const createLogger = (_context: string): DevLogger => {
  const logger = new SimpleDevLogger();
  // Could add context-specific configuration here if needed
  return logger;
};

export default devLogger;
