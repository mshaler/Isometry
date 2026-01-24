import * as d3 from 'd3';
import type { CoordinateSystem } from './D3SparsityLayer';

export interface ColumnHeaderData {
  id: string;
  label: string;
  logicalX: number;
  width: number;
}

export interface GridBlock2Props {
  container: d3.Selection<SVGGElement, unknown, null, undefined>;
  columns: ColumnHeaderData[];
  coordinateSystem: CoordinateSystem;
  headerHeight?: number;
}

/**
 * GridBlock2_ColumnHeaders - Renders column headers using D3
 *
 * Part of the Sparsity Layer (z=0). Each column header is an individual SVG cell.
 * Labels come from PAFV x-axis facet values.
 *
 * @param container - D3 selection of the column-headers group
 * @param columns - Array of column header data
 * @param coordinateSystem - Logical-to-screen coordinate mapping
 * @param headerHeight - Height of header cells in pixels
 */
export function renderColumnHeaders({
  container,
  columns,
  coordinateSystem,
  headerHeight = 40,
}: GridBlock2Props): void {
  if (!container || !columns) return;

  // D3 data binding using .join() pattern (D3 v7+)
  const headers = container
    .selectAll<SVGGElement, ColumnHeaderData>('.column-header')
    .data(columns, d => d.id)
    .join(
      // ENTER: Create new header elements
      enter => {
        const group = enter.append('g').attr('class', 'column-header');

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
          .attr('text-anchor', 'middle')
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
    const { x } = coordinateSystem.logicalToScreen(d.logicalX, 0);
    const screenWidth = d.width * coordinateSystem.cellWidth;

    // Update rectangle
    group.select<SVGRectElement>('.header-bg')
      .attr('x', x)
      .attr('y', 0)
      .attr('width', screenWidth)
      .attr('height', headerHeight);

    // Update text
    group.select<SVGTextElement>('.header-text')
      .attr('x', x + screenWidth / 2)
      .attr('y', headerHeight / 2)
      .text(d.label);
  });
}
