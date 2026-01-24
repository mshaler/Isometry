import * as d3 from 'd3';
import type { CoordinateSystem } from './D3SparsityLayer';

export interface RowHeaderData {
  id: string;
  label: string;
  logicalY: number;
  height: number;
}

export interface GridBlock3Props {
  container: d3.Selection<SVGGElement, unknown, null, undefined>;
  rows: RowHeaderData[];
  coordinateSystem: CoordinateSystem;
  headerWidth?: number;
}

/**
 * GridBlock3_RowHeaders - Renders row headers using D3
 *
 * Part of the Sparsity Layer (z=0). Each row header is an individual SVG cell.
 * Labels come from PAFV y-axis facet values.
 *
 * @param container - D3 selection of the row-headers group
 * @param rows - Array of row header data
 * @param coordinateSystem - Logical-to-screen coordinate mapping
 * @param headerWidth - Width of header cells in pixels
 */
export function renderRowHeaders({
  container,
  rows,
  coordinateSystem,
  headerWidth = 150,
}: GridBlock3Props): void {
  if (!container || !rows) return;

  // D3 data binding using .join() pattern (D3 v7+)
  const headers = container
    .selectAll<SVGGElement, RowHeaderData>('.row-header')
    .data(rows, d => d.id)
    .join(
      // ENTER: Create new header elements
      enter => {
        const group = enter.append('g').attr('class', 'row-header');

        // Background rectangle
        group.append('rect')
          .attr('class', 'header-bg')
          .attr('fill', '#f3f4f6')
          .attr('stroke', '#d1d5db')
          .attr('stroke-width', 1);

        // Label text
        group.append('text')
          .attr('class', 'header-text')
          .attr('fill', '#374151')
          .attr('font-size', '12px')
          .attr('font-weight', '500')
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle');

        return group;
      },
      // UPDATE: Update existing elements
      update => update,
      // EXIT: Remove old elements
      exit => exit.remove()
    );

  // Position and size all headers
  headers.each(function(d) {
    const group = d3.select(this);
    const { y } = coordinateSystem.logicalToScreen(0, d.logicalY);
    const screenHeight = d.height * coordinateSystem.cellHeight;

    // Update rectangle
    group.select<SVGRectElement>('.header-bg')
      .attr('x', 0)
      .attr('y', y)
      .attr('width', headerWidth)
      .attr('height', screenHeight);

    // Update text (right-aligned, vertically centered)
    group.select<SVGTextElement>('.header-text')
      .attr('x', headerWidth - 10) // 10px padding from right edge
      .attr('y', y + screenHeight / 2)
      .text(d.label);
  });
}
