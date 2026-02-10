/**
 * Network Graph Types
 *
 * Type definitions for D3 force-directed network graph visualization.
 * Supports GRAPH relationship types: LINK, NEST, SEQUENCE, AFFINITY.
 */

import * as d3 from 'd3';

// ============================================================================
// Edge Types
// ============================================================================

/** GRAPH edge types supported in Isometry */
export type EdgeType = 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';

// ============================================================================
// Node and Link Interfaces
// ============================================================================

/**
 * Graph node for force simulation
 * Extends d3.SimulationNodeDatum for force layout compatibility
 */
export interface GraphNode extends d3.SimulationNodeDatum {
  /** Unique node identifier */
  id: string;
  /** Display label (node name) */
  label: string;
  /** Group for color coding (folder) */
  group: string;
  /** Fixed x position (set during drag) */
  fx?: number | null;
  /** Fixed y position (set during drag) */
  fy?: number | null;
  /** Current x position (set by simulation) */
  x?: number;
  /** Current y position (set by simulation) */
  y?: number;
  /** Velocity x (set by simulation) */
  vx?: number;
  /** Velocity y (set by simulation) */
  vy?: number;
  /** Index in nodes array (set by simulation) */
  index?: number;
}

/**
 * Graph link for force simulation
 * Represents an edge between two nodes
 */
export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  /** Link identifier */
  id?: string;
  /** Source node (ID or node reference) */
  source: string | GraphNode;
  /** Target node (ID or node reference) */
  target: string | GraphNode;
  /** Edge type from GRAPH model */
  type: EdgeType;
  /** Edge weight (influences link distance) */
  weight: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Force graph configuration options
 */
export interface ForceGraphConfig {
  /** SVG width in pixels */
  width: number;
  /** SVG height in pixels */
  height: number;
  /** Node circle radius in pixels */
  nodeRadius: number;
  /** Base link distance (adjusted by weight) */
  linkDistance: number;
  /** Charge force strength (negative = repel) */
  chargeStrength: number;
  /** Collision detection radius */
  collisionRadius: number;
  /** Maximum simulation ticks before stop */
  maxTicks: number;
  /** Maximum simulation time in ms before stop */
  maxTime: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_FORCE_CONFIG: ForceGraphConfig = {
  width: 800,
  height: 600,
  nodeRadius: 8,
  linkDistance: 100,
  chargeStrength: -300,
  collisionRadius: 30,
  maxTicks: 300,
  maxTime: 3000,
};

// ============================================================================
// Callbacks
// ============================================================================

/**
 * Callback functions for graph interactions
 */
export interface ForceGraphCallbacks {
  /** Called when a node is clicked */
  onNodeClick?: (nodeId: string) => void;
  /** Called when mouse enters/leaves a node */
  onNodeHover?: (nodeId: string | null) => void;
  /** Called during node drag */
  onNodeDrag?: (nodeId: string, x: number, y: number) => void;
  /** Called when drag ends */
  onNodeDragEnd?: (nodeId: string) => void;
}

// ============================================================================
// Edge Type Styling
// ============================================================================

/**
 * Visual styling for each edge type
 */
export const EDGE_TYPE_STYLES: Record<EdgeType, { color: string; opacity: number; dasharray?: string }> = {
  LINK: { color: '#6366f1', opacity: 0.8 },
  NEST: { color: '#10b981', opacity: 0.8, dasharray: '4,2' },
  SEQUENCE: { color: '#f59e0b', opacity: 0.8, dasharray: '8,4' },
  AFFINITY: { color: '#ec4899', opacity: 0.6, dasharray: '2,2' },
};

// ============================================================================
// Simulation State
// ============================================================================

/**
 * Force simulation instance with cleanup
 */
export interface ForceGraphInstance {
  /** The D3 force simulation */
  simulation: d3.Simulation<GraphNode, GraphLink>;
  /** Stop the simulation and cleanup */
  stop: () => void;
  /** Restart the simulation */
  restart: () => void;
  /** Update node positions (for external control) */
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
}
