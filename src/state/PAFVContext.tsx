import React, { useCallback, useEffect, useRef } from 'react';
import type { PAFVState, AxisMapping, Plane, LATCHAxis } from '../types/pafv';
import { DEFAULT_PAFV } from '../types/pafv';
import { setMapping as setMappingUtil, removeMapping, getMappingForPlane, getPlaneForAxis } from '../utils/pafv-serialization';
import { serializePAFV, deserializePAFV } from '../utils/pafv-serialization';
import { useURLState } from '../hooks/ui/useURLState';
import { PAFVContext, type PAFVContextValue } from '../hooks/data/usePAFV';
// Bridge eliminated in v4 - sql.js direct access
// import { pafvBridge } from '../utils/pafv-bridge';

// Stub implementation for bridge elimination
const pafvBridge = {
  dispose: () => { console.warn('Bridge eliminated: pafvBridge.dispose'); },
  sendAxisMappingUpdate: (state: unknown) => { console.warn('Bridge eliminated: pafvBridge.sendAxisMappingUpdate', state); }
};

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

  // Cleanup bridge on unmount
  useEffect(() => {
    return () => {
      pafvBridge.dispose();
    };
  }, []);

  const setMapping = useCallback((mapping: AxisMapping) => {
    const newState = setMappingUtil(state, mapping);
    setState(newState);

    // Send to native bridge for real-time SuperGrid updates
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  const removeMappingCallback = useCallback((plane: Plane) => {
    const newState = removeMapping(state, plane);
    setState(newState);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  const setViewMode = useCallback((mode: 'grid' | 'list') => {
    let newState: PAFVState;

    // If switching view modes, preserve and restore previous mappings
    if (state.viewMode === mode) {
      // No change, just update viewMode
      newState = { ...state, viewMode: mode };
      setState(newState);
      return;
    }

    // When switching to Grid, restore last Grid mappings
    if (mode === 'grid') {
      newState = {
        viewMode: mode,
        mappings: lastGridMappings.current.length > 0
          ? lastGridMappings.current
          : DEFAULT_PAFV.mappings,
      };
      setState(newState);
      pafvBridge.sendAxisMappingUpdate(newState);
      return;
    }

    // When switching to List, restore last List mappings
    if (mode === 'list') {
      newState = {
        viewMode: mode,
        mappings: lastListMappings.current.length > 0
          ? lastListMappings.current
          : state.mappings, // Preserve current mappings if no list history
      };
      setState(newState);
      pafvBridge.sendAxisMappingUpdate(newState);
      return;
    }

    newState = { ...state, viewMode: mode };
    setState(newState);
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  const resetToDefaults = useCallback(() => {
    setState(DEFAULT_PAFV);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(DEFAULT_PAFV);
  }, [setState]);

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
export { usePAFV } from '../hooks/data/usePAFV';
