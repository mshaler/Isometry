/**
 * SuperStack Renderer
 *
 * D3.js-based renderer for nested hierarchical headers.
 * Uses enter/update/exit pattern for efficient updates.
 *
 * Renders:
 * - Column headers (horizontal, multi-level at top)
 * - Row headers (vertical, multi-level at left)
 *
 * Each header displays:
 * - Background rectangle with depth-based color
 * - Label text (truncated to fit)
 * - Count badge (aggregate card count)
 * - Collapse indicator (for non-leaf nodes)
 */

import * as d3 from 'd3';
import type {
  HeaderNode,
  HeaderTree,
  SuperStackCallbacks,
  SuperStackDimensions,
} from '../types/superstack';
import { getHeaderColor } from '../config/superstack-defaults';
import { flattenTree } from '../builders/header-tree-builder';

export class SuperStackRenderer {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private rowHeaderGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private colHeaderGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private dimensions: SuperStackDimensions;
  private selectedId: string | null = null;
  private callbacks: SuperStackCallbacks = {};

  constructor(container: HTMLElement, dimensions: SuperStackDimensions) {
    this.dimensions = dimensions;

    // Create SVG
    this.svg = d3
      .select(container)
      .append('svg')
      .attr('class', 'superstack');

    // Create header groups
    this.colHeaderGroup = this.svg.append('g').attr('class', 'col-headers');
    this.rowHeaderGroup = this.svg.append('g').attr('class', 'row-headers');
  }

  /**
   * Render the complete SuperStack headers.
   */
  render(rowTree: HeaderTree, colTree: HeaderTree): void {
    // Calculate total dimensions
    const rowHeaderWidth =
      rowTree.maxDepth * this.dimensions.rowHeaderLevelWidth;
    const colHeaderHeight =
      colTree.maxDepth * this.dimensions.colHeaderLevelHeight;
    const dataWidth =
      colTree.leafCount * this.dimensions.cellMinWidth * this.dimensions.zoom;
    const dataHeight =
      rowTree.leafCount * this.dimensions.cellMinHeight * this.dimensions.zoom;

    // Size SVG
    this.svg
      .attr('width', rowHeaderWidth + dataWidth)
      .attr('height', colHeaderHeight + dataHeight);

    // Position header groups
    this.colHeaderGroup.attr('transform', `translate(${rowHeaderWidth}, 0)`);
    this.rowHeaderGroup.attr('transform', `translate(0, ${colHeaderHeight})`);

    // Render headers
    this.renderColumnHeaders(colTree);
    this.renderRowHeaders(rowTree);
  }

  /**
   * Render column headers (horizontal, multi-level).
   */
  private renderColumnHeaders(tree: HeaderTree): void {
    const levelHeight = this.dimensions.colHeaderLevelHeight;
    const cellWidth = this.dimensions.cellMinWidth * this.dimensions.zoom;

    // Flatten all visible nodes for data binding
    const allNodes = flattenTree(tree.roots);

    // Bind data with key function
    const headers = this.colHeaderGroup
      .selectAll<SVGGElement, HeaderNode>('.col-header')
      .data(allNodes, (d) => d.id);

    // Enter: create new header groups
    const headersEnter = headers
      .enter()
      .append('g')
      .attr('class', 'col-header')
      .attr('data-depth', (d) => d.depth)
      .attr('data-id', (d) => d.id);

    headersEnter.append('rect').attr('class', 'header-bg');
    headersEnter.append('text').attr('class', 'header-label');
    headersEnter.append('text').attr('class', 'header-count');

    // Collapse indicator for non-leaf nodes
    headersEnter
      .filter((d) => d.children.length > 0)
      .append('path')
      .attr('class', 'collapse-indicator');

    // Merge enter + update
    const headersMerge = headersEnter.merge(headers);

    // Position headers
    headersMerge
      .attr('transform', (d) => {
        const x = d.startIndex * cellWidth;
        const y = d.depth * levelHeight;
        return `translate(${x}, ${y})`;
      })
      .classed('collapsed', (d) => d.collapsed)
      .classed('selected', (d) => d.id === this.selectedId);

    // Background rectangle
    headersMerge
      .select<SVGRectElement>('.header-bg')
      .attr('width', (d) => d.span * cellWidth)
      .attr('height', levelHeight)
      .attr('fill', (d) => getHeaderColor(d.depth))
      .attr('stroke', '#ddd')
      .attr('stroke-width', 1);

    // Label text (centered)
    headersMerge
      .select<SVGTextElement>('.header-label')
      .attr('x', (d) => (d.span * cellWidth) / 2)
      .attr('y', levelHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#333')
      .text((d) => this.truncateLabel(d.label, d.span * cellWidth - 20));

    // Count badge (bottom-right)
    headersMerge
      .select<SVGTextElement>('.header-count')
      .attr('x', (d) => d.span * cellWidth - 8)
      .attr('y', levelHeight - 6)
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('fill', '#888')
      .text((d) => (d.aggregate?.count ? String(d.aggregate.count) : ''));

    // Collapse indicator
    headersMerge
      .select<SVGPathElement>('.collapse-indicator')
      .attr('d', (d) => (d.collapsed ? 'M4,0 L8,4 L4,8' : 'M0,4 L8,4'))
      .attr('transform', `translate(4, ${levelHeight / 2 - 4})`)
      .attr('fill', 'none')
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5);

    // Exit: remove old headers
    headers.exit().remove();

    // Event handlers
    headersMerge.on('click', (event: MouseEvent, d: HeaderNode) => {
      event.stopPropagation();
      const target = event.target as SVGElement;
      if (
        d.children.length > 0 &&
        target.classList.contains('collapse-indicator')
      ) {
        this.callbacks.onHeaderCollapse?.(d);
      } else {
        this.callbacks.onHeaderClick?.(d);
      }
    });
  }

  /**
   * Render row headers (vertical, multi-level).
   */
  private renderRowHeaders(tree: HeaderTree): void {
    const levelWidth = this.dimensions.rowHeaderLevelWidth;
    const cellHeight = this.dimensions.cellMinHeight * this.dimensions.zoom;

    const allNodes = flattenTree(tree.roots);

    const headers = this.rowHeaderGroup
      .selectAll<SVGGElement, HeaderNode>('.row-header')
      .data(allNodes, (d) => d.id);

    const headersEnter = headers
      .enter()
      .append('g')
      .attr('class', 'row-header')
      .attr('data-depth', (d) => d.depth)
      .attr('data-id', (d) => d.id);

    headersEnter.append('rect').attr('class', 'header-bg');
    headersEnter.append('text').attr('class', 'header-label');
    headersEnter.append('text').attr('class', 'header-count');

    headersEnter
      .filter((d) => d.children.length > 0)
      .append('path')
      .attr('class', 'collapse-indicator');

    const headersMerge = headersEnter.merge(headers);

    // Position headers
    headersMerge
      .attr('transform', (d) => {
        const x = d.depth * levelWidth;
        const y = d.startIndex * cellHeight;
        return `translate(${x}, ${y})`;
      })
      .classed('collapsed', (d) => d.collapsed)
      .classed('selected', (d) => d.id === this.selectedId);

    // Background rectangle
    headersMerge
      .select<SVGRectElement>('.header-bg')
      .attr('width', levelWidth)
      .attr('height', (d) => d.span * cellHeight)
      .attr('fill', (d) => getHeaderColor(d.depth))
      .attr('stroke', '#ddd')
      .attr('stroke-width', 1);

    // Row labels are left-aligned with padding
    headersMerge
      .select<SVGTextElement>('.header-label')
      .attr('x', 8)
      .attr('y', (d) => Math.min(14, (d.span * cellHeight) / 2))
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#333')
      .text((d) => this.truncateLabel(d.label, levelWidth - 24));

    // Count badge on the right
    headersMerge
      .select<SVGTextElement>('.header-count')
      .attr('x', levelWidth - 8)
      .attr('y', (d) => Math.min(14, (d.span * cellHeight) / 2))
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#888')
      .text((d) => (d.aggregate?.count ? String(d.aggregate.count) : ''));

    // Collapse indicator (rotated for row headers)
    headersMerge
      .select<SVGPathElement>('.collapse-indicator')
      .attr('d', (d) => (d.collapsed ? 'M0,4 L4,0 L8,4' : 'M0,0 L4,4 L8,0'))
      .attr(
        'transform',
        (d) =>
          `translate(${levelWidth - 16}, ${Math.min(10, (d.span * cellHeight) / 2 - 4)})`
      )
      .attr('fill', 'none')
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5);

    headers.exit().remove();

    headersMerge.on('click', (event: MouseEvent, d: HeaderNode) => {
      event.stopPropagation();
      const target = event.target as SVGElement;
      if (
        d.children.length > 0 &&
        target.classList.contains('collapse-indicator')
      ) {
        this.callbacks.onHeaderCollapse?.(d);
      } else {
        this.callbacks.onHeaderClick?.(d);
      }
    });
  }

  /**
   * Truncate label to fit available width.
   */
  private truncateLabel(label: string, maxWidth: number): string {
    // Rough estimate: ~7px per character
    const maxChars = Math.floor(maxWidth / 7);
    if (label.length <= maxChars) return label;
    return label.substring(0, maxChars - 1) + '…';
  }

  /**
   * Set callbacks for interactions.
   */
  setCallbacks(callbacks: SuperStackCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Update dimensions and trigger re-layout.
   */
  setDimensions(dimensions: SuperStackDimensions): void {
    this.dimensions = dimensions;
  }

  /**
   * Set selected header (highlights visually).
   */
  setSelected(id: string | null): void {
    this.selectedId = id;
    // Update visual selection state
    this.rowHeaderGroup
      .selectAll<SVGGElement, HeaderNode>('.row-header')
      .classed('selected', (d) => d.id === id);
    this.colHeaderGroup
      .selectAll<SVGGElement, HeaderNode>('.col-header')
      .classed('selected', (d) => d.id === id);
  }

  /**
   * Get the total row header width for layout.
   */
  getRowHeaderWidth(tree: HeaderTree): number {
    return tree.maxDepth * this.dimensions.rowHeaderLevelWidth;
  }

  /**
   * Get the total column header height for layout.
   */
  getColHeaderHeight(tree: HeaderTree): number {
    return tree.maxDepth * this.dimensions.colHeaderLevelHeight;
  }

  /**
   * Clean up and remove SVG.
   */
  destroy(): void {
    this.svg.remove();
  }
}
