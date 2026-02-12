/**
 * GridDragDropController - Handles drag and drop operations for grid cards
 *
 * Extracted from SuperGrid.ts to manage card dragging, multi-card movement,
 * and position persistence.
 */

import * as d3 from 'd3';
import type { GridData } from '../../types/grid-core';
import type { useDatabaseService } from '../../hooks/database/useDatabaseService';
import { superGridLogger } from '../../utils/dev-logger';

/** Simplified card position for drag operations */
interface DragCardPosition {
  x: number;
  y: number;
  cardId: string;
}

/** Card data shape bound to D3 elements */
interface CardDatum {
  id: string;
  [key: string]: unknown;
}

export interface DragDropConfig {
  enableDragDrop: boolean;
  snapToGrid: boolean;
  gridSnapSize: number;
  enableMultiCardDrag: boolean;
  persistPositions: boolean;
}

export interface DragDropCallbacks {
  onDragStart?: (cardId: string, position: DragCardPosition) => void;
  onDragMove?: (cardId: string, position: DragCardPosition) => void;
  onDragEnd?: (cardId: string, position: DragCardPosition) => void;
  onPositionUpdate?: (cardId: string, position: DragCardPosition) => void;
}

export class GridDragDropController {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private database: ReturnType<typeof useDatabaseService> | null = null;
  private config: DragDropConfig;
  private callbacks: DragDropCallbacks;
  private currentData: GridData | null = null;

  // Drag state
  private isDragging = false;
  private dragStartPosition: { x: number; y: number } = { x: 0, y: 0 };
  private dragBehavior: d3.DragBehavior<SVGGElement, any, any> | null = null;

  // Multi-select drag state
  private selectedCardIds: string[] = [];

  constructor(
    container: d3.Selection<SVGElement, unknown, null, undefined>,
    config: DragDropConfig,
    callbacks: DragDropCallbacks = {}
  ) {
    this.container = container;
    this.config = config;
    this.callbacks = callbacks;

    if (this.config.enableDragDrop) {
      this.initializeDragBehavior();
    }
  }

  /**
   * Set the database service for position persistence
   */
  public setDatabase(database: ReturnType<typeof useDatabaseService>): void {
    this.database = database;
  }

  /**
   * Update the current grid data
   */
  public setGridData(data: GridData): void {
    this.currentData = data;
  }

  /**
   * Update selected card IDs for multi-card dragging
   */
  public setSelectedCards(cardIds: string[]): void {
    this.selectedCardIds = cardIds;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<DragDropConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.enableDragDrop && !this.dragBehavior) {
      this.initializeDragBehavior();
    } else if (!this.config.enableDragDrop && this.dragBehavior) {
      this.destroyDragBehavior();
    }
  }

  /**
   * Update callbacks
   */
  public updateCallbacks(callbacks: Partial<DragDropCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Update the container reference when React creates a new SVG element
   */
  public updateContainer(container: d3.Selection<SVGElement, unknown, null, undefined>): void {
    this.container = container;
  }

  /**
   * Apply drag behavior to card selection
   */
  public applyDragBehavior(cardSelection: d3.Selection<SVGGElement, any, any, any>): void {
    if (this.dragBehavior) {
      cardSelection.call(this.dragBehavior);
    }
  }

  /**
   * Get current card positions from the grid
   */
  public getCardPositions(): Map<string, DragCardPosition> {
    const positions = new Map<string, DragCardPosition>();

    this.container.selectAll<SVGGElement, CardDatum>('.card').each(function(d) {
      const transform = d3.select(this).attr('transform');
      const match = transform?.match(/translate\(([^,]+),([^)]+)\)/);

      if (match && d.id) {
        positions.set(d.id, {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          cardId: d.id
        });
      }
    });

    return positions;
  }

  /**
   * Update card positions programmatically
   */
  public updateCardPositions(positions: Map<string, DragCardPosition>): void {
    positions.forEach((position, cardId) => {
      const cardElement = this.container.select(`[data-card-id="${cardId}"]`);
      if (!cardElement.empty()) {
        cardElement.attr('transform', `translate(${position.x}, ${position.y})`);
      }
    });
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.destroyDragBehavior();
  }

  /**
   * Check if currently dragging
   */
  public isDragActive(): boolean {
    return this.isDragging;
  }

  /**
   * Initialize D3 drag behavior
   */
  private initializeDragBehavior(): void {
    this.dragBehavior = d3.drag<SVGGElement, any, any>()
      .on('start', (event, cardData) => this.handleDragStart(event, cardData))
      .on('drag', (event, cardData) => this.handleDragging(event, cardData))
      .on('end', (event, cardData) => this.handleDragEnd(event, cardData));
  }

  /**
   * Destroy drag behavior
   */
  private destroyDragBehavior(): void {
    if (this.dragBehavior) {
      this.container.selectAll('.card').on('.drag', null);
      this.dragBehavior = null;
    }
  }

  /**
   * Handle drag start event
   */
  private handleDragStart(event: d3.D3DragEvent<SVGGElement, any, any>, cardData: CardDatum): void {
    this.isDragging = true;
    this.dragStartPosition = { x: event.x, y: event.y };

    // Track drag start position for the current card
    const cardElement = d3.select(event.sourceEvent.target.closest('.card'));
    cardElement.classed('dragging', true);

    if (this.callbacks.onDragStart) {
      this.callbacks.onDragStart(cardData.id, {
        x: event.x,
        y: event.y,
        cardId: cardData.id
      });
    }

    superGridLogger.debug('Drag started', {
      cardId: cardData.id,
      startPosition: this.dragStartPosition,
      selectedCount: this.selectedCardIds.length
    });
  }

  /**
   * Handle drag move event
   */
  private handleDragging(event: d3.D3DragEvent<SVGGElement, any, any>, cardData: CardDatum): void {
    if (!this.isDragging) return;

    let newX = event.x;
    let newY = event.y;

    // Apply grid snapping if enabled
    if (this.config.snapToGrid) {
      newX = Math.round(newX / this.config.gridSnapSize) * this.config.gridSnapSize;
      newY = Math.round(newY / this.config.gridSnapSize) * this.config.gridSnapSize;
    }

    // Update visual position of dragged card
    const cardElement = d3.select(event.sourceEvent.target.closest('.card'));
    cardElement.attr('transform', `translate(${newX}, ${newY})`);

    // Handle multi-card dragging if enabled and multiple cards selected
    if (this.config.enableMultiCardDrag &&
        this.selectedCardIds.length > 1 &&
        this.selectedCardIds.includes(cardData.id)) {
      this.handleMultiCardDrag(cardData.id, newX, newY, this.selectedCardIds);
    }

    if (this.callbacks.onDragMove) {
      this.callbacks.onDragMove(cardData.id, {
        x: newX,
        y: newY,
        cardId: cardData.id
      });
    }
  }

  /**
   * Handle drag end event
   */
  private handleDragEnd(event: d3.D3DragEvent<SVGGElement, any, any>, cardData: CardDatum): void {
    if (!this.isDragging) return;

    this.isDragging = false;

    // Remove dragging class
    const cardElement = d3.select(event.sourceEvent.target.closest('.card'));
    cardElement.classed('dragging', false);

    let finalX = event.x;
    let finalY = event.y;

    // Apply final grid snapping
    if (this.config.snapToGrid) {
      finalX = Math.round(finalX / this.config.gridSnapSize) * this.config.gridSnapSize;
      finalY = Math.round(finalY / this.config.gridSnapSize) * this.config.gridSnapSize;
    }

    // Check if position actually changed
    const deltaX = Math.abs(finalX - this.dragStartPosition.x);
    const deltaY = Math.abs(finalY - this.dragStartPosition.y);
    const positionChanged = deltaX > 5 || deltaY > 5; // 5px threshold

    if (positionChanged) {
      // Handle multi-card final positioning
      if (this.config.enableMultiCardDrag &&
          this.selectedCardIds.length > 1 &&
          this.selectedCardIds.includes(cardData.id)) {
        this.handleMultiCardDragEnd(cardData.id, finalX, finalY, this.selectedCardIds);
      } else {
        // Single card positioning
        if (this.config.persistPositions) {
          this.persistCardPosition(cardData.id, finalX, finalY);
        }
      }
    }

    // Delay callback to prevent interference with click events
    setTimeout(() => {
      if (this.callbacks.onDragEnd) {
        this.callbacks.onDragEnd(cardData.id, {
          x: finalX,
          y: finalY,
          cardId: cardData.id
        });
      }
    }, 10);

    superGridLogger.debug('Drag ended', {
      cardId: cardData.id,
      finalPosition: { x: finalX, y: finalY },
      positionChanged,
      selectedCount: this.selectedCardIds.length
    });
  }

  /**
   * Handle dragging multiple selected cards
   */
  private handleMultiCardDrag(draggedCardId: string, newX: number, newY: number, selectedIds: string[]): void {
    if (!this.currentData) return;

    const cards = this.currentData.cards as CardDatum[];
    const draggedCardOriginal = cards.find(c => c.id === draggedCardId);
    if (!draggedCardOriginal) return;

    const deltaX = newX - this.dragStartPosition.x;
    const deltaY = newY - this.dragStartPosition.y;

    selectedIds.forEach(cardId => {
      if (cardId === draggedCardId) return; // Already handled

      const allCards = this.currentData!.cards as CardDatum[];
      const card = allCards.find(c => c.id === cardId);
      if (!card) return;

      // Get current position or use default
      const currentElement = this.container.select(`[data-card-id="${cardId}"]`);
      let currentX = 0;
      let currentY = 0;

      if (!currentElement.empty()) {
        const transform = currentElement.attr('transform');
        const match = transform?.match(/translate\(([^,]+),([^)]+)\)/);
        if (match) {
          currentX = parseFloat(match[1]);
          currentY = parseFloat(match[2]);
        }
      }

      const newCardX = currentX + deltaX;
      const newCardY = currentY + deltaY;

      // Update visual position
      currentElement.attr('transform', `translate(${newCardX}, ${newCardY})`);
    });
  }

  /**
   * Handle final positioning for multi-card drag
   */
  private handleMultiCardDragEnd(_draggedCardId: string, _newX: number, _newY: number, selectedIds: string[]): void {
    const updates: Array<{id: string, x: number, y: number}> = [];

    selectedIds.forEach(cardId => {
      const currentElement = this.container.select(`[data-card-id="${cardId}"]`);
      if (!currentElement.empty()) {
        const transform = currentElement.attr('transform');
        const match = transform?.match(/translate\(([^,]+),([^)]+)\)/);
        if (match) {
          const finalX = parseFloat(match[1]);
          const finalY = parseFloat(match[2]);
          updates.push({ id: cardId, x: finalX, y: finalY });
        }
      }
    });

    if (updates.length > 0 && this.config.persistPositions) {
      this.batchUpdateCardPositions(updates);
    }
  }

  /**
   * Persist single card position to database
   */
  private async persistCardPosition(cardId: string, x: number, y: number): Promise<void> {
    try {
      if (this.database) {
        // Use the database run method to persist position
        this.database.run(
          'UPDATE nodes SET location_x = ?, location_y = ? WHERE id = ?',
          [x, y, cardId]
        );
      }

      superGridLogger.debug('Card position persisted', { cardId, x, y });

      if (this.callbacks.onPositionUpdate) {
        this.callbacks.onPositionUpdate(cardId, { x, y, cardId });
      }
    } catch (error) {
      superGridLogger.error('Error persisting card position:', error);
    }
  }

  /**
   * Batch update multiple card positions
   */
  private async batchUpdateCardPositions(updates: Array<{id: string, x: number, y: number}>): Promise<void> {
    try {
      if (this.database) {
        // Use transaction for batch updates
        this.database.transaction(() => {
          updates.forEach(update => {
            this.database!.run(
              'UPDATE nodes SET location_x = ?, location_y = ? WHERE id = ?',
              [update.x, update.y, update.id]
            );
          });
        });

        superGridLogger.debug('Batch position update completed', { count: updates.length });

        // Trigger callbacks for each update
        updates.forEach(update => {
          if (this.callbacks.onPositionUpdate) {
            this.callbacks.onPositionUpdate(update.id, {
              x: update.x,
              y: update.y,
              cardId: update.id
            });
          }
        });
      }
    } catch (error) {
      superGridLogger.error('Error in batch position update:', error);
    }
  }
}