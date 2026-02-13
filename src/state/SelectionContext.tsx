/**
 * SelectionContext — React context for SuperSelect multi-selection
 *
 * Implements SEL-01 through SEL-07:
 * - Single click: select one card
 * - Cmd+click: toggle selection (multi-select)
 * - Shift+click: range select using anchor
 * - Header click: select all children
 * - Lasso: select within bounds
 * - Checkboxes: per-card selection toggle
 * - Tier 1 persistence: selection survives view transitions
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { calculateRangeSelection } from '@/d3/SuperGridEngine/SelectManager';
import type { CellDescriptor } from '@/d3/SuperGridEngine/types';

export interface SelectionState {
  selectedIds: Set<string>;
  anchorId: string | null;
}

/** Scroll-to-node function type for view registration */
export type ScrollToNodeFn = (id: string) => void;

export interface SelectionContextValue {
  selection: SelectionState;
  /** Single select: replace selection with one id, set anchor */
  select: (id: string) => void;
  /** Remove id from selection */
  deselect: (id: string) => void;
  /** Toggle id in selection (Cmd+click), update anchor */
  toggle: (id: string) => void;
  /** Select range from anchor to target (Shift+click) */
  selectRange: (toId: string) => void;
  /** Select multiple ids (header click, lasso result), clear anchor */
  selectMultiple: (ids: string[]) => void;
  /** Clear all selection and anchor */
  clear: () => void;
  /** Check if id is currently selected */
  isSelected: (id: string) => boolean;
  /** Set cells for range selection calculation */
  setCells: (cells: CellDescriptor[]) => void;
  /** Scroll to a specific node - registered by active view (Grid, Network, etc.) */
  scrollToNode: ScrollToNodeFn | null;
  /** Register scroll function from active view (call on view mount) */
  registerScrollToNode: (fn: ScrollToNodeFn) => void;
  /** Unregister scroll function (call on view unmount) */
  unregisterScrollToNode: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<SelectionState>({
    selectedIds: new Set(),
    anchorId: null,
  });

  // Store cells for range selection (ref to avoid re-renders)
  const cellsRef = useRef<CellDescriptor[]>([]);

  // Store scroll-to-node function registered by active view
  const scrollToNodeRef = useRef<ScrollToNodeFn | null>(null);
  const [scrollToNode, setScrollToNode] = useState<ScrollToNodeFn | null>(null);

  const registerScrollToNode = useCallback((fn: ScrollToNodeFn) => {
    scrollToNodeRef.current = fn;
    setScrollToNode(() => fn);
  }, []);

  const unregisterScrollToNode = useCallback(() => {
    scrollToNodeRef.current = null;
    setScrollToNode(null);
  }, []);

  const setCells = useCallback((cells: CellDescriptor[]) => {
    cellsRef.current = cells;
  }, []);

  const select = useCallback((id: string) => {
    setSelection({
      selectedIds: new Set([id]),
      anchorId: id,
    });
  }, []);

  const deselect = useCallback((id: string) => {
    setSelection((prev) => {
      const newIds = new Set(prev.selectedIds);
      newIds.delete(id);
      return { ...prev, selectedIds: newIds };
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setSelection((prev) => {
      const newIds = new Set(prev.selectedIds);
      if (newIds.has(id)) {
        newIds.delete(id);
      } else {
        newIds.add(id);
      }
      return { selectedIds: newIds, anchorId: id };
    });
  }, []);

  const selectRange = useCallback((toId: string) => {
    setSelection((prev) => {
      if (!prev.anchorId) {
        return prev;
      }

      const cells = cellsRef.current;
      const anchorCell = cells.find((c) => c.id === prev.anchorId);
      const targetCell = cells.find((c) => c.id === toId);

      if (!anchorCell || !targetCell) {
        return prev;
      }

      const rangeIds = calculateRangeSelection(anchorCell, targetCell, cells);
      return {
        selectedIds: new Set(rangeIds),
        anchorId: prev.anchorId, // Keep anchor for subsequent range selects
      };
    });
  }, []);

  const selectMultiple = useCallback((ids: string[]) => {
    setSelection({
      selectedIds: new Set(ids),
      anchorId: null, // Clear anchor on multi-select
    });
  }, []);

  const clear = useCallback(() => {
    setSelection({
      selectedIds: new Set(),
      anchorId: null,
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => {
      return selection.selectedIds.has(id);
    },
    [selection.selectedIds]
  );

  return (
    <SelectionContext.Provider
      value={{
        selection,
        select,
        deselect,
        toggle,
        selectRange,
        selectMultiple,
        clear,
        isSelected,
        setCells,
        scrollToNode,
        registerScrollToNode,
        unregisterScrollToNode,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionContextValue {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within SelectionProvider');
  }
  return context;
}
