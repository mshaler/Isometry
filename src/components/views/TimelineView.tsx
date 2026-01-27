import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import type { Node } from '@/types/node';

interface TimelineViewProps {
  data: Node[];
  dateField?: 'createdAt' | 'dueAt';
  onNodeClick?: (node: Node) => void;
}

export function TimelineView({ data, dateField = 'createdAt', onNodeClick }: TimelineViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Parse dates and filter valid items
  const timelineData = useMemo(() => {
    return data
      .map(node => ({
        ...node,
        date: node[dateField] ? new Date(node[dateField]!) : null,
      }))
      .filter(node => node.date && !isNaN(node.date.getTime()))
      .sort((a, b) => a.date!.getTime() - b.date!.getTime());
  }, [data, dateField]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !timelineData.length) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Time scale
    const dates = timelineData.map(d => d.date!);
    const xScale = d3.scaleTime()
      .domain([d3.min(dates)!, d3.max(dates)!])
      .range([margin.left, width - margin.right])
      .nice();

    // Folder scale for y-axis (swim lanes)
    const categories = Array.from(new Set(timelineData.map(d => d.folder || 'Uncategorized')));
    const yScale = d3.scaleBand()
      .domain(categories)
      .range([margin.top, height - margin.bottom])
      .padding(0.2);

    // Color scale
    const colorScale = d3.scaleOrdinal<string>()
      .domain(categories)
      .range(theme === 'NeXTSTEP'
        ? ['#808080', '#606060', '#a0a0a0', '#707070', '#909090']
        : d3.schemeTableau10
      );

    // Main group
    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g');

    // Add zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .on('zoom', (event) => {
        const newXScale = event.transform.rescaleX(xScale);
        const timeFormatter = d3.timeFormat('%b %d');
        xAxisG.call(d3.axisBottom(newXScale).tickFormat(timeFormatter));

        cards.attr('transform', d => {
          const x = newXScale(d.date!);
          const y = yScale(d.folder || 'Uncategorized')! + yScale.bandwidth() / 2;
          return `translate(${x},${y})`;
        });

        // Update connecting lines
        g.selectAll('.timeline-line')
          .attr('x1', margin.left)
          .attr('x2', width - margin.right);
      });

    svg.call(zoom);

    // X-axis
    const timeFormatter = d3.timeFormat('%b %d');
    const xAxisG = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickFormat(timeFormatter));

    xAxisG.selectAll('text')
      .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#6b7280');
    xAxisG.selectAll('line, path')
      .attr('stroke', theme === 'NeXTSTEP' ? '#808080' : '#d1d5db');

    // Y-axis (category lanes)
    const yAxisG = g.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));

    yAxisG.selectAll('text')
      .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#6b7280');
    yAxisG.selectAll('line, path')
      .attr('stroke', theme === 'NeXTSTEP' ? '#808080' : '#d1d5db');

    // Swim lane lines
    g.append('g')
      .attr('class', 'swim-lanes')
      .selectAll('line')
      .data(categories)
      .join('line')
      .attr('class', 'timeline-line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', d => yScale(d)! + yScale.bandwidth() / 2)
      .attr('y2', d => yScale(d)! + yScale.bandwidth() / 2)
      .attr('stroke', theme === 'NeXTSTEP' ? '#d0d0d0' : '#e5e7eb')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    // Nodes
    const cards = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, typeof timelineData[0]>('g')
      .data(timelineData, d => d.id)
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => {
        const x = xScale(d.date!);
        const y = yScale(d.folder || 'Uncategorized')! + yScale.bandwidth() / 2;
        return `translate(${x},${y})`;
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick?.(d);
      });

    // Node circles
    cards.append('circle')
      .attr('r', d => 6 + (6 - d.priority) * 1.5)
      .attr('fill', d => colorScale(d.folder || 'Uncategorized'))
      .attr('stroke', theme === 'NeXTSTEP' ? '#404040' : '#6b7280')
      .attr('stroke-width', 1.5);

    // Card labels
    cards.append('text')
      .attr('dy', -12)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-xs font-medium')
      .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#374151')
      .text(d => d.name.length > 15 ? d.name.slice(0, 15) + '...' : d.name);

    // Hover effect
    cards.on('mouseenter', function() {
      d3.select(this).select('circle')
        .transition()
        .duration(150)
        .attr('stroke-width', 3);
    }).on('mouseleave', function() {
      d3.select(this).select('circle')
        .transition()
        .duration(150)
        .attr('stroke-width', 1.5);
    });

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .append('div')
      .attr('class', `absolute hidden px-2 py-1 text-xs rounded shadow-lg pointer-events-none ${
        theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border border-black' : 'bg-gray-800 text-white'
      }`)
      .style('z-index', '50');

    cards.on('mouseenter', function(event, d) {
      d3.select(this).select('circle')
        .transition()
        .duration(150)
        .attr('stroke-width', 3);

      const dateStr = d.date!.toLocaleDateString();
      tooltip
        .html(`<strong>${d.name}</strong><br/>${dateStr}`)
        .style('left', `${event.offsetX + 10}px`)
        .style('top', `${event.offsetY - 30}px`)
        .classed('hidden', false);
    }).on('mouseleave', function() {
      d3.select(this).select('circle')
        .transition()
        .duration(150)
        .attr('stroke-width', 1.5);
      tooltip.classed('hidden', true);
    });

    return () => {
      tooltip.remove();
    };
  }, [timelineData, theme, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />
      {timelineData.length === 0 && data.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-sm ${theme === 'NeXTSTEP' ? 'text-[#707070]' : 'text-gray-400'}`}>
            No valid dates found. Cards need {dateField} dates for timeline view.
          </div>
        </div>
      )}
    </div>
  );
}
