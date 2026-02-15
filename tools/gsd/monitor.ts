/**
 * GSD Monitor Module
 * 
 * Captures console output, errors, and performance metrics.
 * Token-efficient: structured data, not raw logs.
 */

import { GSDConfig, MonitorResult, ConsoleEntry, PerformanceMetrics } from './config.js';

export class Monitor {
  private logs: ConsoleEntry[] = [];
  private startTime: number = 0;
  
  constructor(private config: GSDConfig) {}

  /**
   * Start monitoring (capture baseline)
   */
  start(): void {
    this.logs = [];
    this.startTime = Date.now();
  }

  /**
   * Capture current state
   */
  async capture(options: {
    consoleLogs?: boolean;
    networkRequests?: boolean;
    performance?: boolean;
  } = {}): Promise<MonitorResult> {
    const result: MonitorResult = {
      logs: [],
      errors: [],
      warnings: [],
    };

    // In Node.js context, we capture what we've been collecting
    if (options.consoleLogs !== false) {
      result.logs = this.logs.filter(l => l.level === 'log' || l.level === 'info');
      result.errors = this.logs.filter(l => l.level === 'error');
      result.warnings = this.logs.filter(l => l.level === 'warn');
    }

    if (options.performance) {
      result.performance = this.capturePerformance();
    }

    return result;
  }

  /**
   * Add a log entry (for intercepted console output)
   */
  addLog(level: string, text: string, source?: string): void {
    this.logs.push({
      level,
      text: text.substring(0, 500), // Limit for token efficiency
      timestamp: new Date().toISOString(),
      source,
    });
  }

  /**
   * Parse console output from a process
   */
  parseProcessOutput(output: string): ConsoleEntry[] {
    const entries: ConsoleEntry[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // Detect log level from common patterns
      let level = 'log';
      if (line.includes('[error]') || line.includes('Error:') || line.includes('ERROR')) {
        level = 'error';
      } else if (line.includes('[warn]') || line.includes('Warning:') || line.includes('WARN')) {
        level = 'warn';
      } else if (line.includes('[info]') || line.includes('INFO')) {
        level = 'info';
      }

      entries.push({
        level,
        text: line.substring(0, 500),
        timestamp: new Date().toISOString(),
      });
    }

    return entries;
  }

  /**
   * Capture performance metrics
   */
  private capturePerformance(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    
    return {
      loadTime: Date.now() - this.startTime,
      memoryUsage: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      domNodes: 0, // Not applicable in Node context
    };
  }

  /**
   * Filter logs by level
   */
  getLogsByLevel(level: string): ConsoleEntry[] {
    return this.logs.filter(l => l.level === level);
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    total: number;
    errors: number;
    warnings: number;
    info: number;
  } {
    return {
      total: this.logs.length,
      errors: this.logs.filter(l => l.level === 'error').length,
      warnings: this.logs.filter(l => l.level === 'warn').length,
      info: this.logs.filter(l => l.level === 'log' || l.level === 'info').length,
    };
  }

  /**
   * Clear collected logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Format for Claude Code output (token-efficient)
   */
  formatForOutput(maxEntries: number = 10): string {
    const errors = this.logs.filter(l => l.level === 'error').slice(0, maxEntries);
    const warnings = this.logs.filter(l => l.level === 'warn').slice(0, 3);
    
    const lines: string[] = [];
    
    if (errors.length > 0) {
      lines.push(`Errors (${errors.length}):`);
      for (const e of errors) {
        lines.push(`  ${e.text.substring(0, 100)}`);
      }
    }
    
    if (warnings.length > 0) {
      lines.push(`Warnings (${warnings.length}):`);
      for (const w of warnings) {
        lines.push(`  ${w.text.substring(0, 80)}`);
      }
    }

    return lines.join('\n');
  }
}
