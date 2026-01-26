import * as d3 from 'd3';
import type { D3AreaGenerator } from '../../../types/d3';
import type { ChartRendererParams } from './types';
import type { ChartDatum } from '../../../types/d3';

export function renderAreaChart({
  g,
  data,
  config,
  dimensions,
  colors
}: ChartRendererParams): void {
  // Similar to line chart but with filled area
  const { innerWidth, innerHeight } = dimensions;
  const { x: xField, y: yField } = config.axes;

  if (!xField || !yField) return;

  const sortedData = [...data].sort((a, b) => (a[xField] as number) - (b[xField] as number));

  const x = (() => {
    const extent = d3.extent(sortedData, d => d[xField] as number);
    const domain = extent[0] != null && extent[1] != null ? extent as [number, number] : [0, 1];
    return d3.scaleLinear().domain(domain).range([0, innerWidth]);
  })();

  const y = d3.scaleLinear()
    .domain([0, d3.max(sortedData, d => d[yField]) || 0])
    .range([innerHeight, 0]);

  const area: D3AreaGenerator<ChartDatum> = d3.area<ChartDatum>()
    .x(d => x(d[xField] as number))
    .y0(innerHeight)
    .y1(d => y(d[yField] as number))
    .curve(d3.curveMonotoneX);

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .style('color', colors.text);

  g.append('g')
    .call(d3.axisLeft(y))
    .style('color', colors.text);

  // Area
  g.append('path')
    .datum(sortedData)
    .attr('fill', colors.primary)
    .attr('fill-opacity', 0.3)
    .attr('stroke', colors.primary)
    .attr('stroke-width', 2)
    .attr('d', area);
}