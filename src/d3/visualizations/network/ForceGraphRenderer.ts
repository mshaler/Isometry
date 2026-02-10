/**
 * Force Graph Renderer
 *
 * D3 force-directed network graph renderer for GRAPH relationship visualization.
 * Creates SVG-based force simulation with interactive nodes and links.
 */

import * as d3 from 'd3';
import type {
  GraphNode,
  GraphLink,
  ForceGraphConfig,
  ForceGraphCallbacks,
  ForceGraphInstance,
  EdgeType,
} from './types';
import { DEFAULT_FORCE_CONFIG, EDGE_TYPE_STYLES } from './types';
import {
  createDragBehavior,
  createClickBehavior,
  createHoverBehavior,
  applySelectionHighlight,
  applyHoverHighlight,
} from './interactions';

// ============================================================================
// Color Scale
// ============================================================================

/** Color scale for node groups using D3 category10 */
const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

// ============================================================================
// Force Graph Creation
// ============================================================================

/**
 * Create a force-directed network graph
 *
 * @param container - SVG group element to render into
 * @param nodes - Array of graph nodes
 * @param links - Array of graph links
 * @param config - Configuration options (merged with defaults)
 * @param callbacks - Interaction callbacks
 * @returns ForceGraphInstance with simulation control methods
 */
export function createForceGraph(
  container: SVGGElement,
  nodes: GraphNode[],
  links: GraphLink[],
  config: Partial<ForceGraphConfig> = {},
  callbacks: ForceGraphCallbacks = {}
): ForceGraphInstance {
  // Merge with defaults
  const cfg: ForceGraphConfig = { ...DEFAULT_FORCE_CONFIG, ...config };

  // Get D3 selection for container
  const svg = d3.select(container);

  // Clear any existing content
  svg.selectAll('*').remove();

  // Create simulation with forces
  const simulation = d3.forceSimulation<GraphNode>(nodes)
    .force('link', d3.forceLink<GraphNode, GraphLink>(links)
      .id(d => d.id)
      .distance(d => cfg.linkDistance / (d.weight || 1))
    )
    .force('charge', d3.forceManyBody<GraphNode>()
      .strength(cfg.chargeStrength)
    )
    .force('center', d3.forceCenter(cfg.width / 2, cfg.height / 2))
    .force('collide', d3.forceCollide<GraphNode>()
      .radius(cfg.collisionRadius)
    );

  // Create link lines
  const link = svg.append('g')
    .attr('class', 'network-links')
    .selectAll<SVGLineElement, GraphLink>('line')
    .data(links, (d: GraphLink) => {
      const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
      const targetId = typeof d.target === 'string' ? d.target : d.target.id;
      return `${sourceId}-${targetId}`;
    })
    .join('line')
    .attr('class', 'network-link')
    .attr('stroke', d => EDGE_TYPE_STYLES[d.type as EdgeType]?.color ?? '#999')
    .attr('stroke-opacity', d => EDGE_TYPE_STYLES[d.type as EdgeType]?.opacity ?? 0.6)
    .attr('stroke-width', d => Math.max(1, d.weight * 2))
    .attr('stroke-dasharray', d => EDGE_TYPE_STYLES[d.type as EdgeType]?.dasharray ?? null);

  // Create node group for circles and labels
  const nodeGroup = svg.append('g')
    .attr('class', 'network-nodes');

  // Create node circles
  const node = nodeGroup.selectAll<SVGCircleElement, GraphNode>('circle')
    .data(nodes, (d: GraphNode) => d.id)
    .join('circle')
    .attr('class', 'network-node')
    .attr('r', cfg.nodeRadius)
    .attr('fill', d => colorScale(d.group))
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .style('cursor', 'pointer');

  // Create node labels
  const label = nodeGroup.selectAll<SVGTextElement, GraphNode>('text')
    .data(nodes, (d: GraphNode) => d.id)
    .join('text')
    .attr('class', 'network-label')
    .attr('dy', -12)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', '#374151')
    .attr('pointer-events', 'none')
    .text(d => d.label.length > 15 ? d.label.substring(0, 15) + '...' : d.label);

  // Apply drag behavior
  const dragBehavior = createDragBehavior(
    simulation as d3.Simulation<GraphNode, GraphLink>,
    callbacks.onNodeDragEnd
  );
  node.call(dragBehavior);

  // Apply click behavior
  if (callbacks.onNodeClick) {
    const clickHandler = createClickBehavior(callbacks.onNodeClick);
    node.on('click', clickHandler);
  }

  // Apply hover behavior
  if (callbacks.onNodeHover) {
    const hoverHandlers = createHoverBehavior(callbacks.onNodeHover);
    node
      .on('mouseenter', hoverHandlers.onMouseEnter)
      .on('mouseleave', hoverHandlers.onMouseLeave);
  }

  // Track simulation state
  let tickCount = 0;
  const startTime = Date.now();
  let stopped = false;

  // Update positions on simulation tick
  simulation.on('tick', () => {
    tickCount++;

    // Stop simulation after max ticks or max time (per research guidance)
    const elapsed = Date.now() - startTime;
    if (!stopped && (tickCount >= cfg.maxTicks || elapsed >= cfg.maxTime)) {
      simulation.stop();
      stopped = true;
      return;
    }

    // Update link positions
    link
      .attr('x1', d => (d.source as GraphNode).x ?? 0)
      .attr('y1', d => (d.source as GraphNode).y ?? 0)
      .attr('x2', d => (d.target as GraphNode).x ?? 0)
      .attr('y2', d => (d.target as GraphNode).y ?? 0);

    // Update node positions
    node
      .attr('cx', d => d.x ?? 0)
      .attr('cy', d => d.y ?? 0);

    // Update label positions
    label
      .attr('x', d => d.x ?? 0)
      .attr('y', d => d.y ?? 0);
  });

  // Return instance with control methods
  return {
    simulation,

    stop() {
      stopped = true;
      simulation.stop();
    },

    restart() {
      stopped = false;
      tickCount = 0;
      simulation.alpha(1).restart();
    },

    updateNodePosition(nodeId: string, x: number, y: number) {
      const targetNode = nodes.find(n => n.id === nodeId);
      if (targetNode) {
        targetNode.fx = x;
        targetNode.fy = y;
        simulation.alpha(0.3).restart();
      }
    },
  };
}

// ============================================================================
// Renderer Class (Alternative API)
// ============================================================================

/**
 * ForceGraphRenderer class for object-oriented usage
 */
export class ForceGraphRenderer {
  private instance: ForceGraphInstance | null = null;
  private container: SVGGElement | null = null;
  private selectedNodeId: string | null = null;
  private hoveredNodeId: string | null = null;

  /**
   * Render the force graph
   */
  render(
    container: SVGGElement,
    nodes: GraphNode[],
    links: GraphLink[],
    config: Partial<ForceGraphConfig> = {},
    callbacks: ForceGraphCallbacks = {}
  ): void {
    // Store container reference
    this.container = container;

    // Wrap callbacks to track selection/hover state
    const wrappedCallbacks: ForceGraphCallbacks = {
      ...callbacks,
      onNodeClick: (nodeId: string) => {
        this.selectedNodeId = this.selectedNodeId === nodeId ? null : nodeId;
        this.updateHighlights();
        callbacks.onNodeClick?.(nodeId);
      },
      onNodeHover: (nodeId: string | null) => {
        this.hoveredNodeId = nodeId;
        this.updateHighlights();
        callbacks.onNodeHover?.(nodeId);
      },
    };

    // Create force graph instance
    this.instance = createForceGraph(container, nodes, links, config, wrappedCallbacks);
  }

  /**
   * Update selection and hover highlights
   */
  private updateHighlights(): void {
    if (!this.container) return;
    const containerSelection = d3.select<SVGGElement, unknown>(this.container);
    applySelectionHighlight(containerSelection, this.selectedNodeId);
    applyHoverHighlight(containerSelection, this.hoveredNodeId);
  }

  /**
   * Set selected node externally
   */
  setSelectedNode(nodeId: string | null): void {
    this.selectedNodeId = nodeId;
    this.updateHighlights();
  }

  /**
   * Get current selected node ID
   */
  getSelectedNode(): string | null {
    return this.selectedNodeId;
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    this.instance?.stop();
  }

  /**
   * Restart the simulation
   */
  restart(): void {
    this.instance?.restart();
  }

  /**
   * Cleanup and destroy the renderer
   */
  destroy(): void {
    this.instance?.stop();
    if (this.container) {
      d3.select(this.container).selectAll('*').remove();
    }
    this.instance = null;
    this.container = null;
  }
}
