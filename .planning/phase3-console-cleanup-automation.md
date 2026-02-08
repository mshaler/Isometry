# Phase 3: Automated Console Cleanup Implementation Plan

**Created:** 2026-02-07
**Context:** 946 console statements identified across codebase
**Goal:** Implement automated tooling to efficiently clean debug artifacts while preserving legitimate logging

## Current State Analysis

### Console Statement Breakdown
- **946 total statements** across codebase
- **477 console.log** - Mostly debug artifacts (🎯 primary target)
- **225 console.error** - Legitimate error reporting (✅ preserve)
- **207 console.warn** - Mixed legitimacy (🔍 case-by-case review)
- **37 others** - debug, info, group utilities

### Manual Progress So Far
- ✅ **SuperGrid.ts**: 41 → 27 statements (-14 debug artifacts removed)
- ✅ **Patterns established**: Remove emoji-prefixed debug logs, keep error reporting
- ⏱️ **Time estimate for manual**: ~8 hours for remaining 931 statements

## Implementation Strategy

### 1. ESLint Rules for Debug Pattern Detection

#### 1.1 Custom ESLint Rule: `no-debug-console`

Create custom rule to flag debug console patterns:

```javascript
// .eslint/rules/no-debug-console.js
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow debug console statements with emoji patterns',
      category: 'Best Practices',
    },
    fixable: 'code',
    schema: []
  },

  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'console' &&
          node.callee.property.name === 'log' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'Literal'
        ) {
          const message = node.arguments[0].value;

          // Flag emoji-prefixed debug patterns
          const emojiPattern = /^[🔍🔄👆🎨📊🗂️🏗️📋📏🎯✅⚠️]/;
          if (typeof message === 'string' && emojiPattern.test(message)) {
            context.report({
              node,
              message: 'Debug console.log with emoji pattern should be removed or made conditional',
              fix: function(fixer) {
                // Auto-fix: wrap in DEV check
                const sourceCode = context.getSourceCode();
                const nodeText = sourceCode.getText(node);
                return fixer.replaceText(node, `if (import.meta.env.DEV) { ${nodeText}; }`);
              }
            });
          }
        }
      }
    };
  }
};
```

#### 1.2 ESLint Configuration Update

```javascript
// .eslintrc.js - add custom rule
module.exports = {
  // ... existing config
  plugins: ['./eslint/rules'],
  rules: {
    // ... existing rules
    'no-debug-console': 'warn', // Start with warnings
    'no-console': 'off' // Disable general no-console since we have targeted rule
  }
};
```

### 2. Batch Processing Script for Regex-Based Cleanup

#### 2.1 Console Pattern Analysis Script

```typescript
// scripts/analyze-console-patterns.ts
import { glob } from 'glob';
import { readFile } from 'fs/promises';

interface ConsoleStatement {
  file: string;
  line: number;
  type: 'log' | 'error' | 'warn' | 'debug' | 'info';
  content: string;
  category: 'debug_artifact' | 'legitimate_error' | 'performance_monitor' | 'unknown';
}

const DEBUG_PATTERNS = [
  /console\.log\(['"`][🔍🔄👆🎨📊🗂️🏗️📋📏🎯✅⚠️]/,  // Emoji prefixed
  /console\.log\(['"`]\[.*?\].*:['"`]/,                    // Bracketed service logs
  /console\.log\(['"`].*debug.*['"`]/i,                    // Contains "debug"
];

const LEGITIMATE_PATTERNS = [
  /console\.error\(/,                                      // Error reporting
  /console\.warn\(['"`]Failed to/,                        // Failure warnings
  /console\.warn\(['"`].*error/i,                         // Error-related warnings
];

async function analyzeConsoleStatements(): Promise<ConsoleStatement[]> {
  const files = await glob('src/**/*.{ts,tsx}');
  const statements: ConsoleStatement[] = [];

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const consoleMatch = line.match(/console\.(log|error|warn|debug|info)/);
      if (consoleMatch) {
        const type = consoleMatch[1] as any;
        let category: ConsoleStatement['category'] = 'unknown';

        // Categorize based on patterns
        if (DEBUG_PATTERNS.some(pattern => pattern.test(line))) {
          category = 'debug_artifact';
        } else if (LEGITIMATE_PATTERNS.some(pattern => pattern.test(line))) {
          category = 'legitimate_error';
        } else if (line.includes('performance') || line.includes('metrics')) {
          category = 'performance_monitor';
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
  }

  return statements;
}

// Generate cleanup report
async function main() {
  const statements = await analyzeConsoleStatements();

  console.log('Console Statement Analysis');
  console.log('========================');
  console.log(`Total statements: ${statements.length}`);

  const byCategory = statements.reduce((acc, stmt) => {
    acc[stmt.category] = (acc[stmt.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nBy Category:');
  Object.entries(byCategory).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });

  // Save detailed report
  await writeFile('.planning/console-analysis.json', JSON.stringify(statements, null, 2));
  console.log('\nDetailed report saved to .planning/console-analysis.json');
}
```

#### 2.2 Automated Cleanup Script

```typescript
// scripts/cleanup-console-statements.ts
import { readFile, writeFile } from 'fs/promises';
import type { ConsoleStatement } from './analyze-console-patterns';

interface CleanupOptions {
  removeDebugArtifacts: boolean;
  wrapPerformanceInDev: boolean;
  dryRun: boolean;
}

const DEFAULT_OPTIONS: CleanupOptions = {
  removeDebugArtifacts: true,
  wrapPerformanceInDev: true,
  dryRun: true // Safety first
};

async function cleanupConsoleStatements(
  statements: ConsoleStatement[],
  options: CleanupOptions = DEFAULT_OPTIONS
) {
  const changes: Array<{ file: string; action: string; line: number }> = [];

  // Group by file for efficient processing
  const byFile = statements.reduce((acc, stmt) => {
    if (!acc[stmt.file]) acc[stmt.file] = [];
    acc[stmt.file].push(stmt);
    return acc;
  }, {} as Record<string, ConsoleStatement[]>);

  for (const [file, fileStatements] of Object.entries(byFile)) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');
    let modified = false;

    // Process statements in reverse order to maintain line numbers
    fileStatements
      .sort((a, b) => b.line - a.line)
      .forEach(stmt => {
        const lineIndex = stmt.line - 1;
        const originalLine = lines[lineIndex];

        if (stmt.category === 'debug_artifact' && options.removeDebugArtifacts) {
          // Replace with comment
          const indentation = originalLine.match(/^\\s*/)?.[0] || '';
          lines[lineIndex] = `${indentation}// Debug logging removed`;
          changes.push({ file, action: 'remove_debug', line: stmt.line });
          modified = true;
        } else if (stmt.category === 'performance_monitor' && options.wrapPerformanceInDev) {
          // Wrap in DEV check
          const indentation = originalLine.match(/^\\s*/)?.[0] || '';
          lines[lineIndex] = `${indentation}if (import.meta.env.DEV) {`;
          lines.splice(lineIndex + 1, 0, `${indentation}  ${originalLine.trim()}`);
          lines.splice(lineIndex + 2, 0, `${indentation}}`);
          changes.push({ file, action: 'wrap_conditional', line: stmt.line });
          modified = true;
        }
      });

    if (modified && !options.dryRun) {
      await writeFile(file, lines.join('\n'));
    }
  }

  return changes;
}

// CLI interface
async function main() {
  const analysisFile = '.planning/console-analysis.json';
  const statements = JSON.parse(await readFile(analysisFile, 'utf-8'));

  console.log('Console Cleanup Tool');
  console.log('==================');

  // Dry run first
  console.log('\\n🔍 Dry run - analyzing potential changes...');
  const dryRunChanges = await cleanupConsoleStatements(statements, {
    ...DEFAULT_OPTIONS,
    dryRun: true
  });

  console.log(`\\nPotential changes: ${dryRunChanges.length}`);
  dryRunChanges.slice(0, 10).forEach(change => {
    console.log(`  ${change.file}:${change.line} - ${change.action}`);
  });

  if (dryRunChanges.length > 10) {
    console.log(`  ... and ${dryRunChanges.length - 10} more`);
  }

  console.log('\\n⚠️  Run with --execute flag to apply changes');

  // Check for --execute flag
  if (process.argv.includes('--execute')) {
    console.log('\\n🚀 Executing cleanup...');
    const changes = await cleanupConsoleStatements(statements, {
      ...DEFAULT_OPTIONS,
      dryRun: false
    });
    console.log(`✅ Applied ${changes.length} changes`);
  }
}
```

### 3. Conditional Compilation Implementation

#### 3.1 Development Logger Utility

```typescript
// src/utils/dev-logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface DevLoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix?: string;
}

class DevLogger {
  private config: DevLoggerConfig;

  constructor(config: Partial<DevLoggerConfig> = {}) {
    this.config = {
      enabled: import.meta.env.DEV || false,
      level: 'debug',
      prefix: '',
      ...config
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;

    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.config.level);
  }

  private formatMessage(message: string): string {
    return this.config.prefix ? `${this.config.prefix} ${message}` : message;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  // Performance logging
  time(label: string): void {
    if (this.shouldLog('debug')) {
      console.time(this.formatMessage(label));
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog('debug')) {
      console.timeEnd(this.formatMessage(label));
    }
  }
}

// Create service-specific loggers
export const createLogger = (service: string) =>
  new DevLogger({ prefix: `[${service}]` });

// Common loggers
export const superGridLogger = createLogger('SuperGrid');
export const bridgeLogger = createLogger('Bridge');
export const performanceLogger = createLogger('Performance');
```

#### 3.2 Migration Pattern for Console Statements

**Before:**
```typescript
console.log('🔍 SuperGrid: Janus state changed:', { zoomLevel, panLevel });
console.error('Failed to persist card position:', result.error);
```

**After:**
```typescript
superGridLogger.debug('Janus state changed:', { zoomLevel, panLevel });
console.error('Failed to persist card position:', result.error); // Keep as-is
```

### 4. Validation and Testing Strategy

#### 4.1 Test the Automated Approach

```bash
# Step 1: Analyze current state
npm run analyze:console

# Step 2: Dry run cleanup
npm run cleanup:console --dry-run

# Step 3: Execute on test file subset
npm run cleanup:console --execute --files="src/d3/SuperGrid.ts"

# Step 4: Validate no regressions
npm run test
npm run build
npm run check:types

# Step 5: Full cleanup if tests pass
npm run cleanup:console --execute
```

#### 4.2 Quality Gates

- ✅ **Type safety**: All TypeScript compilation passes
- ✅ **Functionality**: All tests continue to pass
- ✅ **Build success**: Production builds work without console statements
- ✅ **Dev experience**: Development logging still works in dev mode
- ✅ **Bundle size**: Significant reduction in production bundle

### 5. Implementation Timeline

| Week | Task | Deliverable |
|------|------|-------------|
| 1 | ESLint rule + pattern analysis | Custom rule, console analysis report |
| 1 | Batch processing scripts | Automated cleanup tooling |
| 1 | DevLogger utility | Conditional compilation infrastructure |
| 2 | Validation on test files | Proof of concept working |
| 2 | Full codebase cleanup | 946 → ~250 console statements |
| 2 | Quality validation | All tests passing, build working |

### 6. Success Metrics

**Before:**
- 946 console statements
- Manual cleanup: ~8 hours estimated
- Production bundles include debug strings

**After:**
- ~250 legitimate console statements (errors/warnings only)
- Automated cleanup: ~2 hours total implementation + execution
- Production bundles clean of debug artifacts
- Development logging preserved with better control

---

**Next Steps:**
1. Create analysis script and run initial assessment
2. Implement ESLint rule for ongoing prevention
3. Build and test cleanup automation
4. Execute cleanup with validation at each step