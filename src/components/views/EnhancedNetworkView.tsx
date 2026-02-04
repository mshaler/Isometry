import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { useCanvasTheme } from '@/hooks/useComponentTheme';
import { useSQLiteQuery } from '@/hooks/useSQLiteQuery';
import { createColorScale, setupZoom } from '@/d3/hooks';
import { getTheme, type ThemeName } from '@/styles/themes';
import { useGraphAnalytics, useConnectionSuggestions, useGraphMetrics } from '@/hooks/useGraphAnalytics';
import { type ConnectionSuggestion } from '@/services/ConnectionSuggestionService';
import { graphPerformanceMonitor } from '@/utils/GraphPerformanceMonitor';
import { performanceMonitor } from '@/utils/d3Performance';
import type { Node } from '@/types/node';
import type {
  SimulationNodeDatum,
  SimulationLinkDatum,
  D3ForceSimulation
} from '@/types/d3';

interface EdgeData {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  weight: number;
  label: string | null;
}

interface EnhancedNetworkViewProps {
  data: Node[];
  onNodeClick?: (node: Node) => void;
  showDebugPanel?: boolean;
  enablePerformanceMonitoring?: boolean;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  name: string;
  folder: string | null;
  priority: number;
  importance?: number; // Centrality-based importance score
  communityId?: string; // Community detection cluster ID
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  type: string;
  weight: number;
  label: string | null;
}

interface SuggestionVisualization {
  suggestion: ConnectionSuggestion;
  source: SimNode;
  target: SimNode;
  opacity: number;
  strokeWidth: number;
  color: string;
}

// Enhanced configuration interface
interface NetworkViewConfig {
  suggestion: {
    minConfidence: number;
    maxSuggestions: number;
    enableRealTimeUpdates: boolean;
    showTooltips: boolean;
    enableAcceptanceTracking: boolean;
  };
  visualization: {
    enableLOD: boolean;
    lodThresholds: {
      detailed: number;
      simplified: number;
      minimal: number;
    };
    enableViewportCulling: boolean;
    animationDuration: number;
  };
  analytics: {
    trackInteractions: boolean;
    enablePerformanceOptimization: boolean;
    showMetricsOverlay: boolean;
  };
}

// Connection suggestion type configuration
const SUGGESTION_TYPES = {
  content: { color: '#3b82f6', label: 'Content Similarity' },
  community: { color: '#10b981', label: 'Community Structure' },
  temporal: { color: '#f59e0b', label: 'Temporal Pattern' },
  semantic: { color: '#8b5cf6', label: 'Semantic Relationship' },
  collaborative: { color: '#ef4444', label: 'Collaborative Filtering' },
  structural: { color: '#6b7280', label: 'Structural Analysis' }
};

export function EnhancedNetworkView({
  data,
  onNodeClick,
  showDebugPanel: _showDebugPanel = false,
  enablePerformanceMonitoring = true
}: EnhancedNetworkViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const canvasTheme = useCanvasTheme();

  // Enhanced state management
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredSuggestion, setHoveredSuggestion] = useState<ConnectionSuggestion | null>(null);
  const [suggestionHistory, setSuggestionHistory] = useState<ConnectionSuggestion[]>([]);
  const [viewportBounds, setViewportBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<{ fps: number; renderTime: number; nodeCount: number }>({
    fps: 60,
    renderTime: 0,
    nodeCount: 0
  });

  // Configuration with intelligent defaults
  const [config, setConfig] = useState<NetworkViewConfig>({
    suggestion: {
      minConfidence: 0.3,
      maxSuggestions: 10,
      enableRealTimeUpdates: true,
      showTooltips: true,
      enableAcceptanceTracking: true
    },
    visualization: {
      enableLOD: data.length > 100,
      lodThresholds: {
        detailed: 100,
        simplified: 500,
        minimal: 1000
      },
      enableViewportCulling: data.length > 200,
      animationDuration: 300
    },
    analytics: {
      trackInteractions: true,
      enablePerformanceOptimization: true,
      showMetricsOverlay: enablePerformanceMonitoring
    }
  });

  // Filter configuration for suggestion types
  const [enabledSuggestionTypes, setEnabledSuggestionTypes] = useState<Set<string>>(
    new Set(Object.keys(SUGGESTION_TYPES))
  );

  // Enhanced analytics hooks integration
  const graphAnalytics = useGraphAnalytics(selectedNode || undefined);
  const connectionSuggestions = useConnectionSuggestions(selectedNode || '', {
    maxSuggestions: config.suggestion.maxSuggestions,
    minConfidence: config.suggestion.minConfidence,
    excludeExistingConnections: true
  });
  const graphMetrics = useGraphMetrics();

  // Fetch edges with enhanced error handling
  const { data: edges, loading: edgesLoading, error: edgesError } = useSQLiteQuery<EdgeData>('SELECT * FROM edges');

  // Performance monitoring integration
  const performanceMetricsRef = useRef<{ startTime: number; frameCount: number }>({
    startTime: Date.now(),
    frameCount: 0
  });

  // Memoized computations for performance
  const { visibleNodes, visibleEdges, lodLevel } = useMemo(() => {
    if (!config.visualization.enableLOD || !viewportBounds) {
      return {
        visibleNodes: data,
        visibleEdges: edges || [],
        lodLevel: 'detailed' as const
      };
    }

    const nodeCount = data.length;
    let level: 'detailed' | 'simplified' | 'minimal';

    if (nodeCount <= config.visualization.lodThresholds.detailed) {
      level = 'detailed';
    } else if (nodeCount <= config.visualization.lodThresholds.simplified) {
      level = 'simplified';
    } else {
      level = 'minimal';
    }

    // Viewport culling implementation
    const visibleNodes = config.visualization.enableViewportCulling
      ? data.filter((node, index) => {
          // Simplified viewport culling - in production this would use actual node positions
          return index % (level === 'minimal' ? 4 : level === 'simplified' ? 2 : 1) === 0;
        })
      : data;

    const nodeIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = (edges || []).filter(edge =>
      nodeIds.has(edge.source_id) && nodeIds.has(edge.target_id)
    );

    return { visibleNodes, visibleEdges, lodLevel: level };
  }, [data, edges, viewportBounds, config.visualization]);

  // Enhanced suggestion filtering with type support
  const filteredSuggestions = useMemo((): SuggestionVisualization[] => {
    if (!selectedNode || !connectionSuggestions.suggestions.length) {
      return [];
    }

    const selectedNodeData = visibleNodes.find(n => n.id === selectedNode);
    if (!selectedNodeData) return [];

    return connectionSuggestions.suggestions
      .filter(suggestion =>
        suggestion.confidence >= config.suggestion.minConfidence &&
        enabledSuggestionTypes.has(suggestion.type)
      )
      .map(suggestion => {
        const targetNode = visibleNodes.find(n => n.id === suggestion.nodeId);
        if (!targetNode) return null;

        const typeConfig = SUGGESTION_TYPES[suggestion.type as keyof typeof SUGGESTION_TYPES] || SUGGESTION_TYPES.content;
        const opacity = Math.max(0.3, Math.min(0.9, suggestion.confidence));
        const strokeWidth = Math.max(1, Math.min(4, suggestion.confidence * 4));

        return {
          suggestion,
          source: selectedNodeData as unknown as SimNode,
          target: targetNode as unknown as SimNode,
          opacity,
          strokeWidth,
          color: typeConfig.color
        };
      })
      .filter((viz): viz is SuggestionVisualization => viz !== null)
      .slice(0, config.suggestion.maxSuggestions);
  }, [
    selectedNode,
    connectionSuggestions.suggestions,
    visibleNodes,
    config.suggestion.minConfidence,
    config.suggestion.maxSuggestions,
    enabledSuggestionTypes
  ]);

  // Enhanced suggestion acceptance with analytics tracking
  const acceptSuggestion = useCallback(async (suggestion: ConnectionSuggestion) => {
    if (!selectedNode) return;

    try {
      // Track acceptance for analytics
      if (config.suggestion.enableAcceptanceTracking) {
        connectionSuggestions.acceptSuggestion(suggestion.id);
        graphPerformanceMonitor.trackSuggestionLatency(selectedNode, 0, 1);
      }

      // Add to history
      setSuggestionHistory(prev => [suggestion, ...prev.slice(0, 9)]); // Keep last 10

      // Log for implementation (in real system, this would create the connection)
      console.info('Accepting suggestion:', {
        suggestion,
        confidence: suggestion.confidence,
        type: suggestion.type,
        reason: suggestion.reason
      });

      // Refresh suggestions after acceptance
      await connectionSuggestions.refreshSuggestions();

    } catch (error) {
      console.error('Failed to accept suggestion:', error);
    }
  }, [selectedNode, connectionSuggestions, config.suggestion.enableAcceptanceTracking]);

  // Enhanced node importance calculation
  const calculateNodeImportance = useCallback((nodeId: string): number => {
    if (!edges || edges.length === 0) return 0;

    const connections = edges.filter(edge =>
      edge.source_id === nodeId || edge.target_id === nodeId
    );

    // Simple centrality calculation - in production this would be more sophisticated
    const degree = connections.length;
    const weightSum = connections.reduce((sum, edge) => sum + edge.weight, 0);

    return Math.log(degree + 1) * Math.log(weightSum + 1);
  }, [edges]);

  // Community detection simulation (simplified)
  const assignCommunities = useCallback((nodes: Node[]): Map<string, string> => {
    const communities = new Map<string, string>();

    // Simplified community assignment based on folder groupings
    const folderGroups = new Map<string, string>();
    let communityId = 0;

    nodes.forEach(node => {
      const folder = node.folder || 'unknown';
      if (!folderGroups.has(folder)) {
        folderGroups.set(folder, `community-${communityId++}`);
      }
      communities.set(node.id, folderGroups.get(folder)!);
    });

    return communities;
  }, []);

  // Performance monitoring integration
  useEffect(() => {
    if (!enablePerformanceMonitoring) return;

    const updatePerformanceMetrics = () => {
      const now = Date.now();
      const elapsed = now - performanceMetricsRef.current.startTime;
      performanceMetricsRef.current.frameCount++;

      if (elapsed >= 1000) { // Update every second
        const fps = Math.round((performanceMetricsRef.current.frameCount * 1000) / elapsed);
        const renderTime = performanceMonitor.getLastRenderTime() || 0;

        setPerformanceMetrics({
          fps,
          renderTime,
          nodeCount: visibleNodes.length
        });

        // Reset counters
        performanceMetricsRef.current.startTime = now;
        performanceMetricsRef.current.frameCount = 0;
      }

      requestAnimationFrame(updatePerformanceMetrics);
    };

    requestAnimationFrame(updatePerformanceMetrics);
  }, [enablePerformanceMonitoring, visibleNodes.length]);

  // Main D3 visualization effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !visibleNodes.length) return;

    const startTime = performance.now();
    performanceMonitor.startMetric('enhanced-network-render');

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const themeValues = getTheme(theme as ThemeName);

    // Update viewport bounds for culling
    setViewportBounds({ x: 0, y: 0, width, height });

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    // Convert data to simulation format with enhancements
    const communities = assignCommunities(visibleNodes);
    const nodes: SimNode[] = visibleNodes.map(d => ({
      id: d.id,
      name: d.name,
      folder: d.folder,
      priority: d.priority,
      importance: calculateNodeImportance(d.id),
      communityId: communities.get(d.id)
    }));

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Filter edges for visible nodes only
    const links: SimLink[] = visibleEdges
      .filter(e => nodeMap.has(e.source_id) && nodeMap.has(e.target_id))
      .map(e => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        type: e.type,
        weight: e.weight,
        label: e.label,
      }));

    // Enhanced color scale with community support
    const folders = Array.from(new Set(nodes.map(n => n.folder).filter(Boolean))) as string[];
    const colorScale = createColorScale(folders, theme as ThemeName);
    const communityColorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Create simulation with performance-optimized forces
    const simulation: D3ForceSimulation<SimNode> = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links)
        .id(d => d.id)
        .distance(d => 50 + (d.weight * 30))
        .strength(0.3))
      .force('charge', d3.forceManyBody()
        .strength(d => -100 - (d.importance || 0) * 50)
        .distanceMax(300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide()
        .radius(d => 20 + (d.importance || 0) * 10))
      .velocityDecay(0.8); // Faster stabilization for performance

    // Main group with performance optimizations
    const g = svg.append('g');

    // Setup zoom with constraints
    setupZoom(svg, g, {
      scaleExtent: [0.2, 4],
      on: {
        'zoom': () => {
          // Update viewport culling bounds during zoom
          const transform = d3.zoomTransform(svg.node()!);
          setViewportBounds({
            x: -transform.x / transform.k,
            y: -transform.y / transform.k,
            width: width / transform.k,
            height: height / transform.k
          });
        }
      }
    });

    // Enhanced marker definitions for different suggestion types
    const defs = svg.append('defs');

    // Regular arrow marker
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

    // Suggestion arrow markers for each type
    Object.entries(SUGGESTION_TYPES).forEach(([type, config]) => {
      defs.append('marker')
        .attr('id', `suggestion-arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', config.color)
        .attr('d', 'M0,-5L10,0L0,5');
    });

    // Links with LOD-based rendering
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', themeValues.chart.grid)
      .attr('stroke-width', d => {
        if (lodLevel === 'minimal') return 1;
        if (lodLevel === 'simplified') return Math.sqrt(d.weight) * 1.2;
        return Math.sqrt(d.weight) * 1.5;
      })
      .attr('stroke-opacity', lodLevel === 'minimal' ? 0.3 : 0.6)
      .attr('marker-end', lodLevel !== 'minimal' ? 'url(#arrow)' : null);

    // Link labels (only in detailed mode)
    const linkLabels = lodLevel === 'detailed' ? g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links.filter(l => l.label))
      .join('text')
      .attr('class', 'text-xs')
      .attr('fill', themeValues.text.secondary)
      .attr('text-anchor', 'middle')
      .text(d => d.label || '') : null;

    // Suggestion links container
    const suggestionLinks = g.append('g')
      .attr('class', 'suggestion-links');

    // Enhanced suggestion link rendering
    const updateSuggestionLinks = () => {
      const suggestionLinkData = filteredSuggestions;

      const links = suggestionLinks
        .selectAll('line.suggestion')
        .data(suggestionLinkData, d => d.suggestion.id);

      links.exit()
        .transition()
        .duration(config.visualization.animationDuration)
        .attr('stroke-opacity', 0)
        .remove();

      const linksEnter = links.enter()
        .append('line')
        .attr('class', 'suggestion')
        .attr('stroke-opacity', 0);

      links.merge(linksEnter)
        .attr('stroke', d => d.color)
        .attr('stroke-width', d => d.strokeWidth)
        .attr('stroke-dasharray', '5,5')
        .attr('marker-end', d => `url(#suggestion-arrow-${d.suggestion.type})`)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
          if (config.suggestion.showTooltips) {
            setHoveredSuggestion(d.suggestion);
          }
        })
        .on('mouseout', () => {
          setHoveredSuggestion(null);
        })
        .on('click', (event, d) => {
          event.stopPropagation();
          acceptSuggestion(d.suggestion);
        })
        .transition()
        .duration(config.visualization.animationDuration)
        .attr('stroke-opacity', d => d.opacity);
    };

    // Enhanced nodes with importance-based rendering
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, SimNode>()
        .on('start', (event, d: SimNode) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: SimNode) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: SimNode) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Node circles with importance and community visualization
    node.append('circle')
      .attr('r', d => {
        const baseRadius = 12 + (6 - d.priority) * 2;
        const importanceBonus = lodLevel === 'detailed' ? (d.importance || 0) * 3 : 0;
        return Math.min(25, baseRadius + importanceBonus);
      })
      .attr('fill', d => {
        if (lodLevel === 'detailed' && d.communityId) {
          return communityColorScale(d.communityId);
        }
        return colorScale(d.folder || 'Unknown');
      })
      .attr('stroke', d => selectedNode === d.id
        ? (theme === 'NeXTSTEP' ? '#000000' : '#3b82f6')
        : themeValues.chart.stroke
      )
      .attr('stroke-width', d => selectedNode === d.id ? 3 : 1.5)
      .attr('opacity', lodLevel === 'minimal' ? 0.7 : 1);

    // Node labels with LOD
    if (lodLevel !== 'minimal') {
      node.append('text')
        .attr('dy', d => 25 + (d.importance || 0) * 3)
        .attr('text-anchor', 'middle')
        .attr('class', lodLevel === 'simplified' ? 'text-xs' : 'text-xs font-medium')
        .attr('fill', themeValues.chart.axisText)
        .text(d => {
          const maxLength = lodLevel === 'simplified' ? 8 : 12;
          return d.name.length > maxLength ? d.name.slice(0, maxLength) + '...' : d.name;
        });
    }

    // Node click handler with analytics tracking
    node.on('click', (event, d: SimNode) => {
      event.stopPropagation();

      const newSelectedNode = selectedNode === d.id ? null : d.id;
      setSelectedNode(newSelectedNode);

      if (config.analytics.trackInteractions) {
        graphPerformanceMonitor.trackSuggestionLatency(d.id, 0, 0);
      }

      const nodeData = data.find(c => c.id === d.id);
      if (nodeData) onNodeClick?.(nodeData);
    });

    // Background click to deselect
    svg.on('click', () => setSelectedNode(null));

    // Update positions with performance optimization
    let frameCount = 0;
    simulation.on('tick', () => {
      // Skip some frames for performance in high-node-count scenarios
      frameCount++;
      if (lodLevel === 'minimal' && frameCount % 2 !== 0) return;

      link
        .attr('x1', d => (d.source as SimNode).x!)
        .attr('y1', d => (d.source as SimNode).y!)
        .attr('x2', d => (d.target as SimNode).x!)
        .attr('y2', d => (d.target as SimNode).y!);

      if (linkLabels) {
        linkLabels
          .attr('x', d => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
          .attr('y', d => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2);
      }

      // Update suggestion link positions
      suggestionLinks.selectAll('line.suggestion')
        .attr('x1', (d: SuggestionVisualization) => d.source.x!)
        .attr('y1', (d: SuggestionVisualization) => d.source.y!)
        .attr('x2', (d: SuggestionVisualization) => d.target.x!)
        .attr('y2', (d: SuggestionVisualization) => d.target.y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Update suggestion links when suggestions change
    updateSuggestionLinks();

    // Performance tracking
    const renderTime = performance.now() - startTime;
    performanceMonitor.endMetric('enhanced-network-render');

    if (config.analytics.trackInteractions) {
      graphPerformanceMonitor.trackSuggestionLatency('render', renderTime, nodes.length);
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [
    visibleNodes,
    visibleEdges,
    theme,
    selectedNode,
    onNodeClick,
    filteredSuggestions,
    config,
    lodLevel,
    acceptSuggestion,
    calculateNodeImportance,
    assignCommunities
  ]);

  // Real-time updates subscription
  useEffect(() => {
    if (!config.suggestion.enableRealTimeUpdates) return;

    const unsubscribe = graphAnalytics.subscribeToUpdates((suggestions) => {
      // Handle real-time suggestion updates
      console.debug('Real-time suggestions update:', suggestions.length);
    });

    return unsubscribe;
  }, [graphAnalytics, config.suggestion.enableRealTimeUpdates]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />

      {/* Enhanced Graph Analytics Overlay */}
      {graphMetrics.graphMetrics && config.analytics.showMetricsOverlay && (
        <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-800/90 p-3 rounded-lg shadow-lg text-xs max-w-sm">
          <h4 className="font-semibold mb-2 flex items-center justify-between">
            Graph Analytics
            <span className="text-xs font-normal text-gray-500">
              LOD: {lodLevel}
            </span>
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Nodes: {graphMetrics.graphMetrics.totalNodes}</div>
            <div>Visible: {visibleNodes.length}</div>
            <div>Edges: {graphMetrics.graphMetrics.totalEdges}</div>
            <div>Visible: {visibleEdges.length}</div>
            <div>Density: {(graphMetrics.graphMetrics.graphDensity * 100).toFixed(1)}%</div>
            <div>Avg Tags: {graphMetrics.graphMetrics.averageTagsPerNode.toFixed(1)}</div>
          </div>

          {/* Performance Metrics */}
          {config.analytics.showMetricsOverlay && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs font-medium mb-1">Performance</div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>FPS: {performanceMetrics.fps}</div>
                <div>Render: {performanceMetrics.renderTime.toFixed(1)}ms</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Connection Suggestions Panel */}
      {selectedNode && (connectionSuggestions.suggestions.length > 0 || connectionSuggestions.isLoading) && (
        <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-800/90 p-3 rounded-lg shadow-lg text-xs max-w-sm">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">Connection Suggestions</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {connectionSuggestions.suggestions.length}/{config.suggestion.maxSuggestions}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                ×
              </button>
            </div>
          </div>

          {connectionSuggestions.isLoading ? (
            <div className="text-gray-500 py-2">Loading suggestions...</div>
          ) : (
            <>
              {/* Confidence Threshold Control */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium">Min Confidence</label>
                  <span className="text-xs text-gray-500">
                    {(config.suggestion.minConfidence * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.suggestion.minConfidence}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    suggestion: {
                      ...prev.suggestion,
                      minConfidence: parseFloat(e.target.value)
                    }
                  }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Suggestion Type Filters */}
              <div className="mb-3">
                <label className="text-xs font-medium block mb-1">Suggestion Types</label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(SUGGESTION_TYPES).map(([type, config]) => (
                    <button
                      key={type}
                      onClick={() => {
                        setEnabledSuggestionTypes(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(type)) {
                            newSet.delete(type);
                          } else {
                            newSet.add(type);
                          }
                          return newSet;
                        });
                      }}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        enabledSuggestionTypes.has(type)
                          ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700'
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                      }`}
                      style={{
                        borderColor: enabledSuggestionTypes.has(type) ? config.color : undefined,
                        backgroundColor: enabledSuggestionTypes.has(type) ? `${config.color}20` : undefined
                      }}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggestions List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredSuggestions.length > 0 ? (
                  filteredSuggestions.map((viz) => (
                    <div
                      key={viz.suggestion.id}
                      className={`p-2 border rounded-lg cursor-pointer transition-all ${
                        hoveredSuggestion?.id === viz.suggestion.id
                          ? 'bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}
                      onClick={() => acceptSuggestion(viz.suggestion)}
                      onMouseEnter={() => setHoveredSuggestion(viz.suggestion)}
                      onMouseLeave={() => setHoveredSuggestion(null)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: viz.color }}
                        />
                        <span className="text-xs font-medium">
                          {(viz.suggestion.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="font-medium text-xs mb-1">{viz.suggestion.reason}</div>
                      <div className="text-xs text-gray-500">
                        {SUGGESTION_TYPES[viz.suggestion.type as keyof typeof SUGGESTION_TYPES]?.label || viz.suggestion.type}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 py-2">
                    No suggestions match current filters
                  </div>
                )}
              </div>

              {/* Load More Button */}
              {connectionSuggestions.hasMore && (
                <button
                  onClick={() => connectionSuggestions.loadRemaining?.()}
                  className="w-full mt-2 text-xs py-1 px-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  Load More Suggestions
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Suggestion History Panel */}
      {suggestionHistory.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-gray-800/90 p-3 rounded-lg shadow-lg text-xs max-w-xs">
          <h4 className="font-semibold mb-2">Recent Acceptances</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {suggestionHistory.map((suggestion, index) => (
              <div key={`${suggestion.id}-${index}`} className="text-xs p-1 bg-green-50 dark:bg-green-900/20 rounded">
                <div className="font-medium">{suggestion.reason}</div>
                <div className="text-gray-500">
                  {SUGGESTION_TYPES[suggestion.type as keyof typeof SUGGESTION_TYPES]?.label} • {(suggestion.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hover Tooltip for Suggestions */}
      {hoveredSuggestion && config.suggestion.showTooltips && (
        <div
          className="absolute bg-black/80 text-white text-xs p-2 rounded pointer-events-none z-50"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="font-medium">{hoveredSuggestion.reason}</div>
          <div>Confidence: {(hoveredSuggestion.confidence * 100).toFixed(1)}%</div>
          <div>Type: {SUGGESTION_TYPES[hoveredSuggestion.type as keyof typeof SUGGESTION_TYPES]?.label}</div>
          <div className="text-gray-300 text-xs mt-1">Click to accept</div>
        </div>
      )}

      {/* Empty State */}
      {(!visibleEdges || visibleEdges.length === 0) && !edgesLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-sm ${canvasTheme.emptyState}`}>
            {edgesError ? 'Error loading edges' : 'No edges defined. Add relationships to see the network.'}
          </div>
        </div>
      )}

      {/* Loading State */}
      {edgesLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Loading network data...
          </div>
        </div>
      )}
    </div>
  );
}