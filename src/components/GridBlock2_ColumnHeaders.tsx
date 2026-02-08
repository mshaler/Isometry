import * as d3 from 'd3';
import type { ColumnHeaderData, D3CoordinateSystem } from '@/types/grid';

export interface GridBlock2Props {
  container: d3.Selection<SVGGElement, unknown, null, undefined>;
  columns: ColumnHeaderData[];
  coordinateSystem: D3CoordinateSystem;
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
        const group = enter.append('g')
          .attr('class', 'column-header')
          .style('opacity', 0); // Fade in

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

        // Fade in with stagger delay
        group.transition()
          .delay((_d, i) => i * 20) // 20ms stagger
          .duration(300)
          .ease(d3.easeCubicInOut)
          .style('opacity', 1);

        return group;
      },
      // UPDATE: Update existing elements
      update => update,
      // EXIT: Remove old elements with fade out
      exit => {
        exit.transition()
          .duration(200)
          .ease(d3.easeCubicOut)
          .style('opacity', 0)
          .remove();
        return exit;
      }
    );

  // Position and size all headers with smooth transitions
  headers.each(function(d) {
    const group = d3.select(this);
    const { x } = coordinateSystem.logicalToScreen(d.logicalX, 0);
    const screenWidth = d.width * coordinateSystem.cellWidth;

    // Transition rectangle position
    group.select<SVGRectElement>('.header-bg')
      .transition()
      .duration(300)
      .ease(d3.easeCubicInOut)
      .attr('x', x)
      .attr('y', 0)
      .attr('width', screenWidth)
      .attr('height', headerHeight);

    // Transition text position and update label
    group.select<SVGTextElement>('.header-text')
      .transition()
      .duration(300)
      .ease(d3.easeCubicInOut)
      .attr('x', x + screenWidth / 2)
      .attr('y', headerHeight / 2)
      .text(d.label);
  });
}
