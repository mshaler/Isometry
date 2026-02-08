import * as d3 from 'd3';
import type { Database } from 'sql.js-fts5';
import type {
  GridConfig,
  GridData,
  GridCell,
  GridPosition,
  AxisData,
  AxisRange,
  ProgressiveDisclosureConfig,
  ProgressiveDisclosureState,
  LevelGroup,
  LevelPickerTab,
  ZoomControlState,
  DEFAULT_PROGRESSIVE_CONFIG
} from '../types/supergrid';

/**
 * SuperGrid v4 - Bridge-Free Implementation
 *
 * Core features:
 * - Direct sql.js → D3.js data binding (no MessageBridge)
 * - Progressive Disclosure for deep hierarchies
 * - PAFV spatial projection system
 * - Janus density model (Pan × Zoom orthogonality)
 * - Nested dimensional headers with visual spanning
 *
 * Architecture: sql.js executes synchronously in same JS runtime as D3.js
 */

interface SuperGridCallbacks {
  onCellClick?: (cell: GridCell, position: GridPosition) => void;
  onCellHover?: (cell: GridCell | null, position: GridPosition | null) => void;
  onAxisDrop?: (axis: string, plane: 'x' | 'y' | 'z') => void;
  onLevelChange?: (newLevels: number[], groupId: string) => void;
  onZoomChange?: (zoomLevel: number, direction: 'in' | 'out') => void;
}

export class SuperGridV4 {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private database: Database;
  private config: GridConfig;
  private progressiveConfig: ProgressiveDisclosureConfig;

  // Core state
  private currentData: GridData | null = null;
  private progressiveState: ProgressiveDisclosureState;
  private callbacks: SuperGridCallbacks = {};

  // D3 selections for performance
  private gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private headerGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private cellsGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private zoomBehavior: d3.ZoomBehavior<SVGElement, unknown>;

  // Performance tracking
  private renderStartTime = 0;

  constructor(
    container: d3.Selection<SVGElement, unknown, null, undefined>,
    database: Database,
    config: GridConfig,
    progressiveConfig: ProgressiveDisclosureConfig = DEFAULT_PROGRESSIVE_CONFIG
  ) {
    this.container = container;
    this.database = database;
    this.config = config;
    this.progressiveConfig = progressiveConfig;

    this.initializeProgressiveState();
    this.setupD3Structure();
    this.setupZoomBehavior();
  }

  private initializeProgressiveState(): void {
    this.progressiveState = {
      currentLevels: [0, 1, 2], // Default to first 3 levels
      availableLevelGroups: [],
      activeLevelTab: 0,
      zoomLevel: 0,
      isTransitioning: false,
      lastTransitionTime: 0
    };
  }

  private setupD3Structure(): void {
    // Clear any existing content
    this.container.selectAll('*').remove();

    // Create main groups with proper z-ordering
    this.gridGroup = this.container.append('g').attr('class', 'supergrid');
    this.headerGroup = this.gridGroup.append('g').attr('class', 'headers');
    this.cellsGroup = this.gridGroup.append('g').attr('class', 'cells');

    // Add CSS classes for styling
    this.container.classed('supergrid-container', true);
  }

  private setupZoomBehavior(): void {
    this.zoomBehavior = d3.zoom<SVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        const { transform } = event;
        this.gridGroup.attr('transform', transform);
      });

    this.container.call(this.zoomBehavior);
  }

  /**
   * Load data using direct sql.js queries
   * This is the core of Bridge Elimination architecture
   */
  async loadData(
    xAxisField: string,
    yAxisField: string,
    filterClause: string = '',
    groupByClause: string = ''
  ): Promise<void> {
    this.renderStartTime = performance.now();

    try {
      // Build the main data query
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

      console.log('[SuperGrid] Executing query:', dataQuery);
      const result = this.database.exec(dataQuery);

      if (!result[0]?.values) {
        console.warn('[SuperGrid] No data returned from query');
        return;
      }

      // Transform SQL results to GridData format
      const gridData = this.transformSQLToGridData(result[0], xAxisField, yAxisField);

      // Analyze hierarchy for Progressive Disclosure
      this.analyzeHierarchy(gridData);

      // Apply Progressive Disclosure filtering
      const filteredData = this.applyProgressiveDisclosure(gridData);

      this.currentData = filteredData;

      // Render with D3.js data binding
      this.render();

    } catch (error) {
      console.error('[SuperGrid] Data loading failed:', error);
      throw error;
    }
  }

  private transformSQLToGridData(sqlResult: any, xField: string, yField: string): GridData {
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

    // Transform to cells array
    const cells: GridCell[] = values.map((row: any[]) => {
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
    const xValues = [...new Set(values.map(row => row[colIndices.x]))].sort();
    const yValues = [...new Set(values.map(row => row[colIndices.y]))].sort();

    const xAxisData: AxisData = {
      field: xField,
      values: xValues,
      type: 'categorical', // Could be enhanced to detect numeric/date types
      range: { min: 0, max: xValues.length - 1 }
    };

    const yAxisData: AxisData = {
      field: yField,
      values: yValues,
      type: 'categorical',
      range: { min: 0, max: yValues.length - 1 }
    };

    return {
      cells,
      xAxis: xAxisData,
      yAxis: yAxisData,
      metadata: {
        totalCells: cells.length,
        totalCards: cells.reduce((sum, cell) => sum + cell.cards.length, 0),
        queryTime: performance.now() - this.renderStartTime
      }
    };
  }

  private analyzeHierarchy(gridData: GridData): void {
    // Detect natural hierarchy levels in the data
    const xValueDepth = this.calculateHierarchyDepth(gridData.xAxis.values);
    const yValueDepth = this.calculateHierarchyDepth(gridData.yAxis.values);

    // Create level groups based on data patterns
    const levelGroups: LevelGroup[] = [];

    // Time-based semantic grouping
    if (this.isTimeAxis(gridData.xAxis.field) || this.isTimeAxis(gridData.yAxis.field)) {
      levelGroups.push({
        id: 'time-overview',
        name: 'Time Overview',
        type: 'semantic',
        levels: [0, 1],
        nodeCount: Math.min(xValueDepth + yValueDepth, 10),
        pattern: 'temporal',
        isRecommended: true
      });

      levelGroups.push({
        id: 'time-detail',
        name: 'Detailed Timeline',
        type: 'semantic',
        levels: [0, 1, 2, 3],
        nodeCount: xValueDepth + yValueDepth,
        pattern: 'temporal'
      });
    }

    // Density-based grouping
    const totalNodes = gridData.cells.length;
    if (totalNodes > 50) {
      levelGroups.push({
        id: 'dense-overview',
        name: 'Overview',
        type: 'density',
        levels: [0, 1],
        nodeCount: Math.min(20, totalNodes),
        density: 0.3,
        isRecommended: totalNodes > 100
      });

      levelGroups.push({
        id: 'dense-detail',
        name: 'Full Detail',
        type: 'density',
        levels: [0, 1, 2, 3, 4],
        nodeCount: totalNodes,
        density: 1.0
      });
    }

    this.progressiveState.availableLevelGroups = levelGroups;
  }

  private calculateHierarchyDepth(values: any[]): number {
    // Simple heuristic - could be enhanced with proper hierarchy detection
    if (values.length <= 5) return 1;
    if (values.length <= 20) return 2;
    if (values.length <= 50) return 3;
    return Math.min(5, Math.ceil(Math.log2(values.length)));
  }

  private isTimeAxis(fieldName: string): boolean {
    const timeFields = ['created_at', 'modified_at', 'due_at', 'event_start', 'event_end', 'date', 'time', 'timestamp'];
    return timeFields.some(field => fieldName.toLowerCase().includes(field));
  }

  private applyProgressiveDisclosure(gridData: GridData): GridData {
    if (this.progressiveState.currentLevels.length >= this.progressiveConfig.maxVisibleLevels) {
      return gridData; // No filtering needed
    }

    // Filter cells based on current visibility levels
    // This would implement more sophisticated filtering logic
    // For now, return full data
    return gridData;
  }

  /**
   * Main render method using D3.js data binding
   * Direct binding to sql.js query results - no serialization
   */
  private render(): void {
    if (!this.currentData) return;

    console.log('[SuperGrid] Rendering', this.currentData.cells.length, 'cells');

    // Calculate layout dimensions
    const { cellWidth, cellHeight, headerWidth, headerHeight } = this.config;
    const { xAxis, yAxis, cells } = this.currentData;

    // Render headers
    this.renderHeaders(xAxis, yAxis);

    // Render cells with proper data binding
    const cellGroups = this.cellsGroup
      .selectAll<SVGGElement, GridCell>('.cell')
      .data(cells, d => d.id); // Key function for proper data binding

    // Enter + Update pattern
    const cellEnter = cellGroups
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', d => {
        const x = xAxis.values.indexOf(d.x) * cellWidth + headerWidth;
        const y = yAxis.values.indexOf(d.y) * cellHeight + headerHeight;
        return `translate(${x}, ${y})`;
      });

    // Add cell background
    cellEnter
      .append('rect')
      .attr('width', cellWidth - 2)
      .attr('height', cellHeight - 2)
      .attr('rx', 4)
      .attr('fill', d => this.getCellColor(d))
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1);

    // Add cell count text
    cellEnter
      .append('text')
      .attr('x', cellWidth / 2)
      .attr('y', cellHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#1f2937')
      .text(d => d.cards.length);

    // Update existing cells
    cellGroups
      .select('rect')
      .attr('fill', d => this.getCellColor(d));

    cellGroups
      .select('text')
      .text(d => d.cards.length);

    // Remove exited cells
    cellGroups.exit().remove();

    // Add interactivity
    this.setupCellInteractivity();

    // Performance tracking
    const renderTime = performance.now() - this.renderStartTime;
    console.log('[SuperGrid] Render complete:', renderTime.toFixed(2), 'ms');
  }

  private renderHeaders(xAxis: AxisData, yAxis: AxisData): void {
    const { cellWidth, cellHeight, headerWidth, headerHeight } = this.config;

    // Clear existing headers
    this.headerGroup.selectAll('*').remove();

    // X-axis headers
    const xHeaders = this.headerGroup
      .selectAll('.x-header')
      .data(xAxis.values)
      .join('g')
      .attr('class', 'x-header')
      .attr('transform', (_, i) => `translate(${i * cellWidth + headerWidth}, 0)`);

    xHeaders
      .append('rect')
      .attr('width', cellWidth)
      .attr('height', headerHeight)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#e2e8f0');

    xHeaders
      .append('text')
      .attr('x', cellWidth / 2)
      .attr('y', headerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '11px')
      .attr('fill', '#374151')
      .text(d => String(d));

    // Y-axis headers
    const yHeaders = this.headerGroup
      .selectAll('.y-header')
      .data(yAxis.values)
      .join('g')
      .attr('class', 'y-header')
      .attr('transform', (_, i) => `translate(0, ${i * cellHeight + headerHeight})`);

    yHeaders
      .append('rect')
      .attr('width', headerWidth)
      .attr('height', cellHeight)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#e2e8f0');

    yHeaders
      .append('text')
      .attr('x', headerWidth / 2)
      .attr('y', cellHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '11px')
      .attr('fill', '#374151')
      .text(d => String(d));
  }

  private getCellColor(cell: GridCell): string {
    // Color based on card count and priority
    const count = cell.cards.length;

    if (count === 0) return '#f8fafc';
    if (count === 1) return '#dbeafe';
    if (count <= 3) return '#93c5fd';
    if (count <= 7) return '#3b82f6';
    return '#1d4ed8';
  }

  private setupCellInteractivity(): void {
    this.cellsGroup
      .selectAll('.cell')
      .on('click', (_, d: GridCell) => {
        const position: GridPosition = {
          x: this.currentData!.xAxis.values.indexOf(d.x),
          y: this.currentData!.yAxis.values.indexOf(d.y)
        };
        this.callbacks.onCellClick?.(d, position);
      })
      .on('mouseenter', (_, d: GridCell) => {
        const position: GridPosition = {
          x: this.currentData!.xAxis.values.indexOf(d.x),
          y: this.currentData!.yAxis.values.indexOf(d.y)
        };
        this.callbacks.onCellHover?.(d, position);
      })
      .on('mouseleave', () => {
        this.callbacks.onCellHover?.(null, null);
      });
  }

  /**
   * Progressive Disclosure Controls
   */
  public setVisibleLevels(levels: number[], groupId?: string): void {
    if (this.progressiveState.isTransitioning) return;

    this.progressiveState.isTransitioning = true;
    this.progressiveState.currentLevels = levels;
    this.progressiveState.lastTransitionTime = Date.now();

    // Trigger transition animation
    if (this.currentData) {
      const filteredData = this.applyProgressiveDisclosure(this.currentData);

      // Animate transition
      this.cellsGroup
        .transition()
        .duration(this.progressiveConfig.transitionDuration)
        .style('opacity', 0)
        .on('end', () => {
          this.currentData = filteredData;
          this.render();
          this.cellsGroup
            .transition()
            .duration(this.progressiveConfig.transitionDuration / 2)
            .style('opacity', 1)
            .on('end', () => {
              this.progressiveState.isTransitioning = false;
            });
        });
    }

    this.callbacks.onLevelChange?.(levels, groupId || '');
  }

  public zoomToLevel(zoomLevel: number, direction: 'in' | 'out'): void {
    this.progressiveState.zoomLevel = zoomLevel;

    // Map zoom level to visible levels
    const maxLevels = this.progressiveConfig.maxVisibleLevels;
    const visibleLevels = Array.from({ length: Math.min(maxLevels, zoomLevel + 1) }, (_, i) => i);

    this.setVisibleLevels(visibleLevels);
    this.callbacks.onZoomChange?.(zoomLevel, direction);
  }

  /**
   * Public API Methods
   */
  public setCallbacks(callbacks: SuperGridCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getProgressiveState(): ProgressiveDisclosureState {
    return { ...this.progressiveState };
  }

  public getAvailableLevelGroups(): LevelGroup[] {
    return [...this.progressiveState.availableLevelGroups];
  }

  public getCurrentData(): GridData | null {
    return this.currentData;
  }

  public destroy(): void {
    this.container.selectAll('*').remove();
    this.container.on('.zoom', null);
  }
}