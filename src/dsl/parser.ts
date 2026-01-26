// ============================================================================
// Isometry DSL Parser
// ============================================================================
// Parses DSL strings into AST using PEG.js generated parser
//
// Usage:
//   import { parse } from '@/dsl/parser';
//   const ast = parse('status:active AND priority:>3');
// ============================================================================

import type { ASTNode, ParseError } from './types';

// Import the generated PEG.js parser (CommonJS format)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pegParser = require('./grammar/parser.cjs');

/**
 * Parse a DSL string into an AST
 * @param input DSL query string
 * @returns Parsed AST or null for empty input
 * @throws ParseError if input is invalid
 */
export function parse(input: string): ASTNode | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    // Use the generated PEG.js parser
    return pegParser.parse(trimmed);
  } catch (error: unknown) {
    // Transform PEG.js error to our ParseError interface
    if (error && typeof error === 'object' && 'location' in error) {
      const pegError = error as {
        message: string;
        location?: { start?: { line: number; column: number } };
        expected?: Array<{ description: string }>;
        found?: string;
      };

      throw {
        message: pegError.message,
        position: pegError.location?.start?.column || 0,
        line: pegError.location?.start?.line || 1,
        column: pegError.location?.start?.column || 1,
        expected: pegError.expected?.map(e => e.description) || [],
        found: pegError.found || ''
      } as ParseError;
    }

    // Fallback for unknown error types
    throw {
      message: error instanceof Error ? error.message : 'Parse error',
      position: 0,
      line: 1,
      column: 1,
      expected: [],
      found: trimmed
    } as ParseError;
  }
}

/**
 * Validate that all fields in AST exist in schema
 * @param ast Parsed AST
 * @param schema Available field names
 * @returns Array of validation errors
 */
export function validate(ast: ASTNode, schema: string[]): string[] {
  const errors: string[] = [];
  
  function walk(node: ASTNode) {
    switch (node.type) {
      case 'filter':
        if (!schema.includes(node.field)) {
          errors.push(`Unknown field: ${node.field}`);
        }
        break;
      case 'and':
      case 'or':
        walk(node.left);
        walk(node.right);
        break;
      case 'not':
        walk(node.operand);
        break;
      case 'group':
        walk(node.expression);
        break;
    }
  }
  
  if (ast) walk(ast);
  return errors;
}
