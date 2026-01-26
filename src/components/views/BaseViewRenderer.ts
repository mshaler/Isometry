import type {
  ViewRenderer,
  ViewType,
  RenderMode,
  ViewTransitionState,
  TransitionConfig,
  Dimensions
} from '../../types/view';
import type { Node } from '../../types/node';

/**
 * BaseViewRenderer - Abstract base class for all view implementations
 *
 * Provides common functionality for:
 * - State management and transitions
 * - Axis configuration
 * - Performance optimization
 * - Event handling patterns
 */
export abstract class BaseViewRenderer implements ViewRenderer {
  public abstract readonly type: ViewType;
  public abstract readonly name: string;
  public abstract readonly renderMode: RenderMode;

  protected currentXAxis: string | null = null;
  protected currentYAxis: string | null = null;
  protected transitionState: ViewTransitionState = {};

  // Axis configuration
  setXAxis(facetId: string | null): void {
    this.currentXAxis = facetId;
    this.transitionState.axisConfiguration = {
      x: facetId,
      y: this.currentYAxis
    };
  }

  setYAxis(facetId: string | null): void {
    this.currentYAxis = facetId;
    this.transitionState.axisConfiguration = {
      x: this.currentXAxis,
      y: facetId
    };
  }

  // State management for smooth transitions
  saveState(): ViewTransitionState {
    return {
      ...this.transitionState,
      axisConfiguration: {
        x: this.currentXAxis,
        y: this.currentYAxis
      }
    };
  }

  loadState(state: ViewTransitionState): void {
    this.transitionState = state;
    if (state.axisConfiguration) {
      this.currentXAxis = state.axisConfiguration.x;
      this.currentYAxis = state.axisConfiguration.y;
    }
  }

  // Default transition implementations
  async transitionFrom(
    previousView: ViewRenderer,
    config: TransitionConfig = { duration: 300, easing: 'ease-out' }
  ): Promise<void> {
    // Load state from previous view if compatible
    if (previousView.type !== this.type) {
      const previousState = previousView.saveState();
      this.loadCompatibleState(previousState);
    }

    // Apply fade-in transition
    await this.applyTransition(config, 'fade-in');
  }

  async transitionTo(
    nextView: ViewRenderer,
    config: TransitionConfig = { duration: 300, easing: 'ease-in' }
  ): Promise<void> {
    // Save current state for next view
    nextView.loadState(this.saveState());

    // Apply fade-out transition
    await this.applyTransition(config, 'fade-out');
  }

  // Performance optimization - default implementation
  shouldUpdate(
    previousNodes: Node[],
    nextNodes: Node[],
    previousDimensions: Dimensions,
    nextDimensions: Dimensions
  ): boolean {
    // Check if dimensions changed
    if (previousDimensions.width !== nextDimensions.width ||
        previousDimensions.height !== nextDimensions.height) {
      return true;
    }

    // Check if data changed (basic comparison)
    if (previousNodes.length !== nextNodes.length) {
      return true;
    }

    // Check if data content changed (shallow comparison)
    for (let i = 0; i < previousNodes.length; i++) {
      if (previousNodes[i].id !== nextNodes[i].id ||
          previousNodes[i].modifiedAt !== nextNodes[i].modifiedAt) {
        return true;
      }
    }

    return false;
  }

  // Abstract methods that must be implemented by subclasses
  abstract destroy(): void;

  // Protected helper methods
  protected loadCompatibleState(state: ViewTransitionState): void {
    // Load compatible state elements
    if (state.axisConfiguration) {
      this.setXAxis(state.axisConfiguration.x);
      this.setYAxis(state.axisConfiguration.y);
    }

    // Subclasses can override to handle specific state
    this.transitionState = {
      ...state,
      // Reset view-specific state that might not be compatible
      scrollPosition: undefined,
      zoom: undefined
    };
  }

  protected async applyTransition(config: TransitionConfig, type: 'fade-in' | 'fade-out'): Promise<void> {
    return new Promise((resolve) => {
      // This is a basic implementation - subclasses should override for specific animations
      setTimeout(resolve, config.duration);
    });
  }

  // Default event handlers (can be overridden)
  onCardClick?(node: Node, event: MouseEvent): void {
    console.log('Card clicked:', node.name);
  }

  onCardHover?(node: Node | null): void {
    // Default hover handling
  }

  onResize?(dimensions: Dimensions): void {
    // Default resize handling
  }
}