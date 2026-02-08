/**
 * IsometryViewEngine - Unified rendering engine implementation
 *
 * Implements the ViewEngine interface to provide unified rendering across all view types.
 * Replaces dual D3/CSS rendering paths with single D3-only rendering approach.
 *
 * Architecture:
 * - D3 renders, React controls
 * - Zero serialization bridge (sql.js → D3.js direct access)
 * - Renderer dispatch based on ViewConfig.viewType
 * - Animated transitions between PAFV projections
 */

import * as d3 from 'd3';
import type { Node } from '@/types/node';
import type { ViewEngine, ViewRenderer, ViewPerformanceMetrics } from './contracts/ViewEngine';
import type { ViewConfig } from './contracts/ViewConfig';

/**
 * Error types for ViewEngine operations
 */
export class ViewEngineError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: any) {
    super(message);
    this.name = 'ViewEngineError';
  }
}

export class UnsupportedViewTypeError extends ViewEngineError {
  constructor(viewType: string) {
    super(`Unsupported view type: ${viewType}`, 'UNSUPPORTED_VIEW_TYPE', { viewType });
  }
}

export class InvalidContainerError extends ViewEngineError {
  constructor(message: string) {
    super(`Invalid container: ${message}`, 'INVALID_CONTAINER');
  }
}

/**
 * Main implementation of unified ViewEngine
 *
 * Dispatches to view-specific renderers based on ViewConfig.viewType.
 * Handles transitions, cleanup, and performance monitoring.
 */
export class IsometryViewEngine implements ViewEngine {
  private container: HTMLElement | null = null;
  private currentConfig: ViewConfig | null = null;
  private renderers: Map<string, ViewRenderer> = new Map();
  private performanceMetrics: ViewPerformanceMetrics;
  private isTransitioning = false;

  // D3 selections for container management
  private containerSelection: d3.Selection<HTMLElement, unknown, null, undefined> | null = null;

  constructor() {
    this.performanceMetrics = {
      lastRenderTime: 0,
      averageRenderTime: 0,
      nodesRendered: 0,
      frameRate: 0,
      memoryUsage: 0,
      withinTarget: true
    };

    // Initialize with error handling
    this.setupErrorHandling();
  }

  /**
   * Primary render method - implements ViewEngine interface
   */
  async render(container: HTMLElement, data: Node[], config: ViewConfig): Promise<void> {
    const startTime = performance.now();

    try {
      // Validate inputs
      this.validateRenderInputs(container, data, config);

      // Set up container if new or changed
      if (this.container !== container) {
        this.setContainer(container);
      }

      // Check if we need to transition or render fresh
      if (this.currentConfig && this.shouldTransition(this.currentConfig, config)) {
        await this.transition(this.currentConfig, config);
        return;
      }

      // Get or create renderer for this view type
      const renderer = this.getRenderer(config.viewType);

      // Clear container for fresh render
      this.clearContainer();

      // Execute render through view-specific renderer
      renderer.render(container, data, config);

      // Store current state
      this.currentConfig = config;

      // Update performance metrics
      this.updatePerformanceMetrics(startTime, data.length);

      console.log(`[IsometryViewEngine] Rendered ${config.viewType} with ${data.length} nodes in ${this.performanceMetrics.lastRenderTime.toFixed(2)}ms`);

    } catch (error) {
      console.error('[IsometryViewEngine] Render failed:', error);
      throw new ViewEngineError(
        `Render failed: ${error instanceof Error ? error.message : String(error)}`,
        'RENDER_FAILED',
        { viewType: config.viewType, nodeCount: data.length }
      );
    }
  }

  /**
   * Animated transition between view configurations
   */
  async transition(fromConfig: ViewConfig, toConfig: ViewConfig, duration = 300): Promise<void> {
    if (this.isTransitioning) {
      console.warn('[IsometryViewEngine] Transition already in progress, skipping');
      return;
    }

    this.isTransitioning = true;
    const startTime = performance.now();

    try {
      // Validate transition parameters
      if (!this.container || !this.containerSelection) {
        throw new ViewEngineError('No container available for transition', 'NO_CONTAINER');
      }

      // Determine transition type
      const isSameViewType = fromConfig.viewType === toConfig.viewType;
      const isPAFVProjectionChange = !this.projectionsEqual(fromConfig.projection, toConfig.projection);

      console.log(`[IsometryViewEngine] Transitioning ${fromConfig.viewType} → ${toConfig.viewType}`, {
        sameViewType: isSameViewType,
        projectionChange: isPAFVProjectionChange,
        duration
      });

      if (isSameViewType && isPAFVProjectionChange) {
        // PAFV projection change within same view type - use FLIP animation
        await this.transitionPAFVProjection(fromConfig, toConfig, duration);
      } else {
        // View type change - cross-fade transition
        await this.transitionViewType(fromConfig, toConfig, duration);
      }

      // Update current config
      this.currentConfig = toConfig;

      // Update performance metrics
      const transitionTime = performance.now() - startTime;
      console.log(`[IsometryViewEngine] Transition completed in ${transitionTime.toFixed(2)}ms`);

    } catch (error) {
      console.error('[IsometryViewEngine] Transition failed:', error);
      throw new ViewEngineError(
        `Transition failed: ${error instanceof Error ? error.message : String(error)}`,
        'TRANSITION_FAILED',
        { fromViewType: fromConfig.viewType, toViewType: toConfig.viewType }
      );
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    try {
      // Destroy all renderers
      this.renderers.forEach(renderer => {
        try {
          renderer.destroy();
        } catch (error) {
          console.warn('[IsometryViewEngine] Error destroying renderer:', error);
        }
      });
      this.renderers.clear();

      // Clear container
      this.clearContainer();

      // Reset state
      this.container = null;
      this.containerSelection = null;
      this.currentConfig = null;
      this.isTransitioning = false;

      console.log('[IsometryViewEngine] Destroyed successfully');
    } catch (error) {
      console.error('[IsometryViewEngine] Error during destroy:', error);
    }
  }

  /**
   * Get current view configuration
   */
  getConfig(): ViewConfig | null {
    return this.currentConfig;
  }

  /**
   * Check if renderer supports the specified view type
   */
  supportsViewType(viewType: string): boolean {
    return this.renderers.has(viewType) || this.canCreateRenderer(viewType);
  }

  /**
   * Register a custom renderer for a view type
   */
  registerRenderer(viewType: string, renderer: ViewRenderer): void {
    this.renderers.set(viewType, renderer);
    console.log(`[IsometryViewEngine] Registered renderer for ${viewType}`);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): ViewPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  // Private methods

  private validateRenderInputs(container: HTMLElement, data: Node[], config: ViewConfig): void {
    if (!container || !(container instanceof HTMLElement)) {
      throw new InvalidContainerError('Container must be a valid HTMLElement');
    }

    if (!Array.isArray(data)) {
      throw new ViewEngineError('Data must be an array', 'INVALID_DATA');
    }

    if (!config || typeof config.viewType !== 'string') {
      throw new ViewEngineError('Config must have a valid viewType', 'INVALID_CONFIG');
    }
  }

  private setContainer(container: HTMLElement): void {
    this.container = container;
    this.containerSelection = d3.select(container);

    // Add CSS classes for styling
    this.containerSelection
      .classed('isometry-view-engine', true)
      .classed('view-container', true);
  }

  private clearContainer(): void {
    if (this.containerSelection) {
      this.containerSelection.selectAll('*').remove();
    }
  }

  private getRenderer(viewType: string): ViewRenderer {
    let renderer = this.renderers.get(viewType);

    if (!renderer) {
      renderer = this.createRenderer(viewType);
      this.renderers.set(viewType, renderer);
    }

    return renderer;
  }

  private createRenderer(viewType: string): ViewRenderer {
    // For now, throw error for unsupported types
    // Will be populated as individual renderers are implemented
    switch (viewType) {
      case 'grid':
        // GridRenderer will be implemented in Task 3
        throw new UnsupportedViewTypeError(viewType + ' (GridRenderer not yet implemented)');

      case 'list':
      case 'kanban':
      case 'timeline':
      case 'graph':
      case 'supergrid':
        throw new UnsupportedViewTypeError(viewType);

      default:
        throw new UnsupportedViewTypeError(viewType);
    }
  }

  private canCreateRenderer(viewType: string): boolean {
    // Check if we know how to create this renderer type
    const supportedTypes = ['grid', 'list', 'kanban', 'timeline', 'graph', 'supergrid'];
    return supportedTypes.includes(viewType);
  }

  private shouldTransition(oldConfig: ViewConfig, newConfig: ViewConfig): boolean {
    // Transition if view type changes or PAFV projection changes
    return (
      oldConfig.viewType !== newConfig.viewType ||
      !this.projectionsEqual(oldConfig.projection, newConfig.projection)
    );
  }

  private projectionsEqual(a: any, b: any): boolean {
    // Simple comparison - could be enhanced with deep comparison
    return (
      a.x?.axis === b.x?.axis && a.x?.facet === b.x?.facet &&
      a.y?.axis === b.y?.axis && a.y?.facet === b.y?.facet &&
      a.color?.axis === b.color?.axis && a.color?.facet === b.color?.facet
    );
  }

  private async transitionPAFVProjection(
    _fromConfig: ViewConfig,
    _toConfig: ViewConfig,
    duration: number
  ): Promise<void> {
    // FLIP animation for PAFV projection changes
    console.log('[IsometryViewEngine] PAFV projection transition not yet implemented');

    // For now, just re-render with new projection
    // TODO: Implement FLIP animation following Phase 37 patterns
    if (this.container) {
      // Get fresh data and re-render
      // Note: In real implementation, this would preserve data and animate positions
      // const renderer = this.getRenderer(toConfig.viewType);
      this.clearContainer();

      // Simulate animation delay
      await new Promise(resolve => setTimeout(resolve, duration));

      // renderer.render would be called here with new projection
      console.log('[IsometryViewEngine] PAFV projection change completed');
    }
  }

  private async transitionViewType(
    _fromConfig: ViewConfig,
    _toConfig: ViewConfig,
    duration: number
  ): Promise<void> {
    // Cross-fade between different view types
    if (!this.containerSelection) return;

    // Create temporary container for new view
    const newContainer = this.containerSelection
      .append('div')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('top', '0')
      .style('left', '0')
      .style('width', '100%')
      .style('height', '100%');

    try {
      // Render new view in temporary container
      // const newRenderer = this.getRenderer(toConfig.viewType);
      // newRenderer.render would be called here

      // Fade out old, fade in new
      this.containerSelection.selectAll(':not(:last-child)')
        .transition()
        .duration(duration)
        .style('opacity', 0)
        .remove();

      await newContainer
        .transition()
        .duration(duration)
        .style('opacity', 1)
        .end();

      // Remove temporary styling
      newContainer
        .style('position', null)
        .style('top', null)
        .style('left', null);

    } catch (error) {
      // Clean up on error
      newContainer.remove();
      throw error;
    }
  }

  private updatePerformanceMetrics(startTime: number, nodeCount: number): void {
    const renderTime = performance.now() - startTime;

    // Update metrics with rolling average
    const alpha = 0.2; // Smoothing factor
    this.performanceMetrics = {
      lastRenderTime: renderTime,
      averageRenderTime: this.performanceMetrics.averageRenderTime * (1 - alpha) + renderTime * alpha,
      nodesRendered: nodeCount,
      frameRate: 1000 / renderTime, // Rough estimate
      memoryUsage: this.estimateMemoryUsage(),
      withinTarget: renderTime < 16.67 // 60fps target
    };
  }

  private estimateMemoryUsage(): number {
    // Rough memory usage estimate in MB
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024);
    }
    return 0;
  }

  private setupErrorHandling(): void {
    // Set up global error handling for D3 operations
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason instanceof ViewEngineError) {
        console.error('[IsometryViewEngine] Unhandled ViewEngine error:', event.reason);
      }
    });
  }
}