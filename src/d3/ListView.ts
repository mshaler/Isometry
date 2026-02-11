import * as d3 from 'd3';
import type { ViewRenderer, CardPosition } from '../d3/ViewContinuum';
import type { ViewAxisMapping } from '../types/views';
import type { Node } from '../types/node';
import { devLogger as d3Logger } from '../utils/logging/dev-logger';

/**
 * ListView - 1-axis list projection using D3
 *
 * Renders data as hierarchical list with NEST edge-based nesting.
 * Default axis: Hierarchy (H) using folder/nesting structure.
 * Respects current LATCH sort, defaults to modified_at DESC.
 */
export class ListView implements ViewRenderer {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private contentGroup: d3.Selection<SVGGElement, unknown, null, undefined>;

  // Layout configuration
  private readonly cardWidth = 220;
  private readonly cardHeight = 60;  // Shorter for list view
  private readonly nestingIndent = 24;
  private readonly verticalSpacing = 4;
  private readonly padding = { top: 20, right: 20, bottom: 20, left: 20 };

  // Current render state (for reference)
  private hierarchicalData: HierarchicalListItem[] = [];

  constructor(container: SVGElement) {
    this.container = d3.select(container);
    this.contentGroup = this.setupSVGStructure();
  }

  // ========================================================================
  // ViewRenderer Interface Implementation
  // ========================================================================

  render(cards: Node[], axisMapping: ViewAxisMapping, activeFilters: unknown[]): void {
    d3Logger.render('ListView.render()', {
      cardCount: cards.length,
      axisMapping,
      filterCount: activeFilters.length
    });

    // Store for reference

    // Build hierarchical structure from cards and NEST edges
    this.hierarchicalData = this.buildHierarchy(cards);

    // Apply sort order from axis mapping
    this.applySort(this.hierarchicalData, axisMapping);

    // Render the hierarchical list
    this.renderHierarchicalList();
  }

  getCardPositions(): Map<string, CardPosition> {
    const positions = new Map<string, CardPosition>();

    this.contentGroup
      .selectAll<SVGGElement, HierarchicalListItem>('.list-item')
      .each((d, i, nodes) => {
        const element = d3.select(nodes[i]);
        const transform = element.attr('transform');

        // Parse transform to get x, y coordinates
        const match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (match && d.card) {
          const x = parseFloat(match[1]);
          const y = parseFloat(match[2]);

          positions.set(d.card.id, {
            cardId: d.card.id,
            x,
            y,
            width: this.cardWidth,
            height: this.cardHeight
          });
        }
      });

    d3Logger.metrics('ListView.getCardPositions()', { count: positions.size });
    return positions;
  }

  scrollToCard(cardId: string): void {
    const cardElement = this.contentGroup
      .selectAll('.list-item')
      .filter((d: unknown) => (d as HierarchicalListItem).card?.id === cardId);

    if (!cardElement.empty()) {
      const transform = cardElement.attr('transform');
      const match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);

      if (match) {
        const y = parseFloat(match[2]);

        // Animate scroll to bring card into view
        // TODO: Implement smooth scrolling to y position
        d3Logger.inspect('ListView.scrollToCard()', { cardId, y });
      }
    }
  }

  destroy(): void {
    this.contentGroup.selectAll('*').remove();
    this.hierarchicalData = [];

    d3Logger.setup('ListView.destroy()', { message: 'Cleanup complete' });
  }

  // ========================================================================
  // Hierarchy Building and Management
  // ========================================================================

  /**
   * Build hierarchical structure from cards and NEST edges
   */
  private buildHierarchy(cards: Node[]): HierarchicalListItem[] {
    // Create lookup maps
    const cardLookup = new Map<string, Node>();
    const childrenLookup = new Map<string, string[]>();
    const parentLookup = new Map<string, string>();

    // Build card lookup
    cards.forEach(card => {
      cardLookup.set(card.id, card);
    });

    // Build parent-child relationships from NEST edges
    // Note: This is a simplified version - in real implementation, edges would come from a separate query
    cards.forEach(card => {
      // TODO: Query NEST edges from database where this card is target
      // For now, use a simple folder-based hierarchy as fallback
      if (card.folder && card.folder.includes('/')) {
        const parentPath = card.folder.substring(0, card.folder.lastIndexOf('/'));
        const parentCard = cards.find(c => c.folder === parentPath);

        if (parentCard) {
          parentLookup.set(card.id, parentCard.id);

          if (!childrenLookup.has(parentCard.id)) {
            childrenLookup.set(parentCard.id, []);
          }
          childrenLookup.get(parentCard.id)!.push(card.id);
        }
      }
    });

    // Find root cards (no parent) and build tree
    const rootCards = cards.filter(card => !parentLookup.has(card.id));

    const buildNode = (card: Node, depth: number = 0): HierarchicalListItem => {
      const children = childrenLookup.get(card.id) || [];
      const childNodes = children
        .map(childId => cardLookup.get(childId))
        .filter(Boolean)
        .map(childCard => buildNode(childCard!, depth + 1));

      return {
        card,
        children: childNodes,
        depth,
        isExpanded: true, // Default to expanded
        hasChildren: children.length > 0
      };
    };

    const hierarchy = rootCards.map(card => buildNode(card));

    d3Logger.data('ListView.buildHierarchy()', {
      totalCards: cards.length,
      rootCards: rootCards.length,
      maxDepth: this.getMaxDepth(hierarchy)
    });

    return hierarchy;
  }

  /**
   * Apply sort order based on axis mapping
   */
  private applySort(items: HierarchicalListItem[], axisMapping: ViewAxisMapping): void {
    const sortConfig = axisMapping.primarySort;
    if (!sortConfig) return;

    const direction = sortConfig.direction === 'desc' ? -1 : 1;

    // Sort function based on facet type
    const getSortValue = (item: HierarchicalListItem) => {
      const card = item.card;
      switch (sortConfig.facet) {
        case 'modifiedAt':
        case 'createdAt':
        case 'dueAt':
          return new Date(card[sortConfig.facet] as string).getTime();
        case 'name':
          return card.name?.toLowerCase() || '';
        case 'priority':
          return card.priority || 0;
        default:
          return card[sortConfig.facet as keyof Node] || '';
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

    d3Logger.state('ListView.applySort()', {
      facet: sortConfig.facet,
      direction: sortConfig.direction,
      itemCount: items.length
    });
  }

  // ========================================================================
  // Rendering
  // ========================================================================

  /**
   * Render the hierarchical list structure
   */
  private renderHierarchicalList(): void {
    // Flatten hierarchy for rendering
    const flattenedItems = this.flattenHierarchy(this.hierarchicalData);

    // Data binding with key function
    const listItems = this.contentGroup
      .selectAll<SVGGElement, HierarchicalListItem>('.list-item')
      .data(flattenedItems, d => d.card.id);

    // Enter selection
    const enterSelection = listItems.enter()
      .append('g')
      .attr('class', 'list-item')
      .attr('data-card-id', d => d.card.id)
      .style('cursor', 'pointer');

    // Create card background
    enterSelection.append('rect')
      .attr('class', 'card-background')
      .attr('width', this.cardWidth)
      .attr('height', this.cardHeight)
      .attr('rx', 6)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    // Create expansion toggle for items with children
    enterSelection
      .filter(d => d.hasChildren)
      .append('circle')
      .attr('class', 'expansion-toggle')
      .attr('cx', 12)
      .attr('cy', this.cardHeight / 2)
      .attr('r', 6)
      .attr('fill', '#6b7280')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        this.toggleExpansion(d);
      });

    // Create expansion toggle icon
    enterSelection
      .filter(d => d.hasChildren)
      .append('text')
      .attr('class', 'expansion-icon')
      .attr('x', 12)
      .attr('y', this.cardHeight / 2 + 1)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'white')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .text(d => d.isExpanded ? '−' : '+')
      .style('pointer-events', 'none');

    // Create card title
    enterSelection.append('text')
      .attr('class', 'card-title')
      .attr('x', d => d.hasChildren ? 28 : 12)
      .attr('y', 25)
      .attr('fill', '#111827')
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .style('pointer-events', 'none')
      .text(d => d.card.name || 'Untitled');

    // Create card metadata
    enterSelection.append('text')
      .attr('class', 'card-metadata')
      .attr('x', d => d.hasChildren ? 28 : 12)
      .attr('y', 42)
      .attr('fill', '#6b7280')
      .attr('font-size', '11px')
      .style('pointer-events', 'none')
      .text(d => this.formatCardMetadata(d.card));

    // Update selection
    const updateSelection = enterSelection.merge(listItems);

    // Position items based on hierarchy
    updateSelection
      .transition()
      .duration(300)
      .ease(d3.easeCubicOut)
      .attr('transform', (d, i) => {
        const x = this.padding.left + (d.depth * this.nestingIndent);
        const y = this.padding.top + (i * (this.cardHeight + this.verticalSpacing));
        return `translate(${x}, ${y})`;
      });

    // Update expansion icons
    updateSelection
      .select('.expansion-icon')
      .text(d => d.isExpanded ? '−' : '+');

    // Update hover effects
    updateSelection
      .on('mouseenter', function() {
        d3.select(this).select('.card-background')
          .attr('fill', '#f9fafb')
          .attr('stroke', '#d1d5db');
      })
      .on('mouseleave', function() {
        d3.select(this).select('.card-background')
          .attr('fill', '#ffffff')
          .attr('stroke', '#e5e7eb');
      })
      .on('click', (_event, d) => {
        // Handle card selection
        d3Logger.data('ListView: Card clicked', { cardId: d.card.id });
      });

    // Exit selection
    listItems.exit()
      .transition()
      .duration(200)
      .style('opacity', 0)
      .remove();

    d3Logger.render('ListView.renderHierarchicalList()', {
      flattenedCount: flattenedItems.length,
      visibleCount: updateSelection.size()
    });
  }

  // ========================================================================
  // Hierarchy Utilities
  // ========================================================================

  /**
   * Flatten hierarchical data for rendering (respecting expansion state)
   */
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

  /**
   * Toggle expansion state of a hierarchical item
   */
  private toggleExpansion(item: HierarchicalListItem): void {
    item.isExpanded = !item.isExpanded;

    // Re-render to show/hide children
    this.renderHierarchicalList();

    d3Logger.state('ListView.toggleExpansion()', {
      cardId: item.card.id,
      isExpanded: item.isExpanded,
      childCount: item.children.length
    });
  }

  /**
   * Get maximum depth in hierarchy
   */
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

  // ========================================================================
  // Utilities
  // ========================================================================

  /**
   * Set up SVG structure for list view
   */
  private setupSVGStructure(): d3.Selection<SVGGElement, unknown, null, undefined> {
    // Clear existing content
    this.container.selectAll('*').remove();

    // Create main content group
    const contentGroup = this.container.append('g')
      .attr('class', 'list-view-content')
      .attr('transform', 'translate(0, 0)');

    d3Logger.setup('ListView: SVG structure initialized', {});
    return contentGroup;
  }

  /**
   * Format card metadata for display
   */
  private formatCardMetadata(card: Node): string {
    const parts: string[] = [];

    // Add folder if available
    if (card.folder) {
      parts.push(card.folder);
    }

    // Add modified date
    if (card.modifiedAt) {
      const date = new Date(card.modifiedAt);
      parts.push(date.toLocaleDateString());
    }

    // Add status if available
    if (card.status && card.status !== 'active') {
      parts.push(card.status);
    }

    return parts.join(' • ') || 'No metadata';
  }
}

/**
 * Internal interface for hierarchical list items
 */
interface HierarchicalListItem {
  card: Node;
  children: HierarchicalListItem[];
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
}