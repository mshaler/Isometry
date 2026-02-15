/**
 * GSD Fixer Module
 * 
 * Automatic fix patterns for common errors.
 * Applies fixes and returns result for retry.
 */

import * as fs from 'fs';
import * as path from 'path';
import { GSDConfig, ParsedError, FixResult, FixAction } from './config.js';

interface FixPattern {
  name: string;
  match: (error: ParsedError) => boolean;
  fix: (error: ParsedError, config: GSDConfig) => Promise<FixAction | null>;
}

export class Fixer {
  private patterns: FixPattern[] = [
    // Missing imports - D3
    {
      name: 'missing-d3-import',
      match: (e) => e.category === 'typescript' && 
        (e.message.includes("Cannot find name 'd3'") || 
         e.message.includes("Cannot find namespace 'd3'")),
      fix: async (e) => ({
        file: e.file,
        action: 'prepend',
        content: "import * as d3 from 'd3';\n",
      }),
    },

    // Missing imports - React
    {
      name: 'missing-react-import',
      match: (e) => e.category === 'typescript' && 
        e.message.includes("Cannot find name 'React'"),
      fix: async (e) => ({
        file: e.file,
        action: 'prepend',
        content: "import React from 'react';\n",
      }),
    },

    // Missing imports - Vitest
    {
      name: 'missing-vitest-import',
      match: (e) => e.category === 'typescript' && 
        (e.message.includes("Cannot find name 'describe'") ||
         e.message.includes("Cannot find name 'it'") ||
         e.message.includes("Cannot find name 'expect'") ||
         e.message.includes("Cannot find name 'beforeEach'") ||
         e.message.includes("Cannot find name 'afterEach'")),
      fix: async (e) => ({
        file: e.file,
        action: 'prepend',
        content: "import { describe, it, expect, beforeEach, afterEach } from 'vitest';\n",
      }),
    },

    // Missing imports - JSDOM
    {
      name: 'missing-jsdom-import',
      match: (e) => e.category === 'typescript' && 
        e.message.includes("Cannot find name 'JSDOM'"),
      fix: async (e) => ({
        file: e.file,
        action: 'prepend',
        content: "import { JSDOM } from 'jsdom';\n",
      }),
    },

    // Missing semicolon
    {
      name: 'missing-semicolon',
      match: (e) => e.code === 'TS1005' && e.message.includes("';'"),
      fix: async (e) => ({
        file: e.file,
        action: 'insert',
        line: e.line,
        column: e.column,
        content: ';',
      }),
    },

    // Unused variable (prefix with _)
    {
      name: 'unused-variable',
      match: (e) => e.code === 'no-unused-vars' || 
        (e.code === 'TS6133' && e.message.includes('declared but')),
      fix: async (e) => {
        const varMatch = e.message.match(/'(\w+)'/);
        if (!varMatch) return null;
        
        return {
          file: e.file,
          action: 'replace',
          line: e.line,
          search: new RegExp(`\\b${varMatch[1]}\\b`),
          replace: `_${varMatch[1]}`,
        };
      },
    },

    // Property does not exist - suggest type assertion
    {
      name: 'property-not-exist',
      match: (e) => e.code === 'TS2339' && e.message.includes('does not exist on type'),
      fix: async (e) => ({
        file: e.file,
        action: 'suggest',
        suggestion: `Add type assertion at ${e.file}:${e.line} or extend the type definition`,
      }),
    },

    // Type not assignable - suggest type assertion
    {
      name: 'type-not-assignable',
      match: (e) => e.code === 'TS2322' && e.message.includes('is not assignable'),
      fix: async (e) => ({
        file: e.file,
        action: 'suggest',
        suggestion: `Consider type assertion or fixing types at ${e.file}:${e.line}`,
      }),
    },

    // Object possibly null/undefined
    {
      name: 'possibly-null',
      match: (e) => e.code === 'TS2531' || e.code === 'TS2532' ||
        (e.message.includes('possibly') && (e.message.includes('null') || e.message.includes('undefined'))),
      fix: async (e) => ({
        file: e.file,
        action: 'suggest',
        suggestion: `Add optional chaining (?.) or null check at ${e.file}:${e.line}`,
      }),
    },

    // Module not found
    {
      name: 'module-not-found',
      match: (e) => e.code === 'TS2307' && e.message.includes('Cannot find module'),
      fix: async (e) => {
        const moduleMatch = e.message.match(/Cannot find module '([^']+)'/);
        if (!moduleMatch) return null;

        // Check if it's a local module vs npm package
        const moduleName = moduleMatch[1];
        if (moduleName.startsWith('.') || moduleName.startsWith('@/')) {
          return {
            file: e.file,
            action: 'suggest',
            suggestion: `Create missing module '${moduleName}' or fix import path`,
          };
        }

        return {
          file: e.file,
          action: 'suggest',
          suggestion: `Run: npm install ${moduleName}`,
        };
      },
    },

    // Expected expression
    {
      name: 'expected-expression',
      match: (e) => e.code === 'TS1109' && e.message.includes('Expression expected'),
      fix: async (e) => ({
        file: e.file,
        action: 'suggest',
        suggestion: `Syntax error at ${e.file}:${e.line}:${e.column} - check for missing/extra tokens`,
      }),
    },

    // ============================================
    // ISOMETRY-SPECIFIC PATTERNS (D3, SuperStack)
    // ============================================

    // Missing D3 selection type
    {
      name: 'missing-d3-selection-type',
      match: (e) => e.category === 'typescript' &&
        e.message.includes("Property") && e.message.includes("does not exist on type 'Selection'"),
      fix: async (e) => ({
        file: e.file,
        action: 'suggest',
        suggestion: `Add proper D3 selection typing. Use: d3.Selection<SVGGElement, unknown, HTMLElement, any>`,
      }),
    },

    // Missing LATCH axis type
    {
      name: 'missing-latch-type',
      match: (e) => e.category === 'typescript' &&
        (e.message.includes("'LATCHAxis'") || e.message.includes("'LATCH'")),
      fix: async (e) => ({
        file: e.file,
        action: 'prepend',
        content: "import { LATCHAxis } from '@/types/latch';\n",
      }),
    },

    // Missing GRAPH edge type
    {
      name: 'missing-graph-type',
      match: (e) => e.category === 'typescript' &&
        (e.message.includes("'GRAPHEdgeType'") || e.message.includes("'EdgeType'")),
      fix: async (e) => ({
        file: e.file,
        action: 'prepend',
        content: "import { GRAPHEdgeType } from '@/types/graph';\n",
      }),
    },

    // Missing SuperStack types
    {
      name: 'missing-superstack-types',
      match: (e) => e.category === 'typescript' &&
        (e.message.includes("'HeaderNode'") || 
         e.message.includes("'HeaderTree'") ||
         e.message.includes("'SuperStackConfig'")),
      fix: async (e) => ({
        file: e.file,
        action: 'prepend',
        content: "import { HeaderNode, HeaderTree, SuperStackConfig } from '@/types/superstack';\n",
      }),
    },

    // D3 datum type mismatch
    {
      name: 'd3-datum-type',
      match: (e) => e.category === 'typescript' &&
        e.message.includes('Argument of type') && e.message.includes('datum'),
      fix: async (e) => ({
        file: e.file,
        action: 'suggest',
        suggestion: `D3 datum type mismatch at ${e.file}:${e.line}. Use .datum<YourType>() or add type parameter to .data<YourType[]>()`,
      }),
    },

    // SQLite query type
    {
      name: 'sqlite-query-type',
      match: (e) => e.category === 'typescript' &&
        (e.message.includes("'QueryExecResult'") || e.message.includes("'SqlJsStatic'")),
      fix: async (e) => ({
        file: e.file,
        action: 'prepend',
        content: "import type { QueryExecResult, SqlJsStatic } from 'sql.js';\n",
      }),
    },

    // Missing async/await
    {
      name: 'missing-await',
      match: (e) => e.category === 'typescript' &&
        e.message.includes("'Promise<") && e.message.includes('is not assignable'),
      fix: async (e) => ({
        file: e.file,
        action: 'suggest',
        suggestion: `Missing await at ${e.file}:${e.line}. Add 'await' before the async call or change return type to Promise<T>`,
      }),
    },

    // Missing React hooks import
    {
      name: 'missing-react-hooks',
      match: (e) => e.category === 'typescript' &&
        (e.message.includes("Cannot find name 'useState'") ||
         e.message.includes("Cannot find name 'useEffect'") ||
         e.message.includes("Cannot find name 'useCallback'") ||
         e.message.includes("Cannot find name 'useMemo'") ||
         e.message.includes("Cannot find name 'useRef'")),
      fix: async (e) => ({
        file: e.file,
        action: 'prepend',
        content: "import { useState, useEffect, useCallback, useMemo, useRef } from 'react';\n",
      }),
    },

    // Test assertion helpers
    {
      name: 'missing-test-matchers',
      match: (e) => e.category === 'typescript' &&
        (e.message.includes("'toBeInTheDocument'") ||
         e.message.includes("'toHaveClass'") ||
         e.message.includes("'toHaveAttribute'")),
      fix: async (e) => ({
        file: e.file,
        action: 'prepend',
        content: "import '@testing-library/jest-dom';\n",
      }),
    },
  ];

  constructor(private config: GSDConfig) {}

  /**
   * Attempt to automatically fix errors
   */
  async attemptFix(category: string, errors: ParsedError[]): Promise<FixResult> {
    // Try to fix first fixable error
    for (const error of errors) {
      for (const pattern of this.patterns) {
        if (pattern.match(error)) {
          const action = await pattern.fix(error, this.config);

          if (action && action.action !== 'suggest') {
            try {
              const applied = await this.applyFix(action);
              if (applied) {
                return {
                  applied: true,
                  fixType: pattern.name,
                  filesModified: [action.file],
                };
              }
            } catch (e) {
              console.error(`Failed to apply fix ${pattern.name}:`, e);
            }
          } else if (action?.action === 'suggest') {
            return {
              applied: false,
              filesModified: [],
              suggestion: action.suggestion,
            };
          }
        }
      }
    }

    // No automatic fix available
    return {
      applied: false,
      filesModified: [],
      suggestion: this.generateSuggestion(errors),
    };
  }

  /**
   * Apply a fix action to a file
   */
  private async applyFix(action: FixAction): Promise<boolean> {
    const filePath = path.resolve(this.config.projectRoot, action.file);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    switch (action.action) {
      case 'prepend': {
        // Check if import already exists
        if (action.content && content.includes(action.content.trim())) {
          return false;
        }
        content = action.content + content;
        break;
      }

      case 'append': {
        content = content + action.content;
        break;
      }

      case 'insert': {
        const lines = content.split('\n');
        const lineIdx = (action.line || 1) - 1;
        const col = (action.column || 0);
        
        if (lines[lineIdx]) {
          const line = lines[lineIdx];
          lines[lineIdx] = line.slice(0, col) + (action.content || '') + line.slice(col);
        }
        content = lines.join('\n');
        break;
      }

      case 'replace': {
        if (action.search && action.replace !== undefined) {
          const lines = content.split('\n');
          const lineIdx = (action.line || 1) - 1;
          
          if (lines[lineIdx]) {
            if (action.search instanceof RegExp) {
              lines[lineIdx] = lines[lineIdx].replace(action.search, action.replace);
            } else {
              lines[lineIdx] = lines[lineIdx].replace(action.search, action.replace);
            }
          }
          content = lines.join('\n');
        }
        break;
      }

      case 'prefix': {
        if (action.search && action.replace) {
          content = content.replace(
            new RegExp(`\\b${action.search}\\b`, 'g'),
            action.replace
          );
        }
        break;
      }

      default:
        return false;
    }

    fs.writeFileSync(filePath, content);
    return true;
  }

  /**
   * Generate suggestion when no automatic fix is available
   */
  private generateSuggestion(errors: ParsedError[]): string {
    const byCategory = new Map<string, ParsedError[]>();
    
    for (const error of errors) {
      const existing = byCategory.get(error.category) || [];
      existing.push(error);
      byCategory.set(error.category, existing);
    }

    const suggestions: string[] = [];

    for (const [category, errs] of byCategory) {
      const files = [...new Set(errs.map(e => e.file).filter(Boolean))];
      
      switch (category) {
        case 'typescript':
          suggestions.push(`TypeScript errors in: ${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''}`);
          break;
        case 'eslint':
          suggestions.push(`ESLint issues: ${errs.length} violations`);
          break;
        case 'test':
          suggestions.push(`Test failures: ${errs.length} tests`);
          break;
        default:
          suggestions.push(`${errs.length} ${category} errors`);
      }
    }

    return suggestions.join('; ');
  }

  /**
   * Get list of available fix patterns
   */
  getAvailablePatterns(): string[] {
    return this.patterns.map(p => p.name);
  }
}
