#!/usr/bin/env npx tsx
/**
 * GSD CLI - Command Line Interface
 * 
 * Usage:
 *   npm run gsd                    # Run full GSD cycle
 *   npm run gsd "implement X"      # Run with task description
 *   npm run gsd --build-only       # Only run build step
 *   npm run gsd --test-only        # Only run tests
 *   npm run gsd --fix-only         # Attempt fixes without running tests
 */

import { GSDRunner } from './runner.js';
import { Builder } from './builder.js';
import { Verifier } from './verifier.js';
import { DEFAULT_CONFIG } from './config.js';

async function main() {
  const args = process.argv.slice(2);
  
  // Parse flags
  const buildOnly = args.includes('--build-only');
  const testOnly = args.includes('--test-only');
  const fixOnly = args.includes('--fix-only');
  const verbose = args.includes('--verbose') || args.includes('-v');
  const help = args.includes('--help') || args.includes('-h');
  
  // Remove flags from args to get task description
  const task = args
    .filter(a => !a.startsWith('--') && !a.startsWith('-'))
    .join(' ') || 'build and test';

  if (help) {
    printHelp();
    process.exit(0);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           GSD AUTOMATION MODULE v1.0                     ║');
  console.log('║     Build → Test → Fix → Repeat (Token-Efficient)        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  try {
    if (buildOnly) {
      await runBuildOnly();
    } else if (testOnly) {
      await runTestOnly();
    } else {
      // Full GSD cycle
      const runner = new GSDRunner();
      const result = await runner.run(task);
      process.exit(result.status === 'success' ? 0 : 1);
    }
  } catch (error) {
    console.error('\n💥 GSD Fatal Error:', error);
    process.exit(1);
  }
}

async function runBuildOnly() {
  console.log('\n📦 Running build only...\n');
  
  const builder = new Builder(DEFAULT_CONFIG);
  const result = await builder.run();
  
  if (result.success) {
    console.log(`\n✅ Build succeeded in ${result.duration}ms`);
    process.exit(0);
  } else {
    console.log(`\n❌ Build failed with ${result.errors.length} errors:`);
    for (const error of result.errors.slice(0, 10)) {
      console.log(`   ${error.file}:${error.line} - ${error.message}`);
    }
    process.exit(1);
  }
}

async function runTestOnly() {
  console.log('\n🔍 Running tests only...\n');
  
  const verifier = new Verifier(DEFAULT_CONFIG);
  const result = await verifier.runUnitTests();
  
  if (result.success) {
    console.log(`\n✅ ${result.passed}/${result.total} tests passed`);
    process.exit(0);
  } else {
    console.log(`\n❌ ${result.failures.length} test failures:`);
    for (const failure of result.failures.slice(0, 5)) {
      console.log(`   ${failure.test}: ${failure.message}`);
    }
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
GSD Automation Module - Token-Efficient Build/Test Automation

USAGE:
  npm run gsd [task] [options]

TASK:
  A description of what you're working on (optional).
  Example: "implement SuperStack headers"

OPTIONS:
  --build-only    Only run the build step
  --test-only     Only run tests (skip build)
  --fix-only      Attempt fixes without full cycle
  --verbose, -v   Show detailed output
  --help, -h      Show this help message

EXAMPLES:
  npm run gsd
  npm run gsd "add D3 renderer"
  npm run gsd --build-only
  npm run gsd --test-only

OUTPUT:
  The module outputs structured JSON that Claude Code can parse.
  Token-efficient: No screenshots, uses text snapshots and hashes.

FILES:
  .gsd/state.json     - Current GSD state
  .gsd/history.jsonl  - Run history
  tests/gsd/snapshots - DOM snapshots (text)
  tests/gsd/hashes    - Visual regression hashes
`);
}

// Run
main().catch(console.error);
