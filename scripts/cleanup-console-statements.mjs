#!/usr/bin/env node
/**
 * Automated Console Cleanup Script
 *
 * Removes debug artifacts and wraps performance monitoring in DEV checks
 * based on the console pattern analysis.
 */

import { readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Command line options
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || !args.includes('--execute');
const isVerbose = args.includes('--verbose');

async function loadAnalysis() {
  try {
    const analysisContent = await readFile('.planning/console-analysis.json', 'utf-8');
    return JSON.parse(analysisContent);
  } catch (error) {
    console.error('❌ Could not load console analysis. Run analyze-console-patterns.mjs first.');
    process.exit(1);
  }
}

function getCleanupAction(statement) {
  switch (statement.category) {
    case 'debug_artifact':
      return 'remove';
    case 'performance_monitor':
      return 'wrap_dev';
    default:
      return 'keep';
  }
}

function generateCleanupReplacement(originalLine, action) {
  const indentation = originalLine.match(/^\\s*/)?.[0] || '';
  const trimmedLine = originalLine.trim();

  switch (action) {
    case 'remove':
      // Replace with descriptive comment
      if (trimmedLine.includes('🔍')) return `${indentation}// Debug: removed inspection log`;
      if (trimmedLine.includes('🔄')) return `${indentation}// Debug: removed state change log`;
      if (trimmedLine.includes('🎨')) return `${indentation}// Debug: removed render log`;
      if (trimmedLine.includes('📊')) return `${indentation}// Debug: removed metrics log`;
      if (trimmedLine.includes('🗂️')) return `${indentation}// Debug: removed data log`;
      if (trimmedLine.includes('🏗️')) return `${indentation}// Debug: removed setup log`;
      return `${indentation}// Debug logging removed`;

    case 'wrap_dev':
      // Wrap in DEV check
      return [
        `${indentation}if (import.meta.env.DEV) {`,
        `${indentation}  ${trimmedLine}`,
        `${indentation}}`
      ];

    default:
      return originalLine;
  }
}

async function processFile(filePath, statements) {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;
  const changes = [];

  // Sort statements by line number in reverse order to maintain indices
  const fileStatements = statements
    .filter(stmt => stmt.file === filePath)
    .sort((a, b) => b.line - a.line);

  for (const statement of fileStatements) {
    const action = getCleanupAction(statement);

    if (action === 'keep') continue;

    const lineIndex = statement.line - 1;
    const originalLine = lines[lineIndex];
    const replacement = generateCleanupReplacement(originalLine, action);

    if (Array.isArray(replacement)) {
      // Multi-line replacement (wrap_dev)
      lines.splice(lineIndex, 1, ...replacement);
      changes.push({
        line: statement.line,
        action: 'wrap_conditional',
        before: originalLine.trim(),
        after: replacement.map(l => l.trim()).join(' ')
      });
    } else if (replacement !== originalLine) {
      // Single line replacement (remove)
      lines[lineIndex] = replacement;
      changes.push({
        line: statement.line,
        action: 'remove_debug',
        before: originalLine.trim(),
        after: replacement.trim()
      });
    }

    modified = true;
  }

  return { content: lines.join('\n'), changes, modified };
}

async function executeCleanup() {
  const analysis = await loadAnalysis();
  const statements = analysis.statements;

  console.log('🧹 Console Statement Cleanup');
  console.log('============================');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN' : '🚀 EXECUTE'}`);
  console.log(`Total statements: ${statements.length}`);

  // Group by file
  const fileGroups = statements.reduce((acc, stmt) => {
    if (!acc[stmt.file]) acc[stmt.file] = [];
    acc[stmt.file].push(stmt);
    return acc;
  }, {});

  const allChanges = [];
  let filesModified = 0;

  console.log('\\n📁 Processing files...');

  for (const [filePath, fileStatements] of Object.entries(fileGroups)) {
    const actionableStatements = fileStatements.filter(stmt =>
      stmt.category === 'debug_artifact' || stmt.category === 'performance_monitor'
    );

    if (actionableStatements.length === 0) continue;

    try {
      const result = await processFile(filePath, fileStatements);

      if (result.modified) {
        filesModified++;
        allChanges.push(...result.changes.map(change => ({
          ...change,
          file: filePath
        })));

        if (isVerbose) {
          console.log(`  📝 ${filePath}: ${result.changes.length} changes`);
          result.changes.forEach(change => {
            console.log(`    L${change.line}: ${change.action}`);
          });
        } else {
          console.log(`  📝 ${filePath}: ${result.changes.length} changes`);
        }

        // Write file if not dry run
        if (!isDryRun) {
          await writeFile(filePath, result.content);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }

  console.log('\\n📊 Summary:');
  console.log(`  Files processed: ${Object.keys(fileGroups).length}`);
  console.log(`  Files modified: ${filesModified}`);
  console.log(`  Total changes: ${allChanges.length}`);

  // Breakdown by action
  const actionCounts = allChanges.reduce((acc, change) => {
    acc[change.action] = (acc[change.action] || 0) + 1;
    return acc;
  }, {});

  console.log('\\n🔧 Changes by type:');
  Object.entries(actionCounts).forEach(([action, count]) => {
    const emoji = {
      remove_debug: '🗑️ ',
      wrap_conditional: '🔧'
    }[action] || '❓';
    console.log(`  ${emoji} ${action.replace('_', ' ')}: ${count}`);
  });

  // Sample changes
  if (allChanges.length > 0) {
    console.log('\\n📋 Sample changes:');
    allChanges.slice(0, 5).forEach(change => {
      console.log(`  ${change.file}:${change.line}`);
      console.log(`    Before: ${change.before}`);
      console.log(`    After:  ${change.after}`);
      console.log('');
    });

    if (allChanges.length > 5) {
      console.log(`  ... and ${allChanges.length - 5} more changes`);
    }
  }

  if (isDryRun) {
    console.log('\\n⚠️  This was a DRY RUN. No files were modified.');
    console.log('   Run with --execute flag to apply changes.');
  } else {
    console.log('\\n✅ Cleanup complete!');
    console.log('   Run tests to validate changes: npm run test');
    console.log('   Check TypeScript: npm run check:types');
  }

  return allChanges;
}

async function main() {
  console.log('Console Statement Cleanup Tool');
  console.log('==============================\\n');

  try {
    const changes = await executeCleanup();

    // Save cleanup report
    if (!isDryRun) {
      const reportPath = '.planning/console-cleanup-report.json';
      await writeFile(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalChanges: changes.length,
        changes
      }, null, 2));
      console.log(`\\n📄 Cleanup report saved to: ${reportPath}`);
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

main();