import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { usePAFV } from '@/contexts/PAFVContext';
import type { Node } from '@/types/node';

interface GridViewProps {
  data: Node[];
  onNodeClick?: (node: Node) => void;
}

// Map chip IDs to Node fields
const FIELD_MAP: Record<string, keyof Node> = {
  folder: 'folder',
  subfolder: 'status',
  tags: 'folder',
  year: 'createdAt',
  month: 'createdAt',
  category: 'folder',
  status: 'status',
  priority: 'priority',
};

function getFieldValue(node: Node, chipId: string): string {
  const field = FIELD_MAP[chipId] || 'folder';
  const value = node[field];

  if (field === 'createdAt' && value) {
    if (chipId === 'year') {
      return new Date(value as string).getFullYear().toString();
    }
    if (chipId === 'month') {
      return new Date(value as string).toLocaleString('default', { month: 'short' });
    }
  }

  return String(value ?? 'Unknown');
}

export function GridView({ data, onNodeClick }: GridViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const { wells } = usePAFV();

  // Get axis assignments from PAFV wells
  const xAxis = wells.xRows[0]?.id || 'folder';
  const yAxis = wells.yColumns[0]?.id || 'priority';

  // Group data by x and y axes
  const { xValues, yValues, grouped } = useMemo(() => {
    const xSet = new Set<string>();
    const ySet = new Set<string>();
    const map = new Map<string, Node[]>();

    data.forEach(node => {
      const xVal = getFieldValue(node, xAxis);
      const yVal = getFieldValue(node, yAxis);
      xSet.add(xVal);
      ySet.add(yVal);

      const key = `${xVal}|${yVal}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(node);
    });

    return {
      xValues: Array.from(xSet).sort(),
      yValues: Array.from(ySet).sort(),
      grouped: map,
    };
  }, [data, xAxis, yAxis]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 40, right: 20, bottom: 20, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Scales
    const xScale = d3.scaleBand()
      .domain(xValues)
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleBand()
      .domain(yValues)
      .range([0, innerHeight])
      .padding(0.1);

    // Main group with margin
    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid lines
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line.h')
      .data(yValues)
      .join('line')
      .attr('class', 'h')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => (yScale(d) || 0) + yScale.bandwidth())
      .attr('y2', d => (yScale(d) || 0) + yScale.bandwidth())
      .attr('stroke', theme === 'NeXTSTEP' ? '#a0a0a0' : '#e5e7eb')
      .attr('stroke-width', 1);

    g.selectAll('line.v')
      .data(xValues)
      .join('line')
      .attr('class', 'v')
      .attr('x1', d => (xScale(d) || 0) + xScale.bandwidth())
      .attr('x2', d => (xScale(d) || 0) + xScale.bandwidth())
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', theme === 'NeXTSTEP' ? '#a0a0a0' : '#e5e7eb')
      .attr('stroke-width', 1);

    // X axis labels (top)
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', 'translate(0,-10)')
      .selectAll('text')
      .data(xValues)
      .join('text')
      .attr('x', d => (xScale(d) || 0) + xScale.bandwidth() / 2)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-xs font-medium')
      .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#6b7280')
      .text(d => d);

    // Y axis labels (left)
    g.append('g')
      .attr('class', 'y-axis')
      .selectAll('text')
      .data(yValues)
      .join('text')
      .attr('x', -10)
      .attr('y', d => (yScale(d) || 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('class', 'text-xs font-medium')
      .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#6b7280')
      .text(d => d);

    // Cells with cards
    const cellWidth = xScale.bandwidth();
    const cellHeight = yScale.bandwidth();
    const cardWidth = Math.min(cellWidth * 0.9, 120);
    const cardHeight = Math.min(cellHeight * 0.8, 60);

    xValues.forEach(xVal => {
      yValues.forEach(yVal => {
        const nodes = grouped.get(`${xVal}|${yVal}`) || [];
        const cellX = xScale(xVal) || 0;
        const cellY = yScale(yVal) || 0;

        // Position nodes in a mini-grid within the cell
        const cols = Math.max(1, Math.floor(cellWidth / (cardWidth + 4)));

        nodes.forEach((node, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = cellX + 4 + col * (cardWidth + 4);
          const y = cellY + 4 + row * (cardHeight + 4);

          const nodeGroup = g.append('g')
            .attr('class', 'node-group')
            .attr('transform', `translate(${x},${y})`)
            .style('cursor', 'pointer')
            .on('click', () => onNodeClick?.(node));

          // Node background
          nodeGroup.append('rect')
            .attr('width', cardWidth)
            .attr('height', cardHeight)
            .attr('rx', theme === 'NeXTSTEP' ? 0 : 4)
            .attr('fill', theme === 'NeXTSTEP' ? '#d4d4d4' : '#ffffff')
            .attr('stroke', theme === 'NeXTSTEP' ? '#707070' : '#e5e7eb')
            .attr('stroke-width', 1);

          // Node title
          nodeGroup.append('text')
            .attr('x', 6)
            .attr('y', 16)
            .attr('class', 'text-xs font-medium')
            .attr('fill', '#374151')
            .text(node.name.length > 15 ? node.name.slice(0, 15) + '...' : node.name);

          // Node priority badge
          nodeGroup.append('text')
            .attr('x', cardWidth - 6)
            .attr('y', 16)
            .attr('text-anchor', 'end')
            .attr('class', 'text-xs')
            .attr('fill', '#9ca3af')
            .text(`P${node.priority}`);
        });
      });
    });

  }, [data, xValues, yValues, grouped, theme, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
