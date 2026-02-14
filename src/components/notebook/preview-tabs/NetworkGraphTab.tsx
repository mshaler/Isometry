/**
 * NetworkGraphTab Component
 *
 * React component for rendering force-directed network graph visualization.
 * Displays GRAPH relationships (LINK, NEST, SEQUENCE, AFFINITY) as an
 * interactive D3 force simulation.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { Network, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useSelection } from '../../../state/SelectionContext';
import { useForceGraph } from '../../../hooks/visualization/useForceGraph';
import { ForceGraphRenderer } from '../../../d3/visualizations/network';
import type { ForceGraphCallbacks, ForceGraphConfig } from '../../../d3/visualizations/network';

// ============================================================================
// Component Types
// ============================================================================

export interface NetworkGraphTabProps {
  /** Callback when a node is selected */
  onNodeSelect?: (nodeId: string) => void;
  /** Maximum nodes to display */
  maxNodes?: number;
  /** CSS class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function NetworkGraphTab({
  onNodeSelect,
  maxNodes = 100,
  className = '',
}: NetworkGraphTabProps): JSX.Element {
  const { theme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ForceGraphRenderer | null>(null);

  // Track dimensions for responsive sizing
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Hover state for tooltip
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // SYNC-03: Selection synchronized via SelectionContext
  // When user clicks node here, selection updates everywhere
  // When selection changes elsewhere, node highlight updates here
  const { selection, select, clear, isSelected } = useSelection();

  // Get graph data from hook (excluding local selection state which we now get from context)
  const {
    nodes,
    links,
    loading,
    error,
    nodeCount,
    linkCount,
  } = useForceGraph({ maxNodes });

  // SYNC-03: Selected node from shared context
  const selectedNodeId = selection.lastSelectedId;

  // Handle node click - SYNC-03: Toggle selection via shared context
  const handleNodeClick = useCallback((nodeId: string) => {
    const isCurrentlySelected = isSelected(nodeId);
    if (isCurrentlySelected) {
      clear();
    } else {
      select(nodeId);
    }

    // Call external callback if provided
    if (onNodeSelect && !isCurrentlySelected) {
      onNodeSelect(nodeId);
    }
  }, [isSelected, select, clear, onNodeSelect]);

  // Handle hover
  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, []);

  // Resize observer for container dimensions
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Initialize and update force graph
  useEffect(() => {
    if (!svgRef.current || loading || nodes.length === 0) return;

    // Get the SVG group element
    const svg = svgRef.current;
    let gElement = svg.querySelector<SVGGElement>('g.graph-container');
    if (!gElement) {
      gElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gElement.setAttribute('class', 'graph-container');
      svg.appendChild(gElement);
    }

    // Create configuration
    const config: Partial<ForceGraphConfig> = {
      width: dimensions.width,
      height: dimensions.height,
      nodeRadius: 8,
      linkDistance: 100,
      chargeStrength: -300,
      collisionRadius: 30,
      maxTicks: 300,
      maxTime: 3000,
    };

    // Create callbacks
    const callbacks: ForceGraphCallbacks = {
      onNodeClick: handleNodeClick,
      onNodeHover: handleNodeHover,
    };

    // Create or update renderer
    if (!rendererRef.current) {
      rendererRef.current = new ForceGraphRenderer();
    }

    // Clone nodes and links to avoid D3 mutating original data
    const nodesCopy = nodes.map(n => ({ ...n }));
    const linksCopy = links.map(l => ({ ...l }));

    rendererRef.current.render(gElement, nodesCopy, linksCopy, config, callbacks);

    // Cleanup on unmount
    return () => {
      rendererRef.current?.stop();
    };
  }, [nodes, links, loading, dimensions, handleNodeClick, handleNodeHover]);

  // Update selection highlight when selectedNodeId changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setSelectedNode(selectedNodeId);
    }
  }, [selectedNodeId]);

  // Get selected node info for overlay
  const selectedNode = selectedNodeId
    ? nodes.find(n => n.id === selectedNodeId)
    : null;

  const selectedNodeEdgeCount = selectedNodeId
    ? links.filter(l => {
        const source = typeof l.source === 'string' ? l.source : l.source.id;
        const target = typeof l.target === 'string' ? l.target : l.target.id;
        return source === selectedNodeId || target === selectedNodeId;
      }).length
    : 0;

  // Hovered node info for tooltip
  const hoveredNode = hoveredNodeId
    ? nodes.find(n => n.id === hoveredNodeId)
    : null;

  // Theme-aware colors
  const bgColor = theme === 'NeXTSTEP' ? 'bg-[#e8e8e8]' : 'bg-gray-50';
  const borderColor = theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-200';
  const textColor = theme === 'NeXTSTEP' ? 'text-gray-800' : 'text-gray-700';

  // Loading state
  if (loading) {
    return (
      <div className={`h-full flex items-center justify-center ${bgColor} ${className}`}>
        <div className="text-center">
          <Loader2 size={48} className="mx-auto mb-3 text-blue-500 animate-spin" />
          <div className={`text-sm font-medium ${textColor}`}>Loading graph data...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`h-full flex items-center justify-center ${bgColor} ${className}`}>
        <div className="text-center max-w-md p-4">
          <AlertCircle size={48} className="mx-auto mb-3 text-red-500" />
          <div className="text-sm font-medium text-red-600 mb-2">Error loading graph</div>
          <div className="text-xs text-gray-500">{error.message}</div>
        </div>
      </div>
    );
  }

  // Empty state
  if (nodes.length === 0) {
    return (
      <div className={`h-full flex items-center justify-center ${bgColor} ${className}`}>
        <div className="text-center">
          <Network size={48} className="mx-auto mb-3 text-gray-400" />
          <div className={`text-sm font-medium ${textColor} mb-1`}>No graph data</div>
          <div className="text-xs text-gray-500">
            Add nodes and edges to visualize relationships
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`h-full relative ${bgColor} ${className}`}>
      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
        style={{ background: theme === 'NeXTSTEP' ? '#e8e8e8' : '#fafafa' }}
      >
        {/* Graph content rendered by D3 */}
      </svg>

      {/* Selected Node Info Overlay */}
      {selectedNode && (
        <div className={`absolute top-3 right-3 ${theme === 'NeXTSTEP' ? 'bg-white' : 'bg-white'} ${borderColor} border rounded-lg shadow-md p-3 max-w-xs`}>
          <div className="text-xs text-gray-500 mb-1">Selected Node</div>
          <div className={`font-medium ${textColor} truncate`} title={selectedNode.label}>
            {selectedNode.label}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            <span className="inline-flex items-center gap-1">
              Folder: <span className="font-medium">{selectedNode.group}</span>
            </span>
          </div>
          <div className="text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              Edges: <span className="font-medium">{selectedNodeEdgeCount}</span>
            </span>
          </div>
        </div>
      )}

      {/* Hover Tooltip */}
      {hoveredNode && hoveredNode.id !== selectedNodeId && (
        <div className="absolute pointer-events-none bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg" style={{ bottom: 12, left: 12 }}>
          {hoveredNode.label}
        </div>
      )}

      {/* Stats Badge */}
      <div className={`absolute bottom-3 left-3 ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'} ${borderColor} border rounded px-2 py-1`}>
        <span className="text-xs text-gray-600">
          {nodeCount} nodes, {linkCount} edges
        </span>
      </div>
    </div>
  );
}

