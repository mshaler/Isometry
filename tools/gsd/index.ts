/**
 * GSD Automation Module - Main Entry Point
 * 
 * Token-efficient build → test → fix automation for Claude Code.
 * 
 * @example
 * ```typescript
 * import { GSDRunner } from './tools/gsd';
 * 
 * const runner = new GSDRunner();
 * const result = await runner.run('implement SuperStack headers');
 * 
 * if (result.status === 'success') {
 *   console.log(result.summary);
 * }
 * ```
 */

export { GSDRunner } from './runner.js';
export { Builder } from './builder.js';
export { Launcher } from './launcher.js';
export { Monitor } from './monitor.js';
export { Verifier } from './verifier.js';
export { Fixer } from './fixer.js';
export { Parser } from './parser.js';

export type {
  GSDConfig,
  GSDState,
  GSDResult,
  ParsedError,
  BuildResult,
  LaunchResult,
  MonitorResult,
  VerifyResult,
  FixResult,
  FixAction,
  TestFailure,
  ConsoleEntry,
  PerformanceMetrics,
} from './config.js';

export { DEFAULT_CONFIG } from './config.js';
