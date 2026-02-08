/**
 * SuperGridEngine - The Single D3 Rendering Authority for Grid Views
 *
 * This is the unified API surface that replaces the dual SuperGrid implementations.
 * React components consume this API — they never render grid cells directly.
 *
 * Architecture Principle: "D3 shows the truth, React lets you change it"
 *
 * Responsibilities:
 * - Receive data from SQLite (via DataService)
 * - Render all z=0 content (headers + data cells)
 * - Expose read-only state for React consumption
 * - Accept configuration updates from React
 * - Emit events for React to observe
 *
 * Layer Model:
 * - z=0 SPARSITY LAYER (D3): Column Headers, Row Headers, Data Cells
 * - z=1 DENSITY LAYER (React): MiniNav, Header spanning, Selection state
 * - z=2 OVERLAY LAYER (React): Cards, Audit View, Modals, Inspector
 */

import type { Database } from 'sql.js';
import EventEmitter from 'events';

// Core Data Types
export interface Node {
  id: string;
  name: string;
  created_at: string;
  modified_at: string;
  due_date?: string;
  status: string;
  priority: number;
  folder: string;
  tags: string[];
  location?: string;
  [key: string]: unknown;
}

export interface Edge {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';
  weight?: number;
  label?: string;
}

// PAFV Types
export type LATCHAxis = 'Location' | 'Alphabet' | 'Time' | 'Category' | 'Hierarchy';

export interface AxisMapping {
  axis: LATCHAxis;
  plane: 'x' | 'y' | 'z';
  facet?: string; // Specific attribute within axis (e.g., 'due_date' within Time)
}

export interface PAFVConfiguration {
  xMapping?: AxisMapping;
  yMapping?: AxisMapping;
  zMapping?: AxisMapping;
  originPattern: 'anchor' | 'bipolar';
}

// Cell & Grid Types
export interface CellDescriptor {
  id: string;
  gridX: number;
  gridY: number;
  xValue: string;
  yValue: string;
  nodeIds: string[];
  nodeCount: number;
  aggregateData?: {
    avgPriority: number;
    statusCounts: Record<string, number>;
    tagCounts: Record<string, number>;
  };
}

export interface HeaderDescriptor {
  id: string;
  level: number;
  value: string;
  axis: LATCHAxis;
  facet?: string;
  span: number;
  position: { x: number; y: number; width: number; height: number };
  childCount: number;
  isLeaf: boolean;
}

export interface HeaderTree {
  columns: HeaderDescriptor[];
  rows: HeaderDescriptor[];
  maxColumnLevels: number;
  maxRowLevels: number;
}

export interface GridDimensions {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  headerHeight: number;
  headerWidth: number;
  totalWidth: number;
  totalHeight: number;
}

export interface SelectionState {
  selectedCells: Set<string>;
  selectedHeaders: Set<string>;
  focusedCell?: CellDescriptor;
  selectionMode: 'single' | 'multiple' | 'range';
}

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
  visibleCells: CellDescriptor[];
  visibleHeaders: HeaderDescriptor[];
}

// Progressive Disclosure Types
export interface ProgressiveState {
  zoomLevel: number;
  visibleLevels: number[];
  collapsedHeaders: Set<string>;
  levelGroups: LevelGroup[];
  activeLevelTab: number;
}

export interface LevelGroup {
  id: string;
  name: string;
  levels: number[];
  description?: string;
}

// Event Types
export type SuperGridEvent =
  | 'cellClick'
  | 'cellHover'
  | 'headerClick'
  | 'selectionChange'
  | 'axisChange'
  | 'viewportChange'
  | 'renderComplete'
  | 'dataChange'
  | 'error';

export interface SuperGridEventData {
  cellClick: { cell: CellDescriptor; nodes: Node[] };
  cellHover: { cell: CellDescriptor | null; nodes: Node[] | null };
  headerClick: { header: HeaderDescriptor };
  selectionChange: { selection: SelectionState };
  axisChange: { pafv: PAFVConfiguration };
  viewportChange: { viewport: ViewportState };
  renderComplete: { renderTime: number; cellCount: number };
  dataChange: { nodeCount: number; edgeCount: number };
  error: { error: Error; context: string };
}

// Configuration Types
export interface SuperGridConfig {
  width: number;
  height: number;
  cellMinWidth: number;
  cellMinHeight: number;
  headerMinHeight: number;
  headerMinWidth: number;
  enableProgressive: boolean;
  enableZoomPan: boolean;
  enableSelection: boolean;
  maxHeaderLevels: number;
  colorScheme: 'default' | 'status' | 'priority' | 'custom';
  animationDuration: number;
}

/**
 * SuperGridEngine - The single D3 rendering authority for grid views
 *
 * This class replaces both SuperGridV4.ts and SuperGrid.tsx implementations
 * following the principle: "D3 shows the truth, React lets you change it"
 */
export class SuperGridEngine extends EventEmitter {
  private container: HTMLElement | null = null;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private database: Database;
  private config: SuperGridConfig;

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
  private gridDataCache: any = null;

  // Performance tracking
  private renderStartTime = 0;
  private renderCount = 0;

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

    this.initializeState();
  }

  // ========================================================================
  // Lifecycle Methods
  // ========================================================================

  /**
   * Mount the engine to a DOM container
   */
  mount(container: HTMLElement): void {
    if (this.container) {
      throw new Error('SuperGridEngine already mounted. Call unmount() first.');
    }

    this.container = container;
    this.setupSVG();
    this.setupEventListeners();
    this.emit('renderComplete', { renderTime: 0, cellCount: 0 });
  }

  /**
   * Unmount the engine and cleanup resources
   */
  unmount(): void {
    if (this.svg) {
      this.svg.remove();
    }
    this.container = null;
    this.svg = null;
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
        const nodes = this.transformSQLToNodes(result[0]);
        this.setData(nodes);
      } else {
        this.setData([]);
      }
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'loadData' });
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
  // Viewport Control Methods
  // ========================================================================

  /**
   * Scroll to specific grid coordinates
   */
  scrollTo(row: number, col: number): void {
    if (!this.svg) return;

    const x = col * this.gridDimensions.cellWidth;
    const y = row * this.gridDimensions.cellHeight;

    this.viewportState.x = x;
    this.viewportState.y = y;

    this.updateViewport();
    this.emit('viewportChange', { viewport: this.getViewport() });
  }

  /**
   * Zoom to specific level
   */
  zoomTo(level: number): void {
    if (!this.svg) return;

    this.viewportState.scale = Math.max(0.1, Math.min(5, level));
    this.updateViewport();
    this.emit('viewportChange', { viewport: this.getViewport() });
  }

  // ========================================================================
  // Progressive Disclosure Methods
  // ========================================================================

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
    if (collapsed) {
      this.progressiveState.collapsedHeaders.add(headerId);
    } else {
      this.progressiveState.collapsedHeaders.delete(headerId);
    }
    this.generateHeaderTree();
    this.render();
  }

  // ========================================================================
  // Selection Methods
  // ========================================================================

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

  private setupSVG(): void {
    if (!this.container) return;

    // Import d3 dynamically to avoid module loading issues
    import('d3').then(d3 => {
      this.svg = d3.select(this.container)
        .append('svg')
        .attr('width', this.config.width)
        .attr('height', this.config.height)
        .attr('class', 'supergrid-engine');

      // Create main groups with proper z-ordering
      const mainGroup = this.svg.append('g').attr('class', 'supergrid-main');
      mainGroup.append('g').attr('class', 'headers');
      mainGroup.append('g').attr('class', 'cells');
      mainGroup.append('g').attr('class', 'selection');

      if (this.config.enableZoomPan) {
        this.setupZoomBehavior(d3);
      }

      // Initial render if we have data
      if (this.nodes.length > 0) {
        this.render();
      }
    });
  }

  private setupZoomBehavior(d3: typeof import('d3')): void {
    if (!this.svg) return;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        const { transform } = event;
        this.viewportState.x = transform.x;
        this.viewportState.y = transform.y;
        this.viewportState.scale = transform.k;

        this.svg!.select('.supergrid-main')
          .attr('transform', transform.toString());

        this.emit('viewportChange', { viewport: this.getViewport() });
      });

    (this.svg as any).call(zoom);
  }

  private setupEventListeners(): void {
    // Set up D3 event handlers for cells and headers
    // This will be implemented in the detailed render methods
  }

  private transformSQLToNodes(sqlResult: any): Node[] {
    if (!sqlResult || !sqlResult.values || sqlResult.values.length === 0) {
      return [];
    }

    const columns = sqlResult.columns;
    return sqlResult.values.map((row: any[], index: number) => {
      const node: Node = {
        id: String(row[0] || `node_${index}`),
        name: String(row[columns.indexOf('name')] || `Node ${index}`),
        created_at: String(row[columns.indexOf('created_at')] || new Date().toISOString()),
        modified_at: String(row[columns.indexOf('modified_at')] || new Date().toISOString()),
        status: String(row[columns.indexOf('status')] || 'unknown'),
        priority: Number(row[columns.indexOf('priority')] || 0),
        folder: String(row[columns.indexOf('folder')] || 'default'),
        tags: String(row[columns.indexOf('tags')] || '').split(',').filter(Boolean),
      };

      // Add additional columns as dynamic properties
      columns.forEach((col: string, i: number) => {
        if (!['id', 'name', 'created_at', 'modified_at', 'status', 'priority', 'folder', 'tags'].includes(col)) {
          node[col] = row[i];
        }
      });

      return node;
    });
  }

  private generateCellsFromData(): void {
    // Skeleton: Simple flat grid - one cell per node
    this.currentCells = this.nodes.map((node, index) => ({
      id: `cell_${node.id}`,
      gridX: index % 10, // Simple 10-column layout for skeleton
      gridY: Math.floor(index / 10),
      xValue: String(index % 10),
      yValue: String(Math.floor(index / 10)),
      nodeIds: [node.id],
      nodeCount: 1,
      aggregateData: {
        avgPriority: node.priority,
        statusCounts: { [node.status]: 1 },
        tagCounts: (node.tags || []).reduce((acc, tag) => ({ ...acc, [tag]: 1 }), {})
      }
    }));
  }

  private generateHeaderTree(): void {
    // Skeleton: Simple headers for flat grid
    const colCount = Math.max(1, Math.max(...this.currentCells.map(c => c.gridX)) + 1);
    const rowCount = Math.max(1, Math.max(...this.currentCells.map(c => c.gridY)) + 1);

    this.headerTree = {
      columns: Array.from({ length: colCount }, (_, i) => ({
        id: `col_${i}`,
        level: 0,
        value: `Column ${i}`,
        axis: 'Alphabet' as LATCHAxis,
        span: 1,
        position: { x: i * this.gridDimensions.cellWidth, y: 0, width: this.gridDimensions.cellWidth, height: this.gridDimensions.headerHeight },
        childCount: 0,
        isLeaf: true
      })),
      rows: Array.from({ length: rowCount }, (_, i) => ({
        id: `row_${i}`,
        level: 0,
        value: `Row ${i}`,
        axis: 'Hierarchy' as LATCHAxis,
        span: 1,
        position: { x: 0, y: i * this.gridDimensions.cellHeight, width: this.gridDimensions.headerWidth, height: this.gridDimensions.cellHeight },
        childCount: 0,
        isLeaf: true
      })),
      maxColumnLevels: 1,
      maxRowLevels: 1
    };
  }

  private calculateGridDimensions(): void {
    const maxX = Math.max(0, ...this.currentCells.map(c => c.gridX));
    const maxY = Math.max(0, ...this.currentCells.map(c => c.gridY));

    this.gridDimensions = {
      rows: maxY + 1,
      cols: maxX + 1,
      cellWidth: this.config.cellMinWidth,
      cellHeight: this.config.cellMinHeight,
      headerHeight: this.config.headerMinHeight,
      headerWidth: this.config.headerMinWidth,
      totalWidth: (maxX + 1) * this.config.cellMinWidth + this.config.headerMinWidth,
      totalHeight: (maxY + 1) * this.config.cellMinHeight + this.config.headerMinHeight
    };
  }

  private render(): void {
    if (!this.svg) return;

    this.renderStartTime = performance.now();

    // Import d3 and render
    import('d3').then(d3 => {
      // Render headers
      this.renderHeaders(d3);

      // Render cells
      this.renderCells(d3);

      // Update selection overlay
      this.updateSelection(d3);

      const renderTime = performance.now() - this.renderStartTime;
      this.renderCount++;

      this.emit('renderComplete', { renderTime, cellCount: this.currentCells.length });
    });
  }

  private renderHeaders(_d3: typeof import('d3')): void {
    if (!this.svg) return;

    const headersGroup = this.svg.select('.headers');

    // Column headers
    const columnHeaders = headersGroup
      .selectAll<SVGRectElement, HeaderDescriptor>('.column-header')
      .data(this.headerTree.columns, d => d.id);

    const columnEnter = columnHeaders.enter()
      .append('g')
      .attr('class', 'column-header');

    columnEnter.append('rect')
      .attr('fill', '#f0f0f0')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1);

    columnEnter.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px');

    const mergedColumns = (columnHeaders as any).merge(columnEnter as any) as any;
    mergedColumns
      .attr('transform', (d: any) => `translate(${d.position.x + this.gridDimensions.headerWidth}, ${d.position.y})`);

    (mergedColumns.select('rect') as any)
      .attr('width', (d: any) => d.position.width)
      .attr('height', (d: any) => d.position.height);

    (mergedColumns.select('text') as any)
      .attr('x', (d: any) => d.position.width / 2)
      .attr('y', (d: any) => d.position.height / 2)
      .text((d: any) => d.value);

    columnHeaders.exit().remove();

    // Row headers
    const rowHeaders = headersGroup
      .selectAll<SVGRectElement, HeaderDescriptor>('.row-header')
      .data(this.headerTree.rows, d => d.id);

    const rowEnter = rowHeaders.enter()
      .append('g')
      .attr('class', 'row-header');

    rowEnter.append('rect')
      .attr('fill', '#f0f0f0')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1);

    rowEnter.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px');

    const mergedRows = (rowHeaders as any).merge(rowEnter as any) as any;
    mergedRows
      .attr('transform', (d: any) => `translate(${d.position.x}, ${d.position.y + this.gridDimensions.headerHeight})`);

    (mergedRows.select('rect') as any)
      .attr('width', (d: any) => d.position.width)
      .attr('height', (d: any) => d.position.height);

    (mergedRows.select('text') as any)
      .attr('x', (d: any) => d.position.width / 2)
      .attr('y', (d: any) => d.position.height / 2)
      .text((d: any) => d.value);

    rowHeaders.exit().remove();
  }

  private renderCells(_d3: typeof import('d3')): void {
    if (!this.svg) return;

    const cellsGroup = this.svg.select('.cells');

    const cells = cellsGroup
      .selectAll<SVGGElement, CellDescriptor>('.cell')
      .data(this.currentCells, d => d.id);

    const cellEnter = cells.enter()
      .append('g')
      .attr('class', 'cell');

    cellEnter.append('rect')
      .attr('fill', '#ffffff')
      .attr('stroke', '#ddd')
      .attr('stroke-width', 1);

    cellEnter.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '10px');

    // Set up click handlers
    cellEnter
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        const nodes = this.nodes.filter(n => d.nodeIds.includes(n.id));
        this.emit('cellClick', { cell: d, nodes });
      });

    cells.merge(cellEnter)
      .attr('transform', d => `translate(${d.gridX * this.gridDimensions.cellWidth + this.gridDimensions.headerWidth}, ${d.gridY * this.gridDimensions.cellHeight + this.gridDimensions.headerHeight})`)
      .select('rect')
      .attr('width', this.gridDimensions.cellWidth - 2)
      .attr('height', this.gridDimensions.cellHeight - 2);

    cells.merge(cellEnter)
      .select('text')
      .attr('x', this.gridDimensions.cellWidth / 2)
      .attr('y', this.gridDimensions.cellHeight / 2)
      .text(d => `${d.nodeCount} items`);

    cells.exit().remove();

    // Update visible cells for viewport
    this.viewportState.visibleCells = this.currentCells;
  }

  private updateViewport(): void {
    if (!this.svg) return;

    this.svg.select('.supergrid-main')
      .attr('transform', `translate(${this.viewportState.x}, ${this.viewportState.y}) scale(${this.viewportState.scale})`);
  }

  private updateSelection(d3?: typeof import('d3')): void {
    if (!this.svg || !d3) return;

    const selectionGroup = this.svg.select('.selection');

    // Clear existing selection indicators
    selectionGroup.selectAll('.selection-indicator').remove();

    // Add selection indicators for selected cells
    const selectedCells = this.currentCells.filter(c => this.selectionState.selectedCells.has(c.id));

    selectionGroup
      .selectAll('.selection-indicator')
      .data(selectedCells)
      .enter()
      .append('rect')
      .attr('class', 'selection-indicator')
      .attr('x', d => d.gridX * this.gridDimensions.cellWidth + this.gridDimensions.headerWidth)
      .attr('y', d => d.gridY * this.gridDimensions.cellHeight + this.gridDimensions.headerHeight)
      .attr('width', this.gridDimensions.cellWidth - 2)
      .attr('height', this.gridDimensions.cellHeight - 2)
      .attr('fill', 'none')
      .attr('stroke', '#007acc')
      .attr('stroke-width', 2)
      .style('pointer-events', 'none');
  }

  // ========================================================================
  // SuperGridV4 Migration Methods (D3-ONLY capabilities from audit)
  // ========================================================================

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
    const startTime = performance.now();
    this.renderStartTime = startTime;

    try {
      // Build the main data query using SuperGridV4 logic
      const whereClause = filterClause ? `WHERE ${filterClause}` : '';
      const groupBy = groupByClause ? `GROUP BY ${groupByClause}` : '';

      // Direct sql.js query - synchronous execution in same memory space
      const dataQuery = `
        SELECT
          ${xAxisField} as x_value,
          ${yAxisField} as y_value,
          COUNT(*) as cell_count,
          GROUP_CONCAT(id) as card_ids,
          GROUP_CONCAT(name, '|') as card_names,
          AVG(priority) as avg_priority,
          status
        FROM nodes
        ${whereClause}
        ${groupBy ? groupBy + ', ' + xAxisField + ', ' + yAxisField : `GROUP BY ${xAxisField}, ${yAxisField}`}
        ORDER BY ${yAxisField}, ${xAxisField}
      `;

      console.log('[SuperGridEngine] Executing query:', dataQuery);
      const result = this.database.exec(dataQuery);

      if (!result[0]?.values) {
        console.warn('[SuperGridEngine] No data returned from query');
        return;
      }

      // Transform SQL results to SuperGrid format (migrated from V4)
      const gridData = this.transformSQLToGridData(result[0], xAxisField, yAxisField);

      // Analyze hierarchy for Progressive Disclosure
      this.analyzeHierarchyFromGridData(gridData);

      // Apply Progressive Disclosure filtering
      const filteredData = this.applyProgressiveDisclosureToGridData(gridData);

      // Update engine state
      this.updateEngineFromGridData(filteredData);

      // Render with D3.js data binding
      this.renderAdvanced();

    } catch (error) {
      console.error('[SuperGridEngine] Data loading failed:', error);
      this.emit('error', { error: error as Error, context: 'loadDataWithSQLFields' });
      throw error;
    }
  }

  /**
   * Transform SQL results to GridData format (migrated from SuperGridV4)
   */
  private transformSQLToGridData(sqlResult: any, xField: string, yField: string): any {
    const { columns, values } = sqlResult;

    // Map column indices
    const colIndices = {
      x: columns.indexOf('x_value'),
      y: columns.indexOf('y_value'),
      count: columns.indexOf('cell_count'),
      cardIds: columns.indexOf('card_ids'),
      cardNames: columns.indexOf('card_names'),
      avgPriority: columns.indexOf('avg_priority'),
      status: columns.indexOf('status')
    };

    // Transform to cells array using SuperGridV4 format
    const cells = values.map((row: any[]) => {
      const cardIds = row[colIndices.cardIds]?.split(',') || [];
      const cardNames = row[colIndices.cardNames]?.split('|') || [];

      return {
        id: `${row[colIndices.x]}-${row[colIndices.y]}`,
        x: row[colIndices.x],
        y: row[colIndices.y],
        value: row[colIndices.count],
        cards: cardIds.map((id: string, i: number) => ({
          id: id.trim(),
          name: cardNames[i]?.trim() || `Card ${id}`,
          priority: row[colIndices.avgPriority] || 1,
          status: row[colIndices.status] || 'active'
        })),
        metadata: {
          avgPriority: row[colIndices.avgPriority],
          status: row[colIndices.status],
          cardCount: row[colIndices.count]
        }
      };
    });

    // Build axis ranges
    const xValues = [...new Set(values.map((row: any) => row[colIndices.x]))].sort();
    const yValues = [...new Set(values.map((row: any) => row[colIndices.y]))].sort();

    return {
      cells,
      xAxis: { field: xField, values: xValues, type: 'categorical', range: { min: 0, max: xValues.length - 1 } },
      yAxis: { field: yField, values: yValues, type: 'categorical', range: { min: 0, max: yValues.length - 1 } },
      metadata: {
        totalCells: cells.length,
        totalCards: cells.reduce((sum: number, cell: any) => sum + cell.cards.length, 0),
        queryTime: performance.now() - this.renderStartTime
      }
    };
  }

  /**
   * Update engine state from SuperGridV4 GridData
   */
  private updateEngineFromGridData(gridData: any): void {
    this.gridDataCache = gridData;

    // Convert GridData to engine format
    this.currentCells = gridData.cells.map((cell: any) => ({
      id: cell.id,
      gridX: gridData.xAxis.values.indexOf(cell.x),
      gridY: gridData.yAxis.values.indexOf(cell.y),
      xValue: String(cell.x),
      yValue: String(cell.y),
      nodeIds: cell.cards.map((c: any) => c.id),
      nodeCount: cell.cards.length,
      aggregateData: {
        avgPriority: cell.metadata?.avgPriority || 0,
        statusCounts: { [cell.metadata?.status || 'unknown']: cell.cards.length },
        tagCounts: {}
      }
    }));

    // Update grid dimensions and header tree
    this.calculateGridDimensions();
    this.generateHeaderTree();
  }

  /**
   * Analyze hierarchy for Progressive Disclosure (migrated from SuperGridV4)
   */
  private analyzeHierarchyFromGridData(gridData: any): void {
    const levelGroups: any[] = [];
    const totalNodes = gridData.cells.length;

    if (totalNodes > 50) {
      levelGroups.push({
        id: 'dense-overview',
        name: 'Overview',
        levels: [0, 1],
        nodeCount: Math.min(20, totalNodes)
      });
    }

    this.progressiveState.levelGroups = levelGroups;
  }

  /**
   * Apply Progressive Disclosure filtering (migrated from SuperGridV4)
   */
  private applyProgressiveDisclosureToGridData(gridData: any): any {
    // For now, return full data - progressive disclosure logic can be enhanced later
    return gridData;
  }

  /**
   * Advanced render method for SuperGridV4-style grid data
   */
  private renderAdvanced(): void {
    if (!this.svg || !this.gridDataCache) return;

    console.log('[SuperGridEngine] Advanced rendering', this.gridDataCache.cells.length, 'cells');

    // Use the existing render method but with gridDataCache
    this.render();
  }

  // ========================================================================
  // SuperGridV4 Compatibility API
  // ========================================================================

  /**
   * Set callbacks (SuperGridV4 compatible)
   */
  setCallbacksV4(callbacks: any): void {
    if (callbacks.onCellClick) {
      this.removeAllListeners('cellClick');
      this.on('cellClick', (data) => {
        const { cell } = data;
        const position = { x: 0, y: 0 }; // Simplified for compatibility
        callbacks.onCellClick(cell, position);
      });
    }
  }

  /**
   * Get current grid data (SuperGridV4 compatible)
   */
  getCurrentDataV4(): any {
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