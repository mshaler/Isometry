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
        const group = enter.append('g')
          .attr('class', 'row-header')
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
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle');

        // Fade in with stagger delay (offset from columns)
        group.transition()
          .delay((_d, i) => 100 + i * 20) // 100ms after columns start, then 20ms stagger
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
    const { y } = coordinateSystem.logicalToScreen(0, d.logicalY);
    const screenHeight = d.height * coordinateSystem.cellHeight;

    // Transition rectangle position
    group.select<SVGRectElement>('.header-bg')
      .transition()
      .duration(300)
      .ease(d3.easeCubicInOut)
      .attr('x', 0)
      .attr('y', y)
      .attr('width', headerWidth)
      .attr('height', screenHeight);

    // Transition text position and update label
    group.select<SVGTextElement>('.header-text')
      .transition()
      .duration(300)
      .ease(d3.easeCubicInOut)
      .attr('x', headerWidth - 10) // 10px padding from right edge
      .attr('y', y + screenHeight / 2)
      .text(d.label);
  });
}
