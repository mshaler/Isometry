/**
 * State Manager for ViewContinuum
 *
 * Handles persistence and restoration of view state via localStorage
 */

import type { ViewState } from '../../types/views';
import { createDefaultViewState, getViewStateStorageKey } from '../../types/views';
import { devLogger as d3Logger } from '../../utils/logging/dev-logger';

export class ViewContinuumStateManager {
  private canvasId: string;

  constructor(canvasId: string) {
    this.canvasId = canvasId;
  }

  /**
   * Load view state from localStorage
   */
  public loadViewState(): ViewState {
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
  public saveViewState(viewState: ViewState): void {
    try {
      const storageKey = getViewStateStorageKey(this.canvasId);

      // Convert Sets to arrays for JSON serialization
      const serializable = {
        ...viewState,
        selectionState: {
          ...viewState.selectionState,
          selectedCardIds: Array.from(viewState.selectionState.selectedCardIds)
        },
        viewStates: Object.fromEntries(
          Object.entries(viewState.viewStates).map(([viewType, state]) => [
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
        currentView: viewState.currentView,
        timestamp: viewState.lastModified
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
  public saveCurrentViewState(
    viewState: ViewState,
    activeRenderer: any,
    onSaveComplete: () => void
  ): void {
    const currentViewState = viewState.viewStates[viewState.currentView];

    if (activeRenderer?.getCardPositions) {
      // Save card positions from the active renderer
      const positions = activeRenderer.getCardPositions();
      currentViewState.cardPositions = positions;
    }

    // Update timestamp
    viewState.lastModified = Date.now();

    // Save to localStorage
    this.saveViewState(viewState);

    d3Logger.state('Current view state saved', {
      viewType: viewState.currentView,
      positionCount: currentViewState.cardPositions?.size || 0
    });

    onSaveComplete();
  }

  /**
   * Restore view state after switching
   */
  public restoreViewState(
    viewState: ViewState,
    activeRenderer: any,
    reprojectCachedData: () => void
  ): void {
    const currentViewState = viewState.viewStates[viewState.currentView];

    // Restore scroll position if we have cached card positions
    if (currentViewState.scrollPosition) {
      // For now, just log the scroll position - actual restoration depends on view type
      d3Logger.state('ViewContinuum: Restoring scroll position', {
        x: currentViewState.scrollPosition.x,
        y: currentViewState.scrollPosition.y
      });
    }

    // Re-project cached data if available
    reprojectCachedData();

    d3Logger.state('View state restored', {
      viewType: viewState.currentView
    });
  }

  /**
   * Clear stored state for this canvas
   */
  public clearState(): void {
    try {
      const storageKey = getViewStateStorageKey(this.canvasId);
      localStorage.removeItem(storageKey);

      d3Logger.state('ViewContinuum state cleared', {
        canvasId: this.canvasId
      });
    } catch (error) {
      d3Logger.warn('Failed to clear ViewContinuum state', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}