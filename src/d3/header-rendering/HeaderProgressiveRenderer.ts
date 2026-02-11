/**
 * HeaderProgressiveRenderer - Handles progressive rendering of SuperGrid headers
 *
 * Separated from SuperGridHeaders to focus on rendering optimization logic.
 * Supports both single-level and multi-level (stacked) header rendering.
 */

import * as d3 from 'd3';
import type { HeaderNode, HeaderHierarchy } from '../../types/grid';
import type { SuperGridHeadersConfig } from '../header-types';
import { superGridLogger } from '../../utils/dev-logger';

/**
 * Configuration for multi-level rendering
 */
export interface MultiLevelConfig {
  levelHeight: number;
  animationDuration: number;
}

export class HeaderProgressiveRenderer {
  private container: d3.Selection<SVGGElement, unknown, null, undefined>;
  private config: SuperGridHeadersConfig;

  constructor(
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    config: SuperGridHeadersConfig
  ) {
    this.container = container;
    this.config = config;
  }

  /**
   * Initialize the DOM structure for progressive rendering
   */
  initializeStructure(): void {
    // Remove existing structure
    this.container.select('.headers-container').remove();

    // Create header container
    const headersContainer = this.container.append('g')
      .attr('class', 'headers-container');

    // Create level groups for progressive rendering
    for (let level = 0; level < this.config.maxVisibleLevels; level++) {
      headersContainer.append('g')
        .attr('class', `header-level-${level}`)
        .attr('transform', `translate(0, ${level * this.config.defaultHeaderHeight})`);
    }

    superGridLogger.setup('Header structure initialized', {});
  }

  /**
   * Determine if progressive rendering should be used based on performance budget
   */
  shouldUseProgressiveRendering(hierarchy: HeaderHierarchy): boolean {
    if (!this.config.enableProgressiveRendering) return false;

    const nodeCount = hierarchy.allNodes.length;
    const estimatedRenderTime = nodeCount * 0.5; // Rough estimate: 0.5ms per node

    const useProgressive = estimatedRenderTime > this.config.performanceBudgetMs;

    superGridLogger.metrics('Progressive rendering decision', {
      nodeCount,
      estimatedRenderTime,
      budget: this.config.performanceBudgetMs,
      useProgressive
    });

    return useProgressive;
  }

  /**
   * Render headers progressively with priority levels
   */
  renderProgressively(hierarchy: HeaderHierarchy): void {
    superGridLogger.render('Using progressive rendering', {});

    if (!hierarchy) return;

    // Render visible levels first (level 0, 1)
    this.renderLevel(0, hierarchy);
    this.renderLevel(1, hierarchy);

    // Lazy load deeper levels if expanded
    setTimeout(() => {
      for (let level = 2; level <= hierarchy.maxDepth; level++) {
        this.renderLevel(level, hierarchy);
      }
    }, 50); // Small delay for smooth UX
  }

  /**
   * Render all levels at once (non-progressive)
   */
  renderAllLevels(hierarchy: HeaderHierarchy): void {
    superGridLogger.render('Rendering all levels', {});

    if (!hierarchy) return;

    for (let level = 0; level <= hierarchy.maxDepth; level++) {
      this.renderLevel(level, hierarchy);
    }
  }

  /**
   * Render a specific level of the hierarchy
   */
  private renderLevel(level: number, hierarchy: HeaderHierarchy): void {
    if (!hierarchy) return;

    const nodesAtLevel = hierarchy.allNodes.filter(node => node.level === level);
    const levelContainer = this.container.select(`.header-level-${level}`);

    if (levelContainer.empty()) {
      console.warn(`⚠️ Level container not found: ${level}`);
      return;
    }

    // Data binding with D3 join pattern
    const headerGroups = levelContainer
      .selectAll<SVGGElement, HeaderNode>('.header-node')
      .data(nodesAtLevel, (d: HeaderNode) => d.id);

    // Enter new headers
    const entering = headerGroups.enter()
      .append('g')
      .attr('class', 'header-node')
      .attr('transform', (d: HeaderNode) => `translate(${d.x}, 0)`);

    // Header background rect
    entering.append('rect')
      .attr('class', 'header-background')
      .attr('width', (d: HeaderNode) => d.width)
      .attr('height', this.config.defaultHeaderHeight)
      .attr('fill', '#f8f9fa')
      .attr('stroke', '#dee2e6')
      .attr('stroke-width', 0.5);

    // Header text
    entering.append('text')
      .attr('class', 'header-label')
      .attr('x', (d: HeaderNode) => this.getTextX(d))
      .attr('y', this.config.defaultHeaderHeight / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: HeaderNode) => this.getTextAnchor(d))
      .attr('font-size', '12px')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')
      .attr('fill', '#343a40')
      .text((d: HeaderNode) => d.label);

    // Expand/collapse icon for non-leaf nodes
    entering.filter((d: HeaderNode) => !d.isLeaf)
      .append('g')
      .attr('class', 'expand-icon')
      .attr('transform', (d: HeaderNode) => `translate(${d.width - 20}, ${this.config.defaultHeaderHeight / 2})`)
      .call(selection => {
        selection.append('circle')
          .attr('r', 6)
          .attr('fill', '#6c757d')
          .attr('stroke', 'white')
          .attr('stroke-width', 1);

        selection.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-size', '8px')
          .attr('font-weight', 'bold')
          .attr('fill', 'white')
          .text((d: HeaderNode) => d.isExpanded ? '−' : '+');
      });

    // Update existing headers
    const updating = headerGroups
      .attr('transform', (d: HeaderNode) => `translate(${d.x}, 0)`);

    updating.select('.header-background')
      .attr('width', (d: HeaderNode) => d.width);

    updating.select('.header-label')
      .attr('x', (d: HeaderNode) => this.getTextX(d))
      .attr('text-anchor', (d: HeaderNode) => this.getTextAnchor(d))
      .text((d: HeaderNode) => d.label);

    updating.select('.expand-icon')
      .attr('transform', (d: HeaderNode) => `translate(${d.width - 20}, ${this.config.defaultHeaderHeight / 2})`);

    updating.select('.expand-icon text')
      .text((d: HeaderNode) => d.isExpanded ? '−' : '+');

    // Remove exiting headers
    headerGroups.exit().remove();
  }

  /**
   * Calculate text x position based on node properties
   */
  private getTextX(node: HeaderNode): number {
    if (node.isLeaf) {
      return node.width / 2; // Center align for leaf nodes
    }
    return this.config.expandIconSize + 8; // Left align with padding for expandable nodes
  }

  /**
   * Get text anchor based on node properties
   */
  private getTextAnchor(node: HeaderNode): string {
    return node.isLeaf ? 'middle' : 'start';
  }

  /**
   * Clear all rendered content
   */
  clear(): void {
    this.container.select('.headers-container').remove();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SuperGridHeadersConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // Multi-Level (Stacked) Header Rendering
  // ============================================================================

  /**
   * Render multi-level headers with visual spanning
   * Creates one row per hierarchy level, with parent cells spanning child widths
   *
   * @param hierarchy - HeaderHierarchy with computed spans and positions
   * @param orientation - 'x' for column headers (horizontal), 'y' for row headers (vertical)
   * @param config - Rendering configuration
   */
  public renderMultiLevel(
    hierarchy: HeaderHierarchy,
    orientation: 'x' | 'y',
    config: MultiLevelConfig
  ): void {
    const { levelHeight, animationDuration } = config;
    const levels = d3.range(0, hierarchy.maxDepth + 1);

    superGridLogger.render('Multi-level rendering starting', {
      orientation,
      levelCount: levels.length,
      nodeCount: hierarchy.allNodes.length
    });

    // Get or create header container for stacked headers
    let headerContainer = this.container.select<SVGGElement>('.stacked-headers');
    if (headerContainer.empty()) {
      headerContainer = this.container.append('g')
        .attr('class', 'stacked-headers');
    } else {
      // Clear existing content
      headerContainer.selectAll('*').remove();
    }

    // Create/update level groups
    const levelGroups = headerContainer
      .selectAll<SVGGElement, number>('.header-level')
      .data(levels, d => String(d))
      .join(
        enter => enter.append('g')
          .attr('class', 'header-level')
          .attr('data-level', d => d),
        update => update,
        exit => exit.remove()
      );

    // Position level groups based on orientation
    if (orientation === 'x') {
      // Column headers: stack vertically
      levelGroups.attr('transform', d => `translate(0, ${d * levelHeight})`);
    } else {
      // Row headers: also stack vertically but for left-side headers
      levelGroups.attr('transform', d => `translate(0, ${d * levelHeight})`);
    }

    // Render nodes within each level
    levels.forEach(level => {
      const nodesAtLevel = hierarchy.allNodes.filter(n => n.level === level);
      const levelGroup = levelGroups.filter((d: number) => d === level);

      this.renderLevelNodes(levelGroup, nodesAtLevel, {
        orientation,
        levelHeight,
        animationDuration
      });
    });

    // Add visual dividers between levels
    this.addLevelDividers(headerContainer, levels.length, levelHeight, orientation);

    superGridLogger.render('Multi-level rendering complete', {
      levelsRendered: levels.length
    });
  }

  /**
   * Render header nodes within a single level
   */
  private renderLevelNodes(
    levelGroup: d3.Selection<SVGGElement, number, SVGGElement, unknown>,
    nodes: HeaderNode[],
    config: { orientation: 'x' | 'y'; levelHeight: number; animationDuration: number }
  ): void {
    const { levelHeight, animationDuration } = config;

    levelGroup
      .selectAll<SVGGElement, HeaderNode>('.header-node')
      .data(nodes, d => d.id)
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', 'header-node')
            .attr('data-node-id', d => d.id)
            .attr('transform', d => `translate(${d.x}, 0)`)
            .attr('opacity', 0);

          // Background rect with span width
          g.append('rect')
            .attr('class', 'header-bg')
            .attr('width', d => d.width)
            .attr('height', levelHeight)
            .attr('fill', '#f8fafc')
            .attr('stroke', '#e2e8f0')
            .attr('stroke-width', 1)
            .attr('rx', 2);

          // Label text centered
          g.append('text')
            .attr('class', 'header-label')
            .attr('x', d => d.width / 2)
            .attr('y', levelHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '12px')
            .attr('font-weight', d => d.level === 0 ? '600' : '400')
            .attr('fill', '#334155')
            .text(d => d.label);

          // Fade in animation
          g.transition()
            .duration(animationDuration)
            .attr('opacity', 1);

          return g;
        },

        update => {
          update
            .transition()
            .duration(animationDuration)
            .attr('transform', d => `translate(${d.x}, 0)`)
            .attr('opacity', 1);

          update.select('.header-bg')
            .transition()
            .duration(animationDuration)
            .attr('width', d => d.width);

          update.select('.header-label')
            .transition()
            .duration(animationDuration)
            .attr('x', d => d.width / 2)
            .text(d => d.label);

          return update;
        },

        exit => exit
          .transition()
          .duration(animationDuration / 2)
          .attr('opacity', 0)
          .remove()
      );
  }

  /**
   * Add visual dividers between hierarchy levels
   */
  private addLevelDividers(
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    levelCount: number,
    levelHeight: number,
    _orientation: 'x' | 'y'
  ): void {
    const dividerData = d3.range(1, levelCount);

    container
      .selectAll<SVGLineElement, number>('.level-divider')
      .data(dividerData)
      .join('line')
      .attr('class', 'level-divider')
      .attr('x1', 0)
      .attr('x2', '100%')
      .attr('y1', d => d * levelHeight)
      .attr('y2', d => d * levelHeight)
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');
  }
}