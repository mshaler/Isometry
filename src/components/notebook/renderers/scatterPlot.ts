import * as d3 from 'd3';
import type { ChartRendererParams } from './types';

export function renderScatterPlot({
  g,
  data,
  config,
  dimensions,
  colors
}: ChartRendererParams): void {
  const { innerWidth, innerHeight } = dimensions;
  const { x: xField, y: yField, size: sizeField } = config.axes;

  if (!xField || !yField) return;

  // Scales
  const x = (() => {
    const extent = d3.extent(data, d => d[xField] as number);
    const domain = extent[0] != null && extent[1] != null ? extent as [number, number] : [0, 1];
    return d3.scaleLinear().domain(domain).range([0, innerWidth]);
  })();

  const y = (() => {
    const extent = d3.extent(data, d => d[yField] as number);
    const domain = extent[0] != null && extent[1] != null ? extent as [number, number] : [0, 1];
    return d3.scaleLinear().domain(domain).range([innerHeight, 0]);
  })();

  const size = sizeField
    ? (() => {
        const extent = d3.extent(data, d => d[sizeField] as number);
        const domain = extent[0] != null && extent[1] != null ? extent as [number, number] : [3, 12];
        return d3.scaleLinear().domain(domain).range([3, 12]);
      })()
    : () => 6;

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .style('color', colors.text);

  g.append('g')
    .call(d3.axisLeft(y))
    .style('color', colors.text);

  // Points
  g.selectAll('.dot')
    .data(data)
    .enter().append('circle')
    .attr('class', 'dot')
    .attr('cx', d => x(d[xField] as number))
    .attr('cy', d => y(d[yField] as number))
    .attr('r', d => sizeField ? size(d[sizeField] as number) : 6)
    .style('fill', colors.primary)
    .style('fill-opacity', 0.7)
    .style('stroke', colors.border)
    .style('stroke-width', 1);
}