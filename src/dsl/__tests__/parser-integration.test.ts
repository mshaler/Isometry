// ============================================================================
// DSL Parser Integration Tests
// ============================================================================
// Tests the PEG.js generated parser integration
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../parser';

describe('DSL Parser Integration', () => {
  describe('basic parsing', () => {
    it('should parse simple field:value filters', () => {
      const ast = parse('status:active');
      expect(ast).toEqual({
        type: 'filter',
        field: 'status',
        operator: '=',
        value: 'active'
      });
    });

    it('should parse comparison operators', () => {
      const ast = parse('priority:>3');
      expect(ast).toEqual({
        type: 'filter',
        field: 'priority',
        operator: '>',
        value: 3
      });
    });

    it('should parse quoted strings', () => {
      const ast = parse('name:"hello world"');
      expect(ast).toEqual({
        type: 'filter',
        field: 'name',
        operator: '=',
        value: 'hello world'
      });
    });

    it('should return null for empty input', () => {
      expect(parse('')).toBeNull();
      expect(parse('   ')).toBeNull();
    });
  });

  describe('boolean logic', () => {
    it('should parse AND expressions', () => {
      const ast = parse('status:active AND priority:high');
      expect(ast).toEqual({
        type: 'and',
        left: {
          type: 'filter',
          field: 'status',
          operator: '=',
          value: 'active'
        },
        right: {
          type: 'filter',
          field: 'priority',
          operator: '=',
          value: 'high'
        }
      });
    });

    it('should parse OR expressions', () => {
      const ast = parse('status:active OR status:pending');
      expect(ast).toEqual({
        type: 'or',
        left: {
          type: 'filter',
          field: 'status',
          operator: '=',
          value: 'active'
        },
        right: {
          type: 'filter',
          field: 'status',
          operator: '=',
          value: 'pending'
        }
      });
    });

    it('should parse NOT expressions', () => {
      const ast = parse('NOT status:archived');
      expect(ast).toEqual({
        type: 'not',
        operand: {
          type: 'filter',
          field: 'status',
          operator: '=',
          value: 'archived'
        }
      });
    });

    it('should handle parentheses for grouping', () => {
      const ast = parse('(status:active OR status:pending) AND priority:high');
      expect(ast).toEqual({
        type: 'and',
        left: {
          type: 'group',
          expression: {
            type: 'or',
            left: {
              type: 'filter',
              field: 'status',
              operator: '=',
              value: 'active'
            },
            right: {
              type: 'filter',
              field: 'status',
              operator: '=',
              value: 'pending'
            }
          }
        },
        right: {
          type: 'filter',
          field: 'priority',
          operator: '=',
          value: 'high'
        }
      });
    });
  });

  describe('LATCH axis shortcuts', () => {
    it('should parse @location axis filters', () => {
      const ast = parse('@location:home');
      expect(ast).toEqual({
        type: 'axis',
        axis: 'location',
        value: 'home'
      });
    });

    it('should parse @time axis filters', () => {
      const ast = parse('@time:today');
      expect(ast).toEqual({
        type: 'axis',
        axis: 'time',
        value: { preset: 'today' }
      });
    });

    it('should parse @category axis filters', () => {
      const ast = parse('@category:work');
      expect(ast).toEqual({
        type: 'axis',
        axis: 'category',
        value: 'work'
      });
    });
  });

  describe('time presets', () => {
    it('should parse time preset values', () => {
      const ast = parse('due:last-week');
      expect(ast).toEqual({
        type: 'filter',
        field: 'due',
        operator: '=',
        value: { preset: 'last-week' }
      });
    });

    it('should parse overdue preset', () => {
      const ast = parse('due:overdue');
      expect(ast).toEqual({
        type: 'filter',
        field: 'due',
        operator: '=',
        value: { preset: 'overdue' }
      });
    });
  });

  describe('complex expressions', () => {
    it('should parse complex boolean combinations', () => {
      const ast = parse('status:active AND (priority:>3 OR category:urgent) AND NOT archived:true');
      expect(ast).toBeDefined();
      expect(ast?.type).toBe('and');
    });

    it('should handle operator precedence correctly', () => {
      // AND should bind tighter than OR
      const ast = parse('a:1 OR b:2 AND c:3');
      expect(ast?.type).toBe('or');
      if (ast?.type === 'or') {
        expect(ast.right.type).toBe('and');
      }
    });
  });

  describe('error handling', () => {
    it('should throw ParseError for invalid syntax', () => {
      expect(() => parse('status:')).toThrow();
      expect(() => parse(':value')).toThrow();
      expect(() => parse('status AND')).toThrow();
    });

    it('should provide useful error messages', () => {
      try {
        parse('status:');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
        // Should be our ParseError interface with helpful properties
        if (typeof error === 'object' && error !== null && 'message' in error) {
          expect(error.message).toBeTruthy();
        }
      }
    });
  });
});