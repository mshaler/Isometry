import React, { createContext, useContext, useReducer, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import type {
  FilterState,
  LocationFilter,
  AlphabetFilter,
  TimeFilter,
  CategoryFilter,
  HierarchyFilter,
  FilterPreset
} from '../types/filter';
import type { Node } from '../types/node';
import { EMPTY_FILTERS } from '../types/filter';
import {
  loadPresets,
  savePreset as savePresetToStorage,
  deletePreset as deletePresetFromStorage,
  generatePresetId,
  presetNameExists
} from '../utils/filter-presets';
import { useURLState } from '../hooks/ui/useURLState';
import { serializeFilters, deserializeFilters, validateFilterURLLength } from '../utils/filter-serialization';
// Bridge functions replaced with local implementations (bridge eliminated)
const useBridgeFilters = () => null; // Returns null since bridge is eliminated
const isBridgeAvailable = () => false; // Always false - bridge eliminated

type FilterAction =
  | { type: 'SET_LOCATION'; payload: LocationFilter | null }
  | { type: 'SET_ALPHABET'; payload: AlphabetFilter | null }
  | { type: 'SET_TIME'; payload: TimeFilter | null }
  | { type: 'SET_CATEGORY'; payload: CategoryFilter | null }
  | { type: 'SET_HIERARCHY'; payload: HierarchyFilter | null }
  | { type: 'SET_DSL'; payload: string | null }
  | { type: 'CLEAR_ALL' }
  | { type: 'APPLY_PREVIEW'; payload: FilterState }
  | { type: 'BRIDGE_RESULTS_RECEIVED'; payload: { nodes: Node[]; sequenceId: string | null } }
  | { type: 'BRIDGE_MODE_CHANGED'; payload: { isBridge: boolean } };

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
    case 'BRIDGE_RESULTS_RECEIVED':
      // Bridge actions don't modify filter state itself, just trigger effects
      return state;
    case 'BRIDGE_MODE_CHANGED':
      // Bridge mode changes don't modify filter state itself
      return state;
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
  checkPresetNameExists: (name: string, excludeId?: string) => Promise<boolean>;

  // Bridge integration
  isBridgeMode: boolean;
  isBridgeAvailable: boolean;
  bridgeResults: Node[];
  bridgeIsLoading: boolean;
  bridgeError: string | null;
  bridgeSequenceId: string | null;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  // URL state integration with debouncing
  const [urlFilters, setUrlFilters] = useURLState<FilterState>(
    'filters',
    EMPTY_FILTERS,
    serializeFilters,
    deserializeFilters
  );

  const [activeFilters, dispatch] = useReducer(filterReducer, urlFilters);
  const [previewFilters, setPreviewFilters] = useState<FilterState | null>(null);
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  // Bridge state management
  const [bridgeMode, setBridgeMode] = useState<boolean>(false);
  const [bridgeAvailable, setBridgeAvailable] = useState<boolean>(false);

  // Debounce timer for URL updates (300ms)
  const urlUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize bridge filters hook with debounced execution (only when bridge mode is active)
  const bridgeFilterState = useBridgeFilters();

  const bridgeResults = bridgeMode && bridgeFilterState ? ((bridgeFilterState as any)?.filteredNodes || []) : [];
  const bridgeIsLoading = bridgeMode && bridgeFilterState ? ((bridgeFilterState as any)?.isLoading || false) : false;
  const bridgeError = bridgeMode && bridgeFilterState ? ((bridgeFilterState as any)?.error || null) : null;
  const bridgeSequenceId = bridgeMode && bridgeFilterState ? ((bridgeFilterState as any)?.lastSequenceId || null) : null;

  // Bridge availability detection and mode management
  useEffect(() => {
    const checkBridgeAvailability = () => {
      const isAvailable = isBridgeAvailable();
      setBridgeAvailable(isAvailable);

      // Auto-enable bridge mode when available (but allow user override)
      if (isAvailable && !bridgeMode) {
        setBridgeMode(true);
        dispatch({ type: 'BRIDGE_MODE_CHANGED', payload: { isBridge: true } });
      } else if (!isAvailable && bridgeMode) {
        // Fall back to sql.js when bridge becomes unavailable
        setBridgeMode(false);
        dispatch({ type: 'BRIDGE_MODE_CHANGED', payload: { isBridge: false } });
      }
    };

    // Check immediately
    checkBridgeAvailability();

    // Listen for bridge ready events
    const handleBridgeReady = () => {
      checkBridgeAvailability();
    };

    // Set up periodic check in case bridge becomes available later
    const intervalId = setInterval(checkBridgeAvailability, 5000);

    window.addEventListener('isometry-bridge-ready', handleBridgeReady);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('isometry-bridge-ready', handleBridgeReady);
    };
  }, [bridgeMode]);

  // Load presets from localStorage on mount
  useEffect(() => {
    const loadPresetsAsync = async () => {
      const loadedPresets = await loadPresets();
      setPresets(loadedPresets);
    };
    loadPresetsAsync();
  }, []);

  // Handle bridge results and sequence management
  useEffect(() => {
    if (bridgeMode && bridgeResults.length > 0 && bridgeSequenceId) {
      dispatch({
        type: 'BRIDGE_RESULTS_RECEIVED',
        payload: {
          nodes: bridgeResults,
          sequenceId: bridgeSequenceId
        }
      });
    }
  }, [bridgeMode, bridgeResults, bridgeSequenceId]);

  // Sync activeFilters to URL with debouncing
  useEffect(() => {
    // Clear existing timer
    if (urlUpdateTimerRef.current) {
      clearTimeout(urlUpdateTimerRef.current);
    }

    // Set new timer for debounced URL update
    urlUpdateTimerRef.current = setTimeout(() => {
      // Validate URL length before updating
      const serialized = serializeFilters(activeFilters);

      if (!validateFilterURLLength(serialized)) {
        console.warn(
          'Filter state is too complex for URL (>1500 characters).',
          'Consider saving as a preset instead.',
          `Current length: ${serialized.length}`
        );
        // Still update URL, but user is warned
        // Alternative: could skip URL update and rely on presets only
      }

      setUrlFilters(activeFilters);
    }, 300);

    // Cleanup on unmount
    return () => {
      if (urlUpdateTimerRef.current) {
        clearTimeout(urlUpdateTimerRef.current);
      }
    };
  }, [activeFilters, setUrlFilters]);

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
    loadPresets().then(setPresets);
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
    loadPresets().then(setPresets);
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
        isBridgeMode: bridgeMode,
        isBridgeAvailable: bridgeAvailable,
        bridgeResults,
        bridgeIsLoading,
        bridgeError,
        bridgeSequenceId,
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
