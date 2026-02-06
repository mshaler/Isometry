import * as d3 from 'd3';
import { DatabaseService } from '../db/DatabaseService';
import { useVirtualizedGrid, type VirtualizedGridResult } from '../hooks/useVirtualizedGrid';
import { type CellData, type VirtualGridCell } from '../types/grid';
import { type Node } from '../types/node';

/**
 * SuperGrid - Core D3.js renderer with direct sql.js data binding
 *
 * Purpose: Validate bridge elimination architecture by demonstrating zero serialization
 * overhead between sql.js queries and D3.js data binding. This is the foundation for
 * all future D3 renderers (Network, Kanban, Timeline).
 *
 * Architecture: D3.js queries DatabaseService directly in same memory space - no bridge
 *
 * Key principles from CLAUDE.md:
 * - Always use .join() with key functions (d => d.id)
 * - Direct synchronous db.query() calls (no promises)
 * - Same memory space data binding (cards array directly to D3)
 * - Zero serialization boundaries
 */
export class SuperGrid {
  private db: DatabaseService;
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private width: number;
  private height: number;
  private cardWidth = 120;
  private cardHeight = 80;
  private padding = 10;

  // Virtual scrolling integration
  private virtualScrolling: VirtualizedGridResult | null = null;
  private enableVirtualScrolling = true;

  constructor(container: SVGElement, db: DatabaseService, options?: { width?: number; height?: number }) {
    this.db = db;
    this.container = d3.select(container);
    this.width = options?.width || 800;
    this.height = options?.height || 600;

    // Set container dimensions
    this.container
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`);
  }

  /**
   * Render grid with direct sql.js query → D3.js data binding
   *
   * Core requirement: Synchronous operation with zero serialization overhead
   * Follows CLAUDE.md D3.js patterns exactly
   */
  render(): void {
    if (!this.db.isReady()) {
      throw new Error('DatabaseService must be initialized before rendering');
    }

    // Direct synchronous query - core CLAUDE.md requirement
    // This proves sql.js → D3.js works in same memory space
    const cards = this.db.query<{
      id: string;
      name: string;
      folder?: string;
      status?: string;
      x?: number;
      y?: number;
      created_at?: string;
    }>(
      `SELECT id, name, folder, status,
              COALESCE(x, 0) as x, COALESCE(y, 0) as y, created_at
       FROM nodes
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 50`,
      []
    );

    // Use shared rendering logic to ensure consistent behavior
    this.renderCards(cards);
  }

  /**
   * Apply LATCH filters via SQL WHERE clauses
   * Demonstrates how filtering works in the bridge elimination architecture
   */
  renderWithFilters(filters: {
    folder?: string;
    status?: string;
    search?: string;
  } = {}): void {
    if (!this.db.isReady()) {
      throw new Error('DatabaseService must be initialized before rendering');
    }

    // Build SQL WHERE clause from LATCH filters
    const whereConditions: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];

    if (filters.folder) {
      whereConditions.push('folder = ?');
      params.push(filters.folder);
    }

    if (filters.status) {
      whereConditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.search) {
      // Use LIKE fallback since standard sql.js lacks FTS5
      whereConditions.push('name LIKE ?');
      params.push(`%${filters.search}%`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Direct synchronous filtered query
    const cards = this.db.query<{
      id: string;
      name: string;
      folder?: string;
      status?: string;
      x?: number;
      y?: number;
      created_at?: string;
    }>(
      `SELECT id, name, folder, status,
              COALESCE(x, 0) as x, COALESCE(y, 0) as y, created_at
       FROM nodes
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT 50`,
      params
    );

    // Same D3.js binding logic as render() - could be refactored
    this.renderCards(cards);
  }

  /**
   * Re-render with updated data from database
   * Demonstrates reactive updates in bridge elimination architecture
   */
  refresh(): void {
    this.render();
  }

  /**
   * Clear the grid
   */
  clear(): void {
    this.container.selectAll('.card-group').remove();
  }

  /**
   * Enable virtual scrolling with performance optimization for large datasets
   */
  enableVirtualization(enable: boolean = true): void {
    this.enableVirtualScrolling = enable;
  }

  /**
   * Render virtual grid cells using D3.js data binding with virtual items
   *
   * This method handles the integration between TanStack Virtual's virtualization
   * and D3.js rendering for high-performance grid display with 10k+ cells
   */
  renderVirtualCells(virtualItems: VirtualGridCell[]): void {
    if (!virtualItems.length) {
      this.clear();
      return;
    }

    // Convert virtual items to card data for D3.js binding
    const cardsWithPositions = virtualItems.map((virtualItem) => {
      const { cellData } = virtualItem;

      // Use virtual positioning from TanStack Virtual
      return {
        ...cellData.cards[0], // Use first card as primary data
        id: `cell-${cellData.row}-${cellData.column}`,
        x: cellData.x,
        y: cellData.y,
        virtualIndex: virtualItem.virtualIndex,
        cellData: cellData, // Include full cell data for morphing
        cardCount: cellData.cards.length
      };
    });

    // Apply D3.js data binding with virtual items
    const cellSelection = this.container
      .selectAll<SVGGElement, typeof cardsWithPositions[0]>('.virtual-cell')
      .data(cardsWithPositions, d => d.id);

    // Use specialized join for virtual cells
    this.applyVirtualCellJoin(cellSelection);
  }

  /**
   * Specialized D3.js join pattern for virtual grid cells
   *
   * Handles Janus density morphing and count badges based on cell data
   */
  private applyVirtualCellJoin(selection: d3.Selection<SVGGElement, any, SVGElement, unknown>): void {
    const joined = selection.join(
      enter => {
        const groups = enter.append('g')
          .attr('class', 'virtual-cell')
          .attr('transform', d => `translate(${d.x}, ${d.y})`);

        // Render based on cell density level
        groups.each((d, i, nodes) => {
          const group = d3.select(nodes[i]);
          this.renderCellContent(group, d);
        });

        return groups;
      },
      update => {
        // Update position and content for existing cells
        update
          .transition()
          .duration(200)
          .attr('transform', d => `translate(${d.x}, ${d.y})`);

        // Re-render cell content if density changed
        update.each((d, i, nodes) => {
          const group = d3.select(nodes[i]);
          group.selectAll('*').remove(); // Clear existing content
          this.renderCellContent(group, d);
        });

        return update;
      },
      exit => exit
        .transition()
        .duration(150)
        .attr('opacity', 0)
        .remove()
    );

    // Add interaction handlers
    joined
      .style('cursor', 'pointer')
      .on('mouseenter', function(_event, d) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr('transform', `translate(${d.x}, ${d.y}) scale(1.02)`);
      })
      .on('mouseleave', function(_event, d) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr('transform', `translate(${d.x}, ${d.y}) scale(1)`);
      })
      .on('click', (_event, d) => {
        console.log('Virtual cell clicked:', d);
        // Future: emit selection events for React integration
      });
  }

  /**
   * Render cell content based on Janus density model
   */
  private renderCellContent(group: d3.Selection<SVGGElement, any, null, undefined>, cellData: any): void {
    const { cardCount = 1 } = cellData;

    if (cardCount === 1) {
      // Single card rendering
      this.renderSingleCard(group, cellData);
    } else if (cardCount <= 5) {
      // Card stack with visible count
      this.renderCardStack(group, cellData, cardCount);
    } else {
      // Dense count badge
      this.renderCountBadge(group, cardCount);
    }
  }

  /**
   * Render single card (sparse state)
   */
  private renderSingleCard(group: d3.Selection<SVGGElement, any, null, undefined>, cardData: any): void {
    // Card background
    group.append('rect')
      .attr('width', this.cardWidth)
      .attr('height', this.cardHeight)
      .attr('rx', 6)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1)
      .style('filter', 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))');

    // Card title
    group.append('text')
      .attr('x', 8)
      .attr('y', 20)
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', '#111827')
      .text(this.truncateText(cardData.name || 'Untitled', 14));

    // Status indicator
    group.append('circle')
      .attr('cx', this.cardWidth - 12)
      .attr('cy', 12)
      .attr('r', 4)
      .attr('fill', this.getStatusColor(cardData.status));
  }

  /**
   * Render card stack (group state)
   */
  private renderCardStack(group: d3.Selection<SVGGElement, any, null, undefined>, cardData: any, count: number): void {
    const stackOffset = 3;
    const maxVisible = Math.min(count, 3);

    // Render stacked cards with offset
    for (let i = maxVisible - 1; i >= 0; i--) {
      const offset = i * stackOffset;

      const cardGroup = group.append('g')
        .attr('transform', `translate(${offset}, ${offset})`);

      // Card background
      cardGroup.append('rect')
        .attr('width', this.cardWidth - offset * 2)
        .attr('height', this.cardHeight - offset * 2)
        .attr('rx', 6)
        .attr('fill', i === 0 ? '#ffffff' : '#f9fafb')
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 1)
        .attr('opacity', 1 - i * 0.15);

      // Only show content on top card
      if (i === 0) {
        cardGroup.append('text')
          .attr('x', 8)
          .attr('y', 20)
          .attr('font-family', 'system-ui, sans-serif')
          .attr('font-size', '14px')
          .attr('font-weight', '600')
          .attr('fill', '#111827')
          .text(this.truncateText(cardData.name || 'Untitled', 12));

        // Count badge in corner
        const countBadge = cardGroup.append('g')
          .attr('transform', 'translate(90, 8)');

        countBadge.append('circle')
          .attr('r', 12)
          .attr('fill', '#3b82f6')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2);

        countBadge.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-family', 'system-ui, sans-serif')
          .attr('font-size', '11px')
          .attr('font-weight', '700')
          .attr('fill', '#ffffff')
          .text(count.toString());
      }
    }
  }

  /**
   * Render count badge (dense states)
   */
  private renderCountBadge(group: d3.Selection<SVGGElement, any, null, undefined>, count: number): void {
    const badgeSize = Math.min(32, Math.max(16, 16 + Math.log10(count) * 8));

    // Background circle
    group.append('circle')
      .attr('cx', this.cardWidth / 2)
      .attr('cy', this.cardHeight / 2)
      .attr('r', badgeSize)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 3)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))');

    // Count text
    group.append('text')
      .attr('x', this.cardWidth / 2)
      .attr('y', this.cardHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', `${Math.min(18, badgeSize * 0.7)}px`)
      .attr('font-weight', '700')
      .attr('fill', '#ffffff')
      .text(this.formatCount(count));
  }

  /**
   * Get grid statistics for monitoring including virtual scrolling metrics
   */
  getStats(): {
    cardsVisible: number;
    gridDimensions: { width: number; height: number };
    layoutType: string;
    virtualScrolling?: {
      enabled: boolean;
      renderedCells: number;
      totalCells: number;
      memoryEfficiency: number;
    };
  } {
    const cardCount = this.container.selectAll('.virtual-cell, .card-group').size();
    const stats = {
      cardsVisible: cardCount,
      gridDimensions: { width: this.width, height: this.height },
      layoutType: this.enableVirtualScrolling ? 'virtual-grid' : 'auto-grid'
    };

    if (this.enableVirtualScrolling && this.virtualScrolling) {
      return {
        ...stats,
        virtualScrolling: {
          enabled: true,
          renderedCells: this.virtualScrolling.virtualItems.length,
          totalCells: this.virtualScrolling.performanceMetrics.totalItemCount,
          memoryEfficiency: this.virtualScrolling.performanceMetrics.memoryEfficiency
        }
      };
    }

    return stats;
  }

  /**
   * Helper to get status indicator color
   */
  private getStatusColor(status?: string): string {
    switch (status) {
      case 'active': return '#10b981';
      case 'completed': return '#6b7280';
      case 'blocked': return '#ef4444';
      case 'in_progress': return '#f59e0b';
      default: return '#9ca3af';
    }
  }

  /**
   * Truncate text to specified length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  /**
   * Format count for display in badges
   */
  private formatCount(count: number): string {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${Math.round(count / 100) / 10}k`;
    return `${Math.round(count / 100000) / 10}M`;
  }

  /**
   * Shared card rendering logic
   */
  private renderCards(cards: any[]): void {
    // Calculate positions
    const cardsWithPositions = cards.map((card, index) => {
      if (!card.x || !card.y) {
        const cols = Math.floor(this.width / (this.cardWidth + this.padding));
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          ...card,
          x: col * (this.cardWidth + this.padding) + this.padding,
          y: row * (this.cardHeight + this.padding) + this.padding
        };
      }
      return card;
    });

    // Same D3.js data binding pattern
    const cardSelection = this.container
      .selectAll<SVGGElement, typeof cardsWithPositions[0]>('.card-group')
      .data(cardsWithPositions, d => d.id);

    // Apply same join pattern
    this.applyCardJoin(cardSelection);
  }

  /**
   * Reusable D3.js join pattern for cards
   */
  private applyCardJoin(selection: d3.Selection<SVGGElement, any, SVGElement, unknown>): d3.Selection<SVGGElement, any, SVGElement, unknown> {
    const joined = selection.join(
      enter => {
        const groups = enter.append('g')
          .attr('class', 'card-group')
          .attr('transform', d => `translate(${d.x}, ${d.y})`);

        // Same card structure as in render()
        groups.append('rect')
          .attr('class', 'card-background')
          .attr('width', this.cardWidth)
          .attr('height', this.cardHeight)
          .attr('rx', 6)
          .attr('fill', '#ffffff')
          .attr('stroke', '#e5e7eb')
          .attr('stroke-width', 1);

        groups.append('text')
          .attr('class', 'card-name')
          .attr('x', 8)
          .attr('y', 20)
          .attr('font-family', 'system-ui, sans-serif')
          .attr('font-size', '14px')
          .attr('font-weight', '600')
          .attr('fill', '#111827')
          .text(d => d.name);

        groups.append('text')
          .attr('class', 'card-folder')
          .attr('x', 8)
          .attr('y', 40)
          .attr('font-family', 'system-ui, sans-serif')
          .attr('font-size', '11px')
          .attr('fill', '#6b7280')
          .text(d => d.folder || 'No folder');

        groups.append('circle')
          .attr('class', 'status-indicator')
          .attr('cx', this.cardWidth - 12)
          .attr('cy', 12)
          .attr('r', 4)
          .attr('fill', d => this.getStatusColor(d.status));

        return groups;
      },
      update => {
        update
          .transition()
          .duration(300)
          .attr('transform', d => `translate(${d.x}, ${d.y})`);

        update.select('.card-name').text(d => d.name);
        update.select('.card-folder').text(d => d.folder || 'No folder');
        update.select('.status-indicator').attr('fill', d => this.getStatusColor(d.status));

        return update;
      },
      exit => exit
        .transition()
        .duration(200)
        .attr('opacity', 0)
        .remove()
    );

    // Add hover interactions to all cards (enter + update)
    joined
      .style('cursor', 'pointer')
      .on('mouseenter', function() {
        d3.select(this)
          .select('.card-background')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 2);
      })
      .on('mouseleave', function() {
        d3.select(this)
          .select('.card-background')
          .attr('stroke', '#e5e7eb')
          .attr('stroke-width', 1);
      })
      .on('click', (_event, d) => {
        console.log('Card clicked:', d);
        // Future: emit selection events for React integration
      });

    return joined;
  }
}