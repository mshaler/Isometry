/**
 * DevLogger - Production-optimized conditional compilation logging
 *
 * Tree-shaken in production builds for zero runtime overhead
 * Semantic logging methods for different debugging contexts
 */

interface DevLoggerOptions {
  prefix?: string;
  enabledLevels?: Array<'debug' | 'info' | 'warn' | 'error'>;
}

class DevLogger {
  private prefix: string;
  private enabledLevels: Set<string>;

  constructor(options: DevLoggerOptions = {}) {
    this.prefix = options.prefix || '[DevLogger]';
    this.enabledLevels = new Set(options.enabledLevels || ['debug', 'info', 'warn', 'error']);
  }

  private shouldLog(level: string): boolean {
    return import.meta.env.DEV && this.enabledLevels.has(level);
  }

  private formatMessage(message: string): string {
    return `${this.prefix} ${message}`;
  }

  // Semantic logging methods for specific debugging contexts
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

  render(label: string, data: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(`🎨 ${label}:`), data);
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

  setup(label: string, data: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(`🏗️ ${label}:`), data);
    }
  }

  // Standard log levels
  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(message), data);
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(message), data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), data);
    }
  }

  error(message: string, data?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message), data);
    }
  }
}

// Default logger instance
export const devLogger = new DevLogger();

// Specialized loggers for different modules
export const superGridLogger = new DevLogger({ prefix: '[SuperGrid]' });
export const d3Logger = new DevLogger({ prefix: '[D3]' });
export const contextLogger = new DevLogger({ prefix: '[Context]' });
export const hookLogger = new DevLogger({ prefix: '[Hook]' });
export const componentLogger = new DevLogger({ prefix: '[Component]' });
export const utilLogger = new DevLogger({ prefix: '[Util]' });

// Bridge logger with limited methods (matching existing bridge logger interface)
export const bridgeLogger = new DevLogger({ prefix: '[Bridge]' });

export default devLogger;