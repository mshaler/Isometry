import type { D3GroupSelection, D3ChartTheme } from '../../../types/d3';
import type { RenderDimensions } from './types';

export function renderDefaultVisualization(
  g: D3GroupSelection,
  dimensions: RenderDimensions,
  colors: D3ChartTheme
): void {
  const { innerWidth, innerHeight } = dimensions;

  g.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('fill', colors.text)
    .style('font-size', '16px')
    .text('No visualization available');
}

export function renderErrorVisualization(
  g: D3GroupSelection,
  error: string,
  dimensions: RenderDimensions,
  colors: D3ChartTheme
): void {
  const { innerWidth, innerHeight } = dimensions;

  g.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight / 2 - 10)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('fill', '#ef4444')
    .style('font-size', '14px')
    .text('Visualization Error');

  g.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight / 2 + 15)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('fill', colors.secondary)
    .style('font-size', '12px')
    .text(error);
}