import { useRef, useEffect, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useD3Visualization } from '../../hooks/useD3Visualization';
import { useTheme } from '../../contexts/ThemeContext';
import { useD3 } from '../../hooks/useD3';
import type { VisualizationConfig } from '../../utils/d3Parsers';
import type {
  D3SVGSelection,
  D3GroupSelection,
  ChartDatum,
  NetworkLinkDatum,
  D3ChartTheme,
  D3LineGenerator,
  D3AreaGenerator,
  D3PieGenerator,
  D3ArcGenerator,
  SimulationNodeDatum,
  SimulationLinkDatum,
  D3ForceSimulation
} from '../../types/d3';

interface D3VisualizationRendererProps {
  content?: string;
  width?: number;
  height?: number;
  className?: string;
  onDataPointsChange?: (count: number) => void;
}

// Use the imported D3 types instead of local definitions
type TooltipSelection = d3.Selection<HTMLDivElement, unknown, null, undefined>;

export function D3VisualizationRenderer({
  content,
  width = 600,
  height = 400,
  className = '',
  onDataPointsChange
}: D3VisualizationRendererProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    data,
    vizType,
    config,
    isLoading,
    error,
    canVisualize,
    updateVisualization
  } = useD3Visualization();

  // Update visualization when content changes
  useEffect(() => {
    if (content) {
      updateVisualization(content);
    }
  }, [content, updateVisualization]);

  // Notify parent of data points change
  useEffect(() => {
    onDataPointsChange?.(data.length);
  }, [data.length, onDataPointsChange]);

  // Get theme-appropriate colors
  const colors = useMemo((): D3ChartTheme => {
    if (theme === 'NeXTSTEP') {
      return {
        primary: '#0066cc',
        secondary: '#707070',
        accent: '#ff6600',
        text: '#000000',
        background: '#ffffff',
        border: '#707070',
        grid: '#d0d0d0'
      };
    } else {
      return {
        primary: '#3b82f6',
        secondary: '#6b7280',
        accent: '#f59e0b',
        text: '#111827',
        background: '#ffffff',
        border: '#e5e7eb',
        grid: '#f3f4f6'
      };
    }
  }, [theme]);

  // D3 render function based on visualization type
  const renderVisualization = useCallback((selection: D3SVGSelection) => {
    if (!canVisualize || data.length === 0) return;

    // Clear previous visualization
    selection.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = Math.max(100, height - margin.top - margin.bottom);

    const svg = selection
      .attr('width', width)
      .attr('height', height)
      .style('background', colors.background);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    try {
      switch (vizType) {
        case 'bar-chart':
          renderBarChart(g, data, config, { innerWidth, innerHeight }, colors);
          break;
        case 'line-chart':
          renderLineChart(g, data, config, { innerWidth, innerHeight }, colors);
          break;
        case 'scatter-plot':
          renderScatterPlot(g, data, config, { innerWidth, innerHeight }, colors);
          break;
        case 'histogram':
          renderHistogram(g, data, config, { innerWidth, innerHeight }, colors);
          break;
        case 'pie-chart':
          renderPieChart(g, data, config, { innerWidth, innerHeight }, colors);
          break;
        case 'area-chart':
          renderAreaChart(g, data, config, { innerWidth, innerHeight }, colors);
          break;
        case 'network-graph':
          renderNetworkGraph(g, data, config, { innerWidth, innerHeight }, colors);
          break;
        default:
          renderDefaultVisualization(g, { innerWidth, innerHeight }, colors);
      }
    } catch (renderError) {
      console.error('D3 rendering error:', renderError);
      renderErrorVisualization(g, renderError instanceof Error ? renderError.message : 'Rendering failed', { innerWidth, innerHeight }, colors);
    }

    // Add transition animations
    svg.selectAll('*')
      .style('opacity', 0)
      .transition()
      .duration(300)
      .style('opacity', 1);

  }, [canVisualize, data, vizType, config, width, height, colors]);

  // Use the existing useD3 hook for SVG management
  const svgRef = useD3(renderVisualization, [renderVisualization]);

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center`} style={{ width, height }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <div className="text-sm text-gray-600">Processing data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center`} style={{ width, height }}>
        <div className="text-center p-4">
          <div className="text-red-600 mb-2">⚠️</div>
          <div className="text-sm font-medium text-red-600 mb-1">Visualization Error</div>
          <div className="text-xs text-gray-500">{error}</div>
        </div>
      </div>
    );
  }

  if (!canVisualize) {
    return (
      <div className={`${className} flex items-center justify-center border-2 border-dashed ${colors.border} rounded`} style={{ width, height }}>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">📊</div>
          <div className="text-sm font-medium text-gray-700 mb-2">No Visualization Data</div>
          <div className="text-xs text-gray-500 mb-3">
            Add JSON data, CSV tables, or markdown tables to your card
          </div>
          <div className="text-xs text-gray-400">
            Example: ```json<br/>[{`{"category": "A", "value": 10}`}]<br/>```
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}

// D3 Rendering Functions

function renderBarChart(
  g: D3GroupSelection,
  data: ChartDatum[],
  config: VisualizationConfig,
  dimensions: { innerWidth: number; innerHeight: number },
  colors: D3ChartTheme
) {
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

function renderLineChart(
  g: D3GroupSelection,
  data: ChartDatum[],
  config: VisualizationConfig,
  dimensions: { innerWidth: number; innerHeight: number },
  colors: D3ChartTheme
) {
  const { innerWidth, innerHeight } = dimensions;
  const { x: xField, y: yField } = config.axes;

  if (!xField || !yField) return;

  // Sort data by x field
  const sortedData = [...data].sort((a, b) => {
    const aVal = a[xField];
    const bVal = b[xField];
    if (aVal instanceof Date && bVal instanceof Date) {
      return aVal.getTime() - bVal.getTime();
    }
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  });

  // Scales
  const x = config.encoding.xType === 'temporal'
    ? d3.scaleTime()
        .domain(d3.extent(sortedData, d => d[xField]) as [Date, Date])
        .range([0, innerWidth])
    : d3.scaleLinear()
        .domain(d3.extent(sortedData, d => d[xField]) as [number, number])
        .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain(d3.extent(sortedData, d => d[yField]) as [number, number])
    .range([innerHeight, 0]);

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
    .attr('cx', d => x(d[xField]) as number)
    .attr('cy', d => y(d[yField]) as number)
    .attr('r', 4)
    .style('fill', colors.primary)
    .style('stroke', colors.background)
    .style('stroke-width', 2);
}

function renderScatterPlot(
  g: D3GroupSelection,
  data: ChartDatum[],
  config: VisualizationConfig,
  dimensions: { innerWidth: number; innerHeight: number },
  colors: D3ChartTheme
) {
  const { innerWidth, innerHeight } = dimensions;
  const { x: xField, y: yField, size: sizeField } = config.axes;

  if (!xField || !yField) return;

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d[xField]) as [number, number])
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain(d3.extent(data, d => d[yField]) as [number, number])
    .range([innerHeight, 0]);

  const size = sizeField
    ? d3.scaleLinear()
        .domain(d3.extent(data, d => d[sizeField]) as [number, number])
        .range([3, 12])
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
    .attr('cx', d => x(d[xField]))
    .attr('cy', d => y(d[yField]))
    .attr('r', d => sizeField ? size(d[sizeField]) : 6)
    .style('fill', colors.primary)
    .style('fill-opacity', 0.7)
    .style('stroke', colors.border)
    .style('stroke-width', 1);
}

function renderHistogram(
  g: D3GroupSelection,
  data: ChartDatum[],
  config: VisualizationConfig,
  dimensions: { innerWidth: number; innerHeight: number },
  colors: D3ChartTheme
) {
  const { innerWidth, innerHeight } = dimensions;
  const { x: xField } = config.axes;

  if (!xField) return;

  const values = data.map(d => d[xField]).filter(v => typeof v === 'number');

  // Create histogram
  const histogram = d3.histogram()
    .value(d => d as number)
    .domain(d3.extent(values) as [number, number])
    .thresholds(Math.min(20, Math.sqrt(values.length)));

  const bins = histogram(values);

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(values) as [number, number])
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length) || 0])
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
    .data(bins)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', d => x(d.x0 || 0))
    .attr('width', d => Math.max(0, x(d.x1 || 0) - x(d.x0 || 0) - 1))
    .attr('y', d => y(d.length))
    .attr('height', d => innerHeight - y(d.length))
    .style('fill', colors.primary)
    .style('stroke', colors.background)
    .style('stroke-width', 1);
}

function renderPieChart(
  g: D3GroupSelection,
  data: ChartDatum[],
  config: VisualizationConfig,
  dimensions: { innerWidth: number; innerHeight: number },
  colors: D3ChartTheme
) {
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

function renderAreaChart(
  g: D3GroupSelection,
  data: ChartDatum[],
  config: VisualizationConfig,
  dimensions: { innerWidth: number; innerHeight: number },
  colors: D3ChartTheme
) {
  // Similar to line chart but with filled area
  const { innerWidth, innerHeight } = dimensions;
  const { x: xField, y: yField } = config.axes;

  if (!xField || !yField) return;

  const sortedData = [...data].sort((a, b) => a[xField] - b[xField]);

  const x = d3.scaleLinear()
    .domain(d3.extent(sortedData, d => d[xField]) as [number, number])
    .range([0, innerWidth]);

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

function renderNetworkGraph(
  g: D3GroupSelection,
  data: ChartDatum[],
  config: VisualizationConfig,
  dimensions: { innerWidth: number; innerHeight: number },
  colors: D3ChartTheme
) {
  // Simple network visualization for node-link data
  const { innerWidth, innerHeight } = dimensions;
  const { x: sourceField = 'source', y: targetField = 'target' } = config.axes;

  // Create nodes and links
  const nodeIds = new Set<string>();
  data.forEach(d => {
    nodeIds.add(d[sourceField] as string);
    nodeIds.add(d[targetField] as string);
  });

  interface NetworkSimulationNode extends SimulationNodeDatum {
    id: string;
  }

  interface NetworkSimulationLink extends SimulationLinkDatum<NetworkSimulationNode> {
    source: string | NetworkSimulationNode;
    target: string | NetworkSimulationNode;
  }

  const nodes: NetworkSimulationNode[] = Array.from(nodeIds).map(id => ({ id, x: 0, y: 0 }));
  const links: NetworkSimulationLink[] = data.map(d => ({
    source: d[sourceField] as string,
    target: d[targetField] as string
  }));

  const simulation: D3ForceSimulation<NetworkSimulationNode> = d3.forceSimulation(nodes)
    .force('link', d3.forceLink<NetworkSimulationNode, NetworkSimulationLink>(links).id((d: NetworkSimulationNode) => d.id))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2));

  // Links
  const link = g.selectAll('.link')
    .data(links)
    .enter().append('line')
    .attr('class', 'link')
    .style('stroke', colors.secondary)
    .style('stroke-width', 2);

  // Nodes
  const node = g.selectAll('.node')
    .data(nodes)
    .enter().append('circle')
    .attr('class', 'node')
    .attr('r', 8)
    .style('fill', colors.primary)
    .style('stroke', colors.background)
    .style('stroke-width', 2);

  // Update positions
  simulation.on('tick', () => {
    link
      .attr('x1', (d: NetworkSimulationLink) => (d.source as NetworkSimulationNode).x || 0)
      .attr('y1', (d: NetworkSimulationLink) => (d.source as NetworkSimulationNode).y || 0)
      .attr('x2', (d: NetworkSimulationLink) => (d.target as NetworkSimulationNode).x || 0)
      .attr('y2', (d: NetworkSimulationLink) => (d.target as NetworkSimulationNode).y || 0);

    node
      .attr('cx', (d: NetworkSimulationNode) => d.x || 0)
      .attr('cy', (d: NetworkSimulationNode) => d.y || 0);
  });

  // Stop simulation after a while to save CPU
  setTimeout(() => simulation.stop(), 3000);
}

function renderDefaultVisualization(
  g: D3GroupSelection,
  dimensions: { innerWidth: number; innerHeight: number },
  colors: D3ChartTheme
) {
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

function renderErrorVisualization(
  g: D3GroupSelection,
  error: string,
  dimensions: { innerWidth: number; innerHeight: number },
  colors: D3ChartTheme
) {
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