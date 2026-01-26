import * as d3 from 'd3';
import type { D3PieGenerator, D3ArcGenerator, ChartDatum } from '../../../types/d3';
import type { ChartRendererParams } from './types';

export function renderPieChart({
  g,
  data,
  config,
  dimensions,
  colors
}: ChartRendererParams): void {
  const { innerWidth, innerHeight } = dimensions;
  const { x: categoryField, y: valueField } = config.axes;

  if (!categoryField || !valueField) return;

  const radius = Math.min(innerWidth, innerHeight) / 2;

  // Center the pie chart
  g.attr('transform', `translate(${innerWidth / 2}, ${innerHeight / 2})`);

  const pie: D3PieGenerator<ChartDatum> = d3.pie<ChartDatum>()
    .value(d => d[valueField] as number)
    .sort(null);

  const arc: D3ArcGenerator<d3.PieArcDatum<ChartDatum>> = d3.arc<d3.BaseType, d3.PieArcDatum<ChartDatum>>()
    .innerRadius(0)
    .outerRadius(radius);

  const color = d3.scaleOrdinal<string>()
    .domain(data.map(d => String(d[categoryField])))
    .range([colors.primary, colors.accent, colors.secondary, '#8b5cf6', '#10b981', '#f59e0b']);

  const arcs = g.selectAll('.arc')
    .data(pie(data))
    .enter().append('g')
    .attr('class', 'arc');

  arcs.append('path')
    .attr('d', arc)
    .style('fill', d => color(d.data[categoryField]))
    .style('stroke', colors.background)
    .style('stroke-width', 2);

  // Labels
  arcs.append('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .style('fill', colors.text)
    .style('font-size', '12px')
    .text(d => d.data[categoryField]);
}