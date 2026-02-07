import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { useD3, useResizeObserver } from '../../hooks/useD3';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import type { Node } from '@/types/node';

interface D3CanvasProps {
  sql: string;
  queryParams?: unknown[];
  width?: number;
  height?: number;
  onNodeClick?: (node: Node) => void;
  className?: string;
  enableZoom?: boolean;
  enableBrush?: boolean;
  renderMode?: 'svg' | 'canvas';
  maxNodes?: number;
  debounceMs?: number;
}

type D3Selection = d3.Selection<SVGSVGElement, unknown, null, undefined>;
type D3Transform = d3.ZoomTransform;

/**
 * D3.js Canvas component with proper React lifecycle integration
 * Provides SVG-based rendering with D3 data binding and animations
 */
export const D3Canvas: React.FC<D3CanvasProps> = ({
  sql,
  queryParams = [],
  width = 800,
  height = 600,
  onNodeClick,
  className = '',
  enableZoom = true,
  enableBrush = false,
  renderMode: _renderMode = 'svg',
  maxNodes: _maxNodes = 1000,
  debounceMs = 100
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live data query
  const {
    data: nodes = [],
    loading,
    error: queryError
  } = useLiveQuery<Node>(sql, {
    params: queryParams,
    autoStart: true,
    enableCache: true,
    debounceMs,
    onError: (err) => {
      console.error('[D3Canvas] Query error:', err);
      setError(`Query failed: ${err.message}`);
    }
  });

  // D3 zoom behavior reference
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const brushBehavior = useRef<d3.BrushBehavior<unknown> | null>(null);

  // Handle container resize
  useResizeObserver(containerRef, useCallback((entry) => {
    const { width: newWidth, height: newHeight } = entry.contentRect;
    setDimensions({ width: newWidth, height: newHeight });
  }, []));

  // D3 rendering function
  const renderD3 = useCallback((selection: D3Selection) => {
    if (!selection.node()) return;

    try {
      // Clear previous content
      selection.selectAll('*').remove();

      // Setup SVG dimensions and viewBox
      selection
        .attr('width', dimensions.width)
        .attr('height', dimensions.height)
        .attr('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`);

      // Create main group for zoomable content
      const mainGroup = selection.append('g').attr('class', 'main-group');

      // Setup zoom behavior if enabled
      if (enableZoom) {
        if (!zoomBehavior.current) {
          zoomBehavior.current = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
              const transform: D3Transform = event.transform;
              mainGroup.attr('transform', transform.toString());
            });
        }
        selection.call(zoomBehavior.current);
      }

      // Setup brush behavior if enabled
      if (enableBrush && !enableZoom) {
        if (!brushBehavior.current) {
          brushBehavior.current = d3.brush()
            .extent([[0, 0], [dimensions.width, dimensions.height]])
            .on('brushend', (event) => {
              if (event.selection) {
                const [[x0, y0], [x1, y1]] = event.selection;
                console.log('[D3Canvas] Brush selection:', { x0, y0, x1, y1 });
              }
            });
        }
        selection.call(brushBehavior.current as any);
      }

      // Render nodes
      const safeNodes = nodes || [];
      if (safeNodes.length > 0) {
        renderNodes(mainGroup, safeNodes);
      }

      // Render connections (if nodes have edges)
      renderConnections(mainGroup, safeNodes);

      console.log('[D3Canvas] Rendered', nodes?.length || 0, 'nodes');
      setError(null);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[D3Canvas] Render error:', err);
      setError(`Render failed: ${errorMsg}`);
    }

    // Cleanup function
    return () => {
      if (zoomBehavior.current) {
        selection.on('.zoom', null);
      }
      if (brushBehavior.current) {
        selection.on('.brush', null);
      }
    };
  }, [nodes, dimensions, enableZoom, enableBrush]);

  // Render individual nodes
  const renderNodes = useCallback((
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodeData: Node[]
  ) => {
    // Position nodes using a simple force simulation or grid layout
    const simulation = d3.forceSimulation(nodeData as any)
      .force('charge', d3.forceManyBody().strength(-30))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collision', d3.forceCollide().radius(20))
      .stop();

    // Run simulation to completion for stable layout
    for (let i = 0; i < 300; ++i) simulation.tick();

    // Create node groups
    const nodeGroups = container
      .selectAll<SVGGElement, Node>('.node')
      .data(nodeData, (d) => d.id)
      .join(
        (enter) => {
          const group = enter.append('g')
            .attr('class', 'node')
            .attr('transform', (d: any) => `translate(${d.x || 0}, ${d.y || 0})`);

          // Add circle - use nodeType for color mapping
          group.append('circle')
            .attr('r', 0)
            .attr('fill', (d) => {
              const colorMap: Record<string, string> = {
                'note': '#3b82f6',
                'task': '#ef4444',
                'contact': '#10b981',
                'event': '#f59e0b',
                'project': '#8b5cf6',
                'resource': '#06b6d4',
                'notebook': '#f97316'
              };
              return colorMap[d.nodeType] || '#6b7280';
            })
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .transition()
            .duration(500)
            .attr('r', 8);

          // Add text label
          group.append('text')
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .style('fill', '#fff')
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .style('pointer-events', 'none')
            .text((d) => d.name?.charAt(0) || '?');

          // Add hover effects
          group
            .on('mouseenter', function(_event, _d) {
              d3.select(this).select('circle')
                .transition()
                .duration(150)
                .attr('r', 12);
            })
            .on('mouseleave', function(_event, _d) {
              d3.select(this).select('circle')
                .transition()
                .duration(150)
                .attr('r', 8);
            })
            .on('click', function(_event, d) {
              if (onNodeClick) {
                onNodeClick(d);
              }
            });

          return group;
        },
        (update) => {
          update
            .transition()
            .duration(300)
            .attr('transform', (d: any) => `translate(${d.x || 0}, ${d.y || 0})`);

          return update;
        }
      );

    return nodeGroups;
  }, [dimensions, onNodeClick]);

  // Render connections between nodes
  const renderConnections = useCallback((
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodeData: Node[]
  ) => {
    // For now, just render random connections for demo
    // In practice, this would use edge data from the database
    const connections: Array<{source: Node, target: Node}> = [];

    // Create sample connections for visualization
    if (nodeData.length > 1) {
      for (let i = 0; i < Math.min(5, nodeData.length - 1); i++) {
        connections.push({
          source: nodeData[i],
          target: nodeData[i + 1]
        });
      }
    }

    container
      .selectAll<SVGLineElement, typeof connections[0]>('.connection')
      .data(connections)
      .join('line')
      .attr('class', 'connection')
      .attr('x1', (d: any) => d.source.x || 0)
      .attr('y1', (d: any) => d.source.y || 0)
      .attr('x2', (d: any) => d.target.x || 0)
      .attr('y2', (d: any) => d.target.y || 0)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1)
      .attr('opacity', 0.6);

  }, []);

  // Setup D3 SVG reference
  const svgRef = useD3(renderD3, [nodes, dimensions, enableZoom, enableBrush]);

  // Handle loading and error states
  useEffect(() => {
    if (!loading && !queryError) {
      setIsReady(true);
    }
  }, [loading, queryError]);

  // Error display
  if (queryError || error) {
    return (
      <div className={`flex items-center justify-center bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="text-center">
          <div className="text-red-600 font-medium">D3 Canvas Error</div>
          <div className="text-red-500 text-sm mt-1">
            {(typeof queryError === 'string' ? queryError : (queryError as any)?.message || 'Unknown error') || error}
          </div>
        </div>
      </div>
    );
  }

  // Loading display
  if (loading || !isReady) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-gray-600 text-sm">Loading D3 visualization...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{ minHeight: '400px' }}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />

      {/* Development info overlay */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          D3Canvas: {nodes?.length || 0} nodes, {dimensions.width}x{dimensions.height}
        </div>
      )}
    </div>
  );
};

export default D3Canvas;