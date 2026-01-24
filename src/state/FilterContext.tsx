import React, { createContext, useContext, useReducer, useCallback, useMemo, useState, useEffect } from 'react';
import type {
  FilterState,
  LocationFilter,
  AlphabetFilter,
  TimeFilter,
  CategoryFilter,
  HierarchyFilter,
  FilterPreset
} from '../types/filter';
import { EMPTY_FILTERS } from '../types/filter';
import {
  loadPresets,
  savePreset as savePresetToStorage,
  deletePreset as deletePresetFromStorage,
  generatePresetId,
  presetNameExists
} from '../utils/filter-presets';

type FilterAction =
  | { type: 'SET_LOCATION'; payload: LocationFilter | null }
  | { type: 'SET_ALPHABET'; payload: AlphabetFilter | null }
  | { type: 'SET_TIME'; payload: TimeFilter | null }
  | { type: 'SET_CATEGORY'; payload: CategoryFilter | null }
  | { type: 'SET_HIERARCHY'; payload: HierarchyFilter | null }
  | { type: 'SET_DSL'; payload: string | null }
  | { type: 'CLEAR_ALL' }
  | { type: 'APPLY_PREVIEW'; payload: FilterState };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_LOCATION':
      return { ...state, location: action.payload, dsl: null };
    case 'SET_ALPHABET':
      return { ...state, alphabet: action.payload, dsl: null };
    case 'SET_TIME':
      return { ...state, time: action.payload, dsl: null };
    case 'SET_CATEGORY':
      return { ...state, category: action.payload, dsl: null };
    case 'SET_HIERARCHY':
      return { ...state, hierarchy: action.payload, dsl: null };
    case 'SET_DSL':
      return { ...EMPTY_FILTERS, dsl: action.payload };
    case 'CLEAR_ALL':
      return EMPTY_FILTERS;
    case 'APPLY_PREVIEW':
      return action.payload;
    default:
      return state;
  }
}

interface FilterContextValue {
  // Active filters (applied to grid)
  activeFilters: FilterState;
  setLocation: (filter: LocationFilter | null) => void;
  setAlphabet: (filter: AlphabetFilter | null) => void;
  setTime: (filter: TimeFilter | null) => void;
  setCategory: (filter: CategoryFilter | null) => void;
  setHierarchy: (filter: HierarchyFilter | null) => void;
  setDSL: (dsl: string | null) => void;
  clearAll: () => void;
  activeCount: number;

  // Preview filters (being edited in overlay, not yet applied)
  previewFilters: FilterState | null;
  setPreviewLocation: (filter: LocationFilter | null) => void;
  setPreviewAlphabet: (filter: AlphabetFilter | null) => void;
  setPreviewTime: (filter: TimeFilter | null) => void;
  setPreviewCategory: (filter: CategoryFilter | null) => void;
  setPreviewHierarchy: (filter: HierarchyFilter | null) => void;
  clearPreviewFilters: () => void;
  applyPreviewFilters: () => void;
  startPreview: () => void;
  cancelPreview: () => void;

  // Preset management
  presets: FilterPreset[];
  saveCurrentAsPreset: (name: string) => FilterPreset;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  listPresets: () => FilterPreset[];
  checkPresetNameExists: (name: string, excludeId?: string) => boolean;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [activeFilters, dispatch] = useReducer(filterReducer, EMPTY_FILTERS);
  const [previewFilters, setPreviewFilters] = useState<FilterState | null>(null);
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  // Load presets from localStorage on mount
  useEffect(() => {
    const loadedPresets = loadPresets();
    setPresets(loadedPresets);
  }, []);

  // Active filter setters (directly applied)
  const setLocation = useCallback((filter: LocationFilter | null) => {
    dispatch({ type: 'SET_LOCATION', payload: filter });
  }, []);

  const setAlphabet = useCallback((filter: AlphabetFilter | null) => {
    dispatch({ type: 'SET_ALPHABET', payload: filter });
  }, []);

  const setTime = useCallback((filter: TimeFilter | null) => {
    dispatch({ type: 'SET_TIME', payload: filter });
  }, []);

  const setCategory = useCallback((filter: CategoryFilter | null) => {
    dispatch({ type: 'SET_CATEGORY', payload: filter });
  }, []);

  const setHierarchy = useCallback((filter: HierarchyFilter | null) => {
    dispatch({ type: 'SET_HIERARCHY', payload: filter });
  }, []);

  const setDSL = useCallback((dsl: string | null) => {
    dispatch({ type: 'SET_DSL', payload: dsl });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const activeCount = useMemo(() => {
    let count = 0;
    if (activeFilters.location) count++;
    if (activeFilters.alphabet) count++;
    if (activeFilters.time) count++;
    if (activeFilters.category) count++;
    if (activeFilters.hierarchy) count++;
    if (activeFilters.dsl) count++;
    return count;
  }, [activeFilters]);

  // Preview filter management
  const startPreview = useCallback(() => {
    // Initialize preview with current active filters
    setPreviewFilters({ ...activeFilters });
  }, [activeFilters]);

  const cancelPreview = useCallback(() => {
    setPreviewFilters(null);
  }, []);

  const setPreviewLocation = useCallback((filter: LocationFilter | null) => {
    setPreviewFilters((prev) => {
      if (!prev) return null;
      return { ...prev, location: filter, dsl: null };
    });
  }, []);

  const setPreviewAlphabet = useCallback((filter: AlphabetFilter | null) => {
    setPreviewFilters((prev) => {
      if (!prev) return null;
      return { ...prev, alphabet: filter, dsl: null };
    });
  }, []);

  const setPreviewTime = useCallback((filter: TimeFilter | null) => {
    setPreviewFilters((prev) => {
      if (!prev) return null;
      return { ...prev, time: filter, dsl: null };
    });
  }, []);

  const setPreviewCategory = useCallback((filter: CategoryFilter | null) => {
    setPreviewFilters((prev) => {
      if (!prev) return null;
      return { ...prev, category: filter, dsl: null };
    });
  }, []);

  const setPreviewHierarchy = useCallback((filter: HierarchyFilter | null) => {
    setPreviewFilters((prev) => {
      if (!prev) return null;
      return { ...prev, hierarchy: filter, dsl: null };
    });
  }, []);

  const clearPreviewFilters = useCallback(() => {
    setPreviewFilters(EMPTY_FILTERS);
  }, []);

  const applyPreviewFilters = useCallback(() => {
    if (previewFilters) {
      dispatch({ type: 'APPLY_PREVIEW', payload: previewFilters });
      setPreviewFilters(null);
    }
  }, [previewFilters]);

  // Preset management methods
  const saveCurrentAsPreset = useCallback((name: string): FilterPreset => {
    const preset: FilterPreset = {
      id: generatePresetId(),
      name,
      filters: { ...activeFilters },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    savePresetToStorage(preset);
    setPresets(loadPresets());
    return preset;
  }, [activeFilters]);

  const loadPresetById = useCallback((id: string) => {
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      dispatch({ type: 'APPLY_PREVIEW', payload: preset.filters });
    }
  }, [presets]);

  const deletePresetById = useCallback((id: string) => {
    deletePresetFromStorage(id);
    setPresets(loadPresets());
  }, []);

  const listPresets = useCallback(() => {
    return presets;
  }, [presets]);

  const checkPresetNameExists = useCallback((name: string, excludeId?: string) => {
    return presetNameExists(name, excludeId);
  }, []);

  return (
    <FilterContext.Provider
      value={{
        activeFilters,
        setLocation,
        setAlphabet,
        setTime,
        setCategory,
        setHierarchy,
        setDSL,
        clearAll,
        activeCount,
        previewFilters,
        setPreviewLocation,
        setPreviewAlphabet,
        setPreviewTime,
        setPreviewCategory,
        setPreviewHierarchy,
        clearPreviewFilters,
        applyPreviewFilters,
        startPreview,
        cancelPreview,
        presets,
        saveCurrentAsPreset,
        loadPreset: loadPresetById,
        deletePreset: deletePresetById,
        listPresets,
        checkPresetNameExists,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }
  return context;
}

// Backward compatibility export
export const useFilter = useFilters;
