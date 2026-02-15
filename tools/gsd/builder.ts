/**
 * GSD Builder Module
 * 
 * Handles TypeScript compilation and Vite bundling.
 * Parses build errors into structured format for auto-fixing.
 */

import { spawn } from 'child_process';
import { GSDConfig, BuildResult, ParsedError } from './config.js';

export class Builder {
  constructor(private config: GSDConfig) {}

  async run(): Promise<BuildResult> {
    const start = Date.now();
    
    return new Promise((resolve) => {
      // First run TypeScript check, then Vite build
      this.runTypeCheck().then((typeResult) => {
        if (!typeResult.success) {
          resolve({
            success: false,
            duration: Date.now() - start,
            errors: typeResult.errors,
            warnings: typeResult.warnings,
          });
          return;
        }

        // TypeScript passed, run Vite build
        this.runViteBuild().then((viteResult) => {
          resolve({
            success: viteResult.success,
            duration: Date.now() - start,
            errors: [...typeResult.errors, ...viteResult.errors],
            warnings: [...typeResult.warnings, ...viteResult.warnings],
          });
        });
      });
    });
  }

  private async runTypeCheck(): Promise<{ success: boolean; errors: ParsedError[]; warnings: ParsedError[] }> {
    return new Promise((resolve) => {
      const proc = spawn('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
        cwd: this.config.projectRoot,
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        const output = stdout + stderr;
        const errors = this.parseTypeScriptErrors(output);
        const warnings = this.parseTypeScriptWarnings(output);

        resolve({
          success: code === 0,
          errors,
          warnings,
        });
      });

      // Timeout
      setTimeout(() => {
        proc.kill();
        resolve({
          success: false,
          errors: [{
            file: '',
            line: 0,
            column: 0,
            message: 'TypeScript check timeout exceeded',
            category: 'typescript',
          }],
          warnings: [],
        });
      }, this.config.timeout);
    });
  }

  private async runViteBuild(): Promise<{ success: boolean; errors: ParsedError[]; warnings: ParsedError[] }> {
    return new Promise((resolve) => {
      const proc = spawn('npx', ['vite', 'build'], {
        cwd: this.config.projectRoot,
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        const output = stdout + stderr;
        const errors = this.parseViteErrors(output);

        resolve({
          success: code === 0,
          errors,
          warnings: [],
        });
      });

      setTimeout(() => {
        proc.kill();
        resolve({
          success: false,
          errors: [{
            file: '',
            line: 0,
            column: 0,
            message: 'Vite build timeout exceeded',
            category: 'vite',
          }],
          warnings: [],
        });
      }, this.config.timeout);
    });
  }

  private parseTypeScriptErrors(output: string): ParsedError[] {
    const errors: ParsedError[] = [];
    
    // TypeScript error pattern: src/file.ts(10,5): error TS2304: Cannot find name 'x'.
    const tsPattern = /^(.+?)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)$/gm;
    let match;
    
    while ((match = tsPattern.exec(output)) !== null) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[4],
        message: match[5],
        category: 'typescript',
      });
    }

    // Also parse Vite-style TypeScript errors
    const vitePattern = /error TS\d+:.*?\n.*?(\S+\.tsx?):(\d+):(\d+)/gm;
    while ((match = vitePattern.exec(output)) !== null) {
      const messageMatch = output.substring(match.index).match(/error (TS\d+): (.+?)(?:\n|$)/);
      if (messageMatch) {
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          code: messageMatch[1],
          message: messageMatch[2],
          category: 'typescript',
        });
      }
    }

    return errors;
  }

  private parseTypeScriptWarnings(output: string): ParsedError[] {
    // TypeScript doesn't have warnings by default, but we can parse notes
    return [];
  }

  private parseViteErrors(output: string): ParsedError[] {
    const errors: ParsedError[] = [];

    // Vite/Rollup error pattern
    const vitePattern = /error during build:[\s\S]*?(?:file:\s*(\S+))?[\s\S]*?(\d+):(\d+)/gm;
    let match;

    while ((match = vitePattern.exec(output)) !== null) {
      errors.push({
        file: match[1] || 'unknown',
        line: parseInt(match[2]) || 0,
        column: parseInt(match[3]) || 0,
        message: 'Vite build error',
        category: 'vite',
      });
    }

    // Also catch generic errors
    if (output.includes('Build failed') && errors.length === 0) {
      const errorLine = output.split('\n').find(l => l.includes('error') || l.includes('Error'));
      errors.push({
        file: '',
        line: 0,
        column: 0,
        message: errorLine || 'Build failed with unknown error',
        category: 'vite',
      });
    }

    return errors;
  }
}
