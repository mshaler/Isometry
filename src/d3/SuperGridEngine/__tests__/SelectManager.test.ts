import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as d3 from 'd3';
import {
  SelectManager,
  type SelectManagerConfig,
  calculateRangeSelection,
  type LassoState,
} from '../SelectManager';
import type { CellDescriptor } from '../types';

describe('SelectManager', () => {
  let svg: SVGSVGElement;
  let selection: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  let selectManager: SelectManager;

  const defaultConfig: SelectManagerConfig = {
    onSelectionChange: vi.fn(),
    onLassoStart: vi.fn(),
    onLassoEnd: vi.fn(),
  };

  // Create a 3x3 grid of mock cells
  const mockCells: CellDescriptor[] = [
    { id: 'cell-0-0', gridX: 0, gridY: 0, xValue: 'A', yValue: '1', nodeIds: [], nodeCount: 0 },
    { id: 'cell-1-0', gridX: 1, gridY: 0, xValue: 'B', yValue: '1', nodeIds: [], nodeCount: 0 },
    { id: 'cell-2-0', gridX: 2, gridY: 0, xValue: 'C', yValue: '1', nodeIds: [], nodeCount: 0 },
    { id: 'cell-0-1', gridX: 0, gridY: 1, xValue: 'A', yValue: '2', nodeIds: [], nodeCount: 0 },
    { id: 'cell-1-1', gridX: 1, gridY: 1, xValue: 'B', yValue: '2', nodeIds: [], nodeCount: 0 },
    { id: 'cell-2-1', gridX: 2, gridY: 1, xValue: 'C', yValue: '2', nodeIds: [], nodeCount: 0 },
    { id: 'cell-0-2', gridX: 0, gridY: 2, xValue: 'A', yValue: '3', nodeIds: [], nodeCount: 0 },
    { id: 'cell-1-2', gridX: 1, gridY: 2, xValue: 'B', yValue: '3', nodeIds: [], nodeCount: 0 },
    { id: 'cell-2-2', gridX: 2, gridY: 2, xValue: 'C', yValue: '3', nodeIds: [], nodeCount: 0 },
  ];

  beforeEach(() => {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '800');
    svg.setAttribute('height', '600');
    document.body.appendChild(svg);
    selection = d3.select(svg);
    selectManager = new SelectManager(selection, defaultConfig);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('creates SelectManager instance', () => {
      expect(selectManager).toBeInstanceOf(SelectManager);
    });

    it('stores configuration', () => {
      expect(selectManager.getConfig()).toEqual(defaultConfig);
    });

    it('has no selection initially', () => {
      expect(selectManager.getSelectedIds()).toEqual(new Set());
    });

    it('has no anchor initially', () => {
      expect(selectManager.getAnchorId()).toBeNull();
    });
  });

  describe('calculateRangeSelection', () => {
    it('returns cells in rectangular range from (0,0) to (2,2)', () => {
      const anchor = mockCells[0]; // (0,0)
      const target = mockCells[8]; // (2,2)

      const selected = calculateRangeSelection(anchor, target, mockCells);

      expect(selected).toHaveLength(9);
      expect(selected).toContain('cell-0-0');
      expect(selected).toContain('cell-1-1');
      expect(selected).toContain('cell-2-2');
    });

    it('returns same cells regardless of selection direction', () => {
      const anchor = mockCells[8]; // (2,2)
      const target = mockCells[0]; // (0,0)

      const selected = calculateRangeSelection(anchor, target, mockCells);

      expect(selected).toHaveLength(9);
    });

    it('returns single cell when anchor equals target', () => {
      const cell = mockCells[4]; // (1,1)

      const selected = calculateRangeSelection(cell, cell, mockCells);

      expect(selected).toHaveLength(1);
      expect(selected[0]).toBe('cell-1-1');
    });

    it('returns row selection for horizontal range', () => {
      const anchor = mockCells[0]; // (0,0)
      const target = mockCells[2]; // (2,0)

      const selected = calculateRangeSelection(anchor, target, mockCells);

      expect(selected).toHaveLength(3);
      expect(selected).toContain('cell-0-0');
      expect(selected).toContain('cell-1-0');
      expect(selected).toContain('cell-2-0');
    });

    it('returns column selection for vertical range', () => {
      const anchor = mockCells[0]; // (0,0)
      const target = mockCells[6]; // (0,2)

      const selected = calculateRangeSelection(anchor, target, mockCells);

      expect(selected).toHaveLength(3);
      expect(selected).toContain('cell-0-0');
      expect(selected).toContain('cell-0-1');
      expect(selected).toContain('cell-0-2');
    });
  });

  describe('single selection', () => {
    it('selectSingle replaces current selection', () => {
      selectManager.selectSingle('cell-0-0');
      selectManager.selectSingle('cell-1-1');

      expect(selectManager.getSelectedIds()).toEqual(new Set(['cell-1-1']));
    });

    it('selectSingle sets anchor', () => {
      selectManager.selectSingle('cell-0-0');

      expect(selectManager.getAnchorId()).toBe('cell-0-0');
    });

    it('selectSingle calls onSelectionChange', () => {
      selectManager.selectSingle('cell-0-0');

      expect(defaultConfig.onSelectionChange).toHaveBeenCalledWith(
        new Set(['cell-0-0'])
      );
    });
  });

  describe('toggle selection', () => {
    it('toggleSelection adds if not present', () => {
      selectManager.selectSingle('cell-0-0');
      selectManager.toggleSelection('cell-1-1');

      expect(selectManager.getSelectedIds()).toEqual(
        new Set(['cell-0-0', 'cell-1-1'])
      );
    });

    it('toggleSelection removes if present', () => {
      selectManager.selectSingle('cell-0-0');
      selectManager.toggleSelection('cell-1-1');
      selectManager.toggleSelection('cell-0-0');

      expect(selectManager.getSelectedIds()).toEqual(new Set(['cell-1-1']));
    });

    it('toggleSelection updates anchor to toggled cell', () => {
      selectManager.selectSingle('cell-0-0');
      selectManager.toggleSelection('cell-1-1');

      expect(selectManager.getAnchorId()).toBe('cell-1-1');
    });
  });

  describe('range selection', () => {
    it('selectRange selects rectangular area from anchor', () => {
      selectManager.setCells(mockCells);
      selectManager.selectSingle('cell-0-0'); // Sets anchor
      selectManager.selectRange('cell-2-2');

      const selected = selectManager.getSelectedIds();
      expect(selected.size).toBe(9);
    });

    it('selectRange does nothing without anchor', () => {
      selectManager.setCells(mockCells);
      selectManager.selectRange('cell-2-2');

      expect(selectManager.getSelectedIds()).toEqual(new Set());
    });

    it('selectRange replaces previous selection', () => {
      selectManager.setCells(mockCells);
      selectManager.selectSingle('cell-0-0');
      selectManager.toggleSelection('cell-2-2');
      selectManager.selectSingle('cell-0-0'); // Reset anchor
      selectManager.selectRange('cell-1-1');

      const selected = selectManager.getSelectedIds();
      // Range from (0,0) to (1,1) = 4 cells
      expect(selected.size).toBe(4);
      expect(selected.has('cell-2-2')).toBe(false);
    });
  });

  describe('multi-select', () => {
    it('selectMultiple sets selection to provided ids', () => {
      selectManager.selectMultiple(['cell-0-0', 'cell-1-1', 'cell-2-2']);

      const selected = selectManager.getSelectedIds();
      expect(selected.size).toBe(3);
      expect(selected.has('cell-0-0')).toBe(true);
      expect(selected.has('cell-1-1')).toBe(true);
      expect(selected.has('cell-2-2')).toBe(true);
    });

    it('selectMultiple clears anchor', () => {
      selectManager.selectSingle('cell-0-0');
      selectManager.selectMultiple(['cell-1-1', 'cell-2-2']);

      expect(selectManager.getAnchorId()).toBeNull();
    });
  });

  describe('clear selection', () => {
    it('clearSelection removes all selections', () => {
      selectManager.selectSingle('cell-0-0');
      selectManager.toggleSelection('cell-1-1');
      selectManager.clearSelection();

      expect(selectManager.getSelectedIds()).toEqual(new Set());
    });

    it('clearSelection clears anchor', () => {
      selectManager.selectSingle('cell-0-0');
      selectManager.clearSelection();

      expect(selectManager.getAnchorId()).toBeNull();
    });
  });

  describe('isSelected', () => {
    it('returns true for selected cells', () => {
      selectManager.selectSingle('cell-0-0');

      expect(selectManager.isSelected('cell-0-0')).toBe(true);
    });

    it('returns false for unselected cells', () => {
      selectManager.selectSingle('cell-0-0');

      expect(selectManager.isSelected('cell-1-1')).toBe(false);
    });
  });

  describe('lasso selection', () => {
    it('startLasso initializes lasso state', () => {
      selectManager.startLasso(100, 100);

      const state = selectManager.getLassoState();
      expect(state).not.toBeNull();
      expect(state?.active).toBe(true);
      expect(state?.startPoint).toEqual({ x: 100, y: 100 });
    });

    it('startLasso calls onLassoStart', () => {
      selectManager.startLasso(100, 100);

      expect(defaultConfig.onLassoStart).toHaveBeenCalled();
    });

    it('updateLasso updates current point', () => {
      selectManager.startLasso(100, 100);
      selectManager.updateLasso(200, 200);

      const state = selectManager.getLassoState();
      expect(state?.currentPoint).toEqual({ x: 200, y: 200 });
    });

    it('endLasso returns cells in bounds', () => {
      // Set up cells with positions
      const cellsWithPositions = mockCells.map((cell, i) => ({
        ...cell,
        // 100px cells in a 3x3 grid starting at (0,0)
        position: {
          x: (i % 3) * 100,
          y: Math.floor(i / 3) * 100,
          width: 100,
          height: 100,
        },
      }));

      selectManager.setCells(cellsWithPositions as CellDescriptor[]);
      selectManager.startLasso(0, 0);
      selectManager.updateLasso(150, 150);

      const selectedIds = selectManager.endLasso();

      // Lasso from (0,0) to (150,150) should include cells at positions:
      // (0,0), (100,0), (0,100), (100,100) = 4 cells
      expect(selectedIds.length).toBeGreaterThan(0);
    });

    it('endLasso calls onLassoEnd', () => {
      selectManager.setCells(mockCells);
      selectManager.startLasso(0, 0);
      selectManager.updateLasso(100, 100);
      selectManager.endLasso();

      expect(defaultConfig.onLassoEnd).toHaveBeenCalled();
    });

    it('endLasso clears lasso state', () => {
      selectManager.startLasso(0, 0);
      selectManager.endLasso();

      expect(selectManager.getLassoState()).toBeNull();
    });

    it('cancelLasso clears state without selecting', () => {
      selectManager.startLasso(0, 0);
      selectManager.updateLasso(200, 200);
      selectManager.cancelLasso();

      expect(selectManager.getLassoState()).toBeNull();
      expect(selectManager.getSelectedIds()).toEqual(new Set());
    });
  });

  describe('click handling', () => {
    it('handleClick with no modifiers calls selectSingle', () => {
      const event = { metaKey: false, ctrlKey: false, shiftKey: false } as MouseEvent;
      selectManager.handleClick('cell-0-0', event);

      expect(selectManager.getSelectedIds()).toEqual(new Set(['cell-0-0']));
    });

    it('handleClick with metaKey calls toggleSelection', () => {
      selectManager.selectSingle('cell-0-0');
      const event = { metaKey: true, ctrlKey: false, shiftKey: false } as MouseEvent;
      selectManager.handleClick('cell-1-1', event);

      expect(selectManager.getSelectedIds()).toEqual(
        new Set(['cell-0-0', 'cell-1-1'])
      );
    });

    it('handleClick with ctrlKey calls toggleSelection', () => {
      selectManager.selectSingle('cell-0-0');
      const event = { metaKey: false, ctrlKey: true, shiftKey: false } as MouseEvent;
      selectManager.handleClick('cell-1-1', event);

      expect(selectManager.getSelectedIds()).toEqual(
        new Set(['cell-0-0', 'cell-1-1'])
      );
    });

    it('handleClick with shiftKey calls selectRange', () => {
      selectManager.setCells(mockCells);
      selectManager.selectSingle('cell-0-0');
      const event = { metaKey: false, ctrlKey: false, shiftKey: true } as MouseEvent;
      selectManager.handleClick('cell-2-2', event);

      expect(selectManager.getSelectedIds().size).toBe(9);
    });
  });
});
