import * as d3 from 'd3';
import type { ChartRendererParams } from './types';

type TooltipSelection = d3.Selection<HTMLDivElement, unknown, null, undefined>;

export function renderBarChart({
  g,
  data,
  config,
  dimensions,
  colors
}: ChartRendererParams): void {
  const { innerWidth, innerHeight } = dimensions;
  const { x: xField, y: yField } = config.axes;

  if (!xField || !yField) return;

  // Scales
  const x = d3.scaleBand()
    .domain(data.map(d => String(d[xField])))
    .range([0, innerWidth])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => Number(d[yField])) || 0])
    .range([innerHeight, 0]);

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .style('color', colors.text);

  g.append('g')
    .call(d3.axisLeft(y))
    .style('color', colors.text);

  // Bars
  g.selectAll('.bar')
    .data(data)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', d => x(String(d[xField])) || 0)
    .attr('width', x.bandwidth())
    .attr('y', d => y(Number(d[yField])))
    .attr('height', d => innerHeight - y(Number(d[yField])))
    .style('fill', colors.primary)
    .style('stroke', colors.border)
    .style('stroke-width', 1)
    .on('mouseover', function(event, d) {
      d3.select(this).style('fill', colors.accent);

      // Tooltip
      const tooltip = d3.select('body').append('div')
        .style('position', 'absolute')
        .style('background', colors.background)
        .style('border', `1px solid ${colors.border}`)
        .style('border-radius', '4px')
        .style('padding', '8px')
        .style('font-size', '12px')
        .style('color', colors.text)
        .style('pointer-events', 'none')
        .style('opacity', 0);

      tooltip.html(`${xField}: ${d[xField]}<br/>${yField}: ${d[yField]}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1);

      d3.select(this).datum(tooltip);
    })
    .on('mouseout', function() {
      d3.select(this).style('fill', colors.primary);
      const tooltip = d3.select(this).datum() as TooltipSelection;
      if (tooltip && typeof (tooltip as TooltipSelection).remove === 'function') {
        tooltip.transition()
          .duration(200)
          .style('opacity', 0)
          .remove();
      }
    });
}