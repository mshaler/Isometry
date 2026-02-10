/**
 * HeaderAnimationSystem - Handles all header expansion/collapse animations
 *
 * Extracted from SuperGridHeaders.old.ts to manage animation lifecycle,
 * performance tracking, and transition coordination.
 */

import * as d3 from 'd3';
import type { HeaderNode, HeaderHierarchy } from '../../types/grid';
import { superGridLogger } from '../../utils/dev-logger';

export interface AnimationPerformanceConfig {
  performanceBudgetMs: number;
  animationDuration: number;
  enablePerformanceTracking: boolean;
}

export class HeaderAnimationSystem {
  private config: AnimationPerformanceConfig;
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private renderStartTime: number = 0;
  private averageRenderTime: number = 0;
  private renderCount: number = 0;

  constructor(
    container: d3.Selection<SVGElement, unknown, null, undefined>,
    config: AnimationPerformanceConfig
  ) {
    this.container = container;
    this.config = config;
  }

  /**
   * Animate header expansion with coordinated morphing boundaries
   */
  public animateHeaderExpansion(node: HeaderNode, hierarchy: HeaderHierarchy): void {
    if (!hierarchy) return;

    // Generate unique transition ID for coordination
    const transitionId = `expand-${node.id}-${Date.now()}`;

    // Track animation start for performance monitoring
    if (this.config.enablePerformanceTracking) {
      this.renderStartTime = performance.now();
    }

    // Animate the morphing boundaries
    this.animateMorphingBoundaries(node, hierarchy, transitionId);

    // Animate parent span changes
    this.animateParentSpanChanges(node, hierarchy, transitionId);

    // Get and animate child positioning
    const childNodes = this.getChildNodesRecursive(node, hierarchy);
    this.animateChildPositioning(childNodes, transitionId);

    // Animate expand/collapse icon
    this.animateExpandIcon(node, transitionId);

    // Schedule cleanup and performance tracking
    setTimeout(() => {
      if (this.config.enablePerformanceTracking) {
        this.trackAnimationPerformance();
      }
    }, this.config.animationDuration + 50);
  }

  /**
   * Simple toggle animation for immediate feedback
   */
  public animateToggle(node: HeaderNode): void {
    const headerElement = this.container
      .select(`[data-node-id="${node.id}"]`);

    headerElement
      .transition()
      .duration(150)
      .style('background-color', '#e3f2fd')
      .transition()
      .duration(150)
      .style('background-color', null);
  }

  /**
   * Interrupt all transitions for a specific node
   */
  public interruptTransitions(nodeId: string): void {
    this.container
      .selectAll(`[data-transition*="${nodeId}"]`)
      .interrupt();
  }

  /**
   * Animate morphing boundaries during expansion/collapse
   */
  private animateMorphingBoundaries(
    node: HeaderNode,
    _hierarchy: HeaderHierarchy,
    transitionId: string
  ): void {
    const headerElement = this.container
      .select(`[data-node-id="${node.id}"]`)
      .attr('data-transition', transitionId);

    headerElement
      .transition()
      .duration(this.config.animationDuration)
      .attr('width', node.width)
      .attr('height', node.height)
      .style('opacity', node.isExpanded ? 1 : 0.7);
  }

  /**
   * Animate parent span changes when children expand/collapse
   */
  private animateParentSpanChanges(
    parentNode: HeaderNode,
    hierarchy: HeaderHierarchy,
    transitionId: string
  ): void {
    const parentElement = this.container
      .select(`[data-node-id="${parentNode.id}"]`);

    if (parentElement.empty()) return;

    // Calculate new span width based on visible children
    const children = hierarchy.getChildren(parentNode.id);
    const visibleChildren = children.filter(child =>
      this.isNodeVisible(child, hierarchy)
    );

    const totalChildWidth = visibleChildren.reduce((sum, child) => sum + child.width, 0);
    const newSpanWidth = Math.max(parentNode.width, totalChildWidth);

    parentElement
      .select('.header-span')
      .attr('data-transition', transitionId)
      .transition()
      .duration(this.config.animationDuration)
      .attr('width', newSpanWidth);
  }

  /**
   * Animate child positioning during parent expansion
   */
  private animateChildPositioning(childNodes: HeaderNode[], transitionId: string): void {
    childNodes.forEach(child => {
      const childElement = this.container
        .select(`[data-node-id="${child.id}"]`);

      if (childElement.empty()) return;

      if (child.parentId && this.isNodeExpanded(child.parentId)) {
        // Animate child sliding into view
        childElement
          .attr('data-transition', transitionId)
          .style('opacity', 0)
          .attr('transform', `translate(${child.x}, ${child.y - 20})`)
          .transition()
          .duration(this.config.animationDuration)
          .style('opacity', 1)
          .attr('transform', `translate(${child.x}, ${child.y})`);
      } else {
        // Animate child sliding out of view
        childElement
          .attr('data-transition', transitionId)
          .transition()
          .duration(this.config.animationDuration)
          .style('opacity', 0)
          .attr('transform', `translate(${child.x}, ${child.y + 20})`)
          .on('end', () => {
            childElement.style('display', 'none');
          });
      }
    });
  }

  /**
   * Animate expand/collapse icon transformation
   */
  private animateExpandIcon(parentNode: HeaderNode, transitionId: string): void {
    const iconElement = this.container
      .select(`[data-node-id="${parentNode.id}"] .expand-icon`);

    if (iconElement.empty()) return;

    const rotation = parentNode.isExpanded ? 90 : 0;
    const iconSize = parentNode.isExpanded ? 12 : 8;

    iconElement
      .attr('data-transition', transitionId)
      .transition()
      .duration(this.config.animationDuration)
      .attr('transform', `rotate(${rotation})`)
      .attr('width', iconSize)
      .attr('height', iconSize);
  }

  /**
   * Get all child nodes recursively for animation
   */
  private getChildNodesRecursive(parentNode: HeaderNode, hierarchy: HeaderHierarchy): HeaderNode[] {
    const children: HeaderNode[] = [];
    const directChildren = hierarchy.getChildren(parentNode.id);

    for (const child of directChildren) {
      children.push(child);
      if (!child.isLeaf && child.isExpanded) {
        children.push(...this.getChildNodesRecursive(child, hierarchy));
      }
    }

    return children;
  }

  /**
   * Check if node is visible based on parent expansion state
   */
  private isNodeVisible(node: HeaderNode, hierarchy: HeaderHierarchy): boolean {
    if (!hierarchy || node.level === 0) return true;

    let currentNode = node;
    while (currentNode.parentId) {
      const parent = hierarchy.getNode(currentNode.parentId);
      if (!parent || !parent.isExpanded) {
        return false;
      }
      currentNode = parent;
    }
    return true;
  }

  /**
   * Check if node is expanded
   */
  private isNodeExpanded(_nodeId: string): boolean {
    // This would need access to the hierarchy - should be injected
    return false; // Placeholder - needs proper implementation
  }

  /**
   * Track animation performance and log warnings
   */
  private trackAnimationPerformance(): void {
    const animationTime = performance.now() - this.renderStartTime;
    this.renderCount++;
    this.averageRenderTime = ((this.averageRenderTime * (this.renderCount - 1)) + animationTime) / this.renderCount;

    if (animationTime > this.config.performanceBudgetMs) {
      superGridLogger.warn('Animation exceeded performance budget', {
        animationTime,
        budget: this.config.performanceBudgetMs,
        averageTime: this.averageRenderTime,
        renderCount: this.renderCount
      });
    }

    superGridLogger.debug('Animation performance', {
      animationTime,
      averageTime: this.averageRenderTime,
      renderCount: this.renderCount
    });
  }
}