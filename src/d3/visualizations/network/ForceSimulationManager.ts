/**
 * Force Simulation Manager
 *
 * Lifecycle management class for D3 force simulations.
 * Provides explicit start/stop/reheat/destroy methods to prevent
 * memory leaks during view transitions.
 */

import * as d3 from 'd3';
import type {
  GraphNode,
  GraphLink,
  ForceGraphConfig,
  SimulationState,
  ForceSimulationCallbacks,
} from './types';
import { DEFAULT_FORCE_CONFIG } from './types';

/**
 * ForceSimulationManager
 *
 * Wraps D3 forceSimulation with explicit lifecycle management.
 * Key features:
 * - Tracks simulation state (stopped/running/cooling)
 * - Auto-stops after maxTicks or maxTime
 * - Proper cleanup on destroy() to prevent memory leaks
 * - Reheat method for resuming physics without full restart
 */
export class ForceSimulationManager {
  private simulation: d3.Simulation<GraphNode, GraphLink> | null = null;
  private container: SVGGElement | null = null;
  private state: SimulationState = 'stopped';
  private tickCount = 0;
  private startTime = 0;
  private nodes: GraphNode[] = [];
  private links: GraphLink[] = [];
  private config: ForceGraphConfig = DEFAULT_FORCE_CONFIG;
  private callbacks: ForceSimulationCallbacks = {};

  /**
   * Get current simulation state
   */
  getState(): SimulationState {
    return this.state;
  }

  /**
   * Start a new force simulation
   *
   * @param container - SVG group element to render into
   * @param nodes - Array of graph nodes
   * @param links - Array of graph links
   * @param config - Configuration options (merged with defaults)
   * @param callbacks - Optional callbacks for tick/end events
   */
  start(
    container: SVGGElement,
    nodes: GraphNode[],
    links: GraphLink[],
    config: Partial<ForceGraphConfig> = {},
    callbacks: ForceSimulationCallbacks = {}
  ): void {
    // Always destroy existing simulation before starting new one
    this.destroy();

    // Store references
    this.container = container;
    this.nodes = nodes;
    this.links = links;
    this.config = { ...DEFAULT_FORCE_CONFIG, ...config };
    this.callbacks = callbacks;

    // Reset counters
    this.tickCount = 0;
    this.startTime = Date.now();

    // Create the D3 force simulation
    this.simulation = d3.forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3.forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => this.config.linkDistance / (d.weight || 1))
      )
      .force(
        'charge',
        d3.forceManyBody<GraphNode>().strength(this.config.chargeStrength)
      )
      .force(
        'center',
        d3.forceCenter(this.config.width / 2, this.config.height / 2)
      )
      .force(
        'collide',
        d3.forceCollide<GraphNode>().radius(this.config.collisionRadius)
      );

    // Set up tick handler
    this.simulation.on('tick', () => this.handleTick());

    // Set up end handler
    this.simulation.on('end', () => this.handleEnd());

    // Update state
    this.state = 'running';
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    if (this.simulation) {
      this.simulation.stop();
    }
    this.state = 'stopped';
  }

  /**
   * Reheat the simulation to resume physics
   *
   * @param alpha - Alpha value to set (default: 0.3)
   */
  reheat(alpha = 0.3): void {
    if (this.state === 'stopped' || !this.simulation) {
      return;
    }
    this.simulation.alpha(alpha).restart();
    this.state = 'running';
  }

  /**
   * Update a node's fixed position
   *
   * @param nodeId - ID of the node to update
   * @param x - New x position
   * @param y - New y position
   */
  updateNodePosition(nodeId: string, x: number, y: number): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
      this.reheat();
    }
  }

  /**
   * Release a node's fixed position
   *
   * @param nodeId - ID of the node to release
   */
  releaseNode(nodeId: string): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
  }

  /**
   * Destroy the simulation and clean up all resources
   *
   * This MUST be called on component unmount to prevent memory leaks.
   */
  destroy(): void {
    // Stop the simulation
    if (this.simulation) {
      this.simulation.stop();
      // Remove all event handlers
      this.simulation.on('tick', null);
      this.simulation.on('end', null);
    }

    // Clear DOM content
    if (this.container) {
      d3.select(this.container).selectAll('*').remove();
    }

    // Nullify references
    this.simulation = null;
    this.container = null;
    this.nodes = [];
    this.links = [];
    this.callbacks = {};
    this.state = 'stopped';
    this.tickCount = 0;
    this.startTime = 0;
  }

  /**
   * Handle simulation tick event
   */
  private handleTick(): void {
    this.tickCount++;

    // Check auto-stop conditions
    const elapsed = Date.now() - this.startTime;
    if (
      this.tickCount >= this.config.maxTicks ||
      elapsed >= this.config.maxTime
    ) {
      this.stop();
      this.handleEnd();
      return;
    }

    // Update state based on alpha
    if (this.simulation) {
      const alpha = this.simulation.alpha();
      this.state = alpha > 0.1 ? 'running' : 'cooling';
    }

    // Call tick callback
    this.callbacks.onTick?.(this.nodes, this.links);
  }

  /**
   * Handle simulation end event
   */
  private handleEnd(): void {
    this.state = 'stopped';
    this.callbacks.onEnd?.();
  }
}
