import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as d3 from 'd3';
import { ResizeManager, type ResizeManagerConfig } from '../ResizeManager';
import type { HeaderDescriptor } from '../types';

describe('ResizeManager', () => {
  let svg: SVGSVGElement;
  let selection: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  let resizeManager: ResizeManager;

  const defaultConfig: ResizeManagerConfig = {
    minSize: 40,
    onResize: vi.fn(),
    onResizeEnd: vi.fn(),
  };

  const mockHeader: HeaderDescriptor = {
    id: 'col-1',
    value: 'Column 1',
    level: 0,
    depth: 1,
    isLeaf: true,
    axis: 'Category',
    span: 1,
    position: {
      x: 100,
      y: 0,
      width: 120,
      height: 40,
    },
    startIndex: 0,
    endIndex: 0,
  };

  beforeEach(() => {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '800');
    svg.setAttribute('height', '600');
    document.body.appendChild(svg);
    selection = d3.select(svg);
    resizeManager = new ResizeManager(selection, defaultConfig);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('creates ResizeManager instance', () => {
      expect(resizeManager).toBeInstanceOf(ResizeManager);
    });

    it('stores configuration', () => {
      expect(resizeManager.getConfig()).toEqual(defaultConfig);
    });

    it('is not resizing initially', () => {
      expect(resizeManager.isResizing()).toBe(false);
    });
  });

  describe('startResize', () => {
    it('captures initial state on start', () => {
      const mockEvent = {
        clientX: 220,
        shiftKey: false,
      } as MouseEvent;

      resizeManager.startResize(mockHeader, mockEvent);

      expect(resizeManager.isResizing()).toBe(true);
      expect(resizeManager.getResizeState()).toMatchObject({
        headerId: 'col-1',
        startWidth: 120,
        startX: 220,
        isShiftHeld: false,
      });
    });

    it('detects shift key for bulk resize', () => {
      const mockEvent = {
        clientX: 220,
        shiftKey: true,
      } as MouseEvent;

      resizeManager.startResize(mockHeader, mockEvent);

      expect(resizeManager.getResizeState()?.isShiftHeld).toBe(true);
    });
  });

  describe('updateResize', () => {
    it('returns delta applied to width', () => {
      const startEvent = { clientX: 220, shiftKey: false } as MouseEvent;
      resizeManager.startResize(mockHeader, startEvent);

      const moveEvent = { clientX: 250 } as MouseEvent;
      const newWidth = resizeManager.updateResize(moveEvent);

      // Original 120 + delta 30 = 150
      expect(newWidth).toBe(150);
    });

    it('calls onResize callback during resize', () => {
      const startEvent = { clientX: 220, shiftKey: false } as MouseEvent;
      resizeManager.startResize(mockHeader, startEvent);

      const moveEvent = { clientX: 250 } as MouseEvent;
      resizeManager.updateResize(moveEvent);

      expect(defaultConfig.onResize).toHaveBeenCalledWith('col-1', 150);
    });

    it('returns original width if not resizing', () => {
      const moveEvent = { clientX: 250 } as MouseEvent;
      const result = resizeManager.updateResize(moveEvent);

      expect(result).toBe(0);
    });
  });

  describe('constrainSize', () => {
    it('enforces minimum 40px', () => {
      expect(resizeManager.constrainSize(30)).toBe(40);
      expect(resizeManager.constrainSize(40)).toBe(40);
      expect(resizeManager.constrainSize(50)).toBe(50);
    });

    it('returns value as-is if above minimum', () => {
      expect(resizeManager.constrainSize(100)).toBe(100);
      expect(resizeManager.constrainSize(500)).toBe(500);
    });
  });

  describe('endResize', () => {
    it('returns final dimensions', () => {
      const startEvent = { clientX: 220, shiftKey: false } as MouseEvent;
      resizeManager.startResize(mockHeader, startEvent);

      const moveEvent = { clientX: 280 } as MouseEvent;
      resizeManager.updateResize(moveEvent);

      const result = resizeManager.endResize();

      expect(result).toEqual({
        headerId: 'col-1',
        newWidth: 180, // 120 + 60 delta
      });
    });

    it('calls onResizeEnd callback', () => {
      const startEvent = { clientX: 220, shiftKey: false } as MouseEvent;
      resizeManager.startResize(mockHeader, startEvent);

      const moveEvent = { clientX: 280 } as MouseEvent;
      resizeManager.updateResize(moveEvent);

      resizeManager.endResize();

      expect(defaultConfig.onResizeEnd).toHaveBeenCalledWith('col-1', 180);
    });

    it('clears resize state', () => {
      const startEvent = { clientX: 220, shiftKey: false } as MouseEvent;
      resizeManager.startResize(mockHeader, startEvent);
      resizeManager.endResize();

      expect(resizeManager.isResizing()).toBe(false);
      expect(resizeManager.getResizeState()).toBeNull();
    });

    it('returns null if not resizing', () => {
      const result = resizeManager.endResize();
      expect(result).toBeNull();
    });
  });

  describe('bulk resize with Shift', () => {
    const siblingHeaders: HeaderDescriptor[] = [
      mockHeader,
      {
        ...mockHeader,
        id: 'col-2',
        value: 'Column 2',
        position: { ...mockHeader.position, x: 220, width: 100 },
        startIndex: 1,
        endIndex: 1,
      },
      {
        ...mockHeader,
        id: 'col-3',
        value: 'Column 3',
        position: { ...mockHeader.position, x: 320, width: 80 },
        startIndex: 2,
        endIndex: 2,
      },
    ];

    it('applies ratio to all siblings', () => {
      const ratios = resizeManager.calculateBulkResize(
        siblingHeaders,
        mockHeader,
        1.5 // 50% increase
      );

      expect(ratios.get('col-1')).toBe(180); // 120 * 1.5
      expect(ratios.get('col-2')).toBe(150); // 100 * 1.5
      expect(ratios.get('col-3')).toBe(120); // 80 * 1.5
    });

    it('enforces minimum on all siblings', () => {
      const ratios = resizeManager.calculateBulkResize(
        siblingHeaders,
        mockHeader,
        0.3 // 70% decrease
      );

      // All should be at minimum 40
      expect(ratios.get('col-1')).toBe(40);
      expect(ratios.get('col-2')).toBe(40);
      expect(ratios.get('col-3')).toBe(40);
    });
  });

  describe('auto-fit width', () => {
    it('calculates width based on header text', () => {
      const measureText = vi.fn().mockReturnValue(80);

      const width = resizeManager.calculateAutoFitWidth(mockHeader, [], measureText);

      // 80 (text) + 16 (padding)
      expect(width).toBe(96);
    });

    it('considers cell content', () => {
      const measureText = vi.fn()
        .mockReturnValueOnce(60) // header
        .mockReturnValueOnce(100) // cell 1
        .mockReturnValueOnce(80); // cell 2

      const cells = [
        { gridX: 0, primaryText: 'Long Cell Content' },
        { gridX: 0, primaryText: 'Short' },
      ];

      const width = resizeManager.calculateAutoFitWidth(
        mockHeader,
        cells as unknown[],
        measureText
      );

      // Max(60+16, 100+16, 80+16) = 116
      expect(width).toBe(116);
    });

    it('respects minimum width', () => {
      const measureText = vi.fn().mockReturnValue(10);

      const width = resizeManager.calculateAutoFitWidth(mockHeader, [], measureText);

      expect(width).toBe(40); // minimum
    });
  });
});
