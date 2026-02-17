import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import { useRenderLoopGuard } from '../hooks/debug/useRenderLoopGuard';
import type { PAFVState, AxisMapping, Plane, LATCHAxis, DensityLevel, EncodingConfig, SortConfig } from '../types/pafv';
import { DEFAULT_PAFV } from '../types/pafv';
import {
  setMapping as setMappingUtil,
  removeMapping,
  getMappingForPlane,
  getPlaneForAxis,
  addMappingToPlane as addMappingUtil,
  removeFacetFromPlane as removeFacetUtil,
  reorderMappingsInPlane as reorderMappingsUtil,
  getMappingsForPlane as getMappingsUtil,
  moveFacetToPlane as moveFacetUtil,
  moveFacetToPlaneAtIndex as moveFacetAtIndexUtil,
  clearFacetFromAllPlanes as clearFacetUtil,
} from '../utils/pafv-serialization';
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
  // Render loop guard - warns if provider renders >10x/second (indicates infinite loop)
  useRenderLoopGuard({ componentName: 'PAFVProvider' });

  // Use URL state for persistence
  const [state, setState] = useURLState<PAFVState>(
    'pafv',
    DEFAULT_PAFV,
    serializePAFV,
    deserializePAFV
  );

  // Track pending reorder to prevent duplicate/reverting operations during rapid drag.
  // During drag-and-drop, multiple hover events fire before React re-renders.
  // Without this, the same reorder can be triggered multiple times, reverting changes.
  const pendingReorderRef = useRef<{
    plane: Plane;
    fromFacet: string;
    toFacet: string;
    timestamp: number;
  } | null>(null);

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

  const addMappingToPlaneCallback = useCallback((mapping: AxisMapping) => {
    const newState = addMappingUtil(state, mapping);
    setState(newState);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  const removeFacetFromPlaneCallback = useCallback((plane: Plane, facet: string) => {
    const newState = removeFacetUtil(state, plane, facet);
    setState(newState);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  const reorderMappingsInPlaneCallback = useCallback((plane: Plane, fromIndex: number, toIndex: number) => {
    // Get the facets being reordered for deduplication tracking
    const planeMappings = getMappingsUtil(state, plane);
    if (fromIndex < 0 || fromIndex >= planeMappings.length ||
        toIndex < 0 || toIndex >= planeMappings.length) {
      return;
    }

    const fromFacet = planeMappings[fromIndex]?.facet;
    const toFacet = planeMappings[toIndex]?.facet;

    // CRITICAL: Prevent duplicate/reverting reorders during rapid drag operations.
    // Multiple hover events can fire before React re-renders. If we detect we're
    // trying to reorder the same pair of facets within 100ms, skip it.
    const now = Date.now();
    const pending = pendingReorderRef.current;
    if (pending &&
        pending.plane === plane &&
        pending.fromFacet === toFacet &&
        pending.toFacet === fromFacet &&
        now - pending.timestamp < 100) {
      // This looks like a reverting reorder - skip it
      return;
    }

    // Track this reorder
    pendingReorderRef.current = { plane, fromFacet, toFacet, timestamp: now };

    const newState = reorderMappingsUtil(state, plane, fromIndex, toIndex);
    setState(newState);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(newState);

    // Clear pending after a short delay to allow legitimate reversals
    setTimeout(() => {
      if (pendingReorderRef.current?.timestamp === now) {
        pendingReorderRef.current = null;
      }
    }, 150);
  }, [state, setState]);

  const moveFacetToPlaneCallback = useCallback((fromPlane: Plane, toPlane: Plane, facet: string, axis: LATCHAxis) => {
    const newState = moveFacetUtil(state, fromPlane, toPlane, facet, axis);
    setState(newState);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  const moveFacetToPlaneAtIndexCallback = useCallback((
    fromPlane: Plane, toPlane: Plane, facet: string, axis: LATCHAxis, targetIndex?: number
  ) => {
    const newState = moveFacetAtIndexUtil(state, fromPlane, toPlane, facet, axis, targetIndex);
    setState(newState);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  const clearFacetFromAllPlanesCallback = useCallback((facet: string) => {
    const newState = clearFacetUtil(state, facet);
    setState(newState);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  const getMappingsForPlaneCallback = useCallback((plane: Plane): AxisMapping[] => {
    return getMappingsUtil(state, plane);
  }, [state]);

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
        densityLevel: state.densityLevel, // Preserve density level
        colorEncoding: state.colorEncoding, // Preserve encoding
        sizeEncoding: state.sizeEncoding,
        sortConfig: state.sortConfig, // Preserve sort config
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
        densityLevel: state.densityLevel, // Preserve density level
        colorEncoding: state.colorEncoding, // Preserve encoding
        sizeEncoding: state.sizeEncoding,
        sortConfig: state.sortConfig, // Preserve sort config
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

  const setDensityLevel = useCallback((level: DensityLevel) => {
    const newState: PAFVState = { ...state, densityLevel: level };
    setState(newState);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  const setColorEncoding = useCallback((encoding: EncodingConfig | null) => {
    const newState: PAFVState = { ...state, colorEncoding: encoding };
    setState(newState);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  const setSizeEncoding = useCallback((encoding: EncodingConfig | null) => {
    const newState: PAFVState = { ...state, sizeEncoding: encoding };
    setState(newState);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  const setSortBy = useCallback((sortConfig: SortConfig | null) => {
    const newState: PAFVState = { ...state, sortConfig };
    setState(newState);

    // Send to native bridge
    pafvBridge.sendAxisMappingUpdate(newState);
  }, [state, setState]);

  // CRITICAL: Memoize context value to prevent infinite render loops
  // Without useMemo, a new object is created every render, causing all consumers
  // to re-render even when values haven't changed (see Phase 59-01 for details)
  const value: PAFVContextValue = useMemo(() => ({
    state,
    setMapping,
    removeMapping: removeMappingCallback,
    addMappingToPlane: addMappingToPlaneCallback,
    removeFacetFromPlane: removeFacetFromPlaneCallback,
    reorderMappingsInPlane: reorderMappingsInPlaneCallback,
    moveFacetToPlane: moveFacetToPlaneCallback,
    moveFacetToPlaneAtIndex: moveFacetToPlaneAtIndexCallback,
    clearFacetFromAllPlanes: clearFacetFromAllPlanesCallback,
    getMappingsForPlane: getMappingsForPlaneCallback,
    setViewMode,
    setDensityLevel,
    setColorEncoding,
    setSizeEncoding,
    setSortBy,
    resetToDefaults,
    getAxisForPlane,
    getPlaneForAxis: getPlaneForAxisCallback,
  }), [
    state,
    setMapping,
    removeMappingCallback,
    addMappingToPlaneCallback,
    removeFacetFromPlaneCallback,
    reorderMappingsInPlaneCallback,
    moveFacetToPlaneCallback,
    moveFacetToPlaneAtIndexCallback,
    clearFacetFromAllPlanesCallback,
    getMappingsForPlaneCallback,
    setViewMode,
    setDensityLevel,
    setColorEncoding,
    setSizeEncoding,
    setSortBy,
    resetToDefaults,
    getAxisForPlane,
    getPlaneForAxisCallback,
  ]);

  return (
    <PAFVContext.Provider value={value}>
      {children}
    </PAFVContext.Provider>
  );
}

// Export usePAFV hook for convenience
export { usePAFV } from '../hooks/data/usePAFV';
