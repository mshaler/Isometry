/**
 * GridRenderer - Pure D3 grid visualization implementation
 *
 * Implements ViewRenderer interface for grid view type.
 * Provides D3-only visualization without any React rendering logic.
 *
 * Features:
 * - D3 .data().join() pattern with key functions
 * - PAFV positioning for axis mapping to screen coordinates
 * - Cell hover and click event handling
 * - SVG-based grid layout with proper styling
 * - No React JSX - pure D3 DOM manipulation
 */

import * as d3 from 'd3';
import type { Node } from '@/types/node';
import type { ViewRenderer } from '../contracts/ViewEngine';
import type { ViewConfig } from '../contracts/ViewConfig';
import { devLogger } from '../../utils/logging';

/**
 * Grid cell data structure for D3 binding
 */
interface GridCellData {
  id: string;
  node: Node;
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
}

/**
 * Grid layout configuration
 */
interface GridLayout {
  cellWidth: number;
  cellHeight: number;
  padding: number;
  headerHeight: number;
  headerWidth: number;
  columns: number;
  rows: number;
}

/**
 * Pure D3 grid renderer implementation
 */
export class GridRenderer implements ViewRenderer {
  private container: HTMLElement | null = null;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private gridGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private cellsGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private headersGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;

  private currentData: GridCellData[] = [];
  private layout: GridLayout;
  private config: ViewConfig | null = null;

  constructor() {
    // Default grid layout
    this.layout = {
      cellWidth: 120,
      cellHeight: 80,
      padding: 2,
      headerHeight: 40,
      headerWidth: 150,
      columns: 0,
      rows: 0
    };
  }

  /**
   * Main render method - implements ViewRenderer interface
   */
  render(container: HTMLElement, data: Node[], config: ViewConfig): void {
    try {
      this.container = container;
      this.config = config;

      // Update layout from config
      this.updateLayoutFromConfig(config);

      // Transform data for grid visualization
      const gridData = this.transformDataToGrid(data, config);
      this.currentData = gridData;

      // Set up D3 structure
      this.setupD3Structure(container);

      // Render grid components
      this.renderHeaders();
      this.renderCells();

      // Set up interactivity
      this.setupEventHandlers();

      devLogger.debug('GridRenderer rendered nodes', {
        nodeCount: data.length,
        columns: this.layout.columns,
        rows: this.layout.rows
      });

    } catch (error) {
      devLogger.error('GridRenderer render failed', { error });
      throw error;
    }
  }

  /**
   * Clean up D3 selections and event listeners
   */
  destroy(): void {
    if (this.svg) {
      this.svg.selectAll('*').remove();
    }

    this.container = null;
    this.svg = null;
    this.gridGroup = null;
    this.cellsGroup = null;
    this.headersGroup = null;
    this.currentData = [];
    this.config = null;

    devLogger.debug('GridRenderer destroyed successfully');
  }

  /**
   * Get the view type this renderer handles
   */
  getViewType(): string {
    return 'grid';
  }

  // Private implementation methods

  private updateLayoutFromConfig(config: ViewConfig): void {
    // Use config styling if available
    if (config.styling?.cellSize) {
      this.layout.cellWidth = config.styling.cellSize.width;
      this.layout.cellHeight = config.styling.cellSize.height;
    }

    if (config.styling?.headerSize) {
      this.layout.headerHeight = config.styling.headerSize.height;
      this.layout.headerWidth = config.styling.headerSize.width;
    }
  }

  private transformDataToGrid(data: Node[], _config: ViewConfig): GridCellData[] {
    // Calculate grid dimensions based on data and PAFV projection
    const gridSize = Math.ceil(Math.sqrt(data.length));
    this.layout.columns = gridSize;
    this.layout.rows = gridSize;

    // Transform nodes to grid cell data with PAFV positioning
    const gridData: GridCellData[] = data.map((node, index) => {
      // Calculate grid position
      const gridX = index % this.layout.columns;
      const gridY = Math.floor(index / this.layout.columns);

      // Calculate screen position with headers offset
      const x = gridX * this.layout.cellWidth + this.layout.headerWidth;
      const y = gridY * this.layout.cellHeight + this.layout.headerHeight;

      return {
        id: node.id,
        node,
        x,
        y,
        gridX,
        gridY,
        width: this.layout.cellWidth - this.layout.padding,
        height: this.layout.cellHeight - this.layout.padding
      };
    });

    devLogger.debug('GridRenderer transformed nodes to grid', {
      nodeCount: data.length,
      columns: this.layout.columns,
      rows: this.layout.rows
    });
    return gridData;
  }

  private setupD3Structure(_container: HTMLElement): void {
    // Calculate total SVG dimensions
    const totalWidth = this.layout.columns * this.layout.cellWidth + this.layout.headerWidth;
    const totalHeight = this.layout.rows * this.layout.cellHeight + this.layout.headerHeight;

    // Clear container
    d3.select(this.container!).selectAll('*').remove();

    // Create SVG with proper dimensions
    this.svg = d3.select(this.container!)
      .append('svg')
      .attr('width', totalWidth)
      .attr('height', totalHeight)
      .attr('class', 'grid-renderer-svg');

    // Create main groups with proper z-ordering
    this.gridGroup = this.svg.append('g').attr('class', 'grid-group');
    this.headersGroup = this.gridGroup.append('g').attr('class', 'headers-group');
    this.cellsGroup = this.gridGroup.append('g').attr('class', 'cells-group');

    // Add background
    this.gridGroup.insert('rect', ':first-child')
      .attr('class', 'grid-background')
      .attr('width', totalWidth)
      .attr('height', totalHeight)
      .attr('fill', this.config?.styling?.colorScheme === 'dark' ? '#1a1a1a' : '#ffffff');
  }

  private renderHeaders(): void {
    if (!this.headersGroup) return;

    // Clear existing headers
    this.headersGroup.selectAll('*').remove();

    // Column headers
    const columnHeaders = Array.from({ length: this.layout.columns }, (_, i) => ({
      index: i,
      label: `Col ${i + 1}`,
      x: i * this.layout.cellWidth + this.layout.headerWidth,
      y: 0
    }));

    const colHeaderGroups = this.headersGroup
      .selectAll<SVGGElement, typeof columnHeaders[0]>('.column-header')
      .data(columnHeaders, d => `col-${d.index}`) // Key function for proper data binding
      .join('g')
      .attr('class', 'column-header')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);

    // Column header backgrounds
    colHeaderGroups
      .append('rect')
      .attr('width', this.layout.cellWidth)
      .attr('height', this.layout.headerHeight)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1);

    // Column header text
    colHeaderGroups
      .append('text')
      .attr('x', this.layout.cellWidth / 2)
      .attr('y', this.layout.headerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#374151')
      .text(d => d.label);

    // Row headers
    const rowHeaders = Array.from({ length: this.layout.rows }, (_, i) => ({
      index: i,
      label: `Row ${i + 1}`,
      x: 0,
      y: i * this.layout.cellHeight + this.layout.headerHeight
    }));

    const rowHeaderGroups = this.headersGroup
      .selectAll<SVGGElement, typeof rowHeaders[0]>('.row-header')
      .data(rowHeaders, d => `row-${d.index}`) // Key function for proper data binding
      .join('g')
      .attr('class', 'row-header')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);

    // Row header backgrounds
    rowHeaderGroups
      .append('rect')
      .attr('width', this.layout.headerWidth)
      .attr('height', this.layout.cellHeight)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1);

    // Row header text
    rowHeaderGroups
      .append('text')
      .attr('x', this.layout.headerWidth / 2)
      .attr('y', this.layout.cellHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#374151')
      .text(d => d.label);

    // Corner header
    this.headersGroup
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.layout.headerWidth)
      .attr('height', this.layout.headerHeight)
      .attr('fill', '#f1f5f9')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1);
  }

  private renderCells(): void {
    if (!this.cellsGroup) return;

    // D3 data binding with key function for proper enter/update/exit
    const cellGroups = this.cellsGroup
      .selectAll<SVGGElement, GridCellData>('.grid-cell')
      .data(this.currentData, d => d.id); // Key function ensures proper element lifecycle

    // ENTER selection - create new cells
    const cellEnter = cellGroups
      .enter()
      .append('g')
      .attr('class', 'grid-cell')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('opacity', 0); // Start invisible for animation

    // Cell background
    cellEnter
      .append('rect')
      .attr('class', 'cell-background')
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .attr('rx', this.config?.styling?.grid?.cellBorderRadius || 4)
      .attr('fill', d => this.getCellColor(d.node))
      .attr('stroke', this.config?.styling?.grid?.gridLineColor || '#e2e8f0')
      .attr('stroke-width', 1);

    // Cell text - node name
    cellEnter
      .append('text')
      .attr('class', 'cell-text')
      .attr('x', d => d.width / 2)
      .attr('y', d => d.height / 2 - 10)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('fill', '#1f2937')
      .text(d => d.node.name || 'Untitled')
      .call(this.wrapText.bind(this)); // Wrap long text

    // Cell subtitle - status or other info
    cellEnter
      .append('text')
      .attr('class', 'cell-subtitle')
      .attr('x', d => d.width / 2)
      .attr('y', d => d.height / 2 + 10)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '9px')
      .attr('fill', '#6b7280')
      .text(d => d.node.status || 'active');

    // UPDATE selection - update existing cells
    cellGroups
      .select('.cell-background')
      .attr('fill', d => this.getCellColor(d.node));

    cellGroups
      .select('.cell-text')
      .text(d => d.node.name || 'Untitled');

    cellGroups
      .select('.cell-subtitle')
      .text(d => d.node.status || 'active');

    // Animate entrance of new cells
    cellEnter
      .transition()
      .duration(300)
      .style('opacity', 1);

    // EXIT selection - remove old cells
    cellGroups.exit()
      .transition()
      .duration(200)
      .style('opacity', 0)
      .remove();

    devLogger.debug('GridRenderer rendered cells with D3 data binding', {
      cellCount: this.currentData.length
    });
  }

  private getCellColor(node: Node): string {
    // Color cells based on node properties
    if (!node.status) return '#f8fafc';

    switch (node.status.toLowerCase()) {
      case 'active': return '#dcfce7'; // Green
      case 'completed': return '#dbeafe'; // Blue
      case 'pending': return '#fef3c7'; // Yellow
      case 'blocked': return '#fee2e2'; // Red
      default: return '#f3f4f6'; // Gray
    }
  }

  private wrapText(textSelection: d3.Selection<SVGTextElement, GridCellData, SVGGElement, unknown>): void {
    textSelection.each(function(d) {
      const text = d3.select(this);
      const words = (d.node.name || 'Untitled').split(/\s+/);
      const lineHeight = 1.1; // ems
      const maxWidth = d.width - 10; // Leave padding
      const maxLines = 2;

      let line: string[] = [];
      let lineNumber = 0;
      let tspan = text.text(null).append('tspan').attr('x', d.width / 2).attr('dy', 0);

      words.forEach(word => {
        line.push(word);
        tspan.text(line.join(' '));

        if (tspan.node()!.getComputedTextLength() > maxWidth && line.length > 1) {
          line.pop();
          tspan.text(line.join(' '));
          line = [word];
          lineNumber++;

          if (lineNumber < maxLines) {
            tspan = text.append('tspan')
              .attr('x', d.width / 2)
              .attr('dy', lineHeight + 'em')
              .text(word);
          }
        }
      });
    });
  }

  private setupEventHandlers(): void {
    if (!this.cellsGroup || !this.config?.eventHandlers) return;

    // Cell click events
    this.cellsGroup
      .selectAll('.grid-cell')
      .on('click', (_event, d) => {
        const cellData = d as GridCellData;
        devLogger.debug('GridRenderer cell clicked', { nodeName: cellData.node.name });
        this.config?.eventHandlers?.onNodeClick?.(cellData.node, { x: cellData.gridX, y: cellData.gridY });
      })
      .on('mouseenter', (_event, d) => {
        const cellData = d as GridCellData;
        // Highlight cell on hover
        d3.select(_event.currentTarget)
          .select('.cell-background')
          .attr('stroke-width', 2)
          .attr('stroke', '#3b82f6');

        this.config?.eventHandlers?.onNodeHover?.(cellData.node, { x: cellData.gridX, y: cellData.gridY });
      })
      .on('mouseleave', (_event, _d) => {
        // Remove highlight
        d3.select(_event.currentTarget)
          .select('.cell-background')
          .attr('stroke-width', 1)
          .attr('stroke', this.config?.styling?.grid?.gridLineColor || '#e2e8f0');

        this.config?.eventHandlers?.onNodeHover?.(null, null);
      })
      .style('cursor', 'pointer');

    devLogger.debug('GridRenderer event handlers set up for grid cell interactions');
  }
}