/**
 * StateManager - Manages SuperGrid state coordination
 *
 * Extracted from SuperGridEngine.ts to handle state management,
 * change notifications, and state persistence.
 */

import type { Node } from '@/types/node';
import type { LATCHAxis, AxisMapping } from '@/types/pafv';
import type {
  DensityLevel,
  JanusDensityState,
  CartographicState
} from '@/types/supergrid';
import type { CellExpansionState } from '@/components/supergrid/SuperSize';
import type { SuperFeatureFlags } from '../features/FeatureManager';

/**
 * Complete state of the SuperGrid system
 */
export interface SuperGridState {
  // Core data
  nodes: Node[];
  visibleNodes: Node[];

  // Feature states
  features: SuperFeatureFlags;

  // Density and zoom state
  density: JanusDensityState;
  cartographic: CartographicState;

  // Size and expansion state
  cellExpansion: CellExpansionState;

  // Search state
  search: {
    query: string;
    results: Node[];
    isActive: boolean;
  };

  // Axis configuration
  axisMapping: AxisMapping;

  // Audit mode
  audit: {
    enabled: boolean;
    highlightedCells: Set<string>;
    computedCells: Map<string, any>;
  };

  // Performance metrics
  performance: {
    lastRenderTime: number;
    frameRate: number;
    memoryUsage: number;
  };

  // UI state
  ui: {
    isLoading: boolean;
    error: string | null;
    selectedCards: Set<string>;
    focusedCard: string | null;
  };
}

/**
 * Event handlers for state changes
 */
export interface StateEventHandlers {
  onNodesChanged: (nodes: Node[]) => void;
  onDensityChanged: (density: JanusDensityState) => void;
  onCartographicChanged: (cartographic: CartographicState) => void;
  onSearchChanged: (query: string, results: Node[]) => void;
  onAxisMappingChanged: (mapping: AxisMapping) => void;
  onFeatureToggled: (feature: keyof SuperFeatureFlags, enabled: boolean) => void;
  onSelectionChanged: (selectedIds: Set<string>) => void;
  onError: (error: string) => void;
  onPerformanceUpdate: (metrics: any) => void;
}

/**
 * Options for state persistence
 */
export interface StatePersistenceConfig {
  enabled: boolean;
  storageKey: string;
  includeNodes: boolean;
  includeSearch: boolean;
  includeSelection: boolean;
  debounceMs: number;
  versionKey: string;
}

export class StateManager {
  private state: SuperGridState;
  private handlers: StateEventHandlers;
  private persistenceConfig: StatePersistenceConfig;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    initialState: Partial<SuperGridState> = {},
    handlers: Partial<StateEventHandlers> = {},
    persistenceConfig: Partial<StatePersistenceConfig> = {}
  ) {
    this.state = this.createDefaultState(initialState);
    this.handlers = this.createDefaultHandlers(handlers);
    this.persistenceConfig = this.createDefaultPersistenceConfig(persistenceConfig);

    // Load persisted state if enabled
    if (this.persistenceConfig.enabled) {
      this.loadPersistedState();
    }
  }

  /**
   * Get current state
   */
  public getState(): SuperGridState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Update state with partial changes
   */
  public updateState(partialState: Partial<SuperGridState>): void {
    const oldState = this.getState();

    // Apply changes
    this.state = {
      ...this.state,
      ...partialState
    };

    // Notify about specific changes
    this.notifySpecificChanges(oldState, this.state);

    // Schedule persistence
    this.schedulePersistence();
  }

  /**
   * Update nodes and recalculate derived state
   */
  public updateNodes(nodes: Node[]): void {
    this.state.nodes = [...nodes];
    this.recalculateVisibleNodes();
    this.handlers.onNodesChanged(nodes);
    this.schedulePersistence();
  }

  /**
   * Update density configuration
   */
  public updateDensity(density: Partial<JanusDensityState>): void {
    const oldDensity = this.state.density;
    this.state.density = { ...this.state.density, ...density };

    this.recalculateVisibleNodes();
    this.handlers.onDensityChanged(this.state.density);
    this.schedulePersistence();
  }

  /**
   * Update cartographic state
   */
  public updateCartographic(cartographic: Partial<CartographicState>): void {
    const oldCartographic = this.state.cartographic;
    this.state.cartographic = { ...this.state.cartographic, ...cartographic };

    this.handlers.onCartographicChanged(this.state.cartographic);
    this.schedulePersistence();
  }

  /**
   * Update cell expansion state
   */
  public updateCellExpansion(expansion: Partial<CellExpansionState>): void {
    this.state.cellExpansion = { ...this.state.cellExpansion, ...expansion };
    this.schedulePersistence();
  }

  /**
   * Update search query and results
   */
  public updateSearch(query: string): void {
    this.state.search.query = query;
    this.state.search.isActive = query.length > 0;

    if (query.length > 0) {
      this.executeSearch(query);
    } else {
      this.state.search.results = [];
      this.recalculateVisibleNodes();
    }

    this.handlers.onSearchChanged(query, this.state.search.results);
    this.schedulePersistence();
  }

  /**
   * Update axis mapping
   */
  public updateAxisMapping(mapping: Partial<AxisMapping>): void {
    this.state.axisMapping = { ...this.state.axisMapping, ...mapping };
    this.handlers.onAxisMappingChanged(this.state.axisMapping);
    this.schedulePersistence();
  }

  /**
   * Toggle audit mode
   */
  public toggleAuditMode(enabled?: boolean): void {
    this.state.audit.enabled = enabled !== undefined ? enabled : !this.state.audit.enabled;

    if (!this.state.audit.enabled) {
      this.state.audit.highlightedCells.clear();
      this.state.audit.computedCells.clear();
    }

    this.schedulePersistence();
  }

  /**
   * Update selection
   */
  public updateSelection(selectedIds: Set<string>): void {
    this.state.ui.selectedCards = new Set(selectedIds);
    this.handlers.onSelectionChanged(selectedIds);
    this.schedulePersistence();
  }

  /**
   * Set focused card
   */
  public setFocus(cardId: string | null): void {
    this.state.ui.focusedCard = cardId;
    this.schedulePersistence();
  }

  /**
   * Set error state
   */
  public setError(error: string | null): void {
    this.state.ui.error = error;
    if (error) {
      this.handlers.onError(error);
    }
  }

  /**
   * Set loading state
   */
  public setLoading(loading: boolean): void {
    this.state.ui.isLoading = loading;
  }

  /**
   * Update performance metrics
   */
  public updatePerformance(metrics: Partial<SuperGridState['performance']>): void {
    this.state.performance = { ...this.state.performance, ...metrics };
    this.handlers.onPerformanceUpdate(this.state.performance);
  }

  /**
   * Get filtered/visible nodes based on current state
   */
  public getVisibleNodes(): Node[] {
    return [...this.state.visibleNodes];
  }

  /**
   * Clear all state and reset to defaults
   */
  public reset(): void {
    this.state = this.createDefaultState();
    this.clearPersistedState();
  }

  /**
   * Export current state for serialization
   */
  public exportState(): any {
    return {
      ...this.state,
      // Convert Sets and Maps to serializable format
      audit: {
        ...this.state.audit,
        highlightedCells: Array.from(this.state.audit.highlightedCells),
        computedCells: Object.fromEntries(this.state.audit.computedCells)
      },
      ui: {
        ...this.state.ui,
        selectedCards: Array.from(this.state.ui.selectedCards)
      }
    };
  }

  /**
   * Import state from serialized data
   */
  public importState(serializedState: any): void {
    const importedState = {
      ...serializedState,
      // Convert arrays back to Sets and objects back to Maps
      audit: {
        ...serializedState.audit,
        highlightedCells: new Set(serializedState.audit?.highlightedCells || []),
        computedCells: new Map(Object.entries(serializedState.audit?.computedCells || {}))
      },
      ui: {
        ...serializedState.ui,
        selectedCards: new Set(serializedState.ui?.selectedCards || [])
      }
    };

    this.updateState(importedState);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    if (this.persistenceConfig.enabled) {
      this.saveState();
    }
  }

  /**
   * Recalculate visible nodes based on current filters
   */
  private recalculateVisibleNodes(): void {
    let visible = this.state.nodes;

    // Apply search filter
    if (this.state.search.isActive && this.state.search.results.length > 0) {
      const searchIds = new Set(this.state.search.results.map(n => n.id));
      visible = visible.filter(n => searchIds.has(n.id));
    }

    // Apply density filter
    if (this.state.density.extentMode === 'populated-only') {
      // Filter based on density settings
      visible = this.applyDensityFiltering(visible);
    }

    this.state.visibleNodes = visible;
  }

  /**
   * Apply density-based filtering
   */
  private applyDensityFiltering(nodes: Node[]): Node[] {
    // Implement density-based filtering logic
    // This would filter based on the current density settings
    return nodes; // Placeholder
  }

  /**
   * Execute search and update results
   */
  private executeSearch(query: string): void {
    // Implement FTS search logic
    const results = this.state.nodes.filter(node =>
      node.title?.toLowerCase().includes(query.toLowerCase()) ||
      node.content?.toLowerCase().includes(query.toLowerCase())
    );

    this.state.search.results = results;
    this.recalculateVisibleNodes();
  }

  /**
   * Notify about specific state changes
   */
  private notifySpecificChanges(oldState: SuperGridState, newState: SuperGridState): void {
    // Check for specific changes and notify appropriate handlers
    if (oldState.density !== newState.density) {
      this.handlers.onDensityChanged(newState.density);
    }

    if (oldState.cartographic !== newState.cartographic) {
      this.handlers.onCartographicChanged(newState.cartographic);
    }

    if (oldState.axisMapping !== newState.axisMapping) {
      this.handlers.onAxisMappingChanged(newState.axisMapping);
    }
  }

  /**
   * Schedule state persistence
   */
  private schedulePersistence(): void {
    if (!this.persistenceConfig.enabled) return;

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveState();
    }, this.persistenceConfig.debounceMs);
  }

  /**
   * Save state to persistence layer
   */
  private saveState(): void {
    try {
      const stateToSave = this.filterStateForPersistence();
      localStorage.setItem(
        this.persistenceConfig.storageKey,
        JSON.stringify(stateToSave)
      );
    } catch (error) {
      console.warn('Failed to persist SuperGrid state:', error);
    }
  }

  /**
   * Load state from persistence layer
   */
  private loadPersistedState(): void {
    try {
      const saved = localStorage.getItem(this.persistenceConfig.storageKey);
      if (saved) {
        const parsedState = JSON.parse(saved);
        this.importState(parsedState);
      }
    } catch (error) {
      console.warn('Failed to load persisted SuperGrid state:', error);
    }
  }

  /**
   * Clear persisted state
   */
  private clearPersistedState(): void {
    try {
      localStorage.removeItem(this.persistenceConfig.storageKey);
    } catch (error) {
      console.warn('Failed to clear persisted SuperGrid state:', error);
    }
  }

  /**
   * Filter state based on persistence configuration
   */
  private filterStateForPersistence(): any {
    const state = this.exportState();

    if (!this.persistenceConfig.includeNodes) {
      delete state.nodes;
      delete state.visibleNodes;
    }

    if (!this.persistenceConfig.includeSearch) {
      delete state.search;
    }

    if (!this.persistenceConfig.includeSelection) {
      delete state.ui.selectedCards;
      delete state.ui.focusedCard;
    }

    return state;
  }

  /**
   * Create default state
   */
  private createDefaultState(partial: Partial<SuperGridState> = {}): SuperGridState {
    return {
      nodes: [],
      visibleNodes: [],
      features: {
        superStack: true,
        superDensity: true,
        superSize: true,
        superZoom: true,
        superDynamic: false,
        superCalc: false,
        superSearch: true,
        superAudit: false,
        progressiveRendering: true,
        liveUpdates: false,
        collaboration: false,
        performance: false,
        accessibility: true,
        analytics: false
      },
      density: {
        extentMode: 'populated-only',
        extentLevel: 5,
        sparsityThreshold: 0.1,
        valueMode: 'leaf',
        valueLevel: 7,
        aggregationThreshold: 10,
        densityLevel: 'view',
        isOptimal: true,
        renderTime: 0,
        cellCount: 0,
        cardCount: 0
      },
      cartographic: {
        scale: 1,
        translateX: 0,
        translateY: 0,
        rotation: 0,
        zoomLevel: 1,
        zoomCenter: { x: 0, y: 0 },
        zoomAnchor: 'center',
        panVelocity: { x: 0, y: 0 },
        isPanning: false,
        lastPanTime: 0,
        isZooming: false,
        isDragging: false,
        lastInteractionTime: 0,
        viewportBounds: { left: 0, top: 0, right: 1000, bottom: 1000 },
        contentBounds: { left: 0, top: 0, right: 1000, bottom: 1000 },
        isAnimating: false,
        animationStartTime: 0,
        animationDuration: 0,
        animationTarget: {}
      },
      cellExpansion: {
        expandedCells: new Set(),
        defaultExpanded: false,
        animationDuration: 200,
        maxExpandedCells: 5,
        expandOnHover: false
      },
      search: {
        query: '',
        results: [],
        isActive: false
      },
      axisMapping: {
        x: { axis: 'Location', facet: 'city' },
        y: { axis: 'Time', facet: 'created_at' },
        z: { axis: 'Category', facet: 'status' }
      },
      audit: {
        enabled: false,
        highlightedCells: new Set(),
        computedCells: new Map()
      },
      performance: {
        lastRenderTime: 0,
        frameRate: 60,
        memoryUsage: 0
      },
      ui: {
        isLoading: false,
        error: null,
        selectedCards: new Set(),
        focusedCard: null
      },
      ...partial
    };
  }

  /**
   * Create default event handlers
   */
  private createDefaultHandlers(partial: Partial<StateEventHandlers> = {}): StateEventHandlers {
    return {
      onNodesChanged: () => {},
      onDensityChanged: () => {},
      onCartographicChanged: () => {},
      onSearchChanged: () => {},
      onAxisMappingChanged: () => {},
      onFeatureToggled: () => {},
      onSelectionChanged: () => {},
      onError: (error) => console.error('SuperGrid error:', error),
      onPerformanceUpdate: () => {},
      ...partial
    };
  }

  /**
   * Create default persistence configuration
   */
  private createDefaultPersistenceConfig(partial: Partial<StatePersistenceConfig> = {}): StatePersistenceConfig {
    return {
      enabled: true,
      storageKey: 'supergrid-state',
      includeNodes: false,
      includeSearch: false,
      includeSelection: true,
      debounceMs: 500,
      versionKey: 'v1',
      ...partial
    };
  }
}