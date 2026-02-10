/**
 * View Registration Manager for ViewContinuum
 *
 * Handles registration and management of view renderers
 */

import { ViewType } from '../../types/views';
import type { ViewState } from '../../types/views';
import type { ViewRenderer } from './types';
import { devLogger as d3Logger } from '../../utils/logging/dev-logger';

export class ViewRegistrationManager {
  private viewRenderers: Map<ViewType, ViewRenderer> = new Map();
  private activeRenderer: ViewRenderer | null = null;

  /**
   * Register a view renderer for a specific view type
   */
  public registerViewRenderer(
    viewType: ViewType,
    renderer: ViewRenderer,
    currentViewState: ViewState,
    onActivate: (renderer: ViewRenderer) => void
  ): void {
    this.viewRenderers.set(viewType, renderer);

    d3Logger.setup('View renderer registered', {
      viewType,
      totalRegistered: this.viewRenderers.size
    });

    // If this is the current view and no active renderer, set it as active
    if (viewType === currentViewState.currentView && !this.activeRenderer) {
      this.activeRenderer = renderer;
      onActivate(renderer);
    }
  }

  /**
   * Unregister a view renderer
   */
  public unregisterViewRenderer(viewType: ViewType): void {
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

  /**
   * Get a registered view renderer
   */
  public getViewRenderer(viewType: ViewType): ViewRenderer | null {
    return this.viewRenderers.get(viewType) || null;
  }

  /**
   * Get the currently active renderer
   */
  public getActiveRenderer(): ViewRenderer | null {
    return this.activeRenderer;
  }

  /**
   * Set the active renderer
   */
  public setActiveRenderer(renderer: ViewRenderer | null): void {
    this.activeRenderer = renderer;
  }

  /**
   * Check if a view type is registered
   */
  public hasViewRenderer(viewType: ViewType): boolean {
    return this.viewRenderers.has(viewType);
  }

  /**
   * Get all registered view types
   */
  public getRegisteredViewTypes(): ViewType[] {
    return Array.from(this.viewRenderers.keys());
  }

  /**
   * Get the number of registered renderers
   */
  public getRegisteredCount(): number {
    return this.viewRenderers.size;
  }

  /**
   * Clear all registered renderers
   */
  public clearAll(): void {
    for (const [viewType, renderer] of this.viewRenderers) {
      renderer.destroy();
    }
    this.viewRenderers.clear();
    this.activeRenderer = null;
  }
}