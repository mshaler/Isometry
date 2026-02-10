/**
 * Data Manager for ViewContinuum
 *
 * Handles query caching and data projection across view switches
 */

import type { Node } from '../../types/node';
import type { ViewState, ViewAxisMapping } from '../../types/views';
import type { ViewConfig } from '../../engine/contracts/ViewConfig';
import { IsometryViewEngine } from '../../engine/IsometryViewEngine';
import { devLogger as d3Logger } from '../../utils/logging/dev-logger';

export class DataManager {
  private cachedCards: Node[] = [];
  private cachedQueryHash: string = '';
  private lastActiveFilters: any[] = [];

  constructor(
    private viewEngine: IsometryViewEngine,
    private containerElement: HTMLElement
  ) {}

  /**
   * Query data with LATCH filters and cache results for view switching
   */
  public queryAndCache(
    sql: string,
    parameters: any[] = [],
    activeFilters: any[] = [],
    viewState: ViewState,
    currentViewConfig: ViewConfig | null,
    createViewConfig: (viewType: any, axisMapping: ViewAxisMapping) => ViewConfig
  ): { results: Node[]; queryHash: string } {
    // Generate query hash for cache validation
    const queryHash = this.generateQueryHash(sql, parameters);

    // Return cached results if query hasn't changed
    if (queryHash === this.cachedQueryHash && this.cachedCards.length > 0) {
      d3Logger.state('DataManager.queryAndCache(): Using cached results', {});
      return { results: this.cachedCards, queryHash };
    }

    // TODO: Execute query via DatabaseService
    // For now, return empty array as placeholder
    const results: Node[] = [];

    // Cache results
    this.cachedCards = results;
    this.cachedQueryHash = queryHash;
    this.lastActiveFilters = activeFilters;

    // Update cached query in view state
    viewState.cachedQuery = {
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
    let finalViewConfig = currentViewConfig;
    if (!finalViewConfig) {
      // Create initial view config if none exists
      const currentMapping = viewState.viewStates[viewState.currentView].axisMapping;
      finalViewConfig = createViewConfig(viewState.currentView, currentMapping);
    }

    this.viewEngine.render(this.containerElement, results, finalViewConfig);

    return { results, queryHash };
  }

  /**
   * Re-project cached data to current view (no re-query)
   */
  public reprojectCachedData(
    viewState: ViewState,
    createViewConfig: (viewType: any, axisMapping: ViewAxisMapping) => ViewConfig
  ): ViewConfig | null {
    if (this.cachedCards.length === 0) {
      d3Logger.warn('DataManager reprojectCachedData: No cached data available');
      return null;
    }

    const currentMapping = viewState.viewStates[viewState.currentView].axisMapping;
    const viewConfig = createViewConfig(viewState.currentView, currentMapping);
    this.viewEngine.render(this.containerElement, this.cachedCards, viewConfig);

    d3Logger.data('Re-projected data to current view', {
      viewType: viewState.currentView,
      cardCount: this.cachedCards.length
    });

    return viewConfig;
  }

  /**
   * Get cached cards
   */
  public getCachedCards(): Node[] {
    return [...this.cachedCards];
  }

  /**
   * Get cached query hash
   */
  public getCachedQueryHash(): string {
    return this.cachedQueryHash;
  }

  /**
   * Get last active filters
   */
  public getLastActiveFilters(): any[] {
    return [...this.lastActiveFilters];
  }

  /**
   * Clear cached data
   */
  public clearCache(): void {
    this.cachedCards = [];
    this.cachedQueryHash = '';
    this.lastActiveFilters = [];
  }

  /**
   * Generate query hash for cache validation
   */
  private generateQueryHash(sql: string, parameters: any[]): string {
    const combined = {
      sql,
      parameters,
      timestamp: Math.floor(Date.now() / 1000) // Round to seconds for cache stability
    };
    return btoa(JSON.stringify(combined)).slice(0, 16);
  }
}