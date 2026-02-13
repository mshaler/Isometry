/**
 * Facet Aggregate Queries Tests
 *
 * Tests the SQL query functions for counting cards by facet values.
 * Validates that:
 * - GROUP BY correctly aggregates folder/tag/status counts
 * - Deleted nodes are excluded (WHERE deleted_at IS NULL)
 * - Results are properly formatted as FacetCount[]
 *
 * Phase 79-01: Facet aggregate queries for catalog browsing
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { Database, QueryExecResult } from 'sql.js';
import {
  getFolderCounts,
  getStatusCounts,
  getTagCounts,
  getAllFacetCounts,
  type FacetCount,
} from '../facet-aggregates';

// Mock database
const mockExec = vi.fn<(sql: string) => QueryExecResult[]>();
const mockDb = {
  exec: mockExec,
} as unknown as Database;

describe('Facet Aggregate Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFolderCounts', () => {
    test('returns folder counts from GROUP BY query', () => {
      mockExec.mockReturnValue([
        {
          columns: ['folder', 'count'],
          values: [
            ['Work', 5],
            ['Personal', 3],
            ['Archive', 1],
          ],
        },
      ]);

      const result = getFolderCounts(mockDb);

      expect(result).toEqual([
        { value: 'Work', count: 5 },
        { value: 'Personal', count: 3 },
        { value: 'Archive', count: 1 },
      ]);
    });

    test('queries with deleted_at IS NULL filter', () => {
      mockExec.mockReturnValue([]);

      getFolderCounts(mockDb);

      expect(mockExec).toHaveBeenCalledTimes(1);
      const sql = mockExec.mock.calls[0][0];
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql).toContain('GROUP BY folder');
      expect(sql).toContain('ORDER BY count DESC');
    });

    test('returns empty array when no results', () => {
      mockExec.mockReturnValue([]);

      const result = getFolderCounts(mockDb);

      expect(result).toEqual([]);
    });

    test('returns empty array when result has no values', () => {
      mockExec.mockReturnValue([
        {
          columns: ['folder', 'count'],
          values: [],
        },
      ]);

      const result = getFolderCounts(mockDb);

      expect(result).toEqual([]);
    });
  });

  describe('getStatusCounts', () => {
    test('returns status counts from GROUP BY query', () => {
      mockExec.mockReturnValue([
        {
          columns: ['status', 'count'],
          values: [
            ['todo', 10],
            ['in_progress', 5],
            ['done', 15],
          ],
        },
      ]);

      const result = getStatusCounts(mockDb);

      expect(result).toEqual([
        { value: 'todo', count: 10 },
        { value: 'in_progress', count: 5 },
        { value: 'done', count: 15 },
      ]);
    });

    test('queries with deleted_at IS NULL filter', () => {
      mockExec.mockReturnValue([]);

      getStatusCounts(mockDb);

      expect(mockExec).toHaveBeenCalledTimes(1);
      const sql = mockExec.mock.calls[0][0];
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql).toContain('GROUP BY status');
    });

    test('returns empty array when no results', () => {
      mockExec.mockReturnValue([]);

      const result = getStatusCounts(mockDb);

      expect(result).toEqual([]);
    });
  });

  describe('getTagCounts', () => {
    test('returns tag counts from json_each GROUP BY query', () => {
      mockExec.mockReturnValue([
        {
          columns: ['tag', 'count'],
          values: [
            ['javascript', 8],
            ['react', 6],
            ['typescript', 4],
          ],
        },
      ]);

      const result = getTagCounts(mockDb);

      expect(result).toEqual([
        { value: 'javascript', count: 8 },
        { value: 'react', count: 6 },
        { value: 'typescript', count: 4 },
      ]);
    });

    test('uses json_each to explode tags array', () => {
      mockExec.mockReturnValue([]);

      getTagCounts(mockDb);

      expect(mockExec).toHaveBeenCalledTimes(1);
      const sql = mockExec.mock.calls[0][0];
      expect(sql).toContain('json_each');
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql).toContain('GROUP BY json_each.value');
    });

    test('returns empty array when no results', () => {
      mockExec.mockReturnValue([]);

      const result = getTagCounts(mockDb);

      expect(result).toEqual([]);
    });
  });

  describe('getAllFacetCounts', () => {
    test('returns all facet counts in structured object', () => {
      // Mock will be called 3 times (folders, statuses, tags)
      mockExec
        .mockReturnValueOnce([
          {
            columns: ['folder', 'count'],
            values: [['Work', 5]],
          },
        ])
        .mockReturnValueOnce([
          {
            columns: ['status', 'count'],
            values: [['todo', 10]],
          },
        ])
        .mockReturnValueOnce([
          {
            columns: ['tag', 'count'],
            values: [['react', 3]],
          },
        ]);

      const result = getAllFacetCounts(mockDb);

      expect(result.folders).toEqual([{ value: 'Work', count: 5 }]);
      expect(result.statuses).toEqual([{ value: 'todo', count: 10 }]);
      expect(result.tags).toEqual([{ value: 'react', count: 3 }]);
    });

    test('calls all three query functions', () => {
      mockExec.mockReturnValue([]);

      getAllFacetCounts(mockDb);

      // Should be called 3 times (once for each facet type)
      expect(mockExec).toHaveBeenCalledTimes(3);
    });
  });

  describe('deleted node exclusion', () => {
    test('all queries exclude deleted nodes via WHERE clause', () => {
      mockExec.mockReturnValue([]);

      getFolderCounts(mockDb);
      getStatusCounts(mockDb);
      getTagCounts(mockDb);

      // All 3 queries should include deleted_at IS NULL
      mockExec.mock.calls.forEach((call) => {
        expect(call[0]).toContain('deleted_at IS NULL');
      });
    });
  });

  describe('result formatting', () => {
    test('FacetCount has correct structure', () => {
      mockExec.mockReturnValue([
        {
          columns: ['folder', 'count'],
          values: [['TestFolder', 42]],
        },
      ]);

      const result = getFolderCounts(mockDb);

      expect(result).toHaveLength(1);
      const item: FacetCount = result[0];
      expect(item).toHaveProperty('value', 'TestFolder');
      expect(item).toHaveProperty('count', 42);
      expect(typeof item.value).toBe('string');
      expect(typeof item.count).toBe('number');
    });
  });
});
