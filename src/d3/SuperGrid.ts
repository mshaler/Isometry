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
import type { GridData, GridConfig } from '../types/grid-core';
import type { PAFVProjection } from '../types/grid';
import type { FilterCompilationResult } from '../services/query/LATCHFilterService';
import { SuperGridZoom, type ZoomLevel, type PanLevel, type JanusState } from './SuperGridZoom';
// CardPosition from views.ts has additional fields (width, height); drag operations use simplified position
import { superGridLogger } from '../utils/dev-logger';

// Import extracted modules
import { GridSelectionController, type SelectionControllerConfig, type SelectionCallbackHandlers } from './grid-selection/GridSelectionController';
import { GridDragDropController, type DragDropConfig, type DragDropCallbacks } from './grid-interaction/GridDragDropController';
import { GridRenderingEngine, type RenderingConfig, type RenderingCallbacks } from './grid-rendering/GridRenderingEngine';

export class SuperGrid {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private database: ReturnType<typeof useDatabaseService>;
  private config: Partial<GridConfig>;
  private currentData: GridData | null = null;
  private currentProjection: PAFVProjection | null = null;

  // Extracted module instances
  private selectionController!: GridSelectionController;
  private dragDropController!: GridDragDropController;
  private renderingEngine!: GridRenderingEngine;
  private superGridZoom!: SuperGridZoom;

  // Grid dimensions
  private readonly cardWidth = 220;
  private readonly cardHeight = 100;
  private readonly padding = 20;
  private readonly headerHeight = 40;

  // Callbacks
  private onCardClick?: (card: unknown) => void;
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
      enableKeyboardNavigation: this.config.enableKeyboardNavigation ?? true,
      enableMultiSelect: this.config.enableSelection ?? true,
      selectionMode: this.config.selectionMode ?? 'multi'
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
      enableDragDrop: this.config.enableDragDrop ?? true,
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
      enableHeaders: this.config.enableHeaders ?? true,
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
    const containerNode = this.container.node();
    if (!containerNode) {
      throw new Error('SuperGrid: container has no DOM node');
    }
    this.superGridZoom = new SuperGridZoom(containerNode, {}, {
      onZoomChange: (level) => this.handleZoomChange(level),
      onPanChange: (level) => this.handlePanChange(level),
      onStateChange: (state) => this.handleJanusStateChange(state)
    });

    // Restore saved zoom/pan state
    this.restoreSavedJanusState();
  }

  /**
   * Main query method - fetch and display data
   */
  public query(filterCompilationResult?: FilterCompilationResult): void {
    try {
      const db = this.database.getRawDatabase();
      if (!db) {
        superGridLogger.error('Grid query failed: database not available');
        this.currentData = this.createEmptyGridData();
        this.updateModulesWithData();
        return;
      }

      if (filterCompilationResult && !filterCompilationResult.isEmpty) {
        const sql = `
          SELECT DISTINCT n.*
          FROM nodes n
          WHERE ${filterCompilationResult.whereClause}
        `;

        const result = db.exec(sql, filterCompilationResult.parameters as (string | number | null | Uint8Array)[]);

        if (result.length > 0) {
          const cards = result[0].values.map((row) => {
            const columns = result[0].columns;
            const card: Record<string, unknown> = {};
            columns.forEach((col, index) => {
              card[col] = row[index];
            });
            return card;
          });

          this.currentData = this.createGridDataWithCards(cards);
        } else {
          this.currentData = this.createEmptyGridData();
        }
      } else {
        // Fetch all nodes
        const result = db.exec('SELECT * FROM nodes WHERE deleted_at IS NULL ORDER BY created_at DESC');

        if (result.length > 0) {
          const cards = result[0].values.map((row) => {
            const columns = result[0].columns;
            const card: Record<string, unknown> = {};
            columns.forEach((col, index) => {
              card[col] = row[index];
            });
            return card;
          });

          this.currentData = this.createGridDataWithCards(cards);
        } else {
          this.currentData = this.createEmptyGridData();
        }
      }

      // Update all modules with new data
      this.updateModulesWithData();

    } catch (error) {
      superGridLogger.error('Grid query failed:', error);
      this.currentData = this.createEmptyGridData();
      this.updateModulesWithData();
    }
  }

  private createEmptyGridData(): GridData {
    return {
      cards: [],
      xAxis: { axis: 'x', field: '', values: [], isComputed: false },
      yAxis: { axis: 'y', field: '', values: [], isComputed: false },
      totalWidth: 800,
      totalHeight: 600,
      lastUpdated: Date.now()
    };
  }

  private createGridDataWithCards(cards: unknown[]): GridData {
    return {
      cards,
      xAxis: { axis: 'x', field: '', values: [], isComputed: false },
      yAxis: { axis: 'y', field: '', values: [], isComputed: false },
      totalWidth: 800,
      totalHeight: 600,
      lastUpdated: Date.now()
    };
  }

  /**
   * Set PAFV projection configuration
   * Updates how cards are positioned based on axis mappings
   */
  public setProjection(projection: PAFVProjection | null): void {
    const hasChanged =
      JSON.stringify(this.currentProjection) !== JSON.stringify(projection);
    this.currentProjection = projection;

    if (hasChanged) {
      superGridLogger.debug('PAFV projection updated:', {
        xAxis: projection?.xAxis?.facet || 'none',
        yAxis: projection?.yAxis?.facet || 'none',
      });

      // Re-render with new projection if we have data
      if (this.currentData) {
        this.updateModulesWithData();
        this.render();
      }
    }
  }

  /**
   * Get current PAFV projection
   */
  public getProjection(): PAFVProjection | null {
    return this.currentProjection;
  }

  /**
   * Render the grid with current data
   */
  public render(activeFilters: unknown[] = []): void {
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

  public getCardPositions(): Map<string, { x: number; y: number; cardId: string }> {
    return this.dragDropController.getCardPositions();
  }

  public scrollToCard(cardId: string): void {
    this.renderingEngine.scrollToCard(cardId);
  }

  public updateCards(cards: unknown[]): void {
    if (this.currentData) {
      this.currentData = { ...this.currentData, cards };
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
    return this.superGridZoom.getState();
  }

  public restoreJanusState(state: JanusState): void {
    this.superGridZoom.restoreState(state);
  }

  public getCurrentZoomLevel(): ZoomLevel {
    return this.superGridZoom.getCurrentZoomLevel();
  }

  public getCurrentPanLevel(): PanLevel {
    return this.superGridZoom.getCurrentPanLevel();
  }

  public resetZoomPan(): void {
    this.superGridZoom.reset();
  }

  public refresh(): void {
    this.render();
  }

  public getStats(): unknown {
    return {
      cardCount: this.currentData?.cards?.length || 0,
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
      // GridRenderingEngine uses GridData from grid-core (same structural type)
      this.renderingEngine.setGridData(this.currentData as Parameters<typeof this.renderingEngine.setGridData>[0]);

      // Pass projection to rendering engine
      if (this.currentProjection) {
        this.renderingEngine.setProjection(this.currentProjection);
      }
    }
  }

  // Event handlers

  private handleCardClick(card: unknown): void {
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

  private handleFocusChange(_focusedId: string | null): void {
    // Focus change handling if needed
  }

  private handleDragStart(_cardId: string, _position: { x: number; y: number; cardId: string }): void {
    // Drag start handling
  }

  private handleDragMove(_cardId: string, _position: { x: number; y: number; cardId: string }): void {
    // Drag move handling
  }

  private handleDragEnd(_cardId: string, _position: { x: number; y: number; cardId: string }): void {
    // Drag end handling
  }

  private handlePositionUpdate(_cardId: string, _position: { x: number; y: number; cardId: string }): void {
    // Position update handling
  }

  private handleHeaderClick(_event: unknown): void {
    // Header click handling
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleCardRender(selection: d3.Selection<any, any, any, any>): void {
    // Apply drag behavior to rendered cards
    this.dragDropController.applyDragBehavior(selection);
  }

  private handleGridResize(_width: number, _height: number): void {
    // Grid resize handling
  }

  private handleZoomChange(_level: ZoomLevel): void {
    if (this.currentData) {
      this.render();
    }
  }

  private handlePanChange(_level: PanLevel): void {
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
        this.superGridZoom.restoreState(savedState);
      }
    } catch (error) {
      superGridLogger.warn('Failed to restore Janus state:', error);
    }
  }

  // Setters for external callbacks

  public setOnCardClick(callback: (card: unknown) => void): void {
    this.onCardClick = callback;
  }

  public setOnSelectionChange(callback: (selectedIds: string[]) => void): void {
    this.onSelectionChange = callback;
  }
}