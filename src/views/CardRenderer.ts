// Isometry v5 — Phase 5 CardRenderer
// Shared card rendering functions for SVG and HTML views.
//
// Design:
//   - renderSvgCard: for D3 SVG-based views (ListView, GridView)
//   - renderHtmlCard: for HTML-based views (KanbanView)
//   - Identical visual structure enables smooth morph transitions (VIEW-09)
//   - Name truncation: SVG uses textLength; HTML uses CSS text-overflow: ellipsis
//
// Requirements: REND-07, REND-08

import * as d3 from 'd3';
import type { CardDatum } from './types';
import type { CardType } from '../database/queries/types';

// ---------------------------------------------------------------------------
// Card dimensions
// ---------------------------------------------------------------------------

/**
 * Standard card dimensions in pixels.
 * Used by all view renderers for consistent sizing.
 */
export const CARD_DIMENSIONS = {
  /** List row width */
  width: 280,
  /** List row height */
  height: 48,
  /** Grid tile width */
  gridWidth: 180,
  /** Grid tile height */
  gridHeight: 120,
  /** Internal padding */
  padding: 12,
} as const;

// ---------------------------------------------------------------------------
// Card type icons
// ---------------------------------------------------------------------------

/**
 * Single-character badges for each card type.
 * Rendered as small type indicators in card corners.
 * Simple text characters — not SVG icons — for performance and simplicity.
 */
export const CARD_TYPE_ICONS: Record<CardType, string> = {
  note: 'N',
  task: 'T',
  event: 'E',
  resource: 'R',
  person: 'P',
};

// ---------------------------------------------------------------------------
// SVG card renderer
// ---------------------------------------------------------------------------

/**
 * Render a card into an existing SVG `<g>` element using D3.
 *
 * Creates:
 *   - `rect.card-bg`: background rectangle using --bg-card color
 *   - `text.card-name`: primary name text (truncated with textLength)
 *   - `text.card-subtitle`: secondary line (status ?? folder ?? empty)
 *   - `text.card-type-badge`: type character badge, right-aligned
 *
 * The `g` element is assumed to already be positioned (translate transform).
 * Caller is responsible for setting up the D3 data join with key `d => d.id`.
 *
 * @param g - D3 selection of the SVG g.card group to render into
 * @param d - CardDatum to render
 */
export function renderSvgCard(
  g: d3.Selection<SVGGElement, CardDatum, SVGElement | null, unknown>,
  d: CardDatum
): void {
  const { width, height, padding } = CARD_DIMENSIONS;
  const nameMaxWidth = width - padding * 3 - 20; // reserve space for badge

  // Background rectangle
  g.selectAll<SVGRectElement, CardDatum>('rect.card-bg')
    .data([d])
    .join('rect')
    .attr('class', 'card-bg')
    .attr('width', width)
    .attr('height', height)
    .attr('rx', 4)
    .attr('ry', 4)
    .attr('fill', 'var(--bg-card)');

  // Card name (primary text, truncated)
  g.selectAll<SVGTextElement, CardDatum>('text.card-name')
    .data([d])
    .join('text')
    .attr('class', 'card-name')
    .attr('x', padding)
    .attr('y', padding + 12) // baseline: padding + line-height
    .attr('fill', 'var(--text-primary)')
    .attr('font-size', '13px')
    .attr('font-weight', '500')
    .attr('textLength', nameMaxWidth)
    .attr('lengthAdjust', 'spacing')
    .text(truncateName(d.name, 40));

  // Subtitle: status takes priority over folder
  const subtitle = d.status ?? d.folder ?? '';
  g.selectAll<SVGTextElement, CardDatum>('text.card-subtitle')
    .data([d])
    .join('text')
    .attr('class', 'card-subtitle')
    .attr('x', padding)
    .attr('y', padding + 28) // second line
    .attr('fill', 'var(--text-secondary)')
    .attr('font-size', '11px')
    .text(subtitle);

  // Type badge (right-aligned)
  g.selectAll<SVGTextElement, CardDatum>('text.card-type-badge')
    .data([d])
    .join('text')
    .attr('class', 'card-type-badge')
    .attr('x', width - padding)
    .attr('y', padding + 12)
    .attr('fill', 'var(--text-muted)')
    .attr('font-size', '10px')
    .attr('text-anchor', 'end')
    .text(CARD_TYPE_ICONS[d.card_type] ?? 'N');
}

// ---------------------------------------------------------------------------
// HTML card renderer
// ---------------------------------------------------------------------------

/**
 * Render a card as an HTML div element.
 *
 * Creates:
 *   - `div.card`: root container with CSS card styles
 *     - `span.card-name`: primary name text (CSS text-overflow: ellipsis)
 *     - `span.card-subtitle`: secondary line (status ?? folder ?? empty)
 *     - `span.card-type-badge`: type character badge
 *
 * Returns the created div. Caller is responsible for appending to container.
 *
 * @param d - CardDatum to render
 * @returns The created HTMLDivElement
 */
export function renderHtmlCard(d: CardDatum): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset['id'] = d.id;

  // Card name
  const nameEl = document.createElement('span');
  nameEl.className = 'card-name';
  nameEl.textContent = d.name;
  nameEl.title = d.name; // full name on hover

  // Subtitle: status takes priority over folder
  const subtitle = d.status ?? d.folder ?? '';
  const subtitleEl = document.createElement('span');
  subtitleEl.className = 'card-subtitle';
  subtitleEl.textContent = subtitle;

  // Type badge
  const badgeEl = document.createElement('span');
  badgeEl.className = 'card-type-badge';
  badgeEl.textContent = CARD_TYPE_ICONS[d.card_type] ?? 'N';

  card.appendChild(nameEl);
  card.appendChild(subtitleEl);
  card.appendChild(badgeEl);

  return card;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Truncate a card name to a maximum character count with ellipsis.
 * Used for SVG text nodes which don't support CSS text-overflow.
 */
function truncateName(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  return name.slice(0, maxChars - 1) + '\u2026'; // Unicode ellipsis
}
