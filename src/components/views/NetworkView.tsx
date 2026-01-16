import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { useSQLiteQuery } from '@/hooks/useSQLiteQuery';
import type { Node } from '@/types/node';

interface EdgeData {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  weight: number;
  label: string | null;
}

interface NetworkViewProps {
  data: Node[];
  onNodeClick?: (node: Node) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  folder: string | null;
  priority: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  type: string;
  weight: number;
  label: string | null;
}

export function NetworkView({ data, onNodeClick }: NetworkViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Fetch edges
  const { data: edges } = useSQLiteQuery<EdgeData>(
    'SELECT * FROM edges'
  );

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.length) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Convert data to simulation format
    const nodes: SimNode[] = data.map(d => ({
      id: d.id,
      name: d.name,
      folder: d.folder,
      priority: d.priority,
    }));

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Filter edges to only include those with valid source/target
    const links: SimLink[] = (edges || [])
      .filter(e => nodeMap.has(e.source_id) && nodeMap.has(e.target_id))
      .map(e => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        type: e.type,
        weight: e.weight,
        label: e.label,
      }));

    // Color scale for folders
    const folders = Array.from(new Set(nodes.map(n => n.folder).filter(Boolean)));
    const colorScale = d3.scaleOrdinal<string>()
      .domain(folders as string[])
      .range(theme === 'NeXTSTEP'
        ? ['#808080', '#606060', '#a0a0a0', '#707070', '#909090']
        : d3.schemeTableau10
      );

    // Create simulation
    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links)
        .id(d => d.id)
        .distance(100)
        .strength(0.5))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Main group
    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Arrow marker for directed edges
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', theme === 'NeXTSTEP' ? '#707070' : '#9ca3af')
      .attr('d', 'M0,-5L10,0L0,5');

    // Links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', theme === 'NeXTSTEP' ? '#808080' : '#d1d5db')
      .attr('stroke-width', d => Math.sqrt(d.weight) * 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrow)');

    // Link labels
    const linkLabels = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links.filter(l => l.label))
      .join('text')
      .attr('class', 'text-xs')
      .attr('fill', theme === 'NeXTSTEP' ? '#505050' : '#6b7280')
      .attr('text-anchor', 'middle')
      .text(d => d.label || '');

    // Nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Node circles
    node.append('circle')
      .attr('r', d => 12 + (6 - d.priority) * 2)
      .attr('fill', d => colorScale(d.folder || 'Unknown'))
      .attr('stroke', d => selectedNode === d.id
        ? (theme === 'NeXTSTEP' ? '#000000' : '#3b82f6')
        : (theme === 'NeXTSTEP' ? '#404040' : '#6b7280')
      )
      .attr('stroke-width', d => selectedNode === d.id ? 3 : 1.5);

    // Node labels
    node.append('text')
      .attr('dy', 30)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-xs font-medium')
      .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#374151')
      .text(d => d.name.length > 12 ? d.name.slice(0, 12) + '...' : d.name);

    // Node click handler
    node.on('click', (event, d) => {
      event.stopPropagation();
      setSelectedNode(prev => prev === d.id ? null : d.id);
      const nodeData = data.find(c => c.id === d.id);
      if (nodeData) onNodeClick?.(nodeData);
    });

    // Background click to deselect
    svg.on('click', () => setSelectedNode(null));

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimNode).x!)
        .attr('y1', d => (d.source as SimNode).y!)
        .attr('x2', d => (d.target as SimNode).x!)
        .attr('y2', d => (d.target as SimNode).y!);

      linkLabels
        .attr('x', d => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
        .attr('y', d => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data, edges, theme, selectedNode, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />
      {(!edges || edges.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-sm ${theme === 'NeXTSTEP' ? 'text-[#707070]' : 'text-gray-400'}`}>
            No edges defined. Add relationships to see the network.
          </div>
        </div>
      )}
    </div>
  );
}
