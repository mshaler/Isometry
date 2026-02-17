/**
 * Grid Continuum Integration Tests
 *
 * End-to-end tests for the GridContinuumController + GridContinuumSwitcher integration
 * Tests the core Grid Continuum functionality without complex provider dependencies
 *
 * Includes cross-view selection sync tests (111-03)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import React from 'react';
import { GridContinuumController } from '../GridContinuumController';
import { GridContinuumSwitcher } from '../GridContinuumSwitcher';
import { SelectionProvider, useSelection } from '@/state/SelectionContext';
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

/**
 * Cross-View Selection Sync Tests (111-03)
 *
 * Validates that selection state persists across view mode transitions
 * using SelectionContext + GridContinuumController integration.
 */
describe('Cross-View Selection Sync', () => {
  let controller: GridContinuumController;

  // Mock sessionStorage for test isolation
  const mockSessionStorage = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
    };
  })();

  beforeEach(() => {
    controller = new GridContinuumController();
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    });
    mockSessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSessionStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SelectionProvider>{children}</SelectionProvider>
  );

  it('preserves selection when switching from Gallery to List', () => {
    const { result, rerender } = renderHook(() => useSelection(), { wrapper });

    // Start in Gallery mode
    controller.setMode('gallery');

    // Select a card
    act(() => {
      result.current.select('card-1');
    });

    expect(result.current.selection.selectedIds.has('card-1')).toBe(true);

    // Switch to List mode
    controller.setMode('list');
    rerender();

    // Selection should persist
    expect(result.current.selection.selectedIds.has('card-1')).toBe(true);
    expect(result.current.selection.anchorId).toBe('card-1');
  });

  it('preserves selection when switching from Kanban to SuperGrid', () => {
    const { result, rerender } = renderHook(() => useSelection(), { wrapper });

    // Start in Kanban mode
    controller.setMode('kanban');

    // Select a card
    act(() => {
      result.current.select('card-2');
    });

    expect(result.current.selection.selectedIds.has('card-2')).toBe(true);

    // Switch to SuperGrid mode
    controller.setMode('supergrid');
    rerender();

    // Selection should persist
    expect(result.current.selection.selectedIds.has('card-2')).toBe(true);
  });

  it('maintains multi-select across view transitions', () => {
    const { result, rerender } = renderHook(() => useSelection(), { wrapper });

    // Start in Grid mode
    controller.setMode('grid');

    // Multi-select using toggle (Cmd+click simulation)
    act(() => {
      result.current.select('card-1');
      result.current.toggle('card-2');
      result.current.toggle('card-3');
    });

    expect(result.current.selection.selectedIds.size).toBe(3);

    // Switch to Kanban mode
    controller.setMode('kanban');
    rerender();

    // All selections should persist
    expect(result.current.selection.selectedIds.size).toBe(3);
    expect(result.current.selection.selectedIds.has('card-1')).toBe(true);
    expect(result.current.selection.selectedIds.has('card-2')).toBe(true);
    expect(result.current.selection.selectedIds.has('card-3')).toBe(true);
  });

  it('selection survives 5 consecutive mode switches', () => {
    const { result, rerender } = renderHook(() => useSelection(), { wrapper });

    // Initial selection
    act(() => {
      result.current.select('card-1');
      result.current.toggle('card-2');
    });

    const modes: GridContinuumMode[] = ['gallery', 'list', 'kanban', 'grid', 'supergrid', 'gallery'];

    // Cycle through all modes and back
    for (const mode of modes) {
      controller.setMode(mode);
      rerender();

      // Selection should persist at each step
      expect(result.current.selection.selectedIds.size).toBe(2);
      expect(result.current.selection.selectedIds.has('card-1')).toBe(true);
      expect(result.current.selection.selectedIds.has('card-2')).toBe(true);
    }
  });

  it('allocateAxes returns correct config while selection persists', () => {
    const { result, rerender } = renderHook(() => useSelection(), { wrapper });

    // Select cards
    act(() => {
      result.current.select('card-1');
    });

    // Verify allocateAxes returns correct config for each mode
    const modes: GridContinuumMode[] = ['gallery', 'list', 'kanban', 'grid', 'supergrid'];

    for (const mode of modes) {
      controller.setMode(mode);
      const allocation = controller.allocateAxes(mode);
      rerender();

      // Selection persists
      expect(result.current.selection.selectedIds.has('card-1')).toBe(true);

      // allocateAxes returns valid config
      expect(allocation).toBeDefined();
      expect(allocation.axisCount).toBeGreaterThanOrEqual(0);
      expect(allocation.description).toBeTruthy();
    }
  });
});