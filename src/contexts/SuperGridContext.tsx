/**
 * SuperGridContext - React Context for SuperGrid Engine
 *
 * Provides React integration for SuperGridEngine, managing state across
 * all Super* components and providing a unified API for feature interaction.
 */

import React, { createContext, useContext, useCallback, useRef, useEffect, useState } from 'react';
import { SuperGridEngine, createSuperGridEngine } from '@/engine/SuperGridEngine';
import type {
  SuperGridState,
  SuperGridConfig,
  SuperGridEventHandlers,
  SuperFeatureFlags
} from '@/engine/SuperGridEngine';
import type { Node } from '@/types/node';
import type { LATCHAxis } from '@/types/pafv';
import type { JanusDensityState } from '@/types/supergrid';
import type { CellExpansionState } from '@/components/supergrid/SuperSize';
import type { CartographicState } from '@/types/supergrid';

interface SuperGridContextValue {
  // State
  state: SuperGridState;
  engine: SuperGridEngine;

  // Core methods
  updateNodes: (nodes: Node[]) => void;
  updateState: (partialState: Partial<SuperGridState>) => void;

  // Feature toggles
  toggleFeature: (feature: keyof SuperFeatureFlags, enabled?: boolean) => void;
  isFeatureEnabled: (feature: keyof SuperFeatureFlags) => boolean;

  // Super* feature methods
  updateDensity: (density: Partial<JanusDensityState>) => void;
  updateCellExpansion: (expansion: Partial<CellExpansionState>) => void;
  updateCartographic: (cartographic: Partial<CartographicState>) => void;
  updateSearch: (query: string) => void;
  reorderAxis: (fromAxis: LATCHAxis, toAxis: LATCHAxis) => void;
  toggleAuditMode: (enabled?: boolean) => void;

  // Data access
  getFilteredNodes: () => Node[];
  getFeatureConfig: <T extends keyof SuperGridConfig>(feature: T) => SuperGridConfig[T];
}

const SuperGridContext = createContext<SuperGridContextValue | null>(null);

interface SuperGridProviderProps {
  children: React.ReactNode;
  /** Initial state for SuperGrid */
  initialState?: Partial<SuperGridState>;
  /** Configuration for Super* features */
  config?: Partial<SuperGridConfig>;
  /** Event handlers */
  eventHandlers?: SuperGridEventHandlers;
}

/**
 * SuperGridProvider - Manages SuperGrid state and engine
 */
export function SuperGridProvider({
  children,
  initialState = {},
  config = {},
  eventHandlers = {}
}: SuperGridProviderProps) {
  const engineRef = useRef<SuperGridEngine | null>(null);
  const [state, setState] = useState<SuperGridState>(() => {
    const engine = createSuperGridEngine(initialState, config, eventHandlers);
    engineRef.current = engine;
    return engine.getState();
  });

  // Sync state when engine changes
  const syncState = useCallback(() => {
    if (engineRef.current) {
      setState(engineRef.current.getState());
    }
  }, []);

  // Update engine event handlers to include state sync
  useEffect(() => {
    if (engineRef.current) {
      const originalOnStateChange = eventHandlers.onStateChange;
      engineRef.current = createSuperGridEngine(
        initialState,
        config,
        {
          ...eventHandlers,
          onStateChange: (partialState) => {
            syncState();
            originalOnStateChange?.(partialState);
          }
        }
      );
      syncState();
    }
  }, [eventHandlers, config, syncState, initialState]);

  // Context value
  const contextValue: SuperGridContextValue = {
    state,
    engine: engineRef.current!,

    updateNodes: useCallback((nodes: Node[]) => {
      engineRef.current?.updateNodes(nodes);
      syncState();
    }, [syncState]),

    updateState: useCallback((partialState: Partial<SuperGridState>) => {
      engineRef.current?.updateState(partialState);
      syncState();
    }, [syncState]),

    toggleFeature: useCallback((feature: keyof SuperFeatureFlags, enabled?: boolean) => {
      engineRef.current?.toggleFeature(feature, enabled);
      syncState();
    }, [syncState]),

    isFeatureEnabled: useCallback((feature: keyof SuperFeatureFlags) => {
      return engineRef.current?.isFeatureEnabled(feature) ?? false;
    }, []),

    updateDensity: useCallback((density: Partial<JanusDensityState>) => {
      engineRef.current?.updateDensity(density);
      syncState();
    }, [syncState]),

    updateCellExpansion: useCallback((expansion: Partial<CellExpansionState>) => {
      engineRef.current?.updateCellExpansion(expansion);
      syncState();
    }, [syncState]),

    updateCartographic: useCallback((cartographic: Partial<CartographicState>) => {
      engineRef.current?.updateCartographic(cartographic);
      syncState();
    }, [syncState]),

    updateSearch: useCallback((query: string) => {
      engineRef.current?.updateSearch(query);
      syncState();
    }, [syncState]),

    reorderAxis: useCallback((fromAxis: LATCHAxis, toAxis: LATCHAxis) => {
      engineRef.current?.reorderAxis(fromAxis, toAxis);
      syncState();
    }, [syncState]),

    toggleAuditMode: useCallback((enabled?: boolean) => {
      engineRef.current?.toggleAuditMode(enabled);
      syncState();
    }, [syncState]),

    getFilteredNodes: useCallback(() => {
      return engineRef.current?.getFilteredNodes() ?? [];
    }, []),

    getFeatureConfig: useCallback(<T extends keyof SuperGridConfig>(feature: T) => {
      return engineRef.current?.getFeatureConfig(feature) ?? ({} as SuperGridConfig[T]);
    }, [])
  };

  return (
    <SuperGridContext.Provider value={contextValue}>
      {children}
    </SuperGridContext.Provider>
  );
}

/**
 * Hook to use SuperGrid context
 */
export function useSuperGrid(): SuperGridContextValue {
  const context = useContext(SuperGridContext);
  if (!context) {
    throw new Error('useSuperGrid must be used within a SuperGridProvider');
  }
  return context;
}

/**
 * Hook to access specific Super* feature state
 */
export function useSuperFeature<T extends keyof SuperFeatureFlags>(feature: T) {
  const { state, toggleFeature, isFeatureEnabled, getFeatureConfig } = useSuperGrid();

  return {
    enabled: isFeatureEnabled(feature),
    toggle: useCallback((enabled?: boolean) => toggleFeature(feature, enabled), [toggleFeature, feature]),
    config: getFeatureConfig(feature as keyof SuperGridConfig),
    state
  };
}

/**
 * Hook for SuperDensity feature
 */
export function useSuperDensity() {
  const { state, updateDensity, isFeatureEnabled, getFeatureConfig } = useSuperGrid();

  return {
    enabled: isFeatureEnabled('enableSuperDensity'),
    state: state.density,
    config: getFeatureConfig('density'),
    updateDensity
  };
}

/**
 * Hook for SuperSize feature
 */
export function useSuperSize() {
  const { state, updateCellExpansion, isFeatureEnabled, getFeatureConfig } = useSuperGrid();

  return {
    enabled: isFeatureEnabled('enableSuperSize'),
    state: state.expansion,
    config: getFeatureConfig('size'),
    updateExpansion: updateCellExpansion
  };
}

/**
 * Hook for SuperZoom feature
 */
export function useSuperZoom() {
  const { state, updateCartographic, isFeatureEnabled, getFeatureConfig } = useSuperGrid();

  return {
    enabled: isFeatureEnabled('enableSuperZoom'),
    state: state.cartographic,
    config: getFeatureConfig('zoom'),
    updateCartographic
  };
}

/**
 * Hook for SuperSearch feature
 */
export function useSuperSearch() {
  const { state, updateSearch, isFeatureEnabled, getFeatureConfig, getFilteredNodes } = useSuperGrid();

  return {
    enabled: isFeatureEnabled('enableSuperSearch'),
    state: state.search,
    config: getFeatureConfig('search'),
    search: updateSearch,
    filteredNodes: getFilteredNodes()
  };
}

/**
 * Hook for SuperAudit feature
 */
export function useSuperAudit() {
  const { state, toggleAuditMode, isFeatureEnabled, getFeatureConfig } = useSuperGrid();

  return {
    enabled: isFeatureEnabled('enableSuperAudit'),
    state: state.audit,
    config: getFeatureConfig('audit'),
    toggle: toggleAuditMode
  };
}

export default SuperGridContext;