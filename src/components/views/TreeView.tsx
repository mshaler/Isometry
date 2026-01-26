import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import type { Node as DataNode } from '@/types/node';
import type {
  D3ZoomBehavior,
  D3ColorScale
} from '@/types/d3';

interface TreeViewProps {
  data: DataNode[];
  onNodeClick?: (node: DataNode) => void;
}

interface TreeNode {
  id: string;
  name: string;
  folder: string | null;
  priority: number;
  children?: TreeNode[];
  _node: DataNode;
}

function buildTree(data: DataNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create all nodes (no parent_id in schema, so all are roots)
  data.forEach(node => {
    nodeMap.set(node.id, {
      id: node.id,
      name: node.name,
      folder: node.folder,
      priority: node.priority,
      children: [],
      _node: node,
    });
  });

  // All nodes are roots since there's no parent_id in the schema
  data.forEach(node => {
    const treeNode = nodeMap.get(node.id)!;
    roots.push(treeNode);
  });

  return roots;
}

export function TreeView({ data, onNodeClick }: TreeViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Build tree hierarchy
  const treeRoots = useMemo(() => buildTree(data), [data]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !treeRoots.length) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 40, right: 120, bottom: 40, left: 120 };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // If multiple roots, create a virtual root
    const rootData: TreeNode = treeRoots.length === 1
      ? treeRoots[0]
      : {
          id: '__root__',
          name: 'Root',
          folder: null,
          priority: 0,
          children: treeRoots,
          _node: data[0], // Use first node as placeholder
        };

    // Create hierarchy
    const root = d3.hierarchy<TreeNode>(rootData);

    // Tree layout
    const treeLayout = d3.tree<TreeNode>()
      .size([height - margin.top - margin.bottom, width - margin.left - margin.right]);

    const treeData = treeLayout(root);

    // Color scale
    const folders = Array.from(new Set(data.map(d => d.folder).filter(Boolean)));
    const colorScale: D3ColorScale = d3.scaleOrdinal<string>()
      .domain(folders as string[])
      .range(theme === 'NeXTSTEP'
        ? ['#808080', '#606060', '#a0a0a0', '#707070', '#909090']
        : d3.schemeTableau10
      );

    // Main group
    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add zoom
    const zoom: D3ZoomBehavior<SVGSVGElement> = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(margin.left, margin.top));

    // Links
    g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(treeData.links())
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', theme === 'NeXTSTEP' ? '#808080' : '#d1d5db')
      .attr('stroke-width', 1.5)
      .attr('d', d3.linkHorizontal<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
        .x(d => d.y)
        .y(d => d.x)
      );

    // Nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, d3.HierarchyPointNode<TreeNode>>('g')
      .data(treeData.descendants().filter(d => d.data.id !== '__root__'))
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .on('click', (event, d: d3.HierarchyPointNode<TreeNode>) => {
        event.stopPropagation();
        onNodeClick?.(d.data._node);
      });

    // Node circles
    node.append('circle')
      .attr('r', d => 8 + (6 - d.data.priority) * 1.5)
      .attr('fill', d => d.data.folder
        ? colorScale(d.data.folder)
        : (theme === 'NeXTSTEP' ? '#b0b0b0' : '#e5e7eb')
      )
      .attr('stroke', theme === 'NeXTSTEP' ? '#404040' : '#6b7280')
      .attr('stroke-width', 1.5);

    // Node labels
    node.append('text')
      .attr('dy', '0.31em')
      .attr('x', d => d.children ? -15 : 15)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .attr('class', 'text-xs font-medium')
      .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#374151')
      .text(d => d.data.name.length > 20 ? d.data.name.slice(0, 20) + '...' : d.data.name);

    // Hover effect
    node.on('mouseenter', function() {
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

  }, [treeRoots, data, theme, onNodeClick]);

  // Tree view shows all nodes (no parent_id in schema)
  const hasHierarchy = false;

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />
      {!hasHierarchy && data.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-sm ${theme === 'NeXTSTEP' ? 'text-[#707070]' : 'text-gray-400'}`}>
            No hierarchy defined. Add NEST edges to see the tree.
          </div>
        </div>
      )}
    </div>
  );
}
