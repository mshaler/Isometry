import React, { useCallback, useEffect, useRef } from 'react';
import type { PAFVState, AxisMapping, Plane, LATCHAxis } from '../types/pafv';
import { DEFAULT_PAFV } from '../types/pafv';
import { setMapping as setMappingUtil, removeMapping, getMappingForPlane, getPlaneForAxis } from '../utils/pafv-serialization';
import { serializePAFV, deserializePAFV } from '../utils/pafv-serialization';
import { useURLState } from '../hooks/useURLState';
import { PAFVContext, type PAFVContextValue } from '../hooks/usePAFV';

export function PAFVProvider({ children }: { children: React.ReactNode }) {
  // Use URL state for persistence
  const [state, setState] = useURLState<PAFVState>(
    'pafv',
    DEFAULT_PAFV,
    serializePAFV,
    deserializePAFV
  );

  // Store last Grid and List mappings for smooth view transitions
  const lastGridMappings = useRef<AxisMapping[]>(
    state.viewMode === 'grid' ? state.mappings : DEFAULT_PAFV.mappings
  );
  const lastListMappings = useRef<AxisMapping[]>(
    state.viewMode === 'list' ? state.mappings : []
  );

  // Update last mappings when state changes
  useEffect(() => {
    if (state.viewMode === 'grid') {
      lastGridMappings.current = state.mappings;
    } else if (state.viewMode === 'list') {
      lastListMappings.current = state.mappings;
    }
  }, [state.mappings, state.viewMode]);

  const setMapping = useCallback((mapping: AxisMapping) => {
    setState(prevState => setMappingUtil(prevState, mapping));
  }, []);

  const removeMappingCallback = useCallback((plane: Plane) => {
    setState(prevState => removeMapping(prevState, plane));
  }, []);

  const setViewMode = useCallback((mode: 'grid' | 'list') => {
    setState(prevState => {
      // If switching view modes, preserve and restore previous mappings
      if (prevState.viewMode === mode) {
        // No change, just update viewMode
        return { ...prevState, viewMode: mode };
      }

      // When switching to Grid, restore last Grid mappings
      if (mode === 'grid') {
        return {
          viewMode: mode,
          mappings: lastGridMappings.current.length > 0
            ? lastGridMappings.current
            : DEFAULT_PAFV.mappings,
        };
      }

      // When switching to List, restore last List mappings
      if (mode === 'list') {
        return {
          viewMode: mode,
          mappings: lastListMappings.current.length > 0
            ? lastListMappings.current
            : prevState.mappings, // Preserve current mappings if no list history
        };
      }

      return { ...prevState, viewMode: mode };
    });
  }, [setState]);

  const resetToDefaults = useCallback(() => {
    setState(DEFAULT_PAFV);
  }, []);

  const getAxisForPlane = useCallback((plane: Plane): LATCHAxis | null => {
    const mapping = getMappingForPlane(state, plane);
    return mapping ? mapping.axis : null;
  }, [state]);

  const getPlaneForAxisCallback = useCallback((axis: LATCHAxis): Plane | null => {
    return getPlaneForAxis(state, axis);
  }, [state]);

  const value: PAFVContextValue = {
    state,
    setMapping,
    removeMapping: removeMappingCallback,
    setViewMode,
    resetToDefaults,
    getAxisForPlane,
    getPlaneForAxis: getPlaneForAxisCallback,
  };

  return (
    <PAFVContext.Provider value={value}>
      {children}
    </PAFVContext.Provider>
  );
}

// Export usePAFV hook for convenience
export { usePAFV } from '../hooks/usePAFV';
