/**
 * Grid Continuum Integration Tests
 *
 * End-to-end tests for the GridContinuumController + GridContinuumSwitcher integration
 * Tests the core Grid Continuum functionality without complex provider dependencies
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GridContinuumController } from '../GridContinuumController';
import { GridContinuumSwitcher } from '../GridContinuumSwitcher';
import type { GridContinuumMode } from '@/types/view';
import type { Node } from '@/types/node';

// No complex mocking needed - test the components directly

// Sample test data representing different node types
const mockNodes: Node[] = [
  {
    id: '1',
    name: 'High Priority Task',
    folder: 'Work',
    status: 'In Progress',
    createdAt: '2024-01-15',
    priority: 3,
    summary: 'Critical feature implementation'
  },
  {
    id: '2',
    name: 'Medium Priority Task',
    folder: 'Work',
    status: 'Todo',
    createdAt: '2024-01-16',
    priority: 2,
    summary: 'Bug fix for issue #123'
  },
  {
    id: '3',
    name: 'Low Priority Task',
    folder: 'Personal',
    status: 'Done',
    createdAt: '2024-01-17',
    priority: 1,
    summary: 'Documentation update'
  },
  {
    id: '4',
    name: 'Research Task',
    folder: 'Learning',
    status: 'Review',
    createdAt: '2024-01-18',
    priority: 2,
    summary: 'Technology evaluation'
  },
  {
    id: '5',
    name: 'Meeting Notes',
    folder: 'Work',
    status: 'Done',
    createdAt: '2024-01-19',
    priority: 1,
    summary: 'Weekly team sync notes'
  }
];

describe('Grid Continuum Integration', () => {
  let controller: GridContinuumController;
  let onModeChangeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    controller = new GridContinuumController();
    onModeChangeMock = vi.fn();
  });

  describe('Controller + Switcher Integration', () => {
    it('integrates GridContinuumController with GridContinuumSwitcher', () => {
      render(
        <GridContinuumSwitcher
          currentMode="grid"
          onModeChange={onModeChangeMock}
        />
      );

      // Verify all 5 modes are present in switcher
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(5);

      // Verify switcher shows correct current mode
      const gridButton = buttons.find(btn => btn.textContent?.includes('Grid') && !btn.textContent?.includes('Super'));
      expect(gridButton).toHaveClass('active');
    });

    it('synchronizes controller and switcher modes', async () => {
      const { rerender } = render(
        <GridContinuumSwitcher
          currentMode="gallery"
          onModeChange={onModeChangeMock}
        />
      );

      // Click to switch to List mode
      const listButton = screen.getByRole('button', { name: /^list/i });

      await act(async () => {
        fireEvent.click(listButton);
      });

      expect(onModeChangeMock).toHaveBeenCalledWith('list');

      // Simulate controller mode change and rerender
      controller.setMode('list');

      rerender(
        <GridContinuumSwitcher
          currentMode="list"
          onModeChange={onModeChangeMock}
        />
      );

      // List button should now be active
      expect(listButton).toHaveClass('active');
    });

    it('transitions through all 5 Grid Continuum modes', async () => {
      const modes: GridContinuumMode[] = ['gallery', 'list', 'kanban', 'grid', 'supergrid'];

      for (const mode of modes) {
        // Test controller mode setting
        controller.setMode(mode);
        expect(controller.getCurrentMode()).toBe(mode);

        // Test that controller generates appropriate projection
        const projection = controller.getProjection(mockNodes);
        expect(projection.mode).toBe(mode);
        expect(projection.axisCount).toBeGreaterThanOrEqual(0);
        expect(projection.cells).toBeDefined();
        expect(projection.layout).toBeDefined();
      }
    });
  });

  describe('Data Projection Integration', () => {
    it('produces different projections for each mode', () => {
      // Set up axis mappings for the controller
      controller.setAxisMapping('x', 'category', 'status');
      controller.setAxisMapping('y', 'hierarchy', 'priority');

      const modes: GridContinuumMode[] = ['gallery', 'list', 'kanban', 'grid', 'supergrid'];
      const projections = modes.map(mode => {
        controller.setMode(mode);
        return controller.getProjection(mockNodes);
      });

      // Each projection should have different characteristics
      expect(projections[0].layout).toBe('masonry'); // Gallery
      expect(projections[1].layout).toBe('vertical-hierarchy'); // List
      expect(projections[2].layout).toBe('column-groups'); // Kanban
      expect(projections[3].layout).toBe('matrix'); // Grid
      expect(projections[4].layout).toBe('nested-headers'); // SuperGrid

      // Each should have appropriate axis counts
      expect(projections[0].axisCount).toBe(0); // Gallery
      expect(projections[1].axisCount).toBe(1); // List
      expect(projections[2].axisCount).toBe(1); // Kanban
      expect(projections[3].axisCount).toBe(2); // Grid
      expect(projections[4].axisCount).toBeGreaterThanOrEqual(2); // SuperGrid
    });

    it('maintains data consistency across mode transitions', () => {
      const originalNodeCount = mockNodes.length;

      const modes: GridContinuumMode[] = ['gallery', 'list', 'kanban', 'grid', 'supergrid'];

      for (const mode of modes) {
        controller.setMode(mode);
        const projection = controller.getProjection(mockNodes);

        // Total nodes should be preserved across projections
        const totalProjectedNodes = projection.cells.reduce((total, cell) => total + cell.nodes.length, 0);
        expect(totalProjectedNodes).toBe(originalNodeCount);

        // No duplicate nodes across cells
        const allNodeIds = projection.cells.flatMap(cell => cell.nodes.map(node => node.id));
        const uniqueNodeIds = new Set(allNodeIds);
        expect(uniqueNodeIds.size).toBe(originalNodeCount);
      }
    });
  });

  describe('Performance Validation', () => {
    it('handles projections efficiently', () => {
      // Generate larger dataset
      const largeDataset: Node[] = Array.from({ length: 100 }, (_, i) => ({
        id: `node-${i}`,
        name: `Task ${i}`,
        folder: `Folder ${i % 5}`,
        status: ['Todo', 'In Progress', 'Done', 'Review'][i % 4],
        createdAt: new Date(2024, 0, (i % 30) + 1).toISOString(),
        priority: (i % 3) + 1,
        summary: `Summary for task ${i}`
      }));

      const modes: GridContinuumMode[] = ['gallery', 'list', 'kanban', 'grid', 'supergrid'];

      for (const mode of modes) {
        const startTime = performance.now();

        controller.setMode(mode);
        const projection = controller.getProjection(largeDataset);

        const endTime = performance.now();
        const projectionTime = endTime - startTime;

        // Each projection should complete quickly (under 50ms for 100 items)
        expect(projectionTime).toBeLessThan(50);

        // Verify projection is valid
        expect(projection.cells.length).toBeGreaterThan(0);
        expect(projection.mode).toBe(mode);
      }
    });
  });
});