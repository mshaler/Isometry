/**
 * ListRenderer - Pure D3 hierarchical list implementation
 *
 * Implements ViewRenderer interface for list view type.
 * Creates hierarchical list view with nested groups based on HIERARCHY axis mapping.
 *
 * Features:
 * - D3 .data().join() pattern with key functions
 * - Hierarchical expansion/collapse functionality
 * - Vertical layout positioning via transforms
 * - NEST edge-based nesting structure
 * - Hover and click event handling
 * - SVG-based list layout with proper styling
 * - No React JSX - pure D3 DOM manipulation
 */

import * as d3 from 'd3';
import type { Node } from '@/types/node';
import type { ViewRenderer } from '../contracts/ViewEngine';
import type { ViewConfig } from '../contracts/ViewConfig';
import { devLogger } from '../../utils/logging';

/**
 * Hierarchical list item data structure for D3 binding
 */
interface HierarchicalListItem {
  id: string;
  node: Node;
  children: HierarchicalListItem[];
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * List layout configuration
 */
interface ListLayout {
  cardWidth: number;
  cardHeight: number;
  nestingIndent: number;
  verticalSpacing: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

/**
 * Pure D3 list renderer implementation
 */
export class ListRenderer implements ViewRenderer {
  // TODO: Implement container usage in render lifecycle
  // @ts-ignore - Future implementation
  private container: HTMLElement | null = null;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private listGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private contentGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;

  private hierarchicalData: HierarchicalListItem[] = [];
  private flattenedData: HierarchicalListItem[] = [];
  private layout: ListLayout;
  private config: ViewConfig | null = null;

  constructor() {
    // Default list layout
    this.layout = {
      cardWidth: 220,
      cardHeight: 60,
      nestingIndent: 24,
      verticalSpacing: 4,
      padding: { top: 20, right: 20, bottom: 20, left: 20 }
    };
  }

  /**
   * Main render method - implements ViewRenderer interface
   */
  render(container: HTMLElement, data: Node[], config: ViewConfig): void {
    try {
      this.container = container;
      this.config = config;

      // Update layout from config
      this.updateLayoutFromConfig(config);

      // Build hierarchical structure from data
      this.hierarchicalData = this.buildHierarchy(data);

      // Apply sort order based on config
      this.applySortToHierarchy(this.hierarchicalData, config);

      // Set up D3 structure
      this.setupD3Structure(container);

      // Render hierarchical list
      this.renderHierarchicalList();

      // Set up interactivity
      this.setupEventHandlers();

      devLogger.render('ListRenderer rendered hierarchical list', {
        totalNodes: data.length,
        rootItems: this.hierarchicalData.length
      });

    } catch (error) {
      devLogger.error('ListRenderer render failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Clean up D3 selections and event listeners
   */
  destroy(): void {
    if (this.svg) {
      this.svg.selectAll('*').remove();
    }

    this.container = null;
    this.svg = null;
    this.listGroup = null;
    this.contentGroup = null;
    this.hierarchicalData = [];
    this.flattenedData = [];
    this.config = null;

    devLogger.debug('ListRenderer destroyed successfully');
  }

  /**
   * Get the view type this renderer handles
   */
  getViewType(): string {
    return 'list';
  }

  // Private implementation methods

  private updateLayoutFromConfig(config: ViewConfig): void {
    // Use config styling if available
    if (config.styling?.cellSize) {
      this.layout.cardWidth = Math.max(config.styling.cellSize.width, 180);
      this.layout.cardHeight = Math.max(config.styling.cellSize.height, 40);
    }
  }

  private buildHierarchy(data: Node[]): HierarchicalListItem[] {
    // Create lookup maps
    const nodeLookup = new Map<string, Node>();
    const childrenLookup = new Map<string, string[]>();
    const parentLookup = new Map<string, string>();

    // Build node lookup
    data.forEach(node => {
      nodeLookup.set(node.id, node);
    });

    // Build parent-child relationships
    // For now, use folder-based hierarchy as fallback
    // TODO: Query NEST edges from database for true hierarchical structure
    data.forEach(node => {
      if (node.folder && node.folder.includes('/')) {
        const parentPath = node.folder.substring(0, node.folder.lastIndexOf('/'));
        const parentNode = data.find(n => n.folder === parentPath);

        if (parentNode) {
          parentLookup.set(node.id, parentNode.id);

          if (!childrenLookup.has(parentNode.id)) {
            childrenLookup.set(parentNode.id, []);
          }
          childrenLookup.get(parentNode.id)!.push(node.id);
        }
      }
    });

    // Find root nodes (no parent) and build tree
    const rootNodes = data.filter(node => !parentLookup.has(node.id));

    const buildHierarchicalItem = (node: Node, depth: number = 0): HierarchicalListItem => {
      const children = childrenLookup.get(node.id) || [];
      const childItems = children
        .map(childId => nodeLookup.get(childId))
        .filter(Boolean)
        .map(childNode => buildHierarchicalItem(childNode!, depth + 1));

      return {
        id: node.id,
        node,
        children: childItems,
        depth,
        isExpanded: true, // Default to expanded
        hasChildren: children.length > 0,
        x: 0,
        y: 0,
        width: this.layout.cardWidth,
        height: this.layout.cardHeight
      };
    };

    const hierarchy = rootNodes.map(node => buildHierarchicalItem(node));

    devLogger.debug('ListRenderer built hierarchy', {
      rootItems: rootNodes.length,
      maxDepth: this.getMaxDepth(hierarchy)
    });
    return hierarchy;
  }

  private applySortToHierarchy(items: HierarchicalListItem[], config: ViewConfig): void {
    if (!config.sort || config.sort.length === 0) return;

    const sortConfig = config.sort[0]; // Use primary sort
    const direction = sortConfig.direction === 'desc' ? -1 : 1;

    const getSortValue = (item: HierarchicalListItem) => {
      const node = item.node;
      switch (sortConfig.field) {
        case 'modifiedAt':
        case 'createdAt':
        case 'dueAt':
          return new Date(node[sortConfig.field as keyof Node] as string).getTime();
        case 'name':
          return node.name?.toLowerCase() || '';
        case 'priority':
          return node.priority || 0;
        default:
          return node[sortConfig.field as keyof Node] || '';
      }
    };

    // Recursive sort function
    const sortRecursive = (items: HierarchicalListItem[]) => {
      items.sort((a, b) => {
        const aVal = getSortValue(a);
        const bVal = getSortValue(b);

        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });

      // Sort children recursively
      items.forEach(item => {
        if (item.children.length > 0) {
          sortRecursive(item.children);
        }
      });
    };

    sortRecursive(items);
  }

  private setupD3Structure(container: HTMLElement): void {
    // Calculate total dimensions
    this.flattenedData = this.flattenHierarchy(this.hierarchicalData);
    this.calculatePositions(this.flattenedData);

    const totalHeight = Math.max(
      400,
      this.flattenedData.length * (this.layout.cardHeight + this.layout.verticalSpacing) + this.layout.padding.top + this.layout.padding.bottom
    );
    const totalWidth = Math.max(600, this.layout.cardWidth + this.layout.padding.left + this.layout.padding.right + this.getMaxDepth(this.hierarchicalData) * this.layout.nestingIndent);

    // Clear container
    d3.select(container).selectAll('*').remove();

    // Create SVG
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', totalWidth)
      .attr('height', totalHeight)
      .attr('class', 'list-renderer-svg');

    // Create main groups
    this.listGroup = this.svg.append('g').attr('class', 'list-group');
    this.contentGroup = this.listGroup.append('g').attr('class', 'content-group');

    // Add background
    this.listGroup.insert('rect', ':first-child')
      .attr('class', 'list-background')
      .attr('width', totalWidth)
      .attr('height', totalHeight)
      .attr('fill', this.config?.styling?.colorScheme === 'dark' ? '#1a1a1a' : '#ffffff');
  }

  private renderHierarchicalList(): void {
    if (!this.contentGroup) return;

    // Update positions
    this.calculatePositions(this.flattenedData);

    // D3 data binding with key function
    const listItems = this.contentGroup
      .selectAll<SVGGElement, HierarchicalListItem>('.list-item')
      .data(this.flattenedData, d => d.id);

    // ENTER selection - create new list items
    const itemEnter = listItems
      .enter()
      .append('g')
      .attr('class', 'list-item')
      .attr('data-node-id', d => d.node.id)
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'pointer')
      .style('opacity', 0); // Start invisible for animation

    // Card background
    itemEnter
      .append('rect')
      .attr('class', 'card-background')
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .attr('rx', this.config?.styling?.grid?.cellBorderRadius || 6)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    // Expansion toggle for items with children
    const expandToggleEnter = itemEnter
      .filter(d => d.hasChildren)
      .append('g')
      .attr('class', 'expansion-toggle')
      .style('cursor', 'pointer');

    expandToggleEnter
      .append('circle')
      .attr('cx', 12)
      .attr('cy', d => d.height / 2)
      .attr('r', 6)
      .attr('fill', '#6b7280')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1);

    expandToggleEnter
      .append('text')
      .attr('class', 'expansion-icon')
      .attr('x', 12)
      .attr('y', d => d.height / 2 + 1)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'white')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .text(d => d.isExpanded ? '−' : '+')
      .style('pointer-events', 'none');

    // Card title
    itemEnter
      .append('text')
      .attr('class', 'card-title')
      .attr('x', d => d.hasChildren ? 28 : 12)
      .attr('y', d => d.height / 2 - 8)
      .attr('fill', '#111827')
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .style('pointer-events', 'none')
      .text(d => d.node.name || 'Untitled')
      .call(this.truncateText.bind(this, this.layout.cardWidth - 40));

    // Card metadata
    itemEnter
      .append('text')
      .attr('class', 'card-metadata')
      .attr('x', d => d.hasChildren ? 28 : 12)
      .attr('y', d => d.height / 2 + 8)
      .attr('fill', '#6b7280')
      .attr('font-size', '11px')
      .style('pointer-events', 'none')
      .text(d => this.formatCardMetadata(d.node))
      .call(this.truncateText.bind(this, this.layout.cardWidth - 40));

    // UPDATE selection - update existing items
    const itemUpdate = itemEnter.merge(listItems);

    itemUpdate
      .transition()
      .duration(300)
      .ease(d3.easeCubicOut)
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('opacity', 1);

    // Update expansion icons
    itemUpdate
      .select('.expansion-icon')
      .text(d => d.isExpanded ? '−' : '+');

    // EXIT selection - remove old items
    listItems.exit()
      .transition()
      .duration(200)
      .style('opacity', 0)
      .remove();

    devLogger.render('ListRenderer rendered flattened list items', {
      flattenedItems: this.flattenedData.length
    });
  }

  private flattenHierarchy(items: HierarchicalListItem[]): HierarchicalListItem[] {
    const flattened: HierarchicalListItem[] = [];

    const flatten = (items: HierarchicalListItem[]) => {
      items.forEach(item => {
        flattened.push(item);

        // Include children only if parent is expanded
        if (item.isExpanded && item.children.length > 0) {
          flatten(item.children);
        }
      });
    };

    flatten(items);
    return flattened;
  }

  private calculatePositions(items: HierarchicalListItem[]): void {
    items.forEach((item, index) => {
      item.x = this.layout.padding.left + (item.depth * this.layout.nestingIndent);
      item.y = this.layout.padding.top + (index * (this.layout.cardHeight + this.layout.verticalSpacing));
    });
  }

  private toggleExpansion(item: HierarchicalListItem): void {
    item.isExpanded = !item.isExpanded;

    // Re-flatten hierarchy and re-render
    this.flattenedData = this.flattenHierarchy(this.hierarchicalData);
    this.renderHierarchicalList();

    devLogger.state('ListRenderer toggled expansion', {
      nodeName: item.node.name,
      isExpanded: item.isExpanded
    });
  }

  private getMaxDepth(items: HierarchicalListItem[]): number {
    let maxDepth = 0;

    const traverse = (items: HierarchicalListItem[]) => {
      items.forEach(item => {
        maxDepth = Math.max(maxDepth, item.depth);
        if (item.children.length > 0) {
          traverse(item.children);
        }
      });
    };

    traverse(items);
    return maxDepth;
  }

  private formatCardMetadata(node: Node): string {
    const parts: string[] = [];

    // Add folder if available
    if (node.folder) {
      parts.push(node.folder);
    }

    // Add modified date
    if (node.modifiedAt) {
      const date = new Date(node.modifiedAt);
      parts.push(date.toLocaleDateString());
    }

    // Add status if available and not default
    if (node.status && node.status !== 'active') {
      parts.push(node.status);
    }

    return parts.join(' • ') || 'No metadata';
  }

  private truncateText(maxWidth: number, textSelection: d3.Selection<SVGTextElement, HierarchicalListItem, SVGGElement, unknown>): void {
    textSelection.each(function(_d) {
      const text = d3.select(this);
      const originalText = text.text();

      // Simple truncation based on character count (approximation)
      const maxChars = Math.floor(maxWidth / 7); // Rough estimate
      if (originalText.length > maxChars) {
        text.text(originalText.substring(0, maxChars - 3) + '...');
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.contentGroup || !this.config?.eventHandlers) return;

    // Item click events
    this.contentGroup
      .selectAll('.list-item')
      .on('click', (_event, d) => {
        const itemData = d as HierarchicalListItem;
        devLogger.debug('ListRenderer item clicked', {
          nodeName: itemData.node.name,
          nodeId: itemData.node.id
        });
        this.config?.eventHandlers?.onNodeClick?.(itemData.node, { x: itemData.x, y: itemData.y });
      })
      .on('mouseenter', (event, d) => {
        const itemData = d as HierarchicalListItem;
        // Highlight item on hover
        d3.select(event.currentTarget)
          .select('.card-background')
          .attr('fill', '#f9fafb')
          .attr('stroke', '#d1d5db');

        this.config?.eventHandlers?.onNodeHover?.(itemData.node, { x: itemData.x, y: itemData.y });
      })
      .on('mouseleave', (event, _d) => {
        // Remove highlight
        d3.select(event.currentTarget)
          .select('.card-background')
          .attr('fill', '#ffffff')
          .attr('stroke', '#e5e7eb');

        this.config?.eventHandlers?.onNodeHover?.(null, null);
      });

    // Expansion toggle events
    this.contentGroup
      .selectAll('.expansion-toggle')
      .on('click', (event, d) => {
        event.stopPropagation();
        const itemData = d as HierarchicalListItem;
        this.toggleExpansion(itemData);
      });

    devLogger.setup('ListRenderer event handlers configured');
  }
}