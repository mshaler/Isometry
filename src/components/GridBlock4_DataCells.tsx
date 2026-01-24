import * as d3 from 'd3';
import type { Node } from '@/types/node';
import type { CoordinateSystem } from './D3SparsityLayer';

export interface DataCellData {
  id: string;
  node: Node;
  logicalX: number;
  logicalY: number;
  value: string;
}

export interface GridBlock4Props {
  container: d3.Selection<SVGGElement, unknown, null, undefined>;
  cells: DataCellData[];
  coordinateSystem: CoordinateSystem;
  onCellClick?: (node: Node) => void;
}

/**
 * GridBlock4_DataCells - Renders data cells using D3
 *
 * Part of the Sparsity Layer (z=0). Each cell shows individual card data at its (x, y) coordinate.
 * This is the core "truth at every coordinate" - no aggregation, no hiding.
 *
 * Performance considerations:
 * - Uses d3-selection .join() for efficient enter/update/exit
 * - CSS will-change: transform for zoom performance
 * - Key function prevents unnecessary DOM mutations
 *
 * @param container - D3 selection of the data-cells group
 * @param cells - Array of cell data (node + position)
 * @param coordinateSystem - Logical-to-screen coordinate mapping
 * @param onCellClick - Callback when cell is clicked (expands to Card at z=2)
 */
export function renderDataCells({
  container,
  cells,
  coordinateSystem,
  onCellClick,
}: GridBlock4Props): void {
  if (!container || !cells) return;

  const { cellWidth, cellHeight } = coordinateSystem;

  // D3 data binding with key function for stable identity
  const cellGroups = container
    .selectAll<SVGGElement, DataCellData>('.data-cell')
    .data(cells, d => d.id)
    .join(
      // ENTER: Create new cell elements
      enter => {
        const group = enter.append('g')
          .attr('class', 'data-cell')
          .attr('data-node-id', d => d.node.id)
          .style('cursor', 'pointer');

        // Cell background
        group.append('rect')
          .attr('class', 'cell-bg')
          .attr('fill', '#ffffff')
          .attr('stroke', '#e5e7eb')
          .attr('stroke-width', 1)
          .attr('rx', 2); // Slight border radius

        // Cell text (truncated if too long)
        group.append('text')
          .attr('class', 'cell-text')
          .attr('fill', '#1f2937')
          .attr('font-size', '11px')
          .attr('text-anchor', 'start')
          .attr('dominant-baseline', 'hanging');

        // Hover effect
        group
          .on('mouseenter', function() {
            d3.select(this).select('.cell-bg')
              .attr('fill', '#f9fafb')
              .attr('stroke', '#3b82f6')
              .attr('stroke-width', 2);
          })
          .on('mouseleave', function() {
            d3.select(this).select('.cell-bg')
              .attr('fill', '#ffffff')
              .attr('stroke', '#e5e7eb')
              .attr('stroke-width', 1);
          });

        // Click handler
        if (onCellClick) {
          group.on('click', function(event, d) {
            event.stopPropagation();
            onCellClick(d.node);
          });
        }

        return group;
      },
      // UPDATE: Update existing elements
      update => update,
      // EXIT: Remove old elements
      exit => exit.remove()
    );

  // Position and update all cells
  cellGroups.each(function(d) {
    const group = d3.select(this);
    const { x, y } = coordinateSystem.logicalToScreen(d.logicalX, d.logicalY);

    // Update rectangle position
    group.select<SVGRectElement>('.cell-bg')
      .attr('x', x)
      .attr('y', y)
      .attr('width', cellWidth - 2) // -2 for visual gap between cells
      .attr('height', cellHeight - 2);

    // Update text with truncation
    const maxTextWidth = cellWidth - 12; // Padding on both sides
    group.select<SVGTextElement>('.cell-text')
      .attr('x', x + 6) // 6px left padding
      .attr('y', y + 6) // 6px top padding
      .text(d.value)
      .each(function() {
        // Truncate text if too long
        const textElement = this as SVGTextElement;
        let text = d.value;
        textElement.textContent = text;

        while (textElement.getComputedTextLength() > maxTextWidth && text.length > 0) {
          text = text.slice(0, -1);
          textElement.textContent = text + '…';
        }
      });
  });

  // Performance optimization: Add will-change for zoom transforms
  container.style('will-change', 'transform');
}
