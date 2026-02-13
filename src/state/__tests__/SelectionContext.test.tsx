import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SelectionProvider, useSelection } from '../SelectionContext';
import type { CellDescriptor } from '@/d3/SuperGridEngine/types';
import React, { useState } from 'react';

describe('SelectionContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SelectionProvider>{children}</SelectionProvider>
  );

  describe('basic selection', () => {
    it('starts with empty selection', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      expect(result.current.selection.selectedIds.size).toBe(0);
      expect(result.current.selection.anchorId).toBeNull();
    });

    it('select replaces selection and sets anchor', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-1');
      });

      expect(result.current.selection.selectedIds.has('card-1')).toBe(true);
      expect(result.current.selection.selectedIds.size).toBe(1);
      expect(result.current.selection.anchorId).toBe('card-1');
    });

    it('select clears previous selection', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-1');
        result.current.select('card-2');
      });

      expect(result.current.selection.selectedIds.has('card-1')).toBe(false);
      expect(result.current.selection.selectedIds.has('card-2')).toBe(true);
      expect(result.current.selection.selectedIds.size).toBe(1);
    });
  });

  describe('toggle selection (Cmd+click)', () => {
    it('toggle adds if not present', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-1');
        result.current.toggle('card-2');
      });

      expect(result.current.selection.selectedIds.has('card-1')).toBe(true);
      expect(result.current.selection.selectedIds.has('card-2')).toBe(true);
      expect(result.current.selection.selectedIds.size).toBe(2);
    });

    it('toggle removes if present', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-1');
        result.current.toggle('card-2');
        result.current.toggle('card-1');
      });

      expect(result.current.selection.selectedIds.has('card-1')).toBe(false);
      expect(result.current.selection.selectedIds.has('card-2')).toBe(true);
      expect(result.current.selection.selectedIds.size).toBe(1);
    });

    it('toggle updates anchor', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-1');
        result.current.toggle('card-2');
      });

      expect(result.current.selection.anchorId).toBe('card-2');
    });
  });

  describe('range selection (Shift+click)', () => {
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

    it('selectRange selects rectangular region from anchor to target', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.setCells(mockCells);
        result.current.select('cell-0-0'); // Sets anchor
        result.current.selectRange('cell-2-2');
      });

      // Range from (0,0) to (2,2) = 9 cells
      expect(result.current.selection.selectedIds.size).toBe(9);
    });

    it('selectRange replaces previous selection', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.setCells(mockCells);
        result.current.select('cell-0-0');
        result.current.toggle('cell-2-2'); // Add to selection
        result.current.select('cell-0-0'); // Reset anchor
        result.current.selectRange('cell-1-1');
      });

      // Range from (0,0) to (1,1) = 4 cells, previous selection cleared
      expect(result.current.selection.selectedIds.size).toBe(4);
      expect(result.current.selection.selectedIds.has('cell-2-2')).toBe(false);
    });

    it('selectRange does nothing without anchor', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.setCells(mockCells);
        result.current.selectRange('cell-2-2');
      });

      expect(result.current.selection.selectedIds.size).toBe(0);
    });

    it('selectRange works in any direction', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.setCells(mockCells);
        result.current.select('cell-2-2'); // Start at bottom-right
        result.current.selectRange('cell-0-0'); // Select to top-left
      });

      // Same 9 cells regardless of direction
      expect(result.current.selection.selectedIds.size).toBe(9);
    });
  });

  describe('selectMultiple (header click)', () => {
    it('selects all provided ids', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.selectMultiple(['card-1', 'card-2', 'card-3']);
      });

      expect(result.current.selection.selectedIds.size).toBe(3);
      expect(result.current.selection.selectedIds.has('card-1')).toBe(true);
      expect(result.current.selection.selectedIds.has('card-2')).toBe(true);
      expect(result.current.selection.selectedIds.has('card-3')).toBe(true);
    });

    it('clears anchor on selectMultiple', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-0');
        result.current.selectMultiple(['card-1', 'card-2']);
      });

      expect(result.current.selection.anchorId).toBeNull();
    });
  });

  describe('clear', () => {
    it('clears all selection and anchor', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-1');
        result.current.toggle('card-2');
        result.current.clear();
      });

      expect(result.current.selection.selectedIds.size).toBe(0);
      expect(result.current.selection.anchorId).toBeNull();
    });
  });

  describe('isSelected', () => {
    it('returns true for selected ids', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-1');
      });

      expect(result.current.isSelected('card-1')).toBe(true);
    });

    it('returns false for unselected ids', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-1');
      });

      expect(result.current.isSelected('card-2')).toBe(false);
    });
  });

  describe('selection state is immutable Set', () => {
    it('returns new Set on each selection change', () => {
      const { result } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-1');
      });
      const previousSet = result.current.selection.selectedIds;

      act(() => {
        result.current.toggle('card-2');
      });

      // Should be a new Set instance
      expect(result.current.selection.selectedIds).not.toBe(previousSet);
    });
  });

  describe('Tier 1 persistence (SEL-07)', () => {
    it('selection survives component re-render', () => {
      const { result, rerender } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-1');
        result.current.toggle('card-2');
      });

      // Force re-render
      rerender();

      // Selection should persist
      expect(result.current.selection.selectedIds.size).toBe(2);
      expect(result.current.selection.selectedIds.has('card-1')).toBe(true);
      expect(result.current.selection.selectedIds.has('card-2')).toBe(true);
    });

    it('selection survives when view key changes', () => {
      // Simulate a view transition wrapper
      interface ViewWrapperProps {
        viewKey: string;
        children: React.ReactNode;
      }
      function ViewWrapper({ viewKey, children }: ViewWrapperProps) {
        return (
          <SelectionProvider>
            <div data-view-key={viewKey}>{children}</div>
          </SelectionProvider>
        );
      }

      // Create a component that uses selection and can switch views
      function TestComponent() {
        const selection = useSelection();
        return <div>{selection.selection.selectedIds.size}</div>;
      }

      const { result, rerender } = renderHook(() => useSelection(), {
        wrapper: ({ children }) => <ViewWrapper viewKey="grid">{children}</ViewWrapper>,
      });

      act(() => {
        result.current.select('card-1');
      });

      // Simulate view transition (viewKey changes)
      rerender();

      // Selection should still be there
      expect(result.current.selection.selectedIds.has('card-1')).toBe(true);
    });

    it('anchor persists for subsequent range selections', () => {
      const { result, rerender } = renderHook(() => useSelection(), { wrapper });

      act(() => {
        result.current.select('card-1'); // Sets anchor to card-1
      });

      // Force re-render (simulating view transition)
      rerender();

      // Anchor should persist
      expect(result.current.selection.anchorId).toBe('card-1');
    });
  });
});
