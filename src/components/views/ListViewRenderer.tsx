import React from 'react';
import { ReactViewRenderer } from './ReactViewRenderer';
import type { ViewComponentProps, ViewTransitionState } from '../../types/view';

// Placeholder component - replaced by unified ViewEngine
const ListViewPlaceholder: React.FC<ViewComponentProps> = () => (
  <div className="p-4 text-center text-gray-500">
    List View - Replaced by unified ViewEngine
  </div>
);

/**
 * ListViewRenderer - Legacy renderer (replaced by unified ViewEngine)
 *
 * @deprecated Use IsometryViewEngine with ListRenderer instead
 */
export class ListViewRenderer extends ReactViewRenderer {
  public readonly type = 'list' as const;
  public readonly name = 'List View';

  // List-specific state
  private searchQuery: string = '';
  private sortAscending: boolean = false;
  private groupingEnabled: boolean = true;

  // Return placeholder component
  getComponent(): React.ComponentType<ViewComponentProps> {
    return ListViewPlaceholder;
  }

  // Enhanced state management for list view
  saveState(): ViewTransitionState {
    const baseState = super.saveState();

    return {
      ...baseState,
      filters: {
        searchQuery: this.searchQuery,
        sortAscending: this.sortAscending,
        groupingEnabled: this.groupingEnabled
      }
    };
  }

  loadState(state: ViewTransitionState): void {
    super.loadState(state);

    // Restore list-specific state
    if (state.filters) {
      this.searchQuery = state.filters.searchQuery as string || '';
      this.sortAscending = state.filters.sortAscending as boolean || false;
      this.groupingEnabled = state.filters.groupingEnabled as boolean || true;
    }
  }

  // List view is particularly sensitive to data changes due to virtualization
  shouldUpdate(
    previousNodes: import('../../types/node').Node[],
    nextNodes: import('../../types/node').Node[],
    previousDimensions: import('../../types/view').Dimensions,
    nextDimensions: import('../../types/view').Dimensions
  ): boolean {
    const baseUpdate = super.shouldUpdate(previousNodes, nextNodes, previousDimensions, nextDimensions);

    // List view should update if height changes significantly (affects virtualization)
    if (Math.abs(previousDimensions.height - nextDimensions.height) > 50) {
      return true;
    }

    return baseUpdate;
  }

  // List view specific methods for external state management
  setSearchQuery(query: string): void {
    this.searchQuery = query;
  }

  setSortAscending(ascending: boolean): void {
    this.sortAscending = ascending;
  }

  setGroupingEnabled(enabled: boolean): void {
    this.groupingEnabled = enabled;
  }

  // Getters for external components to access state
  getSearchQuery(): string {
    return this.searchQuery;
  }

  getSortAscending(): boolean {
    return this.sortAscending;
  }

  getGroupingEnabled(): boolean {
    return this.groupingEnabled;
  }
}

// Create singleton instance for use throughout the application
export const listViewRenderer = new ListViewRenderer();