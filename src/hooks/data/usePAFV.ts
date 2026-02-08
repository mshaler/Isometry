import { useContext } from 'react';
import { createContext } from 'react';
import type { PAFVState, AxisMapping, Plane, LATCHAxis } from '../../types/pafv';

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
    console.error('❌ usePAFV: Context not found. This will cause a blank screen. Ensure PAFVProvider wraps the component tree.');
    console.error('❌ Current component tree may be missing PAFVProvider from state/PAFVContext.tsx');
    console.error('❌ Stack trace for debugging:', new Error().stack);
    throw new Error('usePAFV must be used within PAFVProvider');
  }

  return context;
}
