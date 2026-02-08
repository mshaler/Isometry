#!/usr/bin/env node
/**
 * Console Pattern Analysis Script
 *
 * Analyzes all console statements in the codebase and categorizes them
 * for automated cleanup planning.
 */

import { glob } from 'glob';
import { readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Debug patterns that should be removed
const DEBUG_PATTERNS = [
  /console\.log\(['"`][🔍🔄👆🎨📊🗂️🏗️📋📏🎯✅⚠️]/,  // Emoji prefixed
  /console\.log\(['"`]\[.*?\].*:['"`]/,                    // Bracketed service logs like [SuperGrid]:
  /console\.log\(['"`].*debug.*['"`]/i,                    // Contains "debug"
  /console\.log\(['"`].*trace.*['"`]/i,                    // Contains "trace"
  /console\.debug\(/,                                      // All console.debug
];

// Legitimate patterns that should be kept
const LEGITIMATE_PATTERNS = [
  /console\.error\(/,                                      // Error reporting
  /console\.warn\(['"`]Failed to/,                        // Failure warnings
  /console\.warn\(['"`].*error/i,                         // Error-related warnings
];

// Performance monitoring patterns (should be wrapped in DEV)
const PERFORMANCE_PATTERNS = [
  /console\.log\(['"`].*performance.*['"`]/i,
  /console\.log\(['"`].*timing.*['"`]/i,
  /console\.log\(['"`].*metrics.*['"`]/i,
  /console\.time\(/,
  /console\.timeEnd\(/,
];

async function analyzeConsoleStatements() {
  console.log('🔍 Analyzing console statements...\n');

  try {
    const files = await glob('src/**/*.{ts,tsx}', { cwd: process.cwd() });
    const statements = [];

    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const consoleMatch = line.match(/console\.(log|error|warn|debug|info|time|timeEnd|group|groupEnd|table)/);
          if (consoleMatch) {
            const type = consoleMatch[1];
            let category = 'unknown';

            // Categorize based on patterns
            if (DEBUG_PATTERNS.some(pattern => pattern.test(line))) {
              category = 'debug_artifact';
            } else if (LEGITIMATE_PATTERNS.some(pattern => pattern.test(line))) {
              category = 'legitimate_error';
            } else if (PERFORMANCE_PATTERNS.some(pattern => pattern.test(line))) {
              category = 'performance_monitor';
            } else if (type === 'error') {
              category = 'legitimate_error';  // Default errors to legitimate
            } else if (type === 'warn' && (line.includes('Failed') || line.includes('Error'))) {
              category = 'legitimate_error';
            }

            statements.push({
              file,
              line: index + 1,
              type,
              content: line.trim(),
              category
            });
          }
        });
      } catch (err) {
        console.warn(`⚠️  Could not read file ${file}:`, err.message);
      }
    }

    return statements;
  } catch (err) {
    console.error('❌ Failed to analyze console statements:', err);
    throw err;
  }
}

async function generateReport(statements) {
  console.log('Console Statement Analysis Report');
  console.log('================================');
  console.log(`📊 Total statements found: ${statements.length}\n`);

  // Breakdown by category
  const byCategory = statements.reduce((acc, stmt) => {
    acc[stmt.category] = (acc[stmt.category] || 0) + 1;
    return acc;
  }, {});

  console.log('📋 By Category:');
  Object.entries(byCategory).forEach(([category, count]) => {
    const emoji = {
      debug_artifact: '🔴',
      legitimate_error: '🟢',
      performance_monitor: '🟡',
      unknown: '⚪'
    }[category] || '❓';

    console.log(`  ${emoji} ${category.replace('_', ' ')}: ${count}`);
  });

  // Breakdown by type
  const byType = statements.reduce((acc, stmt) => {
    acc[stmt.type] = (acc[stmt.type] || 0) + 1;
    return acc;
  }, {});

  console.log('\n🏷️  By Type:');
  Object.entries(byType)
    .sort(([,a], [,b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`  console.${type}: ${count}`);
    });

  // Top files
  const byFile = statements.reduce((acc, stmt) => {
    acc[stmt.file] = (acc[stmt.file] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📁 Top Files (by statement count):');
  Object.entries(byFile)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([file, count]) => {
      console.log(`  ${count.toString().padStart(3)} ${file}`);
    });

  return { statements, byCategory, byType, byFile };
}

async function main() {
  try {
    const statements = await analyzeConsoleStatements();
    const report = await generateReport(statements);

    // Save detailed analysis
    const outputPath = '.planning/console-analysis.json';
    await writeFile(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      total: statements.length,
      breakdown: report,
      statements: statements
    }, null, 2));

    console.log(`\n💾 Detailed analysis saved to: ${outputPath}`);

    // Generate cleanup recommendations
    const debugCount = report.byCategory.debug_artifact || 0;
    const perfCount = report.byCategory.performance_monitor || 0;
    const savings = debugCount + Math.floor(perfCount * 0.5); // Assume 50% of perf logs get wrapped

    console.log('\n🎯 Cleanup Potential:');
    console.log(`  Debug artifacts to remove: ${debugCount}`);
    console.log(`  Performance logs to wrap: ${perfCount}`);
    console.log(`  Estimated reduction: ${savings} statements (${Math.round(savings/statements.length*100)}%)`);

    console.log('\n✅ Analysis complete! Next steps:');
    console.log('  1. Review the detailed analysis file');
    console.log('  2. Run cleanup script with --dry-run');
    console.log('  3. Execute cleanup after validation');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run analysis
main();