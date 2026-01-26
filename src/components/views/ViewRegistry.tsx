import type { ViewRenderer, ViewType, ViewComponentProps, TransitionConfig } from '../../types/view';
import { gridViewRenderer } from './GridViewRenderer';
import { listViewRenderer } from './ListViewRenderer';

/**
 * ViewRegistry - Centralized registry for all view renderers
 *
 * Manages view instances, transitions, and provides a unified interface
 * for view switching with state preservation.
 */
export class ViewRegistry {
  private renderers = new Map<ViewType, ViewRenderer>();
  private currentRenderer: ViewRenderer | null = null;
  private transitionConfig: TransitionConfig = {
    duration: 300,
    easing: 'ease-out'
  };

  constructor() {
    this.registerRenderer(gridViewRenderer);
    this.registerRenderer(listViewRenderer);
  }

  /**
   * Register a view renderer
   */
  registerRenderer(renderer: ViewRenderer): void {
    this.renderers.set(renderer.type, renderer);
  }

  /**
   * Get a specific view renderer
   */
  getRenderer(type: ViewType): ViewRenderer | null {
    return this.renderers.get(type) || null;
  }

  /**
   * Get all registered view types
   */
  getAvailableViews(): ViewType[] {
    return Array.from(this.renderers.keys());
  }

  /**
   * Get current active renderer
   */
  getCurrentRenderer(): ViewRenderer | null {
    return this.currentRenderer;
  }

  /**
   * Switch to a different view with smooth transitions
   */
  async switchToView(
    type: ViewType,
    customConfig?: Partial<TransitionConfig>
  ): Promise<ViewRenderer | null> {
    const newRenderer = this.getRenderer(type);
    if (!newRenderer) {
      console.warn(`View type "${type}" is not registered`);
      return null;
    }

    // If switching to the same view, no transition needed
    if (this.currentRenderer?.type === type) {
      return newRenderer;
    }

    const config = { ...this.transitionConfig, ...customConfig };

    try {
      // Perform transition from current to new view
      if (this.currentRenderer) {
        await this.performTransition(this.currentRenderer, newRenderer, config);
      }

      this.currentRenderer = newRenderer;
      return newRenderer;
    } catch (error) {
      console.error('View transition failed:', error);
      return null;
    }
  }

  /**
   * Set global transition configuration
   */
  setTransitionConfig(config: Partial<TransitionConfig>): void {
    this.transitionConfig = { ...this.transitionConfig, ...config };
  }

  /**
   * Check if a view type is available
   */
  isViewAvailable(type: ViewType): boolean {
    return this.renderers.has(type);
  }

  /**
   * Get view renderer info
   */
  getViewInfo(type: ViewType): { type: ViewType; name: string; renderMode: string } | null {
    const renderer = this.getRenderer(type);
    if (!renderer) return null;

    return {
      type: renderer.type,
      name: renderer.name,
      renderMode: renderer.renderMode
    };
  }

  /**
   * Perform smooth transition between views
   */
  private async performTransition(
    fromRenderer: ViewRenderer,
    toRenderer: ViewRenderer,
    config: TransitionConfig
  ): Promise<void> {
    try {
      // Phase 1: Prepare new view (load compatible state)
      await toRenderer.transitionFrom?.(fromRenderer, config);

      // Phase 2: Transition out current view
      await fromRenderer.transitionTo?.(toRenderer, config);

    } catch (error) {
      console.error('Transition error:', error);
      throw error;
    }
  }
}

// Create singleton registry instance
export const viewRegistry = new ViewRegistry();

/**
 * React hook for using the view registry
 */
export function useViewRegistry() {
  return {
    registry: viewRegistry,
    switchToView: viewRegistry.switchToView.bind(viewRegistry),
    getCurrentRenderer: viewRegistry.getCurrentRenderer.bind(viewRegistry),
    getAvailableViews: viewRegistry.getAvailableViews.bind(viewRegistry),
    isViewAvailable: viewRegistry.isViewAvailable.bind(viewRegistry),
    getViewInfo: viewRegistry.getViewInfo.bind(viewRegistry)
  };
}