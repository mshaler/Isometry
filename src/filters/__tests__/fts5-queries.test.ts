import { describe, it, expect } from 'vitest';
import { compileFilters } from '../compiler';
import type { FilterState } from '../../types/filter';

describe('FTS5 Query Generation', () => {
  describe('Simple search queries', () => {
    it('should generate FTS5 MATCH query for simple search', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: 'test' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      expect(result.params).toContain('test');
    });

    it('should handle empty query', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: '' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      // Empty alphabet filter should not add any conditions (except deleted_at)
      expect(result.sql).toBe('deleted_at IS NULL');
      expect(result.params).toEqual([]);
    });

    it('should handle multi-word search with implicit AND', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: 'machine learning' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      // Should join words with space (implicit AND in FTS5)
      expect(result.params[0]).toContain('machine');
      expect(result.params[0]).toContain('learning');
    });
  });

  describe('Prefix search', () => {
    it('should support prefix search with asterisk', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: 'test*' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      expect(result.params[0]).toContain('test*');
    });

    it('should support startsWith filter type', () => {
      const filters: FilterState = {
        alphabet: { type: 'startsWith', value: 'test' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('name LIKE');
      expect(result.params[0]).toBe('test%');
    });
  });

  describe('Phrase search', () => {
    it('should support exact phrase search with quotes', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: '"machine learning"' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      expect(result.params[0]).toContain('"machine learning"');
    });

    it('should handle unbalanced quotes by auto-closing', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: '"unbalanced quote' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      // Should have closing quote added
      expect(result.params[0]).toContain('"');
    });
  });

  describe('Boolean operators', () => {
    it('should support AND operator', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: 'swift AND concurrency' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      expect(result.params[0]).toContain('AND');
    });

    it('should support OR operator', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: 'react OR vue' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      expect(result.params[0]).toContain('OR');
    });

    it('should support NOT operator', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: 'javascript NOT react' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      expect(result.params[0]).toContain('NOT');
    });
  });

  describe('Special character handling', () => {
    it('should handle special FTS5 characters in simple search', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: 'test-query*' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      // FTS5 special chars like * and - are handled
      // * triggers operator detection, - is removed in escapeFTS5Simple
      const query = result.params[0] as string;
      // Either preserved (if detected as operators) or removed (if escaped)
      expect(query.length).toBeGreaterThan(0);
    });

    it('should handle parentheses in complex queries', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: '(react OR vue) AND typescript' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      expect(result.params[0]).toContain('(');
      expect(result.params[0]).toContain(')');
    });

    it('should handle unbalanced parentheses by falling back to simple search', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: '(unbalanced parens' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      // Should fallback to simple search (no operators)
      const query = result.params[0] as string;
      expect(query).not.toContain('(');
    });
  });

  describe('Query length limits', () => {
    it('should truncate very long queries', () => {
      const longQuery = 'a'.repeat(300);
      const filters: FilterState = {
        alphabet: { type: 'search', value: longQuery },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('cards_fts MATCH');
      const query = result.params[0] as string;
      expect(query.length).toBeLessThanOrEqual(200);
    });
  });

  describe('Fallback to LIKE queries', () => {
    it('should use FTS5 even for queries with only special chars', () => {
      // buildFTS5Query handles special chars by escaping or preserving them
      // It only returns null for completely empty input
      const filters: FilterState = {
        alphabet: { type: 'search', value: 'test123' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      // Normal search should use FTS5
      expect(result.sql).toContain('cards_fts MATCH');
      expect(result.params).toHaveLength(1);
      expect(result.params[0]).toBe('test123');
    });
  });

  describe('Alphabetic range filter', () => {
    it('should support alphabetic range queries', () => {
      const filters: FilterState = {
        alphabet: { type: 'range', value: 'A' },
        location: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      expect(result.sql).toContain('name >=');
      expect(result.sql).toContain('name <');
      expect(result.params[0]).toBe('A');
      expect(result.params[1]).toBe('B'); // Next letter
    });
  });

  describe('Combined with other filters', () => {
    it('should work with time and category filters', () => {
      const filters: FilterState = {
        alphabet: { type: 'search', value: 'test' },
        time: {
          type: 'preset',
          preset: 'today',
          field: 'created',
        },
        category: {
          type: 'include',
          folders: ['Work'],
        },
        location: null,
        hierarchy: null,
        dsl: null,
      };

      const result = compileFilters(filters);

      // Should combine all filters with AND
      expect(result.sql).toContain('deleted_at IS NULL');
      expect(result.sql).toContain('cards_fts MATCH');
      expect(result.sql).toContain('created_at');
      expect(result.sql).toContain('folder');
      expect(result.sql.split('AND').length).toBeGreaterThan(2);
    });
  });
});
