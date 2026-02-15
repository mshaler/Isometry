/**
 * GSD Configuration Types
 * 
 * Central type definitions for the GSD automation system.
 */

export interface GSDConfig {
  projectRoot: string;
  buildCommand: string;
  devCommand: string;
  testCommand: string;
  port: number;
  timeout: number;
  tokenBudget: number;
  maxRetries: number;
  snapshotDir: string;
  hashDir: string;
  stateFile: string;
  historyFile: string;
}

export const DEFAULT_CONFIG: GSDConfig = {
  projectRoot: process.cwd(),
  buildCommand: 'npm run build',
  devCommand: 'npm run dev',
  testCommand: 'npm run test:run',
  port: 5173,
  timeout: 30000,
  tokenBudget: 10000,
  maxRetries: 3,
  snapshotDir: 'tests/gsd/snapshots',
  hashDir: 'tests/gsd/hashes',
  stateFile: '.gsd/state.json',
  historyFile: '.gsd/history.jsonl',
};

export interface GSDState {
  lastRun: string | null;
  consecutiveFailures: number;
  lastSuccessfulBuild: string | null;
  buildCache: Record<string, string>;
}

export interface GSDResult {
  status: 'success' | 'build_failed' | 'test_failed' | 'launch_failed' | 'max_retries_exceeded';
  attempts: number;
  timestamp: string;
  data: Record<string, unknown>;
  summary: string;
}

export interface ParsedError {
  file: string;
  line: number;
  column: number;
  message: string;
  category: 'typescript' | 'eslint' | 'vite' | 'runtime' | 'test' | 'unknown';
  code?: string;
  stack?: string;
}

export interface BuildResult {
  success: boolean;
  duration: number;
  errors: ParsedError[];
  warnings: ParsedError[];
}

export interface LaunchResult {
  success: boolean;
  pid?: number;
  url?: string;
  error?: string;
}

export interface MonitorResult {
  logs: ConsoleEntry[];
  errors: ConsoleEntry[];
  warnings: ConsoleEntry[];
  performance?: PerformanceMetrics;
}

export interface ConsoleEntry {
  level: string;
  text: string;
  timestamp: string;
  source?: string;
}

export interface PerformanceMetrics {
  loadTime: number;
  memoryUsage: number;
  domNodes: number;
}

export interface VerifyResult {
  success: boolean;
  passed: number;
  total: number;
  failures: TestFailure[];
}

export interface TestFailure {
  test: string;
  message: string;
  expected?: string;
  actual?: string;
  stack?: string;
}

export interface FixResult {
  applied: boolean;
  fixType?: string;
  filesModified: string[];
  suggestion?: string;
}

export interface FixAction {
  file: string;
  action: 'prepend' | 'append' | 'insert' | 'replace' | 'prefix' | 'wrap' | 'suggest';
  content?: string;
  line?: number;
  column?: number;
  search?: string;
  replace?: string;
  wrapper?: (content: string) => string;
  suggestion?: string;
}
