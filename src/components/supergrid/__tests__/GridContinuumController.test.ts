/**
 * Grid Continuum Controller Tests
 *
 * Tests the Grid Continuum system that provides polymorphic data projection:
 * Gallery → List → Kanban → 2D Grid → nD SuperGrid
 *
 * Same data, different PAFV axis allocations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GridContinuumController, type GridContinuumMode } from '../GridContinuumController';
import type { Node } from '@/types/node';
import type { AxisMapping } from '@/types/pafv';

describe('GridContinuumController', () => {
  let controller: GridContinuumController;
  let sampleNodes: Node[];

  beforeEach(() => {
    controller = new GridContinuumController();

    // Sample test data
    sampleNodes = [
      {
        id: '1',
        name: 'Task 1',
        folder: 'Work',
        status: 'In Progress',
        createdAt: '2024-01-15',
        priority: 2
      },
      {
        id: '2',
        name: 'Task 2',
        folder: 'Personal',
        status: 'Complete',
        createdAt: '2024-02-10',
        priority: 1
      },
      {
        id: '3',
        name: 'Task 3',
        folder: 'Work',
        status: 'Todo',
        createdAt: '2024-03-05',
        priority: 3
      }
    ] as Node[];
  });

  describe('Mode Configuration', () => {
    it('should define all 5 Grid Continuum modes', () => {
      const modes = controller.getAvailableModes();

      expect(modes).toEqual([
        'gallery',
        'list',
        'kanban',
        'grid',
        'supergrid'
      ]);
    });

    it('should start with gallery mode by default', () => {
      expect(controller.getCurrentMode()).toBe('gallery');
    });

    it('should switch modes correctly', () => {
      controller.setMode('kanban');
      expect(controller.getCurrentMode()).toBe('kanban');
    });
  });

  describe('PAFV Axis Allocation', () => {
    it('should allocate 0 axes for gallery mode', () => {
      controller.setMode('gallery');
      const projection = controller.getProjection(sampleNodes);

      expect(projection.axisCount).toBe(0);
      expect(projection.mappings).toEqual([]);
      expect(projection.layout).toBe('masonry'); // Position-only layout
    });

    it('should allocate 1 axis for list mode', () => {
      controller.setMode('list');
      controller.setAxisMapping('y', 'time', 'year');

      const projection = controller.getProjection(sampleNodes);

      expect(projection.axisCount).toBe(1);
      expect(projection.mappings).toEqual([
        { plane: 'y', axis: 'time', facet: 'year' }
      ]);
      expect(projection.layout).toBe('vertical-hierarchy');
    });

    it('should allocate 1 facet for kanban mode', () => {
      controller.setMode('kanban');
      controller.setAxisMapping('x', 'category', 'status');

      const projection = controller.getProjection(sampleNodes);

      expect(projection.axisCount).toBe(1);
      expect(projection.mappings).toEqual([
        { plane: 'x', axis: 'category', facet: 'status' }
      ]);
      expect(projection.layout).toBe('column-groups');
    });

    it('should allocate 2 axes for grid mode', () => {
      controller.setMode('grid');
      controller.setAxisMapping('x', 'time', 'year');
      controller.setAxisMapping('y', 'category', 'folder');

      const projection = controller.getProjection(sampleNodes);

      expect(projection.axisCount).toBe(2);
      expect(projection.mappings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ plane: 'x', axis: 'time', facet: 'year' }),
          expect.objectContaining({ plane: 'y', axis: 'category', facet: 'folder' })
        ])
      );
      expect(projection.layout).toBe('matrix');
    });

    it('should support n axes for supergrid mode', () => {
      controller.setMode('supergrid');
      controller.setAxisMapping('x', 'time', 'year');
      controller.setAxisMapping('y', 'category', 'folder');
      controller.setAxisMapping('color', 'hierarchy', 'priority');

      const projection = controller.getProjection(sampleNodes);

      expect(projection.axisCount).toBe(3);
      expect(projection.layout).toBe('nested-headers');
    });
  });

  describe('Data Projection', () => {
    it('should project nodes for gallery mode', () => {
      controller.setMode('gallery');
      const projection = controller.getProjection(sampleNodes);

      expect(projection.cells).toHaveLength(1);
      expect(projection.cells[0].nodes).toHaveLength(3);
      expect(projection.cells[0].position).toEqual({ x: 0, y: 0 });
    });

    it('should project nodes for kanban mode', () => {
      controller.setMode('kanban');
      controller.setAxisMapping('x', 'category', 'status');

      const projection = controller.getProjection(sampleNodes);

      // Should create columns by status
      expect(projection.columns).toEqual(['In Progress', 'Complete', 'Todo']);
      expect(projection.cells).toHaveLength(3);

      // Check column assignments
      const inProgressCell = projection.cells.find(cell =>
        cell.columnKey === 'In Progress'
      );
      expect(inProgressCell?.nodes).toHaveLength(1);
      expect(inProgressCell?.nodes[0].id).toBe('1');
    });

    it('should project nodes for 2D grid mode', () => {
      controller.setMode('grid');
      controller.setAxisMapping('x', 'category', 'status');
      controller.setAxisMapping('y', 'category', 'folder');

      const projection = controller.getProjection(sampleNodes);

      expect(projection.rows).toEqual(['Work', 'Personal']);
      expect(projection.columns).toEqual(['In Progress', 'Complete', 'Todo']);

      // Should create matrix cells
      const workInProgressCell = projection.cells.find(cell =>
        cell.rowKey === 'Work' && cell.columnKey === 'In Progress'
      );
      expect(workInProgressCell?.nodes).toHaveLength(1);
      expect(workInProgressCell?.nodes[0].id).toBe('1');
    });
  });

  describe('Mode Transitions', () => {
    it('should preserve axis mappings during transitions', () => {
      controller.setAxisMapping('x', 'time', 'year');
      controller.setAxisMapping('y', 'category', 'folder');

      controller.setMode('kanban');
      expect(controller.getAxisMapping('x')).toEqual({
        plane: 'x', axis: 'time', facet: 'year'
      });

      controller.setMode('grid');
      expect(controller.getAxisMapping('x')).toEqual({
        plane: 'x', axis: 'time', facet: 'year'
      });
      expect(controller.getAxisMapping('y')).toEqual({
        plane: 'y', axis: 'category', facet: 'folder'
      });
    });

    it('should emit transition events', () => {
      let transitionEvent: any = null;
      controller.onModeTransition((event) => {
        transitionEvent = event;
      });

      controller.setMode('kanban');

      expect(transitionEvent).toEqual({
        fromMode: 'gallery',
        toMode: 'kanban',
        preservedMappings: [],
        timestamp: expect.any(Number)
      });
    });
  });
});