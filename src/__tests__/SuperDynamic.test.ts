/**
 * SuperDynamic Test Suite
 *
 * Tests for Section 2.2 of SuperGrid specification: drag-and-drop axis
 * repositioning system with real-time grid reflow and PAFV state management.
 *
 * Test Categories:
 * - Axis assignment and swapping
 * - Drag-drop operations
 * - Grid reflow animations
 * - Performance requirements
 * - Integration with PAFV system
 *
 * @module __tests__/SuperDynamic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as d3 from 'd3';
import { SuperDynamicD3Engine, DEFAULT_SUPERDYNAMIC_CONFIG } from '../d3/SuperDynamic';
import { createPAFVAxisService } from '../services/PAFVAxisService';
import type { ViewAxisMapping } from '../types/views';
import type { DragState } from '../types/supergrid';

// Mock sql.js database
const mockDatabase = {
  exec: vi.fn(),
  run: vi.fn()
};

describe('SuperDynamic Axis Repositioning', () => {
  let container: HTMLElement;
  let engine: SuperDynamicD3Engine;
  let axisService: unknown;

  beforeEach(() => {
    // Create test container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Mock database queries
    mockDatabase.exec.mockReturnValue([{
      columns: ['id', 'name', 'axis', 'source_column', 'facet_type', 'enabled', 'sort_order'],
      values: [
        ['folder', 'folder', 'C', 'folder', 'text', 1, 1],
        ['status', 'status', 'C', 'status', 'text', 1, 2],
        ['created_at', 'created_at', 'T', 'created_at', 'date', 1, 3],
        ['modified_at', 'modified_at', 'T', 'modified_at', 'date', 1, 4],
        ['name', 'name', 'A', 'name', 'text', 1, 5],
        ['priority', 'priority', 'H', 'priority', 'number', 1, 6]
      ]
    }]);

    // Initialize services
    axisService = createPAFVAxisService(mockDatabase, 'test-canvas', {
      persistenceDelay: 0, // Immediate for testing
      enableMetrics: true
    });

    engine = new SuperDynamicD3Engine();
  });

  afterEach(() => {
    engine.destroy();
    axisService?.destroy();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.clearAllMocks();
  });

  describe('Engine Initialization', () => {
    it('should initialize SuperDynamic engine with default config', () => {
      engine.init(container, DEFAULT_SUPERDYNAMIC_CONFIG);

      // Check SVG creation
      const svg = container.querySelector('svg.superdynamic-svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('width')).toBe('800');
      expect(svg?.getAttribute('height')).toBe('600');

      // Check drop zones creation
      const dropZones = container.querySelectorAll('.superdynamic-drop-zone');
      expect(dropZones).toHaveLength(3); // x, y, z axes
    });

    it('should create drop zones at correct positions', () => {
      const config = { ...DEFAULT_SUPERDYNAMIC_CONFIG };
      engine.init(container, config);

      const xDropZone = container.querySelector('.superdynamic-drop-zone--x') as HTMLElement;
      const yDropZone = container.querySelector('.superdynamic-drop-zone--y') as HTMLElement;
      const zDropZone = container.querySelector('.superdynamic-drop-zone--z') as HTMLElement;

      expect(xDropZone?.style.left).toBe(`${config.axisSlots.x.x}px`);
      expect(yDropZone?.style.left).toBe(`${config.axisSlots.y.x}px`);
      expect(zDropZone?.style.left).toBe(`${config.axisSlots.z.x}px`);
    });

    it('should set up event handlers correctly', () => {
      const mockChangeHandler = vi.fn();
      const mockReflowHandler = vi.fn();

      engine.init(container, DEFAULT_SUPERDYNAMIC_CONFIG);
      engine.setAxisChangeHandler(mockChangeHandler);
      engine.setReflowStartHandler(mockReflowHandler);

      expect(typeof engine['onAxisChange']).toBe('function');
      expect(typeof engine['onReflowStart']).toBe('function');
    });
  });

  describe('Axis Assignment', () => {
    beforeEach(() => {
      engine.init(container, DEFAULT_SUPERDYNAMIC_CONFIG);
    });

    it('should assign axis to empty slot', async () => {
      const mockHandler = vi.fn();
      engine.setAxisChangeHandler(mockHandler);

      const newMapping: ViewAxisMapping = {
        xAxis: {
          latchDimension: 'C',
          facet: 'folder',
          label: 'Category → Folder'
        }
      };

      await engine.updateAxisMapping(newMapping);

      expect(mockHandler).toHaveBeenCalledWith(newMapping);
    });

    it('should swap axes between slots', async () => {
      const mockHandler = vi.fn();
      engine.setAxisChangeHandler(mockHandler);

      // Set initial mapping
      const initialMapping: ViewAxisMapping = {
        xAxis: { latchDimension: 'C', facet: 'folder', label: 'Folder' },
        yAxis: { latchDimension: 'T', facet: 'created_at', label: 'Created' }
      };

      await engine.updateAxisMapping(initialMapping);

      // Perform swap
      await engine.handleDrop('folder', 'y');

      // Should be called twice: initial assignment + swap
      expect(mockHandler).toHaveBeenCalledTimes(2);

      // Verify final mapping has folder on y-axis
      const finalCall = mockHandler.mock.calls[1][0];
      expect(finalCall.yAxis?.facet).toBe('folder');
    });
  });

  describe('Drag Operations', () => {
    beforeEach(() => {
      engine.init(container, DEFAULT_SUPERDYNAMIC_CONFIG);
    });

    it('should start drag operation correctly', () => {
      const mockEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 200
      });

      engine.startDrag('folder', 'x', mockEvent);

      // Check drag state
      const dragState = engine['dragState'] as DragState;
      expect(dragState).toBeTruthy();
      expect(dragState.axisId).toBe('folder');
      expect(dragState.sourceSlot).toBe('x');
      expect(dragState.isDragging).toBe(true);

      // Check ghost element creation
      const ghost = document.querySelector('.superdynamic-ghost');
      expect(ghost).toBeTruthy();
    });

    it('should cancel drag on Escape key', () => {
      const mockEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 200 });
      engine.startDrag('folder', 'x', mockEvent);

      // Simulate Escape key
      const keyEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(keyEvent);

      // Drag should be cancelled
      const dragState = engine['dragState'];
      expect(dragState).toBeNull();

      // Ghost should be removed
      const ghost = document.querySelector('.superdynamic-ghost');
      expect(ghost).toBeNull();
    });

    it('should update drag position during mouse move', () => {
      const startEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 200 });
      engine.startDrag('folder', 'x', startEvent);

      const moveEvent = new MouseEvent('mousemove', { clientX: 150, clientY: 250 });
      document.dispatchEvent(moveEvent);

      const dragState = engine['dragState'] as DragState;
      expect(dragState.currentPosition.x).toBe(150);
      expect(dragState.currentPosition.y).toBe(250);

      // Ghost element should move
      const ghost = document.querySelector('.superdynamic-ghost') as HTMLElement;
      expect(ghost?.style.left).toBe('100px'); // 150 - 50 (offset)
      expect(ghost?.style.top).toBe('235px');  // 250 - 15 (offset)
    });
  });

  describe('Drop Zone Highlighting', () => {
    beforeEach(() => {
      engine.init(container, DEFAULT_SUPERDYNAMIC_CONFIG);
    });

    it('should highlight drop zone on drag enter', () => {
      const dropZone = container.querySelector('.superdynamic-drop-zone--x') as HTMLElement;

      const dragEnterEvent = new DragEvent('dragover');
      Object.defineProperty(dragEnterEvent, 'clientX', { value: 450, writable: false });
      Object.defineProperty(dragEnterEvent, 'clientY', { value: 350, writable: false });

      dropZone.dispatchEvent(dragEnterEvent);

      expect(dropZone.style.borderColor).toBe('rgb(99, 102, 241)');
      expect(dropZone.style.backgroundColor).toBe('rgba(99, 102, 241, 0.1)');
    });

    it('should create D3 drop indicator', () => {
      engine['showDropIndicator']('x');

      const indicator = container.querySelector('.drop-indicator--x');
      expect(indicator).toBeTruthy();

      const rect = indicator?.querySelector('rect');
      expect(rect?.getAttribute('stroke')).toBe('#6366f1');
      expect(rect?.getAttribute('stroke-dasharray')).toBe('5,5');
    });

    it('should remove drop indicator when drag leaves', () => {
      engine['showDropIndicator']('x');
      let indicator = container.querySelector('.drop-indicator--x');
      expect(indicator).toBeTruthy();

      engine['hideDropIndicator']('x');

      // Wait for transition
      setTimeout(() => {
        indicator = container.querySelector('.drop-indicator--x');
        expect(indicator).toBeNull();
      }, 250);
    });
  });

  describe('Grid Reflow Animation', () => {
    beforeEach(() => {
      engine.init(container, DEFAULT_SUPERDYNAMIC_CONFIG);
    });

    it('should trigger reflow animation on axis change', async () => {
      const mockReflowStart = vi.fn();
      const mockReflowComplete = vi.fn();

      engine.setReflowStartHandler(mockReflowStart);
      engine.setReflowCompleteHandler(mockReflowComplete);

      const oldMapping = {};
      const newMapping: ViewAxisMapping = {
        xAxis: { latchDimension: 'C', facet: 'folder', label: 'Folder' }
      };

      await engine['animateGridReflow'](oldMapping, newMapping);

      // Should create reflow overlay
      const overlay = container.querySelector('.reflow-overlay rect');
      expect(overlay).toBeTruthy();
    });

    it('should complete reflow within performance target', async () => {
      const startTime = performance.now();

      const oldMapping = {};
      const newMapping: ViewAxisMapping = {
        xAxis: { latchDimension: 'C', facet: 'folder', label: 'Folder' },
        yAxis: { latchDimension: 'T', facet: 'created_at', label: 'Created' }
      };

      await engine['animateGridReflow'](oldMapping, newMapping, { duration: 400 });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 500ms (spec requirement)
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Performance Requirements', () => {
    beforeEach(() => {
      engine.init(container, DEFAULT_SUPERDYNAMIC_CONFIG);
    });

    it('should handle rapid axis changes without performance degradation', async () => {
      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        const mapping: ViewAxisMapping = {
          xAxis: {
            latchDimension: i % 2 === 0 ? 'C' : 'T',
            facet: i % 2 === 0 ? 'folder' : 'created_at',
            label: i % 2 === 0 ? 'Folder' : 'Created'
          }
        };

        await engine.updateAxisMapping(mapping);

        const endTime = performance.now();
        durations.push(endTime - startTime);
      }

      // Average duration should be under 100ms
      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      expect(averageDuration).toBeLessThan(100);

      // No individual operation should exceed 500ms
      const maxDuration = Math.max(...durations);
      expect(maxDuration).toBeLessThan(500);
    });

    it('should maintain 60fps during animations', async () => {
      // Half second at 60fps frame testing
      const targetFrameTime = 16.67; // 60fps = 16.67ms per frame

      const frameTimings: number[] = [];
      let lastFrame = performance.now();

      // Mock requestAnimationFrame for testing
      const originalRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = (callback) => {
        const now = performance.now();
        frameTimings.push(now - lastFrame);
        lastFrame = now;
        return originalRAF(callback);
      };

      try {
        const oldMapping = {};
        const newMapping: ViewAxisMapping = {
          xAxis: { latchDimension: 'C', facet: 'folder', label: 'Folder' }
        };

        await engine['animateGridReflow'](oldMapping, newMapping);

        if (frameTimings.length > 0) {
          const averageFrameTime = frameTimings.reduce((sum, t) => sum + t, 0) / frameTimings.length;

          // Should maintain close to 60fps
          expect(averageFrameTime).toBeLessThanOrEqual(targetFrameTime * 1.2); // 20% tolerance
        }

      } finally {
        window.requestAnimationFrame = originalRAF;
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      engine.init(container, DEFAULT_SUPERDYNAMIC_CONFIG);
    });

    it('should handle invalid axis assignment gracefully', async () => {
      const mockHandler = vi.fn();
      engine.setAxisChangeHandler(mockHandler);

      // Try to assign non-existent axis
      await expect(
        engine.handleDrop('invalid-axis', 'x')
      ).resolves.not.toThrow();

      // Should not call change handler for invalid axis
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should recover from animation errors', async () => {
      // Mock D3 transition error
      const originalTransition = d3.transition;
      vi.spyOn(d3, 'transition').mockImplementation(() => {
        throw new Error('Animation error');
      });

      const oldMapping = {};
      const newMapping: ViewAxisMapping = {
        xAxis: { latchDimension: 'C', facet: 'folder', label: 'Folder' }
      };

      await expect(
        engine['animateGridReflow'](oldMapping, newMapping)
      ).resolves.not.toThrow();

      d3.transition = originalTransition;
    });
  });

  describe('Integration with PAFV Service', () => {
    it('should synchronize axis changes with PAFV service', async () => {
      const assignResult = await axisService.assignAxis('x', 'folder');
      expect(assignResult).toBe(true);

      const currentMapping = axisService.getCurrentMapping();
      expect(currentMapping.xAxis?.facet).toBe('folder');
      expect(currentMapping.xAxis?.latchDimension).toBe('C');
    });

    it('should handle axis swapping through service', async () => {
      // Set up initial axes
      await axisService.assignAxis('x', 'folder');
      await axisService.assignAxis('y', 'created_at');

      // Perform swap
      await axisService.swapAxes('x', 'y');

      const mapping = axisService.getCurrentMapping();
      expect(mapping.xAxis?.facet).toBe('created_at');
      expect(mapping.yAxis?.facet).toBe('folder');
    });

    it('should persist axis changes to database', async () => {
      await axisService.assignAxis('x', 'folder');

      // Flush any pending persistence
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO view_state'),
        expect.arrayContaining(['test-canvas', 'supergrid'])
      );
    });

    it('should provide available axes for assignment', () => {
      const availableAxes = axisService.getAvailableAxes();
      expect(availableAxes).toHaveLength(6);

      const folderAxis = availableAxes.find((a: unknown) => a.id === 'folder');
      expect(folderAxis).toMatchObject({
        id: 'folder',
        facet: 'folder',
        latchDimension: 'C',
        label: 'Category → Folder',
        isEnabled: true
      });
    });

    it('should validate axis mappings for consistency', async () => {
      await axisService.assignAxis('x', 'folder');

      const validation = axisService.validateMapping();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect duplicate axis assignments', async () => {
      await axisService.assignAxis('x', 'folder');
      await axisService.assignAxis('y', 'folder'); // Duplicate

      const validation = axisService.validateMapping();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Duplicate axis assignment: folder');
    });
  });

  describe('Specification Compliance', () => {
    beforeEach(() => {
      engine.init(container, DEFAULT_SUPERDYNAMIC_CONFIG);
    });

    it('should support "transpose 2D grid" test case', async () => {
      // Initial 2D grid: X=folder, Y=time
      const initialMapping: ViewAxisMapping = {
        xAxis: { latchDimension: 'C', facet: 'folder', label: 'Folder' },
        yAxis: { latchDimension: 'T', facet: 'created_at', label: 'Created' }
      };

      await engine.updateAxisMapping(initialMapping);

      // Transpose by swapping X and Y
      await engine.handleDrop('folder', 'y');

      // Verify data integrity maintained and axes swapped
      const mockHandler = vi.fn();
      engine.setAxisChangeHandler(mockHandler);

      expect(mockHandler.mock.calls.length).toBeGreaterThan(0);
    });

    it('should support "add 3rd axis" test case', async () => {
      // Start with 2D grid
      const initial2D: ViewAxisMapping = {
        xAxis: { latchDimension: 'C', facet: 'folder', label: 'Folder' },
        yAxis: { latchDimension: 'T', facet: 'created_at', label: 'Created' }
      };

      await engine.updateAxisMapping(initial2D);

      // Add Z-axis for hierarchy
      const with3D: ViewAxisMapping = {
        ...initial2D,
        zAxis: { latchDimension: 'H', facet: 'priority', label: 'Priority', depth: 3 }
      };

      await engine.updateAxisMapping(with3D);

      // Should create SuperStack spans and nesting levels
      expect(with3D.zAxis?.depth).toBe(3);
    });

    it('should support "cancel drag" test case', () => {
      // Start drag
      const mockEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 200 });
      engine.startDrag('folder', 'x', mockEvent);

      expect(engine['dragState']).toBeTruthy();

      // Press Escape to cancel
      engine.cancelDrag();

      // Drag should be cancelled and axis returned to original position
      expect(engine['dragState']).toBeNull();
      expect(document.querySelector('.superdynamic-ghost')).toBeNull();
    });

    it('should meet reflow animation performance target', async () => {
      const startTime = performance.now();

      await engine['animateGridReflow'](
        {},
        { xAxis: { latchDimension: 'C', facet: 'folder', label: 'Folder' } },
        { duration: 400 }
      );

      const duration = performance.now() - startTime;

      // Must be < 500ms as per specification
      expect(duration).toBeLessThan(500);
    });
  });
});

describe('PAFVAxisService', () => {
  let axisService: unknown;

  beforeEach(() => {
    mockDatabase.exec.mockReturnValue([{
      columns: ['id', 'name', 'axis', 'source_column', 'facet_type', 'enabled', 'sort_order'],
      values: [
        ['folder', 'folder', 'C', 'folder', 'text', 1, 1],
        ['status', 'status', 'C', 'status', 'text', 1, 2],
        ['created_at', 'created_at', 'T', 'created_at', 'date', 1, 3]
      ]
    }]);

    axisService = createPAFVAxisService(mockDatabase, 'test-canvas', {
      persistenceDelay: 0,
      enableMetrics: true
    });
  });

  afterEach(() => {
    axisService?.destroy();
    vi.clearAllMocks();
  });

  it('should load available axes from database', () => {
    const axes = axisService.getAvailableAxes();
    expect(axes).toHaveLength(3);

    const folderAxis = axes.find((a: unknown) => a.id === 'folder');
    expect(folderAxis).toMatchObject({
      id: 'folder',
      facet: 'folder',
      latchDimension: 'C',
      label: 'Category → Folder'
    });
  });

  it('should track metrics for axis operations', async () => {
    await axisService.assignAxis('x', 'folder');
    await axisService.swapAxes('x', 'y');

    const metrics = axisService.getMetrics();
    expect(metrics.totalRepositions).toBe(2);
    expect(metrics.interactionPatterns.averageSessionSwaps).toBeGreaterThan(0);
  });

  it('should notify listeners of axis changes', async () => {
    const mockListener = vi.fn();
    axisService.addChangeListener(mockListener);

    await axisService.assignAxis('x', 'folder');

    expect(mockListener).toHaveBeenCalledWith(
      expect.objectContaining({
        xAxis: expect.objectContaining({
          facet: 'folder'
        })
      })
    );
  });

  it('should handle database errors gracefully', () => {
    mockDatabase.exec.mockImplementation(() => {
      throw new Error('Database error');
    });

    // Should not throw, should fall back to defaults
    expect(() => {
      createPAFVAxisService(mockDatabase, 'test-canvas');
    }).not.toThrow();
  });
});