/**
 * ViewContinuum - Orchestrator for seamless view transitions
 *
 * Manages view switching, state preservation, and FLIP animation coordination
 * between ListView, KanbanView, and SuperGrid projections.
 *
 * Architecture: Owns SVG container and ViewState, delegates rendering to active view class,
 * caches query results for consistent projection across view switches.
 */

import * as d3 from 'd3';
import type {
  ViewState,
  ViewAxisMapping,
  FlipAnimationConfig,
  ViewTransitionEvent
} from '../types/views';
import { ViewType } from '../types/views';
import type { ViewType as EngineViewType } from '../engine/contracts/ViewConfig';
import {
  DEFAULT_FLIP_CONFIG,
  createDefaultViewState
} from '../types/views';
import type { Node } from '../types/node';
import { devLogger as d3Logger } from '../utils/logging/dev-logger';
import { IsometryViewEngine } from '../engine/IsometryViewEngine';
import type { ViewConfig } from '../engine/contracts/ViewConfig';

// Import extracted modules
import type { ViewRenderer, ViewContinuumCallbacks, CardPosition } from './viewcontinuum/types';
import { ViewRegistrationManager } from './viewcontinuum/viewRegistrationManager';
import { DataManager } from './viewcontinuum/dataManager';
import { ViewContinuumStateManager } from './viewcontinuum/stateManager';
import { TransitionManager } from './viewcontinuum/transitionManager';

// Re-export types for external use
export type { CardPosition, ViewRenderer, ViewContinuumCallbacks };

/**
 * ViewContinuum main class - now much more focused and delegating to specialized managers
 */
export class ViewContinuum {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private containerElement: HTMLElement;
  private canvasId: string;
  private viewState: ViewState;
  private callbacks: ViewContinuumCallbacks;

  // ViewEngine for unified rendering
  private viewEngine: IsometryViewEngine;
  private currentViewConfig: ViewConfig | null = null;

  // Animation configuration
  private animationConfig: FlipAnimationConfig;

  // Event handling
  private eventTarget: EventTarget = new EventTarget();

  // Specialized managers
  private registrationManager: ViewRegistrationManager;
  private dataManager: DataManager;
  private stateManager: ViewContinuumStateManager;
  private transitionManager: TransitionManager;

  constructor(
    container: HTMLElement | SVGElement,
    canvasId: string,
    callbacks: ViewContinuumCallbacks = {},
    animationConfig: FlipAnimationConfig = DEFAULT_FLIP_CONFIG
  ) {
    this.containerElement = container as HTMLElement;
    this.container = d3.select(container);
    this.canvasId = canvasId;
    this.callbacks = callbacks;
    this.animationConfig = animationConfig;

    // Initialize view engine
    this.viewEngine = new IsometryViewEngine();

    // Initialize specialized managers
    this.stateManager = new ViewContinuumStateManager(canvasId);
    this.registrationManager = new ViewRegistrationManager();
    this.dataManager = new DataManager(this.viewEngine, this.containerElement);
    this.transitionManager = new TransitionManager(
      this.viewEngine,
      this.containerElement,
      this.animationConfig
    );

    // Load view state
    this.viewState = this.stateManager.loadViewState();

    // Setup SVG structure
    this.setupSVGStructure();

    // Initialize ViewEngine
    this.initializeViewEngine();

    d3Logger.setup('ViewContinuum initialized with unified ViewEngine', {
      canvasId,
      currentView: this.viewState.currentView,
      enableAnimations: this.viewState.config.enableAnimations
    });
  }

  // ========================================================================
  // View Registration and Management
  // ========================================================================

  /**
   * Register a view renderer for a specific view type
   */
  registerViewRenderer(viewType: ViewType, renderer: ViewRenderer): void {
    this.registrationManager.registerViewRenderer(
      viewType,
      renderer,
      this.viewState,
      (activeRenderer) => {
        this.stateManager.restoreViewState(
          this.viewState,
          activeRenderer,
          () => this.reprojectCachedData()
        );
      }
    );
  }

  /**
   * Unregister a view renderer
   */
  unregisterViewRenderer(viewType: ViewType): void {
    this.registrationManager.unregisterViewRenderer(viewType);
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
    const result = await this.transitionManager.switchToView(
      targetView,
      this.viewState,
      this.dataManager.getCachedCards(),
      this.currentViewConfig,
      trigger,
      animated,
      {
        saveCurrentViewState: () => this.saveCurrentViewState(),
        createViewConfig: (viewType, axisMapping) => this.createViewConfig(viewType, axisMapping),
        restoreViewState: () => this.stateManager.restoreViewState(
          this.viewState,
          this.registrationManager.getActiveRenderer(),
          () => this.reprojectCachedData()
        ),
        saveViewState: () => this.stateManager.saveViewState(this.viewState),
        emitViewChangeEvent: (event) => this.emitViewChangeEvent(event)
      }
    );

    this.currentViewConfig = result.newViewConfig;
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
    const result = this.dataManager.queryAndCache(
      sql,
      parameters,
      activeFilters,
      this.viewState,
      this.currentViewConfig,
      (viewType, axisMapping) => this.createViewConfig(viewType, axisMapping)
    );

    if (!this.currentViewConfig) {
      const currentMapping = this.viewState.viewStates[this.viewState.currentView].axisMapping;
      this.currentViewConfig = this.createViewConfig(this.viewState.currentView, currentMapping);
    }

    return result.results;
  }

  /**
   * Re-project cached data to current view (no re-query)
   */
  reprojectCachedData(): void {
    const viewConfig = this.dataManager.reprojectCachedData(
      this.viewState,
      (viewType, axisMapping) => this.createViewConfig(viewType, axisMapping)
    );

    if (viewConfig) {
      this.currentViewConfig = viewConfig;
    }
  }

  // ========================================================================
  // Selection Management
  // ========================================================================

  /**
   * Update card selection state
   */
  updateSelection(selectedIds: string[], focusedId: string | null = null): void {
    this.viewState.selectionState.selectedCardIds = new Set(selectedIds);
    this.viewState.selectionState.lastSelectedId = focusedId;
    this.viewState.lastModified = Date.now();

    this.stateManager.saveViewState(this.viewState);

    if (this.callbacks.onSelectionChange) {
      this.callbacks.onSelectionChange(selectedIds, focusedId);
    }

    d3Logger.state('Selection updated', {
      selectionCount: selectedIds.length,
      focusedId
    });
  }

  /**
   * Get current selection state
   */
  getSelection(): { selectedIds: string[]; focusedId: string | null } {
    return {
      selectedIds: Array.from(this.viewState.selectionState.selectedCardIds),
      focusedId: this.viewState.selectionState.lastSelectedId
    };
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Get current view state
   */
  getCurrentView(): ViewType {
    return this.viewState.currentView;
  }

  /**
   * Check if view is currently transitioning
   */
  isTransitioning(): boolean {
    return this.transitionManager.getIsTransitioning();
  }

  /**
   * Event listener interface
   */
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.eventTarget.addEventListener(type, listener);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.eventTarget.removeEventListener(type, listener);
  }

  // ========================================================================
  // Private Implementation Methods
  // ========================================================================

  private saveCurrentViewState(): void {
    this.stateManager.saveCurrentViewState(
      this.viewState,
      this.registrationManager.getActiveRenderer(),
      () => {}
    );
  }

  private initializeViewEngine(): void {
    // ViewEngine is already instantiated in constructor
    // Any additional initialization can go here
  }

  private createViewConfig(viewType: ViewType, axisMapping: ViewAxisMapping): ViewConfig {
    const engineViewType = this.mapViewTypeToEngineType(viewType);

    return {
      type: engineViewType,
      dimensions: Object.entries(axisMapping).reduce((acc, [plane, axis]) => {
        if (axis && axis !== 'None') {
          acc[plane as 'x' | 'y' | 'z'] = this.mapLATCHAbbreviation(axis as any);
        }
        return acc;
      }, {} as Record<'x' | 'y' | 'z', any>),
      layout: {
        cardSize: { width: 200, height: 120 },
        padding: { x: 10, y: 10 },
        groupSpacing: 20
      }
    };
  }

  private mapViewTypeToEngineType(viewType: ViewType): EngineViewType {
    const mapping: Record<ViewType, EngineViewType> = {
      [ViewType.LIST]: 'list',
      [ViewType.KANBAN]: 'kanban',
      [ViewType.SUPERGRID]: 'supergrid',
      [ViewType.NETWORK]: 'network',
      [ViewType.TIMELINE]: 'timeline'
    };
    return mapping[viewType] || 'list';
  }

  private mapLATCHAbbreviation(abbr: 'L' | 'A' | 'T' | 'C' | 'H'): any {
    const mapping = {
      'L': 'location',
      'A': 'alphabet',
      'T': 'time',
      'C': 'category',
      'H': 'hierarchy'
    };
    return mapping[abbr] || 'category';
  }

  private setupSVGStructure(): void {
    // Ensure we have a proper SVG structure for D3 rendering
    if (!this.container.select('svg').empty()) return;

    const svg = this.container
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('position', 'absolute')
      .style('top', 0)
      .style('left', 0)
      .style('pointer-events', 'none');

    svg.append('g').attr('class', 'view-container');
  }

  private emitViewChangeEvent(event: ViewTransitionEvent): void {
    this.eventTarget.dispatchEvent(new CustomEvent('viewchange', { detail: event }));
    if (this.callbacks.onViewChange) {
      this.callbacks.onViewChange(event);
    }
  }
}