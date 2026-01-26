import * as d3 from 'd3';
import type { D3LineGenerator } from '../../../types/d3';
import type { ChartRendererParams } from './types';
import type { ChartDatum } from '../../../types/d3';

export function renderLineChart({
  g,
  data,
  config,
  dimensions,
  colors
}: ChartRendererParams): void {
  const { innerWidth, innerHeight } = dimensions;
  const { x: xField, y: yField } = config.axes;

  if (!xField || !yField) return;

  // Sort data by x field
  const sortedData = [...data].sort((a, b) => {
    const aVal = a[xField];
    const bVal = b[xField];

    // Handle null/undefined values
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return -1;
    if (bVal == null) return 1;

    if (aVal instanceof Date && bVal instanceof Date) {
      return aVal.getTime() - bVal.getTime();
    }
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  });

  // Scales
  const x = config.encoding.xType === 'temporal'
    ? (() => {
        const extent = d3.extent(sortedData, d => d[xField] as Date);
        const domain = extent[0] && extent[1] ? extent as [Date, Date] : [new Date(), new Date()];
        return d3.scaleTime().domain(domain).range([0, innerWidth]);
      })()
    : (() => {
        const extent = d3.extent(sortedData, d => d[xField] as number);
        const domain = extent[0] != null && extent[1] != null ? extent as [number, number] : [0, 1];
        return d3.scaleLinear().domain(domain).range([0, innerWidth]);
      })();

  const y = (() => {
    const extent = d3.extent(sortedData, d => d[yField] as number);
    const domain = extent[0] != null && extent[1] != null ? extent as [number, number] : [0, 1];
    return d3.scaleLinear().domain(domain).range([innerHeight, 0]);
  })();

  // Line generator
  const line: D3LineGenerator<ChartDatum> = d3.line<ChartDatum>()
    .x(d => x(d[xField] as number | Date) as number)
    .y(d => y(d[yField] as number) as number)
    .curve(d3.curveMonotoneX);

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(config.encoding.xType === 'temporal'
      ? d3.axisBottom(x as d3.ScaleTime<number, number>).tickFormat(d3.timeFormat('%m/%d') as (domainValue: Date | { valueOf(): number }) => string)
      : d3.axisBottom(x as d3.ScaleLinear<number, number>))
    .style('color', colors.text);

  g.append('g')
    .call(d3.axisLeft(y))
    .style('color', colors.text);

  // Line
  g.append('path')
    .datum(sortedData)
    .attr('fill', 'none')
    .attr('stroke', colors.primary)
    .attr('stroke-width', 2)
    .attr('d', line);

  // Data points
  g.selectAll('.dot')
    .data(sortedData)
    .enter().append('circle')
    .attr('class', 'dot')
    .attr('cx', d => x(d[xField] as number | Date) as number)
    .attr('cy', d => y(d[yField] as number) as number)
    .attr('r', 4)
    .style('fill', colors.primary)
    .style('stroke', colors.background)
    .style('stroke-width', 2);
}