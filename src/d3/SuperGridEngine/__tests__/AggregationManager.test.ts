/**
 * AggregationManager Tests - TDD for SuperCards aggregation row generation
 *
 * Tests cover:
 * - Aggregation row has one cell per column
 * - Count values match cell nodeCount sums
 * - Total cell sums all columns
 * - Disabled config returns empty array
 * - Custom aggregation types (sum, avg)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AggregationManager,
  type AggregationConfig,
} from '../AggregationManager';
import type { CellDescriptor, HeaderDescriptor } from '../types';

// Helper to create test cells
function createTestCell(
  gridX: number,
  gridY: number,
  nodeCount: number
): CellDescriptor {
  return {
    id: `cell-${gridX}-${gridY}`,
    gridX,
    gridY,
    xValue: `col-${gridX}`,
    yValue: `row-${gridY}`,
    nodeIds: Array(nodeCount).fill(0).map((_, i) => `node-${gridX}-${gridY}-${i}`),
    nodeCount,
  };
}

// Helper to create test headers
function createTestHeader(
  gridX: number,
  width: number
): HeaderDescriptor {
  return {
    id: `column_${gridX}`,
    level: 0,
    depth: 1,
    value: `Column ${gridX}`,
    axis: 'Category',
    span: 1,
    position: { x: gridX * width, y: 0, width, height: 40 },
    isLeaf: true,
    startIndex: gridX,
    endIndex: gridX,
  };
}

describe('AggregationManager', () => {
  let manager: AggregationManager;

  beforeEach(() => {
    manager = new AggregationManager();
  });

  describe('generateAggregationRow', () => {
    it('should generate one aggregation cell per column', () => {
      const cells: CellDescriptor[] = [
        createTestCell(0, 0, 3),
        createTestCell(1, 0, 2),
        createTestCell(2, 0, 5),
      ];
      const headers = [
        createTestHeader(0, 100),
        createTestHeader(1, 100),
        createTestHeader(2, 100),
      ];

      const result = manager.generateAggregationRow(cells, headers);

      // Should have 3 column cells + 1 total cell = 4
      expect(result.length).toBe(4);
      expect(result.filter(c => c.id.startsWith('agg-') && c.id !== 'agg-total').length).toBe(3);
    });

    it('should calculate correct count for each column', () => {
      const cells: CellDescriptor[] = [
        createTestCell(0, 0, 3),
        createTestCell(0, 1, 2), // Same column, different row
        createTestCell(1, 0, 5),
      ];
      const headers = [
        createTestHeader(0, 100),
        createTestHeader(1, 100),
      ];

      const result = manager.generateAggregationRow(cells, headers);

      // Column 0 should have 3 + 2 = 5
      const col0 = result.find(c => c.id === 'agg-0');
      expect(col0?.aggregationValue).toBe(5);

      // Column 1 should have 5
      const col1 = result.find(c => c.id === 'agg-1');
      expect(col1?.aggregationValue).toBe(5);
    });

    it('should generate total cell with sum of all columns', () => {
      const cells: CellDescriptor[] = [
        createTestCell(0, 0, 3),
        createTestCell(0, 1, 2),
        createTestCell(1, 0, 5),
        createTestCell(2, 0, 1),
      ];
      const headers = [
        createTestHeader(0, 100),
        createTestHeader(1, 100),
        createTestHeader(2, 100),
      ];

      const result = manager.generateAggregationRow(cells, headers);

      const total = result.find(c => c.id === 'agg-total');
      expect(total).toBeDefined();
      expect(total?.aggregationValue).toBe(11); // 3 + 2 + 5 + 1
    });

    it('should position total cell in rightmost column', () => {
      const cells: CellDescriptor[] = [
        createTestCell(0, 0, 1),
        createTestCell(1, 0, 1),
      ];
      const headers = [
        createTestHeader(0, 100),
        createTestHeader(1, 100),
      ];

      const result = manager.generateAggregationRow(cells, headers);

      const total = result.find(c => c.id === 'agg-total');
      expect(total?.gridX).toBe(2); // After the last header
    });

    it('should use fixed 32px height for aggregation row', () => {
      const cells: CellDescriptor[] = [createTestCell(0, 0, 1)];
      const headers = [createTestHeader(0, 100)];

      const result = manager.generateAggregationRow(cells, headers);

      result.forEach(card => {
        expect(card.height).toBe(32);
      });
    });

    it('should return empty array when disabled', () => {
      manager.setConfig({ type: 'count', enabled: false });

      const cells: CellDescriptor[] = [createTestCell(0, 0, 5)];
      const headers = [createTestHeader(0, 100)];

      const result = manager.generateAggregationRow(cells, headers);

      expect(result).toEqual([]);
    });

    it('should position aggregation row after the last data row', () => {
      const cells: CellDescriptor[] = [
        createTestCell(0, 0, 1),
        createTestCell(0, 1, 1),
        createTestCell(0, 2, 1), // Max gridY is 2
      ];
      const headers = [createTestHeader(0, 100)];

      const result = manager.generateAggregationRow(cells, headers);

      result.forEach(card => {
        expect(card.gridY).toBe(3); // 2 + 1
      });
    });

    it('should use column widths from headers', () => {
      const cells: CellDescriptor[] = [
        createTestCell(0, 0, 1),
        createTestCell(1, 0, 1),
      ];
      const headers = [
        createTestHeader(0, 150), // Different widths
        createTestHeader(1, 200),
      ];

      const result = manager.generateAggregationRow(cells, headers);

      const col0 = result.find(c => c.id === 'agg-0');
      const col1 = result.find(c => c.id === 'agg-1');
      expect(col0?.width).toBe(150);
      expect(col1?.width).toBe(200);
    });
  });

  describe('setConfig', () => {
    it('should update aggregation type', () => {
      manager.setConfig({ type: 'sum', enabled: true });

      const cells: CellDescriptor[] = [createTestCell(0, 0, 3)];
      const headers = [createTestHeader(0, 100)];

      const result = manager.generateAggregationRow(cells, headers);

      expect(result[0].aggregationType).toBe('sum');
    });
  });

  describe('getConfig', () => {
    it('should return current config', () => {
      const config = manager.getConfig();
      expect(config.type).toBe('count');
      expect(config.enabled).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty cells array', () => {
      const cells: CellDescriptor[] = [];
      const headers = [createTestHeader(0, 100)];

      const result = manager.generateAggregationRow(cells, headers);

      // Should still generate cells for each header, with 0 counts
      expect(result.length).toBe(2); // 1 header + total
      expect(result[0].aggregationValue).toBe(0);
    });

    it('should handle cells with zero nodeCount', () => {
      const cells: CellDescriptor[] = [
        createTestCell(0, 0, 0),
        createTestCell(1, 0, 0),
      ];
      const headers = [
        createTestHeader(0, 100),
        createTestHeader(1, 100),
      ];

      const result = manager.generateAggregationRow(cells, headers);

      const total = result.find(c => c.id === 'agg-total');
      expect(total?.aggregationValue).toBe(0);
    });
  });
});
