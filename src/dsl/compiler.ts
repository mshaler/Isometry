// ============================================================================
// Isometry DSL Compiler
// ============================================================================
// Compiles AST to SQL WHERE clause
//
// Usage:
//   import { compile } from '@/dsl/compiler';
//   const { sql, params } = compile(ast);
// ============================================================================

import type { ASTNode, CompiledQuery, FilterOperator, TimePreset } from './types';

/**
 * Compile AST to SQL WHERE clause with parameterized values
 * @param ast Parsed AST
 * @returns SQL string and parameter values
 */
export function compile(ast: ASTNode | null): CompiledQuery {
  if (!ast) {
    return { sql: '1=1', params: [] };
  }
  
  const params: (string | number | boolean)[] = [];
  
  function compileNode(node: ASTNode): string {
    switch (node.type) {
      case 'filter':
        return compileFilter(node.field, node.operator, node.value);
      
      case 'axis':
        return compileAxisFilter(node.axis, node.value);
      
      case 'and':
        return `(${compileNode(node.left)} AND ${compileNode(node.right)})`;
      
      case 'or':
        return `(${compileNode(node.left)} OR ${compileNode(node.right)})`;
      
      case 'not':
        return `NOT (${compileNode(node.operand)})`;
      
      case 'group':
        return `(${compileNode(node.expression)})`;
      
      default:
        return '1=1';
    }
  }
  
  function compileFilter(field: string, operator: FilterOperator, value: any): string {
    // Handle time presets
    if (typeof value === 'object' && 'preset' in value) {
      return compileTimePreset(field, value.preset);
    }
    
    // Handle LIKE operator
    if (operator === '~') {
      params.push(`%${value}%`);
      return `${field} LIKE ?`;
    }
    
    // Handle standard operators
    const sqlOp = operator === '=' ? '=' : operator;
    params.push(value);
    return `${field} ${sqlOp} ?`;
  }
  
  function compileAxisFilter(axis: string, value: any): string {
    // Map LATCH axes to SQL
    switch (axis) {
      case 'time':
        if (typeof value === 'object' && 'preset' in value) {
          return compileTimePreset('created', value.preset);
        }
        params.push(value);
        return `created = ?`;
      
      case 'category':
        params.push(value);
        return `category = ?`;
      
      case 'hierarchy':
        params.push(value);
        return `priority <= ?`;
      
      case 'alphabet':
        // Handle ranges like A-M
        if (typeof value === 'string' && value.includes('-')) {
          const [start, end] = value.split('-');
          return `SUBSTR(name, 1, 1) BETWEEN '${start}' AND '${end}'`;
        }
        params.push(`${value}%`);
        return `name LIKE ?`;
      
      case 'location':
        params.push(value);
        return `location = ?`;
      
      default:
        return '1=1';
    }
  }
  
  function compileTimePreset(field: string, preset: TimePreset): string {
    switch (preset) {
      case 'today':
        return `date(${field}) = date('now')`;
      case 'yesterday':
        return `date(${field}) = date('now', '-1 day')`;
      case 'last-week':
      case 'last-7-days':
        return `${field} >= date('now', '-7 days')`;
      case 'last-month':
      case 'last-30-days':
        return `${field} >= date('now', '-30 days')`;
      case 'this-year':
        return `${field} >= date('now', 'start of year')`;
      case 'next-week':
        return `${field} <= date('now', '+7 days')`;
      case 'overdue':
        return `${field} < date('now')`;
      default:
        return '1=1';
    }
  }
  
  return {
    sql: compileNode(ast),
    params
  };
}

/**
 * Convenience function: parse + compile in one step
 */
export function compileString(dsl: string): CompiledQuery {
  // Import dynamically to avoid circular dependency
  const { parse } = require('./parser');
  const ast = parse(dsl);
  return compile(ast);
}
