/**
 * SuperGridEngine Renderer - Handles D3.js rendering of grids
 */

import type { CellDescriptor, HeaderTree, HeaderDescriptor, GridDimensions, SelectionState, Node } from './types';
import { devLogger } from '../../utils/logging';

export class SuperGridRenderer {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;

  // Event callbacks
  private onCellClick?: (cell: CellDescriptor, nodes: Node[]) => void;
  private onHeaderClick?: (header: HeaderDescriptor) => void;
  private onRenderComplete?: (renderTime: number, cellCount: number) => void;

  constructor(_animationDuration: number = 250) {
    // Animation duration stored for future use
  }

  /**
   * Initialize SVG and set up basic structure
   */
  async setupSVG(container: HTMLElement, width: number, height: number, enableZoomPan: boolean): Promise<void> {
    // Import d3 dynamically to avoid module loading issues
    const d3 = await import('d3');

    this.svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'supergrid-engine');

    // Create main groups with proper z-ordering
    const mainGroup = this.svg.append('g').attr('class', 'supergrid-main');
    mainGroup.append('g').attr('class', 'headers');
    mainGroup.append('g').attr('class', 'cells');
    mainGroup.append('g').attr('class', 'selection');

    if (enableZoomPan) {
      this.setupZoomBehavior(d3);
    }
  }

  /**
   * Set up zoom and pan behavior
   */
  private setupZoomBehavior(d3: typeof import('d3')): void {
    if (!this.svg) return;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        const { transform } = event;
        this.svg!.select('.supergrid-main')
          .attr('transform', transform.toString());
      });

    (this.svg as any).call(zoom);
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: {
    onCellClick?: (cell: CellDescriptor, nodes: Node[]) => void;
    onHeaderClick?: (header: HeaderDescriptor) => void;
    onRenderComplete?: (renderTime: number, cellCount: number) => void;
  }): void {
    this.onCellClick = callbacks.onCellClick;
    this.onHeaderClick = callbacks.onHeaderClick;
    this.onRenderComplete = callbacks.onRenderComplete;
  }

  /**
   * Render complete grid with headers and cells
   */
  async render(
    currentCells: CellDescriptor[],
    headerTree: HeaderTree,
    gridDimensions: GridDimensions,
    allNodes: Node[]
  ): Promise<void> {
    if (!this.svg) return;

    const startTime = performance.now();

    // Import d3 for rendering
    const d3 = await import('d3');

    // Render headers
    this.renderHeaders(d3, headerTree, gridDimensions);

    // Render cells
    this.renderCells(d3, currentCells, gridDimensions, allNodes);

    const renderTime = performance.now() - startTime;

    if (this.onRenderComplete) {
      this.onRenderComplete(renderTime, currentCells.length);
    }

    devLogger.render('SuperGridRenderer completed render', {
      cellCount: currentCells.length,
      renderTime
    });
  }

  /**
   * Get fill color based on header level for visual hierarchy.
   * Deeper levels get lighter shades.
   */
  private getHeaderFillByLevel(level: number): string {
    const fills = ['#e0e0e0', '#ebebeb', '#f5f5f5', '#fafafa'];
    return fills[Math.min(level, fills.length - 1)];
  }

  /**
   * Get font size based on header level.
   * Root headers are larger, deeper levels are smaller.
   */
  private getHeaderFontSize(level: number): string {
    const sizes = ['13px', '12px', '11px', '10px'];
    return sizes[Math.min(level, sizes.length - 1)];
  }

  /**
   * Render grid headers (columns and rows) using D3 .join() pattern.
   * Supports multi-level nested headers with visual spanning.
   */
  private renderHeaders(
    _d3: typeof import('d3'),
    headerTree: HeaderTree,
    gridDimensions: GridDimensions
  ): void {
    if (!this.svg) return;

    const headersGroup = this.svg.select('.headers');
    const onHeaderClick = this.onHeaderClick;

    // Calculate total header height for multi-level columns
    const totalColumnHeaderHeight = headerTree.maxColumnLevels > 1
      ? gridDimensions.headerHeight
      : gridDimensions.headerHeight;

    // Calculate total header width for multi-level rows
    const totalRowHeaderWidth = headerTree.maxRowLevels > 1
      ? gridDimensions.headerWidth
      : gridDimensions.headerWidth;

    // Column headers - using .join() pattern
    headersGroup
      .selectAll<SVGGElement, HeaderDescriptor>('.column-header')
      .data(headerTree.columns, d => d.id)
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', 'column-header')
            .style('cursor', 'pointer');

          g.append('rect')
            .attr('stroke', '#bbb')
            .attr('stroke-width', 1);

          g.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('user-select', 'none');

          // Add click handler for header selection
          g.on('click', (_event, d) => {
            if (onHeaderClick) {
              onHeaderClick(d);
            }
          });

          return g;
        },
        update => update,
        exit => exit.remove()
      )
      .attr('transform', d => `translate(${d.position.x + totalRowHeaderWidth}, ${d.position.y})`)
      .each(function(d) {
        const g = _d3.select(this);

        g.select('rect')
          .attr('width', d.position.width)
          .attr('height', d.position.height)
          .attr('fill', d.isLeaf ? '#f5f5f5' : '#e8e8e8');

        g.select('text')
          .attr('x', d.position.width / 2)
          .attr('y', d.position.height / 2)
          .style('font-size', d.isLeaf ? '11px' : '12px')
          .style('font-weight', d.isLeaf ? 'normal' : '500')
          .text(d.value);
      });

    // Row headers - using .join() pattern
    headersGroup
      .selectAll<SVGGElement, HeaderDescriptor>('.row-header')
      .data(headerTree.rows, d => d.id)
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', 'row-header')
            .style('cursor', 'pointer');

          g.append('rect')
            .attr('stroke', '#bbb')
            .attr('stroke-width', 1);

          g.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('user-select', 'none');

          // Add click handler for header selection
          g.on('click', (_event, d) => {
            if (onHeaderClick) {
              onHeaderClick(d);
            }
          });

          return g;
        },
        update => update,
        exit => exit.remove()
      )
      .attr('transform', d => `translate(${d.position.x}, ${d.position.y + totalColumnHeaderHeight})`)
      .each(function(d) {
        const g = _d3.select(this);

        g.select('rect')
          .attr('width', d.position.width)
          .attr('height', d.position.height)
          .attr('fill', d.isLeaf ? '#f5f5f5' : '#e8e8e8');

        g.select('text')
          .attr('x', d.position.width / 2)
          .attr('y', d.position.height / 2)
          .style('font-size', d.isLeaf ? '11px' : '12px')
          .style('font-weight', d.isLeaf ? 'normal' : '500')
          .text(d.value);
      });
  }

  /**
   * Render grid cells with data
   */
  private renderCells(
    _d3: typeof import('d3'),
    currentCells: CellDescriptor[],
    gridDimensions: GridDimensions,
    allNodes: Node[]
  ): void {
    if (!this.svg) return;

    const cellsGroup = this.svg.select('.cells');

    const cells = cellsGroup
      .selectAll<SVGGElement, CellDescriptor>('.cell')
      .data(currentCells, d => d.id);

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
        if (this.onCellClick) {
          const nodes = allNodes.filter(n => d.nodeIds.includes(n.id));
          this.onCellClick(d, nodes);
        }
      });

    cells.merge(cellEnter)
      .attr('transform', d => `translate(${d.gridX * gridDimensions.cellWidth + gridDimensions.headerWidth}, ${d.gridY * gridDimensions.cellHeight + gridDimensions.headerHeight})`)
      .select('rect')
      .attr('width', gridDimensions.cellWidth - 2)
      .attr('height', gridDimensions.cellHeight - 2);

    cells.merge(cellEnter)
      .select('text')
      .attr('x', gridDimensions.cellWidth / 2)
      .attr('y', gridDimensions.cellHeight / 2)
      .text(d => `${d.nodeCount} items`);

    cells.exit().remove();
  }

  /**
   * Update selection indicators
   */
  async updateSelection(
    currentCells: CellDescriptor[],
    selectionState: SelectionState,
    gridDimensions: GridDimensions
  ): Promise<void> {
    if (!this.svg) return;

    await import('d3');
    const selectionGroup = this.svg.select('.selection');

    // Clear existing selection indicators
    selectionGroup.selectAll('.selection-indicator').remove();

    // Add selection indicators for selected cells
    const selectedCells = currentCells.filter(c => selectionState.selectedCells.has(c.id));

    selectionGroup
      .selectAll('.selection-indicator')
      .data(selectedCells)
      .enter()
      .append('rect')
      .attr('class', 'selection-indicator')
      .attr('x', d => d.gridX * gridDimensions.cellWidth + gridDimensions.headerWidth)
      .attr('y', d => d.gridY * gridDimensions.cellHeight + gridDimensions.headerHeight)
      .attr('width', gridDimensions.cellWidth - 2)
      .attr('height', gridDimensions.cellHeight - 2)
      .attr('fill', 'none')
      .attr('stroke', '#007acc')
      .attr('stroke-width', 2)
      .style('pointer-events', 'none');
  }

  /**
   * Update viewport transform
   */
  updateViewport(x: number, y: number, scale: number): void {
    if (!this.svg) return;

    this.svg.select('.supergrid-main')
      .attr('transform', `translate(${x}, ${y}) scale(${scale})`);
  }

  /**
   * Clean up and remove SVG
   */
  destroy(): void {
    if (this.svg) {
      this.svg.remove();
    }
    this.svg = null;
  }
}