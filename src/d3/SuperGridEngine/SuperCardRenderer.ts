/**
 * SuperCardRenderer - Visual distinction for header cards and aggregation rows
 *
 * SuperCards are non-data cards that provide grid structure and summaries:
 * - Header cards: Chrome gradient styling, visual hierarchy
 * - Aggregation cards: Count/sum/avg values at grid bottom
 *
 * Key Principles:
 * - isSuperCard() returns true for header/aggregation types
 * - SuperCards are excluded from FTS5 search results
 * - Chrome gradient: #f8f8f8 -> #e8e8e8 vertical
 * - Aggregation row: fixed 32px height
 */

import type * as d3Type from 'd3';

// ============================================================================
// Types
// ============================================================================

/**
 * Card type enum - distinguishes data cards from structural cards
 */
export type CardType = 'data' | 'header' | 'aggregation';

/**
 * Aggregation function types for SuperCards
 */
export type AggregationType = 'count' | 'sum' | 'avg';

/**
 * SuperCard interface - extends basic card with type and aggregation info
 */
export interface SuperCard {
  /** Unique identifier */
  id: string;
  /** Card type: data, header, or aggregation */
  type: CardType;
  /** Reference to header descriptor ID (for header cards) */
  headerId?: string;
  /** Hierarchy level for header cards (0 = root) */
  headerLevel?: number;
  /** Type of aggregation (for aggregation cards) */
  aggregationType?: AggregationType;
  /** Computed aggregation value (for aggregation cards) */
  aggregationValue?: number;
  /** Grid X position (column index) */
  gridX: number;
  /** Grid Y position (row index) */
  gridY: number;
  /** Cell width in pixels */
  width: number;
  /** Cell height in pixels */
  height: number;
}

// ============================================================================
// Style Constants
// ============================================================================

/**
 * Chrome gradient for header cards - NeXTSTEP-inspired brushed metal
 */
export const CHROME_GRADIENT = {
  start: '#f8f8f8',
  end: '#e8e8e8',
} as const;

/**
 * Aggregation row styling
 */
export const AGGREGATION_STYLE = {
  background: '#f0f4f8',
  border: '#d0d8e0',
  text: '#4a5568',
  height: 32,
} as const;

/**
 * Header shadow filter settings
 */
export const HEADER_SHADOW = {
  dx: 0,
  dy: 1,
  stdDeviation: 1,
  floodOpacity: 0.15,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a card is a SuperCard (header or aggregation)
 * SuperCards are excluded from search results and have distinct styling
 *
 * @param card - The card to check
 * @returns true if the card is a header or aggregation card
 */
export function isSuperCard(card: SuperCard): boolean {
  return card.type === 'header' || card.type === 'aggregation';
}

/**
 * Check if an ID belongs to a SuperCard based on prefix convention
 * Used for filtering search results without needing the full card object
 *
 * @param id - The card ID to check
 * @returns true if the ID starts with 'header-' or 'agg-'
 */
export function isSuperCardId(id: string): boolean {
  return id.startsWith('header-') || id.startsWith('agg-');
}

/**
 * Factory function to create a SuperCard with defaults
 *
 * @param params - Partial SuperCard properties
 * @returns Complete SuperCard object
 */
export function createSuperCard(params: Partial<SuperCard> & {
  id: string;
  type: CardType;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
}): SuperCard {
  return {
    ...params,
  };
}

// ============================================================================
// SuperCardRenderer Class
// ============================================================================

/**
 * SuperCardRenderer - Handles D3.js rendering of header and aggregation cards
 *
 * Responsibilities:
 * - Create SVG defs for gradients and filters
 * - Render header cards with chrome styling
 * - Render aggregation cards with count/sum/avg display
 */
export class SuperCardRenderer {
  private defsCreated = false;

  /**
   * Create SVG defs for gradients and filters
   * Must be called once before rendering SuperCards
   *
   * @param svg - D3 selection of SVG element
   */
  createDefs(svg: d3Type.Selection<SVGSVGElement, unknown, null, undefined>): void {
    if (this.defsCreated) return;

    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) {
      defs = svg.append('defs');
    }

    // Chrome gradient for headers
    const gradient = defs.append('linearGradient')
      .attr('id', 'chrome-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', CHROME_GRADIENT.start);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', CHROME_GRADIENT.end);

    // Header shadow filter
    const filter = defs.append('filter')
      .attr('id', 'header-shadow')
      .attr('x', '-10%')
      .attr('y', '-10%')
      .attr('width', '120%')
      .attr('height', '120%');

    filter.append('feDropShadow')
      .attr('dx', HEADER_SHADOW.dx)
      .attr('dy', HEADER_SHADOW.dy)
      .attr('stdDeviation', HEADER_SHADOW.stdDeviation)
      .attr('flood-opacity', HEADER_SHADOW.floodOpacity);

    this.defsCreated = true;
  }

  /**
   * Render header card with chrome gradient styling
   *
   * @param selection - D3 selection of header card group
   */
  renderHeaderCard(
    selection: d3Type.Selection<SVGGElement, SuperCard, SVGGElement, unknown>
  ): void {
    // Update or create background rect
    let bg = selection.select<SVGRectElement>('rect.header-bg');
    if (bg.empty()) {
      bg = selection.append('rect').attr('class', 'header-bg');
    }

    bg
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .attr('fill', 'url(#chrome-gradient)')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1)
      .attr('filter', 'url(#header-shadow)');
  }

  /**
   * Render aggregation card with count/sum/avg display
   *
   * @param selection - D3 selection of aggregation card group
   */
  renderAggregationCard(
    selection: d3Type.Selection<SVGGElement, SuperCard, SVGGElement, unknown>
  ): void {
    // Update or create background rect
    let bg = selection.select<SVGRectElement>('rect.agg-bg');
    if (bg.empty()) {
      bg = selection.append('rect').attr('class', 'agg-bg');
    }

    bg
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .attr('fill', AGGREGATION_STYLE.background)
      .attr('stroke', AGGREGATION_STYLE.border)
      .attr('stroke-width', 1);

    // Update or create value text
    let text = selection.select<SVGTextElement>('text.agg-value');
    if (text.empty()) {
      text = selection.append('text').attr('class', 'agg-value');
    }

    text
      .attr('x', d => d.width / 2)
      .attr('y', d => d.height / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', AGGREGATION_STYLE.text)
      .attr('font-weight', 'bold')
      .attr('font-size', '11px')
      .text(d => {
        if (d.aggregationType === 'count') {
          return `Count: ${d.aggregationValue ?? 0}`;
        } else if (d.aggregationType === 'sum') {
          return `Sum: ${d.aggregationValue ?? 0}`;
        } else if (d.aggregationType === 'avg') {
          return `Avg: ${(d.aggregationValue ?? 0).toFixed(1)}`;
        }
        return String(d.aggregationValue ?? 0);
      });
  }

  /**
   * Check if defs have been created
   */
  hasDefsCreated(): boolean {
    return this.defsCreated;
  }

  /**
   * Reset defs state (for testing)
   */
  resetDefs(): void {
    this.defsCreated = false;
  }
}

