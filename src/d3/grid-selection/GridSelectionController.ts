/**
 * GridSelectionController - Handles grid selection and keyboard navigation
 *
 * Extracted from SuperGrid.ts to manage multi-select behavior,
 * keyboard navigation, and selection visual updates.
 */

import * as d3 from 'd3';
import { SelectionManager } from '../../services/query/SelectionManager';
import type { SelectionCallbacks } from '../../services/query/SelectionManager';
import type { GridData } from '../../types/grid-core';
import { superGridLogger } from '../../utils/dev-logger';

export interface SelectionControllerConfig {
  enableKeyboardNavigation: boolean;
  enableMultiSelect: boolean;
  selectionMode: 'single' | 'multi';
}

export interface SelectionCallbackHandlers {
  onCardClick?: (card: unknown) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onFocusChange?: (focusedId: string | null) => void;
}

export class GridSelectionController {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private selectionManager: SelectionManager;
  private config: SelectionControllerConfig;
  private callbacks: SelectionCallbackHandlers;
  private currentData: GridData | null = null;

  constructor(
    container: d3.Selection<SVGElement, unknown, null, undefined>,
    config: SelectionControllerConfig,
    callbacks: SelectionCallbackHandlers = {}
  ) {
    this.container = container;
    this.config = config;
    this.callbacks = callbacks;

    // Initialize selection manager
    const selectionCallbacks: SelectionCallbacks = {
      onSelectionChange: (selectedIds) => this.handleSelectionChange(selectedIds),
      onFocusChange: (focusedId) => this.handleFocusChange(focusedId)
    };

    this.selectionManager = new SelectionManager(selectionCallbacks);

    if (this.config.enableKeyboardNavigation) {
      this.setupKeyboardHandlers();
    }
  }

  /**
   * Update the current grid data for selection operations
   */
  public setGridData(data: GridData): void {
    this.currentData = data;
  }

  /**
   * Update configuration and callbacks
   */
  public updateConfig(config: Partial<SelectionControllerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public updateCallbacks(callbacks: Partial<SelectionCallbackHandlers>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Update the container reference when React creates a new SVG element
   */
  public updateContainer(container: d3.Selection<SVGElement, unknown, null, undefined>): void {
    this.container = container;
  }

  /**
   * Handle card click events
   */
  public handleCardClick(event: MouseEvent, cardData: unknown): void {
    // Don't process clicks during drag operations
    if ((event.target as any)?.isDragging) {
      return;
    }

    // Event position available for future spatial selection logic
    this.getEventPosition(event);
    const cardRecord = cardData as Record<string, unknown>;

    const selectionMode = this.config.selectionMode;
    const isMultiSelect = event.ctrlKey || event.metaKey || selectionMode === 'multi';

    const cardId = String(cardRecord.id ?? '');
    this.selectionManager.selectCard(cardId, isMultiSelect ? 'add' : 'single');

    // Handle single selection callback
    if (selectionMode === 'single' && this.callbacks.onCardClick) {
      this.callbacks.onCardClick(cardData);
    }

    superGridLogger.debug('Card clicked', {
      cardId,
      isMultiSelect,
      selectionMode
    });
  }

  /**
   * Get current selection
   */
  public getSelection(): { selectedIds: string[]; focusedId: string | null } {
    return {
      selectedIds: this.selectionManager.getSelectedCards(),
      focusedId: this.selectionManager.getFocusedCard()
    };
  }

  /**
   * Set selection programmatically
   */
  public setSelection(cardIds: string[]): void {
    this.selectionManager.clearSelection();
    cardIds.forEach(id => this.selectionManager.selectCard(id, 'add'));
  }

  /**
   * Clear all selection
   */
  public clearSelection(): void {
    this.selectionManager.clearSelection();
  }

  /**
   * Get the selection manager instance
   */
  public getSelectionManager(): SelectionManager {
    return this.selectionManager;
  }

  /**
   * Focus the grid for keyboard navigation
   */
  public focus(): void {
    (this.container.node() as any)?.focus();
  }

  /**
   * Update visual styling for selected cards
   */
  public updateCardSelectionVisuals(selectedIds: string[]): void {
    this.container
      .selectAll('.card')
      .classed('selected', (d: unknown) => selectedIds.includes(String((d as Record<string, unknown>).id)))
      .classed('multi-selected', selectedIds.length > 1);
  }

  /**
   * Update visual styling for focused card
   */
  public updateCardFocusVisuals(focusedId: string | null): void {
    this.container
      .selectAll('.card')
      .classed('focused', (d: unknown) => (d as Record<string, unknown>).id === focusedId);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.selectionManager) {
      this.selectionManager.clearSelection();
    }

    // Remove keyboard event listeners
    d3.select(document).on('keydown.grid-selection', null);
  }

  /**
   * Handle selection changes from SelectionManager
   */
  private handleSelectionChange(selectedIds: string[]): void {
    this.updateCardSelectionVisuals(selectedIds);

    if (this.callbacks.onSelectionChange) {
      this.callbacks.onSelectionChange(selectedIds);
    }

    superGridLogger.debug('Selection changed', {
      count: selectedIds.length,
      selectedIds: selectedIds.slice(0, 5) // Log first 5 for debugging
    });
  }

  /**
   * Handle focus changes from SelectionManager
   */
  private handleFocusChange(focusedId: string | null): void {
    this.updateCardFocusVisuals(focusedId);

    if (this.callbacks.onFocusChange) {
      this.callbacks.onFocusChange(focusedId);
    }

    superGridLogger.debug('Focus changed', { focusedId });
  }

  /**
   * Setup keyboard event handlers for navigation
   */
  private setupKeyboardHandlers(): void {
    d3.select(document).on('keydown.grid-selection', (event: KeyboardEvent) => {
      // Only handle if grid is focused or no specific focus
      const activeElement = document.activeElement;
      const isGridFocused = activeElement === this.container.node() ||
                           this.container.node()?.contains(activeElement as Node);

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(event.code)) {
        if (isGridFocused || !activeElement || activeElement.tagName === 'BODY') {
          this.handleKeyboardNavigation(event);
        }
      }
    });
  }

  /**
   * Handle keyboard navigation events
   */
  private handleKeyboardNavigation(event: KeyboardEvent): void {
    if (!this.currentData) return;

    event.preventDefault();

    switch (event.code) {
      case 'ArrowUp':
        this.navigateVertically(-1, event.shiftKey);
        break;
      case 'ArrowDown':
        this.navigateVertically(1, event.shiftKey);
        break;
      case 'ArrowLeft':
        this.navigateHorizontally(-1, event.shiftKey);
        break;
      case 'ArrowRight':
        this.navigateHorizontally(1, event.shiftKey);
        break;
      case 'Space':
        this.toggleCurrentFocusSelection();
        break;
      case 'Enter':
        this.activateCurrentFocus();
        break;
      default:
        // Handle Ctrl/Cmd+A for select all
        if (event.ctrlKey || event.metaKey) {
          if (event.code === 'KeyA') {
            this.selectAll();
          }
        }
        break;
    }
  }

  /**
   * Navigate vertically through the grid
   */
  private navigateVertically(direction: number, extendSelection: boolean): void {
    // Implementation would depend on grid layout
    const currentFocus = this.selectionManager.getFocusedCard();
    const cards = this.currentData?.cards || [];

    if (!currentFocus && cards.length > 0) {
      const firstCard = cards[0] as Record<string, unknown>;
      this.selectionManager.setFocus(String(firstCard.id));
      return;
    }

    // Find next card in vertical direction
    const nextCard = this.findCardInDirection(currentFocus, 'vertical', direction);
    if (nextCard) {
      const nextCardRecord = nextCard as Record<string, unknown>;
      this.selectionManager.setFocus(String(nextCardRecord.id));

      if (extendSelection) {
        this.selectionManager.selectCard(String(nextCardRecord.id), 'add');
      }
    }
  }

  /**
   * Navigate horizontally through the grid
   */
  private navigateHorizontally(direction: number, extendSelection: boolean): void {
    const currentFocus = this.selectionManager.getFocusedCard();
    const cards = this.currentData?.cards || [];

    if (!currentFocus && cards.length > 0) {
      const firstCard = cards[0] as Record<string, unknown>;
      this.selectionManager.setFocus(String(firstCard.id));
      return;
    }

    // Find next card in horizontal direction
    const nextCard = this.findCardInDirection(currentFocus, 'horizontal', direction);
    if (nextCard) {
      const nextCardRecord = nextCard as Record<string, unknown>;
      this.selectionManager.setFocus(String(nextCardRecord.id));

      if (extendSelection) {
        this.selectionManager.selectCard(String(nextCardRecord.id), 'add');
      }
    }
  }

  /**
   * Toggle selection of currently focused item
   */
  private toggleCurrentFocusSelection(): void {
    const focusedId = this.selectionManager.getFocusedCard();
    if (focusedId) {
      this.selectionManager.selectCard(focusedId, 'add');
    }
  }

  /**
   * Activate/click the currently focused item
   */
  private activateCurrentFocus(): void {
    const focusedId = this.selectionManager.getFocusedCard();
    if (focusedId && this.callbacks.onCardClick) {
      const card = this.currentData?.cards.find(
        c => (c as Record<string, unknown>).id === focusedId
      );
      if (card) {
        this.callbacks.onCardClick(card);
      }
    }
  }

  /**
   * Select all cards
   */
  private selectAll(): void {
    const allIds = this.currentData?.cards.map(
      card => String((card as Record<string, unknown>).id)
    ) || [];
    this.selectionManager.clearSelection();
    allIds.forEach(id => this.selectionManager.selectCard(id, 'add'));
  }

  /**
   * Find the next card in a given direction
   */
  private findCardInDirection(currentId: string | null, _axis: 'vertical' | 'horizontal', direction: number): unknown {
    if (!currentId || !this.currentData) return null;

    const cards = this.currentData.cards;
    const currentIndex = cards.findIndex(
      card => (card as Record<string, unknown>).id === currentId
    );

    if (currentIndex === -1) return null;

    // Simple linear navigation for now - could be enhanced with spatial positioning
    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < cards.length) {
      return cards[nextIndex];
    }

    return null;
  }

  /**
   * Get event position relative to container
   */
  private getEventPosition(event: MouseEvent): { x: number; y: number } {
    const containerRect = (this.container.node() as SVGElement).getBoundingClientRect();
    return {
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top
    };
  }
}