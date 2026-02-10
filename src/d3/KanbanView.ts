import * as d3 from 'd3';
import type { ViewRenderer, CardPosition } from '../d3/ViewContinuum';
import type { ViewAxisMapping } from '../types/views';
import type { Node } from '../types/node';
import { devLogger as d3Logger } from '../utils/logging/dev-logger';
import { KanbanRenderer } from './kanban/renderer';
import { groupCardsByFacet, flattenCardsWithPositions } from './kanban/data-processor';
import type { KanbanColumn, KanbanConfig } from './kanban/types';

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
  private renderer: KanbanRenderer;

  // Layout configuration
  private readonly config: KanbanConfig = {
    cardWidth: 200,
    cardHeight: 120,
    columnWidth: 240,
    columnSpacing: 20,
    cardSpacing: 8,
    padding: { top: 60, right: 20, bottom: 20, left: 20 },
    headerHeight: 40
  };

  // Current render state (for reference and debugging)
  private columnData: KanbanColumn[] = [];

  constructor(container: SVGElement) {
    this.container = d3.select(container);
    this.contentGroup = this.setupSVGStructure();
    this.renderer = new KanbanRenderer(this.contentGroup, this.config);
  }

  // ========================================================================
  // ViewRenderer Interface Implementation
  // ========================================================================

  render(cards: Node[], axisMapping: ViewAxisMapping, activeFilters: unknown[]): void {
    d3Logger.data('KanbanView.render()', {
      cardCount: cards.length,
      axisMapping,
      filterCount: activeFilters.length
    });

    // Group cards by column facet (x-axis)
    this.columnData = groupCardsByFacet(cards, axisMapping);

    // Render the kanban board
    this.renderer.renderKanbanBoard(this.columnData);

    d3Logger.data('KanbanView rendered', {
      columnCount: this.columnData.length,
      totalCards: this.columnData.reduce((sum, col) => sum + col.cards.length, 0)
    });
  }

  getCardPositions(): Map<string, CardPosition> {
    const positions = new Map<string, CardPosition>();

    // Flatten cards with their calculated positions
    const flattenedCards = flattenCardsWithPositions(this.columnData, this.config);

    for (const item of flattenedCards) {
      positions.set(item.card.id, {
        x: item.x,
        y: item.y,
        width: this.config.cardWidth,
        height: this.config.cardHeight,
        zIndex: 1,
        metadata: {
          columnIndex: item.columnIndex,
          cardIndex: item.cardIndex,
          view: 'kanban'
        }
      });
    }

    d3Logger.data('KanbanView.getCardPositions()', { count: positions.size });
    return positions;
  }

  scrollToCard(cardId: string): void {
    d3Logger.interaction('KanbanView.scrollToCard()', { cardId });

    const cardElement = this.contentGroup.select(`[data-card-id="${cardId}"]`);
    if (cardElement.empty()) {
      d3Logger.warn('Card not found for scrolling', { cardId });
      return;
    }

    // Get the card's position and scroll to it
    const transform = cardElement.attr('transform');
    if (transform) {
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (match) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        // Scroll implementation would depend on the parent container
        d3Logger.data('Scrolling to card', { cardId, x, y });
      }
    }
  }

  destroy(): void {
    d3Logger.lifecycle('KanbanView.destroy()');

    // Remove all event listeners and D3 selections
    this.contentGroup.selectAll('*').remove();
    this.columnData = [];
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Set up the basic SVG structure for kanban rendering
   */
  private setupSVGStructure(): d3.Selection<SVGGElement, unknown, null, undefined> {
    // Clear any existing content
    this.container.selectAll('*').remove();

    // Create main content group
    const contentGroup = this.container
      .append('g')
      .attr('class', 'kanban-content');

    return contentGroup;
  }
}