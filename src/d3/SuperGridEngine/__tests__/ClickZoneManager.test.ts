/**
 * ClickZoneManager Tests - Zone-based hit testing for headers
 *
 * TDD: These tests define the expected behavior for header click zones.
 * Different areas of a header have different behaviors:
 * - Parent label zone (~32px): Structural operations (expand/collapse)
 * - Child body zone: Data selection (select all children)
 * - Resize edge (4px): Column/row resizing
 *
 * Plan 73-04: Header Click Zones
 */

import { describe, it, expect, vi } from 'vitest';
import {
  hitTest,
  getCursorForZone,
  type ClickZone,
  type HitTestResult,
  type HitTestConfig,
} from '../ClickZoneManager';
import type { HeaderDescriptor, CellDescriptor, GridDimensions } from '../types';

describe('ClickZoneManager', () => {
  // Default configuration for hit testing
  const defaultConfig: HitTestConfig = {
    labelHeight: 32,
    resizeEdgeWidth: 4,
    gridDimensions: {
      rows: 3,
      cols: 3,
      cellWidth: 100,
      cellHeight: 80,
      headerHeight: 40,
      headerWidth: 120,
      totalWidth: 420,
      totalHeight: 280,
    },
  };

  // Sample column headers
  const columnHeaders: HeaderDescriptor[] = [
    {
      id: 'column_0_Q1_0',
      level: 0,
      value: 'Q1',
      axis: 'Category',
      span: 2,
      position: { x: 0, y: 0, width: 200, height: 20 }, // Parent header
      childCount: 2,
      isLeaf: false,
    },
    {
      id: 'column_1_Jan_0',
      level: 1,
      value: 'Jan',
      axis: 'Category',
      span: 1,
      position: { x: 0, y: 20, width: 100, height: 20 }, // Leaf header
      childCount: 0,
      isLeaf: true,
    },
    {
      id: 'column_1_Feb_1',
      level: 1,
      value: 'Feb',
      axis: 'Category',
      span: 1,
      position: { x: 100, y: 20, width: 100, height: 20 }, // Leaf header
      childCount: 0,
      isLeaf: true,
    },
  ];

  // Sample row headers
  const rowHeaders: HeaderDescriptor[] = [
    {
      id: 'row_0_Status_0',
      level: 0,
      value: 'Active',
      axis: 'Category',
      span: 1,
      position: { x: 0, y: 0, width: 120, height: 80 },
      childCount: 0,
      isLeaf: true,
    },
  ];

  // Sample cells (offset by header dimensions)
  const cells: CellDescriptor[] = [
    {
      id: 'cell-0-0',
      gridX: 0,
      gridY: 0,
      xValue: 'Jan',
      yValue: 'Active',
      nodeIds: ['n1'],
      nodeCount: 1,
    },
    {
      id: 'cell-1-0',
      gridX: 1,
      gridY: 0,
      xValue: 'Feb',
      yValue: 'Active',
      nodeIds: ['n2'],
      nodeCount: 1,
    },
  ];

  describe('hitTest', () => {
    describe('zone detection for column headers', () => {
      it('should return parent-label zone when clicking top portion of parent header', () => {
        // Point in the top 32px of the Q1 parent header
        const point = { x: 100 + 120, y: 10 }; // 120 = headerWidth offset

        const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

        expect(result.zone).toBe('parent-label');
        expect(result.header).toBeDefined();
        expect(result.header?.value).toBe('Q1');
      });

      it('should return child-body zone when clicking body of leaf header', () => {
        // Point in the "Jan" leaf header body (below label zone threshold)
        const point = { x: 50 + 120, y: 30 }; // In Jan header, below 32px threshold

        const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

        expect(result.zone).toBe('child-body');
        expect(result.header).toBeDefined();
        expect(result.header?.value).toBe('Jan');
      });

      it('should return resize-edge zone when clicking near right edge of header', () => {
        // Point near right edge of "Feb" header (within 4px of edge)
        const point = { x: 198 + 120, y: 30 }; // x=198 is within 4px of 200

        const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

        expect(result.zone).toBe('resize-edge');
        expect(result.header).toBeDefined();
        expect(result.header?.value).toBe('Feb');
      });
    });

    describe('zone detection for row headers', () => {
      it('should return child-body zone for row header click', () => {
        // Point in the row header
        const point = { x: 60, y: 80 }; // In row header area (below column headers)

        const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

        expect(result.zone).toBe('child-body');
        expect(result.header).toBeDefined();
        expect(result.header?.value).toBe('Active');
      });

      it('should return resize-edge zone when clicking near bottom edge of row header', () => {
        // Point near bottom edge of row header (within 4px)
        const point = { x: 60, y: 40 + 78 }; // y near bottom of first row header

        const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

        expect(result.zone).toBe('resize-edge');
        expect(result.header).toBeDefined();
      });
    });

    describe('data cell detection', () => {
      it('should return data-cell zone when clicking in grid cell area', () => {
        // Point in cell area (past headers)
        const point = { x: 170, y: 80 }; // In cell grid area

        const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

        expect(result.zone).toBe('data-cell');
        expect(result.cell).toBeDefined();
      });

      it('should identify the correct cell based on grid position', () => {
        // Point in second cell (gridX=1)
        // headerWidth=120, cellWidth=100, so gridX=1 starts at x=220
        // headerHeight=40, so gridY=0 starts at y=40
        const point = { x: 230, y: 50 }; // x=230 is in second cell, y=50 is in first row

        const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

        expect(result.zone).toBe('data-cell');
        expect(result.cell?.gridX).toBe(1);
        expect(result.cell?.gridY).toBe(0);
      });
    });

    describe('edge cases', () => {
      it('should return null for points outside grid bounds', () => {
        const point = { x: 1000, y: 1000 }; // Way outside

        const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

        expect(result.zone).toBe('none');
        expect(result.header).toBeUndefined();
        expect(result.cell).toBeUndefined();
      });

      it('should handle empty header arrays', () => {
        const point = { x: 50, y: 50 };

        const result = hitTest(point, [], [], cells, defaultConfig);

        // Should fall through to data-cell or none
        expect(['data-cell', 'none']).toContain(result.zone);
      });

      it('should prioritize resize-edge over other zones', () => {
        // Point exactly at the boundary between header and resize edge
        const point = { x: 196 + 120, y: 25 }; // Right edge of Q1 header

        const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

        // Resize edge takes priority
        expect(result.zone).toBe('resize-edge');
      });
    });
  });

  describe('getCursorForZone', () => {
    it('should return pointer cursor for parent-label zone', () => {
      expect(getCursorForZone('parent-label')).toBe('pointer');
    });

    it('should return cell cursor for child-body zone', () => {
      expect(getCursorForZone('child-body')).toBe('cell');
    });

    it('should return col-resize cursor for resize-edge zone', () => {
      expect(getCursorForZone('resize-edge')).toBe('col-resize');
    });

    it('should return default cursor for data-cell zone', () => {
      expect(getCursorForZone('data-cell')).toBe('default');
    });

    it('should return default cursor for none zone', () => {
      expect(getCursorForZone('none')).toBe('default');
    });
  });

  describe('zone boundary accuracy', () => {
    it('should detect label zone only within labelHeight threshold', () => {
      // Just inside label zone (at y=31, threshold is 32)
      const insidePoint = { x: 150 + 120, y: 31 };
      const insideResult = hitTest(insidePoint, columnHeaders, rowHeaders, cells, defaultConfig);

      // Just outside label zone (at y=33, threshold is 32)
      // For the parent header at y=0, height=20, this is actually in the child header
      // Let's test with different config
      const smallLabelConfig: HitTestConfig = {
        ...defaultConfig,
        labelHeight: 10,
      };

      // At y=5, should be in label zone
      const labelPoint = { x: 150 + 120, y: 5 };
      const labelResult = hitTest(labelPoint, columnHeaders, rowHeaders, cells, smallLabelConfig);
      expect(labelResult.zone).toBe('parent-label');

      // At y=15, should be in child-body (past label threshold but still in header)
      const bodyPoint = { x: 50 + 120, y: 25 };
      const bodyResult = hitTest(bodyPoint, columnHeaders, rowHeaders, cells, smallLabelConfig);
      expect(bodyResult.zone).toBe('child-body');
    });

    it('should detect resize edge only within resizeEdgeWidth threshold', () => {
      // At x=197 (3px from 200 edge, within 4px threshold)
      const insideEdge = { x: 197 + 120, y: 30 };
      const insideResult = hitTest(insideEdge, columnHeaders, rowHeaders, cells, defaultConfig);
      expect(insideResult.zone).toBe('resize-edge');

      // At x=190 (10px from 200 edge, outside 4px threshold)
      const outsideEdge = { x: 190 + 120, y: 30 };
      const outsideResult = hitTest(outsideEdge, columnHeaders, rowHeaders, cells, defaultConfig);
      expect(outsideResult.zone).not.toBe('resize-edge');
    });
  });
});
