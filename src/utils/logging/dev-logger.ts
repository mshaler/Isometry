/**
 * Development Logger Utility
 *
 * Provides conditional logging that only operates in development mode.
 * Replaces debug console statements with type-safe, conditional logging.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface DevLoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix?: string;
}

class DevLogger {
  private config: DevLoggerConfig;

  constructor(config: Partial<DevLoggerConfig> = {}) {
    this.config = {
      enabled: import.meta.env.DEV || false,
      level: 'debug',
      prefix: '',
      ...config
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;

    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.config.level];
  }

  private formatMessage(message: string): string {
    return this.config.prefix ? `${this.config.prefix} ${message}` : message;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  // Performance logging
  time(label: string): void {
    if (this.shouldLog('debug')) {
      console.time(this.formatMessage(label));
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog('debug')) {
      console.timeEnd(this.formatMessage(label));
    }
  }

  // Data inspection (replaces emoji debug patterns)
  inspect(label: string, data: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(`🔍 ${label}:`), data);
    }
  }

  state(label: string, data: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(`🔄 ${label}:`), data);
    }
  }

  render(label: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(`🎨 ${label}`), data || '');
    }
  }

  metrics(label: string, data: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(`📊 ${label}:`), data);
    }
  }

  data(label: string, data: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(`🗂️ ${label}:`), data);
    }
  }

  setup(label: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(`🏗️ ${label}`), data || '');
    }
  }
}

// Create service-specific loggers
export const createLogger = (service: string) =>
  new DevLogger({ prefix: `[${service}]` });

// Pre-configured loggers for common services
export const superGridLogger = createLogger('SuperGrid');
export const bridgeLogger = createLogger('Bridge');
export const performanceLogger = createLogger('Performance');
export const d3Logger = createLogger('D3');
export const sqliteLogger = createLogger('SQLite');
export const pafvLogger = createLogger('PAFV');
export const migrationLogger = createLogger('Migration');
export const contextLogger = createLogger('Context');

// General development logger
export const devLogger = new DevLogger();

export default DevLogger;