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
import { SortManager, type SortLevel, type MultiSortState } from './SortManager';
import { FilterManager, type HeaderFilter, compileHeaderFiltersToSQL } from './FilterManager';

// Re-export types for external use
export * from './types';
export { DragManager, type DragManagerConfig };
export { ResizeManager, type ResizeManagerConfig, type ResizeState, type ResizeResult };
export { SelectManager, type SelectManagerConfig, type LassoState, calculateRangeSelection };
export { PositionManager, derivePositionFromNode };
export { SortManager, type SortLevel, type MultiSortState };
export { FilterManager, type HeaderFilter, compileHeaderFiltersToSQL };

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
  private positionManager: PositionManager;
  private sortManager: SortManager;
  private filterManager: FilterManager;

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
    this.positionManager = new PositionManager();
    this.sortManager = new SortManager();
    this.filterManager = new FilterManager({
      onFilterChange: (filters) => {
        // Re-render to update filter icon states
        this.render();
        // Emit event for external listeners
        this.emit('filterChange', { filters, filterSQL: compileHeaderFiltersToSQL(filters) });
      },
    });

    this.initializeState();
    this.setupRendererCallbacks();
    // Set up SortManager and FilterManager in renderer for visual indicators
    this.renderer.setSortManager(this.sortManager);
    this.renderer.setFilterManager(this.filterManager);
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
   * Uses PositionManager to track positions across data changes
   */
  setData(nodes: Node[], edges: Edge[] = []): void {
    this.nodes = [...nodes];
    // Note: edges will be implemented in future iterations

    // Use PositionManager for position tracking (maintains positions across filter changes)
    this.currentCells = this.positionManager.recalculateAllPositions(
      this.nodes,
      this.pafvConfig,
      this.gridDimensions
    );

    this.generateHeaderTree();
    this.calculateGridDimensions();
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
   * Uses PositionManager to track logical coordinates across transitions
   */
  setAxisMapping(mapping: PAFVConfiguration): void {
    this.pafvConfig = { ...mapping };

    // Use PositionManager for PAFV-aware position tracking
    this.currentCells = this.positionManager.recalculateAllPositions(
      this.nodes,
      this.pafvConfig,
      this.gridDimensions
    );

    this.generateHeaderTree();
    this.calculateGridDimensions();
    this.render();
    this.emit('axisChange', { pafv: this.pafvConfig });
  }

  /**
   * Handle PAFV configuration change with position recalculation.
   * This method is called when axis mappings change to ensure
   * cards maintain logical position context across view transitions.
   */
  onPAFVChange(newConfig: PAFVConfiguration): void {
    // Recalculate positions using PositionManager
    this.currentCells = this.positionManager.recalculateAllPositions(
      this.nodes,
      newConfig,
      this.gridDimensions
    );

    // Update config
    this.pafvConfig = { ...newConfig };

    // Regenerate view
    this.generateHeaderTree();
    this.calculateGridDimensions();
    this.render();

    // Emit change event
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

  /**
   * Get PositionManager instance for direct access to position state
   */
  getPositionManager(): PositionManager {
    return this.positionManager;
  }

  /**
   * Get serialized position state for SQLite persistence
   */
  getSerializedPositionState(): string {
    return this.positionManager.serializeState();
  }

  /**
   * Restore position state from SQLite-stored JSON
   */
  restorePositionState(json: string): void {
    this.positionManager.deserializeState(json);
  }

  /**
   * Get SortManager instance for direct access to sort state
   */
  getSortManager(): SortManager {
    return this.sortManager;
  }

  /**
   * Get current sort state (immutable copy)
   */
  getSortState(): MultiSortState {
    return this.sortManager.getState();
  }

  /**
   * Clear all sort levels
   */
  clearAllSorts(): void {
    this.sortManager.clearAll();
    this.render();
    this.emit('sortChange', { sortState: this.sortManager.getState() });
  }

  /**
   * Get compiled SQL ORDER BY clause from current sort state
   */
  getSortSQL(): string {
    return this.sortManager.compileToSQL();
  }

  // ========================================================================
  // Filter Methods (SuperFilter)
  // ========================================================================

  /**
   * Get FilterManager instance for direct access to filter state
   */
  getFilterManager(): FilterManager {
    return this.filterManager;
  }

  /**
   * Get active header filters
   */
  getActiveFilters(): HeaderFilter[] {
    return this.filterManager.getActiveFilters();
  }

  /**
   * Get compiled SQL WHERE clause from current filter state
   */
  getFilterSQL(): string {
    return compileHeaderFiltersToSQL(this.filterManager.getActiveFilters());
  }

  /**
   * Clear all header filters
   */
  clearAllFilters(): void {
    this.filterManager.clearAllFilters();
    this.render();
    this.emit('filterChange', { filters: [], filterSQL: '' });
  }

  /**
   * Open filter dropdown for a header
   *
   * @param header - The header to filter
   * @param position - Screen position for the dropdown
   */
  openFilterDropdown(header: HeaderDescriptor, position: { x: number; y: number }): void {
    // Get unique values for this header from current cells
    const axis = header.id.startsWith('column_') ? 'x' : 'y';
    const values = this.filterManager.getUniqueValues(axis, this.currentCells);
    const allValues = values.map(v => v.value);

    // Open the dropdown
    this.filterManager.openDropdown(
      header.id,
      header.axis,
      header.facet || header.value,
      allValues,
      position
    );

    this.emit('filterDropdownOpen', { header, values });
  }

  /**
   * Close the filter dropdown
   */
  closeFilterDropdown(): void {
    this.filterManager.closeDropdown();
    this.emit('filterDropdownClose', {});
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
   * Set custom sort order for a cell group
   * Used for manual reordering within a group that survives view transitions
   */
  setCustomSortOrder(groupKey: string, nodeIds: string[]): void {
    this.positionManager.setCustomOrder(groupKey, nodeIds);
  }

  /**
   * Get custom sort order for a cell group
   */
  getCustomSortOrder(groupKey: string): string[] | undefined {
    return this.positionManager.getCustomOrder(groupKey);
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
      onCellClickWithEvent: (cell, nodes, event) => {
        // Handle selection with modifier keys (SuperSelect)
        this.handleCellClickWithModifiers(cell, event);
        this.emit('cellClick', { cell, nodes });
      },
      onHeaderClick: (header) => {
        this.selectHeaderChildren(header);
        this.emit('headerClick', { header });
      },
      onRenderComplete: (renderTime, cellCount) => {
        this.emit('renderComplete', { renderTime, cellCount });
      },
      onSelectionChange: (selectedIds) => {
        // Update internal selection state from SelectManager
        this.selectionState.selectedCells = selectedIds;
        this.updateSelection();
        this.emit('selectionChange', { selection: this.getSelection() });
      },
      isSelected: (id) => {
        return this.selectionState.selectedCells.has(id);
      },
      onSortChange: (sortState) => {
        // Re-render to update sort indicators
        this.render();
        this.emit('sortChange', { sortState });
      },
      onFilterIconClick: (header) => {
        // Emit event for React to handle dropdown UI
        this.emit('filterIconClick', { header });
      },
    });
  }

  /**
   * Handle cell click with modifier key detection.
   *
   * SuperSelect behavior:
   * - Plain click: select single cell (replaces selection)
   * - Cmd/Ctrl+click: toggle cell in selection
   * - Shift+click: range select from anchor to clicked cell
   */
  private handleCellClickWithModifiers(cell: CellDescriptor, event: MouseEvent): void {
    const cmdKey = event.metaKey || event.ctrlKey;

    if (event.shiftKey && this.selectionState.anchorId) {
      // Shift+click: range selection
      this.selectRangeFromAnchor(cell.id);
    } else if (cmdKey) {
      // Cmd/Ctrl+click: toggle selection
      this.toggleCellSelection(cell.id);
    } else {
      // Plain click: single selection
      this.selectSingleCell(cell.id);
    }
  }

  /**
   * Select a single cell, replacing any existing selection.
   */
  private selectSingleCell(cellId: string): void {
    this.selectionState.selectedCells.clear();
    this.selectionState.selectedCells.add(cellId);
    this.selectionState.anchorId = cellId;
    this.updateSelection();
    this.emit('selectionChange', { selection: this.getSelection() });
  }

  /**
   * Toggle a cell in the selection (Cmd/Ctrl+click).
   */
  private toggleCellSelection(cellId: string): void {
    if (this.selectionState.selectedCells.has(cellId)) {
      this.selectionState.selectedCells.delete(cellId);
    } else {
      this.selectionState.selectedCells.add(cellId);
    }
    this.selectionState.anchorId = cellId;
    this.updateSelection();
    this.emit('selectionChange', { selection: this.getSelection() });
  }

  /**
   * Select range from anchor to target cell (Shift+click).
   */
  private selectRangeFromAnchor(targetId: string): void {
    if (!this.selectionState.anchorId) return;

    const anchorCell = this.currentCells.find(c => c.id === this.selectionState.anchorId);
    const targetCell = this.currentCells.find(c => c.id === targetId);

    if (!anchorCell || !targetCell) return;

    // Calculate range using SelectManager's algorithm
    const rangeIds = calculateRangeSelection(anchorCell, targetCell, this.currentCells);

    this.selectionState.selectedCells.clear();
    rangeIds.forEach(id => this.selectionState.selectedCells.add(id));
    this.updateSelection();
    this.emit('selectionChange', { selection: this.getSelection() });
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