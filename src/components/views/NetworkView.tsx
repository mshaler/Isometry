/**
 * NetworkView — Force-directed network graph visualization
 *
 * Renders nodes and edges as a force-directed graph using D3.js.
 * Integrates with:
 * - useSQLiteQuery for data fetching (nodes and edges)
 * - useFilters + compileFilters for LATCH filter support
 * - useForceSimulation for simulation lifecycle management
 * - useSelection for cross-canvas selection sync
 *
 * Architecture: D3 handles rendering and physics, React handles data and state.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { useCanvasTheme } from '@/hooks';
import { useFilters } from '@/state/FilterContext';
import { useSelection } from '@/state/SelectionContext';
import { compileFilters } from '@/filters/compiler';
import { useSQLiteQuery } from '@/hooks/database/useSQLiteQuery';
import { useForceSimulation } from '@/hooks/visualization/useForceSimulation';
import { createColorScale, setupZoom } from '@/d3/hooks';
import { getTheme, type ThemeName } from '@/styles/themes';
import { graphAnalytics, type ConnectionSuggestion, type GraphMetrics } from '@/services/analytics/GraphAnalyticsAdapter';
import { devLogger } from '@/utils/logging/dev-logger';
import type {
  GraphNode,
  GraphLink,
  EdgeType,
} from '@/d3/visualizations/network/types';

// ============================================================================
// Local Type Definitions
// ============================================================================

/** Database row for nodes */
interface NodeRow {
  id: string;
  name: string;
  folder: string | null;
  priority: number;
}

/** Database row for edges */
interface EdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: string;
  weight: number;
  label: string | null;
}

/** Suggestion link for analytics overlay */
interface SuggestionLink {
  source: GraphNode;
  target: GraphNode;
  suggestion: ConnectionSuggestion;
}

// ============================================================================
// Transform Functions (stable references outside component)
// ============================================================================

const nodeTransform = (rows: Record<string, unknown>[]): NodeRow[] =>
  rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    folder: (row.folder as string) ?? null,
    priority: (row.priority as number) ?? 3,
  }));

const edgeTransform = (rows: Record<string, unknown>[]): EdgeRow[] =>
  rows.map(row => ({
    id: row.id as string,
    source_id: row.source_id as string,
    target_id: row.target_id as string,
    edge_type: row.edge_type as string,
    weight: (row.weight as number) ?? 1,
    label: (row.label as string) ?? null,
  }));

// ============================================================================
// NetworkView Component
// ============================================================================

export function NetworkView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const { theme } = useTheme();
  const canvasTheme = useCanvasTheme();

  // Selection integration
  const { select, isSelected, registerScrollToNode, unregisterScrollToNode } = useSelection();
  const [localSelectedNode, setLocalSelectedNode] = useState<string | null>(null);

  // Container dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Graph analytics state
  const [connectionSuggestions, setConnectionSuggestions] = useState<ConnectionSuggestion[]>([]);
  const [graphMetrics, setGraphMetrics] = useState<GraphMetrics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.3);

  // LATCH filter integration
  const { activeFilters } = useFilters();

  // Compile filters to SQL WHERE clause
  const { nodesSql, nodesParams } = useMemo(() => {
    const compiled = compileFilters(activeFilters);
    return {
      nodesSql: `SELECT id, name, folder, priority FROM nodes WHERE ${compiled.sql} LIMIT 500`,
      nodesParams: compiled.params,
    };
  }, [activeFilters]);

  // Fetch nodes with SQL query
  const { data: nodeRows, loading: nodesLoading, error: nodesError } = useSQLiteQuery<NodeRow>(
    nodesSql,
    nodesParams,
    { transform: nodeTransform }
  );

  // Fetch edges (no filter needed - edges are filtered by which nodes exist)
  const { data: edgeRows, loading: edgesLoading, error: edgesError } = useSQLiteQuery<EdgeRow>(
    'SELECT id, source_id, target_id, edge_type, weight, label FROM edges',
    [],
    { transform: edgeTransform }
  );

  // Transform database rows to graph format
  const { nodes, links } = useMemo(() => {
    if (!nodeRows || !edgeRows) return { nodes: [], links: [] };

    const nodeMap = new Map(nodeRows.map(n => [n.id, n]));

    const graphNodes: GraphNode[] = nodeRows.map(n => ({
      id: n.id,
      label: n.name,
      group: n.folder ?? 'Unknown',
    }));

    // Filter edges to only include those with valid source/target in current view
    const graphLinks: GraphLink[] = edgeRows
      .filter(e => nodeMap.has(e.source_id) && nodeMap.has(e.target_id))
      .map(e => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        type: e.edge_type as EdgeType,
        weight: e.weight,
      }));

    return { nodes: graphNodes, links: graphLinks };
  }, [nodeRows, edgeRows]);

  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // D3 rendering on tick
  const handleTick = useCallback((_tickNodes: GraphNode[], _tickLinks: GraphLink[]) => {
    const g = gRef.current ? d3.select(gRef.current) : null;
    if (!g) return;

    // Update link positions
    g.selectAll<SVGLineElement, GraphLink>('.link')
      .attr('x1', d => (d.source as GraphNode).x ?? 0)
      .attr('y1', d => (d.source as GraphNode).y ?? 0)
      .attr('x2', d => (d.target as GraphNode).x ?? 0)
      .attr('y2', d => (d.target as GraphNode).y ?? 0);

    // Update link labels
    g.selectAll<SVGTextElement, GraphLink>('.link-label')
      .attr('x', d => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
      .attr('y', d => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2);

    // Update node positions
    g.selectAll<SVGGElement, GraphNode>('.node')
      .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
  }, []);

  // Use simulation hook from 113-01
  const { reheat: _reheat, stop: _stop, state: simState } = useForceSimulation({
    containerRef: gRef,
    nodes,
    links,
    config: { width: dimensions.width, height: dimensions.height },
    enabled: nodes.length > 0 && !nodesLoading && !edgesLoading,
    onTick: handleTick,
  });

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
    if (!localSelectedNode) return;

    // Here you would implement the logic to create the connection
    devLogger.info('Applying suggestion:', { suggestion });

    // Refresh suggestions after applying
    await fetchConnectionSuggestions(localSelectedNode);
  }, [localSelectedNode, fetchConnectionSuggestions]);

  // Effect to fetch suggestions when node is selected
  useEffect(() => {
    if (localSelectedNode) {
      fetchConnectionSuggestions(localSelectedNode);
    } else {
      setConnectionSuggestions([]);
      setShowSuggestions(false);
    }
  }, [localSelectedNode, fetchConnectionSuggestions]);

  // Effect to fetch graph metrics on mount
  useEffect(() => {
    fetchGraphMetrics();
  }, [fetchGraphMetrics]);

  // Register scrollToNode for cross-canvas sync
  useEffect(() => {
    registerScrollToNode((id: string) => {
      // Find the node and focus on it (pan to center)
      const node = nodes.find(n => n.id === id);
      if (node && node.x !== undefined && node.y !== undefined) {
        setLocalSelectedNode(id);
        // Could add zoom/pan to node here if needed
      }
    });
    return () => unregisterScrollToNode();
  }, [nodes, registerScrollToNode, unregisterScrollToNode]);

  // D3 rendering effect for initial setup and data changes
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodesLoading || edgesLoading) return;

    // Handle loading states and errors
    if (nodesError) {
      console.error('NetworkView nodes error:', nodesError);
      return;
    }
    if (edgesError) {
      console.error('NetworkView edges error:', edgesError);
      return;
    }

    const { width, height } = dimensions;
    const themeValues = getTheme(theme as ThemeName);

    const svg = d3.select(svgRef.current);
    svg.attr('width', width).attr('height', height);

    // Create or select main group
    let g = svg.select<SVGGElement>('.network-container');
    if (g.empty()) {
      g = svg.append('g').attr('class', 'network-container');
      setupZoom(svg, g, { scaleExtent: [0.2, 4] });
    }
    gRef.current = g.node();

    // Create color scale
    const folders = Array.from(new Set(nodes.map(n => n.group).filter(Boolean)));
    const colorScale = createColorScale(folders, theme as ThemeName);

    // Arrow marker for directed edges
    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) {
      defs = svg.append('defs');
    }

    // Remove old markers and recreate
    defs.selectAll('marker').remove();

    defs.append('marker')
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

    defs.append('marker')
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

    // Links group
    let linksGroup = g.select<SVGGElement>('.links');
    if (linksGroup.empty()) {
      linksGroup = g.append('g').attr('class', 'links');
    }

    linksGroup
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links, d => d.id ?? `${(d.source as GraphNode).id}-${(d.target as GraphNode).id}`)
      .join(
        enter => enter
          .append('line')
          .attr('class', 'link')
          .attr('stroke', themeValues.chart.grid)
          .attr('stroke-width', d => Math.sqrt(d.weight) * 1.5)
          .attr('stroke-opacity', 0)
          .attr('marker-end', 'url(#arrow)')
          .call(el => el.transition().duration(300).attr('stroke-opacity', 0.6)),
        update => update
          .call(el => el.transition().duration(200).attr('stroke-width', d => Math.sqrt(d.weight) * 1.5)),
        exit => exit
          .call(el => el.transition().duration(200).attr('stroke-opacity', 0).remove())
      );

    // Link labels group
    let linkLabelsGroup = g.select<SVGGElement>('.link-labels');
    if (linkLabelsGroup.empty()) {
      linkLabelsGroup = g.append('g').attr('class', 'link-labels');
    }

    // Only show labels for links that have them (from original edge data)
    const labelsData = links.filter(l => {
      const edge = edgeRows?.find(e => e.id === l.id);
      return edge?.label;
    });

    linkLabelsGroup
      .selectAll<SVGTextElement, GraphLink>('text')
      .data(labelsData, d => d.id ?? '')
      .join(
        enter => enter
          .append('text')
          .attr('class', 'link-label text-xs')
          .attr('fill', themeValues.text.secondary)
          .attr('text-anchor', 'middle')
          .attr('opacity', 0)
          .text(d => {
            const edge = edgeRows?.find(e => e.id === d.id);
            return edge?.label ?? '';
          })
          .call(el => el.transition().duration(300).attr('opacity', 1)),
        update => update,
        exit => exit.call(el => el.transition().duration(200).attr('opacity', 0).remove())
      );

    // Suggestion links group
    let suggestionLinksGroup = g.select<SVGGElement>('.suggestion-links');
    if (suggestionLinksGroup.empty()) {
      suggestionLinksGroup = g.append('g').attr('class', 'suggestion-links');
    }

    // Update suggestion links
    if (localSelectedNode && connectionSuggestions.length > 0) {
      const selectedNodeData = nodes.find(n => n.id === localSelectedNode);
      if (selectedNodeData) {
        const suggestionLinkData: SuggestionLink[] = connectionSuggestions
          .filter(s => s.confidence >= confidenceThreshold)
          .map(suggestion => {
            const targetNode = nodes.find(n => n.id === suggestion.nodeId);
            return targetNode ? { source: selectedNodeData, target: targetNode, suggestion } : null;
          })
          .filter((s): s is SuggestionLink => s !== null);

        suggestionLinksGroup
          .selectAll<SVGLineElement, SuggestionLink>('line')
          .data(suggestionLinkData, d => d.suggestion.id)
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
      }
    } else {
      suggestionLinksGroup.selectAll('line').remove();
    }

    // Nodes group
    let nodesGroup = g.select<SVGGElement>('.nodes');
    if (nodesGroup.empty()) {
      nodesGroup = g.append('g').attr('class', 'nodes');
    }

    const nodeSelection = nodesGroup
      .selectAll<SVGGElement, GraphNode>('g.node')
      .data(nodes, d => d.id)
      .join(
        enter => {
          const nodeEnter = enter
            .append('g')
            .attr('class', 'node')
            .style('cursor', 'pointer')
            .style('opacity', 0);

          // Node circles
          nodeEnter.append('circle')
            .attr('r', 12)
            .attr('fill', d => colorScale(d.group))
            .attr('stroke', d => isSelected(d.id)
              ? (theme === 'NeXTSTEP' ? '#000000' : '#3b82f6')
              : themeValues.chart.stroke
            )
            .attr('stroke-width', d => isSelected(d.id) ? 3 : 1.5);

          // Node labels
          nodeEnter.append('text')
            .attr('dy', 30)
            .attr('text-anchor', 'middle')
            .attr('class', 'text-xs font-medium')
            .attr('fill', themeValues.chart.axisText)
            .text(d => d.label.length > 12 ? d.label.slice(0, 12) + '...' : d.label);

          return nodeEnter.call(el => el.transition().duration(300).style('opacity', 1));
        },
        update => update.call(el => el.transition().duration(200).style('opacity', 1)),
        exit => exit.call(el => el.transition().duration(200).style('opacity', 0).remove())
      );

    // Update selection styling on existing nodes
    nodeSelection.select('circle')
      .attr('stroke', d => isSelected(d.id)
        ? (theme === 'NeXTSTEP' ? '#000000' : '#3b82f6')
        : themeValues.chart.stroke
      )
      .attr('stroke-width', d => isSelected(d.id) ? 3 : 1.5);

    // Node click handler - integrates with SelectionContext
    nodeSelection.on('click', (event, d) => {
      event.stopPropagation();
      setLocalSelectedNode(prev => prev === d.id ? null : d.id);
      select(d.id);
    });

    // Background click to deselect
    svg.on('click', () => {
      setLocalSelectedNode(null);
    });

    // Cleanup: stop simulation managed by hook
  }, [
    nodes, links, edgeRows, nodesLoading, edgesLoading, nodesError, edgesError,
    theme, dimensions, localSelectedNode, connectionSuggestions, confidenceThreshold,
    applySuggestion, select, isSelected
  ]);

  const isLoading = nodesLoading || edgesLoading;
  const hasError = nodesError || edgesError;
  const isEmpty = !isLoading && !hasError && links.length === 0;

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-sm ${canvasTheme.emptyState}`}>
            Loading network...
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-sm text-red-500">
            Error loading network data
          </div>
        </div>
      )}

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
      {localSelectedNode && showSuggestions && (
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

      {/* Empty state */}
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-sm ${canvasTheme.emptyState}`}>
            No edges defined. Add relationships to see the network.
          </div>
        </div>
      )}

      {/* Simulation state indicator (debug) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 text-xs text-gray-400">
          Simulation: {simState}
        </div>
      )}
    </div>
  );
}
