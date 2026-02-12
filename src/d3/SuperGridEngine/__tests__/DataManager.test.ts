/**
 * DataManager Tests - Density SQL generation and filtering
 *
 * TDD: These tests define the expected behavior for SuperDensity controls.
 * - Value Density: SQL GROUP BY generation for collapsing leaf values
 * - Extent Density: Cell filtering for dense/sparse modes
 *
 * Janus Density Model:
 * - Value Density (Zoom): Jan, Feb, Mar -> Q1
 * - Extent Density (Pan): Hide/show empty cells
 */

import { describe, it, expect } from 'vitest';
import {
  generateDensityQuery,
  filterEmptyCells,
  type ExtentMode
} from '../DataManager';
import type { CellDescriptor } from '../types';

describe('DataManager - Density Controls', () => {
  describe('generateDensityQuery (Value Density)', () => {
    const baseQuery = 'SELECT * FROM nodes WHERE deleted_at IS NULL';
    const axisHierarchy = ['quarter', 'month', 'week'];

    it('should return original query when densityLevel is 0', () => {
      const result = generateDensityQuery(baseQuery, 0, axisHierarchy);

      // Level 0 = no aggregation, return original
      expect(result).toBe(baseQuery);
    });

    it('should add GROUP BY for parent level when densityLevel is 1', () => {
      const result = generateDensityQuery(baseQuery, 1, axisHierarchy);

      // Level 1 = collapse to 'month' (parent of 'week')
      expect(result).toContain('GROUP BY');
      expect(result).toContain('month');
      // Should have COUNT aggregation
      expect(result.toUpperCase()).toContain('COUNT');
    });

    it('should add GROUP BY for grandparent level when densityLevel is 2', () => {
      const result = generateDensityQuery(baseQuery, 2, axisHierarchy);

      // Level 2 = collapse to 'quarter' (grandparent of 'week')
      expect(result).toContain('GROUP BY');
      expect(result).toContain('quarter');
    });

    it('should handle densityLevel exceeding hierarchy depth', () => {
      const result = generateDensityQuery(baseQuery, 5, axisHierarchy);

      // Level beyond hierarchy = use highest available (quarter)
      expect(result).toContain('GROUP BY');
      expect(result).toContain('quarter');
    });

    it('should include COUNT and AVG aggregations for numeric fields', () => {
      const result = generateDensityQuery(baseQuery, 1, axisHierarchy);

      // Should have proper aggregations
      expect(result.toUpperCase()).toContain('COUNT(*)');
      expect(result.toUpperCase()).toMatch(/AVG\s*\(/);
    });

    it('should handle empty hierarchy gracefully', () => {
      const result = generateDensityQuery(baseQuery, 1, []);

      // No hierarchy = return original query
      expect(result).toBe(baseQuery);
    });

    it('should preserve base query WHERE conditions', () => {
      const queryWithFilter = 'SELECT * FROM nodes WHERE status = "active" AND deleted_at IS NULL';
      const result = generateDensityQuery(queryWithFilter, 1, axisHierarchy);

      // Original WHERE should be preserved
      expect(result).toContain('status');
      expect(result).toContain('deleted_at');
    });
  });

  describe('filterEmptyCells (Extent Density)', () => {
    // Test cells with varying populations
    const testCells: CellDescriptor[] = [
      { id: 'cell-0-0', gridX: 0, gridY: 0, xValue: 'Q1', yValue: 'Jan', nodeIds: ['n1', 'n2'], nodeCount: 2, aggregateData: { avgPriority: 3, statusCounts: {}, tagCounts: {} } },
      { id: 'cell-1-0', gridX: 1, gridY: 0, xValue: 'Q1', yValue: 'Feb', nodeIds: [], nodeCount: 0, aggregateData: { avgPriority: 0, statusCounts: {}, tagCounts: {} } },
      { id: 'cell-2-0', gridX: 2, gridY: 0, xValue: 'Q1', yValue: 'Mar', nodeIds: ['n3'], nodeCount: 1, aggregateData: { avgPriority: 2, statusCounts: {}, tagCounts: {} } },
      { id: 'cell-0-1', gridX: 0, gridY: 1, xValue: 'Q2', yValue: 'Apr', nodeIds: [], nodeCount: 0, aggregateData: { avgPriority: 0, statusCounts: {}, tagCounts: {} } },
      { id: 'cell-1-1', gridX: 1, gridY: 1, xValue: 'Q2', yValue: 'May', nodeIds: [], nodeCount: 0, aggregateData: { avgPriority: 0, statusCounts: {}, tagCounts: {} } },
      { id: 'cell-2-1', gridX: 2, gridY: 1, xValue: 'Q2', yValue: 'Jun', nodeIds: ['n4'], nodeCount: 1, aggregateData: { avgPriority: 1, statusCounts: {}, tagCounts: {} } },
    ];

    it('should return only populated cells in "dense" mode', () => {
      const result = filterEmptyCells(testCells, 'dense');

      // Dense mode = nodeCount > 0 only
      expect(result).toHaveLength(3);
      expect(result.every(c => c.nodeCount > 0)).toBe(true);

      // Should include cells with data
      expect(result.map(c => c.id)).toContain('cell-0-0');
      expect(result.map(c => c.id)).toContain('cell-2-0');
      expect(result.map(c => c.id)).toContain('cell-2-1');

      // Should NOT include empty cells
      expect(result.map(c => c.id)).not.toContain('cell-1-0');
      expect(result.map(c => c.id)).not.toContain('cell-0-1');
    });

    it('should include neighbors of populated cells in "sparse" mode', () => {
      const result = filterEmptyCells(testCells, 'sparse');

      // Sparse mode = populated cells + immediate neighbors
      // Populated: [0,0], [2,0], [2,1]
      // Neighbors of [0,0]: [1,0], [0,1]
      // Neighbors of [2,0]: [1,0], [2,1]
      // Neighbors of [2,1]: [1,1], [2,0]

      // Should include more cells than dense mode
      expect(result.length).toBeGreaterThanOrEqual(3);

      // Populated cells always included
      expect(result.map(c => c.id)).toContain('cell-0-0');
      expect(result.map(c => c.id)).toContain('cell-2-0');
      expect(result.map(c => c.id)).toContain('cell-2-1');
    });

    it('should return all cells in "ultra-sparse" mode', () => {
      const result = filterEmptyCells(testCells, 'ultra-sparse');

      // Ultra-sparse = full Cartesian product (no filtering)
      expect(result).toHaveLength(testCells.length);
      expect(result).toEqual(testCells);
    });

    it('should handle empty input array', () => {
      const result = filterEmptyCells([], 'dense');
      expect(result).toHaveLength(0);
    });

    it('should handle all-empty cells correctly', () => {
      const emptyCells: CellDescriptor[] = [
        { id: 'c1', gridX: 0, gridY: 0, xValue: 'A', yValue: 'B', nodeIds: [], nodeCount: 0 },
        { id: 'c2', gridX: 1, gridY: 0, xValue: 'A', yValue: 'C', nodeIds: [], nodeCount: 0 },
      ];

      const denseResult = filterEmptyCells(emptyCells, 'dense');
      expect(denseResult).toHaveLength(0);

      const sparseResult = filterEmptyCells(emptyCells, 'sparse');
      expect(sparseResult).toHaveLength(0);

      const ultraSparseResult = filterEmptyCells(emptyCells, 'ultra-sparse');
      expect(ultraSparseResult).toHaveLength(2);
    });

    it('should preserve cell order in filtered results', () => {
      const result = filterEmptyCells(testCells, 'dense');

      // Original order preserved
      const originalIndices = result.map(c => testCells.findIndex(tc => tc.id === c.id));
      const isSorted = originalIndices.every((val, i, arr) => i === 0 || val > arr[i - 1]);
      expect(isSorted).toBe(true);
    });
  });
});
