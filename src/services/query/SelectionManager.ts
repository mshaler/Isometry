/**
 * SelectionManager - Multi-select state management for SuperGrid
 *
 * Purpose: Comprehensive selection management service providing multi-card selection,
 * keyboard navigation, and bulk operation support for SuperGrid.
 *
 * Key features:
 * - Multiple selection modes (single, add, range)
 * - Keyboard navigation with arrow keys
 * - Selection state persistence across filter changes
 * - Callback system for UI integration
 *
 * Architecture: Event-driven service with immutable state management
 * Following CLAUDE.md patterns for strict typing and comprehensive error handling
 */

export type SelectionMode = 'single' | 'add' | 'range';
export type NavigationDirection = 'up' | 'down' | 'left' | 'right';

export interface SelectionState {
  selectedIds: Set<string>;
  focusedId: string | null;
  selectionMode: SelectionMode;
  lastSelectedId: string | null; // For range selection
}

export interface GridPosition {
  row: number;
  col: number;
  id: string;
}

export interface SelectionCallbacks {
  onSelectionChange?: (selectedIds: string[], focusedId: string | null) => void;
  onFocusChange?: (focusedId: string | null) => void;
  onBulkOperation?: (operation: string, selectedIds: string[]) => void;
}

export interface SelectionStatistics {
  count: number;
  types: Record<string, number>; // Count by card type/folder
  memoryImpact: number; // Bytes
}

/**
 * SelectionManager - Comprehensive multi-select state management
 *
 * Handles all aspects of card selection, keyboard navigation, and bulk operations
 * for the SuperGrid system. Maintains selection state across grid updates and
 * filtering operations.
 */
export class SelectionManager {
  private state: SelectionState;
  private callbacks: SelectionCallbacks;
  private gridLayout: GridPosition[] = [];
  private readonly maxSelectionSize = 1000; // Performance limit

  constructor(callbacks: SelectionCallbacks = {}) {
    this.state = {
      selectedIds: new Set(),
      focusedId: null,
      selectionMode: 'single',
      lastSelectedId: null,
    };
    this.callbacks = callbacks;
  }

  /**
   * Select a card with specified mode
   *
   * @param id - Card ID to select
   * @param mode - Selection mode: 'single' (replace), 'add' (toggle), 'range' (extend)
   */
  selectCard(id: string, mode: SelectionMode = 'single'): void {
    if (!id) {
      console.warn('SelectionManager: Cannot select card with empty ID');
      return;
    }

    const prevState = this.cloneState();

    try {
      switch (mode) {
        case 'single':
          this.state.selectedIds.clear();
          this.state.selectedIds.add(id);
          this.state.focusedId = id;
          this.state.lastSelectedId = id;
          break;

        case 'add':
          if (this.state.selectedIds.has(id)) {
            this.state.selectedIds.delete(id);
            // If we deselected the focused card, focus the first remaining selected
            if (this.state.focusedId === id) {
              this.state.focusedId = this.state.selectedIds.values().next().value || null;
            }
          } else {
            if (this.state.selectedIds.size >= this.maxSelectionSize) {
              console.warn('SelectionManager: Maximum selection size reached');
              return;
            }
            this.state.selectedIds.add(id);
            this.state.focusedId = id;
          }
          this.state.lastSelectedId = id;
          break;

        case 'range':
          this.selectRange(this.state.lastSelectedId, id);
          this.state.focusedId = id;
          break;

        default:
          console.error('SelectionManager: Invalid selection mode', mode);
          return;
      }

      this.state.selectionMode = mode;
      this.notifySelectionChange();

    } catch (error) {
      console.error('SelectionManager: Error in selectCard', error);
      this.state = prevState; // Rollback on error
    }
  }

  /**
   * Remove a specific card from selection
   */
  deselectCard(id: string): void {
    if (!id || !this.state.selectedIds.has(id)) {
      return;
    }

    this.state.selectedIds.delete(id);

    // Update focus if we deselected the focused card
    if (this.state.focusedId === id) {
      this.state.focusedId = this.state.selectedIds.values().next().value || null;
    }

    this.notifySelectionChange();
  }

  /**
   * Select all visible cards in current grid
   */
  selectAll(): void {
    if (this.gridLayout.length === 0) {
      console.warn('SelectionManager: No grid layout available for selectAll');
      return;
    }

    this.state.selectedIds.clear();

    // Limit selection to maxSelectionSize for performance
    const cardsToSelect = this.gridLayout.slice(0, this.maxSelectionSize);
    cardsToSelect.forEach(pos => this.state.selectedIds.add(pos.id));

    this.state.focusedId = cardsToSelect[0]?.id || null;
    this.state.lastSelectedId = this.state.focusedId;
    this.state.selectionMode = 'add';

    if (cardsToSelect.length < this.gridLayout.length) {
      console.warn(`SelectionManager: Selected ${cardsToSelect.length} of ${this.gridLayout.length} cards (performance limit)`);
    }

    this.notifySelectionChange();
  }

  /**
   * Clear all selection
   */
  clearSelection(): void {
    this.state.selectedIds.clear();
    this.state.focusedId = null;
    this.state.lastSelectedId = null;
    this.state.selectionMode = 'single';
    this.notifySelectionChange();
  }

  /**
   * Set keyboard focus to specific card without changing selection
   */
  setFocus(id: string | null): void {
    this.state.focusedId = id;
    this.callbacks.onFocusChange?.(id);
  }

  /**
   * Move selection/focus in specified direction using grid layout
   */
  moveSelection(direction: NavigationDirection, extendSelection: boolean = false): void {
    if (this.gridLayout.length === 0) {
      console.warn('SelectionManager: No grid layout available for navigation');
      return;
    }

    const currentPos = this.findCardPosition(this.state.focusedId);
    if (!currentPos) {
      // No focus, set to first card
      const firstCard = this.gridLayout[0];
      if (firstCard) {
        this.setFocus(firstCard.id);
        if (!extendSelection) {
          this.selectCard(firstCard.id, 'single');
        }
      }
      return;
    }

    const newPos = this.getNextPosition(currentPos, direction);
    if (!newPos) {
      // No valid position in that direction
      return;
    }

    this.setFocus(newPos.id);

    if (extendSelection) {
      // Extend selection to include new position
      this.state.selectedIds.add(newPos.id);
      this.notifySelectionChange();
    } else {
      // Move selection to new position only
      this.selectCard(newPos.id, 'single');
    }
  }

  /**
   * Get current selection as array of card IDs
   */
  getSelectedCards(): string[] {
    return Array.from(this.state.selectedIds);
  }

  /**
   * Check if specific card is selected
   */
  isSelected(id: string): boolean {
    return this.state.selectedIds.has(id);
  }

  /**
   * Get current focused card ID
   */
  getFocusedCard(): string | null {
    return this.state.focusedId;
  }

  /**
   * Update grid layout for navigation calculations
   */
  updateGridLayout(layout: GridPosition[]): void {
    this.gridLayout = [...layout]; // Defensive copy

    // Clean up selection - remove any selected IDs that are no longer in the grid
    const validIds = new Set(layout.map(pos => pos.id));
    const invalidIds = Array.from(this.state.selectedIds).filter(id => !validIds.has(id));

    if (invalidIds.length > 0) {
      invalidIds.forEach(id => this.state.selectedIds.delete(id));

      // Update focus if focused card is no longer valid
      if (this.state.focusedId && !validIds.has(this.state.focusedId)) {
        this.state.focusedId = this.state.selectedIds.values().next().value || null;
      }

      console.warn(`SelectionManager: Cleaned up ${invalidIds.length} invalid selections`);
      this.notifySelectionChange();
    }
  }

  /**
   * Get selection statistics
   */
  getSelectionStatistics(): SelectionStatistics {
    const count = this.state.selectedIds.size;
    const types: Record<string, number> = {};

    // Calculate memory impact (approximate)
    const memoryImpact = count * 32; // Rough estimate: 32 bytes per selected ID

    // TODO: Add card type analysis when card data is available
    types['selected'] = count;

    return {
      count,
      types,
      memoryImpact,
    };
  }

  /**
   * Handle bulk operations
   */
  performBulkOperation(operation: string): void {
    const selectedIds = this.getSelectedCards();
    if (selectedIds.length === 0) {
      console.warn('SelectionManager: No cards selected for bulk operation');
      return;
    }

    this.callbacks.onBulkOperation?.(operation, selectedIds);
  }

  // Private helper methods

  private cloneState(): SelectionState {
    return {
      selectedIds: new Set(this.state.selectedIds),
      focusedId: this.state.focusedId,
      selectionMode: this.state.selectionMode,
      lastSelectedId: this.state.lastSelectedId,
    };
  }

  private selectRange(startId: string | null, endId: string): void {
    if (!startId) {
      this.state.selectedIds.add(endId);
      return;
    }

    const startPos = this.findCardPosition(startId);
    const endPos = this.findCardPosition(endId);

    if (!startPos || !endPos) {
      this.state.selectedIds.add(endId);
      return;
    }

    // Select all cards in rectangular region between start and end
    const minRow = Math.min(startPos.row, endPos.row);
    const maxRow = Math.max(startPos.row, endPos.row);
    const minCol = Math.min(startPos.col, endPos.col);
    const maxCol = Math.max(startPos.col, endPos.col);

    this.gridLayout
      .filter(pos => pos.row >= minRow && pos.row <= maxRow &&
                     pos.col >= minCol && pos.col <= maxCol)
      .forEach(pos => {
        if (this.state.selectedIds.size < this.maxSelectionSize) {
          this.state.selectedIds.add(pos.id);
        }
      });
  }

  private findCardPosition(id: string | null): GridPosition | null {
    if (!id) return null;
    return this.gridLayout.find(pos => pos.id === id) || null;
  }

  private getNextPosition(current: GridPosition, direction: NavigationDirection): GridPosition | null {
    switch (direction) {
      case 'up':
        return this.gridLayout.find(pos =>
          pos.col === current.col && pos.row === current.row - 1
        ) || null;

      case 'down':
        return this.gridLayout.find(pos =>
          pos.col === current.col && pos.row === current.row + 1
        ) || null;

      case 'left':
        return this.gridLayout.find(pos =>
          pos.row === current.row && pos.col === current.col - 1
        ) || null;

      case 'right':
        return this.gridLayout.find(pos =>
          pos.row === current.row && pos.col === current.col + 1
        ) || null;

      default:
        return null;
    }
  }

  private notifySelectionChange(): void {
    const selectedIds = this.getSelectedCards();
    this.callbacks.onSelectionChange?.(selectedIds, this.state.focusedId);
  }
}