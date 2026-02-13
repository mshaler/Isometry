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
  updateCursor,
  createZoneClickHandler,
  getHoverHighlightStyle,
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
    filterIconSize: 16,
    filterIconPadding: 4,
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

  describe('updateCursor', () => {
    it('should set pointer cursor for parent-label zone', () => {
      const mockElement = { style: { cursor: '' } } as unknown as HTMLElement;

      updateCursor('parent-label', mockElement);

      expect(mockElement.style.cursor).toBe('pointer');
    });

    it('should set cell cursor for child-body zone', () => {
      const mockElement = { style: { cursor: '' } } as unknown as HTMLElement;

      updateCursor('child-body', mockElement);

      expect(mockElement.style.cursor).toBe('cell');
    });

    it('should set col-resize cursor for resize-edge zone', () => {
      const mockElement = { style: { cursor: '' } } as unknown as HTMLElement;

      updateCursor('resize-edge', mockElement);

      expect(mockElement.style.cursor).toBe('col-resize');
    });

    it('should set default cursor for data-cell zone', () => {
      const mockElement = { style: { cursor: '' } } as unknown as HTMLElement;

      updateCursor('data-cell', mockElement);

      expect(mockElement.style.cursor).toBe('default');
    });

    it('should update cursor when zone changes', () => {
      const mockElement = { style: { cursor: '' } } as unknown as HTMLElement;

      // Start with one zone
      updateCursor('resize-edge', mockElement);
      expect(mockElement.style.cursor).toBe('col-resize');

      // Change to another zone
      updateCursor('parent-label', mockElement);
      expect(mockElement.style.cursor).toBe('pointer');
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

  describe('createZoneClickHandler', () => {
    it('should call onExpandCollapse for parent-label zone clicks', () => {
      const onExpandCollapse = vi.fn();
      const onSelectChildren = vi.fn();
      const onSelectCell = vi.fn();

      const handler = createZoneClickHandler({
        onExpandCollapse,
        onSelectChildren,
        onSelectCell,
      });

      const header = columnHeaders[0]; // Q1 parent header
      handler({ zone: 'parent-label', header });

      expect(onExpandCollapse).toHaveBeenCalledWith(header);
      expect(onSelectChildren).not.toHaveBeenCalled();
      expect(onSelectCell).not.toHaveBeenCalled();
    });

    it('should call onSelectChildren for child-body zone clicks', () => {
      const onExpandCollapse = vi.fn();
      const onSelectChildren = vi.fn();
      const onSelectCell = vi.fn();

      const handler = createZoneClickHandler({
        onExpandCollapse,
        onSelectChildren,
        onSelectCell,
      });

      const header = columnHeaders[1]; // Jan leaf header
      handler({ zone: 'child-body', header });

      expect(onExpandCollapse).not.toHaveBeenCalled();
      expect(onSelectChildren).toHaveBeenCalledWith(header);
      expect(onSelectCell).not.toHaveBeenCalled();
    });

    it('should call onSelectCell for data-cell zone clicks', () => {
      const onExpandCollapse = vi.fn();
      const onSelectChildren = vi.fn();
      const onSelectCell = vi.fn();

      const handler = createZoneClickHandler({
        onExpandCollapse,
        onSelectChildren,
        onSelectCell,
      });

      const cell = cells[0];
      handler({ zone: 'data-cell', cell });

      expect(onExpandCollapse).not.toHaveBeenCalled();
      expect(onSelectChildren).not.toHaveBeenCalled();
      expect(onSelectCell).toHaveBeenCalledWith(cell);
    });

    it('should not call any handler for resize-edge zone (future feature)', () => {
      const onExpandCollapse = vi.fn();
      const onSelectChildren = vi.fn();
      const onSelectCell = vi.fn();

      const handler = createZoneClickHandler({
        onExpandCollapse,
        onSelectChildren,
        onSelectCell,
      });

      const header = columnHeaders[2]; // Feb header
      handler({ zone: 'resize-edge', header });

      // Resize is handled by drag, not click
      expect(onExpandCollapse).not.toHaveBeenCalled();
      expect(onSelectChildren).not.toHaveBeenCalled();
      expect(onSelectCell).not.toHaveBeenCalled();
    });

    it('should not call any handler for none zone', () => {
      const onExpandCollapse = vi.fn();
      const onSelectChildren = vi.fn();
      const onSelectCell = vi.fn();

      const handler = createZoneClickHandler({
        onExpandCollapse,
        onSelectChildren,
        onSelectCell,
      });

      handler({ zone: 'none' });

      expect(onExpandCollapse).not.toHaveBeenCalled();
      expect(onSelectChildren).not.toHaveBeenCalled();
      expect(onSelectCell).not.toHaveBeenCalled();
    });
  });

  describe('getHoverHighlightStyle', () => {
    it('should return span highlight style for parent-label zone', () => {
      const header = columnHeaders[0]; // Q1 with span=2

      const style = getHoverHighlightStyle('parent-label', header);

      expect(style).toBeDefined();
      expect(style!.type).toBe('span');
      expect(style!.x).toBe(header.position.x);
      expect(style!.width).toBe(header.position.width);
    });

    it('should return cell highlight style for child-body zone', () => {
      const header = columnHeaders[1]; // Jan leaf

      const style = getHoverHighlightStyle('child-body', header);

      expect(style).toBeDefined();
      expect(style!.type).toBe('cell');
      expect(style!.x).toBe(header.position.x);
      expect(style!.width).toBe(header.position.width);
    });

    it('should return resize style for resize-edge zone', () => {
      const header = columnHeaders[2]; // Feb

      const style = getHoverHighlightStyle('resize-edge', header);

      expect(style).toBeDefined();
      expect(style!.type).toBe('resize');
    });

    it('should return null for data-cell and none zones', () => {
      expect(getHoverHighlightStyle('data-cell')).toBeNull();
      expect(getHoverHighlightStyle('none')).toBeNull();
    });
  });

  describe('filter-icon zone detection', () => {
    it('should return filter-icon zone when clicking filter icon area', () => {
      // Jan leaf header position: x=0, y=20, width=100, height=20
      // Filter icon at (100 - 4 - 16, 20 + 4) = (80, 24) relative to header start
      // In SVG coords for column headers: point is in the column header area (y < headerHeight=40)
      // Column header test offsets point by headerWidth (120) before testing
      // So Jan header is at x=0 in header space, but we click at x = 0 + 80 = 80 (within 80-96 icon x-range)
      // y = 24 is within 24-36 icon y-range (icon at y=24, size=16)
      // But hit test uses point - headerWidth offset, so we need x = 80 + 120 = 200
      const point = { x: 200, y: 28 }; // Inside filter icon of Jan header

      const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

      expect(result.zone).toBe('filter-icon');
      expect(result.header?.value).toBe('Jan');
    });

    it('should prioritize resize-edge over filter-icon when overlapping', () => {
      // Point in the resize edge (right 4px of header)
      // Feb header at x=100, width=100, so right edge at x=200
      // Resize edge is x=196-200
      const point = { x: 197 + 120, y: 30 };

      const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

      // Resize edge has higher priority
      expect(result.zone).toBe('resize-edge');
    });

    it('should return filter-icon for row headers too', () => {
      // Row header position: x=0, y=0, width=120, height=80
      // Filter icon at (120 - 4 - 16, 4) = (100, 4) relative to header
      // Row headers are offset by headerHeight (40) in hit test
      // So filter icon is at x=100-116, y=4-20 in header space
      // Click at x=108, y=48 (40 header offset + 8 for y in icon range)
      const point = { x: 108, y: 48 }; // Inside row header filter icon area

      const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

      expect(result.zone).toBe('filter-icon');
      expect(result.header?.value).toBe('Active');
    });

    it('should return child-body when clicking outside filter icon area', () => {
      // Point in Jan header but not in filter icon area (left side)
      // Jan at x=0-100, filter icon at x=80-96
      // Click at x=130 (120 header offset + 10) for left side of Jan header
      const point = { x: 130, y: 30 }; // In Jan header but on left side

      const result = hitTest(point, columnHeaders, rowHeaders, cells, defaultConfig);

      expect(result.zone).toBe('child-body');
    });
  });

  describe('filter-icon cursor and click handler', () => {
    it('should return pointer cursor for filter-icon zone', () => {
      expect(getCursorForZone('filter-icon')).toBe('pointer');
    });

    it('should call onFilterClick when filter-icon zone clicked', () => {
      const onExpandCollapse = vi.fn();
      const onSelectChildren = vi.fn();
      const onSelectCell = vi.fn();
      const onFilterClick = vi.fn();

      const handler = createZoneClickHandler({
        onExpandCollapse,
        onSelectChildren,
        onSelectCell,
        onFilterClick,
      });

      const header = columnHeaders[1]; // Jan leaf header
      handler({ zone: 'filter-icon', header });

      expect(onFilterClick).toHaveBeenCalledWith(header);
      expect(onExpandCollapse).not.toHaveBeenCalled();
      expect(onSelectChildren).not.toHaveBeenCalled();
      expect(onSelectCell).not.toHaveBeenCalled();
    });
  });
});
