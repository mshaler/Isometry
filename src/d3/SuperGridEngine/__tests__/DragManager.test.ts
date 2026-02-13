import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as d3 from 'd3';
import { DragManager, type DragManagerConfig } from '../DragManager';

describe('DragManager', () => {
  let svg: SVGSVGElement;
  let selection: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  let dragManager: DragManager;

  const defaultConfig: DragManagerConfig = {
    headerHeight: 40,
    rowHeaderWidth: 120,
    onAxisSwap: vi.fn(),
  };

  beforeEach(() => {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '800');
    svg.setAttribute('height', '600');
    document.body.appendChild(svg);
    selection = d3.select(svg);
    dragManager = new DragManager(selection, defaultConfig);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('creates DragManager instance', () => {
      expect(dragManager).toBeInstanceOf(DragManager);
    });

    it('stores configuration', () => {
      expect(dragManager.getConfig()).toEqual(defaultConfig);
    });
  });

  describe('setupHeaderDrag', () => {
    it('attaches drag behavior to column headers', () => {
      // Create a mock column header
      const headerGroup = selection.append('g').attr('class', 'col-header');
      headerGroup.append('rect').attr('width', 100).attr('height', 40);

      dragManager.setupHeaderDrag('.col-header');

      // Verify drag behavior was attached
      const header = headerGroup.node();
      expect(header).not.toBeNull();
      // D3 drag attaches __on property
      const onListeners = (header as unknown as { __on?: unknown[] }).__on;
      expect(onListeners).toBeDefined();
    });

    it('attaches drag behavior to row headers', () => {
      const headerGroup = selection.append('g').attr('class', 'row-header');
      headerGroup.append('rect').attr('width', 120).attr('height', 30);

      dragManager.setupHeaderDrag('.row-header');

      const header = headerGroup.node();
      expect(header).not.toBeNull();
      const onListeners = (header as unknown as { __on?: unknown[] }).__on;
      expect(onListeners).toBeDefined();
    });
  });

  describe('drag state', () => {
    it('tracks active drag state', () => {
      expect(dragManager.isDragging()).toBe(false);
    });

    it('returns null drag source when not dragging', () => {
      expect(dragManager.getDragSource()).toBeNull();
    });
  });

  describe('drop zones', () => {
    it('calculates x-axis drop zone', () => {
      const xZone = dragManager.getDropZone('x');
      expect(xZone).toEqual({
        x: defaultConfig.rowHeaderWidth,
        y: 0,
        width: 800 - defaultConfig.rowHeaderWidth,
        height: defaultConfig.headerHeight,
      });
    });

    it('calculates y-axis drop zone', () => {
      const yZone = dragManager.getDropZone('y');
      expect(yZone).toEqual({
        x: 0,
        y: defaultConfig.headerHeight,
        width: defaultConfig.rowHeaderWidth,
        height: 600 - defaultConfig.headerHeight,
      });
    });
  });

  describe('axis swap callback', () => {
    it('calls onAxisSwap when swap is triggered', () => {
      dragManager.triggerAxisSwap('x', 'y');

      expect(defaultConfig.onAxisSwap).toHaveBeenCalledWith('x', 'y');
    });

    it('calls onAxisSwap with correct arguments for reverse swap', () => {
      dragManager.triggerAxisSwap('y', 'x');

      expect(defaultConfig.onAxisSwap).toHaveBeenCalledWith('y', 'x');
    });
  });
});
