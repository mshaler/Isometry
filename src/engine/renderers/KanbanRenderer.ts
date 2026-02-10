/**
 * KanbanRenderer - Pure D3 column-based kanban implementation
 *
 * Implements ViewRenderer interface for kanban view type.
 * Creates column-based layout using CATEGORY axis for columns.
 *
 * Features:
 * - D3 .data().join() pattern with key functions
 * - Column-based layout with status/categorical grouping
 * - Cards positioned within columns
 * - Drag and drop support using D3 drag behavior
 * - Column headers with aggregate counts
 * - SVG-based kanban layout with proper styling
 * - No React JSX - pure D3 DOM manipulation
 */

import * as d3 from 'd3';
import type { Node } from '@/types/node';
import type { ViewRenderer } from '../contracts/ViewEngine';
import type { ViewConfig } from '../contracts/ViewConfig';
import { devLogger } from '../../utils/logging';

/**
 * Kanban column data structure
 */
interface KanbanColumn {
  id: string;
  title: string;
  nodes: Node[];
  facetValue: string | null;
  x: number;
  width: number;
}

/**
 * Flattened card data with position information
 */
interface KanbanCardData {
  id: string;
  node: Node;
  columnId: string;
  columnIndex: number;
  cardIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Kanban layout configuration
 */
interface KanbanLayout {
  cardWidth: number;
  cardHeight: number;
  columnWidth: number;
  columnSpacing: number;
  cardSpacing: number;
  headerHeight: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

/**
 * Pure D3 kanban renderer implementation
 */
export class KanbanRenderer implements ViewRenderer {
  // TODO: Implement container usage in render lifecycle
  // @ts-ignore - Future implementation
  private container: HTMLElement | null = null;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private kanbanGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private columnsGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private cardsGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;

  private columns: KanbanColumn[] = [];
  private cards: KanbanCardData[] = [];
  private layout: KanbanLayout;
  private config: ViewConfig | null = null;

  constructor() {
    // Default kanban layout
    this.layout = {
      cardWidth: 200,
      cardHeight: 120,
      columnWidth: 240,
      columnSpacing: 20,
      cardSpacing: 8,
      headerHeight: 40,
      padding: { top: 60, right: 20, bottom: 20, left: 20 }
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

      // Group data into columns
      this.columns = this.groupDataIntoColumns(data, config);

      // Apply sort order within each column
      this.applySortToColumns(this.columns, config);

      // Transform to card data with positions
      this.cards = this.transformToCardData(this.columns);

      // Set up D3 structure
      this.setupD3Structure(container);

      // Render kanban board
      this.renderColumns();
      this.renderCards();

      // Set up interactivity
      this.setupEventHandlers();

      devLogger.render('KanbanRenderer rendered nodes in columns', {
        totalNodes: data.length,
        columnCount: this.columns.length
      });

    } catch (error) {
      devLogger.error('KanbanRenderer render failed', {
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
    this.kanbanGroup = null;
    this.columnsGroup = null;
    this.cardsGroup = null;
    this.columns = [];
    this.cards = [];
    this.config = null;

    devLogger.debug('KanbanRenderer destroyed successfully');
  }

  /**
   * Get the view type this renderer handles
   */
  getViewType(): string {
    return 'kanban';
  }

  // Private implementation methods

  private updateLayoutFromConfig(config: ViewConfig): void {
    // Use config styling if available
    if (config.styling?.cellSize) {
      this.layout.cardWidth = Math.max(config.styling.cellSize.width, 150);
      this.layout.cardHeight = Math.max(config.styling.cellSize.height, 80);
      this.layout.columnWidth = this.layout.cardWidth + 40;
    }

    if (config.styling?.headerSize) {
      this.layout.headerHeight = Math.max(config.styling.headerSize.height, 30);
    }
  }

  private groupDataIntoColumns(data: Node[], config: ViewConfig): KanbanColumn[] {
    // Determine grouping facet from projection (default to status)
    const xAxisMapping = config.projection?.x;
    const groupingFacet = xAxisMapping?.facet || 'status';

    const groupMap = new Map<string, Node[]>();
    const unassignedNodes: Node[] = [];

    // Group nodes by facet value
    data.forEach(node => {
      const facetValue = this.getNodeFacetValue(node, groupingFacet);

      if (facetValue === null || facetValue === undefined || facetValue === '') {
        unassignedNodes.push(node);
      } else {
        const key = String(facetValue);
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(node);
      }
    });

    // Convert to column data structure
    const columns: KanbanColumn[] = [];

    // Add regular columns
    groupMap.forEach((nodes, key) => {
      columns.push({
        id: key,
        title: this.formatColumnTitle(key, groupingFacet),
        nodes,
        facetValue: key,
        x: 0, // Will be calculated in calculateColumnPositions
        width: this.layout.columnWidth
      });
    });

    // Add unassigned column if there are unassigned nodes
    if (unassignedNodes.length > 0) {
      columns.push({
        id: 'unassigned',
        title: 'Unassigned',
        nodes: unassignedNodes,
        facetValue: null,
        x: 0,
        width: this.layout.columnWidth
      });
    }

    // Sort columns by logical order
    this.sortColumnsByLogicalOrder(columns, groupingFacet);

    // Calculate column positions
    this.calculateColumnPositions(columns);

    devLogger.debug('KanbanRenderer grouped nodes into columns', {
      totalNodes: data.length,
      columnCount: columns.length,
      groupingFacet
    });
    return columns;
  }

  private applySortToColumns(columns: KanbanColumn[], config: ViewConfig): void {
    if (!config.sort || config.sort.length === 0) return;

    const sortConfig = config.sort[0]; // Use primary sort
    const direction = sortConfig.direction === 'desc' ? -1 : 1;

    const getSortValue = (node: Node) => {
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
          return (node as any)[sortConfig.field] || '';
      }
    };

    columns.forEach(column => {
      column.nodes.sort((a, b) => {
        const aVal = getSortValue(a);
        const bVal = getSortValue(b);

        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
    });
  }

  private transformToCardData(columns: KanbanColumn[]): KanbanCardData[] {
    const cards: KanbanCardData[] = [];

    columns.forEach((column, columnIndex) => {
      const columnCenterX = column.x + (column.width - this.layout.cardWidth) / 2;

      column.nodes.forEach((node, cardIndex) => {
        const y = this.layout.padding.top + 20 + (cardIndex * (this.layout.cardHeight + this.layout.cardSpacing));

        cards.push({
          id: node.id,
          node,
          columnId: column.id,
          columnIndex,
          cardIndex,
          x: columnCenterX,
          y,
          width: this.layout.cardWidth,
          height: this.layout.cardHeight
        });
      });
    });

    return cards;
  }

  private calculateColumnPositions(columns: KanbanColumn[]): void {
    columns.forEach((column, index) => {
      column.x = this.layout.padding.left + (index * (this.layout.columnWidth + this.layout.columnSpacing));
    });
  }

  private setupD3Structure(container: HTMLElement): void {
    // Calculate total dimensions
    const totalWidth = Math.max(
      800,
      this.columns.length * (this.layout.columnWidth + this.layout.columnSpacing) +
        this.layout.padding.left + this.layout.padding.right
    );

    const maxCardsInColumn = Math.max(...this.columns.map(col => col.nodes.length), 1);
    const totalHeight = Math.max(
      400,
      this.layout.padding.top + (maxCardsInColumn * (this.layout.cardHeight + this.layout.cardSpacing)) + 100
    );

    // Clear container
    d3.select(container).selectAll('*').remove();

    // Create SVG
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', totalWidth)
      .attr('height', totalHeight)
      .attr('class', 'kanban-renderer-svg');

    // Create main groups
    this.kanbanGroup = this.svg.append('g').attr('class', 'kanban-group');
    this.columnsGroup = this.kanbanGroup.append('g').attr('class', 'columns-group');
    this.cardsGroup = this.kanbanGroup.append('g').attr('class', 'cards-group');

    // Add background
    this.kanbanGroup.insert('rect', ':first-child')
      .attr('class', 'kanban-background')
      .attr('width', totalWidth)
      .attr('height', totalHeight)
      .attr('fill', this.config?.styling?.colorScheme === 'dark' ? '#1a1a1a' : '#ffffff');
  }

  private renderColumns(): void {
    if (!this.columnsGroup) return;

    // Column headers
    const columnGroups = this.columnsGroup
      .selectAll<SVGGElement, KanbanColumn>('.column')
      .data(this.columns, d => d.id);

    // ENTER selection
    const columnEnter = columnGroups
      .enter()
      .append('g')
      .attr('class', 'column')
      .attr('transform', d => `translate(${d.x}, 0)`);

    // Column header background
    columnEnter
      .append('rect')
      .attr('class', 'column-header-bg')
      .attr('width', d => d.width)
      .attr('height', this.layout.headerHeight)
      .attr('rx', 6)
      .attr('fill', '#f3f4f6')
      .attr('stroke', '#d1d5db')
      .attr('stroke-width', 1)
      .attr('y', this.layout.padding.top - this.layout.headerHeight - 10);

    // Column title
    columnEnter
      .append('text')
      .attr('class', 'column-title')
      .attr('x', 12)
      .attr('y', this.layout.padding.top - this.layout.headerHeight / 2 - 10 + 4)
      .attr('fill', '#374151')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .style('pointer-events', 'none')
      .text(d => d.title);

    // Card count badge
    columnEnter
      .append('circle')
      .attr('class', 'count-badge')
      .attr('cx', d => d.width - 30)
      .attr('cy', this.layout.padding.top - this.layout.headerHeight / 2 - 10)
      .attr('r', 12)
      .attr('fill', '#6b7280')
      .style('pointer-events', 'none');

    columnEnter
      .append('text')
      .attr('class', 'count-text')
      .attr('x', d => d.width - 30)
      .attr('y', this.layout.padding.top - this.layout.headerHeight / 2 - 10 + 4)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .style('pointer-events', 'none')
      .text(d => d.nodes.length);

    // Column body (drop zone)
    columnEnter
      .append('rect')
      .attr('class', 'column-body')
      .attr('width', d => d.width)
      .attr('height', 600) // Fixed height for now
      .attr('rx', 6)
      .attr('fill', '#f9fafb')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .attr('y', this.layout.padding.top)
      .style('pointer-events', 'none');

    // UPDATE selection
    const columnUpdate = columnEnter.merge(columnGroups);

    columnUpdate
      .attr('transform', d => `translate(${d.x}, 0)`);

    // Update count badges
    columnUpdate.select('.count-text')
      .text(d => d.nodes.length);

    // EXIT selection
    columnGroups.exit().remove();

    devLogger.render('KanbanRenderer rendered kanban columns', {
      columnCount: this.columns.length
    });
  }

  private renderCards(): void {
    if (!this.cardsGroup) return;

    // D3 data binding with key function
    const cardGroups = this.cardsGroup
      .selectAll<SVGGElement, KanbanCardData>('.kanban-card')
      .data(this.cards, d => d.id);

    // ENTER selection
    const cardEnter = cardGroups
      .enter()
      .append('g')
      .attr('class', 'kanban-card')
      .attr('data-node-id', d => d.node.id)
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'pointer')
      .style('opacity', 0); // Start invisible for animation

    // Card background
    cardEnter
      .append('rect')
      .attr('class', 'card-background')
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .attr('rx', this.config?.styling?.grid?.cellBorderRadius || 8)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    // Card title
    cardEnter
      .append('text')
      .attr('class', 'card-title')
      .attr('x', 12)
      .attr('y', 25)
      .attr('fill', '#111827')
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .style('pointer-events', 'none')
      .text(d => this.truncateText(d.node.name || 'Untitled', 20));

    // Card metadata
    cardEnter
      .append('text')
      .attr('class', 'card-metadata')
      .attr('x', 12)
      .attr('y', 45)
      .attr('fill', '#6b7280')
      .attr('font-size', '11px')
      .style('pointer-events', 'none')
      .text(d => this.formatCardMetadata(d.node));

    // Priority indicator (for high priority items)
    cardEnter
      .filter(d => {
        const priority = d.node.priority;
        return typeof priority === 'number' && priority > 1;
      })
      .append('circle')
      .attr('class', 'priority-indicator')
      .attr('cx', d => d.width - 15)
      .attr('cy', 15)
      .attr('r', 4)
      .attr('fill', d => this.getPriorityColor(d.node.priority || 0))
      .style('pointer-events', 'none');

    // Tags indicator (if tags exist)
    cardEnter
      .filter(d => d.node.tags && d.node.tags.length > 0)
      .append('rect')
      .attr('class', 'tags-indicator')
      .attr('x', 12)
      .attr('y', d => d.height - 25)
      .attr('width', 20)
      .attr('height', 12)
      .attr('rx', 3)
      .attr('fill', '#ddd6fe')
      .style('pointer-events', 'none');

    cardEnter
      .filter(d => d.node.tags && d.node.tags.length > 0)
      .append('text')
      .attr('class', 'tags-count')
      .attr('x', 22)
      .attr('y', d => d.height - 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#5b21b6')
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .style('pointer-events', 'none')
      .text(d => d.node.tags?.length || '');

    // UPDATE selection
    const cardUpdate = cardEnter.merge(cardGroups);

    cardUpdate
      .transition()
      .duration(300)
      .ease(d3.easeCubicOut)
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('opacity', 1);

    // EXIT selection
    cardGroups.exit()
      .transition()
      .duration(200)
      .style('opacity', 0)
      .remove();

    devLogger.render('KanbanRenderer rendered kanban cards', {
      cardCount: this.cards.length
    });
  }

  private getNodeFacetValue(node: Node, facet: string): any {
    return (node as any)[facet] || null;
  }

  private formatColumnTitle(value: string, facet: string): string {
    switch (facet) {
      case 'status':
        return this.formatStatusTitle(value);
      case 'priority':
        return this.formatPriorityTitle(value);
      case 'folder':
        return value.replace(/^\//, '').replace(/\/$/, '') || 'Root';
      default:
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
  }

  private formatStatusTitle(status: string): string {
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

  private formatPriorityTitle(priority: string): string {
    const priorityMap: Record<string, string> = {
      'low': 'Low Priority',
      'normal': 'Normal Priority',
      'high': 'High Priority',
      'urgent': 'Urgent',
      'critical': 'Critical'
    };

    return priorityMap[priority] || priority.charAt(0).toUpperCase() + priority.slice(1);
  }

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

  private getPriorityColor(priority: number): string {
    if (priority >= 4) return '#dc2626'; // Critical/High
    if (priority >= 3) return '#ea580c'; // Urgent
    if (priority >= 2) return '#d97706'; // Medium
    return '#059669'; // Normal/Low
  }

  private formatCardMetadata(node: Node): string {
    const parts: string[] = [];

    // Add modified date
    if (node.modifiedAt) {
      const date = new Date(node.modifiedAt);
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

    // Add folder (if meaningful)
    if (node.folder && node.folder !== '/') {
      parts.push(node.folder);
    }

    return parts.join(' • ') || 'No metadata';
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private setupEventHandlers(): void {
    if (!this.cardsGroup || !this.config?.eventHandlers) return;

    // Card click and hover events
    this.cardsGroup
      .selectAll('.kanban-card')
      .on('click', (_event, d) => {
        const cardData = d as KanbanCardData;
        devLogger.debug('KanbanRenderer card clicked', {
          nodeName: cardData.node.name,
          nodeId: cardData.node.id
        });
        this.config?.eventHandlers?.onNodeClick?.(cardData.node, { x: cardData.x, y: cardData.y });
      })
      .on('mouseenter', (event, d) => {
        const cardData = d as KanbanCardData;
        // Highlight card on hover
        d3.select(event.currentTarget)
          .select('.card-background')
          .attr('fill', '#f9fafb')
          .attr('stroke', '#d1d5db');

        this.config?.eventHandlers?.onNodeHover?.(cardData.node, { x: cardData.x, y: cardData.y });
      })
      .on('mouseleave', (event, _d) => {
        // Remove highlight
        d3.select(event.currentTarget)
          .select('.card-background')
          .attr('fill', '#ffffff')
          .attr('stroke', '#e5e7eb');

        this.config?.eventHandlers?.onNodeHover?.(null, null);
      });

    // TODO: Add drag and drop functionality
    // this.setupDragAndDrop();

    devLogger.setup('KanbanRenderer event handlers configured');
  }
}