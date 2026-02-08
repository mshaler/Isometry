import { useState, useCallback } from 'react';

export type LATCHDimension = 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy';
export type Plane = 'x' | 'y' | 'z';

export interface AxisMapping {
  dimension: LATCHDimension;
  field: string;
  plane: Plane;
}

export interface PAFVState {
  mappings: AxisMapping[];
  activeView: string;
  zoomLevel: number;
  density: number;
}

export interface PAFVMethods {
  setMapping: (plane: Plane, dimension: LATCHDimension, field: string) => void;
  removeMapping: (plane: Plane) => void;
  getMappingForPlane: (plane: Plane) => AxisMapping | null;
  getPlaneForDimension: (dimension: LATCHDimension) => Plane | null;
  setActiveView: (view: string) => void;
  setZoomLevel: (level: number) => void;
  setDensity: (density: number) => void;
  reset: () => void;
}

/**
 * Hook for PAFV (Planes → Axes → Facets → Values) state management
 * Core spatial projection system for SuperGrid
 */
export function usePAFV(): PAFVState & PAFVMethods {
  const [state, setState] = useState<PAFVState>({
    mappings: [
      { dimension: 'category', field: 'status', plane: 'x' } as AxisMapping,
      { dimension: 'hierarchy', field: 'priority', plane: 'y' } as AxisMapping
    ],
    activeView: 'grid',
    zoomLevel: 1,
    density: 0.5
  });

  const setMapping = useCallback((plane: Plane, dimension: LATCHDimension, field: string) => {
    setState(prev => ({
      ...prev,
      mappings: [
        ...prev.mappings.filter(m => m.plane !== plane),
        { dimension, field, plane }
      ]
    }));
  }, []);

  const removeMapping = useCallback((plane: Plane) => {
    setState(prev => ({
      ...prev,
      mappings: prev.mappings.filter(m => m.plane !== plane)
    }));
  }, []);

  const getMappingForPlane = useCallback((plane: Plane): AxisMapping | null => {
    return state.mappings.find(m => m.plane === plane) || null;
  }, [state.mappings]);

  const getPlaneForDimension = useCallback((dimension: LATCHDimension): Plane | null => {
    const mapping = state.mappings.find(m => m.dimension === dimension);
    return mapping ? mapping.plane : null;
  }, [state.mappings]);

  const setActiveView = useCallback((view: string) => {
    setState(prev => ({ ...prev, activeView: view }));
  }, []);

  const setZoomLevel = useCallback((level: number) => {
    setState(prev => ({ ...prev, zoomLevel: Math.max(0.1, Math.min(10, level)) }));
  }, []);

  const setDensity = useCallback((density: number) => {
    setState(prev => ({ ...prev, density: Math.max(0, Math.min(1, density)) }));
  }, []);

  const reset = useCallback(() => {
    setState({
      mappings: [
        { dimension: 'category', field: 'status', plane: 'x' } as AxisMapping,
        { dimension: 'hierarchy', field: 'priority', plane: 'y' } as AxisMapping
      ],
      activeView: 'grid',
      zoomLevel: 1,
      density: 0.5
    });
  }, []);

  return {
    ...state,
    setMapping,
    removeMapping,
    getMappingForPlane,
    getPlaneForDimension,
    setActiveView,
    setZoomLevel,
    setDensity,
    reset
  };
}