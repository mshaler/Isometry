/**
 * GSD Parser Module
 * 
 * Parses various error formats into structured ParsedError objects.
 * Supports TypeScript, ESLint, Vite, Vitest, and runtime errors.
 */

import { ParsedError } from './config.js';

export class Parser {
  /**
   * Parse any error into structured format
   */
  static parseError(error: unknown): ParsedError {
    if (error instanceof Error) {
      return this.parseJSError(error);
    }
    
    if (typeof error === 'string') {
      return this.parseStringError(error);
    }

    return {
      file: '',
      line: 0,
      column: 0,
      message: String(error),
      category: 'unknown',
    };
  }

  /**
   * Parse JavaScript Error object
   */
  static parseJSError(error: Error): ParsedError {
    const stack = error.stack || '';
    
    // Extract file/line from stack trace
    const stackMatch = stack.match(/at\s+(?:\S+\s+)?\(?(.+?):(\d+):(\d+)\)?/);
    
    return {
      file: stackMatch?.[1] || '',
      line: stackMatch ? parseInt(stackMatch[2]) : 0,
      column: stackMatch ? parseInt(stackMatch[3]) : 0,
      message: error.message,
      category: this.categorizeError(error.message),
      stack,
    };
  }

  /**
   * Parse string error message
   */
  static parseStringError(error: string): ParsedError {
    // Try TypeScript format: file.ts(10,5): error TS2304: message
    const tsMatch = error.match(/^(.+?)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)$/);
    if (tsMatch) {
      return {
        file: tsMatch[1],
        line: parseInt(tsMatch[2]),
        column: parseInt(tsMatch[3]),
        code: tsMatch[4],
        message: tsMatch[5],
        category: 'typescript',
      };
    }

    // Try ESLint format: file.ts:10:5: error message (rule-name)
    const eslintMatch = error.match(/^(.+?):(\d+):(\d+):\s*(error|warning)\s*(.+?)\s+(\S+)$/);
    if (eslintMatch) {
      return {
        file: eslintMatch[1],
        line: parseInt(eslintMatch[2]),
        column: parseInt(eslintMatch[3]),
        message: eslintMatch[5],
        code: eslintMatch[6],
        category: 'eslint',
      };
    }

    // Try Vitest format: FAIL src/file.test.ts > test name
    const vitestMatch = error.match(/FAIL\s+(.+?)\s+>\s+(.+)/);
    if (vitestMatch) {
      return {
        file: vitestMatch[1],
        line: 0,
        column: 0,
        message: `Test failed: ${vitestMatch[2]}`,
        category: 'test',
      };
    }

    return {
      file: '',
      line: 0,
      column: 0,
      message: error,
      category: this.categorizeError(error),
    };
  }

  /**
   * Parse Vitest JSON output
   */
  static parseVitestOutput(json: string): ParsedError[] {
    const errors: ParsedError[] = [];
    
    try {
      const result = JSON.parse(json);
      
      for (const testFile of result.testResults || []) {
        for (const assertion of testFile.assertionResults || []) {
          if (assertion.status === 'failed') {
            const message = assertion.failureMessages?.[0] || 'Unknown failure';
            
            // Try to extract file/line from failure message
            const locationMatch = message.match(/at\s+(?:\S+\s+)?\(?(.+?):(\d+):(\d+)\)?/);
            
            errors.push({
              file: locationMatch?.[1] || testFile.name,
              line: locationMatch ? parseInt(locationMatch[2]) : 0,
              column: locationMatch ? parseInt(locationMatch[3]) : 0,
              message: `${assertion.title}: ${message.substring(0, 200)}`,
              category: 'test',
            });
          }
        }
      }
    } catch {
      errors.push({
        file: '',
        line: 0,
        column: 0,
        message: 'Failed to parse Vitest output',
        category: 'test',
      });
    }

    return errors;
  }

  /**
   * Parse build output (combined TypeScript + Vite)
   */
  static parseBuildOutput(output: string): ParsedError[] {
    const errors: ParsedError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // TypeScript
      const tsMatch = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)$/);
      if (tsMatch) {
        errors.push({
          file: tsMatch[1],
          line: parseInt(tsMatch[2]),
          column: parseInt(tsMatch[3]),
          code: tsMatch[4],
          message: tsMatch[5],
          category: 'typescript',
        });
        continue;
      }

      // Vite/Rollup
      if (line.includes('[vite]') && line.includes('error')) {
        errors.push({
          file: '',
          line: 0,
          column: 0,
          message: line.replace('[vite]', '').trim(),
          category: 'vite',
        });
      }
    }

    return errors;
  }

  /**
   * Categorize error by its message content
   */
  private static categorizeError(message: string): ParsedError['category'] {
    const lower = message.toLowerCase();
    
    if (lower.includes('ts') && /ts\d{4}/.test(message)) {
      return 'typescript';
    }
    
    if (lower.includes('eslint') || lower.includes('lint')) {
      return 'eslint';
    }
    
    if (lower.includes('vite') || lower.includes('rollup')) {
      return 'vite';
    }
    
    if (lower.includes('test') || lower.includes('expect') || lower.includes('assert')) {
      return 'test';
    }
    
    if (lower.includes('runtime') || lower.includes('uncaught') || lower.includes('unhandled')) {
      return 'runtime';
    }
    
    return 'unknown';
  }

  /**
   * Group errors by file
   */
  static groupByFile(errors: ParsedError[]): Map<string, ParsedError[]> {
    const grouped = new Map<string, ParsedError[]>();
    
    for (const error of errors) {
      const file = error.file || 'unknown';
      const existing = grouped.get(file) || [];
      existing.push(error);
      grouped.set(file, existing);
    }
    
    return grouped;
  }

  /**
   * Group errors by category
   */
  static groupByCategory(errors: ParsedError[]): Map<string, ParsedError[]> {
    const grouped = new Map<string, ParsedError[]>();
    
    for (const error of errors) {
      const existing = grouped.get(error.category) || [];
      existing.push(error);
      grouped.set(error.category, existing);
    }
    
    return grouped;
  }

  /**
   * Format errors for Claude Code output (token-efficient)
   */
  static formatForOutput(errors: ParsedError[], maxErrors: number = 5): string {
    const limited = errors.slice(0, maxErrors);
    const lines = limited.map(e => {
      const location = e.file ? `${e.file}:${e.line}:${e.column}` : 'unknown';
      const code = e.code ? `[${e.code}]` : '';
      return `  ${location} ${code} ${e.message}`;
    });

    if (errors.length > maxErrors) {
      lines.push(`  ... and ${errors.length - maxErrors} more errors`);
    }

    return lines.join('\n');
  }
}
