import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { useTableTheme, useBadgeTheme } from '@/hooks/useComponentTheme';
import { TRANSITION_DURATIONS } from '@/d3/hooks';
import type { Node } from '@/types/node';

interface ListViewProps {
  data: Node[];
  onNodeClick?: (node: Node) => void;
}

export function ListView({ data, onNodeClick }: ListViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const tableTheme = useTableTheme();
  const badgeTheme = useBadgeTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    const container = d3.select(containerRef.current);

    // D3 data binding with enter/update/exit pattern
    const rows = container
      .selectAll<HTMLDivElement, Node>('.list-row')
      .data(data, d => d.id)
      .join(
        enter => enter
          .append('div')
          .attr('class', 'list-row')
          .style('opacity', 0)
          .call(el => el.transition().duration(TRANSITION_DURATIONS.slow).style('opacity', 1)),
        update => update,
        exit => exit
          .transition()
          .duration(TRANSITION_DURATIONS.normal)
          .style('opacity', 0)
          .remove()
      );

    // Apply theme-based styling
    rows
      .attr('class', `list-row cursor-pointer ${tableTheme.row}`)
      .style('display', 'grid')
      .style('grid-template-columns', '1fr 120px 100px 80px')
      .style('padding', '12px 16px')
      .style('gap', '16px')
      .style('align-items', 'center')
      .on('click', (_event, d) => onNodeClick?.(d));

    // Update cell contents
    rows.each(function(d) {
      const row = d3.select(this);
      row.selectAll('*').remove();

      // Name cell
      row.append('div')
        .attr('class', `font-medium text-sm truncate ${tableTheme.cell}`)
        .text(d.name);

      // Folder cell
      row.append('div')
        .append('span')
        .attr('class', badgeTheme.primary)
        .text(d.folder || '—');

      // Status cell
      row.append('div')
        .append('span')
        .attr('class', badgeTheme.default)
        .text(d.status || '—');

      // Priority cell
      row.append('div')
        .attr('class', 'text-xs text-center')
        .text(`P${d.priority}`);
    });

  }, [data, theme, onNodeClick, tableTheme, badgeTheme]);

  return (
    <div ref={containerRef} className="w-full">
      {/* Header row */}
      <div
        className={`grid gap-4 px-4 py-2 text-xs font-medium uppercase tracking-wider ${tableTheme.header}`}
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
