import React from 'react';
import { ReactViewRenderer } from './ReactViewRenderer';
import { GridView } from './GridView';
import type { ViewComponentProps, ViewTransitionState } from '../../types/view';

/**
 * GridViewRenderer - ViewRenderer implementation for GridView
 *
 * Provides standardized interface for the existing GridView component,
 * enabling seamless view switching and state preservation.
 */
export class GridViewRenderer extends ReactViewRenderer {
  public readonly type = 'grid' as const;
  public readonly name = 'Grid View';

  // Return the GridView component
  getComponent(): React.ComponentType<ViewComponentProps> {
    return GridView as React.ComponentType<ViewComponentProps>;
  }

  // Grid-specific state management
  saveState(): ViewTransitionState {
    const baseState = super.saveState();

    // Add grid-specific state if needed
    return {
      ...baseState,
      // Grid view uses PAFV wells for its axes, so axis configuration is preserved in baseState
    };
  }

  loadState(state: ViewTransitionState): void {
    super.loadState(state);

    // Restore grid-specific state
    // Grid view automatically adapts to axis configuration through PAFV context
  }

  // Grid view updates when PAFV mappings change
  shouldUpdate(
    previousNodes: import('../../types/node').Node[],
    nextNodes: import('../../types/node').Node[],
    previousDimensions: import('../../types/view').Dimensions,
    nextDimensions: import('../../types/view').Dimensions
  ): boolean {
    const baseUpdate = super.shouldUpdate(previousNodes, nextNodes, previousDimensions, nextDimensions);

    // Grid view is sensitive to axis changes through PAFV context
    // The parent component should trigger updates when axis mappings change
    return baseUpdate;
  }
}

// Create singleton instance for use throughout the application
export const gridViewRenderer = new GridViewRenderer();