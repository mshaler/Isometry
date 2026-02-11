import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { useCanvasTheme, useLiveData } from '@/hooks';
import { createColorScale, setupZoom } from '@/d3/hooks';
import { getTheme, type ThemeName } from '@/styles/themes';
import { graphAnalytics, type ConnectionSuggestion, type GraphMetrics } from '@/services/analytics/GraphAnalyticsAdapter';
import { devLogger } from '@/utils/logging/dev-logger';
import type { Node } from '@/types/node';
import type {
  SimulationNodeDatum,
  SimulationLinkDatum,
  D3ForceSimulation,
  FlexibleSelection
} from '@/types/d3';

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

interface SimNode extends SimulationNodeDatum {
  id: string;
  name: string;
  folder: string | null;
  priority: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  type: string;
  weight: number;
  label: string | null;
}

interface SuggestionLink {
  source: SimNode;
  target: SimNode;
  suggestion: ConnectionSuggestion;
}

export function NetworkView({ data, onNodeClick }: NetworkViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const canvasTheme = useCanvasTheme();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Graph analytics state
  const [connectionSuggestions, setConnectionSuggestions] = useState<ConnectionSuggestion[]>([]);
  const [graphMetrics, setGraphMetrics] = useState<GraphMetrics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.3);

  // Fetch edges with live data subscription
  const { data: edges, isLoading: edgesLoading, error: edgesError } = useLiveData<EdgeData[]>(
    'SELECT * FROM edges',
    [],
    {
      trackPerformance: true,
      throttleMs: 100,
      onPerformanceUpdate: (metrics: unknown) => {
        devLogger.debug('NetworkView edges performance:', { metrics });
      }
    }
  );

  // Analytics functions
  const fetchConnectionSuggestions = useCallback(async (nodeId: string) => {
    if (!nodeId) return;

    setAnalyticsLoading(true);
    try {
      const suggestions = await graphAnalytics.suggestConnections(nodeId, {
        maxSuggestions: 10,
        minConfidence: confidenceThreshold,
        excludeExistingConnections: true
      });
      setConnectionSuggestions(suggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.warn('Failed to fetch connection suggestions:', error);
      setConnectionSuggestions([]);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [confidenceThreshold]);

  const fetchGraphMetrics = useCallback(async () => {
    try {
      const metrics = await graphAnalytics.getGraphMetrics();
      setGraphMetrics(metrics);
    } catch (error) {
      console.warn('Failed to fetch graph metrics:', error);
    }
  }, []);

  const applySuggestion = useCallback(async (suggestion: ConnectionSuggestion) => {
    if (!selectedNode) return;

    // Here you would implement the logic to create the connection
    // This would typically involve adding a new edge to the database
    devLogger.info('Applying suggestion:', { suggestion });

    // Refresh suggestions after applying
    await fetchConnectionSuggestions(selectedNode);
  }, [selectedNode, fetchConnectionSuggestions]);

  // Effect to fetch suggestions when node is selected
  useEffect(() => {
    if (selectedNode) {
      fetchConnectionSuggestions(selectedNode);
    } else {
      setConnectionSuggestions([]);
      setShowSuggestions(false);
    }
  }, [selectedNode, fetchConnectionSuggestions]);

  // Effect to fetch graph metrics on mount
  useEffect(() => {
    fetchGraphMetrics();
  }, [fetchGraphMetrics]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.length || edgesLoading) return;

    // Handle loading states and errors
    if (edgesError) {
      console.error('NetworkView edges error:', edgesError);
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const themeValues = getTheme(theme as ThemeName);

    const svg = d3.select(svgRef.current);

    // Use smooth transitions instead of clearing everything
    const isInitialRender = svg.select('.network-container').empty();

    if (isInitialRender) {
      svg.selectAll('*').remove();
      svg.attr('width', width).attr('height', height);
    }

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
      .filter((e: EdgeData) => nodeMap.has(e.source_id) && nodeMap.has(e.target_id))
      .map((e: EdgeData) => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        type: e.type,
        weight: e.weight,
        label: e.label,
      }));

    // Create color scale using utility
    const folders = Array.from(new Set(nodes.map(n => n.folder).filter(Boolean))) as string[];
    const colorScale = createColorScale(folders, theme as ThemeName);

    // Create simulation
    const simulation: D3ForceSimulation<SimNode> = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links)
        .id(d => d.id)
        .distance(100)
        .strength(0.5))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Main group with consistent naming for transitions
    let g = svg.select<SVGGElement>('.network-container');
    if (g.empty()) {
      g = svg.append('g').attr('class', 'network-container');
      setupZoom(svg, g, { scaleExtent: [0.2, 4] });
    }

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
      .attr('fill', themeValues.chart.axis)
      .attr('d', 'M0,-5L10,0L0,5');

    // Links with smooth transitions
    let linksGroup = g.select<d3.BaseType>('.links');
    if (linksGroup.empty()) {
      linksGroup = g.append('g').attr('class', 'links') as unknown as FlexibleSelection<d3.BaseType>;
    }

    const link = linksGroup
      .selectAll('line')
      .data(links, (d: unknown) => (d as { id: string }).id)
      .join(
        enter => enter
          .append('line')
          .attr('stroke', themeValues.chart.grid)
          .attr('stroke-width', (d: unknown) => Math.sqrt((d as { weight: number }).weight) * 1.5)
          .attr('stroke-opacity', 0)
          .attr('marker-end', 'url(#arrow)')
          .call(enter => enter
            .transition()
            .duration(300)
            .attr('stroke-opacity', 0.6)
          ),
        update => update
          .call(update => update
            .transition()
            .duration(200)
            .attr('stroke-width', (d: unknown) => Math.sqrt((d as { weight: number }).weight) * 1.5)
          ),
        exit => exit
          .call(exit => exit
            .transition()
            .duration(200)
            .attr('stroke-opacity', 0)
            .remove()
          )
      );

    // Link labels with smooth transitions
    let linkLabelsGroup = g.select<d3.BaseType>('.link-labels');
    if (linkLabelsGroup.empty()) {
      linkLabelsGroup = g.append('g').attr('class', 'link-labels') as unknown as FlexibleSelection<d3.BaseType>;
    }

    const linkLabels = linkLabelsGroup
      .selectAll('text')
      .data(links.filter(l => l.label), (d: unknown) => (d as { id: string }).id)
      .join(
        enter => enter
          .append('text')
          .attr('class', 'text-xs')
          .attr('fill', themeValues.text.secondary)
          .attr('text-anchor', 'middle')
          .attr('opacity', 0)
          .text(d => d.label || '')
          .call(enter => enter
            .transition()
            .duration(300)
            .attr('opacity', 1)
          ),
        update => update
          .call(update => update
            .transition()
            .duration(200)
            .text(d => d.label || '')
          ),
        exit => exit
          .call(exit => exit
            .transition()
            .duration(200)
            .attr('opacity', 0)
            .remove()
          )
      );

    // Suggestion links (dashed lines for suggested connections)
    const suggestionLinks = g.append('g')
      .attr('class', 'suggestion-links');

    const updateSuggestionLinks = () => {
      const selectedNodeData = selectedNode ? nodes.find(n => n.id === selectedNode) : null;

      if (selectedNodeData && connectionSuggestions.length > 0) {
        const suggestionLinkData = connectionSuggestions
          .filter(s => s.confidence >= confidenceThreshold)
          .map(suggestion => {
            const targetNode = nodes.find(n => n.id === suggestion.nodeId);
            return targetNode ? {
              source: selectedNodeData,
              target: targetNode,
              suggestion
            } : null;
          })
          .filter(Boolean) as SuggestionLink[];

        suggestionLinks
          .selectAll<SVGLineElement, SuggestionLink>('line')
          .data(suggestionLinkData)
          .join('line')
          .attr('stroke', theme === 'NeXTSTEP' ? '#ff6b35' : '#3b82f6')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,5')
          .attr('stroke-opacity', d => d.suggestion.confidence)
          .attr('marker-end', 'url(#suggestion-arrow)')
          .style('cursor', 'pointer')
          .on('click', (event, d) => {
            event.stopPropagation();
            applySuggestion(d.suggestion);
          });
      } else {
        suggestionLinks.selectAll('line').remove();
      }
    };

    // Suggestion arrow marker
    svg.select('defs').append('marker')
      .attr('id', 'suggestion-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', theme === 'NeXTSTEP' ? '#ff6b35' : '#3b82f6')
      .attr('d', 'M0,-5L10,0L0,5');

    // Nodes with smooth transitions
    let nodesGroup = g.select<d3.BaseType>('.nodes');
    if (nodesGroup.empty()) {
      nodesGroup = g.append('g').attr('class', 'nodes') as unknown as FlexibleSelection<d3.BaseType>;
    }

    const node = nodesGroup
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes, (d: SimNode) => d.id)
      .join(
        enter => enter
          .append('g')
          .attr('class', 'node')
          .style('cursor', 'pointer')
          .style('opacity', 0)
          .call(enter => enter
            .transition()
            .duration(300)
            .style('opacity', 1)
          )
          .call(d3.drag<SVGGElement, SimNode>()
            .on('start', (event, d: SimNode) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on('drag', (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on('end', (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>, d: SimNode) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            })
          ),
        update => update
          .call(update => update
            .transition()
            .duration(200)
            .style('opacity', 1)
          ),
        exit => exit
          .call(exit => exit
            .transition()
            .duration(200)
            .style('opacity', 0)
            .remove()
          )
      );

    // Node circles
    node.append('circle')
      .attr('r', d => 12 + (6 - d.priority) * 2)
      .attr('fill', d => colorScale(d.folder || 'Unknown'))
      .attr('stroke', d => selectedNode === d.id
        ? (theme === 'NeXTSTEP' ? '#000000' : '#3b82f6')
        : themeValues.chart.stroke
      )
      .attr('stroke-width', d => selectedNode === d.id ? 3 : 1.5);

    // Node labels
    node.append('text')
      .attr('dy', 30)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-xs font-medium')
      .attr('fill', themeValues.chart.axisText)
      .text(d => d.name.length > 12 ? d.name.slice(0, 12) + '...' : d.name);

    // Node click handler
    node.on('click', (event, d: SimNode) => {
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

      // Update suggestion link positions
      suggestionLinks.selectAll<SVGLineElement, SuggestionLink>('line')
        .attr('x1', d => d.source.x!)
        .attr('y1', d => d.source.y!)
        .attr('x2', d => d.target.x!)
        .attr('y2', d => d.target.y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Update suggestion links when suggestions change
    updateSuggestionLinks();

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [
    data, edges, edgesLoading, edgesError, theme, selectedNode,
    onNodeClick, connectionSuggestions, confidenceThreshold, applySuggestion
  ]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />

      {/* Graph Analytics Overlay */}
      {graphMetrics && (
        <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-800/90 p-3 rounded-lg shadow-lg text-xs">
          <h4 className="font-semibold mb-2">Graph Metrics</h4>
          <div className="space-y-1">
            <div>Nodes: {graphMetrics.totalNodes}</div>
            <div>Edges: {graphMetrics.totalEdges}</div>
            <div>Density: {(graphMetrics.graphDensity * 100).toFixed(1)}%</div>
            <div>Avg Tags: {graphMetrics.averageTagsPerNode.toFixed(1)}</div>
          </div>
        </div>
      )}

      {/* Connection Suggestions Panel */}
      {selectedNode && showSuggestions && (
        <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-800/90 p-3 rounded-lg shadow-lg text-xs max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">Connection Suggestions</h4>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              ×
            </button>
          </div>

          {analyticsLoading ? (
            <div className="text-gray-500">Loading suggestions...</div>
          ) : connectionSuggestions.length > 0 ? (
            <>
              {/* Confidence Threshold Slider */}
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1">
                  Min Confidence: {(confidenceThreshold * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Suggestions List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {connectionSuggestions
                  .filter(s => s.confidence >= confidenceThreshold)
                  .map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => applySuggestion(suggestion)}
                    >
                      <div className="font-medium text-xs">{suggestion.reason}</div>
                      <div className="text-xs text-gray-500">
                        {suggestion.type} • {(suggestion.confidence * 100).toFixed(0)}% confidence
                      </div>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <div className="text-gray-500">No suggestions available</div>
          )}
        </div>
      )}

      {(!edges || edges.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-sm ${canvasTheme.emptyState}`}>
            No edges defined. Add relationships to see the network.
          </div>
        </div>
      )}
    </div>
  );
}
