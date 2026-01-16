import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Node } from '@/types/node';

interface CalendarViewProps {
  data: Node[];
  dateField?: 'createdAt' | 'dueAt';
  onNodeClick?: (node: Node) => void;
}

export function CalendarView({ data, dateField = 'createdAt', onNodeClick }: CalendarViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Group nodes by date
  const nodesByDate = useMemo(() => {
    const map = new Map<string, Node[]>();
    data.forEach(node => {
      const dateValue = node[dateField];
      if (dateValue) {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          const key = date.toISOString().split('T')[0];
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(node);
        }
      }
    });
    return map;
  }, [data, dateField]);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date | null; isCurrentMonth: boolean }> = [];

    // Add days from previous month
    for (let i = 0; i < startDayOfWeek; i++) {
      const date = new Date(year, month, -startDayOfWeek + i + 1);
      days.push({ date, isCurrentMonth: false });
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Add days from next month to complete the grid
    const remaining = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  // Color scale
  const colorScale = useMemo(() => {
    const folders = Array.from(new Set(data.map(d => d.folder).filter(Boolean))) as string[];
    return d3.scaleOrdinal<string>()
      .domain(folders)
      .range(theme === 'NeXTSTEP'
        ? ['#808080', '#606060', '#a0a0a0', '#707070', '#909090']
        : d3.schemeTableau10
      );
  }, [data, theme]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight - 50; // Leave room for month nav
    const padding = 4;
    const cellWidth = (width - padding * 2) / 7;
    const cellHeight = (height - 30) / 6; // 6 weeks, header row

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${padding}, 0)`);

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    g.append('g')
      .attr('class', 'day-headers')
      .selectAll('text')
      .data(dayNames)
      .join('text')
      .attr('x', (_, i) => i * cellWidth + cellWidth / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-xs font-medium')
      .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#6b7280')
      .text(d => d);

    // Calendar cells
    const cells = g.append('g')
      .attr('class', 'cells')
      .attr('transform', 'translate(0, 30)')
      .selectAll<SVGGElement, typeof calendarDays[0]>('g')
      .data(calendarDays)
      .join('g')
      .attr('class', 'cell')
      .attr('transform', (_, i) => {
        const col = i % 7;
        const row = Math.floor(i / 7);
        return `translate(${col * cellWidth}, ${row * cellHeight})`;
      });

    // Cell backgrounds
    cells.append('rect')
      .attr('width', cellWidth - 2)
      .attr('height', cellHeight - 2)
      .attr('rx', theme === 'NeXTSTEP' ? 0 : 4)
      .attr('fill', d => {
        if (!d.isCurrentMonth) {
          return theme === 'NeXTSTEP' ? '#e0e0e0' : '#f9fafb';
        }
        return theme === 'NeXTSTEP' ? '#d4d4d4' : '#ffffff';
      })
      .attr('stroke', theme === 'NeXTSTEP' ? '#a0a0a0' : '#e5e7eb')
      .attr('stroke-width', 1);

    // Day numbers
    cells.append('text')
      .attr('x', 6)
      .attr('y', 14)
      .attr('class', 'text-xs')
      .attr('fill', d => {
        if (!d.isCurrentMonth) {
          return theme === 'NeXTSTEP' ? '#909090' : '#9ca3af';
        }
        return theme === 'NeXTSTEP' ? '#404040' : '#374151';
      })
      .text(d => d.date?.getDate() ?? '');

    // Nodes in cells
    cells.each(function(d) {
      if (!d.date) return;
      const dateKey = d.date.toISOString().split('T')[0];
      const dayNodes = nodesByDate.get(dateKey) || [];

      if (dayNodes.length === 0) return;

      const cell = d3.select(this);
      const maxVisible = Math.floor((cellHeight - 20) / 14);
      const visibleNodes = dayNodes.slice(0, maxVisible);
      const hiddenCount = dayNodes.length - maxVisible;

      visibleNodes.forEach((node, i) => {
        cell.append('rect')
          .attr('x', 4)
          .attr('y', 18 + i * 14)
          .attr('width', cellWidth - 12)
          .attr('height', 12)
          .attr('rx', 2)
          .attr('fill', colorScale(node.folder || 'Uncategorized'))
          .attr('opacity', 0.8)
          .style('cursor', 'pointer')
          .on('click', (event) => {
            event.stopPropagation();
            onNodeClick?.(node);
          })
          .on('mouseenter', function() {
            d3.select(this).attr('opacity', 1);
          })
          .on('mouseleave', function() {
            d3.select(this).attr('opacity', 0.8);
          });

        cell.append('text')
          .attr('x', 6)
          .attr('y', 18 + i * 14 + 9)
          .attr('class', 'text-[9px]')
          .attr('fill', theme === 'NeXTSTEP' ? '#ffffff' : '#ffffff')
          .style('pointer-events', 'none')
          .text(node.name.length > 12 ? node.name.slice(0, 12) + '...' : node.name);
      });

      if (hiddenCount > 0) {
        cell.append('text')
          .attr('x', 6)
          .attr('y', cellHeight - 6)
          .attr('class', 'text-[9px]')
          .attr('fill', theme === 'NeXTSTEP' ? '#606060' : '#9ca3af')
          .text(`+${hiddenCount} more`);
      }
    });

  }, [calendarDays, nodesByDate, theme, colorScale, onNodeClick]);

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      {/* Month navigation */}
      <div className={`h-10 flex items-center justify-between px-4 ${
        theme === 'NeXTSTEP' ? 'bg-[#c0c0c0]' : 'bg-gray-50'
      }`}>
        <button
          onClick={prevMonth}
          className={`p-1 ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff]'
              : 'hover:bg-gray-200 rounded'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className={`font-medium ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-700'}`}>
          {monthName}
        </span>
        <button
          onClick={nextMonth}
          className={`p-1 ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff]'
              : 'hover:bg-gray-200 rounded'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="flex-1">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  );
}
