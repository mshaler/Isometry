import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import type { Node } from '@/types/node';

interface ChartsViewProps {
  data: Node[];
  onNodeClick?: (node: Node) => void;
}

type ChartType = 'bar' | 'pie' | 'treemap';
type GroupBy = 'folder' | 'status' | 'priority';

export function ChartsView({ data, onNodeClick }: ChartsViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [groupBy, setGroupBy] = useState<GroupBy>('folder');

  // Group data
  const groupedData = useMemo(() => {
    const groups = new Map<string, Node[]>();
    data.forEach(node => {
      let key: string;
      if (groupBy === 'priority') {
        key = `Priority ${node.priority}`;
      } else {
        key = node[groupBy] || 'Unknown';
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(node);
    });
    return Array.from(groups.entries())
      .map(([name, nodes]) => ({ name, count: nodes.length, nodes }))
      .sort((a, b) => b.count - a.count);
  }, [data, groupBy]);

  // Color scale
  const colorScale = useMemo(() => {
    return d3.scaleOrdinal<string>()
      .domain(groupedData.map(d => d.name))
      .range(theme === 'NeXTSTEP'
        ? ['#808080', '#606060', '#a0a0a0', '#707070', '#909090', '#b0b0b0']
        : d3.schemeTableau10
      );
  }, [groupedData, theme]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !groupedData.length) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight - 50; // Leave room for controls
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg
      .attr('width', width)
      .attr('height', height);

    if (chartType === 'bar') {
      renderBarChart(svg, groupedData, width, height, margin, colorScale, theme, onNodeClick);
    } else if (chartType === 'pie') {
      renderPieChart(svg, groupedData, width, height, colorScale, theme, onNodeClick);
    } else if (chartType === 'treemap') {
      renderTreemap(svg, groupedData, width, height, colorScale, theme, onNodeClick);
    }

  }, [groupedData, chartType, theme, colorScale, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      {/* Chart controls */}
      <div className={`h-12 flex items-center gap-4 px-4 ${
        theme === 'NeXTSTEP' ? 'bg-[#c0c0c0]' : 'bg-gray-50'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600'}`}>Chart:</span>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            className={`h-7 px-2 text-sm ${
              theme === 'NeXTSTEP'
                ? 'bg-[#d4d4d4] border-2 border-[#707070]'
                : 'bg-white border border-gray-300 rounded'
            }`}
          >
            <option value="bar">Bar Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="treemap">Treemap</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600'}`}>Group by:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className={`h-7 px-2 text-sm ${
              theme === 'NeXTSTEP'
                ? 'bg-[#d4d4d4] border-2 border-[#707070]'
                : 'bg-white border border-gray-300 rounded'
            }`}
          >
            <option value="folder">Folder</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
          </select>
        </div>

        <div className={`ml-auto text-xs ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'}`}>
          {data.length} notes in {groupedData.length} groups
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  );
}

function renderBarChart(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  data: { name: string; count: number; nodes: Node[] }[],
  width: number,
  height: number,
  margin: { top: number; right: number; bottom: number; left: number },
  colorScale: d3.ScaleOrdinal<string, string>,
  theme: string,
  onNodeClick?: (node: Node) => void
) {
  const g = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = d3.scaleBand()
    .domain(data.map(d => d.name))
    .range([0, innerWidth])
    .padding(0.2);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count) || 0])
    .range([innerHeight, 0])
    .nice();

  // X-axis
  const xAxis = g.append('g')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(xScale));

  xAxis.selectAll('text')
    .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#6b7280')
    .attr('transform', 'rotate(-30)')
    .attr('text-anchor', 'end');
  xAxis.selectAll('line, path')
    .attr('stroke', theme === 'NeXTSTEP' ? '#808080' : '#d1d5db');

  // Y-axis
  const yAxis = g.append('g')
    .call(d3.axisLeft(yScale).ticks(5));

  yAxis.selectAll('text')
    .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#6b7280');
  yAxis.selectAll('line, path')
    .attr('stroke', theme === 'NeXTSTEP' ? '#808080' : '#d1d5db');

  // Bars
  g.append('g')
    .selectAll('rect')
    .data(data)
    .join('rect')
    .attr('x', d => xScale(d.name)!)
    .attr('y', d => yScale(d.count))
    .attr('width', xScale.bandwidth())
    .attr('height', d => innerHeight - yScale(d.count))
    .attr('fill', d => colorScale(d.name))
    .attr('rx', theme === 'NeXTSTEP' ? 0 : 4)
    .style('cursor', 'pointer')
    .on('click', (_event, d) => {
      // Click the first node in the group
      if (d.nodes.length > 0) {
        onNodeClick?.(d.nodes[0]);
      }
    })
    .on('mouseenter', function() {
      d3.select(this).attr('opacity', 0.8);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('opacity', 1);
    });

  // Labels
  g.append('g')
    .selectAll('text')
    .data(data)
    .join('text')
    .attr('x', d => xScale(d.name)! + xScale.bandwidth() / 2)
    .attr('y', d => yScale(d.count) - 5)
    .attr('text-anchor', 'middle')
    .attr('class', 'text-xs font-medium')
    .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#374151')
    .text(d => d.count);
}

function renderPieChart(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  data: { name: string; count: number; nodes: Node[] }[],
  width: number,
  height: number,
  colorScale: d3.ScaleOrdinal<string, string>,
  theme: string,
  onNodeClick?: (node: Node) => void
) {
  const radius = Math.min(width, height) / 2 - 60;
  const g = svg.append('g')
    .attr('transform', `translate(${width / 2}, ${height / 2})`);

  const pie = d3.pie<{ name: string; count: number; nodes: Node[] }>()
    .value(d => d.count)
    .sort(null);

  const arc = d3.arc<d3.PieArcDatum<{ name: string; count: number; nodes: Node[] }>>()
    .innerRadius(radius * 0.4)
    .outerRadius(radius);

  const outerArc = d3.arc<d3.PieArcDatum<{ name: string; count: number; nodes: Node[] }>>()
    .innerRadius(radius * 1.1)
    .outerRadius(radius * 1.1);

  // Slices
  g.append('g')
    .selectAll('path')
    .data(pie(data))
    .join('path')
    .attr('d', arc)
    .attr('fill', d => colorScale(d.data.name))
    .attr('stroke', theme === 'NeXTSTEP' ? '#404040' : '#ffffff')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('click', (_event, d) => {
      if (d.data.nodes.length > 0) {
        onNodeClick?.(d.data.nodes[0]);
      }
    })
    .on('mouseenter', function(_event: MouseEvent, d: d3.PieArcDatum<{ name: string; count: number; nodes: Node[] }>) {
      d3.select(this)
        .transition()
        .duration(100)
        .attr('transform', () => {
          const [x, y] = arc.centroid(d);
          const dist = 10;
          const angle = Math.atan2(y, x);
          return `translate(${Math.cos(angle) * dist}, ${Math.sin(angle) * dist})`;
        });
    })
    .on('mouseleave', function() {
      d3.select(this)
        .transition()
        .duration(100)
        .attr('transform', 'translate(0, 0)');
    });

  // Labels
  g.append('g')
    .selectAll('text')
    .data(pie(data))
    .join('text')
    .attr('transform', d => `translate(${outerArc.centroid(d)})`)
    .attr('text-anchor', d => {
      const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
      return midangle < Math.PI ? 'start' : 'end';
    })
    .attr('class', 'text-xs')
    .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#374151')
    .text(d => `${d.data.name} (${d.data.count})`);

  // Center label
  const total = data.reduce((sum, d) => sum + d.count, 0);
  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '-0.2em')
    .attr('class', 'text-2xl font-bold')
    .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#374151')
    .text(total);

  g.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '1.2em')
    .attr('class', 'text-xs')
    .attr('fill', theme === 'NeXTSTEP' ? '#606060' : '#6b7280')
    .text('Total');
}

function renderTreemap(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  data: { name: string; count: number; nodes: Node[] }[],
  width: number,
  height: number,
  colorScale: d3.ScaleOrdinal<string, string>,
  theme: string,
  onNodeClick?: (node: Node) => void
) {
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  // Create hierarchy
  interface TreemapData {
    children?: { name: string; count: number; nodes: Node[] }[];
  }

  const root = d3.hierarchy<TreemapData>({ children: data })
    .sum(d => {
      const item = d as unknown as { count?: number };
      return item.count || 0;
    })
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  const treemap = d3.treemap<TreemapData>()
    .size([innerWidth, innerHeight])
    .padding(2)
    .round(true);

  treemap(root);

  // Cells
  const cells = g.selectAll('g')
    .data(root.leaves())
    .join('g')
    .attr('transform', d => `translate(${(d as any).x0},${(d as any).y0})`);

  cells.append('rect')
    .attr('width', d => (d as any).x1 - (d as any).x0)
    .attr('height', d => (d as any).y1 - (d as any).y0)
    .attr('fill', d => colorScale((d.data as any).name))
    .attr('rx', theme === 'NeXTSTEP' ? 0 : 4)
    .attr('stroke', theme === 'NeXTSTEP' ? '#404040' : '#ffffff')
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('click', (_event, d) => {
      const nodes = (d.data as any).nodes as Node[];
      if (nodes && nodes.length > 0) {
        onNodeClick?.(nodes[0]);
      }
    })
    .on('mouseenter', function() {
      d3.select(this).attr('opacity', 0.8);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('opacity', 1);
    });

  // Labels
  cells.append('text')
    .attr('x', 4)
    .attr('y', 14)
    .attr('class', 'text-xs font-medium')
    .attr('fill', theme === 'NeXTSTEP' ? '#ffffff' : '#ffffff')
    .text(d => {
      const name = (d.data as any).name;
      const w = (d as any).x1 - (d as any).x0;
      if (w < 40) return '';
      if (w < 80) return name.slice(0, 5) + '...';
      return name;
    });

  cells.append('text')
    .attr('x', 4)
    .attr('y', 28)
    .attr('class', 'text-xs')
    .attr('fill', theme === 'NeXTSTEP' ? '#e0e0e0' : '#e5e7eb')
    .text(d => {
      const w = (d as any).x1 - (d as any).x0;
      if (w < 40) return '';
      return (d.data as any).count;
    });
}
