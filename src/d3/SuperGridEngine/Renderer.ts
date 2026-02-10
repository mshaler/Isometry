/**
 * SuperGridEngine Renderer - Handles D3.js rendering of grids
 */

import type { CellDescriptor, HeaderTree, HeaderDescriptor, GridDimensions, SelectionState, Node } from './types';
import { devLogger } from '../../utils/logging';

export class SuperGridRenderer {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private container: HTMLElement | null = null;
  private animationDuration: number;

  // Event callbacks
  private onCellClick?: (cell: CellDescriptor, nodes: Node[]) => void;
  private onRenderComplete?: (renderTime: number, cellCount: number) => void;

  constructor(animationDuration: number = 250) {
    this.animationDuration = animationDuration;
  }

  /**
   * Initialize SVG and set up basic structure
   */
  async setupSVG(container: HTMLElement, width: number, height: number, enableZoomPan: boolean): Promise<void> {
    this.container = container;

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
    onRenderComplete?: (renderTime: number, cellCount: number) => void;
  }): void {
    this.onCellClick = callbacks.onCellClick;
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
   * Render grid headers (columns and rows)
   */
  private renderHeaders(
    d3: typeof import('d3'),
    headerTree: HeaderTree,
    gridDimensions: GridDimensions
  ): void {
    if (!this.svg) return;

    const headersGroup = this.svg.select('.headers');

    // Column headers
    const columnHeaders = headersGroup
      .selectAll<SVGRectElement, HeaderDescriptor>('.column-header')
      .data(headerTree.columns, d => d.id);

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
      .attr('transform', (d: unknown) => `translate(${d.position.x + gridDimensions.headerWidth}, ${d.position.y})`);

    (mergedColumns.select('rect') as any)
      .attr('width', (d: unknown) => d.position.width)
      .attr('height', (d: unknown) => d.position.height);

    (mergedColumns.select('text') as any)
      .attr('x', (d: unknown) => d.position.width / 2)
      .attr('y', (d: unknown) => d.position.height / 2)
      .text((d: unknown) => d.value);

    columnHeaders.exit().remove();

    // Row headers
    const rowHeaders = headersGroup
      .selectAll<SVGRectElement, HeaderDescriptor>('.row-header')
      .data(headerTree.rows, d => d.id);

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
      .attr('transform', (d: unknown) => `translate(${d.position.x}, ${d.position.y + gridDimensions.headerHeight})`);

    (mergedRows.select('rect') as any)
      .attr('width', (d: unknown) => d.position.width)
      .attr('height', (d: unknown) => d.position.height);

    (mergedRows.select('text') as any)
      .attr('x', (d: unknown) => d.position.width / 2)
      .attr('y', (d: unknown) => d.position.height / 2)
      .text((d: unknown) => d.value);

    rowHeaders.exit().remove();
  }

  /**
   * Render grid cells with data
   */
  private renderCells(
    d3: typeof import('d3'),
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

    const d3 = await import('d3');
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
    this.container = null;
    this.svg = null;
  }
}