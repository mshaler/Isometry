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
 *
 * Tier 2 persistence (111-03):
 * - Selection persists to sessionStorage
 * - Selection restored on page refresh (within same session)
 */
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

/** SessionStorage key for selection persistence */
const SELECTION_STORAGE_KEY = 'isometry-selection-state';
import { calculateRangeSelection } from '@/d3/SuperGridEngine/SelectManager';
import type { CellDescriptor } from '@/d3/SuperGridEngine/types';

export interface SelectionState {
  selectedIds: Set<string>;
  anchorId: string | null;
  /** Most recently clicked/selected card id (for cross-canvas sync) */
  lastSelectedId: string | null;
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
  const [selection, setSelection] = useState<SelectionState>(() => {
    // Restore selection from sessionStorage on mount
    try {
      const saved = sessionStorage.getItem(SELECTION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          selectedIds: new Set<string>(parsed.selectedIds || []),
          anchorId: parsed.anchorId || null,
          lastSelectedId: parsed.lastSelectedId || null,
        };
      }
    } catch {
      // Ignore parse errors, use default
    }
    return {
      selectedIds: new Set<string>(),
      anchorId: null,
      lastSelectedId: null,
    };
  });

  // Persist selection to sessionStorage on changes
  useEffect(() => {
    try {
      sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify({
        selectedIds: Array.from(selection.selectedIds),
        anchorId: selection.anchorId,
        lastSelectedId: selection.lastSelectedId,
      }));
    } catch {
      // Ignore quota errors silently (sessionStorage has ~5MB limit)
    }
  }, [selection]);

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
      lastSelectedId: id,
    });
  }, []);

  const deselect = useCallback((id: string) => {
    setSelection((prev) => {
      const newIds = new Set(prev.selectedIds);
      newIds.delete(id);
      return { ...prev, selectedIds: newIds, lastSelectedId: id };
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
      return { selectedIds: newIds, anchorId: id, lastSelectedId: id };
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
        lastSelectedId: toId,
      };
    });
  }, []);

  const selectMultiple = useCallback((ids: string[]) => {
    setSelection({
      selectedIds: new Set(ids),
      anchorId: null, // Clear anchor on multi-select
      lastSelectedId: ids.length > 0 ? ids[ids.length - 1] : null,
    });
  }, []);

  const clear = useCallback(() => {
    setSelection({
      selectedIds: new Set(),
      anchorId: null,
      lastSelectedId: null,
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
