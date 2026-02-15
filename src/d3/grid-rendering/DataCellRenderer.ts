/**
 * DataCellRenderer - D3-based data cell rendering with coordinate system integration
 *
 * Part of Phase 92 - Data Cell Integration (CELL-01)
 * Renders data cells at positions computed by the coordinate system
 */

import * as d3 from 'd3';
import type { DataCellData, D3CoordinateSystem } from '@/types/grid';
import type { Node } from '@/types/node';
import type { JanusDensityState } from '@/types/density-control';
import { CellDataService } from '@/services/supergrid/CellDataService';

/**
 * Options for cell rendering
 */
export interface DataCellRenderOptions {
  /** Callback when a cell is clicked */
  onCellClick?: (node: Node) => void;
  /** Transition duration in milliseconds (default: 300) */
  transitionDuration?: number;
  /** Janus density state for density-aware rendering */
  densityState?: JanusDensityState;
}

/**
 * DataCellRenderer - Renders data cells using D3 with coordinate system positioning
 *
 * This renderer:
 * 1. Uses D3's .join() pattern for enter/update/exit
 * 2. Positions cells using coordinateSystem.logicalToScreen()
 * 3. Handles hover effects and click events
 * 4. Animates position changes smoothly
 */
export class DataCellRenderer {
  private coordinateSystem: D3CoordinateSystem;
  private cellDataService: CellDataService;

  constructor(coordinateSystem: D3CoordinateSystem) {
    this.coordinateSystem = coordinateSystem;
    this.cellDataService = new CellDataService();
  }

  /**
   * Render data cells to a D3 container
   *
   * @param container - D3 selection of the SVG group for data cells
   * @param cells - Array of cell data with logical coordinates
   * @param options - Rendering options (callbacks, transitions, density state)
   */
  render(
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    cells: DataCellData[],
    options: DataCellRenderOptions = {}
  ): void {
    if (!container || !cells) return;

    const densityState = options.densityState;

    // Determine rendering mode based on density state
    const isCollapsedMode = densityState?.valueDensity === 'collapsed';

    // Apply aggregation if in collapsed mode
    const renderCells = isCollapsedMode
      ? this.cellDataService.aggregateCellsByPosition(cells)
      : cells;

    // Choose rendering function based on mode
    if (isCollapsedMode) {
      this.renderCollapsedMode(container, renderCells, options);
    } else {
      this.renderLeafMode(container, renderCells, options);
    }
  }

  /**
   * Render cells in leaf mode (individual card text)
   *
   * @param container - D3 selection of the SVG group for data cells
   * @param cells - Array of cell data with logical coordinates
   * @param options - Rendering options
   */
  private renderLeafMode(
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    cells: DataCellData[],
    options: DataCellRenderOptions
  ): void {
    const transitionDuration = options.transitionDuration ?? 300;

    // D3 data binding with key function for stable identity
    const cellGroups = container
      .selectAll<SVGGElement, DataCellData>('.data-cell')
      .data(cells, d => d.id)
      .join(
        // ENTER: Create new cell elements
        enter => {
          const group = enter
            .append('g')
            .attr('class', 'data-cell')
            .attr('data-node-id', d => d.node.id)
            .style('cursor', 'pointer')
            .style('opacity', 0); // Start invisible for fade-in

          // Cell background
          group
            .append('rect')
            .attr('class', 'cell-bg')
            .attr('fill', '#ffffff')
            .attr('stroke', '#e5e7eb')
            .attr('stroke-width', 1)
            .attr('rx', 2); // Slight border radius

          // Cell text (truncated if too long)
          group
            .append('text')
            .attr('class', 'cell-text')
            .attr('fill', '#1f2937')
            .attr('font-size', '11px')
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'hanging');

          // Hover effect
          group
            .on('mouseenter', function () {
              d3.select(this)
                .select('.cell-bg')
                .attr('fill', '#f9fafb')
                .attr('stroke', '#3b82f6')
                .attr('stroke-width', 2);
            })
            .on('mouseleave', function () {
              d3.select(this)
                .select('.cell-bg')
                .attr('fill', '#ffffff')
                .attr('stroke', '#e5e7eb')
                .attr('stroke-width', 1);
            });

          // Click handler
          if (options.onCellClick) {
            group.on('click', function (event, d) {
              event.stopPropagation();
              options.onCellClick!(d.node);
            });
          }

          // Fade in new cells
          group
            .transition()
            .duration(transitionDuration)
            .ease(d3.easeCubicInOut)
            .style('opacity', 1);

          return group;
        },
        // UPDATE: Update existing elements (position will be updated below)
        update => update,
        // EXIT: Remove old elements with fade-out
        exit => {
          exit
            .transition()
            .duration(200)
            .ease(d3.easeCubicOut)
            .style('opacity', 0)
            .remove();
          return exit;
        }
      );

    // Position and update all cells with smooth transitions
    this.updatePositions(cellGroups, transitionDuration);

    // Performance optimization: Add will-change for zoom transforms
    container.style('will-change', 'transform');
  }

  /**
   * Render cells in collapsed mode (count badges)
   *
   * Renders aggregated cells as circles with count badges instead of rectangles with text
   *
   * @param container - D3 selection of the SVG group for data cells
   * @param cells - Array of aggregated cell data
   * @param options - Rendering options
   */
  private renderCollapsedMode(
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    cells: DataCellData[],
    options: DataCellRenderOptions
  ): void {
    const transitionDuration = options.transitionDuration ?? 300;

    // D3 data binding with key function for stable identity
    const cellGroups = container
      .selectAll<SVGGElement, DataCellData>('.data-cell')
      .data(cells, d => d.id)
      .join(
        // ENTER: Create new cell elements as circles
        enter => {
          const group = enter
            .append('g')
            .attr('class', 'data-cell data-cell--collapsed')
            .attr('data-node-id', d => d.node.id)
            .style('cursor', 'pointer')
            .style('opacity', 0); // Start invisible for fade-in

          // Cell circle background
          group
            .append('circle')
            .attr('class', 'cell-circle')
            .attr('fill', '#3b82f6')
            .attr('stroke', '#2563eb')
            .attr('stroke-width', 2)
            .attr('r', 20); // Default radius

          // Count badge text
          group
            .append('text')
            .attr('class', 'cell-count')
            .attr('fill', '#ffffff')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central');

          // Hover effect
          group
            .on('mouseenter', function () {
              d3.select(this)
                .select('.cell-circle')
                .attr('fill', '#2563eb')
                .attr('stroke', '#1d4ed8')
                .attr('stroke-width', 3);
            })
            .on('mouseleave', function () {
              d3.select(this)
                .select('.cell-circle')
                .attr('fill', '#3b82f6')
                .attr('stroke', '#2563eb')
                .attr('stroke-width', 2);
            });

          // Click handler
          if (options.onCellClick) {
            group.on('click', function (event, d) {
              event.stopPropagation();
              options.onCellClick!(d.node);
            });
          }

          // Fade in new cells
          group
            .transition()
            .duration(transitionDuration)
            .ease(d3.easeCubicInOut)
            .style('opacity', 1);

          return group;
        },
        // UPDATE: Update existing elements
        update => update,
        // EXIT: Remove old elements with fade-out
        exit => {
          exit
            .transition()
            .duration(200)
            .ease(d3.easeCubicOut)
            .style('opacity', 0)
            .remove();
          return exit;
        }
      );

    // Position and update all cells with smooth transitions
    this.updateCollapsedPositions(cellGroups, transitionDuration);

    // Performance optimization
    container.style('will-change', 'transform');
  }

  /**
   * Update positions of collapsed mode cells
   *
   * @param cellGroups - D3 selection of cell groups
   * @param transitionDuration - Duration of position transitions
   */
  private updateCollapsedPositions(
    cellGroups: d3.Selection<SVGGElement, DataCellData, SVGGElement, unknown>,
    transitionDuration: number
  ): void {
    const { cellWidth, cellHeight } = this.coordinateSystem;
    const coordinateSystem = this.coordinateSystem;

    cellGroups.each(function (this: SVGGElement, d: DataCellData) {
      const group = d3.select<SVGGElement, DataCellData>(this);
      const { x, y } = coordinateSystem.logicalToScreen(d.logicalX, d.logicalY);

      // Center the circle in the cell
      const cx = x + cellWidth / 2;
      const cy = y + cellHeight / 2;

      // Calculate radius based on aggregation count (larger for more items)
      const baseRadius = 20;
      const maxRadius = Math.min(cellWidth, cellHeight) / 3;
      const count = d.aggregationCount ?? 1;
      const radius = Math.min(baseRadius + Math.log2(count) * 5, maxRadius);

      // Transition circle position and size
      group
        .select<SVGCircleElement>('.cell-circle')
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeCubicInOut)
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', radius);

      // Transition text position and update count
      group
        .select<SVGTextElement>('.cell-count')
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeCubicInOut)
        .attr('x', cx)
        .attr('y', cy)
        .on('end', function () {
          // Update count text after position transition completes
          const textElement = this as SVGTextElement;
          textElement.textContent = String(count);
        })
        .text(String(count));
    });
  }

  /**
   * Update positions of existing cells
   *
   * This method can be called independently when coordinate system changes
   * (e.g., zoom, pan) without recreating cell elements
   *
   * @param cellGroups - D3 selection of cell groups
   * @param transitionDuration - Duration of position transitions
   */
  updatePositions(
    cellGroups: d3.Selection<SVGGElement, DataCellData, SVGGElement, unknown>,
    transitionDuration: number = 300
  ): void {
    const { cellWidth, cellHeight } = this.coordinateSystem;
    const coordinateSystem = this.coordinateSystem;

    cellGroups.each(function (this: SVGGElement, d: DataCellData) {
      const group = d3.select<SVGGElement, DataCellData>(this);
      const { x, y } = coordinateSystem.logicalToScreen(d.logicalX, d.logicalY);

      // Transition rectangle position (smooth axis change animation)
      group
        .select<SVGRectElement>('.cell-bg')
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeCubicInOut)
        .attr('x', x)
        .attr('y', y)
        .attr('width', cellWidth - 2) // -2 for visual gap between cells
        .attr('height', cellHeight - 2);

      // Transition text position and update content
      const maxTextWidth = cellWidth - 12; // Padding on both sides
      group
        .select<SVGTextElement>('.cell-text')
        .transition()
        .duration(transitionDuration)
        .ease(d3.easeCubicInOut)
        .attr('x', x + 6) // 6px left padding
        .attr('y', y + 6) // 6px top padding
        .on('end', function () {
          // Update text content after position transition completes
          const textElement = this as SVGTextElement;
          let text = d.value;
          textElement.textContent = text;

          // Truncate text if it exceeds cell width
          while (textElement.getComputedTextLength() > maxTextWidth && text.length > 0) {
            text = text.slice(0, -1);
            textElement.textContent = text + '…';
          }
        })
        .text(d.value);
    });
  }
}

/**
 * Standalone render function for simple usage
 *
 * @param container - D3 selection of the SVG group for data cells
 * @param cells - Array of cell data
 * @param coordinateSystem - Coordinate system for positioning
 * @param options - Rendering options
 */
export function renderDataCellsToContainer(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  cells: DataCellData[],
  coordinateSystem: D3CoordinateSystem,
  options: DataCellRenderOptions = {}
): void {
  const renderer = new DataCellRenderer(coordinateSystem);
  renderer.render(container, cells, options);
}
