import * as d3 from 'd3';
import type { ViewRenderer, CardPosition } from '../d3/ViewContinuum';
import type { ViewAxisMapping } from '../types/views';
import type { Node } from '../types/node';

/**
 * KanbanView - 1-facet column projection using D3
 *
 * Renders data as horizontal columns grouped by category facet.
 * Default column facet: status (universal UX convention).
 * Cards within columns sorted by current LATCH sort.
 */
export class KanbanView implements ViewRenderer {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private contentGroup: d3.Selection<SVGGElement, unknown, null, undefined>;

  // Layout configuration
  private readonly cardWidth = 200;
  private readonly cardHeight = 120;
  private readonly columnWidth = 240;
  private readonly columnSpacing = 20;
  private readonly cardSpacing = 8;
  private readonly padding = { top: 60, right: 20, bottom: 20, left: 20 };
  private readonly headerHeight = 40;

  // Current render state (for reference and debugging)
  private columnData: KanbanColumn[] = [];

  constructor(container: SVGElement) {
    this.container = d3.select(container);
    this.contentGroup = this.setupSVGStructure();
  }

  // ========================================================================
  // ViewRenderer Interface Implementation
  // ========================================================================

  render(cards: Node[], axisMapping: ViewAxisMapping, activeFilters: any[]): void {
    console.log('📋 KanbanView.render():', {
      cardCount: cards.length,
      axisMapping,
      filterCount: activeFilters.length
    });

    // Store for reference (used in formatCardMetadata)

    // Group cards by column facet (x-axis)
    this.columnData = this.groupCardsByFacet(cards, axisMapping);

    // Apply sort order within each column
    this.applySortToColumns(this.columnData, axisMapping);

    // Render the kanban board
    this.renderKanbanBoard();
  }

  getCardPositions(): Map<string, CardPosition> {
    const positions = new Map<string, CardPosition>();

    this.contentGroup
      .selectAll<SVGGElement, Node>('.kanban-card')
      .each((d, i, nodes) => {
        const element = d3.select(nodes[i]);
        const transform = element.attr('transform');

        // Parse transform to get x, y coordinates
        const match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (match) {
          const x = parseFloat(match[1]);
          const y = parseFloat(match[2]);

          positions.set(d.id, {
            cardId: d.id,
            x,
            y,
            width: this.cardWidth,
            height: this.cardHeight
          });
        }
      });

    console.log('📏 KanbanView.getCardPositions():', { count: positions.size });
    return positions;
  }

  scrollToCard(cardId: string): void {
    const cardElement = this.contentGroup
      .selectAll('.kanban-card')
      .filter((d: any) => d.id === cardId);

    if (!cardElement.empty()) {
      const transform = cardElement.attr('transform');
      const match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);

      if (match) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);

        // Animate scroll to bring card into view
        // TODO: Implement smooth scrolling to x,y position
        console.log('🎯 KanbanView.scrollToCard():', { cardId, x, y });
      }
    }
  }

  destroy(): void {
    this.contentGroup.selectAll('*').remove();
    this.columnData = [];

    console.log('🗑️ KanbanView.destroy(): Cleanup complete');
  }

  // ========================================================================
  // Data Grouping and Organization
  // ========================================================================

  /**
   * Group cards by the configured facet value
   */
  private groupCardsByFacet(cards: Node[], axisMapping: ViewAxisMapping): KanbanColumn[] {
    const xAxisConfig = axisMapping.xAxis;
    if (!xAxisConfig) {
      console.warn('⚠️ KanbanView: No x-axis configuration, using default status grouping');
      return this.groupByStatus(cards);
    }

    const facet = xAxisConfig.facet;
    const groupMap = new Map<string, Node[]>();
    const unassignedCards: Node[] = [];

    // Group cards by facet value
    cards.forEach(card => {
      const facetValue = this.getCardFacetValue(card, facet);

      if (facetValue === null || facetValue === undefined || facetValue === '') {
        unassignedCards.push(card);
      } else {
        const key = String(facetValue);
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(card);
      }
    });

    // Convert to column data structure
    const columns: KanbanColumn[] = [];

    // Add regular columns
    groupMap.forEach((cards, key) => {
      columns.push({
        id: key,
        title: this.formatColumnTitle(key, facet),
        cards,
        facetValue: key
      });
    });

    // Add unassigned column if there are unassigned cards
    if (unassignedCards.length > 0) {
      columns.push({
        id: 'unassigned',
        title: 'Unassigned',
        cards: unassignedCards,
        facetValue: null
      });
    }

    // Sort columns by logical order
    this.sortColumnsByLogicalOrder(columns, facet);

    console.log('📊 KanbanView.groupCardsByFacet():', {
      facet,
      columnCount: columns.length,
      unassignedCount: unassignedCards.length,
      columns: columns.map(col => ({ title: col.title, count: col.cards.length }))
    });

    return columns;
  }

  /**
   * Default grouping by status for fallback
   */
  private groupByStatus(cards: Node[]): KanbanColumn[] {
    const statusGroups = new Map<string, Node[]>();
    const unassignedCards: Node[] = [];

    cards.forEach(card => {
      const status = card.status || 'unassigned';

      if (status === 'unassigned') {
        unassignedCards.push(card);
      } else {
        if (!statusGroups.has(status)) {
          statusGroups.set(status, []);
        }
        statusGroups.get(status)!.push(card);
      }
    });

    const columns: KanbanColumn[] = [];

    // Standard status order
    const statusOrder = ['todo', 'in-progress', 'review', 'done', 'blocked'];

    statusOrder.forEach(status => {
      if (statusGroups.has(status)) {
        columns.push({
          id: status,
          title: this.formatColumnTitle(status, 'status'),
          cards: statusGroups.get(status)!,
          facetValue: status
        });
      }
    });

    // Add any remaining statuses not in the standard order
    statusGroups.forEach((cards, status) => {
      if (!statusOrder.includes(status)) {
        columns.push({
          id: status,
          title: this.formatColumnTitle(status, 'status'),
          cards,
          facetValue: status
        });
      }
    });

    // Add unassigned column
    if (unassignedCards.length > 0) {
      columns.push({
        id: 'unassigned',
        title: 'Unassigned',
        cards: unassignedCards,
        facetValue: null
      });
    }

    return columns;
  }

  /**
   * Apply sort order to cards within each column
   */
  private applySortToColumns(columns: KanbanColumn[], axisMapping: ViewAxisMapping): void {
    const sortConfig = axisMapping.primarySort;
    if (!sortConfig) return;

    const direction = sortConfig.direction === 'desc' ? -1 : 1;
    const facet = sortConfig.facet;

    const getSortValue = (card: Node) => {
      switch (facet) {
        case 'modifiedAt':
        case 'createdAt':
        case 'dueAt':
          return new Date(card[facet] as string).getTime();
        case 'name':
          return card.name?.toLowerCase() || '';
        case 'priority':
          return card.priority || 0;
        default:
          return (card as any)[facet] || '';
      }
    };

    columns.forEach(column => {
      column.cards.sort((a, b) => {
        const aVal = getSortValue(a);
        const bVal = getSortValue(b);

        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
    });

    console.log('🔄 KanbanView.applySortToColumns():', {
      sortFacet: facet,
      direction: sortConfig.direction,
      columnCount: columns.length
    });
  }

  // ========================================================================
  // Rendering
  // ========================================================================

  /**
   * Render the complete kanban board
   */
  private renderKanbanBoard(): void {
    // Render column headers
    this.renderColumnHeaders();

    // Render column content areas
    this.renderColumnBodies();

    // Render cards within columns
    this.renderCardsInColumns();
  }

  /**
   * Render column headers
   */
  private renderColumnHeaders(): void {
    const columnHeaders = this.contentGroup
      .selectAll<SVGGElement, KanbanColumn>('.column-header')
      .data(this.columnData, d => d.id);

    // Enter selection
    const enterHeaders = columnHeaders.enter()
      .append('g')
      .attr('class', 'column-header');

    // Header background
    enterHeaders.append('rect')
      .attr('class', 'header-background')
      .attr('width', this.columnWidth)
      .attr('height', this.headerHeight)
      .attr('rx', 6)
      .attr('fill', '#f3f4f6')
      .attr('stroke', '#d1d5db')
      .attr('stroke-width', 1);

    // Header title
    enterHeaders.append('text')
      .attr('class', 'header-title')
      .attr('x', 12)
      .attr('y', 26)
      .attr('fill', '#374151')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .style('pointer-events', 'none')
      .text(d => d.title);

    // Card count badge
    enterHeaders.append('circle')
      .attr('class', 'count-badge')
      .attr('cx', this.columnWidth - 30)
      .attr('cy', 20)
      .attr('r', 12)
      .attr('fill', '#6b7280')
      .style('pointer-events', 'none');

    enterHeaders.append('text')
      .attr('class', 'count-text')
      .attr('x', this.columnWidth - 30)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .style('pointer-events', 'none')
      .text(d => d.cards.length);

    // Update selection
    const updateHeaders = enterHeaders.merge(columnHeaders);

    updateHeaders
      .attr('transform', (_d, i) => {
        const x = this.padding.left + (i * (this.columnWidth + this.columnSpacing));
        return `translate(${x}, ${this.padding.top - this.headerHeight - 10})`;
      });

    // Update count badges
    updateHeaders.select('.count-text')
      .text(d => d.cards.length);

    // Exit selection
    columnHeaders.exit().remove();
  }

  /**
   * Render column body areas
   */
  private renderColumnBodies(): void {
    const columnBodies = this.contentGroup
      .selectAll<SVGRectElement, KanbanColumn>('.column-body')
      .data(this.columnData, d => d.id);

    // Enter selection
    columnBodies.enter()
      .append('rect')
      .attr('class', 'column-body')
      .attr('width', this.columnWidth)
      .attr('height', 600) // TODO: Make dynamic based on content
      .attr('rx', 6)
      .attr('fill', '#f9fafb')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .style('pointer-events', 'none')
      .merge(columnBodies)
      .attr('transform', (_d, i) => {
        const x = this.padding.left + (i * (this.columnWidth + this.columnSpacing));
        return `translate(${x}, ${this.padding.top})`;
      });

    columnBodies.exit().remove();
  }

  /**
   * Render cards within columns
   */
  private renderCardsInColumns(): void {
    // Flatten cards for rendering with position information
    const flattenedCards = this.flattenCardsWithPositions();

    // Data binding with key function
    const cards = this.contentGroup
      .selectAll<SVGGElement, FlattenedCard>('.kanban-card')
      .data(flattenedCards, d => d.card.id);

    // Enter selection
    const enterCards = cards.enter()
      .append('g')
      .attr('class', 'kanban-card')
      .attr('data-card-id', d => d.card.id)
      .style('cursor', 'pointer');

    // Card background
    enterCards.append('rect')
      .attr('class', 'card-background')
      .attr('width', this.cardWidth)
      .attr('height', this.cardHeight)
      .attr('rx', 8)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    // Card title
    enterCards.append('text')
      .attr('class', 'card-title')
      .attr('x', 12)
      .attr('y', 25)
      .attr('fill', '#111827')
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .style('pointer-events', 'none')
      .text(d => this.truncateText(d.card.name || 'Untitled', 20));

    // Card metadata
    enterCards.append('text')
      .attr('class', 'card-metadata')
      .attr('x', 12)
      .attr('y', 45)
      .attr('fill', '#6b7280')
      .attr('font-size', '11px')
      .style('pointer-events', 'none')
      .text(d => this.formatCardMetadata(d.card));

    // Priority indicator (if applicable)
    enterCards
      .filter(d => d.card.priority > 1) // priority is a number, 1 is normal
      .append('circle')
      .attr('class', 'priority-indicator')
      .attr('cx', this.cardWidth - 15)
      .attr('cy', 15)
      .attr('r', 4)
      .attr('fill', d => this.getPriorityColor(String(d.card.priority)))
      .style('pointer-events', 'none');

    // Tags indicator (if applicable)
    enterCards
      .filter(d => d.card.tags && d.card.tags.length > 0)
      .append('rect')
      .attr('class', 'tags-indicator')
      .attr('x', 12)
      .attr('y', this.cardHeight - 25)
      .attr('width', 20)
      .attr('height', 12)
      .attr('rx', 3)
      .attr('fill', '#ddd6fe')
      .style('pointer-events', 'none');

    enterCards
      .filter(d => d.card.tags && d.card.tags.length > 0)
      .append('text')
      .attr('class', 'tags-count')
      .attr('x', 22)
      .attr('y', this.cardHeight - 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#5b21b6')
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .style('pointer-events', 'none')
      .text(d => d.card.tags?.length || '');

    // Update selection
    const updateCards = enterCards.merge(cards);

    updateCards
      .transition()
      .duration(300)
      .ease(d3.easeCubicOut)
      .attr('transform', d => `translate(${d.x}, ${d.y})`);

    // Hover effects
    updateCards
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
        console.log('📋 KanbanView: Card clicked:', d.card.id);
      });

    // Exit selection
    cards.exit()
      .transition()
      .duration(200)
      .style('opacity', 0)
      .remove();

    console.log('✅ KanbanView.renderCardsInColumns():', {
      cardCount: flattenedCards.length,
      visibleCards: updateCards.size()
    });
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  /**
   * Set up SVG structure for kanban view
   */
  private setupSVGStructure(): d3.Selection<SVGGElement, unknown, null, undefined> {
    // Clear existing content
    this.container.selectAll('*').remove();

    // Create main content group
    const contentGroup = this.container.append('g')
      .attr('class', 'kanban-view-content')
      .attr('transform', 'translate(0, 0)');

    console.log('🏗️ KanbanView: SVG structure initialized');
    return contentGroup;
  }

  /**
   * Flatten cards with position calculations
   */
  private flattenCardsWithPositions(): FlattenedCard[] {
    const flattened: FlattenedCard[] = [];

    this.columnData.forEach((column, columnIndex) => {
      const columnX = this.padding.left + (columnIndex * (this.columnWidth + this.columnSpacing)) +
                     ((this.columnWidth - this.cardWidth) / 2); // Center cards in columns

      column.cards.forEach((card, cardIndex) => {
        const y = this.padding.top + 20 + (cardIndex * (this.cardHeight + this.cardSpacing));

        flattened.push({
          card,
          x: columnX,
          y,
          columnIndex,
          cardIndex
        });
      });
    });

    return flattened;
  }

  /**
   * Get facet value from a card
   */
  private getCardFacetValue(card: Node, facet: string): any {
    return card[facet as keyof Node] || null;
  }

  /**
   * Format column title for display
   */
  private formatColumnTitle(value: string, facet: string): string {
    switch (facet) {
      case 'status':
        return this.formatStatus(value);
      case 'priority':
        return this.formatPriority(value);
      case 'folder':
        return value.replace(/^\//, '').replace(/\/$/, '') || 'Root';
      default:
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
  }

  /**
   * Format status value for display
   */
  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'todo': 'To Do',
      'in-progress': 'In Progress',
      'review': 'In Review',
      'done': 'Done',
      'blocked': 'Blocked',
      'backlog': 'Backlog'
    };

    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
  }

  /**
   * Format priority value for display
   */
  private formatPriority(priority: string): string {
    const priorityMap: Record<string, string> = {
      'low': 'Low Priority',
      'normal': 'Normal Priority',
      'high': 'High Priority',
      'urgent': 'Urgent',
      'critical': 'Critical'
    };

    return priorityMap[priority] || priority.charAt(0).toUpperCase() + priority.slice(1);
  }

  /**
   * Sort columns by logical order based on facet type
   */
  private sortColumnsByLogicalOrder(columns: KanbanColumn[], facet: string): void {
    if (facet === 'status') {
      const statusOrder = ['todo', 'in-progress', 'review', 'done', 'blocked'];
      columns.sort((a, b) => {
        const aIndex = statusOrder.indexOf(a.id);
        const bIndex = statusOrder.indexOf(b.id);

        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    } else if (facet === 'priority') {
      const priorityOrder = ['critical', 'urgent', 'high', 'normal', 'low'];
      columns.sort((a, b) => {
        const aIndex = priorityOrder.indexOf(a.id);
        const bIndex = priorityOrder.indexOf(b.id);

        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    } else {
      // Alphabetical order for other facets
      columns.sort((a, b) => a.title.localeCompare(b.title));
    }

    // Always put unassigned at the end
    const unassignedIndex = columns.findIndex(col => col.id === 'unassigned');
    if (unassignedIndex > -1) {
      const unassigned = columns.splice(unassignedIndex, 1)[0];
      columns.push(unassigned);
    }
  }

  /**
   * Get priority color for indicators
   */
  private getPriorityColor(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'critical': return '#dc2626';
      case 'urgent': return '#ea580c';
      case 'high': return '#d97706';
      case 'normal': return '#059669';
      case 'low': return '#0d9488';
      default: return '#6b7280';
    }
  }

  /**
   * Format card metadata for display
   */
  private formatCardMetadata(card: Node): string {
    const parts: string[] = [];

    // Add modified date
    if (card.modifiedAt) {
      const date = new Date(card.modifiedAt);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        parts.push('Today');
      } else if (diffDays === 1) {
        parts.push('Yesterday');
      } else if (diffDays < 7) {
        parts.push(`${diffDays}d ago`);
      } else {
        parts.push(date.toLocaleDateString());
      }
    }

    // Add folder (always show for metadata)
    if (card.folder) {
      parts.push(card.folder);
    }

    return parts.join(' • ') || 'No metadata';
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}

/**
 * Internal interface for kanban columns
 */
interface KanbanColumn {
  id: string;
  title: string;
  cards: Node[];
  facetValue: string | null;
}

/**
 * Internal interface for flattened cards with position data
 */
interface FlattenedCard {
  card: Node;
  x: number;
  y: number;
  columnIndex: number;
  cardIndex: number;
}