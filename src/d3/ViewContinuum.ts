import * as d3 from 'd3';
import type {
  ViewType,
  ViewState,
  ViewAxisMapping,
  CardPosition,
  FlipAnimationConfig,
  ViewTransitionEvent
} from '../types/views';
import {
  DEFAULT_FLIP_CONFIG,
  createDefaultViewState,
  getViewStateStorageKey
} from '../types/views';
import type { Node } from '../types/node';

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
 * Common interface that all view classes must implement
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
  private canvasId: string;
  private viewState: ViewState;
  private callbacks: ViewContinuumCallbacks;

  // View renderer registry
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
    this.canvasId = canvasId;
    this.callbacks = callbacks;
    this.animationConfig = animationConfig;

    // Initialize view state (load from storage or create default)
    this.viewState = this.loadViewState();

    // Set up SVG structure
    this.setupSVGStructure();

    // Restore active view if renderers are available
    this.initializeActiveView();

    console.log('🔄 ViewContinuum initialized:', {
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

    console.log('📋 ViewContinuum.registerViewRenderer():', {
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

      console.log('🗑️ ViewContinuum.unregisterViewRenderer():', {
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
      console.warn('⚠️ ViewContinuum.switchToView(): Transition already in progress, interrupting');
      this.interruptTransition();
    }

    const fromView = this.viewState.currentView;
    if (fromView === targetView) {
      console.log('ℹ️ ViewContinuum.switchToView(): Already on target view:', targetView);
      return;
    }

    const targetRenderer = this.viewRenderers.get(targetView);
    if (!targetRenderer) {
      console.error('❌ ViewContinuum.switchToView(): No renderer registered for view:', targetView);
      throw new Error(`No renderer registered for view type: ${targetView}`);
    }

    console.log('🔄 ViewContinuum.switchToView():', {
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

      let sourcePositions: Map<string, CardPosition> = new Map();

      // Capture source positions if animating
      if (animated && this.activeRenderer) {
        sourcePositions = this.activeRenderer.getCardPositions();
      }

      // Switch to target view
      this.viewState.currentView = targetView;
      this.activeRenderer = targetRenderer;

      // Load target view state
      this.restoreViewState();

      // Render new view
      if (this.cachedCards.length > 0) {
        const targetMapping = this.viewState.viewStates[targetView].axisMapping;
        this.activeRenderer.render(this.cachedCards, targetMapping, this.lastActiveFilters);
      }

      // Perform FLIP animation if enabled
      if (animated && sourcePositions.size > 0) {
        await this.performFlipAnimation(sourcePositions, targetRenderer);
      }

      // Auto-focus on switch if configured
      if (this.viewState.config.autoFocusOnSwitch) {
        const focusedCardId = this.viewState.viewStates[targetView].focusedCardId;
        if (focusedCardId) {
          this.activeRenderer.scrollToCard(focusedCardId);
        }
      }

      // Update state and persist
      this.viewState.lastModified = Date.now();
      this.saveViewState();

      // Emit transition event
      this.emitViewChangeEvent(transitionEvent);

      console.log('✅ ViewContinuum.switchToView(): Transition complete', {
        to: targetView,
        duration: Date.now() - transitionEvent.timestamp
      });

    } catch (error) {
      console.error('❌ ViewContinuum.switchToView(): Transition failed:', error);

      // Rollback on error
      this.viewState.currentView = fromView;
      this.activeRenderer = this.viewRenderers.get(fromView) || null;

      throw error;
    } finally {
      this.isTransitioning = false;
      this.viewState.transitionState = undefined;
    }
  }

  /**
   * Perform FLIP animation between views
   */
  private async performFlipAnimation(
    sourcePositions: Map<string, CardPosition>,
    targetRenderer: ViewRenderer
  ): Promise<void> {
    const targetPositions = targetRenderer.getCardPositions();
    const animationPromises: Promise<void>[] = [];

    let staggerDelay = 0;

    // Animate each card that exists in both source and target
    sourcePositions.forEach((sourcePos, cardId) => {
      const targetPos = targetPositions.get(cardId);
      if (targetPos) {
        const animationPromise = this.animateCardFlip(
          cardId,
          sourcePos,
          targetPos,
          staggerDelay
        );
        animationPromises.push(animationPromise);

        if (this.animationConfig.stagger) {
          staggerDelay += this.animationConfig.stagger;
        }
      }
    });

    // Wait for all animations to complete
    if (animationPromises.length > 0) {
      await Promise.all(animationPromises);
    }
  }

  /**
   * Animate a single card using FLIP technique
   */
  private animateCardFlip(
    cardId: string,
    from: CardPosition,
    to: CardPosition,
    delay: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const cardElement = this.container
        .select(`[data-card-id="${cardId}"]`);

      if (cardElement.empty()) {
        resolve();
        return;
      }

      // Calculate deltas (First → Last, Invert, Play)
      const deltaX = from.x - to.x;
      const deltaY = from.y - to.y;
      const deltaScale = (from.width / to.width) || 1;

      // Apply inverted transform immediately
      cardElement
        .style('transform-origin', 'top left')
        .attr('transform', `translate(${to.x + deltaX}, ${to.y + deltaY}) scale(${deltaScale})`);

      // Add fade effect if enabled
      if (this.animationConfig.effects?.enableFade) {
        cardElement.style('opacity', 0.8);
      }

      // Animate to identity transform (Play)
      setTimeout(() => {
        cardElement
          .transition()
          .duration(this.animationConfig.duration)
          .ease(this.getD3Easing())
          .attr('transform', `translate(${to.x}, ${to.y}) scale(1)`)
          .style('opacity', 1)
          .on('end', () => resolve());
      }, delay);
    });
  }

  /**
   * Interrupt current transition
   */
  private interruptTransition(): void {
    this.container.selectAll('*')
      .interrupt();

    this.isTransitioning = false;
    this.viewState.transitionState = undefined;

    console.log('⏹️ ViewContinuum: Transition interrupted');
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
      console.log('💾 ViewContinuum.queryAndCache(): Using cached results');
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

    console.log('🔍 ViewContinuum.queryAndCache():', {
      queryHash,
      resultCount: results.length,
      cached: true
    });

    // Re-render active view with new data
    if (this.activeRenderer) {
      const currentMapping = this.viewState.viewStates[this.viewState.currentView].axisMapping;
      this.activeRenderer.render(results, currentMapping, activeFilters);
    }

    return results;
  }

  /**
   * Re-project cached data to current view (no re-query)
   */
  reprojectCachedData(): void {
    if (this.cachedCards.length === 0 || !this.activeRenderer) {
      console.warn('⚠️ ViewContinuum.reprojectCachedData(): No cached data or active renderer');
      return;
    }

    const currentMapping = this.viewState.viewStates[this.viewState.currentView].axisMapping;
    this.activeRenderer.render(this.cachedCards, currentMapping, this.lastActiveFilters);

    console.log('🔄 ViewContinuum.reprojectCachedData(): Re-projected data to current view:', {
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

    console.log('📋 ViewContinuum.updateSelection():', {
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

        console.log('💾 ViewContinuum: Loaded state from localStorage:', {
          currentView: parsed.currentView,
          selectionCount: parsed.selectionState?.selectedCardIds?.size || 0
        });

        return parsed;
      }
    } catch (error) {
      console.warn('⚠️ ViewContinuum: Failed to load state from localStorage:', error);
    }

    // Create default state
    const defaultState = createDefaultViewState(this.canvasId);
    console.log('🆕 ViewContinuum: Created default view state');
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

      console.log('💾 ViewContinuum: Saved state to localStorage:', {
        currentView: this.viewState.currentView,
        timestamp: this.viewState.lastModified
      });
    } catch (error) {
      console.warn('⚠️ ViewContinuum: Failed to save state to localStorage:', error);
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

    console.log('💾 ViewContinuum.saveCurrentViewState():', {
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

    console.log('🔄 ViewContinuum.restoreViewState():', {
      viewType: currentView,
      lastUpdated: viewState.lastUpdated
    });
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

    console.log('🏗️ ViewContinuum: SVG structure initialized');
  }

  /**
   * Initialize active view if renderer is available
   */
  private initializeActiveView(): void {
    const currentRenderer = this.viewRenderers.get(this.viewState.currentView);
    if (currentRenderer) {
      this.activeRenderer = currentRenderer;
      this.restoreViewState();

      console.log('✅ ViewContinuum: Active view initialized:', this.viewState.currentView);
    } else {
      console.log('ℹ️ ViewContinuum: No renderer available for current view:', this.viewState.currentView);
    }
  }

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

  /**
   * Get D3 easing function for animations
   */
  private getD3Easing(): (t: number) => number {
    switch (this.animationConfig.easing) {
      case 'ease-in-out':
        return d3.easeCubicInOut;
      case 'cubic':
        return d3.easeCubic;
      case 'ease-out':
      default:
        return d3.easeCubicOut; // Matches Phase 36 choice
    }
  }

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

    console.log('📐 ViewContinuum.updateAxisMapping():', {
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

    if (this.activeRenderer) {
      this.activeRenderer.scrollToCard(cardId);
    }

    console.log('🎯 ViewContinuum.focusCard():', { cardId, viewType: this.viewState.currentView });
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

    console.log('🧹 ViewContinuum.clearCache(): Cache cleared');
  }

  /**
   * Reset view state to defaults
   */
  resetState(): void {
    this.viewState = createDefaultViewState(this.canvasId);
    this.saveViewState();

    console.log('🔄 ViewContinuum.resetState(): State reset to defaults');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Interrupt any running transitions
    this.interruptTransition();

    // Clean up all registered renderers
    this.viewRenderers.forEach((renderer) => {
      renderer.destroy();
    });
    this.viewRenderers.clear();

    // Clear active renderer
    this.activeRenderer = null;

    // Save final state
    this.saveViewState();

    // Clear SVG content
    this.container.selectAll('*').remove();

    // Clear cached data
    this.clearCache();

    console.log('🗑️ ViewContinuum.destroy(): Cleanup complete');
  }
}