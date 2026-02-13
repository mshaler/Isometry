/**
 * SuperGridEngine - The Single D3 Rendering Authority for Grid Views
 *
 * This is the unified API surface that replaces the dual SuperGrid implementations.
 * React components consume this API — they never render grid cells directly.
 *
 * Architecture Principle: "D3 shows the truth, React lets you change it"
 */

import type { Database } from 'sql.js';
import EventEmitter from 'events';
import { devLogger } from '../../utils/logging';

// Import types and submodules
import type {
  Node,
  Edge,
  PAFVConfiguration,
  CellDescriptor,
  HeaderTree,
  HeaderDescriptor,
  GridDimensions,
  SelectionState,
  ViewportState,
  ProgressiveState,
  SuperGridConfig
} from './types';

import { SuperGridDataManager } from './DataManager';
import { SuperGridRenderer } from './Renderer';
import { SuperGridHeaderManager } from './HeaderManager';
import { DragManager, type DragManagerConfig } from './DragManager';
import { ResizeManager, type ResizeManagerConfig, type ResizeState, type ResizeResult } from './ResizeManager';
import { SelectManager, type SelectManagerConfig, type LassoState, calculateRangeSelection } from './SelectManager';
import { PositionManager, derivePositionFromNode } from './PositionManager';

// Re-export types for external use
export * from './types';
export { DragManager, type DragManagerConfig };
export { ResizeManager, type ResizeManagerConfig, type ResizeState, type ResizeResult };
export { SelectManager, type SelectManagerConfig, type LassoState, calculateRangeSelection };
export { PositionManager, derivePositionFromNode };

/**
 * SuperGridEngine - The single D3 rendering authority for grid views
 *
 * This class replaces both SuperGridV4.ts and SuperGrid.tsx implementations
 * following the principle: "D3 shows the truth, React lets you change it"
 */
export class SuperGridEngine extends EventEmitter {
  private container: HTMLElement | null = null;
  private database: Database;
  private config: SuperGridConfig;

  // Submodule managers
  private dataManager: SuperGridDataManager;
  private renderer: SuperGridRenderer;
  private headerManager: SuperGridHeaderManager;

  // Core state (D3 owns this)
  private nodes: Node[] = [];
  private pafvConfig!: PAFVConfiguration;
  private currentCells: CellDescriptor[] = [];
  private headerTree!: HeaderTree;
  private gridDimensions!: GridDimensions;
  private selectionState!: SelectionState;
  private viewportState!: ViewportState;
  private progressiveState!: ProgressiveState;

  // SuperGridV4 compatibility - migrated state
  private gridDataCache: unknown = null;

  constructor(database: Database, config: Partial<SuperGridConfig> = {}) {
    super();
    this.database = database;
    this.config = {
      width: 800,
      height: 600,
      cellMinWidth: 120,
      cellMinHeight: 80,
      headerMinHeight: 40,
      headerMinWidth: 120,
      enableProgressive: true,
      enableZoomPan: true,
      enableSelection: true,
      maxHeaderLevels: 4,
      colorScheme: 'default',
      animationDuration: 250,
      ...config
    };

    // Initialize submodules
    this.dataManager = new SuperGridDataManager(
      database,
      this.config.cellMinWidth,
      this.config.cellMinHeight
    );
    this.renderer = new SuperGridRenderer(this.config.animationDuration);
    this.headerManager = new SuperGridHeaderManager(
      this.config.headerMinWidth,
      this.config.headerMinHeight
    );

    this.initializeState();
    this.setupRendererCallbacks();
  }

  // ========================================================================
  // Lifecycle Methods
  // ========================================================================

  /**
   * Mount the engine to a DOM container
   */
  async mount(container: HTMLElement): Promise<void> {
    if (this.container) {
      throw new Error('SuperGridEngine already mounted. Call unmount() first.');
    }

    this.container = container;
    await this.renderer.setupSVG(
      container,
      this.config.width,
      this.config.height,
      this.config.enableZoomPan
    );

    this.emit('renderComplete', { renderTime: 0, cellCount: 0 });
  }

  /**
   * Unmount the engine and cleanup resources
   */
  unmount(): void {
    this.renderer.destroy();
    this.container = null;
    this.removeAllListeners();
  }

  // ========================================================================
  // Data Methods (React calls these)
  // ========================================================================

  /**
   * Set nodes and edges data - triggers re-render
   */
  setData(nodes: Node[], edges: Edge[] = []): void {
    this.nodes = [...nodes];
    // Note: edges will be implemented in future iterations
    this.generateCellsFromData();
    this.render();
    this.emit('dataChange', { nodeCount: nodes.length, edgeCount: edges.length });
  }

  /**
   * Update data with SQL query - D3 owns direct database access
   */
  async loadData(sql: string, params: unknown[] = []): Promise<void> {
    try {
      const result = this.database.exec(sql, params as any);
      if (result.length > 0) {
        const nodes = this.dataManager.transformSQLToNodes(result[0]);
        this.setData(nodes);
      } else {
        this.setData([]);
      }
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'loadData' });
    }
  }

  /**
   * Load data using direct sql.js queries with field-based grid projection
   * This is the core SuperGridV4 method migrated to the engine
   */
  async loadDataWithSQLFields(
    xAxisField: string,
    yAxisField: string,
    filterClause: string = '',
    groupByClause: string = ''
  ): Promise<void> {
    try {
      // Execute query using data manager
      const gridData = await this.dataManager.executeGridQuery(
        xAxisField,
        yAxisField,
        filterClause,
        groupByClause
      );

      if (!gridData) {
        devLogger.warn('SuperGridEngine: No grid data returned');
        return;
      }

      // Analyze hierarchy for Progressive Disclosure
      const levelGroups = this.headerManager.analyzeHierarchyFromGridData(gridData);
      this.progressiveState.levelGroups = levelGroups;

      // Apply Progressive Disclosure filtering
      const filteredData = this.headerManager.applyProgressiveDisclosureToGridData(
        gridData,
        this.progressiveState
      );

      // Update engine state
      this.updateEngineFromGridData(filteredData);

      // Render with D3.js data binding
      await this.renderAdvanced();

    } catch (error) {
      devLogger.error('SuperGridEngine data loading failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.emit('error', { error: error as Error, context: 'loadDataWithSQLFields' });
      throw error;
    }
  }

  // ========================================================================
  // PAFV Configuration (React calls these)
  // ========================================================================

  /**
   * Set axis mapping - triggers grid recalculation and re-render
   */
  setAxisMapping(mapping: PAFVConfiguration): void {
    this.pafvConfig = { ...mapping };
    this.generateCellsFromData();
    this.generateHeaderTree();
    this.calculateGridDimensions();
    this.render();
    this.emit('axisChange', { pafv: this.pafvConfig });
  }

  /**
   * Set origin pattern for grid positioning
   */
  setOriginPattern(pattern: 'anchor' | 'bipolar'): void {
    this.pafvConfig.originPattern = pattern;
    this.calculateGridDimensions();
    this.render();
  }

  // ========================================================================
  // Read-only State Access (React reads these)
  // ========================================================================

  /**
   * Get currently visible cells
   */
  getVisibleCells(): CellDescriptor[] {
    return [...this.currentCells];
  }

  /**
   * Get header structure tree
   */
  getHeaderStructure(): HeaderTree {
    return {
      columns: [...this.headerTree.columns],
      rows: [...this.headerTree.rows],
      maxColumnLevels: this.headerTree.maxColumnLevels,
      maxRowLevels: this.headerTree.maxRowLevels
    };
  }

  /**
   * Get grid dimensions
   */
  getGridDimensions(): GridDimensions {
    return { ...this.gridDimensions };
  }

  /**
   * Get current selection state
   */
  getSelection(): SelectionState {
    return {
      selectedCells: new Set(this.selectionState.selectedCells),
      selectedHeaders: new Set(this.selectionState.selectedHeaders),
      focusedCell: this.selectionState.focusedCell ? { ...this.selectionState.focusedCell } : undefined,
      selectionMode: this.selectionState.selectionMode
    };
  }

  /**
   * Get viewport state
   */
  getViewport(): ViewportState {
    return { ...this.viewportState };
  }

  /**
   * Get progressive disclosure state
   */
  getProgressiveState(): ProgressiveState {
    return {
      zoomLevel: this.progressiveState.zoomLevel,
      visibleLevels: [...this.progressiveState.visibleLevels],
      collapsedHeaders: new Set(this.progressiveState.collapsedHeaders),
      levelGroups: [...this.progressiveState.levelGroups],
      activeLevelTab: this.progressiveState.activeLevelTab
    };
  }

  // ========================================================================
  // Control Methods
  // ========================================================================

  /**
   * Scroll to specific grid coordinates
   */
  scrollTo(row: number, col: number): void {
    const x = col * this.gridDimensions.cellWidth;
    const y = row * this.gridDimensions.cellHeight;

    this.viewportState.x = x;
    this.viewportState.y = y;

    this.renderer.updateViewport(x, y, this.viewportState.scale);
    this.emit('viewportChange', { viewport: this.getViewport() });
  }

  /**
   * Zoom to specific level
   */
  zoomTo(level: number): void {
    this.viewportState.scale = Math.max(0.1, Math.min(5, level));
    this.renderer.updateViewport(
      this.viewportState.x,
      this.viewportState.y,
      this.viewportState.scale
    );
    this.emit('viewportChange', { viewport: this.getViewport() });
  }

  /**
   * Set visible levels for progressive disclosure
   */
  setVisibleLevels(levels: number[], groupId?: string): void {
    this.progressiveState.visibleLevels = [...levels];
    if (groupId) {
      const groupIndex = this.progressiveState.levelGroups.findIndex(g => g.id === groupId);
      if (groupIndex >= 0) {
        this.progressiveState.activeLevelTab = groupIndex;
      }
    }
    this.generateHeaderTree();
    this.render();
  }

  /**
   * Collapse or expand specific header
   */
  toggleHeader(headerId: string, collapsed: boolean): void {
    this.progressiveState = this.headerManager.toggleHeaderCollapse(
      headerId,
      collapsed,
      this.progressiveState
    );
    this.generateHeaderTree();
    this.render();
  }

  /**
   * Select cell(s) by ID
   */
  selectCells(cellIds: string[], mode: SelectionState['selectionMode'] = 'single'): void {
    if (mode === 'single') {
      this.selectionState.selectedCells.clear();
    }

    cellIds.forEach(id => this.selectionState.selectedCells.add(id));
    this.selectionState.selectionMode = mode;

    this.updateSelection();
    this.emit('selectionChange', { selection: this.getSelection() });
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectionState.selectedCells.clear();
    this.selectionState.selectedHeaders.clear();
    this.selectionState.focusedCell = undefined;
    this.updateSelection();
    this.emit('selectionChange', { selection: this.getSelection() });
  }

  /**
   * Select all cells that belong to a header's descendants.
   * When clicking a parent header (e.g., "Q1"), selects all cells
   * in columns/rows that fall within that header's span.
   *
   * @param header The header that was clicked
   */
  selectHeaderChildren(header: HeaderDescriptor): void {
    // Add header to selected headers
    this.selectionState.selectedHeaders.add(header.id);

    // Find all cells that fall within this header's span
    const isColumnHeader = header.id.startsWith('column_');

    // Get leaf indices covered by this header (startIndex to endIndex)
    // For multi-level headers, the position encodes the span
    const startIdx = Math.floor(
      isColumnHeader
        ? header.position.x / this.gridDimensions.cellWidth
        : header.position.y / this.gridDimensions.cellHeight
    );
    const spanCount = Math.round(
      isColumnHeader
        ? header.position.width / this.gridDimensions.cellWidth
        : header.position.height / this.gridDimensions.cellHeight
    );
    const endIdx = startIdx + spanCount - 1;

    // Select all cells in the range
    for (const cell of this.currentCells) {
      const cellIdx = isColumnHeader ? cell.gridX : cell.gridY;
      if (cellIdx >= startIdx && cellIdx <= endIdx) {
        this.selectionState.selectedCells.add(cell.id);
      }
    }

    this.updateSelection();
    this.emit('selectionChange', { selection: this.getSelection() });
  }

  /**
   * Select a header and all its descendant headers.
   * This is useful for progressive disclosure where collapsing
   * a parent should also collapse its children.
   *
   * @param headerId The ID of the header to select
   */
  selectHeaderWithDescendants(headerId: string): void {
    // Find the header
    const allHeaders = [...this.headerTree.columns, ...this.headerTree.rows];
    const header = allHeaders.find(h => h.id === headerId);

    if (header) {
      this.selectHeaderChildren(header);
    }
  }

  // ========================================================================
  // Private Implementation Methods
  // ========================================================================

  private initializeState(): void {
    this.pafvConfig = {
      originPattern: 'anchor'
    };

    this.selectionState = {
      selectedCells: new Set(),
      selectedHeaders: new Set(),
      selectionMode: 'single'
    };

    this.viewportState = {
      x: 0,
      y: 0,
      scale: 1,
      visibleCells: [],
      visibleHeaders: []
    };

    this.progressiveState = {
      zoomLevel: 0,
      visibleLevels: [0, 1, 2],
      collapsedHeaders: new Set(),
      levelGroups: [],
      activeLevelTab: 0
    };

    this.headerTree = {
      columns: [],
      rows: [],
      maxColumnLevels: 0,
      maxRowLevels: 0
    };

    this.gridDimensions = {
      rows: 0,
      cols: 0,
      cellWidth: this.config.cellMinWidth,
      cellHeight: this.config.cellMinHeight,
      headerHeight: this.config.headerMinHeight,
      headerWidth: this.config.headerMinWidth,
      totalWidth: 0,
      totalHeight: 0
    };
  }

  private setupRendererCallbacks(): void {
    this.renderer.setCallbacks({
      onCellClick: (cell, nodes) => {
        this.emit('cellClick', { cell, nodes });
      },
      onHeaderClick: (header) => {
        this.selectHeaderChildren(header);
        this.emit('headerClick', { header });
      },
      onRenderComplete: (renderTime, cellCount) => {
        this.emit('renderComplete', { renderTime, cellCount });
      }
    });
  }

  private generateCellsFromData(): void {
    // Extract axis facet fields from PAFV configuration
    const xAxisField = this.pafvConfig.xMapping?.facet ?? 'node_type';
    const yAxisField = this.pafvConfig.yMapping?.facet ?? 'folder';

    this.currentCells = this.dataManager.generateCellsFromNodes(
      this.nodes,
      xAxisField,
      yAxisField
    );
  }

  private generateHeaderTree(): void {
    this.headerTree = this.headerManager.generateHeaderTree(
      this.currentCells,
      this.gridDimensions
    );
  }

  private calculateGridDimensions(): void {
    this.gridDimensions = this.dataManager.calculateGridDimensions(
      this.currentCells,
      this.config.headerMinWidth,
      this.config.headerMinHeight
    );
  }

  private async render(): Promise<void> {
    await this.renderer.render(
      this.currentCells,
      this.headerTree,
      this.gridDimensions,
      this.nodes
    );
  }

  private async renderAdvanced(): Promise<void> {
    if (!this.gridDataCache) return;

    devLogger.render('SuperGridEngine advanced rendering', {
      cellCount: (this.gridDataCache as Record<string, unknown[]>).cells?.length ?? 0
    });

    await this.render();
  }

  private updateSelection(): void {
    this.renderer.updateSelection(
      this.currentCells,
      this.selectionState,
      this.gridDimensions
    );
  }

  private updateEngineFromGridData(gridData: unknown): void {
    this.gridDataCache = gridData;

    // Convert GridData to engine format
    this.currentCells = this.dataManager.convertGridDataToCells(
      gridData as Parameters<typeof this.dataManager.convertGridDataToCells>[0]
    );

    // Update grid dimensions and header tree
    this.calculateGridDimensions();
    this.generateHeaderTree();
  }

  // ========================================================================
  // SuperGridV4 Compatibility API
  // ========================================================================

  /**
   * Set callbacks (SuperGridV4 compatible)
   */
  setCallbacksV4(callbacks: unknown): void {
    const cb = callbacks as Record<string, ((...args: unknown[]) => void) | undefined>;
    if (cb.onCellClick) {
      this.removeAllListeners('cellClick');
      const onCellClick = cb.onCellClick;
      this.on('cellClick', (data) => {
        const { cell } = data;
        const position = { x: 0, y: 0 }; // Simplified for compatibility
        onCellClick(cell, position);
      });
    }
  }

  /**
   * Get current grid data (SuperGridV4 compatible)
   */
  getCurrentDataV4(): unknown {
    return this.gridDataCache;
  }

  /**
   * Destroy method (SuperGridV4 compatible)
   */
  destroyV4(): void {
    this.unmount();
  }
}

export default SuperGridEngine;