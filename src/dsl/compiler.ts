// ============================================================================
// Isometry DSL Compiler
// ============================================================================
// Compiles AST to SQL WHERE clause
//
// Usage:
//   import { compile } from '@/dsl/compiler';
//   const { sql, params } = compile(ast);
// ============================================================================

import type { ASTNode, CompiledQuery, FilterOperator, TimePreset, FilterValue } from './types';
import {
  sanitizeDSLValue,
  sanitizeFieldName,
  sanitizeOperator,
  isSecurityRisk
} from '../utils/input-sanitization';

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
  
  function compileFilter(field: string, operator: FilterOperator, value: FilterValue): string {
    // Validate and sanitize field name
    const fieldValidation = sanitizeFieldName(field);
    if (!fieldValidation.isValid || isSecurityRisk(fieldValidation)) {
      throw new Error(`Invalid field name: ${fieldValidation.errors.join(', ')}`);
    }
    const safeField = fieldValidation.sanitizedValue as string;

    // Validate and sanitize operator
    const operatorValidation = sanitizeOperator(operator);
    if (!operatorValidation.isValid) {
      throw new Error(`Invalid operator: ${operatorValidation.errors.join(', ')}`);
    }
    const safeOperator = operatorValidation.sanitizedValue as string;

    // Validate and sanitize value
    const valueValidation = sanitizeDSLValue(value);
    if (!valueValidation.isValid || isSecurityRisk(valueValidation)) {
      throw new Error(`Invalid filter value: ${valueValidation.errors.join(', ')}`);
    }
    const safeValue = valueValidation.sanitizedValue;

    // Handle time presets
    if (typeof safeValue === 'object' && safeValue && 'preset' in safeValue) {
      return compileTimePreset(safeField, (safeValue as { preset: TimePreset }).preset);
    }

    // Handle LIKE operator
    if (safeOperator === '~') {
      params.push(`%${safeValue}%`);
      return `${safeField} LIKE ?`;
    }

    // Handle standard operators
    params.push(safeValue);
    return `${safeField} ${safeOperator} ?`;
  }
  
  function compileAxisFilter(axis: string, value: FilterValue): string {
    // Validate axis name
    const allowedAxes = ['time', 'category', 'hierarchy', 'alphabet', 'location'];
    if (!allowedAxes.includes(axis)) {
      throw new Error(`Invalid axis: ${axis}`);
    }

    // Validate and sanitize value
    const valueValidation = sanitizeDSLValue(value);
    if (!valueValidation.isValid || isSecurityRisk(valueValidation)) {
      throw new Error(`Invalid axis value: ${valueValidation.errors.join(', ')}`);
    }
    const safeValue = valueValidation.sanitizedValue;

    // Map LATCH axes to SQL
    switch (axis) {
      case 'time':
        if (typeof safeValue === 'object' && safeValue && 'preset' in safeValue) {
          return compileTimePreset('created', (safeValue as { preset: TimePreset }).preset);
        }
        params.push(safeValue);
        return `created = ?`;

      case 'category':
        params.push(safeValue);
        return `category = ?`;

      case 'hierarchy':
        params.push(safeValue);
        return `priority <= ?`;

      case 'alphabet':
        // Handle ranges like A-M with proper parameterization
        if (typeof safeValue === 'string' && safeValue.includes('-')) {
          const rangeParts = safeValue.split('-');
          if (rangeParts.length !== 2) {
            throw new Error('Invalid alphabet range format');
          }

          const [start, end] = rangeParts;

          // Validate range characters (single uppercase letters only)
          if (!/^[A-Z]$/.test(start) || !/^[A-Z]$/.test(end)) {
            throw new Error('Alphabet range must be single uppercase letters (A-Z)');
          }

          // Use parameterized query for range
          params.push(start);
          params.push(end);
          return `SUBSTR(name, 1, 1) BETWEEN ? AND ?`;
        }

        params.push(`${safeValue}%`);
        return `name LIKE ?`;

      case 'location':
        params.push(safeValue);
        return `location = ?`;

      default:
        return '1=1';
    }
  }
  
  function compileTimePreset(field: string, preset: TimePreset): string {
    // Validate field name for SQL injection
    const fieldValidation = sanitizeFieldName(field);
    if (!fieldValidation.isValid || isSecurityRisk(fieldValidation)) {
      throw new Error(`Invalid time field name: ${fieldValidation.errors.join(', ')}`);
    }
    const safeField = fieldValidation.sanitizedValue as string;

    // Validate preset value
    const allowedPresets = [
      'today', 'yesterday', 'last-week', 'last-7-days',
      'last-month', 'last-30-days', 'this-year', 'next-week', 'overdue'
    ] as const;

    if (!allowedPresets.includes(preset as typeof allowedPresets[number])) {
      throw new Error(`Invalid time preset: ${preset}`);
    }

    switch (preset) {
      case 'today':
        return `date(${safeField}) = date('now')`;
      case 'yesterday':
        return `date(${safeField}) = date('now', '-1 day')`;
      case 'last-week':
      case 'last-7-days':
        return `${safeField} >= date('now', '-7 days')`;
      case 'last-month':
      case 'last-30-days':
        return `${safeField} >= date('now', '-30 days')`;
      case 'this-year':
        return `${safeField} >= date('now', 'start of year')`;
      case 'next-week':
        return `${safeField} <= date('now', '+7 days')`;
      case 'overdue':
        return `${safeField} < date('now')`;
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
export async function compileString(dsl: string): Promise<CompiledQuery> {
  // Import dynamically to avoid circular dependency
  const { parse } = await import('./parser');
  const ast = parse(dsl);
  return compile(ast);
}
