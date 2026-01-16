import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { usePAFV } from '@/contexts/PAFVContext';
import type { CardData } from '@/types/CardData';

interface GridViewProps {
  data: CardData[];
  onCardClick?: (card: CardData) => void;
}

// Map chip IDs to card fields
const FIELD_MAP: Record<string, keyof CardData> = {
  folder: 'category',
  subfolder: 'status',
  tags: 'category',
  year: 'created',
  month: 'created',
  category: 'category',
  status: 'status',
  priority: 'priority',
};

function getFieldValue(card: CardData, chipId: string): string {
  const field = FIELD_MAP[chipId] || 'category';
  const value = card[field];

  if (field === 'created' && value) {
    if (chipId === 'year') {
      return new Date(value).getFullYear().toString();
    }
    if (chipId === 'month') {
      return new Date(value).toLocaleString('default', { month: 'short' });
    }
  }

  return String(value ?? 'Unknown');
}

export function GridView({ data, onCardClick }: GridViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const { wells } = usePAFV();

  // Get axis assignments from PAFV wells
  const xAxis = wells.xRows[0]?.id || 'category';
  const yAxis = wells.yColumns[0]?.id || 'status';

  // Group data by x and y axes
  const { xValues, yValues, grouped } = useMemo(() => {
    const xSet = new Set<string>();
    const ySet = new Set<string>();
    const map = new Map<string, CardData[]>();

    data.forEach(card => {
      const xVal = getFieldValue(card, xAxis);
      const yVal = getFieldValue(card, yAxis);
      xSet.add(xVal);
      ySet.add(yVal);

      const key = `${xVal}|${yVal}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
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
        const cards = grouped.get(`${xVal}|${yVal}`) || [];
        const cellX = xScale(xVal) || 0;
        const cellY = yScale(yVal) || 0;

        // Position cards in a mini-grid within the cell
        const cols = Math.max(1, Math.floor(cellWidth / (cardWidth + 4)));

        cards.forEach((card, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = cellX + 4 + col * (cardWidth + 4);
          const y = cellY + 4 + row * (cardHeight + 4);

          const cardGroup = g.append('g')
            .attr('class', 'card-group')
            .attr('transform', `translate(${x},${y})`)
            .style('cursor', 'pointer')
            .on('click', () => onCardClick?.(card));

          // Card background
          cardGroup.append('rect')
            .attr('width', cardWidth)
            .attr('height', cardHeight)
            .attr('rx', theme === 'NeXTSTEP' ? 0 : 4)
            .attr('fill', theme === 'NeXTSTEP' ? '#d4d4d4' : '#ffffff')
            .attr('stroke', theme === 'NeXTSTEP' ? '#707070' : '#e5e7eb')
            .attr('stroke-width', 1);

          // Card title
          cardGroup.append('text')
            .attr('x', 6)
            .attr('y', 16)
            .attr('class', 'text-xs font-medium')
            .attr('fill', '#374151')
            .text(card.name.length > 15 ? card.name.slice(0, 15) + '...' : card.name);

          // Card priority badge
          cardGroup.append('text')
            .attr('x', cardWidth - 6)
            .attr('y', 16)
            .attr('text-anchor', 'end')
            .attr('class', 'text-xs')
            .attr('fill', '#9ca3af')
            .text(`P${card.priority}`);
        });
      });
    });

  }, [data, xValues, yValues, grouped, theme, onCardClick]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
