import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { graphAnalytics, type GraphMetrics } from '@/services/GraphAnalyticsAdapter';
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

interface HierarchicalMetrics {
  maxDepth: number;
  averageDepth: number;
  branchingFactor: number;
  balanceScore: number;
  leafNodeCount: number;
  totalPaths: number;
}

interface TreeOptimization {
  nodeId: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
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

  // Hierarchical analytics state
  const [hierarchicalMetrics, setHierarchicalMetrics] = useState<HierarchicalMetrics | null>(null);
  const [treeOptimizations, setTreeOptimizations] = useState<TreeOptimization[]>([]);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [pathAnalysis, setPathAnalysis] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);

  // Build tree hierarchy
  const treeRoots = useMemo(() => buildTree(data), [data]);

  // Hierarchical analytics functions
  const calculateHierarchicalMetrics = useCallback((roots: TreeNode[]): HierarchicalMetrics => {
    let maxDepth = 0;
    let totalDepth = 0;
    let leafCount = 0;
    let totalNodes = 0;
    let totalChildren = 0;

    const traverse = (node: TreeNode, depth: number): void => {
      totalNodes++;
      totalDepth += depth;
      maxDepth = Math.max(maxDepth, depth);

      if (!node.children || node.children.length === 0) {
        leafCount++;
      } else {
        totalChildren += node.children.length;
        node.children.forEach(child => traverse(child, depth + 1));
      }
    };

    roots.forEach(root => traverse(root, 1));

    const averageDepth = totalNodes > 0 ? totalDepth / totalNodes : 0;
    const branchingFactor = totalNodes > leafCount ? totalChildren / (totalNodes - leafCount) : 0;
    const balanceScore = maxDepth > 0 ? (averageDepth / maxDepth) : 1;

    return {
      maxDepth,
      averageDepth,
      branchingFactor,
      balanceScore,
      leafNodeCount: leafCount,
      totalPaths: leafCount
    };
  }, []);

  const runPathAnalysis = useCallback(async (fromNodeId: string, toNodeId: string) => {
    if (!fromNodeId || !toNodeId) return;

    setAnalyticsLoading(true);
    try {
      const result = await graphAnalytics.runGraphQuery('shortestPath', {
        sourceId: fromNodeId,
        targetId: toNodeId
      });
      setPathAnalysis(result.result);
    } catch (error) {
      console.warn('Failed to run path analysis:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const generateTreeOptimizations = useCallback((metrics: HierarchicalMetrics): TreeOptimization[] => {
    const optimizations: TreeOptimization[] = [];

    // Generate optimization suggestions based on metrics
    if (metrics.maxDepth > 5) {
      optimizations.push({
        nodeId: 'tree-structure',
        suggestion: 'Consider flattening deep hierarchies',
        priority: 'high',
        impact: 'Improve navigation and reduce cognitive load'
      });
    }

    if (metrics.branchingFactor > 7) {
      optimizations.push({
        nodeId: 'tree-structure',
        suggestion: 'Group nodes with many children',
        priority: 'medium',
        impact: 'Reduce visual complexity'
      });
    }

    if (metrics.balanceScore < 0.6) {
      optimizations.push({
        nodeId: 'tree-structure',
        suggestion: 'Rebalance tree structure',
        priority: 'medium',
        impact: 'Improve tree symmetry and navigation'
      });
    }

    return optimizations;
  }, []);

  const performHierarchicalAnalysis = useCallback(async () => {
    if (treeRoots.length === 0) return;

    setAnalyticsLoading(true);
    try {
      // Calculate local hierarchical metrics
      const metrics = calculateHierarchicalMetrics(treeRoots);
      setHierarchicalMetrics(metrics);

      // Generate optimization suggestions
      const optimizations = generateTreeOptimizations(metrics);
      setTreeOptimizations(optimizations);

      // Run recursive CTE query for depth analysis if we have many nodes
      if (data.length > 10) {
        try {
          const clusterResult = await graphAnalytics.runGraphQuery('clusterAnalysis', {
            depth: 3
          });
          console.log('Cluster analysis result:', clusterResult.result);
        } catch (error) {
          console.warn('Cluster analysis failed:', error);
        }
      }
    } catch (error) {
      console.warn('Hierarchical analysis failed:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [treeRoots, calculateHierarchicalMetrics, generateTreeOptimizations, data.length]);

  // Effect to perform analysis when tree data changes
  useEffect(() => {
    performHierarchicalAnalysis();
  }, [performHierarchicalAnalysis]);

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

      {/* Hierarchical Analytics Overlay */}
      {showAnalytics && hierarchicalMetrics && (
        <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-800/90 p-3 rounded-lg shadow-lg text-xs max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">Hierarchy Metrics</h4>
            <button
              onClick={() => setShowAnalytics(false)}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              ×
            </button>
          </div>

          {analyticsLoading ? (
            <div className="text-gray-500">Analyzing hierarchy...</div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Max Depth: {hierarchicalMetrics.maxDepth}</div>
                <div>Avg Depth: {hierarchicalMetrics.averageDepth.toFixed(1)}</div>
                <div>Branching: {hierarchicalMetrics.branchingFactor.toFixed(1)}</div>
                <div>Balance: {(hierarchicalMetrics.balanceScore * 100).toFixed(0)}%</div>
                <div>Leaves: {hierarchicalMetrics.leafNodeCount}</div>
                <div>Paths: {hierarchicalMetrics.totalPaths}</div>
              </div>

              {treeOptimizations.length > 0 && (
                <div className="mt-3">
                  <h5 className="font-medium text-xs mb-1">Optimizations</h5>
                  <div className="space-y-1">
                    {treeOptimizations.map((opt, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded border text-xs ${
                          opt.priority === 'high'
                            ? 'border-red-200 bg-red-50'
                            : opt.priority === 'medium'
                            ? 'border-yellow-200 bg-yellow-50'
                            : 'border-blue-200 bg-blue-50'
                        }`}
                      >
                        <div className="font-medium">{opt.suggestion}</div>
                        <div className="text-xs text-gray-600 mt-1">{opt.impact}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Path Analysis Panel */}
      {pathAnalysis && (
        <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-800/90 p-3 rounded-lg shadow-lg text-xs max-w-xs">
          <h4 className="font-semibold mb-2">Path Analysis</h4>
          <div className="space-y-1">
            <div>Distance: {pathAnalysis.distance >= 0 ? pathAnalysis.distance : 'Not connected'}</div>
            {pathAnalysis.path && (
              <div className="text-xs text-gray-600">
                Path: {pathAnalysis.path.split('->').join(' → ')}
              </div>
            )}
          </div>
          <button
            onClick={() => setPathAnalysis(null)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
      )}

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
