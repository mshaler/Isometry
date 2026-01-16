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

// TODO: Generate parser from PEG.js grammar
// npx pegjs src/dsl/grammar/IsometryDSL.pegjs -o src/dsl/grammar/parser.js

/**
 * Parse a DSL string into an AST
 * @param input DSL query string
 * @returns Parsed AST or null for empty input
 * @throws ParseError if input is invalid
 */
export function parse(input: string): ASTNode | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // TODO: Replace with PEG.js generated parser
  // import { parse as pegParse } from './grammar/parser';
  // return pegParse(trimmed);
  
  // Temporary stub - parse simple field:value
  const match = trimmed.match(/^(\w+):(.+)$/);
  if (match) {
    return {
      type: 'filter',
      field: match[1],
      operator: '=',
      value: match[2]
    };
  }
  
  throw {
    message: 'Parse error',
    position: 0,
    line: 1,
    column: 1,
    expected: ['field:value'],
    found: trimmed
  } as ParseError;
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
