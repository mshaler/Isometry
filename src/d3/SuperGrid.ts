import * as d3 from 'd3';
import { DatabaseService } from '../db/DatabaseService';

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
   * Get grid statistics for monitoring
   */
  getStats(): {
    cardsVisible: number;
    gridDimensions: { width: number; height: number };
    layoutType: string;
  } {
    const cardCount = this.container.selectAll('.card-group').size();
    return {
      cardsVisible: cardCount,
      gridDimensions: { width: this.width, height: this.height },
      layoutType: 'auto-grid'
    };
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