import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import type { Node } from '@/types/node';

interface KanbanViewProps {
  data: Node[];
  groupBy?: 'status' | 'folder' | 'priority';
  onNodeClick?: (node: Node) => void;
}

const STATUS_ORDER = ['active', 'pending', 'completed', 'archived'];

export function KanbanView({ data, groupBy = 'status', onNodeClick }: KanbanViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Group data by the groupBy field
  const { columns, grouped } = useMemo(() => {
    const map = new Map<string, Node[]>();

    data.forEach(node => {
      let value: string;
      if (groupBy === 'status') {
        value = node.status || 'Unknown';
      } else if (groupBy === 'folder') {
        value = node.folder || 'Unknown';
      } else {
        value = String(node.priority);
      }

      if (!map.has(value)) map.set(value, []);
      map.get(value)!.push(node);
    });

    // Sort columns
    const cols = Array.from(map.keys());
    if (groupBy === 'status') {
      cols.sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.toLowerCase());
        const bi = STATUS_ORDER.indexOf(b.toLowerCase());
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    } else if (groupBy === 'priority') {
      cols.sort((a, b) => Number(a) - Number(b));
    } else {
      cols.sort();
    }

    return { columns: cols, grouped: map };
  }, [data, groupBy]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = d3.select(containerRef.current);

    // Clear and rebuild columns
    const colWidth = Math.max(200, Math.min(280, containerRef.current.clientWidth / columns.length - 16));

    const columnsSelection = container
      .selectAll<HTMLDivElement, string>('.kanban-column')
      .data(columns, d => d)
      .join(
        enter => enter
          .append('div')
          .attr('class', 'kanban-column')
          .style('opacity', 0)
          .call(el => el.transition().duration(300).style('opacity', 1)),
        update => update,
        exit => exit.transition().duration(200).style('opacity', 0).remove()
      );

    columnsSelection
      .attr('class', `kanban-column flex-shrink-0 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#c0c0c0] border-2 border-[#808080]'
          : 'bg-gray-50 rounded-lg border border-gray-200'
      }`)
      .style('width', `${colWidth}px`)
      .style('min-height', '200px')
      .style('display', 'flex')
      .style('flex-direction', 'column');

    columnsSelection.each(function(columnKey) {
      const column = d3.select(this);
      const nodes = grouped.get(columnKey) || [];

      // Clear existing content
      column.selectAll('*').remove();

      // Column header
      column.append('div')
        .attr('class', `px-3 py-2 font-medium text-sm ${
          theme === 'NeXTSTEP'
            ? 'bg-[#a8a8a8] border-b-2 border-[#707070]'
            : 'bg-gray-100 border-b border-gray-200 rounded-t-lg'
        }`)
        .html(`
          <div class="flex items-center justify-between">
            <span>${columnKey}</span>
            <span class="text-xs ${theme === 'NeXTSTEP' ? 'text-[#505050]' : 'text-gray-400'}">${nodes.length}</span>
          </div>
        `);

      // Nodes container
      const nodesContainer = column.append('div')
        .attr('class', 'flex-1 p-2 space-y-2 overflow-y-auto')
        .style('max-height', '400px');

      // Node elements
      const nodeElements = nodesContainer
        .selectAll<HTMLDivElement, Node>('.kanban-node')
        .data(nodes, d => d.id)
        .join(
          enter => enter
            .append('div')
            .attr('class', 'kanban-node')
            .style('opacity', 0)
            .call(el => el.transition().duration(200).style('opacity', 1)),
          update => update,
          exit => exit.transition().duration(150).style('opacity', 0).remove()
        );

      nodeElements
        .attr('class', `kanban-node cursor-pointer ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
            : 'bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow'
        }`)
        .style('padding', '8px 10px')
        .on('click', (_event, d) => onNodeClick?.(d));

      nodeElements.each(function(node) {
        const nodeEl = d3.select(this);
        nodeEl.selectAll('*').remove();

        // Title
        nodeEl.append('div')
          .attr('class', 'font-medium text-sm mb-1 truncate')
          .attr('title', node.name)
          .text(node.name);

        // Content preview
        if (node.content) {
          nodeEl.append('div')
            .attr('class', `text-xs mb-2 line-clamp-2 ${
              theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-500'
            }`)
            .text(node.content.slice(0, 80) + (node.content.length > 80 ? '...' : ''));
        }

        // Footer with badges
        const footer = nodeEl.append('div')
          .attr('class', 'flex items-center gap-2');

        if (groupBy !== 'folder' && node.folder) {
          footer.append('span')
            .attr('class', `px-1.5 py-0.5 text-xs rounded ${
              theme === 'NeXTSTEP' ? 'bg-[#a0a0a0]' : 'bg-blue-100 text-blue-700'
            }`)
            .text(node.folder);
        }

        footer.append('span')
          .attr('class', `ml-auto text-xs ${
            theme === 'NeXTSTEP' ? 'text-[#505050]' : 'text-gray-400'
          }`)
          .text(`P${node.priority}`);
      });
    });

  }, [columns, grouped, theme, groupBy, onNodeClick]);

  return (
    <div
      ref={containerRef}
      className="flex gap-4 p-4 overflow-x-auto h-full items-start"
    />
  );
}
