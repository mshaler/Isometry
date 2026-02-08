/**
 * SuperDensityRenderer - D3.js Density Visualization
 *
 * D3.js renderer for Janus density model visualizations. Handles real-time
 * density changes with smooth transitions and maintains 60fps performance.
 * Integrates with SuperDensityService for unified aggregation control.
 *
 * Section 2.5 of SuperGrid specification: D3.js visualization layer for
 * SuperDensitySparsity unified aggregation control system.
 *
 * Key Features:
 * - Real-time density visualization with smooth transitions
 * - 4-level density hierarchy rendering
 * - Pan × Zoom visual independence
 * - Lossless aggregation visual feedback
 * - Performance monitoring and optimization
 * - Cross-density accuracy indicators
 */

import * as d3 from 'd3';
import type {
  JanusDensityState,
  DensityAggregationResult,
  DensityAggregatedRow,
  DensityChangeEvent,
  RegionDensityConfig
} from '@/types/supergrid';

export interface DensityRenderConfig {
  /** Container dimensions */
  width: number;
  height: number;
  /** Cell sizing */
  cellWidth: number;
  cellHeight: number;
  /** Margins */
  margin: { top: number; right: number; bottom: number; left: number };
  /** Transition duration */
  transitionDuration: number;
  /** Color schemes */
  colorScheme: {
    leaf: string[];
    collapsed: string[];
    sparse: string[];
    populated: string[];
  };
  /** Visual feedback */
  showAggregationIndicators: boolean;
  showPerformanceMetrics: boolean;
  enableHoverDetails: boolean;
}

export interface DensityVisualState {
  /** Current render mode */
  renderMode: 'grid' | 'matrix' | 'hybrid';
  /** Zoom transform */
  transform: d3.ZoomTransform;
  /** Selected cells */
  selectedCells: Set<string>;
  /** Hover state */
  hoveredCell: string | null;
  /** Animation state */
  isTransitioning: boolean;
}

/**
 * SuperDensityRenderer - D3.js density visualization engine
 */
export class SuperDensityRenderer {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private container: d3.Selection<SVGGElement, unknown, null, undefined>;
  private gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private overlayGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private tooltipDiv: d3.Selection<HTMLDivElement, unknown, null, undefined>;

  private currentData: DensityAggregatedRow[] = [];
  private currentState: JanusDensityState;
  private visualState: DensityVisualState;
  private config: DensityRenderConfig;

  private xScale: d3.ScaleLinear<number, number>;
  private yScale: d3.ScaleLinear<number, number>;
  private colorScale: d3.ScaleOrdinal<string, string>;
  private sizeScale: d3.ScaleLinear<number, number>;

  constructor(
    containerElement: HTMLElement,
    initialState: JanusDensityState,
    config: Partial<DensityRenderConfig> = {}
  ) {
    this.config = {
      width: 800,
      height: 600,
      cellWidth: 80,
      cellHeight: 60,
      margin: { top: 40, right: 40, bottom: 40, left: 40 },
      transitionDuration: 300,
      colorScheme: {
        leaf: ['#e8f5e8', '#c8e6c9', '#a5d6a7', '#81c784'],
        collapsed: ['#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6'],
        sparse: ['#fff3e0', '#ffe0b2', '#ffcc80', '#ffb74d'],
        populated: ['#fce4ec', '#f8bbd9', '#f48fb1', '#f06292']
      },
      showAggregationIndicators: true,
      showPerformanceMetrics: true,
      enableHoverDetails: true,
      ...config
    };

    this.currentState = initialState;
    this.visualState = {
      renderMode: this.mapViewDensityToRenderMode(initialState.viewDensity),
      transform: d3.zoomIdentity,
      selectedCells: new Set(),
      hoveredCell: null,
      isTransitioning: false
    };

    this.initializeD3Elements(containerElement);
    this.initializeScales();
    this.setupZoomBehavior();
    this.createTooltip();
  }

  /**
   * Initialize D3 SVG elements and structure
   */
  private initializeD3Elements(containerElement: HTMLElement): void {
    // Clear existing content
    d3.select(containerElement).selectAll('*').remove();

    // Create main SVG
    this.svg = d3
      .select(containerElement)
      .append('svg')
      .attr('width', this.config.width)
      .attr('height', this.config.height)
      .style('border', '1px solid #e0e0e0');

    // Create container group with margins
    this.container = this.svg
      .append('g')
      .attr('transform', `translate(${this.config.margin.left}, ${this.config.margin.top})`);

    // Create main groups for layered rendering
    this.gridGroup = this.container
      .append('g')
      .attr('class', 'density-grid-group');

    this.overlayGroup = this.container
      .append('g')
      .attr('class', 'density-overlay-group');

    // Add performance indicator
    if (this.config.showPerformanceMetrics) {
      this.overlayGroup
        .append('text')
        .attr('class', 'performance-indicator')
        .attr('x', 10)
        .attr('y', 20)
        .style('font-family', 'monospace')
        .style('font-size', '11px')
        .style('fill', '#666')
        .text('Performance: Ready');
    }
  }

  /**
   * Initialize D3 scales
   */
  private initializeScales(): void {
    const innerWidth = this.config.width - this.config.margin.left - this.config.margin.right;
    const innerHeight = this.config.height - this.config.margin.top - this.config.margin.bottom;

    this.xScale = d3
      .scaleLinear()
      .domain([0, 10]) // Will be updated based on data
      .range([0, innerWidth]);

    this.yScale = d3
      .scaleLinear()
      .domain([0, 10]) // Will be updated based on data
      .range([0, innerHeight]);

    // Color scale based on current density mode
    const colorPalette = this.getColorPalette();
    this.colorScale = d3
      .scaleOrdinal<string, string>()
      .range(colorPalette);

    // Size scale for aggregation indicators
    this.sizeScale = d3
      .scaleLinear()
      .domain([1, 100]) // Source count range
      .range([0.8, 2.0]); // Scale multiplier range
  }

  /**
   * Get color palette based on current density state
   */
  private getColorPalette(): string[] {
    const { valueDensity, extentDensity } = this.currentState;

    if (valueDensity === 'leaf' && extentDensity === 'sparse') {
      return this.config.colorScheme.leaf;
    } else if (valueDensity === 'leaf' && extentDensity === 'populated-only') {
      return this.config.colorScheme.populated;
    } else if (valueDensity === 'collapsed' && extentDensity === 'sparse') {
      return this.config.colorScheme.sparse;
    } else {
      return this.config.colorScheme.collapsed;
    }
  }

  /**
   * Setup zoom behavior
   */
  private setupZoomBehavior(): void {
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        this.visualState.transform = event.transform;
        this.gridGroup.attr('transform', event.transform.toString());
      });

    this.svg.call(zoom);
  }

  /**
   * Create tooltip element
   */
  private createTooltip(): void {
    if (!this.config.enableHoverDetails) return;

    this.tooltipDiv = d3
      .select(document.body)
      .append('div')
      .attr('class', 'density-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);
  }

  /**
   * Render aggregated data with current density state
   */
  async render(aggregationResult: DensityAggregationResult): Promise<void> {
    const startTime = performance.now();
    this.visualState.isTransitioning = true;

    try {
      this.currentData = aggregationResult.data;

      // Update performance indicator
      this.updatePerformanceIndicator(aggregationResult.timing);

      // Update scales based on data
      this.updateScales();

      // Render based on current view density mode
      switch (this.visualState.renderMode) {
        case 'grid':
          await this.renderGridMode();
          break;
        case 'matrix':
          await this.renderMatrixMode();
          break;
        case 'hybrid':
          await this.renderHybridMode();
          break;
      }

      // Render aggregation indicators if enabled
      if (this.config.showAggregationIndicators) {
        this.renderAggregationIndicators();
      }

      // Render region configurations
      this.renderRegionConfigurations();

    } finally {
      this.visualState.isTransitioning = false;

      const endTime = performance.now();
      console.log(`[SuperDensityRenderer] Render completed in ${(endTime - startTime).toFixed(2)}ms`);
    }
  }

  /**
   * Update scales based on current data
   */
  private updateScales(): void {
    if (this.currentData.length === 0) return;

    // Calculate data extents for positioning
    const maxCols = Math.ceil(Math.sqrt(this.currentData.length * 1.2));
    const maxRows = Math.ceil(this.currentData.length / maxCols);

    this.xScale.domain([0, maxCols]);
    this.yScale.domain([0, maxRows]);

    // Update size scale based on source counts
    const sourceCounts = this.currentData.map(d => d.sourceCount);
    const maxSourceCount = Math.max(...sourceCounts, 1);
    this.sizeScale.domain([1, maxSourceCount]);

    // Update color scale domain
    const uniqueValues = Array.from(new Set(this.currentData.map(d => this.getColorValue(d))));
    this.colorScale.domain(uniqueValues);
  }

  /**
   * Get color value for a data row
   */
  private getColorValue(row: DensityAggregatedRow): string {
    // Extract primary dimension value for coloring
    const dimensionParts = row.dimensionPath.split('|');
    return dimensionParts[0] || 'default';
  }

  /**
   * Render grid mode (spreadsheet-like layout)
   */
  private async renderGridMode(): Promise<void> {
    const cellSelection = this.gridGroup
      .selectAll<SVGRectElement, DensityAggregatedRow>('.density-cell')
      .data(this.currentData, d => d.cellId);

    const enterSelection = cellSelection
      .enter()
      .append('rect')
      .attr('class', 'density-cell')
      .attr('x', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(this.currentData.length))))
      .attr('y', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(this.currentData.length)))))
      .attr('width', 0)
      .attr('height', 0)
      .style('fill', d => this.colorScale(this.getColorValue(d)))
      .style('stroke', '#fff')
      .style('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => this.handleCellMouseEnter(event, d))
      .on('mouseleave', (event, d) => this.handleCellMouseLeave(event, d))
      .on('click', (event, d) => this.handleCellClick(event, d));

    // Update transition
    cellSelection
      .merge(enterSelection)
      .transition()
      .duration(this.config.transitionDuration)
      .attr('x', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(this.currentData.length))))
      .attr('y', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(this.currentData.length)))))
      .attr('width', this.config.cellWidth * this.getSizeMultiplier)
      .attr('height', this.config.cellHeight * this.getSizeMultiplier)
      .style('fill', d => this.colorScale(this.getColorValue(d)));

    // Exit transition
    cellSelection
      .exit()
      .transition()
      .duration(this.config.transitionDuration)
      .attr('width', 0)
      .attr('height', 0)
      .style('opacity', 0)
      .remove();

    // Add text labels
    await this.renderCellLabels();
  }

  /**
   * Render matrix mode (dense matrix layout)
   */
  private async renderMatrixMode(): Promise<void> {
    // Matrix mode uses smaller, denser cells
    const matrixCellSize = Math.min(this.config.cellWidth, this.config.cellHeight) * 0.6;

    const cellSelection = this.gridGroup
      .selectAll<SVGCircleElement, DensityAggregatedRow>('.density-matrix-cell')
      .data(this.currentData, d => d.cellId);

    const enterSelection = cellSelection
      .enter()
      .append('circle')
      .attr('class', 'density-matrix-cell')
      .attr('cx', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(this.currentData.length))) + matrixCellSize / 2)
      .attr('cy', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(this.currentData.length)))) + matrixCellSize / 2)
      .attr('r', 0)
      .style('fill', d => this.colorScale(this.getColorValue(d)))
      .style('stroke', '#fff')
      .style('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => this.handleCellMouseEnter(event, d))
      .on('mouseleave', (event, d) => this.handleCellMouseLeave(event, d))
      .on('click', (event, d) => this.handleCellClick(event, d));

    // Update transition
    cellSelection
      .merge(enterSelection)
      .transition()
      .duration(this.config.transitionDuration)
      .attr('cx', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(this.currentData.length))) + matrixCellSize / 2)
      .attr('cy', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(this.currentData.length)))) + matrixCellSize / 2)
      .attr('r', d => (matrixCellSize / 2) * this.getSizeMultiplier(d))
      .style('fill', d => this.colorScale(this.getColorValue(d)));

    // Exit transition
    cellSelection
      .exit()
      .transition()
      .duration(this.config.transitionDuration)
      .attr('r', 0)
      .style('opacity', 0)
      .remove();
  }

  /**
   * Render hybrid mode (combination of grid and matrix)
   */
  private async renderHybridMode(): Promise<void> {
    // Split data between grid and matrix rendering based on aggregation level
    const leafData = this.currentData.filter(d => d.isLeaf);
    const aggregatedData = this.currentData.filter(d => !d.isLeaf);

    // Render leaf data as grid
    await this.renderDataAsGrid(leafData, 'hybrid-grid-cell');

    // Render aggregated data as matrix
    await this.renderDataAsMatrix(aggregatedData, 'hybrid-matrix-cell');
  }

  /**
   * Render data as grid cells
   */
  private async renderDataAsGrid(data: DensityAggregatedRow[], className: string): Promise<void> {
    const cellSelection = this.gridGroup
      .selectAll<SVGRectElement, DensityAggregatedRow>(`.${className}`)
      .data(data, d => d.cellId);

    const enterSelection = cellSelection
      .enter()
      .append('rect')
      .attr('class', className)
      .attr('x', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(data.length))))
      .attr('y', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(data.length)))))
      .attr('width', 0)
      .attr('height', 0)
      .style('fill', d => this.colorScale(this.getColorValue(d)))
      .style('stroke', '#fff')
      .style('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => this.handleCellMouseEnter(event, d))
      .on('mouseleave', (event, d) => this.handleCellMouseLeave(event, d))
      .on('click', (event, d) => this.handleCellClick(event, d));

    cellSelection
      .merge(enterSelection)
      .transition()
      .duration(this.config.transitionDuration)
      .attr('x', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(data.length))))
      .attr('y', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(data.length)))))
      .attr('width', this.config.cellWidth * this.getSizeMultiplier)
      .attr('height', this.config.cellHeight * this.getSizeMultiplier)
      .style('fill', d => this.colorScale(this.getColorValue(d)));

    cellSelection
      .exit()
      .transition()
      .duration(this.config.transitionDuration)
      .attr('width', 0)
      .attr('height', 0)
      .style('opacity', 0)
      .remove();
  }

  /**
   * Render data as matrix cells
   */
  private async renderDataAsMatrix(data: DensityAggregatedRow[], className: string): Promise<void> {
    const matrixCellSize = Math.min(this.config.cellWidth, this.config.cellHeight) * 0.6;

    const cellSelection = this.gridGroup
      .selectAll<SVGCircleElement, DensityAggregatedRow>(`.${className}`)
      .data(data, d => d.cellId);

    const enterSelection = cellSelection
      .enter()
      .append('circle')
      .attr('class', className)
      .attr('cx', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(data.length))) + matrixCellSize / 2)
      .attr('cy', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(data.length)))) + matrixCellSize / 2)
      .attr('r', 0)
      .style('fill', d => this.colorScale(this.getColorValue(d)))
      .style('stroke', '#fff')
      .style('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => this.handleCellMouseEnter(event, d))
      .on('mouseleave', (event, d) => this.handleCellMouseLeave(event, d))
      .on('click', (event, d) => this.handleCellClick(event, d));

    cellSelection
      .merge(enterSelection)
      .transition()
      .duration(this.config.transitionDuration)
      .attr('cx', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(data.length))) + matrixCellSize / 2)
      .attr('cy', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(data.length)))) + matrixCellSize / 2)
      .attr('r', d => (matrixCellSize / 2) * this.getSizeMultiplier(d))
      .style('fill', d => this.colorScale(this.getColorValue(d)));

    cellSelection
      .exit()
      .transition()
      .duration(this.config.transitionDuration)
      .attr('r', 0)
      .style('opacity', 0)
      .remove();
  }

  /**
   * Render cell labels
   */
  private async renderCellLabels(): Promise<void> {
    const labelSelection = this.gridGroup
      .selectAll<SVGTextElement, DensityAggregatedRow>('.density-cell-label')
      .data(this.currentData, d => d.cellId);

    const enterSelection = labelSelection
      .enter()
      .append('text')
      .attr('class', 'density-cell-label')
      .attr('x', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(this.currentData.length))) + this.config.cellWidth / 2)
      .attr('y', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(this.currentData.length)))) + this.config.cellHeight / 2)
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .style('font-size', '11px')
      .style('font-family', 'sans-serif')
      .style('fill', '#333')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .text(d => this.formatCellLabel(d));

    labelSelection
      .merge(enterSelection)
      .transition()
      .duration(this.config.transitionDuration)
      .attr('x', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(this.currentData.length))) + this.config.cellWidth / 2)
      .attr('y', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(this.currentData.length)))) + this.config.cellHeight / 2)
      .style('opacity', d => this.shouldShowLabel(d) ? 1 : 0)
      .text(d => this.formatCellLabel(d));

    labelSelection
      .exit()
      .transition()
      .duration(this.config.transitionDuration)
      .style('opacity', 0)
      .remove();
  }

  /**
   * Format cell label based on density mode
   */
  private formatCellLabel(row: DensityAggregatedRow): string {
    if (this.currentState.valueDensity === 'leaf') {
      return row.displayValue;
    } else {
      return `${row.sourceCount}`;
    }
  }

  /**
   * Determine if label should be shown
   */
  private shouldShowLabel(row: DensityAggregatedRow): boolean {
    const cellArea = this.config.cellWidth * this.config.cellHeight * this.getSizeMultiplier(row);
    return cellArea > 1000; // Only show labels for sufficiently large cells
  }

  /**
   * Render aggregation indicators
   */
  private renderAggregationIndicators(): void {
    if (this.currentState.valueDensity !== 'collapsed') return;

    const indicatorSelection = this.overlayGroup
      .selectAll<SVGRectElement, DensityAggregatedRow>('.aggregation-indicator')
      .data(this.currentData.filter(d => !d.isLeaf), d => d.cellId);

    const enterSelection = indicatorSelection
      .enter()
      .append('rect')
      .attr('class', 'aggregation-indicator')
      .attr('width', 8)
      .attr('height', 8)
      .attr('x', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(this.currentData.length))) - 4)
      .attr('y', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(this.currentData.length)))) - 4)
      .style('fill', '#ff9800')
      .style('stroke', '#fff')
      .style('stroke-width', 1)
      .style('opacity', 0.8);

    indicatorSelection
      .merge(enterSelection)
      .transition()
      .duration(this.config.transitionDuration)
      .attr('x', (_, i) => this.xScale(i % Math.ceil(Math.sqrt(this.currentData.length))) - 4)
      .attr('y', (_, i) => this.yScale(Math.floor(i / Math.ceil(Math.sqrt(this.currentData.length)))) - 4);

    indicatorSelection
      .exit()
      .transition()
      .duration(this.config.transitionDuration)
      .style('opacity', 0)
      .remove();
  }

  /**
   * Render region configurations
   */
  private renderRegionConfigurations(): void {
    // Visual indicators for different region density configurations
    const regions = this.currentState.regionConfig;
    if (regions.length === 0) return;

    const regionSelection = this.overlayGroup
      .selectAll<SVGRectElement, RegionDensityConfig>('.region-indicator')
      .data(regions, d => d.regionId);

    const enterSelection = regionSelection
      .enter()
      .append('rect')
      .attr('class', 'region-indicator')
      .attr('width', 20)
      .attr('height', 4)
      .attr('x', 10)
      .attr('y', (_, i) => 30 + i * 8)
      .style('fill', d => this.getRegionColor(d))
      .style('opacity', 0.7);

    regionSelection
      .merge(enterSelection)
      .style('fill', d => this.getRegionColor(d));

    regionSelection
      .exit()
      .remove();
  }

  /**
   * Get color for region indicator
   */
  private getRegionColor(region: RegionDensityConfig): string {
    switch (region.visualWeight) {
      case 'light': return '#e0e0e0';
      case 'normal': return '#9e9e9e';
      case 'heavy': return '#424242';
      default: return '#9e9e9e';
    }
  }

  /**
   * Get size multiplier for cell based on source count
   */
  private getSizeMultiplier = (row: DensityAggregatedRow): number => {
    if (this.currentState.valueDensity === 'leaf') {
      return 1.0;
    }
    return this.sizeScale(row.sourceCount);
  };

  /**
   * Handle cell mouse enter
   */
  private handleCellMouseEnter(event: MouseEvent, row: DensityAggregatedRow): void {
    this.visualState.hoveredCell = row.cellId;

    if (this.config.enableHoverDetails) {
      const tooltipContent = this.generateTooltipContent(row);
      this.tooltipDiv
        .style('opacity', 1)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .html(tooltipContent);
    }
  }

  /**
   * Handle cell mouse leave
   */
  private handleCellMouseLeave(event: MouseEvent, row: DensityAggregatedRow): void {
    this.visualState.hoveredCell = null;

    if (this.config.enableHoverDetails) {
      this.tooltipDiv.style('opacity', 0);
    }
  }

  /**
   * Handle cell click
   */
  private handleCellClick(event: MouseEvent, row: DensityAggregatedRow): void {
    if (this.visualState.selectedCells.has(row.cellId)) {
      this.visualState.selectedCells.delete(row.cellId);
    } else {
      this.visualState.selectedCells.add(row.cellId);
    }

    // Update visual selection state
    this.updateCellSelection();
  }

  /**
   * Update cell selection visual state
   */
  private updateCellSelection(): void {
    this.gridGroup
      .selectAll('.density-cell, .density-matrix-cell, .hybrid-grid-cell, .hybrid-matrix-cell')
      .style('stroke', (d: any) =>
        this.visualState.selectedCells.has(d.cellId) ? '#ff5722' : '#fff'
      )
      .style('stroke-width', (d: any) =>
        this.visualState.selectedCells.has(d.cellId) ? 3 : 1
      );
  }

  /**
   * Generate tooltip content for cell
   */
  private generateTooltipContent(row: DensityAggregatedRow): string {
    const parts = [
      `<strong>${row.displayValue}</strong>`,
      `Source Count: ${row.sourceCount}`,
      `Aggregation: ${row.aggregationFunction}`,
      `Dimension: ${row.dimensionPath}`
    ];

    if (this.currentState.aggregationPreferences.showAggregationSource && row.sourceIds.length > 0) {
      parts.push(`Source IDs: ${row.sourceIds.slice(0, 3).join(', ')}${row.sourceIds.length > 3 ? '...' : ''}`);
    }

    return parts.join('<br/>');
  }

  /**
   * Update performance indicator
   */
  private updatePerformanceIndicator(timing: any): void {
    if (!this.config.showPerformanceMetrics) return;

    const indicator = this.overlayGroup.select('.performance-indicator');
    if (indicator.empty()) return;

    const status = timing.withinPerformanceTarget ? '✓' : '⚠';
    const text = `Performance: ${status} ${timing.totalTime.toFixed(1)}ms`;

    indicator
      .text(text)
      .style('fill', timing.withinPerformanceTarget ? '#4caf50' : '#ff9800');
  }

  /**
   * Handle density state change
   */
  updateDensityState(newState: JanusDensityState): void {
    const previousState = this.currentState;
    this.currentState = newState;

    // Update render mode if view density changed
    if (previousState.viewDensity !== newState.viewDensity) {
      this.visualState.renderMode = this.mapViewDensityToRenderMode(newState.viewDensity);
    }

    // Update color palette if density modes changed
    if (previousState.valueDensity !== newState.valueDensity ||
        previousState.extentDensity !== newState.extentDensity) {
      const newColorPalette = this.getColorPalette();
      this.colorScale.range(newColorPalette);
    }
  }

  /**
   * Map view density to render mode
   */
  private mapViewDensityToRenderMode(viewDensity: string): 'grid' | 'matrix' | 'hybrid' {
    switch (viewDensity) {
      case 'spreadsheet': return 'grid';
      case 'matrix': return 'matrix';
      case 'hybrid': return 'hybrid';
      default: return 'grid';
    }
  }

  /**
   * Get current visual state
   */
  getVisualState(): DensityVisualState {
    return { ...this.visualState };
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.visualState.selectedCells.clear();
    this.updateCellSelection();
  }

  /**
   * Get selected cell data
   */
  getSelectedCells(): DensityAggregatedRow[] {
    return this.currentData.filter(row => this.visualState.selectedCells.has(row.cellId));
  }

  /**
   * Cleanup D3 elements and event listeners
   */
  destroy(): void {
    if (this.tooltipDiv) {
      this.tooltipDiv.remove();
    }
  }
}