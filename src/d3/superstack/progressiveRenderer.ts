/**
 * Progressive Rendering for SuperStack Progressive Disclosure
 *
 * Handles D3.js rendering of hierarchical levels with transitions
 */

import * as d3 from 'd3';
import type { HeaderHierarchy, HeaderNode } from '../../types/grid';
import type { SuperStackProgressiveConfig } from './types';
import { superGridLogger } from '../../utils/dev-logger';

export class ProgressiveRenderer {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private config: SuperStackProgressiveConfig;
  private loadedLevels: Set<number> = new Set();
  private runningTransitions: Set<string> = new Set();

  constructor(
    container: d3.Selection<SVGElement, unknown, null, undefined>,
    config: SuperStackProgressiveConfig
  ) {
    this.container = container;
    this.config = config;
  }

  /**
   * Initialize progressive rendering structure
   */
  public initializeStructure(): void {
    // Create main progressive container
    const progressiveContainer = this.container.append('g')
      .attr('class', 'progressive-container');

    // Create level containers for maxVisibleLevels
    for (let i = 0; i < this.config.maxVisibleLevels; i++) {
      progressiveContainer.append('g')
        .attr('class', `progressive-level-${i}`)
        .style('opacity', 0);
    }
  }

  /**
   * Render hierarchy with progressive disclosure
   */
  public renderProgressively(hierarchy: HeaderHierarchy, visibleLevels: number[]): void {
    superGridLogger.render('Progressive rendering started', {});

    // Load visible levels immediately
    visibleLevels.forEach(level => this.loadLevel(level));

    // Lazy load buffer levels
    this.lazyLoadBufferLevels(hierarchy, visibleLevels);

    // Render visible levels with transitions
    this.renderVisibleLevels(hierarchy, visibleLevels);

    superGridLogger.render('Progressive rendering complete', {});
  }

  /**
   * Render all levels (fallback for shallow hierarchies)
   */
  public renderAllLevels(hierarchy: HeaderHierarchy): void {
    // Simple fallback: render all levels directly
    const allLevels = Array.from({ length: hierarchy.maxDepth + 1 }, (_, i) => i);
    allLevels.forEach(level => this.loadLevel(level));
    this.renderVisibleLevels(hierarchy, allLevels);
  }

  /**
   * Animate transition between level sets
   */
  public animateLevelTransition(
    hierarchy: HeaderHierarchy,
    oldLevels: number[],
    newLevels: number[]
  ): void {
    const transitionId = `level-transition-${Date.now()}`;
    this.runningTransitions.add(transitionId);

    // Animate smooth transition between level sets
    const progressiveContainer = this.container.select('.progressive-container');

    // Fade out old levels not in new set
    oldLevels.forEach((level, index) => {
      if (!newLevels.includes(level)) {
        progressiveContainer.select(`.progressive-level-${index}`)
          .transition()
          .duration(this.config.transitionDuration / 2)
          .style('opacity', 0);
      }
    });

    // Fade in new levels
    setTimeout(() => {
      this.renderVisibleLevels(hierarchy, newLevels);
      this.runningTransitions.delete(transitionId);
    }, this.config.transitionDuration / 2);

    superGridLogger.state('Level transition animated', {
      from: oldLevels,
      to: newLevels,
      transitionId
    });
  }

  /**
   * Get loaded levels
   */
  public getLoadedLevels(): number[] {
    return Array.from(this.loadedLevels).sort((a, b) => a - b);
  }

  /**
   * Check if a level is loaded
   */
  public isLevelLoaded(level: number): boolean {
    return this.loadedLevels.has(level);
  }

  /**
   * Clear all loaded levels
   */
  public clearLoadedLevels(): void {
    this.loadedLevels.clear();
  }

  /**
   * Load a specific level
   */
  private loadLevel(level: number): void {
    if (this.loadedLevels.has(level)) return;

    this.loadedLevels.add(level);

    superGridLogger.metrics(`Level ${level} loaded`, {
      loadedCount: this.loadedLevels.size
    });
  }

  /**
   * Lazy load buffer levels around visible range
   */
  private lazyLoadBufferLevels(hierarchy: HeaderHierarchy, visibleLevels: number[]): void {
    const minVisible = Math.min(...visibleLevels);
    const maxVisible = Math.max(...visibleLevels);

    // Load buffer levels around visible range
    for (let i = 0; i < this.config.lazyLoadingBuffer; i++) {
      const beforeLevel = minVisible - i - 1;
      const afterLevel = maxVisible + i + 1;

      if (beforeLevel >= 0) {
        setTimeout(() => this.loadLevel(beforeLevel), i * 50);
      }

      if (afterLevel <= hierarchy.maxDepth) {
        setTimeout(() => this.loadLevel(afterLevel), i * 50);
      }
    }
  }

  /**
   * Render visible levels
   */
  private renderVisibleLevels(hierarchy: HeaderHierarchy, visibleLevels: number[]): void {
    const progressiveContainer = this.container.select('.progressive-container');

    // Update level containers
    visibleLevels.forEach((level, index) => {
      const levelContainer = progressiveContainer.select(`.progressive-level-${index}`);

      if (!levelContainer.empty()) {
        levelContainer
          .style('opacity', 1)
          .attr('transform', `translate(0, ${index * 120})`); // Spacing between levels

        // Render nodes for this level
        this.renderLevelNodes(levelContainer, hierarchy, level);
      }
    });

    // Hide non-visible level containers
    for (let i = visibleLevels.length; i < this.config.maxVisibleLevels; i++) {
      progressiveContainer.select(`.progressive-level-${i}`)
        .style('opacity', 0);
    }
  }

  /**
   * Render nodes for a specific level
   */
  private renderLevelNodes(
    container: d3.Selection<any, unknown, null, undefined>,
    hierarchy: HeaderHierarchy,
    level: number
  ): void {
    const nodesAtLevel = hierarchy.allNodes.filter(node => node.level === level);

    // Use D3 data join pattern for nodes at this level
    const nodeGroups = container
      .selectAll<SVGGElement, HeaderNode>('.progressive-node')
      .data(nodesAtLevel, (d: HeaderNode) => d.id);

    // Enter new nodes
    const enterGroups = nodeGroups.enter()
      .append('g')
      .attr('class', 'progressive-node')
      .style('opacity', 0);

    // Add visual elements to new nodes
    enterGroups.append('rect')
      .attr('width', 100)
      .attr('height', 30)
      .attr('fill', '#e0e0e0')
      .attr('stroke', '#666')
      .attr('rx', 4);

    enterGroups.append('text')
      .attr('x', 50)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .text(d => d.label || d.facet || '');

    // Update all nodes (enter + existing)
    const allNodes = enterGroups.merge(nodeGroups);

    allNodes
      .transition()
      .duration(this.config.transitionDuration)
      .style('opacity', 1)
      .attr('transform', (_d, i) => `translate(${i * 110}, 0)`);

    // Exit old nodes
    nodeGroups.exit()
      .transition()
      .duration(this.config.transitionDuration / 2)
      .style('opacity', 0)
      .remove();

    superGridLogger.metrics(`Level ${level} rendered`, {
      nodeCount: nodesAtLevel.length
    });
  }
}