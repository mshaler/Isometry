import * as d3 from 'd3';
import type { ChartRendererParams } from './types';

export function renderHistogram({
  g,
  data,
  config,
  dimensions,
  colors
}: ChartRendererParams): void {
  const { innerWidth, innerHeight } = dimensions;
  const { x: xField } = config.axes;

  if (!xField) return;

  const values = data.map(d => d[xField]).filter(v => typeof v === 'number') as number[];

  // Create histogram with safe extent handling
  const extent = d3.extent(values);
  const safeDomain: [number, number] = extent[0] != null && extent[1] != null ?
    extent as [number, number] :
    [0, Math.max(1, Math.max(...values) || 1)];

  const histogram = d3.histogram<number, number>()
    .value(d => d)
    .domain(safeDomain)
    .thresholds(Math.min(20, Math.sqrt(values.length)));

  const bins = histogram(values);

  // Scales
  const x = d3.scaleLinear()
    .domain(safeDomain)
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, (d: d3.Bin<number, number>) => d.length) || 0])
    .range([innerHeight, 0]);

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .style('color', colors.text);

  g.append('g')
    .call(d3.axisLeft(y))
    .style('color', colors.text);

  // Bars with safe bin property access
  g.selectAll('.bar')
    .data(bins)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', (d: d3.Bin<number, number>) => {
      const x0 = d.x0;
      return x(x0 !== undefined ? x0 : 0);
    })
    .attr('width', (d: d3.Bin<number, number>) => {
      const x0 = d.x0;
      const x1 = d.x1;
      if (x0 === undefined || x1 === undefined) return 0;
      return Math.max(0, x(x1) - x(x0) - 1);
    })
    .attr('y', (d: d3.Bin<number, number>) => y(d.length))
    .attr('height', (d: d3.Bin<number, number>) => innerHeight - y(d.length))
    .style('fill', colors.primary)
    .style('stroke', colors.background)
    .style('stroke-width', 1);
}