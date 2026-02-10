/**
 * SuperGrid - Refactored polymorphic data projection system
 *
 * Coordinates multiple specialized modules for grid functionality:
 * - GridSelectionController for selection and navigation
 * - GridDragDropController for drag operations
 * - GridRenderingEngine for visualization
 * - SuperGridZoom for density control
 */

import * as d3 from 'd3';
import type { useDatabaseService } from '@/hooks';
import type { GridData, GridConfig } from '../types/grid';
import type { FilterCompilationResult } from '../services/LATCHFilterService';
import { SuperGridZoom, type ZoomLevel, type PanLevel, type JanusState } from './SuperGridZoom';
import type { CardPosition } from '../types/views';
import { superGridLogger } from '../utils/dev-logger';

// Import extracted modules
import { GridSelectionController, type SelectionControllerConfig, type SelectionCallbackHandlers } from './grid-selection/GridSelectionController';
import { GridDragDropController, type DragDropConfig, type DragDropCallbacks } from './grid-interaction/GridDragDropController';
import { GridRenderingEngine, type RenderingConfig, type RenderingCallbacks } from './grid-rendering/GridRenderingEngine';

export class SuperGrid {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private database: ReturnType<typeof useDatabaseService>;
  private config: GridConfig;
  private currentData: GridData | null = null;

  // Extracted module instances
  private selectionController: GridSelectionController;
  private dragDropController: GridDragDropController;
  private renderingEngine: GridRenderingEngine;
  private superGridZoom: SuperGridZoom;

  // Grid dimensions
  private readonly cardWidth = 220;
  private readonly cardHeight = 100;
  private readonly padding = 20;
  private readonly headerHeight = 40;

  // Callbacks
  private onCardClick?: (card: any) => void;
  private onSelectionChange?: (selectedIds: string[]) => void;

  constructor(
    container: d3.Selection<SVGElement, unknown, null, undefined>,
    database: ReturnType<typeof useDatabaseService>,
    config: Partial<GridConfig> = {}
  ) {
    this.container = container;
    this.database = database;

    // Merge default configuration
    this.config = {
      enableHeaders: true,
      enableSelection: true,
      enableDragDrop: true,
      enableKeyboardNavigation: true,
      selectionMode: 'multi',
      ...config
    };

    this.initializeModules();
    this.setupZoomSystem();
  }

  /**
   * Initialize all module instances with their configurations
   */
  private initializeModules(): void {
    // Selection controller configuration
    const selectionConfig: SelectionControllerConfig = {
      enableKeyboardNavigation: this.config.enableKeyboardNavigation,
      enableMultiSelect: this.config.enableSelection,
      selectionMode: this.config.selectionMode
    };

    const selectionCallbacks: SelectionCallbackHandlers = {
      onCardClick: (card) => this.handleCardClick(card),
      onSelectionChange: (selectedIds) => this.handleSelectionChange(selectedIds),
      onFocusChange: (focusedId) => this.handleFocusChange(focusedId)
    };

    this.selectionController = new GridSelectionController(
      this.container,
      selectionConfig,
      selectionCallbacks
    );

    // Drag and drop controller configuration
    const dragDropConfig: DragDropConfig = {
      enableDragDrop: this.config.enableDragDrop,
      snapToGrid: true,
      gridSnapSize: 10,
      enableMultiCardDrag: true,
      persistPositions: true
    };

    const dragDropCallbacks: DragDropCallbacks = {
      onDragStart: (cardId, position) => this.handleDragStart(cardId, position),
      onDragMove: (cardId, position) => this.handleDragMove(cardId, position),
      onDragEnd: (cardId, position) => this.handleDragEnd(cardId, position),
      onPositionUpdate: (cardId, position) => this.handlePositionUpdate(cardId, position)
    };

    this.dragDropController = new GridDragDropController(
      this.container,
      dragDropConfig,
      dragDropCallbacks
    );

    // Set database for position persistence
    this.dragDropController.setDatabase(this.database);

    // Rendering engine configuration
    const renderingConfig: RenderingConfig = {
      cardWidth: this.cardWidth,
      cardHeight: this.cardHeight,
      padding: this.padding,
      headerHeight: this.headerHeight,
      enableHeaders: this.config.enableHeaders,
      enableAnimations: true,
      animationDuration: 300
    };

    const renderingCallbacks: RenderingCallbacks = {
      onHeaderClick: (event) => this.handleHeaderClick(event),
      onCardRender: (selection) => this.handleCardRender(selection),
      onGridResize: (width, height) => this.handleGridResize(width, height)
    };

    this.renderingEngine = new GridRenderingEngine(
      this.container,
      renderingConfig,
      renderingCallbacks
    );

    // Initialize headers with database
    this.renderingEngine.initializeHeaders(this.database);
  }

  /**
   * Setup zoom and density control system
   */
  private setupZoomSystem(): void {
    this.superGridZoom = new SuperGridZoom(this.container, {
      onZoomChange: (level) => this.handleZoomChange(level),
      onPanChange: (level) => this.handlePanChange(level),
      onJanusStateChange: (state) => this.handleJanusStateChange(state)
    });

    // Restore saved zoom/pan state
    this.restoreSavedJanusState();
  }

  /**
   * Main query method - fetch and display data
   */
  public query(filterCompilationResult?: FilterCompilationResult): void {
    try {
      if (filterCompilationResult && !filterCompilationResult.isEmpty) {
        const sql = `
          SELECT DISTINCT n.*
          FROM nodes n
          ${filterCompilationResult.joins}
          ${filterCompilationResult.whereClause}
          ${filterCompilationResult.orderClause}
          ${filterCompilationResult.limitClause}
        `;

        const result = this.database.getDatabase().exec(sql, filterCompilationResult.parameters);

        if (result.length > 0) {
          const cards = result[0].values.map((row: any[]) => {
            const columns = result[0].columns;
            const card: any = {};
            columns.forEach((col, index) => {
              card[col] = row[index];
            });
            return card;
          });

          this.currentData = { cards };
        } else {
          this.currentData = { cards: [] };
        }
      } else {
        // Fetch all nodes
        const result = this.database.getDatabase().exec('SELECT * FROM nodes WHERE deleted_at IS NULL ORDER BY created_at DESC');

        if (result.length > 0) {
          const cards = result[0].values.map((row: any[]) => {
            const columns = result[0].columns;
            const card: any = {};
            columns.forEach((col, index) => {
              card[col] = row[index];
            });
            return card;
          });

          this.currentData = { cards };
        } else {
          this.currentData = { cards: [] };
        }
      }

      // Update all modules with new data
      this.updateModulesWithData();

    } catch (error) {
      superGridLogger.error('Grid query failed:', error);
      this.currentData = { cards: [] };
      this.updateModulesWithData();
    }
  }

  /**
   * Render the grid with current data
   */
  public render(activeFilters: any[] = []): void {
    this.renderingEngine.render(activeFilters);
  }

  // Public API methods delegating to modules

  public getSelection(): { selectedIds: string[]; focusedId: string | null } {
    return this.selectionController.getSelection();
  }

  public setSelection(cardIds: string[]): void {
    this.selectionController.setSelection(cardIds);
    this.dragDropController.setSelectedCards(cardIds);
  }

  public clearSelection(): void {
    this.selectionController.clearSelection();
    this.dragDropController.setSelectedCards([]);
  }

  public focus(): void {
    this.selectionController.focus();
  }

  public getCardPositions(): Map<string, CardPosition> {
    return this.dragDropController.getCardPositions();
  }

  public scrollToCard(cardId: string): void {
    this.renderingEngine.scrollToCard(cardId);
  }

  public updateCards(cards: any[]): void {
    if (this.currentData) {
      this.currentData.cards = cards;
      this.updateModulesWithData();
    }
  }

  // Zoom and density control methods

  public setZoomLevel(level: ZoomLevel): void {
    this.superGridZoom.setZoomLevel(level);
  }

  public setPanLevel(level: PanLevel): void {
    this.superGridZoom.setPanLevel(level);
  }

  public getJanusState(): JanusState {
    return this.superGridZoom.getJanusState();
  }

  public restoreJanusState(state: JanusState): void {
    this.superGridZoom.restoreJanusState(state);
  }

  public getCurrentZoomLevel(): ZoomLevel {
    return this.superGridZoom.getCurrentZoomLevel();
  }

  public getCurrentPanLevel(): PanLevel {
    return this.superGridZoom.getCurrentPanLevel();
  }

  public resetZoomPan(): void {
    this.superGridZoom.resetZoomPan();
  }

  public refresh(): void {
    this.render();
  }

  public getStats(): any {
    return {
      cardCount: this.currentData?.cards.length || 0,
      selectedCount: this.selectionController.getSelection().selectedIds.length
    };
  }

  /**
   * Cleanup and destroy all modules
   */
  public destroy(): void {
    this.selectionController.destroy();
    this.dragDropController.destroy();
    this.renderingEngine.destroy();

    if (this.superGridZoom) {
      this.superGridZoom.destroy();
    }

    this.container.selectAll('*').remove();
  }

  /**
   * Update all modules with current data
   */
  private updateModulesWithData(): void {
    if (this.currentData) {
      this.selectionController.setGridData(this.currentData);
      this.dragDropController.setGridData(this.currentData);
      this.renderingEngine.setGridData(this.currentData);
    }
  }

  // Event handlers

  private handleCardClick(card: any): void {
    if (this.onCardClick) {
      this.onCardClick(card);
    }
  }

  private handleSelectionChange(selectedIds: string[]): void {
    // Update drag controller with selected cards
    this.dragDropController.setSelectedCards(selectedIds);

    if (this.onSelectionChange) {
      this.onSelectionChange(selectedIds);
    }
  }

  private handleFocusChange(focusedId: string | null): void {
    // Focus change handling if needed
  }

  private handleDragStart(cardId: string, position: CardPosition): void {
    // Drag start handling
  }

  private handleDragMove(cardId: string, position: CardPosition): void {
    // Drag move handling
  }

  private handleDragEnd(cardId: string, position: CardPosition): void {
    // Drag end handling
  }

  private handlePositionUpdate(cardId: string, position: CardPosition): void {
    // Position update handling
  }

  private handleHeaderClick(event: any): void {
    // Header click handling
  }

  private handleCardRender(selection: any): void {
    // Apply drag behavior to rendered cards
    this.dragDropController.applyDragBehavior(selection);
  }

  private handleGridResize(width: number, height: number): void {
    // Grid resize handling
  }

  private handleZoomChange(level: ZoomLevel): void {
    if (this.currentData) {
      this.render();
    }
  }

  private handlePanChange(level: PanLevel): void {
    if (this.currentData) {
      this.render();
    }
  }

  private handleJanusStateChange(state: JanusState): void {
    // Save Janus state
    localStorage.setItem('supergrid-janus-state', JSON.stringify(state));
  }

  private restoreSavedJanusState(): void {
    try {
      const savedStateStr = localStorage.getItem('supergrid-janus-state');
      if (savedStateStr) {
        const savedState = JSON.parse(savedStateStr) as JanusState;
        this.superGridZoom.restoreJanusState(savedState);
      }
    } catch (error) {
      superGridLogger.warn('Failed to restore Janus state:', error);
    }
  }

  // Setters for external callbacks

  public setOnCardClick(callback: (card: any) => void): void {
    this.onCardClick = callback;
  }

  public setOnSelectionChange(callback: (selectedIds: string[]) => void): void {
    this.onSelectionChange = callback;
  }
}