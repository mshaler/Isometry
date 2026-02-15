/**
 * GSD Runner - Main Orchestrator
 * 
 * Fully autonomous build → launch → monitor → verify → debug → fix cycle.
 * Designed for Claude Code with token-efficient output.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Builder } from './builder.js';
import { Launcher } from './launcher.js';
import { Monitor } from './monitor.js';
import { Verifier } from './verifier.js';
import { Fixer } from './fixer.js';
import { Parser } from './parser.js';
import {
  GSDConfig,
  DEFAULT_CONFIG,
  GSDState,
  GSDResult,
  ParsedError,
  BuildResult,
  LaunchResult,
  VerifyResult,
  FixResult,
} from './config.js';

export class GSDRunner {
  private config: GSDConfig;
  private state: GSDState;
  private builder: Builder;
  private launcher: Launcher;
  private monitor: Monitor;
  private verifier: Verifier;
  private fixer: Fixer;

  constructor(config: Partial<GSDConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.loadState();
    this.builder = new Builder(this.config);
    this.launcher = new Launcher(this.config);
    this.monitor = new Monitor(this.config);
    this.verifier = new Verifier(this.config);
    this.fixer = new Fixer(this.config);
  }

  /**
   * Main GSD loop - fully autonomous
   */
  async run(task: string = 'build and test'): Promise<GSDResult> {
    const startTime = Date.now();
    let attempt = 0;
    let lastError: ParsedError[] = [];

    console.log('\n' + '═'.repeat(60));
    console.log(`  GSD AUTOMATION: ${task}`);
    console.log('═'.repeat(60) + '\n');

    while (attempt < this.config.maxRetries) {
      attempt++;
      console.log(`┌─ Cycle ${attempt}/${this.config.maxRetries} ${'─'.repeat(40)}`);

      try {
        // 1. BUILD
        const buildResult = await this.runBuild();
        if (!buildResult.success) {
          lastError = buildResult.errors;
          const fix = await this.attemptFix('build', buildResult.errors);
          if (fix.applied) {
            console.log(`│  ↻ Retrying after fix: ${fix.fixType}`);
            continue;
          }
          return this.formatResult('build_failed', {
            errors: Parser.formatForOutput(buildResult.errors),
            suggestion: fix.suggestion,
          }, attempt, startTime);
        }

        // 2. LAUNCH (only if tests need browser)
        // For Isometry, we primarily use Vitest which doesn't need launch
        // But we'll check if server is needed
        const needsServer = await this.checkIfServerNeeded();
        if (needsServer) {
          const launchResult = await this.runLaunch();
          if (!launchResult.success) {
            return this.formatResult('launch_failed', {
              error: launchResult.error,
            }, attempt, startTime);
          }
        }

        // 3. VERIFY (tests + DOM + hashes)
        const verifyResult = await this.runVerify();
        if (!verifyResult.success) {
          lastError = verifyResult.failures.map(f => ({
            file: '',
            line: 0,
            column: 0,
            message: `${f.test}: ${f.message}`,
            category: 'test' as const,
          }));
          const fix = await this.attemptFix('test', lastError);
          if (fix.applied) {
            console.log(`│  ↻ Retrying after fix: ${fix.fixType}`);
            continue;
          }
          return this.formatResult('test_failed', {
            passed: verifyResult.passed,
            total: verifyResult.total,
            failures: verifyResult.failures.slice(0, 3).map(f => f.message),
            suggestion: fix.suggestion,
          }, attempt, startTime);
        }

        // 4. SUCCESS
        await this.cleanup();
        this.updateState({ consecutiveFailures: 0, lastSuccessfulBuild: new Date().toISOString() });
        
        return this.formatResult('success', {
          passed: verifyResult.passed,
          total: verifyResult.total,
          duration: Date.now() - startTime,
        }, attempt, startTime);

      } catch (error) {
        const parsed = Parser.parseError(error);
        lastError = [parsed];
        
        const fix = await this.attemptFix(parsed.category, [parsed]);
        if (!fix.applied) {
          console.log(`│  ✗ Unrecoverable error: ${parsed.message}`);
          break;
        }
        console.log(`│  ↻ Retrying after fix: ${fix.fixType}`);
      }
    }

    await this.cleanup();
    this.updateState({ consecutiveFailures: this.state.consecutiveFailures + 1 });
    
    return this.formatResult('max_retries_exceeded', {
      lastError: lastError.map(e => e.message).join('; '),
      attempts: attempt,
    }, attempt, startTime);
  }

  /**
   * BUILD step
   */
  private async runBuild(): Promise<BuildResult> {
    console.log('│');
    console.log('│  📦 BUILD');
    
    const result = await this.builder.run();

    if (result.success) {
      console.log(`│     ✓ Complete (${result.duration}ms)`);
    } else {
      console.log(`│     ✗ Failed with ${result.errors.length} errors`);
      for (const error of result.errors.slice(0, 3)) {
        const loc = error.file ? `${path.basename(error.file)}:${error.line}` : 'unknown';
        console.log(`│       ${loc}: ${error.message.substring(0, 60)}`);
      }
    }

    return result;
  }

  /**
   * LAUNCH step
   */
  private async runLaunch(): Promise<LaunchResult> {
    console.log('│');
    console.log('│  🚀 LAUNCH');
    
    const result = await this.launcher.start();

    if (result.success) {
      console.log(`│     ✓ Server running at ${result.url}`);
    } else {
      console.log(`│     ✗ Failed: ${result.error}`);
    }

    return result;
  }

  /**
   * VERIFY step
   */
  private async runVerify(): Promise<VerifyResult> {
    console.log('│');
    console.log('│  🔍 VERIFY');
    
    const result = await this.verifier.verify();

    if (result.success) {
      console.log(`│     ✓ ${result.passed}/${result.total} tests passed`);
    } else {
      console.log(`│     ✗ ${result.failures.length} failures`);
      for (const failure of result.failures.slice(0, 3)) {
        console.log(`│       ${failure.test}: ${failure.message.substring(0, 50)}`);
      }
    }

    return result;
  }

  /**
   * Attempt to fix errors
   */
  private async attemptFix(category: string, errors: ParsedError[]): Promise<FixResult> {
    console.log('│');
    console.log('│  🔧 FIX');
    
    const result = await this.fixer.attemptFix(category, errors);

    if (result.applied) {
      console.log(`│     ✓ Applied: ${result.fixType}`);
      console.log(`│       Modified: ${result.filesModified.join(', ')}`);
    } else if (result.suggestion) {
      console.log(`│     → Suggestion: ${result.suggestion}`);
    } else {
      console.log(`│     ✗ No automatic fix available`);
    }

    return result;
  }

  /**
   * Check if tests need a running server
   */
  private async checkIfServerNeeded(): Promise<boolean> {
    // For now, assume Vitest tests don't need server
    // This could be enhanced to check for E2E tests
    return false;
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    await this.launcher.stop();
  }

  /**
   * Format result for Claude Code
   */
  private formatResult(
    status: GSDResult['status'],
    data: Record<string, unknown>,
    attempts: number,
    startTime: number
  ): GSDResult {
    const duration = Date.now() - startTime;
    
    console.log('│');
    console.log(`└─ ${status === 'success' ? '✓' : '✗'} ${status.toUpperCase()} (${duration}ms)`);
    console.log('');

    const result: GSDResult = {
      status,
      attempts,
      timestamp: new Date().toISOString(),
      data: { ...data, duration },
      summary: this.generateSummary(status, data, duration),
    };

    // Log structured JSON for Claude Code
    console.log('┌─ GSD RESULT (JSON) ' + '─'.repeat(39));
    console.log(JSON.stringify(result, null, 2).split('\n').map(l => '│  ' + l).join('\n'));
    console.log('└' + '─'.repeat(59));

    // Append to history
    this.appendHistory(result);

    return result;
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(status: string, data: Record<string, unknown>, duration: number): string {
    switch (status) {
      case 'success':
        return `✅ GSD Complete: ${data.passed}/${data.total} tests passed in ${duration}ms`;
      case 'build_failed':
        return `❌ Build failed: ${String(data.errors || 'Unknown error').substring(0, 100)}`;
      case 'test_failed':
        return `❌ Tests failed: ${data.passed}/${data.total} passed`;
      case 'launch_failed':
        return `❌ Server failed: ${data.error}`;
      case 'max_retries_exceeded':
        return `❌ Max retries (${data.attempts}) exceeded: ${data.lastError}`;
      default:
        return `Status: ${status}`;
    }
  }

  /**
   * Load GSD state from file
   */
  private loadState(): GSDState {
    const stateFile = path.join(this.config.projectRoot, this.config.stateFile);
    
    try {
      if (fs.existsSync(stateFile)) {
        return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      }
    } catch {
      // Ignore errors
    }

    return {
      lastRun: null,
      consecutiveFailures: 0,
      lastSuccessfulBuild: null,
      buildCache: {},
    };
  }

  /**
   * Update GSD state
   */
  private updateState(updates: Partial<GSDState>): void {
    this.state = { ...this.state, ...updates, lastRun: new Date().toISOString() };
    
    const stateDir = path.dirname(path.join(this.config.projectRoot, this.config.stateFile));
    fs.mkdirSync(stateDir, { recursive: true });
    
    fs.writeFileSync(
      path.join(this.config.projectRoot, this.config.stateFile),
      JSON.stringify(this.state, null, 2)
    );
  }

  /**
   * Append result to history file
   */
  private appendHistory(result: GSDResult): void {
    const historyFile = path.join(this.config.projectRoot, this.config.historyFile);
    const historyDir = path.dirname(historyFile);
    
    fs.mkdirSync(historyDir, { recursive: true });
    fs.appendFileSync(historyFile, JSON.stringify(result) + '\n');
  }
}

// Export all modules
export { Builder } from './builder.js';
export { Launcher } from './launcher.js';
export { Monitor } from './monitor.js';
export { Verifier } from './verifier.js';
export { Fixer } from './fixer.js';
export { Parser } from './parser.js';
export * from './config.js';
