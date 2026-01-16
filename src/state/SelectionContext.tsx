import React, { createContext, useContext, useState, useCallback } from 'react';

interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
}

interface SelectionContextValue {
  selection: SelectionState;
  select: (id: string) => void;
  deselect: (id: string) => void;
  toggle: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<SelectionState>({
    selectedIds: new Set(),
    lastSelectedId: null,
  });
  
  const select = useCallback((id: string) => {
    setSelection(() => ({
      selectedIds: new Set([id]),
      lastSelectedId: id,
    }));
  }, []);
  
  const deselect = useCallback((id: string) => {
    setSelection(prev => {
      const newIds = new Set(prev.selectedIds);
      newIds.delete(id);
      return { ...prev, selectedIds: newIds };
    });
  }, []);
  
  const toggle = useCallback((id: string) => {
    setSelection(prev => {
      const newIds = new Set(prev.selectedIds);
      if (newIds.has(id)) {
        newIds.delete(id);
      } else {
        newIds.add(id);
      }
      return { selectedIds: newIds, lastSelectedId: id };
    });
  }, []);
  
  const selectMultiple = useCallback((ids: string[]) => {
    setSelection({
      selectedIds: new Set(ids),
      lastSelectedId: ids[ids.length - 1] ?? null,
    });
  }, []);
  
  const clear = useCallback(() => {
    setSelection({ selectedIds: new Set(), lastSelectedId: null });
  }, []);
  
  const isSelected = useCallback((id: string) => {
    return selection.selectedIds.has(id);
  }, [selection.selectedIds]);
  
  return (
    <SelectionContext.Provider value={{
      selection,
      select,
      deselect,
      toggle,
      selectMultiple,
      clear,
      isSelected,
    }}>
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
