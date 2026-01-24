import { describe, it, expect } from 'vitest';
import {
  serializeFilters,
  deserializeFilters,
  validateFilterURLLength,
  isEmptyFilters
} from '../filter-serialization';
import type { FilterState } from '../../types/filter';

describe('filter-serialization', () => {
  describe('serializeFilters', () => {
    it('should return empty string for empty filters', () => {
      const filters: FilterState = {
        location: null,
        alphabet: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      expect(serializeFilters(filters)).toBe('');
    });

    it('should serialize alphabet filter', () => {
      const filters: FilterState = {
        location: null,
        alphabet: {
          type: 'search',
          value: 'test',
        },
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      expect(serializeFilters(filters)).toBe('alphabet:search,test');
    });

    it('should URL-encode special characters in alphabet filter', () => {
      const filters: FilterState = {
        location: null,
        alphabet: {
          type: 'search',
          value: 'test & stuff',
        },
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      expect(serializeFilters(filters)).toBe('alphabet:search,test%20%26%20stuff');
    });

    it('should serialize time preset filter', () => {
      const filters: FilterState = {
        location: null,
        alphabet: null,
        time: {
          type: 'preset',
          preset: 'last-30-days',
          field: 'created',
        },
        category: null,
        hierarchy: null,
        dsl: null,
      };

      expect(serializeFilters(filters)).toBe('time:preset,last-30-days,created');
    });

    it('should serialize time range filter', () => {
      const filters: FilterState = {
        location: null,
        alphabet: null,
        time: {
          type: 'range',
          start: '2024-01-01',
          end: '2024-12-31',
          field: 'modified',
        },
        category: null,
        hierarchy: null,
        dsl: null,
      };

      expect(serializeFilters(filters)).toBe('time:range,2024-01-01,2024-12-31,modified');
    });

    it('should serialize category filter with tags', () => {
      const filters: FilterState = {
        location: null,
        alphabet: null,
        time: null,
        category: {
          type: 'include',
          tags: ['work', 'personal'],
        },
        hierarchy: null,
        dsl: null,
      };

      expect(serializeFilters(filters)).toBe('category:include,tags=work+personal');
    });

    it('should serialize category filter with multiple types', () => {
      const filters: FilterState = {
        location: null,
        alphabet: null,
        time: null,
        category: {
          type: 'exclude',
          folders: ['archive'],
          tags: ['done', 'deleted'],
          statuses: ['completed'],
        },
        hierarchy: null,
        dsl: null,
      };

      const result = serializeFilters(filters);
      expect(result).toContain('category:exclude');
      expect(result).toContain('folders=archive');
      expect(result).toContain('tags=done+deleted');
      expect(result).toContain('statuses=completed');
    });

    it('should serialize hierarchy priority filter', () => {
      const filters: FilterState = {
        location: null,
        alphabet: null,
        time: null,
        category: null,
        hierarchy: {
          type: 'priority',
          minPriority: 3,
          maxPriority: 5,
        },
        dsl: null,
      };

      expect(serializeFilters(filters)).toBe('hierarchy:priority,3-5');
    });

    it('should serialize location point filter', () => {
      const filters: FilterState = {
        location: {
          type: 'point',
          latitude: 37.7749,
          longitude: -122.4194,
        },
        alphabet: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      expect(serializeFilters(filters)).toBe('location:point,37.7749,-122.4194');
    });

    it('should serialize location radius filter', () => {
      const filters: FilterState = {
        location: {
          type: 'radius',
          centerLat: 37.7749,
          centerLon: -122.4194,
          radiusKm: 10,
        },
        alphabet: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      expect(serializeFilters(filters)).toBe('location:radius,37.7749,-122.4194,10');
    });

    it('should serialize multiple filters with semicolon separator', () => {
      const filters: FilterState = {
        location: null,
        alphabet: {
          type: 'search',
          value: 'test',
        },
        time: {
          type: 'preset',
          preset: 'last-30-days',
          field: 'created',
        },
        category: {
          type: 'include',
          tags: ['work'],
        },
        hierarchy: null,
        dsl: null,
      };

      const result = serializeFilters(filters);
      expect(result).toContain('alphabet:search,test');
      expect(result).toContain('time:preset,last-30-days,created');
      expect(result).toContain('category:include,tags=work');
      expect(result.split(';').length).toBe(3);
    });
  });

  describe('deserializeFilters', () => {
    it('should return empty filters for empty string', () => {
      const result = deserializeFilters('');
      expect(isEmptyFilters(result)).toBe(true);
    });

    it('should deserialize alphabet filter', () => {
      const result = deserializeFilters('alphabet:search,test');
      expect(result.alphabet).toEqual({
        type: 'search',
        value: 'test',
      });
    });

    it('should URL-decode special characters', () => {
      const result = deserializeFilters('alphabet:search,test%20%26%20stuff');
      expect(result.alphabet).toEqual({
        type: 'search',
        value: 'test & stuff',
      });
    });

    it('should deserialize time preset filter', () => {
      const result = deserializeFilters('time:preset,last-30-days,created');
      expect(result.time).toEqual({
        type: 'preset',
        preset: 'last-30-days',
        field: 'created',
      });
    });

    it('should deserialize time range filter', () => {
      const result = deserializeFilters('time:range,2024-01-01,2024-12-31,modified');
      expect(result.time).toEqual({
        type: 'range',
        start: '2024-01-01',
        end: '2024-12-31',
        field: 'modified',
      });
    });

    it('should deserialize category filter', () => {
      const result = deserializeFilters('category:include,tags=work+personal');
      expect(result.category).toEqual({
        type: 'include',
        tags: ['work', 'personal'],
      });
    });

    it('should deserialize hierarchy filter', () => {
      const result = deserializeFilters('hierarchy:priority,3-5');
      expect(result.hierarchy).toEqual({
        type: 'priority',
        minPriority: 3,
        maxPriority: 5,
      });
    });

    it('should deserialize location point filter', () => {
      const result = deserializeFilters('location:point,37.7749,-122.4194');
      expect(result.location).toEqual({
        type: 'point',
        latitude: 37.7749,
        longitude: -122.4194,
      });
    });

    it('should deserialize multiple filters', () => {
      const result = deserializeFilters('alphabet:search,test;time:preset,last-30-days,created;category:include,tags=work');

      expect(result.alphabet).toEqual({
        type: 'search',
        value: 'test',
      });
      expect(result.time).toEqual({
        type: 'preset',
        preset: 'last-30-days',
        field: 'created',
      });
      expect(result.category).toEqual({
        type: 'include',
        tags: ['work'],
      });
    });

    it('should handle invalid syntax gracefully', () => {
      const result = deserializeFilters('invalid-syntax-here');
      expect(isEmptyFilters(result)).toBe(true);
    });

    it('should skip invalid filter parts', () => {
      const result = deserializeFilters('alphabet:search,test;invalid;time:preset,today,created');
      expect(result.alphabet).toEqual({
        type: 'search',
        value: 'test',
      });
      expect(result.time).toEqual({
        type: 'preset',
        preset: 'today',
        field: 'created',
      });
    });

    it('should handle missing values gracefully', () => {
      const result = deserializeFilters('alphabet:search');
      expect(result.alphabet).toBeNull();
    });
  });

  describe('round-trip serialization', () => {
    it('should preserve state through serialize → deserialize', () => {
      const original: FilterState = {
        location: null,
        alphabet: {
          type: 'search',
          value: 'test query',
        },
        time: {
          type: 'preset',
          preset: 'last-30-days',
          field: 'created',
        },
        category: {
          type: 'include',
          tags: ['work', 'urgent'],
          folders: ['inbox'],
        },
        hierarchy: {
          type: 'priority',
          minPriority: 1,
          maxPriority: 3,
        },
        dsl: null,
      };

      const serialized = serializeFilters(original);
      const deserialized = deserializeFilters(serialized);

      expect(deserialized.alphabet).toEqual(original.alphabet);
      expect(deserialized.time).toEqual(original.time);
      expect(deserialized.category).toEqual(original.category);
      expect(deserialized.hierarchy).toEqual(original.hierarchy);
    });

    it('should preserve location filters through round-trip', () => {
      const original: FilterState = {
        location: {
          type: 'radius',
          centerLat: 37.7749,
          centerLon: -122.4194,
          radiusKm: 10,
        },
        alphabet: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };

      const serialized = serializeFilters(original);
      const deserialized = deserializeFilters(serialized);

      expect(deserialized.location).toEqual(original.location);
    });
  });

  describe('validateFilterURLLength', () => {
    it('should return true for short filter strings', () => {
      expect(validateFilterURLLength('alphabet:search,test')).toBe(true);
    });

    it('should return true for strings under 1500 chars', () => {
      const shortString = 'a'.repeat(1499);
      expect(validateFilterURLLength(shortString)).toBe(true);
    });

    it('should return false for strings over 1500 chars', () => {
      const longString = 'a'.repeat(1501);
      expect(validateFilterURLLength(longString)).toBe(false);
    });

    it('should return true for exactly 1500 chars', () => {
      const exactString = 'a'.repeat(1500);
      expect(validateFilterURLLength(exactString)).toBe(true);
    });
  });

  describe('isEmptyFilters', () => {
    it('should return true for all-null filters', () => {
      const filters: FilterState = {
        location: null,
        alphabet: null,
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };
      expect(isEmptyFilters(filters)).toBe(true);
    });

    it('should return false if any filter is set', () => {
      const filters: FilterState = {
        location: null,
        alphabet: {
          type: 'search',
          value: 'test',
        },
        time: null,
        category: null,
        hierarchy: null,
        dsl: null,
      };
      expect(isEmptyFilters(filters)).toBe(false);
    });
  });
});
