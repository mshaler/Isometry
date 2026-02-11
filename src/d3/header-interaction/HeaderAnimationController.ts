/**
 * HeaderAnimationController - Handles animations and interactions for SuperGrid headers
 *
 * Separated from SuperGridHeaders to focus on animation and user interaction logic.
 */

import * as d3 from 'd3';
import type { HeaderNode } from '../../types/grid';
import type { SuperGridHeadersConfig } from '../header-types';

export interface HeaderClickEvent {
  nodeId: string;
  action: 'expand' | 'collapse' | 'select';
  node: HeaderNode;
  event: MouseEvent;
}

export class HeaderAnimationController {
  private container: d3.Selection<SVGGElement, unknown, null, undefined>;
  private config: SuperGridHeadersConfig;
  private runningTransitions: Set<string> = new Set();
  private onHeaderClick?: (event: HeaderClickEvent) => void;

  constructor(
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    config: SuperGridHeadersConfig,
    onHeaderClick?: (event: HeaderClickEvent) => void
  ) {
    this.container = container;
    this.config = config;
    this.onHeaderClick = onHeaderClick;
  }

  /**
   * Add interaction handlers to header elements
   */
  addInteractionHandlers(
    headerGroups: d3.Selection<SVGGElement, HeaderNode, SVGGElement, unknown>
  ): void {
    headerGroups
      .on('mouseenter', (event: MouseEvent, node: HeaderNode) => this.handleMouseEnter(event, node))
      .on('mousemove', (event: MouseEvent, node: HeaderNode) => this.handleMouseMove(event, node))
      .on('mouseleave', (event: MouseEvent, node: HeaderNode) => this.handleMouseLeave(event, node))
      .on('click', (event: MouseEvent, node: HeaderNode) => this.handleClick(event, node));
  }

  /**
   * Handle mouse enter events
   */
  private handleMouseEnter(event: MouseEvent, _node: HeaderNode): void {
    // Add hover effects
    d3.select(event.currentTarget as SVGGElement)
      .select('.header-background')
      .transition()
      .duration(150)
      .attr('fill', '#e9ecef');
  }

  /**
   * Handle mouse move events for cursor changes
   */
  private handleMouseMove(event: MouseEvent, node: HeaderNode): void {
    this.updateCursorForZone(event, node);
  }

  /**
   * Update cursor based on mouse position within click zones
   */
  private updateCursorForZone(event: MouseEvent, node: HeaderNode): void {
    if (!node.clickZones) return;

    const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check resize zone
    const resizeZone = node.clickZones.resize;
    if (x >= resizeZone.x && x <= resizeZone.x + resizeZone.width &&
        y >= resizeZone.y && y <= resizeZone.y + resizeZone.height) {
      d3.select(event.currentTarget as SVGGElement).style('cursor', 'col-resize');
      return;
    }

    // Check expand zone
    if (!node.isLeaf) {
      const expandZone = node.clickZones.expand;
      if (x >= expandZone.x && x <= expandZone.x + expandZone.width &&
          y >= expandZone.y && y <= expandZone.y + expandZone.height) {
        d3.select(event.currentTarget as SVGGElement).style('cursor', 'pointer');
        return;
      }
    }

    // Default cursor for select zone
    d3.select(event.currentTarget as SVGGElement).style('cursor', 'default');
  }

  /**
   * Handle mouse leave events
   */
  private handleMouseLeave(event: MouseEvent, _node: HeaderNode): void {
    // Remove hover effects
    d3.select(event.currentTarget as SVGGElement)
      .select('.header-background')
      .transition()
      .duration(150)
      .attr('fill', '#f8f9fa');

    // Reset cursor
    d3.select(event.currentTarget as SVGGElement).style('cursor', 'default');
  }

  /**
   * Handle click events and determine action based on click zone
   */
  private handleClick(event: MouseEvent, node: HeaderNode): void {
    if (!node.clickZones || !this.onHeaderClick) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check resize zone first (highest priority)
    const resizeZone = node.clickZones.resize;
    if (x >= resizeZone.x && x <= resizeZone.x + resizeZone.width &&
        y >= resizeZone.y && y <= resizeZone.y + resizeZone.height) {
      // Resize handled by drag behavior, not click
      return;
    }

    // Check expand zone for non-leaf nodes
    if (!node.isLeaf) {
      const expandZone = node.clickZones.expand;
      if (x >= expandZone.x && x <= expandZone.x + expandZone.width &&
          y >= expandZone.y && y <= expandZone.y + expandZone.height) {

        const action = node.isExpanded ? 'collapse' : 'expand';
        this.onHeaderClick({
          nodeId: node.id,
          action,
          node,
          event
        });

        // Animate the toggle
        this.animateToggle(node);
        return;
      }
    }

    // Default to selection action
    this.onHeaderClick({
      nodeId: node.id,
      action: 'select',
      node,
      event
    });
  }

  /**
   * Animate header toggle (expand/collapse)
   */
  animateToggle(node: HeaderNode): void {
    this.animateHeaderExpansion(node);
  }

  /**
   * Animate header expansion with morphing boundaries
   */
  private animateHeaderExpansion(node: HeaderNode): void {
    const transitionId = `toggle-${node.id}-${Date.now()}`;
    this.runningTransitions.add(transitionId);

    try {
      // Find child nodes to animate
      const childNodes = node.children || [];

      if (childNodes.length > 0) {
        this.animateMorphingBoundaries(node, childNodes, transitionId);
      }

      // Update expand icon
      this.animateExpandIcon(node, transitionId);

    } finally {
      // Cleanup after animation
      setTimeout(() => {
        this.runningTransitions.delete(transitionId);
      }, this.config.animationDuration);
    }
  }

  /**
   * Animate morphing boundaries with coordinated parent-child layout changes
   */
  private animateMorphingBoundaries(
    parentNode: HeaderNode,
    childNodes: HeaderNode[],
    transitionId: string
  ): void {
    // Animate parent span width changes with morphing boundaries
    this.animateParentSpanChanges(parentNode, transitionId);

    // Animate child positioning with coordinated transforms
    this.animateChildPositioning(childNodes, transitionId);
  }

  /**
   * Animate parent header span width changes with morphing boundaries
   */
  private animateParentSpanChanges(parentNode: HeaderNode, transitionId: string): void {
    const parentElement = this.container
      .selectAll('.header-node')
      .filter((d: unknown) => (d as HeaderNode).id === parentNode.id);

    if (parentElement.empty()) return;

    // Animate background width change
    parentElement.select('.header-background')
      .interrupt() // Always interrupt previous transitions
      .transition(`parent-span-${transitionId}`)
      .duration(this.config.animationDuration)
      .ease(d3.easeQuadOut) // "quiet app" aesthetic
      .attr('width', parentNode.width);

    // Animate text positioning adjustment
    parentElement.select('.header-label')
      .interrupt()
      .transition(`parent-text-${transitionId}`)
      .duration(this.config.animationDuration)
      .ease(d3.easeQuadOut)
      .attr('x', this.getTextX(parentNode))
      .attr('text-anchor', this.getTextAnchor(parentNode));
  }

  /**
   * Animate child node positioning during parent expand/collapse
   */
  private animateChildPositioning(childNodes: HeaderNode[], transitionId: string): void {
    childNodes.forEach((childNode, index) => {
      const childElement = this.container
        .selectAll('.header-node')
        .filter((d: unknown) => (d as HeaderNode).id === childNode.id);

      if (childElement.empty()) return;

      // Stagger child animations for fluid cascading effect
      const delay = index * 50;

      childElement
        .interrupt()
        .transition(`child-position-${transitionId}-${index}`)
        .delay(delay)
        .duration(this.config.animationDuration)
        .ease(d3.easeQuadOut)
        .attr('transform', `translate(${childNode.x}, 0)`)
        .style('opacity', childNode.isVisible ? 1 : 0);
    });
  }

  /**
   * Animate expand/collapse icon
   */
  private animateExpandIcon(node: HeaderNode, transitionId: string): void {
    const nodeElement = this.container
      .selectAll('.header-node')
      .filter((d: unknown) => (d as HeaderNode).id === node.id);

    if (nodeElement.empty()) return;

    const expandIcon = nodeElement.select('.expand-icon text');

    expandIcon
      .interrupt()
      .transition(`expand-icon-${transitionId}`)
      .duration(this.config.animationDuration / 2)
      .ease(d3.easeQuadOut)
      .style('opacity', 0)
      .transition()
      .duration(this.config.animationDuration / 2)
      .style('opacity', 1)
      .text(node.isExpanded ? '−' : '+');
  }

  /**
   * Get text x position for node
   */
  private getTextX(node: HeaderNode): number {
    if (node.isLeaf) {
      return node.width / 2;
    }
    return this.config.expandIconSize + 8;
  }

  /**
   * Get text anchor for node
   */
  private getTextAnchor(node: HeaderNode): string {
    return node.isLeaf ? 'middle' : 'start';
  }

  /**
   * Stop all running animations
   */
  stopAllAnimations(): void {
    this.container.selectAll('*').interrupt();
    this.runningTransitions.clear();
  }

  /**
   * Check if any animations are currently running
   */
  hasRunningAnimations(): boolean {
    return this.runningTransitions.size > 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SuperGridHeadersConfig>): void {
    this.config = { ...this.config, ...config };
  }
}