/**
 * Rendering engine for KanbanView
 */

import * as d3 from 'd3';
import type { KanbanColumn, KanbanConfig } from './types';
import { getPriorityColor, formatCardMetadata, truncateText } from './formatters';

export class KanbanRenderer {
  private contentGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private config: KanbanConfig;

  constructor(
    contentGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    config: KanbanConfig
  ) {
    this.contentGroup = contentGroup;
    this.config = config;
  }

  /**
   * Render the complete kanban board
   */
  renderKanbanBoard(columnData: KanbanColumn[]): void {
    this.renderColumnHeaders(columnData);
    this.renderColumnBodies(columnData);
    this.renderCardsInColumns(columnData);
  }

  /**
   * Render column headers with titles and count badges
   */
  private renderColumnHeaders(columnData: KanbanColumn[]): void {
    // Bind data to column headers
    const headers = this.contentGroup
      .selectAll('.column-header')
      .data(columnData, (d: unknown) => d.id);

    const headerEnter = headers
      .enter()
      .append('g')
      .attr('class', 'column-header');

    // Header background
    headerEnter
      .append('rect')
      .attr('class', 'header-background')
      .attr('width', this.config.columnWidth)
      .attr('height', this.config.headerHeight)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1)
      .attr('rx', 6);

    // Header title
    headerEnter
      .append('text')
      .attr('class', 'header-title')
      .attr('x', 12)
      .attr('y', this.config.headerHeight / 2)
      .attr('dy', '0.35em')
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', '#1e293b');

    // Count badge
    const badgeGroup = headerEnter
      .append('g')
      .attr('class', 'count-badge')
      .attr('transform', `translate(${this.config.columnWidth - 35}, ${this.config.headerHeight / 2})`);

    badgeGroup
      .append('circle')
      .attr('r', 10)
      .attr('fill', '#3b82f6');

    badgeGroup
      .append('text')
      .attr('class', 'count-text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .attr('fill', 'white');

    // Update all headers (enter + existing)
    const allHeaders = headerEnter.merge(headers as any);

    allHeaders
      .attr('transform', (_d: KanbanColumn, i: number) =>
        `translate(${this.config.padding.left + i * (this.config.columnWidth + this.config.columnSpacing)}, ${this.config.padding.top})`
      );

    allHeaders
      .select('.header-title')
      .text((d: KanbanColumn) => d.title);

    allHeaders
      .select('.count-text')
      .text((d: KanbanColumn) => Math.min(d.cards.length, 99));

    // Remove old headers
    headers.exit().remove();
  }

  /**
   * Render column body containers
   */
  private renderColumnBodies(columnData: KanbanColumn[]): void {
    // Bind data to column bodies
    const bodies = this.contentGroup
      .selectAll('.column-body')
      .data(columnData, (d: unknown) => d.id);

    const bodyEnter = bodies
      .enter()
      .append('rect')
      .attr('class', 'column-body')
      .attr('width', this.config.columnWidth)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('rx', 6)
      .attr('opacity', 0.3);

    // Update all bodies (enter + existing)
    const allBodies = bodyEnter.merge(bodies as any);

    allBodies
      .attr('transform', (_d: KanbanColumn, i: number) =>
        `translate(${this.config.padding.left + i * (this.config.columnWidth + this.config.columnSpacing)}, ${this.config.padding.top + this.config.headerHeight + 10})`
      )
      .attr('height', (d: KanbanColumn) =>
        Math.max(100, d.cards.length * (this.config.cardHeight + this.config.cardSpacing) + this.config.cardSpacing)
      );

    // Remove old bodies
    bodies.exit().remove();
  }

  /**
   * Render cards within their columns
   */
  private renderCardsInColumns(columnData: KanbanColumn[]): void {
    // Flatten all cards with their positions
    const flatCards = columnData.flatMap((column, columnIndex) =>
      column.cards.map((card, cardIndex) => ({
        card,
        columnIndex,
        cardIndex,
        x: this.config.padding.left +
           columnIndex * (this.config.columnWidth + this.config.columnSpacing) +
           (this.config.columnWidth - this.config.cardWidth) / 2,
        y: this.config.padding.top + this.config.headerHeight + 20 +
           cardIndex * (this.config.cardHeight + this.config.cardSpacing)
      }))
    );

    // Data binding with key function
    const cards = this.contentGroup
      .selectAll('.kanban-card')
      .data(flatCards, (d: unknown) => d.card.id);

    const cardEnter = cards
      .enter()
      .append('g')
      .attr('class', 'kanban-card');

    // Card background
    cardEnter
      .append('rect')
      .attr('class', 'card-background')
      .attr('width', this.config.cardWidth)
      .attr('height', this.config.cardHeight)
      .attr('fill', 'white')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1)
      .attr('rx', 8)
      .style('cursor', 'pointer');

    // Card title
    cardEnter
      .append('text')
      .attr('class', 'card-title')
      .attr('x', 12)
      .attr('y', 20)
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .attr('fill', '#1e293b');

    // Card metadata
    cardEnter
      .append('text')
      .attr('class', 'card-metadata')
      .attr('x', 12)
      .attr('y', this.config.cardHeight - 25)
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '11px')
      .attr('fill', '#64748b');

    // Priority indicator
    cardEnter
      .append('circle')
      .attr('class', 'priority-indicator')
      .attr('cx', this.config.cardWidth - 15)
      .attr('cy', 15)
      .attr('r', 4);

    // Tags indicator (if card has tags)
    cardEnter
      .append('circle')
      .attr('class', 'tags-indicator')
      .attr('cx', this.config.cardWidth - 35)
      .attr('cy', 15)
      .attr('r', 3)
      .attr('fill', '#8b5cf6');

    // Tags count
    cardEnter
      .append('text')
      .attr('class', 'tags-count')
      .attr('x', this.config.cardWidth - 35)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '9px')
      .attr('font-weight', '500')
      .attr('fill', 'white');

    // Update all cards (enter + existing)
    const allCards = cardEnter.merge(cards as any);

    allCards
      .transition()
      .duration(300)
      .attr('transform', (d: unknown) => `translate(${d.x}, ${d.y})`);

    allCards
      .select('.card-title')
      .text((d: unknown) => truncateText(d.card.title || 'Untitled', 25));

    allCards
      .select('.card-metadata')
      .text((d: unknown) => formatCardMetadata(d.card));

    allCards
      .select('.priority-indicator')
      .attr('fill', (d: unknown) => getPriorityColor(d.card.priority));

    // Show/hide tags indicator based on whether card has tags
    allCards
      .select('.tags-indicator')
      .style('display', (d: unknown) => (d.card.tags && d.card.tags.length > 0) ? null : 'none');

    allCards
      .select('.tags-count')
      .style('display', (d: unknown) => (d.card.tags && d.card.tags.length > 0) ? null : 'none')
      .text((d: unknown) => d.card.tags ? Math.min(d.card.tags.length, 9) : '');

    // Remove old cards with animation
    cards
      .exit()
      .transition()
      .duration(300)
      .attr('opacity', 0)
      .remove();
  }
}