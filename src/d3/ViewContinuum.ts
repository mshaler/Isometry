import * as d3 from 'd3';
import type {
  ViewState,
  ViewAxisMapping,
  CardPosition,
  FlipAnimationConfig,
  ViewTransitionEvent
} from '../types/views';
import { ViewType } from '../types/views';
import type { ViewType as EngineViewType } from '../engine/contracts/ViewConfig';
import {
  DEFAULT_FLIP_CONFIG,
  createDefaultViewState,
  getViewStateStorageKey
} from '../types/views';
import type { Node } from '../types/node';
import { devLogger as d3Logger } from '../utils/logging/dev-logger';
import { IsometryViewEngine } from '../engine/IsometryViewEngine';
import type { ViewConfig } from '../engine/contracts/ViewConfig';

// Re-export CardPosition for external use
export type { CardPosition };

/**
 * ViewContinuum - Orchestrator for seamless view transitions
 *
 * Manages view switching, state preservation, and FLIP animation coordination
 * between ListView, KanbanView, and SuperGrid projections.
 *
 * Architecture: Owns SVG container and ViewState, delegates rendering to active view class,
 * caches query results for consistent projection across view switches.
 */

/**
 * @deprecated ViewRenderer interface replaced by IsometryViewEngine
 * Kept for backward compatibility during transition
 */
export interface ViewRenderer {
  render(cards: Node[], axisMapping: ViewAxisMapping, activeFilters: any[]): void;
  getCardPositions(): Map<string, CardPosition>;
  scrollToCard(cardId: string): void;
  destroy(): void;
}

/**
 * Event handlers for ViewContinuum
 */
export interface ViewContinuumCallbacks {
  onViewChange?: (event: ViewTransitionEvent) => void;
  onSelectionChange?: (selectedIds: string[], focusedId: string | null) => void;
  onCardClick?: (card: Node) => void;
  onFilterChange?: (filters: any[]) => void;
}

export class ViewContinuum {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private containerElement: HTMLElement;
  private canvasId: string;
  private viewState: ViewState;
  private callbacks: ViewContinuumCallbacks;

  // Unified ViewEngine for all rendering
  private viewEngine: IsometryViewEngine;
  private currentViewConfig: ViewConfig | null = null;

  // Legacy renderer registry (deprecated, for backward compatibility)
  private viewRenderers: Map<ViewType, ViewRenderer> = new Map();
  private activeRenderer: ViewRenderer | null = null;

  // Cached query state for consistent projection
  private cachedCards: Node[] = [];
  private cachedQueryHash: string = '';
  private lastActiveFilters: any[] = [];

  // Animation state
  private animationConfig: FlipAnimationConfig;
  private isTransitioning: boolean = false;

  // Event emitter for view transition events
  private eventTarget: EventTarget = new EventTarget();

  constructor(
    container: SVGElement,
    canvasId: string,
    callbacks: ViewContinuumCallbacks = {},
    animationConfig: FlipAnimationConfig = DEFAULT_FLIP_CONFIG
  ) {
    this.container = d3.select(container);
    this.containerElement = container.parentElement || container as any;
    this.canvasId = canvasId;
    this.callbacks = callbacks;
    this.animationConfig = animationConfig;

    // Initialize unified ViewEngine
    this.viewEngine = new IsometryViewEngine();

    // Initialize view state (load from storage or create default)
    this.viewState = this.loadViewState();

    // Set up SVG structure
    this.setupSVGStructure();

    // Initialize ViewEngine with container
    this.initializeViewEngine();

    d3Logger.setup('ViewContinuum initialized with unified ViewEngine', {
      canvasId: this.canvasId,
      currentView: this.viewState.currentView,
      hasPersistedState: this.viewState.lastModified > 0
    });
  }

  // ========================================================================
  // View Registration and Management
  // ========================================================================

  /**
   * Register a view renderer for a specific view type
   */
  registerViewRenderer(viewType: ViewType, renderer: ViewRenderer): void {
    this.viewRenderers.set(viewType, renderer);

    d3Logger.setup('View renderer registered', {
      viewType,
      totalRegistered: this.viewRenderers.size
    });

    // If this is the current view and no active renderer, set it as active
    if (viewType === this.viewState.currentView && !this.activeRenderer) {
      this.activeRenderer = renderer;
      this.restoreViewState();
    }
  }

  /**
   * Unregister a view renderer
   */
  unregisterViewRenderer(viewType: ViewType): void {
    const renderer = this.viewRenderers.get(viewType);
    if (renderer) {
      // If this is the active renderer, clear it
      if (this.activeRenderer === renderer) {
        this.activeRenderer = null;
      }

      // Clean up the renderer
      renderer.destroy();
      this.viewRenderers.delete(viewType);

      d3Logger.setup('View renderer unregistered', {
        viewType,
        remainingRegistered: this.viewRenderers.size
      });
    }
  }

  // ========================================================================
  // View Switching and Transitions
  // ========================================================================

  /**
   * Switch to a different view type with optional FLIP animation
   */
  async switchToView(
    targetView: ViewType,
    trigger: 'user' | 'programmatic' | 'keyboard' = 'programmatic',
    animated: boolean = this.viewState.config.enableAnimations
  ): Promise<void> {

    if (this.isTransitioning) {
      d3Logger.warn('ViewContinuum switchToView: Transition already in progress, interrupting');
      this.interruptTransition();
    }

    const fromView = this.viewState.currentView;
    if (fromView === targetView) {
      d3Logger.info('Already on target view', { view: targetView } as any);
      return;
    }

    d3Logger.state('View switch initiated', {
      from: fromView,
      to: targetView,
      trigger,
      animated,
      hasData: this.cachedCards.length > 0
    });

    // Save current view state
    this.saveCurrentViewState();

    // Prepare transition event
    const transitionEvent: ViewTransitionEvent = {
      fromView,
      toView: targetView,
      timestamp: Date.now(),
      trigger,
      preservedState: {
        selectionCount: this.viewState.selectionState.selectedCardIds.size,
        focusedCardId: this.viewState.selectionState.lastSelectedId,
        filterCount: this.viewState.activeFilters.length
      }
    };

    // Update transition state
    this.viewState.transitionState = {
      fromView,
      toView: targetView,
      isAnimating: animated,
      progress: 0,
      startTime: Date.now()
    };

    try {
      this.isTransitioning = true;

      // Create target view configuration
      const targetMapping = this.viewState.viewStates[targetView].axisMapping;
      const targetViewConfig = this.createViewConfig(targetView, targetMapping);

      // Use ViewEngine transition if animation enabled, otherwise render directly
      if (animated && this.currentViewConfig) {
        await this.viewEngine.transition(
          this.currentViewConfig,
          targetViewConfig,
          this.animationConfig.duration
        );
      } else {
        await this.viewEngine.render(this.containerElement, this.cachedCards, targetViewConfig);
      }

      // Update current view state
      this.viewState.currentView = targetView;
      this.currentViewConfig = targetViewConfig;

      // Load target view state
      this.restoreViewState();

      // Update state and persist
      this.viewState.lastModified = Date.now();
      this.saveViewState();

      // Emit transition event
      this.emitViewChangeEvent(transitionEvent);

      d3Logger.render('View transition complete', {
        to: targetView,
        duration: Date.now() - transitionEvent.timestamp
      });

    } catch (error) {
      d3Logger.error('ViewContinuum switchToView transition failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Rollback on error
      this.viewState.currentView = fromView;

      throw error;
    } finally {
      this.isTransitioning = false;
      this.viewState.transitionState = undefined;
    }
  }

  // [Removed unused performFlipAnimation method - FLIP animation handled by ViewEngine.transition()]

  // [Removed unused animateCardFlip method - FLIP animation handled by ViewEngine.transition()]

  /**
   * Interrupt current transition
   */
  private interruptTransition(): void {
    this.container.selectAll('*')
      .interrupt();

    this.isTransitioning = false;
    this.viewState.transitionState = undefined;

    d3Logger.info('Transition interrupted');
  }

  // ========================================================================
  // Data Management and Query Caching
  // ========================================================================

  /**
   * Query data with LATCH filters and cache results for view switching
   */
  queryAndCache(
    sql: string,
    parameters: any[] = [],
    activeFilters: any[] = []
  ): Node[] {
    // Generate query hash for cache validation
    const queryHash = this.generateQueryHash(sql, parameters);

    // Return cached results if query hasn't changed
    if (queryHash === this.cachedQueryHash && this.cachedCards.length > 0) {
      d3Logger.state('ViewContinuum.queryAndCache(): Using cached results', {});
      return this.cachedCards;
    }

    // TODO: Execute query via DatabaseService
    // For now, return empty array as placeholder
    const results: Node[] = [];

    // Cache results
    this.cachedCards = results;
    this.cachedQueryHash = queryHash;
    this.lastActiveFilters = activeFilters;

    // Update cached query in view state
    this.viewState.cachedQuery = {
      sql,
      parameters,
      results,
      timestamp: Date.now(),
      hash: queryHash
    };

    d3Logger.data('Query and cache', {
      queryHash,
      resultCount: results.length,
      cached: true
    });

    // Re-render current view with new data using ViewEngine
    if (this.currentViewConfig) {
      this.viewEngine.render(this.containerElement, results, this.currentViewConfig);
    } else {
      // Create initial view config if none exists
      const currentMapping = this.viewState.viewStates[this.viewState.currentView].axisMapping;
      this.currentViewConfig = this.createViewConfig(this.viewState.currentView, currentMapping);
      this.viewEngine.render(this.containerElement, results, this.currentViewConfig);
    }

    return results;
  }

  /**
   * Re-project cached data to current view (no re-query)
   */
  reprojectCachedData(): void {
    if (this.cachedCards.length === 0) {
      d3Logger.warn('ViewContinuum reprojectCachedData: No cached data available');
      return;
    }

    const currentMapping = this.viewState.viewStates[this.viewState.currentView].axisMapping;
    this.currentViewConfig = this.createViewConfig(this.viewState.currentView, currentMapping);
    this.viewEngine.render(this.containerElement, this.cachedCards, this.currentViewConfig);

    d3Logger.data('Re-projected data to current view', {
      viewType: this.viewState.currentView,
      cardCount: this.cachedCards.length
    });
  }

  // ========================================================================
  // Selection Management
  // ========================================================================

  /**
   * Update selection state (persists across view switches)
   */
  updateSelection(selectedIds: string[], focusedId: string | null = null): void {
    this.viewState.selectionState.selectedCardIds = new Set(selectedIds);

    if (focusedId) {
      this.viewState.selectionState.lastSelectedId = focusedId;
    }

    this.viewState.lastModified = Date.now();

    // Update focused card for current view
    if (focusedId) {
      this.viewState.viewStates[this.viewState.currentView].focusedCardId = focusedId;
    }

    // Trigger callback
    this.callbacks.onSelectionChange?.(selectedIds, focusedId);

    d3Logger.data('Update selection', {
      selectedCount: selectedIds.length,
      focusedId,
      viewType: this.viewState.currentView
    });
  }

  /**
   * Get current selection
   */
  getSelection(): { selectedIds: string[]; focusedId: string | null } {
    return {
      selectedIds: Array.from(this.viewState.selectionState.selectedCardIds),
      focusedId: this.viewState.selectionState.lastSelectedId || null
    };
  }

  // ========================================================================
  // State Persistence
  // ========================================================================

  /**
   * Load view state from localStorage or create default
   */
  private loadViewState(): ViewState {
    try {
      const storageKey = getViewStateStorageKey(this.canvasId);
      const savedState = localStorage.getItem(storageKey);

      if (savedState) {
        const parsed = JSON.parse(savedState);

        // Restore Set objects from arrays
        if (parsed.selectionState?.selectedCardIds) {
          parsed.selectionState.selectedCardIds = new Set(parsed.selectionState.selectedCardIds);
        }

        // Restore Set objects in view states
        Object.values(parsed.viewStates || {}).forEach((viewState: any) => {
          if (viewState.expandedGroups) {
            viewState.expandedGroups = new Set(viewState.expandedGroups);
          }
        });

        d3Logger.state('ViewContinuum: Loaded state from localStorage', {
          currentView: parsed.currentView,
          selectionCount: parsed.selectionState?.selectedCardIds?.size || 0
        });

        return parsed;
      }
    } catch (error) {
      d3Logger.warn('ViewContinuum failed to load state from localStorage', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Create default state
    const defaultState = createDefaultViewState(this.canvasId);
    d3Logger.debug('ViewContinuum created default view state');
    return defaultState;
  }

  /**
   * Save current view state to localStorage
   */
  private saveViewState(): void {
    try {
      const storageKey = getViewStateStorageKey(this.canvasId);

      // Convert Sets to arrays for JSON serialization
      const serializable = {
        ...this.viewState,
        selectionState: {
          ...this.viewState.selectionState,
          selectedCardIds: Array.from(this.viewState.selectionState.selectedCardIds)
        },
        viewStates: Object.fromEntries(
          Object.entries(this.viewState.viewStates).map(([viewType, state]) => [
            viewType,
            {
              ...state,
              expandedGroups: state.expandedGroups ? Array.from(state.expandedGroups) : undefined
            }
          ])
        )
      };

      localStorage.setItem(storageKey, JSON.stringify(serializable));

      d3Logger.state('ViewContinuum: Saved state to localStorage', {
        currentView: this.viewState.currentView,
        timestamp: this.viewState.lastModified
      });
    } catch (error) {
      d3Logger.warn('ViewContinuum failed to save state to localStorage', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Save current view-specific state
   */
  private saveCurrentViewState(): void {
    if (!this.activeRenderer) return;

    const currentView = this.viewState.currentView;
    const viewState = this.viewState.viewStates[currentView];

    // Capture current state from active renderer
    viewState.lastUpdated = Date.now();

    // TODO: Capture scroll position, zoom state, etc. from renderer
    // This will be implemented when view renderers support these methods

    d3Logger.state('ViewContinuum.saveCurrentViewState()', {
      viewType: currentView,
      timestamp: viewState.lastUpdated
    });
  }

  /**
   * Restore view-specific state for current view
   */
  private restoreViewState(): void {
    const currentView = this.viewState.currentView;
    const viewState = this.viewState.viewStates[currentView];

    // TODO: Restore scroll position, zoom state, etc. to renderer
    // This will be implemented when view renderers support these methods

    d3Logger.state('View state restored', {
      viewType: currentView,
      lastUpdated: viewState.lastUpdated
    });
  }

  // ========================================================================
  // ViewEngine Integration Methods
  // ========================================================================

  /**
   * Initialize ViewEngine with container
   */
  private initializeViewEngine(): void {
    // ViewEngine will be initialized when first render is called
    d3Logger.setup('ViewEngine ready for rendering');
  }

  /**
   * Create ViewConfig from ViewType and axis mapping
   */
  private createViewConfig(viewType: ViewType, axisMapping: ViewAxisMapping): ViewConfig {
    return {
      viewType: this.mapViewTypeToEngineType(viewType) as any, // TODO: Fix type mapping
      projection: {
        x: {
          axis: this.mapLATCHAbbreviation(axisMapping.xAxis?.latchDimension || 'C'),
          facet: axisMapping.xAxis?.facet || 'status',
          dataType: 'string'
        },
        y: {
          axis: this.mapLATCHAbbreviation(axisMapping.yAxis?.latchDimension || 'H'),
          facet: axisMapping.yAxis?.facet || 'priority',
          dataType: 'number'
        }
      },
      filters: this.lastActiveFilters as any[] || [],
      sort: [],
      zoom: {
        scale: 1.0,
        offset: { x: 0, y: 0 },
        constrained: false
      },
      selection: {
        selectedIds: Array.from(this.viewState.selectionState.selectedCardIds),
        lastClickedId: this.viewState.selectionState.lastSelectedId,
        mode: 'multiple'
      },
      styling: {
        colorScheme: 'light', // TODO: Get from theme context
        animations: {
          enabled: this.viewState.config.enableAnimations,
          duration: this.animationConfig.duration,
          easing: 'ease-out'
        }
      },
      eventHandlers: {
        onNodeClick: this.callbacks.onCardClick,
        onSelectionChange: (nodes) => {
          // Adapt interface: ViewEngine expects nodes, ViewContinuum provides ids
          const selectedIds = nodes.map(n => n.id || n);
          this.callbacks.onSelectionChange?.(selectedIds, selectedIds[selectedIds.length - 1] || null);
        }
      }
    };
  }

  /**
   * Map ViewContinuum ViewType to ViewEngine viewType
   */
  private mapViewTypeToEngineType(viewType: ViewType): EngineViewType {
    switch (viewType) {
      case ViewType.GRID:
      case ViewType.SUPERGRID:
        return 'grid';
      case ViewType.LIST:
        return 'list';
      case ViewType.KANBAN:
        return 'kanban';
      case ViewType.TIMELINE:
        return 'timeline';
      case ViewType.NETWORK:
        return 'graph'; // ViewEngine uses 'graph' instead of 'network'
      case ViewType.CALENDAR:
        return 'calendar';
      default:
        return 'grid'; // fallback
    }
  }

  /**
   * Map LATCH abbreviation to full name
   */
  private mapLATCHAbbreviation(abbr: 'L' | 'A' | 'T' | 'C' | 'H'): import('../types/pafv').LATCHAxis {
    switch (abbr) {
      case 'L':
        return 'location';
      case 'A':
        return 'alphabet';
      case 'T':
        return 'time';
      case 'C':
        return 'category';
      case 'H':
        return 'hierarchy';
      default:
        return 'category';
    }
  }

  // ========================================================================
  // Initialization and Setup
  // ========================================================================

  /**
   * Set up SVG container structure
   */
  private setupSVGStructure(): void {
    // Clear existing content
    this.container.selectAll('*').remove();

    // Create main content group
    this.container.append('g')
      .attr('class', 'view-continuum-content')
      .attr('transform', 'translate(0, 0)');

    // Create overlay group for transitions
    this.container.append('g')
      .attr('class', 'transition-overlay')
      .style('pointer-events', 'none');

    d3Logger.setup('SVG structure initialized');
  }

  // [Removed unused initializeActiveView method - initialization handled by ViewEngine.render()]

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Generate hash for query caching
   */
  private generateQueryHash(sql: string, parameters: any[]): string {
    const combined = `${sql}|${JSON.stringify(parameters)}`;
    // Simple hash function (not cryptographically secure, just for caching)
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // [Removed unused getD3Easing method - animation handled by ViewEngine.transition()]

  /**
   * Emit view change event
   */
  private emitViewChangeEvent(event: ViewTransitionEvent): void {
    this.eventTarget.dispatchEvent(new CustomEvent('viewchange', { detail: event }));
    this.callbacks.onViewChange?.(event);
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Get current view type
   */
  getCurrentView(): ViewType {
    return this.viewState.currentView;
  }

  /**
   * Get view state (read-only)
   */
  getViewState(): Readonly<ViewState> {
    return this.viewState;
  }

  /**
   * Update view axis mapping for current view
   */
  updateAxisMapping(mapping: ViewAxisMapping): void {
    this.viewState.viewStates[this.viewState.currentView].axisMapping = mapping;
    this.viewState.lastModified = Date.now();

    // Re-project data with new mapping
    this.reprojectCachedData();

    d3Logger.state('ViewContinuum updateAxisMapping', {
      viewType: this.viewState.currentView,
      mapping
    });
  }

  /**
   * Focus on a specific card (view-independent)
   */
  focusCard(cardId: string): void {
    this.viewState.viewStates[this.viewState.currentView].focusedCardId = cardId;
    this.viewState.selectionState.lastSelectedId = cardId;

    // TODO: Implement card focusing in ViewEngine
    // this.viewEngine.focusCard(cardId);

    d3Logger.inspect('Focus card', { cardId, viewType: this.viewState.currentView });
  }

  /**
   * Listen to view change events
   */
  addEventListener(event: 'viewchange', handler: (event: CustomEvent<ViewTransitionEvent>) => void): void {
    this.eventTarget.addEventListener(event, handler as EventListener);
  }

  /**
   * Remove view change event listener
   */
  removeEventListener(event: 'viewchange', handler: (event: CustomEvent<ViewTransitionEvent>) => void): void {
    this.eventTarget.removeEventListener(event, handler as EventListener);
  }

  /**
   * Clear cached data and force re-query
   */
  clearCache(): void {
    this.cachedCards = [];
    this.cachedQueryHash = '';
    this.lastActiveFilters = [];
    this.viewState.cachedQuery = undefined;

    d3Logger.debug('ViewContinuum cache cleared');
  }

  /**
   * Reset view state to defaults
   */
  resetState(): void {
    this.viewState = createDefaultViewState(this.canvasId);
    this.saveViewState();

    d3Logger.state('State reset to defaults', {});
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Interrupt any running transitions
    this.interruptTransition();

    // Clean up ViewEngine
    this.viewEngine.destroy();

    // Clean up legacy renderers (deprecated)
    this.viewRenderers.forEach((renderer) => {
      renderer.destroy();
    });
    this.viewRenderers.clear();

    // Clear active renderer
    this.activeRenderer = null;
    this.currentViewConfig = null;

    // Save final state
    this.saveViewState();

    // Clear SVG content
    this.container.selectAll('*').remove();

    // Clear cached data
    this.clearCache();

    d3Logger.setup('ViewContinuum cleanup complete');
  }
}