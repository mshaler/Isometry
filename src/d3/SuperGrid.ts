import * as d3 from 'd3';
import type { DatabaseService } from '../db/DatabaseService';
import type { GridData, GridConfig, AxisData } from '../types/grid';
import { SelectionManager } from '../services/SelectionManager';
import type { SelectionCallbacks, GridPosition as SelectionGridPosition } from '../services/SelectionManager';

/**
 * SuperGrid - Polymorphic data projection with multi-select and keyboard navigation
 *
 * Key features:
 * - PAFV spatial projection (Planes → Axes → Facets → Values)
 * - Bridge elimination: sql.js → D3.js direct data binding
 * - Multi-select with keyboard navigation
 * - Dynamic axis allocation and view transitions
 * - Nested dimensional headers with visual spanning
 */

export class SuperGrid {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private database: DatabaseService;
  private config: GridConfig;
  private currentData: GridData | null = null;
  private selectionManager: SelectionManager;

  // Grid dimensions and layout
  private readonly cardWidth = 220;
  private readonly cardHeight = 100;
  private readonly padding = 20;
  private readonly headerHeight = 40;

  // Drag & drop state
  private isDragging = false;
  private dragStartPosition: { x: number; y: number } = { x: 0, y: 0 };
  private dragBehavior: d3.DragBehavior<SVGGElement, any, any> | null = null;

  // Callbacks
  private onCardClick?: (card: any) => void;
  private onSelectionChange?: (selectedIds: string[], focusedId: string | null) => void;
  private onBulkOperation?: (operation: string, selectedIds: string[]) => void;
  private onCardUpdate?: (card: any) => void;

  constructor(
    container: SVGElement,
    database: DatabaseService,
    config: GridConfig = {},
    callbacks: {
      onCardClick?: (card: any) => void;
      onSelectionChange?: (selectedIds: string[], focusedId: string | null) => void;
      onBulkOperation?: (operation: string, selectedIds: string[]) => void;
      onCardUpdate?: (card: any) => void;
    } = {}
  ) {
    this.container = d3.select(container);
    this.database = database;
    this.config = { columnsPerRow: 5, enableHeaders: true, ...config };
    this.onCardClick = callbacks.onCardClick;
    this.onSelectionChange = callbacks.onSelectionChange;
    this.onBulkOperation = callbacks.onBulkOperation;
    this.onCardUpdate = callbacks.onCardUpdate;

    // Initialize selection manager with callbacks
    const selectionCallbacks: SelectionCallbacks = {
      onSelectionChange: (selectedIds: string[], focusedId: string | null) => {
        this.updateCardSelectionVisuals(selectedIds);
        this.onSelectionChange?.(selectedIds, focusedId);
      },
      onFocusChange: (focusedId: string | null) => {
        this.updateCardFocusVisuals(focusedId);
      },
      onBulkOperation: (operation: string, selectedIds: string[]) => {
        this.onBulkOperation?.(operation, selectedIds);
      }
    };

    this.selectionManager = new SelectionManager(selectionCallbacks);
    this.setupKeyboardHandlers();
    this.initializeDragBehavior();
  }

  /**
   * Set up keyboard navigation and shortcuts
   */
  private setupKeyboardHandlers(): void {
    // Make the SVG focusable for keyboard events
    this.container
      .attr('tabindex', 0)
      .on('keydown', (event: KeyboardEvent) => {
        // Prevent default browser behavior for navigation keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(event.code)) {
          event.preventDefault();
        }

        switch (event.code) {
          case 'ArrowUp':
            this.selectionManager.moveSelection('up', event.shiftKey);
            break;
          case 'ArrowDown':
            this.selectionManager.moveSelection('down', event.shiftKey);
            break;
          case 'ArrowLeft':
            this.selectionManager.moveSelection('left', event.shiftKey);
            break;
          case 'ArrowRight':
            this.selectionManager.moveSelection('right', event.shiftKey);
            break;
          case 'Space':
          case 'Enter':
            // Toggle selection of focused card
            const focusedId = this.selectionManager.getFocusedCard();
            if (focusedId) {
              this.selectionManager.selectCard(focusedId, 'add');
            }
            break;
          case 'Escape':
            this.selectionManager.clearSelection();
            break;
          case 'KeyA':
            if (event.ctrlKey || event.metaKey) {
              this.selectionManager.selectAll();
            }
            break;
          default:
            return; // Don't handle other keys
        }
      });
  }

  /**
   * Initialize D3 drag behavior for card repositioning
   */
  private initializeDragBehavior(): void {
    this.dragBehavior = d3.drag<SVGGElement, any>()
      .on('start', (event, d) => this.handleDragStart(event, d))
      .on('drag', (event, d) => this.handleDragging(event, d))
      .on('end', (event, d) => this.handleDragEnd(event, d));
  }

  /**
   * Handle drag start event
   */
  private handleDragStart(event: d3.D3DragEvent<SVGGElement, any, any>, cardData: any): void {
    // Prevent click events during drag
    this.isDragging = true;

    // Store original position
    this.dragStartPosition = {
      x: cardData.x || 0,
      y: cardData.y || 0
    };

    // Visual feedback - add dragging class and raise z-index
    const cardGroup = d3.select(event.sourceEvent.currentTarget as SVGGElement);
    cardGroup
      .classed('dragging', true)
      .style('cursor', 'grabbing')
      .style('z-index', '1000');

    // Make card semi-transparent and add drop shadow
    cardGroup.select('.card-background')
      .attr('opacity', 0.8)
      .attr('filter', 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))');

    // Disable text selection
    d3.select('body').style('user-select', 'none');
  }

  /**
   * Handle dragging event - update position with constraints
   */
  private handleDragging(event: d3.D3DragEvent<SVGGElement, any, any>, cardData: any): void {
    if (!this.isDragging) return;

    // Calculate new position based on drag delta
    const newX = this.dragStartPosition.x + event.x;
    const newY = this.dragStartPosition.y + event.y;

    // Apply grid bounds constraints
    const constrainedX = Math.max(0, Math.min(newX, this.getGridWidth() - this.cardWidth));
    const constrainedY = Math.max(
      this.config.enableHeaders ? this.headerHeight + this.padding : 0,
      Math.min(newY, this.getGridHeight() - this.cardHeight)
    );

    // Update card position immediately for visual feedback
    const cardGroup = d3.select(event.sourceEvent.currentTarget as SVGGElement);
    cardGroup.attr('transform', `translate(${constrainedX}, ${constrainedY})`);

    // Update card data for position tracking
    cardData.x = constrainedX;
    cardData.y = constrainedY;
  }

  /**
   * Handle drag end event - persist position and cleanup
   */
  private handleDragEnd(event: d3.D3DragEvent<SVGGElement, any, any>, cardData: any): void {
    if (!this.isDragging) return;

    // Calculate final position
    const finalX = cardData.x;
    const finalY = cardData.y;

    // Reset visual state
    const cardGroup = d3.select(event.sourceEvent.currentTarget as SVGGElement);
    cardGroup
      .classed('dragging', false)
      .style('cursor', 'pointer')
      .style('z-index', null);

    cardGroup.select('.card-background')
      .attr('opacity', 1)
      .attr('filter', null);

    // Re-enable text selection
    d3.select('body').style('user-select', null);

    // Check if position actually changed
    const positionChanged =
      Math.abs(finalX - this.dragStartPosition.x) > 5 ||
      Math.abs(finalY - this.dragStartPosition.y) > 5;

    if (positionChanged) {
      // Update card data with new position
      const updatedCard = {
        ...cardData,
        grid_x: finalX,
        grid_y: finalY,
        modified_at: new Date().toISOString()
      };

      // Trigger position persistence
      this.persistCardPosition(cardData.id, finalX, finalY);
      this.onCardUpdate?.(updatedCard);

      // Handle multi-select drag if other cards are selected
      const selectedIds = this.selectionManager.getSelectedCards();
      if (selectedIds.length > 1 && selectedIds.includes(cardData.id)) {
        this.handleMultiCardDrag(cardData.id, finalX, finalY, selectedIds);
      }
    }

    // Reset drag state
    this.isDragging = false;
    this.dragStartPosition = { x: 0, y: 0 };

    // Brief delay to prevent click events after drag
    setTimeout(() => {
      this.isDragging = false;
    }, 100);
  }

  /**
   * Handle multi-card drag - move all selected cards maintaining relative positions
   */
  private handleMultiCardDrag(draggedCardId: string, newX: number, newY: number, selectedIds: string[]): void {
    if (!this.currentData) return;

    const draggedCardOriginal = this.currentData.cards.find(card => card.id === draggedCardId);
    if (!draggedCardOriginal) return;

    // Calculate offset for the dragged card
    const offsetX = newX - this.dragStartPosition.x;
    const offsetY = newY - this.dragStartPosition.y;

    // Update positions for all selected cards
    const updates: Array<{id: string, x: number, y: number}> = [];

    selectedIds.forEach(cardId => {
      if (cardId === draggedCardId) return; // Already handled

      const card = this.currentData!.cards.find(c => c.id === cardId);
      if (!card) return;

      const newCardX = (card.x || 0) + offsetX;
      const newCardY = (card.y || 0) + offsetY;

      // Apply constraints for each card
      const constrainedX = Math.max(0, Math.min(newCardX, this.getGridWidth() - this.cardWidth));
      const constrainedY = Math.max(
        this.config.enableHeaders ? this.headerHeight + this.padding : 0,
        Math.min(newCardY, this.getGridHeight() - this.cardHeight)
      );

      // Update visual position
      this.container.selectAll('.card-group')
        .filter((d: any) => d.id === cardId)
        .attr('transform', `translate(${constrainedX}, ${constrainedY})`);

      updates.push({
        id: cardId,
        x: constrainedX,
        y: constrainedY
      });
    });

    // Batch update positions
    if (updates.length > 0) {
      this.batchUpdateCardPositions(updates);
    }
  }

  /**
   * Persist single card position to database
   */
  private persistCardPosition(cardId: string, x: number, y: number): void {
    try {
      const result = this.database.updateCardPosition(cardId, x, y);
      if (!result.success) {
        console.error('Failed to persist card position:', result.error);
      }
    } catch (error) {
      console.error('Error persisting card position:', error);
    }
  }

  /**
   * Batch update multiple card positions
   */
  private batchUpdateCardPositions(updates: Array<{id: string, x: number, y: number}>): void {
    try {
      // Map to the format expected by DatabaseService
      const positions = updates.map(update => ({
        cardId: update.id,
        x: update.x,
        y: update.y
      }));

      const result = this.database.updateCardPositions(positions);
      if (!result.success) {
        console.error('Batch position update failed:', result.errors);
      }

      // Also trigger onCardUpdate for each successfully updated card
      updates.forEach(update => {
        const card = this.currentData?.cards.find(c => c.id === update.id);
        if (card) {
          const updatedCard = {
            ...card,
            grid_x: update.x,
            grid_y: update.y,
            modified_at: new Date().toISOString()
          };
          this.onCardUpdate?.(updatedCard);
        }
      });
    } catch (error) {
      console.error('Error in batch position update:', error);
    }
  }

  /**
   * Get current grid width for boundary calculations
   */
  private getGridWidth(): number {
    // Calculate based on columns per row
    return this.config.columnsPerRow! * (this.cardWidth + this.padding) - this.padding;
  }

  /**
   * Get current grid height for boundary calculations
   */
  private getGridHeight(): number {
    if (!this.currentData) return 600; // Default height

    const rows = Math.ceil(this.currentData.cards.length / this.config.columnsPerRow!);
    const headerOffset = this.config.enableHeaders ? this.headerHeight + this.padding : 0;
    return headerOffset + (rows * (this.cardHeight + this.padding));
  }

  /**
   * Handle card click with multi-select support
   * Modified to prevent clicks during drag operations
   */
  private handleCardClick(event: MouseEvent, cardData: any): void {
    // Ignore clicks during or immediately after drag
    if (this.isDragging) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const selectionMode = event.ctrlKey || event.metaKey ? 'add' :
                         event.shiftKey ? 'range' : 'single';

    this.selectionManager.selectCard(cardData.id, selectionMode);

    // Legacy single card click callback
    if (selectionMode === 'single' && this.onCardClick) {
      this.onCardClick(cardData);
    }
  }

  /**
   * Update visual state for selected cards
   */
  private updateCardSelectionVisuals(selectedIds: string[]): void {
    this.container.selectAll('.card-group')
      .select('.card-background')
      .attr('stroke', (d: any) => selectedIds.includes(d.id) ? '#2563eb' : '#e5e7eb')
      .attr('stroke-width', (d: any) => selectedIds.includes(d.id) ? 3 : 1);

    // Update selection indicators
    this.container.selectAll('.selection-indicator')
      .style('opacity', (d: any) => selectedIds.includes(d.id) ? 1 : 0);
  }

  /**
   * Update visual state for focused card
   */
  private updateCardFocusVisuals(focusedId: string | null): void {
    this.container.selectAll('.focus-indicator')
      .style('opacity', (d: any) => d.id === focusedId ? 1 : 0);
  }

  /**
   * Query data with current LATCH filters and render grid
   */
  query(filters: Record<string, any> = {}): void {
    try {
      // Construct SQL query based on filters
      let sql = 'SELECT * FROM nodes WHERE deleted_at IS NULL';
      const params: any[] = [];

      // Apply LATCH filters
      if (filters.folder) {
        sql += ' AND folder = ?';
        params.push(filters.folder);
      }
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.priority) {
        sql += ' AND priority = ?';
        params.push(filters.priority);
      }
      if (filters.search) {
        sql += ' AND (name LIKE ? OR summary LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      sql += ' ORDER BY created_at DESC';

      // Execute query
      const cards = this.database.query<any>(sql, params) || [];
      console.log('🔍 SuperGrid.query(): SQL:', sql);
      console.log('🔍 SuperGrid.query(): Params:', params);
      console.log('🔍 SuperGrid.query(): Result count:', cards.length);
      console.log('🔍 SuperGrid.query(): Sample cards:', cards.slice(0, 3));

      // Transform to grid data structure
      const gridData: GridData = {
        cards: cards,
        headers: this.generateHeaders(cards),
        dimensions: {
          rows: Math.ceil(cards.length / this.config.columnsPerRow!),
          columns: Math.min(cards.length, this.config.columnsPerRow!)
        }
      };

      console.log('📊 SuperGrid.query(): Grid data:', {
        cardCount: gridData.cards.length,
        headerCount: gridData.headers.length,
        dimensions: gridData.dimensions
      });

      this.currentData = gridData;
      this.updateGridLayout();
      this.render();

    } catch (error) {
      console.error('SuperGrid query error:', error);
    }
  }

  /**
   * Update selection manager with current grid layout
   */
  private updateGridLayout(): void {
    if (!this.currentData) return;

    const layout: SelectionGridPosition[] = [];
    const cards = this.currentData.cards;
    const columnsPerRow = this.config.columnsPerRow!;

    cards.forEach((card: any, index: number) => {
      layout.push({
        row: Math.floor(index / columnsPerRow),
        col: index % columnsPerRow,
        id: card.id
      });
    });

    this.selectionManager.updateGridLayout(layout);
  }

  /**
   * Generate header structure for current data
   */
  private generateHeaders(cards: any[]): AxisData[] {
    if (!this.config.enableHeaders) return [];

    // Group cards by status for demo headers
    const statusGroups = cards.reduce((groups: Record<string, any[]>, card) => {
      const status = card.status || 'unknown';
      if (!groups[status]) groups[status] = [];
      groups[status].push(card);
      return groups;
    }, {});

    return Object.entries(statusGroups).map(([status, statusCards]: [string, any[]]) => ({
      id: `status-${status}`,
      label: status.charAt(0).toUpperCase() + status.slice(1),
      facet: 'status',
      value: status,
      count: statusCards.length,
      span: statusCards.length
    }));
  }

  /**
   * Main render method
   */
  render(): void {
    console.log('🎨 SuperGrid.render(): Called', {
      hasCurrentData: !!this.currentData,
      cardCount: this.currentData?.cards.length || 0
    });

    if (!this.currentData) {
      console.warn('⚠️ SuperGrid.render(): No current data to render');
      return;
    }

    console.log('🎨 SuperGrid.render(): Setting up grid structure...');
    this.setupGridStructure();

    console.log('🎨 SuperGrid.render(): Rendering headers...');
    this.renderHeaders();

    console.log('🎨 SuperGrid.render(): Rendering cards...');
    this.renderCards();

    console.log('✅ SuperGrid.render(): Complete');
  }

  /**
   * Render card elements with multi-select support
   */
  private renderCards(): void {
    console.log('🗂️ SuperGrid.renderCards(): Starting...');

    if (!this.currentData) {
      console.warn('⚠️ SuperGrid.renderCards(): No current data');
      return;
    }

    const cards = this.currentData.cards;
    const columnsPerRow = this.config.columnsPerRow!;

    console.log('🗂️ SuperGrid.renderCards(): Cards to render:', cards.length);
    console.log('🗂️ SuperGrid.renderCards(): Columns per row:', columnsPerRow);

    // Calculate positions - use stored grid positions if available, otherwise calculate from index
    const cardGroups = cards.map((card: any, index: number) => ({
      ...card,
      x: card.grid_x !== undefined && card.grid_x !== null ?
         card.grid_x :
         (index % columnsPerRow) * (this.cardWidth + this.padding),
      y: card.grid_y !== undefined && card.grid_y !== null ?
         card.grid_y :
         Math.floor(index / columnsPerRow) * (this.cardHeight + this.padding) +
           (this.config.enableHeaders ? this.headerHeight + this.padding : 0)
    }));

    console.log('🗂️ SuperGrid.renderCards(): Card groups prepared:', cardGroups.length);

    // Data binding with D3.js join pattern
    console.log('🗂️ SuperGrid.renderCards(): Binding data to DOM...');
    const joined = this.container.selectAll<SVGGElement, any>('.card-group')
      .data(cardGroups, (d: any) => d.id);

    console.log('🗂️ SuperGrid.renderCards(): Data bound. Existing elements:', joined.size());
    console.log('🗂️ SuperGrid.renderCards(): Elements to enter:', joined.enter().size());
    console.log('🗂️ SuperGrid.renderCards(): Elements to exit:', joined.exit().size());

    // Enter new cards
    const entering = joined.enter()
      .append('g')
      .attr('class', 'card-group')
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);

    // Card background with selection visual feedback
    entering.append('rect')
      .attr('class', 'card-background')
      .attr('width', this.cardWidth)
      .attr('height', this.cardHeight)
      .attr('rx', 8)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    // Selection indicator (checkmark)
    entering.append('circle')
      .attr('class', 'selection-indicator')
      .attr('cx', this.cardWidth - 20)
      .attr('cy', 20)
      .attr('r', 8)
      .attr('fill', '#2563eb')
      .style('opacity', 0);

    entering.append('text')
      .attr('class', 'selection-checkmark')
      .attr('x', this.cardWidth - 20)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .text('✓')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    // Focus indicator (blue outline)
    entering.append('rect')
      .attr('class', 'focus-indicator')
      .attr('width', this.cardWidth + 4)
      .attr('height', this.cardHeight + 4)
      .attr('x', -2)
      .attr('y', -2)
      .attr('rx', 10)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .style('opacity', 0);

    // Card title
    entering.append('text')
      .attr('class', 'card-title')
      .attr('x', 16)
      .attr('y', 30)
      .attr('font-size', '16px')
      .attr('font-weight', '600')
      .attr('fill', '#1f2937')
      .style('pointer-events', 'none')
      .text((d: any) => d.name || 'Untitled');

    // Card summary
    entering.append('text')
      .attr('class', 'card-summary')
      .attr('x', 16)
      .attr('y', 50)
      .attr('font-size', '12px')
      .attr('fill', '#6b7280')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const summary = d.summary || '';
        return summary.length > 30 ? summary.substring(0, 30) + '...' : summary;
      });

    // Merge entering and updating - simplified to avoid typing issues
    const allCards = joined.merge(entering as any);

    allCards
      .transition()
      .duration(300)
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);

    // Exit old cards
    joined.exit()
      .transition()
      .duration(300)
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y - 50})`)
      .attr('opacity', 0)
      .remove();

    // Add hover, click, and drag interactions with multi-select support
    const cardSelection = this.container.selectAll<SVGGElement, any>('.card-group');

    cardSelection
      .style('cursor', 'grab')
      .on('mouseenter', function() {
        d3.select(this)
          .select('.card-background')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 2);
      })
      .on('mouseleave', (event, d: any) => {
        const isSelected = this.selectionManager.isSelected(d.id);
        d3.select(event.currentTarget)
          .select('.card-background')
          .attr('stroke', isSelected ? '#2563eb' : '#e5e7eb')
          .attr('stroke-width', isSelected ? 3 : 1);
      })
      .on('click', (event, d) => {
        this.handleCardClick(event, d);
      });

    // Apply drag behavior to all card groups
    if (this.dragBehavior) {
      cardSelection.call(this.dragBehavior);
    }
  }

  /**
   * Set up grid structure with header groups
   */
  private setupGridStructure(): void {
    console.log('🏗️ SuperGrid.setupGridStructure(): Setting up grid structure...');

    // Remove existing grid structure to avoid duplicates
    this.container.select('.grid-structure').remove();

    const gridStructure = this.container.append('g')
      .attr('class', 'grid-structure');

    console.log('🏗️ SuperGrid.setupGridStructure(): Grid structure created');

    // Create header containers
    gridStructure.append('g')
      .attr('class', 'row-headers')
      .attr('transform', `translate(0, ${this.cardHeight + this.padding})`);

    gridStructure.append('g')
      .attr('class', 'column-headers')
      .attr('transform', `translate(${this.cardWidth + this.padding}, 0)`);
  }

  /**
   * Render dimensional headers
   */
  private renderHeaders(): void {
    if (!this.config.enableHeaders || !this.currentData?.headers.length) {
      return;
    }

    const headers = this.currentData.headers;

    // Render status headers (example implementation)
    const headerGroups = this.container.select('.grid-structure')
      .selectAll('.header-group')
      .data(headers, (d: any) => d.id);

    const entering = headerGroups.enter()
      .append('g')
      .attr('class', 'header-group');

    entering.append('rect')
      .attr('class', 'header-background')
      .attr('width', (d: any) => d.span * (this.cardWidth + this.padding) - this.padding)
      .attr('height', this.headerHeight)
      .attr('fill', '#f3f4f6')
      .attr('stroke', '#d1d5db')
      .attr('rx', 4);

    entering.append('text')
      .attr('class', 'header-label')
      .attr('x', 12)
      .attr('y', this.headerHeight / 2 + 4)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .text((d: any) => `${d.label} (${d.count})`);

    headerGroups.exit().remove();
  }

  /**
   * Get current selection state
   */
  getSelection(): {
    selectedIds: string[];
    focusedId: string | null;
    count: number;
  } {
    return {
      selectedIds: this.selectionManager.getSelectedCards(),
      focusedId: this.selectionManager.getFocusedCard(),
      count: this.selectionManager.getSelectedCards().length
    };
  }

  /**
   * Get selection manager instance
   */
  getSelectionManager(): SelectionManager {
    return this.selectionManager;
  }

  /**
   * Programmatically set selection
   */
  setSelection(cardIds: string[]): void {
    this.selectionManager.clearSelection();
    cardIds.forEach(id => this.selectionManager.selectCard(id, 'add'));
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectionManager.clearSelection();
  }

  /**
   * Refresh grid with current data
   */
  refresh(): void {
    this.render();
  }

  /**
   * Get database stats
   */
  getStats(): any {
    return this.database.getStats();
  }

  /**
   * Focus on SVG for keyboard navigation
   */
  focus(): void {
    (this.container.node() as any)?.focus();
  }

  /**
   * Clean up event listeners and resources
   */
  destroy(): void {
    // Remove all event listeners and clear selection manager
    if (this.selectionManager) {
      this.selectionManager.clearSelection();
    }

    // Clear drag behavior to prevent memory leaks
    if (this.dragBehavior) {
      this.container.selectAll('.card-group').on('.drag', null);
      this.dragBehavior = null;
    }

    // Remove all D3 elements and event listeners
    this.container.selectAll('*').remove();
    this.container.on('keydown', null);

    // Clear data references
    this.currentData = null;
    this.isDragging = false;
    this.dragStartPosition = { x: 0, y: 0 };
  }
}