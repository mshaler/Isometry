#!/usr/bin/env node

/**
 * Directory Health Check (Level 9)
 * 
 * Prevents junk-drawer accumulation in shared directories.
 * Run as: node scripts/check-directory-health.mjs
 * 
 * Thresholds are intentionally tight — if a directory exceeds its limit,
 * it's a signal to extract a focused module or consolidate files.
 */

import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ============================================================================
// Configuration: directory → max file count
// ============================================================================

const LIMITS = {
  'src/utils':      30,   // Currently ~45 — will fail initially (cleanup target)
  'src/hooks':      35,   // Currently ~50 — will fail initially (cleanup target)
  'src/components': 65,   // Top-level components only (subdirs don't count) — bumped from 60 for Phase 58 additions
  'src/services':   15,   // Should stay focused
  'src/types':      25,   // Type files should be consolidated
};

// Files to exclude from count
const EXCLUDE_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /\.d\.ts$/,
  /^__tests__$/,
  /^\.DS_Store$/,
  /^index\.ts$/,
];

// ============================================================================
// Check logic
// ============================================================================

function countFiles(dirPath) {
  const fullPath = join(ROOT, dirPath);
  
  try {
    const entries = readdirSync(fullPath);
    return entries.filter(entry => {
      // Skip excluded patterns
      if (EXCLUDE_PATTERNS.some(p => p.test(entry))) return false;
      
      // Only count files, not subdirectories
      const stat = statSync(join(fullPath, entry));
      return stat.isFile();
    }).length;
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Directory doesn't exist — that's fine (might not be created yet)
      return 0;
    }
    throw err;
  }
}

// ============================================================================
// Run checks
// ============================================================================

let hasFailure = false;
let hasWarning = false;

console.log('Directory Health Check');
console.log('='.repeat(60));

for (const [dir, limit] of Object.entries(LIMITS)) {
  const count = countFiles(dir);
  const ratio = count / limit;
  
  let status;
  if (count > limit) {
    status = `❌ OVER LIMIT (${count}/${limit})`;
    hasFailure = true;
  } else if (ratio > 0.8) {
    status = `⚠️  APPROACHING (${count}/${limit})`;
    hasWarning = true;
  } else {
    status = `✅ OK (${count}/${limit})`;
  }
  
  console.log(`  ${dir.padEnd(25)} ${status}`);
}

console.log('='.repeat(60));

if (hasFailure) {
  console.log('\n❌ Directory health check FAILED.');
  console.log('   Directories over limit need cleanup:');
  console.log('   - Extract focused modules from junk-drawer directories');
  console.log('   - Consolidate related files into subdirectories');
  console.log('   - Move test utilities to __tests__/ subdirs');
  process.exit(1);
} else if (hasWarning) {
  console.log('\n⚠️  Some directories approaching limits. Plan cleanup soon.');
  process.exit(0);
} else {
  console.log('\n✅ All directories within healthy limits.');
  process.exit(0);
}
