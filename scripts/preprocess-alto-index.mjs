#!/usr/bin/env node
/**
 * Preprocess Alto-Index Files
 *
 * Scans the alto-index directory and outputs a JSON file that can be
 * loaded by the browser for SuperGrid testing.
 *
 * Usage:
 *   node scripts/preprocess-alto-index.mjs [options]
 *
 * Options:
 *   --limit=N     Maximum number of files to process (default: all)
 *   --types=a,b   Data types to include (default: all)
 *   --output=path Output file path (default: public/alto-index.json)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALTO_INDEX_PATH = '/Users/mshaler/Library/Containers/com.altoindex.AltoIndex/Data/Documents/alto-index';
const DEFAULT_OUTPUT = path.join(__dirname, '..', 'public', 'alto-index.json');

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: null,
    types: null,
    output: DEFAULT_OUTPUT,
    verbose: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.slice(8), 10);
    } else if (arg.startsWith('--types=')) {
      options.types = arg.slice(8).split(',');
    } else if (arg.startsWith('--output=')) {
      options.output = arg.slice(9);
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    }
  }

  return options;
}

// ============================================================================
// File Discovery
// ============================================================================

function* findMarkdownFiles(dir, recursive = true) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && recursive) {
      // Skip hidden directories
      if (!entry.name.startsWith('.')) {
        yield* findMarkdownFiles(fullPath, recursive);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Skip CLAUDE.md and README files
      if (entry.name !== 'CLAUDE.md' && !entry.name.toLowerCase().startsWith('readme')) {
        yield fullPath;
      }
    }
  }
}

function detectDataType(filePath) {
  if (filePath.includes('/notes/')) return 'notes';
  if (filePath.includes('/contacts/')) return 'contacts';
  if (filePath.includes('/messages/')) return 'messages';
  if (filePath.includes('/calendar/')) return 'calendar';
  if (filePath.includes('/reminders/')) return 'reminders';
  if (filePath.includes('/safari-history/')) return 'safari-history';
  if (filePath.includes('/safari-bookmarks/')) return 'safari-bookmarks';
  if (filePath.includes('/voice-memos/')) return 'voice-memos';
  return 'unknown';
}

// ============================================================================
// Main Processing
// ============================================================================

async function main() {
  const options = parseArgs();
  console.log('🔍 Preprocessing alto-index files...');
  console.log(`   Source: ${ALTO_INDEX_PATH}`);
  console.log(`   Output: ${options.output}`);
  if (options.limit) console.log(`   Limit: ${options.limit}`);
  if (options.types) console.log(`   Types: ${options.types.join(', ')}`);

  const startTime = Date.now();
  const files = [];
  const stats = {};
  let processed = 0;
  let skipped = 0;

  // Discover all markdown files
  console.log('\n📂 Scanning directories...');
  const allPaths = [...findMarkdownFiles(ALTO_INDEX_PATH)];
  console.log(`   Found ${allPaths.length} markdown files`);

  // If limit is set, shuffle files to get diverse sample across types
  let pathsToProcess = allPaths;
  if (options.limit && options.limit < allPaths.length) {
    console.log('   Shuffling for diverse sample...');
    // Fisher-Yates shuffle
    const shuffled = [...allPaths];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    pathsToProcess = shuffled;
  }

  // Process files
  console.log('\n📄 Processing files...');

  for (const filePath of pathsToProcess) {
    // Check limit
    if (options.limit && processed >= options.limit) {
      break;
    }

    // Check type filter
    const dataType = detectDataType(filePath);
    if (options.types && !options.types.includes(dataType)) {
      skipped++;
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = filePath.replace(ALTO_INDEX_PATH, '');

      files.push({
        path: relativePath,
        content,
        type: dataType,
      });

      // Track stats
      stats[dataType] = (stats[dataType] || 0) + 1;
      processed++;

      // Progress indicator
      if (processed % 500 === 0) {
        console.log(`   Processed ${processed} files...`);
      }
    } catch (error) {
      if (options.verbose) {
        console.warn(`   Warning: Could not read ${filePath}: ${error.message}`);
      }
      skipped++;
    }
  }

  // Write output
  console.log('\n💾 Writing output file...');
  const output = {
    version: 1,
    generated: new Date().toISOString(),
    source: ALTO_INDEX_PATH,
    stats,
    files,
  };

  // Ensure output directory exists
  const outputDir = path.dirname(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(options.output, JSON.stringify(output, null, 2));

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const fileSize = (fs.statSync(options.output).size / 1024 / 1024).toFixed(2);

  // Summary
  console.log('\n✅ Preprocessing complete!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   Files processed: ${processed}`);
  console.log(`   Files skipped: ${skipped}`);
  console.log(`   Output size: ${fileSize} MB`);
  console.log(`   Duration: ${duration}s`);
  console.log('');
  console.log('📈 By type:');
  for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${type}: ${count}`);
  }
  console.log('');
  console.log(`📁 Output saved to: ${options.output}`);
}

main().catch(console.error);
