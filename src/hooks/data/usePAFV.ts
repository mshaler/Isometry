import { useContext } from 'react';
import { createContext } from 'react';
import type { PAFVState, AxisMapping, Plane, LATCHAxis, DensityLevel, EncodingConfig, SortConfig } from '../../types/pafv';

// Re-export the context interface for use in tests
export interface PAFVContextValue {
  state: PAFVState;
  setMapping: (mapping: AxisMapping) => void;
  removeMapping: (plane: Plane) => void;
  /** Add a mapping to a plane without replacing existing (for stacked axes) */
  addMappingToPlane: (mapping: AxisMapping) => void;
  /** Remove a specific facet from a plane (for stacked axes) */
  removeFacetFromPlane: (plane: Plane, facet: string) => void;
  /** Reorder mappings within a plane (for stacked axes) */
  reorderMappingsInPlane: (plane: Plane, fromIndex: number, toIndex: number) => void;
  /** Move a facet from one plane to another atomically (prevents copy bug) */
  moveFacetToPlane: (fromPlane: Plane, toPlane: Plane, facet: string, axis: LATCHAxis) => void;
  /** Remove a facet from ALL planes atomically (x, y, z) - used when unchecking in LatchNavigator */
  clearFacetFromAllPlanes: (facet: string) => void;
  /** Get all mappings for a plane (for stacked axes) */
  getMappingsForPlane: (plane: Plane) => AxisMapping[];
  setViewMode: (mode: 'grid' | 'list') => void;
  setDensityLevel: (level: DensityLevel) => void;
  setColorEncoding: (encoding: EncodingConfig | null) => void;
  setSizeEncoding: (encoding: EncodingConfig | null) => void;
  /** Set sort configuration for header-based sorting */
  setSortBy: (sortConfig: SortConfig | null) => void;
  resetToDefaults: () => void;
  getAxisForPlane: (plane: Plane) => LATCHAxis | null;
  getPlaneForAxis: (axis: LATCHAxis) => Plane | null;
}

// Export context for direct access if needed
export const PAFVContext = createContext<PAFVContextValue | null>(null);

/**
 * Hook to access PAFV state and actions
 * Must be used within a PAFVProvider
 *
 * @throws Error if used outside PAFVProvider
 * @returns PAFVContextValue with state and actions
 */
export function usePAFV(): PAFVContextValue {
  const context = useContext(PAFVContext);

  if (!context) {
    console.error('❌ usePAFV: Context not found. This will cause a blank screen. Ensure PAFVProvider wraps the component tree.');
    console.error('❌ Current component tree may be missing PAFVProvider from state/PAFVContext.tsx');
    console.error('❌ Stack trace for debugging:', new Error().stack);
    throw new Error('usePAFV must be used within PAFVProvider');
  }

  return context;
}
