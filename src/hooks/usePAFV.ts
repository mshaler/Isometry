import { useContext } from 'react';
import { createContext } from 'react';
import type { PAFVState, AxisMapping, Plane, LATCHAxis } from '../types/pafv';

// Re-export the context interface for use in tests
export interface PAFVContextValue {
  state: PAFVState;
  setMapping: (mapping: AxisMapping) => void;
  removeMapping: (plane: Plane) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
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
    throw new Error('usePAFV must be used within PAFVProvider');
  }

  return context;
}
