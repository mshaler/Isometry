import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import type { Node } from '@/types/node';

interface ListViewProps {
  data: Node[];
  onNodeClick?: (node: Node) => void;
}

export function ListView({ data, onNodeClick }: ListViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    const container = d3.select(containerRef.current);

    // Clear and rebuild - D3 handles the diffing via key function
    const rows = container
      .selectAll<HTMLDivElement, Node>('.list-row')
      .data(data, d => d.id)
      .join(
        enter => enter
          .append('div')
          .attr('class', 'list-row')
          .style('opacity', 0)
          .call(el => el.transition().duration(300).style('opacity', 1)),
        update => update,
        exit => exit
          .transition()
          .duration(200)
          .style('opacity', 0)
          .remove()
      );

    // Apply theme-based styling
    rows
      .attr('class', `list-row cursor-pointer ${
        theme === 'NeXTSTEP'
          ? 'bg-[#d4d4d4] border-t border-[#a0a0a0] hover:bg-[#c8c8c8]'
          : 'bg-white border-b border-gray-100 hover:bg-gray-50'
      }`)
      .style('display', 'grid')
      .style('grid-template-columns', '1fr 120px 100px 80px')
      .style('padding', '12px 16px')
      .style('gap', '16px')
      .style('align-items', 'center')
      .on('click', (_event, d) => onNodeClick?.(d));

    // Update cell contents
    rows.each(function(d) {
      const row = d3.select(this);

      // Clear existing content
      row.selectAll('*').remove();

      // Name cell
      row.append('div')
        .attr('class', 'font-medium text-sm truncate')
        .text(d.name);

      // Folder cell
      row.append('div')
        .append('span')
        .attr('class', `px-2 py-0.5 text-xs rounded ${
          theme === 'NeXTSTEP'
            ? 'bg-[#a0a0a0]'
            : 'bg-blue-100 text-blue-700'
        }`)
        .text(d.folder || '—');

      // Status cell
      row.append('div')
        .append('span')
        .attr('class', `px-2 py-0.5 text-xs rounded ${
          theme === 'NeXTSTEP'
            ? 'bg-[#b0b0b0]'
            : 'bg-gray-100 text-gray-600'
        }`)
        .text(d.status || '—');

      // Priority cell
      row.append('div')
        .attr('class', 'text-xs text-gray-500 text-center')
        .text(`P${d.priority}`);
    });

  }, [data, theme, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full">
      {/* Header row */}
      <div
        className={`grid gap-4 px-4 py-2 text-xs font-medium uppercase tracking-wider ${
          theme === 'NeXTSTEP'
            ? 'bg-[#b0b0b0] text-[#404040] border-b-2 border-[#808080]'
            : 'bg-gray-50 text-gray-500 border-b border-gray-200'
        }`}
        style={{ gridTemplateColumns: '1fr 120px 100px 80px' }}
      >
        <div>Name</div>
        <div>Folder</div>
        <div>Status</div>
        <div className="text-center">Priority</div>
      </div>
    </div>
  );
}
