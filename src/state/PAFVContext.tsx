import React, { useState, useCallback } from 'react';
import type { PAFVState, AxisMapping, Plane, LATCHAxis } from '../types/pafv';
import { DEFAULT_PAFV } from '../types/pafv';
import { setMapping as setMappingUtil, removeMapping, getMappingForPlane, getPlaneForAxis } from '../utils/pafv-serialization';
import { PAFVContext, type PAFVContextValue } from '../hooks/usePAFV';

export function PAFVProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PAFVState>(DEFAULT_PAFV);

  const setMapping = useCallback((mapping: AxisMapping) => {
    setState(prevState => setMappingUtil(prevState, mapping));
  }, []);

  const removeMappingCallback = useCallback((plane: Plane) => {
    setState(prevState => removeMapping(prevState, plane));
  }, []);

  const setViewMode = useCallback((mode: 'grid' | 'list') => {
    setState(prevState => ({
      ...prevState,
      viewMode: mode,
    }));
  }, []);

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
