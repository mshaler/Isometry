/**
 * SuperGridHeaders - Hierarchical header rendering system for SuperGrid
 *
 * Implements nested PAFV headers with visual spanning across multiple dimension levels.
 * Features:
 * - d3-hierarchy for nested structure rendering
 * - Multi-level headers with visual spanning
 * - Expand/collapse with geometric click zones
 * - Progressive rendering with lazy fallback
 * - Morphing boundary animations using D3 transitions
 */

import * as d3 from 'd3';
import type {
  HeaderNode,
  HeaderHierarchy
} from '../types/grid';
import { HeaderLayoutService } from '../services/HeaderLayoutService';
import { ContentAlignment as ContentAlignmentEnum } from '../types/grid';

export interface SuperGridHeadersConfig {
  defaultHeaderHeight: number;
  expandIconSize: number;
  animationDuration: number;
  maxVisibleLevels: number;
  enableProgressiveRendering: boolean;
  performanceBudgetMs: number;
}

export interface HeaderClickEvent {
  nodeId: string;
  action: 'expand' | 'collapse' | 'select';
  node: HeaderNode;
  event: MouseEvent;
}

export class SuperGridHeaders {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private layoutService: HeaderLayoutService;
  private config: SuperGridHeadersConfig;
  private currentHierarchy: HeaderHierarchy | null = null;

  // Performance tracking for lazy fallback
  private renderStartTime: number = 0;
  private renderCount: number = 0;
  private averageRenderTime: number = 0;

  // Event callbacks
  private onHeaderClick?: (event: HeaderClickEvent) => void;
  private onExpandCollapse?: (nodeId: string, isExpanded: boolean) => void;

  // Default configuration
  private static readonly DEFAULT_CONFIG: SuperGridHeadersConfig = {
    defaultHeaderHeight: 40,
    expandIconSize: 16,
    animationDuration: 300,
    maxVisibleLevels: 5,
    enableProgressiveRendering: true,
    performanceBudgetMs: 16 // ~60fps budget
  };

  constructor(
    container: SVGElement,
    layoutService: HeaderLayoutService,
    config: Partial<SuperGridHeadersConfig> = {},
    callbacks: {
      onHeaderClick?: (event: HeaderClickEvent) => void;
      onExpandCollapse?: (nodeId: string, isExpanded: boolean) => void;
    } = {}
  ) {
    this.container = d3.select(container);
    this.layoutService = layoutService;
    this.config = { ...SuperGridHeaders.DEFAULT_CONFIG, ...config };
    this.onHeaderClick = callbacks.onHeaderClick;
    this.onExpandCollapse = callbacks.onExpandCollapse;

    this.initializeStructure();
  }

  /**
   * Render hierarchical headers from flat data
   */
  public renderHeaders(
    flatData: any[],
    axis: string,
    facetField: string = 'status',
    totalWidth: number = 800
  ): void {
    console.log('🎨 SuperGridHeaders.renderHeaders(): Starting...', {
      dataCount: flatData.length,
      axis,
      facetField,
      totalWidth
    });

    this.renderStartTime = performance.now();

    try {
      // Generate hierarchy using layout service
      this.currentHierarchy = this.layoutService.generateHeaderHierarchy(
        flatData,
        axis,
        facetField
      );

      console.log('📊 SuperGridHeaders.renderHeaders(): Hierarchy generated:', {
        rootNodesCount: this.currentHierarchy.rootNodes.length,
        totalNodesCount: this.currentHierarchy.allNodes.length,
        maxDepth: this.currentHierarchy.maxDepth
      });

      // Calculate span widths for all nodes
      this.calculateHierarchyWidths(totalWidth);

      // Progressive rendering decision
      if (this.shouldUseProgressiveRendering()) {
        this.renderProgressively();
      } else {
        this.renderAllLevels();
      }

      this.trackRenderPerformance();

    } catch (error) {
      console.error('❌ SuperGridHeaders.renderHeaders(): Error:', error);
      this.renderFallback();
    }

    console.log('✅ SuperGridHeaders.renderHeaders(): Complete');
  }

  /**
   * Expand or collapse a header node
   */
  public toggleNode(nodeId: string): void {
    if (!this.currentHierarchy) return;

    const node = this.currentHierarchy.allNodes.find(n => n.id === nodeId);
    if (!node || node.isLeaf) return;

    // Toggle expansion state
    node.isExpanded = !node.isExpanded;

    // Update hierarchy state
    if (node.isExpanded) {
      this.currentHierarchy.expandedNodeIds.add(nodeId);
      this.currentHierarchy.collapsedSubtrees.delete(nodeId);
    } else {
      this.currentHierarchy.expandedNodeIds.delete(nodeId);
      this.currentHierarchy.collapsedSubtrees.add(nodeId);
    }

    // Trigger callback
    this.onExpandCollapse?.(nodeId, node.isExpanded);

    // Animate the change
    this.animateToggle(node);

    console.log('🔄 SuperGridHeaders.toggleNode():', {
      nodeId,
      isExpanded: node.isExpanded,
      expandedCount: this.currentHierarchy.expandedNodeIds.size
    });
  }

  /**
   * Get current hierarchy
   */
  public getHierarchy(): HeaderHierarchy | null {
    return this.currentHierarchy;
  }

  /**
   * Clear all headers
   */
  public clear(): void {
    this.container.select('.headers-container').selectAll('*').remove();
    this.currentHierarchy = null;
  }

  // Private methods

  private initializeStructure(): void {
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

    console.log('🏗️ SuperGridHeaders.initializeStructure(): Structure initialized');
  }

  private calculateHierarchyWidths(totalWidth: number): void {
    if (!this.currentHierarchy) return;

    // Calculate widths for leaf nodes (bottom level)
    const leafNodes = this.currentHierarchy.allNodes.filter(node => node.isLeaf);
    const widthMap = this.layoutService.calculateSpanWidths(leafNodes, totalWidth);

    // Apply calculated widths
    leafNodes.forEach(node => {
      const width = widthMap.get(node.id) || 100;
      node.width = width;
      this.updateClickZones(node);
    });

    // Calculate parent widths from children (bottom-up)
    this.calculateParentWidths();

    // Update total width
    this.currentHierarchy.totalWidth = totalWidth;
  }

  private calculateParentWidths(): void {
    if (!this.currentHierarchy) return;

    // Group nodes by level (bottom-up calculation)
    const nodesByLevel = this.currentHierarchy.allNodes.reduce((acc, node) => {
      if (!acc[node.level]) acc[node.level] = [];
      acc[node.level].push(node);
      return acc;
    }, {} as Record<number, HeaderNode[]>);

    // Calculate from bottom level up
    const levels = Object.keys(nodesByLevel).map(Number).sort((a, b) => b - a);

    levels.forEach(level => {
      if (level === this.currentHierarchy!.maxDepth) return; // Skip leaf level

      const nodesAtLevel = nodesByLevel[level];
      nodesAtLevel.forEach(parentNode => {
        const children = this.currentHierarchy!.allNodes.filter(
          node => node.parentId === parentNode.id
        );

        if (children.length > 0) {
          parentNode.width = children.reduce((sum, child) => sum + child.width, 0);
          parentNode.span = children.length;
        }

        this.updateClickZones(parentNode);
      });
    });
  }

  private updateClickZones(node: HeaderNode): void {
    // Parent label zone for expand/collapse (~32px)
    node.labelZone = {
      x: node.x,
      y: node.y,
      width: node.isLeaf ? 0 : 32,
      height: node.height
    };

    // Body zone for data selection (remaining area)
    node.bodyZone = {
      x: node.x + (node.isLeaf ? 0 : 32),
      y: node.y,
      width: node.width - (node.isLeaf ? 0 : 32),
      height: node.height
    };
  }

  private shouldUseProgressiveRendering(): boolean {
    if (!this.config.enableProgressiveRendering || !this.currentHierarchy) {
      return false;
    }

    // Use progressive rendering if:
    // 1. Many nodes (> 50)
    // 2. Deep hierarchy (> 3 levels)
    // 3. Previous renders were slow
    const nodeCount = this.currentHierarchy.allNodes.length;
    const depth = this.currentHierarchy.maxDepth;
    const previouslyWasSlow = this.averageRenderTime > this.config.performanceBudgetMs;

    return nodeCount > 50 || depth > 3 || previouslyWasSlow;
  }

  private renderProgressively(): void {
    console.log('🔄 SuperGridHeaders.renderProgressively(): Using progressive rendering');

    if (!this.currentHierarchy) return;

    // Render visible levels first (level 0, 1)
    this.renderLevel(0);
    this.renderLevel(1);

    // Lazy load deeper levels if expanded
    setTimeout(() => {
      for (let level = 2; level <= this.currentHierarchy!.maxDepth; level++) {
        this.renderLevel(level);
      }
    }, 50); // Small delay for smooth UX
  }

  private renderAllLevels(): void {
    console.log('🎨 SuperGridHeaders.renderAllLevels(): Rendering all levels');

    if (!this.currentHierarchy) return;

    for (let level = 0; level <= this.currentHierarchy.maxDepth; level++) {
      this.renderLevel(level);
    }
  }

  private renderLevel(level: number): void {
    if (!this.currentHierarchy) return;

    const nodesAtLevel = this.currentHierarchy.allNodes.filter(node => node.level === level);
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
      .attr('rx', 4)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1);

    // Header text label
    entering.append('text')
      .attr('class', 'header-label')
      .attr('x', (d: HeaderNode) => this.getTextX(d))
      .attr('y', this.config.defaultHeaderHeight / 2 + 4)
      .attr('text-anchor', (d: HeaderNode) => this.getTextAnchor(d))
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .style('pointer-events', 'none')
      .text((d: HeaderNode) => `${d.label} (${d.count})`);

    // Expand/collapse icon for non-leaf nodes
    entering.filter((d: HeaderNode) => !d.isLeaf)
      .append('text')
      .attr('class', 'expand-icon')
      .attr('x', 16)
      .attr('y', this.config.defaultHeaderHeight / 2 + 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#6b7280')
      .style('cursor', 'pointer')
      .text((d: HeaderNode) => d.isExpanded ? '−' : '+');

    // Merge entering and existing
    const allHeaders = headerGroups.merge(entering as any);

    // Update positions and properties
    allHeaders
      .transition()
      .duration(200)
      .attr('transform', (d: HeaderNode) => `translate(${d.x}, 0)`);

    allHeaders.select('.header-background')
      .transition()
      .duration(200)
      .attr('width', (d: HeaderNode) => d.width);

    allHeaders.select('.header-label')
      .attr('x', (d: HeaderNode) => this.getTextX(d))
      .attr('text-anchor', (d: HeaderNode) => this.getTextAnchor(d));

    // Add interaction handlers
    this.addInteractionHandlers(allHeaders as d3.Selection<SVGGElement, HeaderNode, SVGGElement, unknown>);

    // Remove exiting headers
    headerGroups.exit()
      .transition()
      .duration(200)
      .attr('opacity', 0)
      .remove();

    console.log(`📊 Rendered level ${level}: ${nodesAtLevel.length} nodes`);
  }

  private addInteractionHandlers(
    headerSelection: d3.Selection<SVGGElement, HeaderNode, SVGGElement, unknown>
  ): void {
    headerSelection
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => this.handleMouseEnter(event, d))
      .on('mouseleave', (event, d) => this.handleMouseLeave(event, d))
      .on('click', (event, d) => this.handleClick(event, d));
  }

  private handleMouseEnter(event: MouseEvent, node: HeaderNode): void {
    // Update cursor based on zone
    const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;

    let cursor = 'pointer';
    if (!node.isLeaf && mouseX <= 32) {
      cursor = 'pointer'; // Expand/collapse zone
    } else {
      cursor = 'pointer'; // Selection zone
    }

    d3.select(event.currentTarget as SVGGElement).style('cursor', cursor);

    // Highlight header
    d3.select(event.currentTarget as SVGGElement)
      .select('.header-background')
      .attr('fill', '#e2e8f0');
  }

  private handleMouseLeave(event: MouseEvent, _node: HeaderNode): void {
    // Reset highlight
    d3.select(event.currentTarget as SVGGElement)
      .select('.header-background')
      .attr('fill', '#f8fafc');
  }

  private handleClick(event: MouseEvent, node: HeaderNode): void {
    // Determine click zone and action
    const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;

    let action: 'expand' | 'collapse' | 'select';

    // "Innermost wins + parent label exclusion" rule
    if (!node.isLeaf && mouseX <= 32) {
      // Parent label zone: expand/collapse operation
      action = node.isExpanded ? 'collapse' : 'expand';
      this.toggleNode(node.id);
    } else {
      // Child header body: data group selection
      action = 'select';
    }

    // Trigger callback
    const headerClickEvent: HeaderClickEvent = {
      nodeId: node.id,
      action,
      node,
      event
    };

    this.onHeaderClick?.(headerClickEvent);

    console.log('👆 SuperGridHeaders.handleClick():', {
      nodeId: node.id,
      action,
      clickZone: mouseX <= 32 ? 'label' : 'body',
      isLeaf: node.isLeaf
    });
  }

  private animateToggle(node: HeaderNode): void {
    // Find all child nodes that should show/hide
    const childNodes = this.getChildNodesRecursive(node);

    childNodes.forEach(child => {
      const childElement = this.container
        .select(`.header-level-${child.level}`)
        .selectAll('.header-node')
        .filter((d: any) => d.id === child.id);

      if (node.isExpanded) {
        // Show children with fade-in
        childElement
          .style('opacity', 0)
          .transition()
          .duration(this.config.animationDuration)
          .style('opacity', 1);
      } else {
        // Hide children with fade-out
        childElement
          .transition()
          .duration(this.config.animationDuration)
          .style('opacity', 0);
      }
    });

    // Update expand icon
    const iconElement = this.container
      .selectAll('.header-node')
      .filter((d: any) => d.id === node.id)
      .select('.expand-icon');

    iconElement
      .transition()
      .duration(this.config.animationDuration)
      .text(node.isExpanded ? '−' : '+');
  }

  private getChildNodesRecursive(parentNode: HeaderNode): HeaderNode[] {
    if (!this.currentHierarchy) return [];

    const children: HeaderNode[] = [];
    const directChildren = this.currentHierarchy.allNodes.filter(
      node => node.parentId === parentNode.id
    );

    directChildren.forEach(child => {
      children.push(child);
      children.push(...this.getChildNodesRecursive(child));
    });

    return children;
  }

  private getTextX(node: HeaderNode): number {
    const iconOffset = node.isLeaf ? 0 : 32;
    const contentWidth = node.width - iconOffset;

    switch (node.textAlign) {
      case ContentAlignmentEnum.CENTER:
        return iconOffset + contentWidth / 2;
      case ContentAlignmentEnum.RIGHT:
        return iconOffset + contentWidth - 8; // 8px padding from right
      case ContentAlignmentEnum.LEFT:
      case ContentAlignmentEnum.DATE_LEFT:
      default:
        return iconOffset + 8; // 8px padding from left
    }
  }

  private getTextAnchor(node: HeaderNode): string {
    switch (node.textAlign) {
      case ContentAlignmentEnum.CENTER:
        return 'middle';
      case ContentAlignmentEnum.RIGHT:
        return 'end';
      case ContentAlignmentEnum.LEFT:
      case ContentAlignmentEnum.DATE_LEFT:
      default:
        return 'start';
    }
  }

  private trackRenderPerformance(): void {
    const renderTime = performance.now() - this.renderStartTime;
    this.renderCount++;

    // Update running average
    this.averageRenderTime = (
      (this.averageRenderTime * (this.renderCount - 1)) + renderTime
    ) / this.renderCount;

    console.log('⏱️ SuperGridHeaders.trackRenderPerformance():', {
      renderTime: `${renderTime.toFixed(2)}ms`,
      averageTime: `${this.averageRenderTime.toFixed(2)}ms`,
      renderCount: this.renderCount,
      exceedsBudget: renderTime > this.config.performanceBudgetMs
    });
  }

  private renderFallback(): void {
    console.warn('⚠️ SuperGridHeaders.renderFallback(): Using minimal fallback rendering');

    // Clear existing and render simple header
    this.clear();
    const container = this.container.select('.headers-container');

    container.append('rect')
      .attr('width', 200)
      .attr('height', this.config.defaultHeaderHeight)
      .attr('fill', '#fee2e2')
      .attr('stroke', '#dc2626');

    container.append('text')
      .attr('x', 100)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .attr('fill', '#dc2626')
      .text('Header Error');
  }
}