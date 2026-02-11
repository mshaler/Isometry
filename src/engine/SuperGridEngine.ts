/**
 * SuperGridEngine - Orchestration System for Super* Features
 *
 * The central orchestration system that coordinates all Super* features:
 * - SuperStack: Nested PAFV headers with visual spanning
 * - SuperDensity: Janus density model (Value × Extent orthogonal controls)
 * - SuperSize: Inline cell expansion with count badges
 * - SuperZoom: Cartographic navigation with pan/zoom
 * - SuperDynamic: Drag-and-drop axis repositioning
 * - SuperCalc: Formula bar with PAFV-aware functions
 * - SuperSearch: Cross-dimensional search with highlighting
 * - SuperAudit: Toggle computed cell visualization
 *
 * Provides unified state management, feature flag system, and interaction coordination
 * between all Super* components within the SuperGrid ecosystem.
 */

import type { Node } from '@/types/node';
import type { LATCHAxis, AxisMapping } from '@/types/pafv';
import type {
  DensityLevel,
  JanusDensityState,
  SuperDynamicConfig,
  CartographicConfig,
  CartographicState
} from '@/types/supergrid';
import type { SuperSizeConfig, CellExpansionState } from '@/components/supergrid/SuperSize';

// Temporary interface definitions for missing types
interface SuperStackConfig {
  maxLevels?: number;
  enableDragDrop?: boolean;
}

interface SuperCalcConfig {
  enableFormulas?: boolean;
  showFormulaBar?: boolean;
}

interface SuperSearchConfig {
  enableFTS?: boolean;
  highlightMatches?: boolean;
}

interface SuperAuditConfig {
  highlightColor?: string;
  showComputedBadges?: boolean;
}

/**
 * Feature flags for Super* components
 */
export interface SuperFeatureFlags {
  /** SuperStack: Nested PAFV headers */
  enableSuperStack: boolean;
  /** SuperDensity: Janus density controls */
  enableSuperDensity: boolean;
  /** SuperSize: Inline cell expansion */
  enableSuperSize: boolean;
  /** SuperZoom: Cartographic navigation */
  enableSuperZoom: boolean;
  /** SuperDynamic: Drag-and-drop axis reordering */
  enableSuperDynamic: boolean;
  /** SuperCalc: Formula bar and computed cells */
  enableSuperCalc: boolean;
  /** SuperSearch: Cross-dimensional search */
  enableSuperSearch: boolean;
  /** SuperAudit: Computed cell visualization */
  enableSuperAudit: boolean;
}

/**
 * Unified state for all Super* features
 */
export interface SuperGridState {
  /** Feature flags */
  features: SuperFeatureFlags;
  /** Grid layout mode */
  mode: 'gallery' | 'list' | 'kanban' | 'grid' | 'supergrid';
  /** PAFV axis mappings */
  pafvMappings: AxisMapping[];
  /** Density state (SuperDensity) */
  density: JanusDensityState;
  /** Cell expansion state (SuperSize) */
  expansion: CellExpansionState;
  /** Zoom/pan state (SuperZoom) */
  cartographic: CartographicState;
  /** Search state (SuperSearch) */
  search: {
    query: string;
    results: string[]; // node IDs
    highlightMode: boolean;
  };
  /** Audit mode (SuperAudit) */
  audit: {
    enabled: boolean;
    showFormulas: boolean;
    highlightComputed: boolean;
  };
  /** Dynamic interaction state (SuperDynamic) */
  dynamic: {
    isDragging: boolean;
    draggedAxis?: LATCHAxis;
    dropTarget?: { plane: 'x' | 'y' | 'z'; index: number };
  };
}

/**
 * Configuration for all Super* features
 */
export interface SuperGridConfig {
  /** SuperStack configuration */
  stack: Partial<SuperStackConfig>;
  /** SuperDensity configuration */
  density: Partial<{ defaultLevel: DensityLevel }>;
  /** SuperSize configuration */
  size: Partial<SuperSizeConfig>;
  /** SuperZoom configuration */
  zoom: Partial<CartographicConfig>;
  /** SuperDynamic configuration */
  dynamic: Partial<SuperDynamicConfig>;
  /** SuperCalc configuration */
  calc: Partial<SuperCalcConfig>;
  /** SuperSearch configuration */
  search: Partial<SuperSearchConfig>;
  /** SuperAudit configuration */
  audit: Partial<SuperAuditConfig>;
}

/**
 * Event handlers for Super* interactions
 */
export interface SuperGridEventHandlers {
  /** Node click handler */
  onNodeClick?: (node: Node, position: { x: number; y: number }) => void;
  /** Header click handler */
  onHeaderClick?: (level: number, value: string, axis: LATCHAxis) => void;
  /** Axis reorder handler (SuperDynamic) */
  onAxisReorder?: (fromAxis: LATCHAxis, toAxis: LATCHAxis) => void;
  /** Search query handler */
  onSearchQuery?: (query: string, results: Node[]) => void;
  /** Formula calculation handler (SuperCalc) */
  onFormulaCalculate?: (formula: string, result: unknown) => void;
  /** State change handler */
  onStateChange?: (state: Partial<SuperGridState>) => void;
}

/**
 * SuperGridEngine class - orchestrates all Super* features
 */
export class SuperGridEngine {
  private state: SuperGridState;
  private config: SuperGridConfig;
  private eventHandlers: SuperGridEventHandlers;
  private nodes: Node[] = [];

  constructor(
    initialState: Partial<SuperGridState> = {},
    config: Partial<SuperGridConfig> = {},
    eventHandlers: SuperGridEventHandlers = {}
  ) {
    this.state = this.createDefaultState(initialState);
    this.config = this.createDefaultConfig(config);
    this.eventHandlers = eventHandlers;
  }

  /**
   * Update nodes data (typically from sql.js query results)
   */
  updateNodes(nodes: Node[]): void {
    this.nodes = nodes;
    this.notifyStateChange({ nodes });
  }

  /**
   * Get current state
   */
  getState(): SuperGridState {
    return { ...this.state };
  }

  /**
   * Update state partially
   */
  updateState(partialState: Partial<SuperGridState>): void {
    this.state = { ...this.state, ...partialState };
    this.notifyStateChange(partialState);
  }

  /**
   * Toggle feature flags
   */
  toggleFeature(feature: keyof SuperFeatureFlags, enabled?: boolean): void {
    const newEnabled = enabled ?? !this.state.features[feature];
    this.updateState({
      features: {
        ...this.state.features,
        [feature]: newEnabled
      }
    });
  }

  /**
   * Handle SuperDensity density level change
   */
  updateDensity(density: Partial<JanusDensityState>): void {
    this.updateState({
      density: { ...this.state.density, ...density }
    });
  }

  /**
   * Handle SuperSize cell expansion
   */
  updateCellExpansion(expansion: Partial<CellExpansionState>): void {
    this.updateState({
      expansion: { ...this.state.expansion, ...expansion }
    });
  }

  /**
   * Handle SuperZoom pan/zoom changes
   */
  updateCartographic(cartographic: Partial<CartographicState>): void {
    this.updateState({
      cartographic: { ...this.state.cartographic, ...cartographic }
    });
  }

  /**
   * Handle SuperSearch queries
   */
  updateSearch(query: string): void {
    // Simple search implementation - can be enhanced with FTS5
    const results = this.nodes
      .filter(node =>
        node.name.toLowerCase().includes(query.toLowerCase()) ||
        (node.summary && node.summary.toLowerCase().includes(query.toLowerCase())) ||
        (node.folder && node.folder.toLowerCase().includes(query.toLowerCase()))
      )
      .map(node => node.id);

    this.updateState({
      search: {
        query,
        results,
        highlightMode: query.length > 0
      }
    });

    this.eventHandlers.onSearchQuery?.(query, this.nodes.filter(n => results.includes(n.id)));
  }

  /**
   * Handle SuperDynamic axis reordering
   */
  reorderAxis(fromAxis: LATCHAxis, toAxis: LATCHAxis): void {
    this.eventHandlers.onAxisReorder?.(fromAxis, toAxis);

    this.updateState({
      dynamic: {
        isDragging: false,
        draggedAxis: undefined,
        dropTarget: undefined
      }
    });
  }

  /**
   * Toggle SuperAudit mode
   */
  toggleAuditMode(enabled?: boolean): void {
    const newEnabled = enabled ?? !this.state.audit.enabled;
    this.updateState({
      audit: {
        ...this.state.audit,
        enabled: newEnabled
      }
    });
  }

  /**
   * Get nodes filtered by current search
   */
  getFilteredNodes(): Node[] {
    if (!this.state.search.query) {
      return this.nodes;
    }
    return this.nodes.filter(node =>
      this.state.search.results.includes(node.id)
    );
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: keyof SuperFeatureFlags): boolean {
    return this.state.features[feature];
  }

  /**
   * Get configuration for a specific Super* feature
   */
  getFeatureConfig<T extends keyof SuperGridConfig>(feature: T): SuperGridConfig[T] {
    return this.config[feature];
  }

  /**
   * Create interaction context for components
   */
  createInteractionContext() {
    return {
      state: this.getState(),
      config: this.config,
      updateState: this.updateState.bind(this),
      toggleFeature: this.toggleFeature.bind(this),
      updateDensity: this.updateDensity.bind(this),
      updateCellExpansion: this.updateCellExpansion.bind(this),
      updateCartographic: this.updateCartographic.bind(this),
      updateSearch: this.updateSearch.bind(this),
      reorderAxis: this.reorderAxis.bind(this),
      toggleAuditMode: this.toggleAuditMode.bind(this),
      getFilteredNodes: this.getFilteredNodes.bind(this),
      isFeatureEnabled: this.isFeatureEnabled.bind(this),
      getFeatureConfig: this.getFeatureConfig.bind(this)
    };
  }

  private createDefaultState(partial: Partial<SuperGridState>): SuperGridState {
    return {
      features: {
        enableSuperStack: true,
        enableSuperDensity: true,
        enableSuperSize: true,
        enableSuperZoom: true,
        enableSuperDynamic: true,
        enableSuperCalc: false, // Disabled by default
        enableSuperSearch: true,
        enableSuperAudit: false, // Disabled by default
        ...partial.features
      },
      mode: 'supergrid',
      pafvMappings: [],
      density: {
        valueDensity: 'leaf',
        extentDensity: 'populated-only',
        viewDensity: 'spreadsheet',
        regionConfig: [],
        axisGranularity: {},
        aggregationPreferences: {
          defaultFunction: 'count',
          facetAggregations: {},
          preservePrecision: true,
          showAggregationSource: true
        },
        ...partial.density
      },
      expansion: {
        expandedCells: new Set(),
        cellSizes: new Map(),
        cellCounts: new Map(),
        autoSizedCells: new Set(),
        animatingCells: new Set(),
        ...partial.expansion
      },
      cartographic: {
        scale: 1.0,
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
        animationTarget: {},
        ...partial.cartographic
      },
      search: {
        query: '',
        results: [],
        highlightMode: false,
        ...partial.search
      },
      audit: {
        enabled: false,
        showFormulas: false,
        highlightComputed: false,
        ...partial.audit
      },
      dynamic: {
        isDragging: false,
        ...partial.dynamic
      },
      ...partial
    };
  }

  private createDefaultConfig(partial: Partial<SuperGridConfig>): SuperGridConfig {
    return {
      stack: {
        maxLevels: 4,
        enableDragDrop: true,
        ...partial.stack
      },
      density: {
        defaultLevel: 'view',
        ...partial.density
      },
      size: {
        defaultCellSize: { width: 120, height: 80 },
        animationDuration: 300,
        showCountBadges: true,
        enableAutoSizing: true,
        ...partial.size
      },
      zoom: {
        minZoomLevel: 0.1,
        maxZoomLevel: 5.0,
        zoomAnchor: 'upper-left',
        constrainToBounds: true,
        zoomAnimationDuration: 300,
        smoothZoom: true,
        ...partial.zoom
      },
      dynamic: {
        ...partial.dynamic
      },
      calc: {
        enableFormulas: false,
        showFormulaBar: false,
        ...partial.calc
      },
      search: {
        enableFTS: true,
        highlightMatches: true,
        ...partial.search
      },
      audit: {
        highlightColor: '#fef3c7',
        showComputedBadges: true,
        ...partial.audit
      }
    };
  }

  private notifyStateChange(partialState: Partial<SuperGridState | { nodes: Node[] }>): void {
    if ('nodes' in partialState) {
      // Don't include nodes in state notifications
      return;
    }
    this.eventHandlers.onStateChange?.(partialState as Partial<SuperGridState>);
  }
}

/**
 * Create a new SuperGridEngine instance with default configuration
 */
export function createSuperGridEngine(
  initialState?: Partial<SuperGridState>,
  config?: Partial<SuperGridConfig>,
  eventHandlers?: SuperGridEventHandlers
): SuperGridEngine {
  return new SuperGridEngine(initialState, config, eventHandlers);
}

export default SuperGridEngine;