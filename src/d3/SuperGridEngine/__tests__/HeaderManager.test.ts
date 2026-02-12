/**
 * HeaderManager Tests - Multi-level header hierarchy building
 *
 * TDD: These tests define the expected behavior for SuperStack multi-level headers.
 * The buildHeaderHierarchy algorithm takes cells with multi-level axis values
 * and produces a nested tree structure with calculated spans.
 */

import { describe, it, expect } from 'vitest';
import { SuperGridHeaderManager, buildHeaderHierarchy, calculateHeaderDimensions } from '../HeaderManager';
import type { CellDescriptor, HeaderDescriptor, HeaderNode } from '../types';

describe('HeaderManager', () => {
  describe('buildHeaderHierarchy', () => {
    it('should build a 3-level hierarchy from cell axis values', () => {
      // Input: cells with multi-level Y values (Quarter -> Month -> Week)
      const axisValues: string[][] = [
        ['Q1', 'Jan', 'Week 1'],
        ['Q1', 'Jan', 'Week 2'],
        ['Q1', 'Feb', 'Week 1'],
        ['Q1', 'Feb', 'Week 2'],
        ['Q2', 'Apr', 'Week 1'],
        ['Q2', 'Apr', 'Week 2'],
      ];

      const result = buildHeaderHierarchy(axisValues);

      // Should have 2 root nodes: Q1 and Q2
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe('Q1');
      expect(result[1].value).toBe('Q2');

      // Q1 should have level 0, Q2 should have level 0
      expect(result[0].level).toBe(0);
      expect(result[1].level).toBe(0);

      // Q1 should have 2 children: Jan, Feb
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children[0].value).toBe('Jan');
      expect(result[0].children[1].value).toBe('Feb');

      // Jan should have 2 children: Week 1, Week 2
      expect(result[0].children[0].children).toHaveLength(2);
      expect(result[0].children[0].children[0].value).toBe('Week 1');
      expect(result[0].children[0].children[1].value).toBe('Week 2');
    });

    it('should calculate spans based on leaf count', () => {
      const axisValues: string[][] = [
        ['Q1', 'Jan', 'Week 1'],
        ['Q1', 'Jan', 'Week 2'],
        ['Q1', 'Feb', 'Week 1'],
        ['Q1', 'Feb', 'Week 2'],
        ['Q2', 'Apr', 'Week 1'],
        ['Q2', 'Apr', 'Week 2'],
      ];

      const result = buildHeaderHierarchy(axisValues);

      // Q1 spans 4 leaves (Week 1, Week 2 under Jan; Week 1, Week 2 under Feb)
      expect(result[0].span).toBe(4);

      // Q2 spans 2 leaves (Week 1, Week 2 under Apr)
      expect(result[1].span).toBe(2);

      // Jan spans 2 leaves
      expect(result[0].children[0].span).toBe(2);

      // Week 1 (leaf) spans 1
      expect(result[0].children[0].children[0].span).toBe(1);
    });

    it('should calculate correct start/end indices', () => {
      const axisValues: string[][] = [
        ['Q1', 'Jan', 'Week 1'],
        ['Q1', 'Jan', 'Week 2'],
        ['Q1', 'Feb', 'Week 1'],
        ['Q2', 'Apr', 'Week 1'],
      ];

      const result = buildHeaderHierarchy(axisValues);

      // Q1: startIndex 0, endIndex 2 (3 leaves)
      expect(result[0].startIndex).toBe(0);
      expect(result[0].endIndex).toBe(2);

      // Q2: startIndex 3, endIndex 3 (1 leaf)
      expect(result[1].startIndex).toBe(3);
      expect(result[1].endIndex).toBe(3);

      // Jan: startIndex 0, endIndex 1 (2 leaves)
      expect(result[0].children[0].startIndex).toBe(0);
      expect(result[0].children[0].endIndex).toBe(1);

      // Feb: startIndex 2, endIndex 2 (1 leaf)
      expect(result[0].children[1].startIndex).toBe(2);
      expect(result[0].children[1].endIndex).toBe(2);
    });

    it('should handle single-level input (flat headers)', () => {
      const axisValues: string[][] = [
        ['Status A'],
        ['Status B'],
        ['Status C'],
      ];

      const result = buildHeaderHierarchy(axisValues);

      // 3 root nodes, each with no children
      expect(result).toHaveLength(3);
      expect(result[0].children).toHaveLength(0);
      expect(result[0].span).toBe(1);
      expect(result[0].isCollapsed).toBe(false);
    });

    it('should handle empty input', () => {
      const result = buildHeaderHierarchy([]);
      expect(result).toHaveLength(0);
    });

    it('should sum spans to total leaf count', () => {
      const axisValues: string[][] = [
        ['A', 'A1', 'A1a'],
        ['A', 'A1', 'A1b'],
        ['A', 'A2', 'A2a'],
        ['B', 'B1', 'B1a'],
        ['B', 'B1', 'B1b'],
        ['B', 'B1', 'B1c'],
      ];

      const result = buildHeaderHierarchy(axisValues);

      // Total leaves = 6
      const totalSpan = result.reduce((sum, node) => sum + node.span, 0);
      expect(totalSpan).toBe(6);
    });
  });

  describe('calculateHeaderDimensions', () => {
    it('should calculate pixel positions for column headers', () => {
      const axisValues: string[][] = [
        ['Q1', 'Jan'],
        ['Q1', 'Feb'],
        ['Q2', 'Mar'],
      ];
      const hierarchy = buildHeaderHierarchy(axisValues);

      const dimensions = calculateHeaderDimensions(
        hierarchy,
        100, // cellSize
        40,  // headerDepth (height per level)
        'column'
      );

      // Q1 at level 0: y=0, height=40, x=0, width=200 (spans 2 leaves)
      const q1 = dimensions.find(d => d.value === 'Q1');
      expect(q1).toBeDefined();
      expect(q1!.position.x).toBe(0);
      expect(q1!.position.y).toBe(0);
      expect(q1!.position.width).toBe(200);
      expect(q1!.position.height).toBe(40);

      // Jan at level 1: y=40, height=40, x=0, width=100 (spans 1 leaf)
      const jan = dimensions.find(d => d.value === 'Jan');
      expect(jan).toBeDefined();
      expect(jan!.position.x).toBe(0);
      expect(jan!.position.y).toBe(40);
      expect(jan!.position.width).toBe(100);

      // Feb at level 1: y=40, x=100, width=100
      const feb = dimensions.find(d => d.value === 'Feb');
      expect(feb).toBeDefined();
      expect(feb!.position.x).toBe(100);
      expect(feb!.position.y).toBe(40);
    });

    it('should calculate pixel positions for row headers', () => {
      const axisValues: string[][] = [
        ['Q1', 'Jan'],
        ['Q1', 'Feb'],
      ];
      const hierarchy = buildHeaderHierarchy(axisValues);

      const dimensions = calculateHeaderDimensions(
        hierarchy,
        80,  // cellSize (height for rows)
        120, // headerDepth (width per level for rows)
        'row'
      );

      // Q1 at level 0: x=0, width=120, y=0, height=160 (spans 2 leaves)
      const q1 = dimensions.find(d => d.value === 'Q1');
      expect(q1).toBeDefined();
      expect(q1!.position.x).toBe(0);
      expect(q1!.position.width).toBe(120);
      expect(q1!.position.y).toBe(0);
      expect(q1!.position.height).toBe(160);

      // Jan at level 1: x=120, width=120, y=0, height=80
      const jan = dimensions.find(d => d.value === 'Jan');
      expect(jan).toBeDefined();
      expect(jan!.position.x).toBe(120);
      expect(jan!.position.y).toBe(0);
      expect(jan!.position.height).toBe(80);
    });

    it('should include all nested headers in flat output', () => {
      const axisValues: string[][] = [
        ['A', 'A1', 'A1a'],
        ['A', 'A1', 'A1b'],
        ['A', 'A2', 'A2a'],
      ];
      const hierarchy = buildHeaderHierarchy(axisValues);

      const dimensions = calculateHeaderDimensions(hierarchy, 100, 40, 'column');

      // Should have 6 headers: A, A1, A2, A1a, A1b, A2a
      expect(dimensions).toHaveLength(6);

      // Verify level assignments
      expect(dimensions.filter(d => d.level === 0)).toHaveLength(1); // A
      expect(dimensions.filter(d => d.level === 1)).toHaveLength(2); // A1, A2
      expect(dimensions.filter(d => d.level === 2)).toHaveLength(3); // A1a, A1b, A2a
    });
  });

  describe('generateHeaderTree (updated for multi-level)', () => {
    it('should return correct maxColumnLevels for multi-level data', () => {
      const manager = new SuperGridHeaderManager();

      // Create cells with multi-level xValues
      const cells: CellDescriptor[] = [
        {
          id: 'cell-0-0',
          gridX: 0,
          gridY: 0,
          xValue: 'Q1|Jan|Week 1', // Pipe-delimited multi-level
          yValue: 'Status A',
          nodeIds: ['n1'],
          nodeCount: 1,
        },
        {
          id: 'cell-1-0',
          gridX: 1,
          gridY: 0,
          xValue: 'Q1|Jan|Week 2',
          yValue: 'Status A',
          nodeIds: ['n2'],
          nodeCount: 1,
        },
        {
          id: 'cell-2-0',
          gridX: 2,
          gridY: 0,
          xValue: 'Q1|Feb|Week 1',
          yValue: 'Status A',
          nodeIds: ['n3'],
          nodeCount: 1,
        },
      ];

      const gridDimensions = {
        rows: 1,
        cols: 3,
        cellWidth: 100,
        cellHeight: 80,
        headerHeight: 120, // 3 levels * 40px
        headerWidth: 120,
        totalWidth: 420,
        totalHeight: 200,
      };

      const result = manager.generateHeaderTree(cells, gridDimensions);

      // Should detect 3 levels in column headers
      expect(result.maxColumnLevels).toBe(3);
      // Row headers are single-level
      expect(result.maxRowLevels).toBe(1);
    });

    it('should return 1 for flat single-level headers', () => {
      const manager = new SuperGridHeaderManager();

      const cells: CellDescriptor[] = [
        {
          id: 'cell-0-0',
          gridX: 0,
          gridY: 0,
          xValue: 'Status A',
          yValue: 'Priority 1',
          nodeIds: ['n1'],
          nodeCount: 1,
        },
        {
          id: 'cell-1-0',
          gridX: 1,
          gridY: 0,
          xValue: 'Status B',
          yValue: 'Priority 1',
          nodeIds: ['n2'],
          nodeCount: 1,
        },
      ];

      const gridDimensions = {
        rows: 1,
        cols: 2,
        cellWidth: 100,
        cellHeight: 80,
        headerHeight: 40,
        headerWidth: 120,
        totalWidth: 320,
        totalHeight: 120,
      };

      const result = manager.generateHeaderTree(cells, gridDimensions);

      expect(result.maxColumnLevels).toBe(1);
      expect(result.maxRowLevels).toBe(1);
    });
  });

  describe('header selection with children', () => {
    it('should calculate cells within header span for parent header click', () => {
      // Simulate what selectHeaderChildren does:
      // Given a header with position and span, calculate which cells are covered
      const header: HeaderDescriptor = {
        id: 'column_0_Q1_0',
        level: 0,
        value: 'Q1',
        axis: 'Category',
        span: 3, // Q1 spans 3 leaf columns
        position: { x: 0, y: 0, width: 300, height: 40 }, // 3 * 100 = 300
        childCount: 2,
        isLeaf: false,
      };

      const cellWidth = 100;

      // Calculate start and end indices from header position
      const startIdx = Math.floor(header.position.x / cellWidth);
      const spanCount = Math.round(header.position.width / cellWidth);
      const endIdx = startIdx + spanCount - 1;

      expect(startIdx).toBe(0);
      expect(spanCount).toBe(3);
      expect(endIdx).toBe(2);

      // Cells at gridX 0, 1, 2 would be selected
      const cells: CellDescriptor[] = [
        { id: 'c0', gridX: 0, gridY: 0, xValue: 'a', yValue: 'b', nodeIds: [], nodeCount: 0 },
        { id: 'c1', gridX: 1, gridY: 0, xValue: 'a', yValue: 'b', nodeIds: [], nodeCount: 0 },
        { id: 'c2', gridX: 2, gridY: 0, xValue: 'a', yValue: 'b', nodeIds: [], nodeCount: 0 },
        { id: 'c3', gridX: 3, gridY: 0, xValue: 'a', yValue: 'b', nodeIds: [], nodeCount: 0 }, // Outside Q1
      ];

      const selectedIds = cells
        .filter(c => c.gridX >= startIdx && c.gridX <= endIdx)
        .map(c => c.id);

      expect(selectedIds).toEqual(['c0', 'c1', 'c2']);
      expect(selectedIds).not.toContain('c3');
    });

    it('should calculate cells for row header click', () => {
      const header: HeaderDescriptor = {
        id: 'row_0_Q1_0',
        level: 0,
        value: 'Q1',
        axis: 'Category',
        span: 2, // Q1 spans 2 leaf rows
        position: { x: 0, y: 0, width: 120, height: 160 }, // 2 * 80 = 160
        childCount: 2,
        isLeaf: false,
      };

      const cellHeight = 80;

      // For row headers, use y position and height
      const startIdx = Math.floor(header.position.y / cellHeight);
      const spanCount = Math.round(header.position.height / cellHeight);
      const endIdx = startIdx + spanCount - 1;

      expect(startIdx).toBe(0);
      expect(spanCount).toBe(2);
      expect(endIdx).toBe(1);
    });
  });
});
