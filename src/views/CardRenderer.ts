// Isometry v5 — Phase 5 CardRenderer
// Shared card rendering functions for SVG and HTML views.
//
// Design:
//   - renderSvgCard: for D3 SVG-based views (ListView, GridView)
//   - renderHtmlCard: for HTML-based views (KanbanView)
//   - renderDimensionCard: unified dimension-aware HTML card for Phase 94
//   - Identical visual structure enables smooth morph transitions (VIEW-09)
//   - Name truncation: SVG uses truncateName(); HTML uses CSS text-overflow: ellipsis
//
// Requirements: REND-07, REND-08, DIMS-01

import '../styles/card-dimensions.css';

import type * as d3 from 'd3';
import { auditState } from '../audit/AuditState';
import { AUDIT_COLORS, getSourceColor } from '../audit/audit-colors';
import type { CardType } from '../database/queries/types';
import type { CardDatum } from './types';

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
 *   - `text.card-name`: primary name text (character-truncated with ellipsis)
 *   - `text.card-subtitle`: secondary line (status ?? folder ?? empty)
 *   - `text.card-type-badge`: type character badge, right-aligned
 *
 * The `g` element is assumed to already be positioned (translate transform).
 * Caller is responsible for setting up the D3 data join with key `d => d.id`.
 *
 * @param g - D3 selection of the SVG g.card group to render into
 * @param d - CardDatum to render
 */
export function renderSvgCard(g: d3.Selection<SVGGElement, CardDatum, SVGElement | null, unknown>, d: CardDatum): void {
	const { width, height, padding } = CARD_DIMENSIONS;

	// SVG title element for screen reader access (A11Y-07)
	// D3 data join prevents duplicate <title> elements on re-render.
	g.selectAll<SVGTitleElement, CardDatum>('title')
		.data([d])
		.join('title')
		.text(`${d.name}, ${d.card_type}, ${d.source ?? 'unknown source'}`);

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

	// Card name (primary text, truncated via truncateName — no SVG textLength/lengthAdjust
	// which would stretch short names to fill the full width with wide letter-spacing)
	g.selectAll<SVGTextElement, CardDatum>('text.card-name')
		.data([d])
		.join('text')
		.attr('class', 'card-name')
		.attr('x', padding)
		.attr('y', padding + 12) // baseline: padding + line-height
		.attr('fill', 'var(--text-primary)')
		.attr('font-size', '13px')
		.attr('font-weight', '500')
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

	// ---------------------------------------------------------------------------
	// Phase 37 — Audit overlay SVG elements
	// Audit stripe (left border) and source stripe (bottom border).
	// Both hidden by default via CSS; shown when .audit-mode class is on root.
	// ---------------------------------------------------------------------------

	// Change stripe: 3px wide left border
	const changeStatus = auditState.getChangeStatus(d.id);
	g.selectAll<SVGRectElement, string>('rect.audit-stripe')
		.data(changeStatus ? [changeStatus] : [], (s) => s)
		.join(
			(enter) =>
				enter
					.append('rect')
					.attr('class', 'audit-stripe')
					.attr('x', 0)
					.attr('y', 0)
					.attr('width', 3)
					.attr('height', height)
					.attr('rx', 2)
					.attr('fill', (s) => AUDIT_COLORS[s as keyof typeof AUDIT_COLORS] ?? 'transparent'),
			(update) => update.attr('fill', (s) => AUDIT_COLORS[s as keyof typeof AUDIT_COLORS] ?? 'transparent'),
			(exit) => exit.remove(),
		);

	// Source stripe: 2px tall bottom border
	const sourceColor = d.source ? getSourceColor(d.source) : null;
	g.selectAll<SVGRectElement, string>('rect.source-stripe')
		.data(sourceColor ? [sourceColor] : [], (c) => c)
		.join(
			(enter) =>
				enter
					.append('rect')
					.attr('class', 'source-stripe')
					.attr('x', 0)
					.attr('y', height - 2)
					.attr('width', width)
					.attr('height', 2)
					.attr('fill', (c) => c),
			(update) => update.attr('fill', (c) => c),
			(exit) => exit.remove(),
		);
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

	// Phase 37 — Audit data attributes for CSS styling
	const changeStatus = auditState.getChangeStatus(d.id);
	if (changeStatus) {
		card.dataset['audit'] = changeStatus;
	} else {
		delete card.dataset['audit'];
	}
	if (d.source) {
		card.dataset['source'] = d.source;
	} else {
		delete card.dataset['source'];
	}

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
// Dimension-aware HTML card renderer (Phase 94)
// ---------------------------------------------------------------------------

/**
 * Render a dimension-aware HTML card element.
 *
 * Creates a div.card with all sub-elements for all dimension levels:
 *   - .card__header: flex row containing .card__icon + .card__title (always visible)
 *   - .card__preview: content/summary text (hidden at 1x via CSS)
 *   - .card__tags: tag chip container (hidden at 1x/2x via CSS; caller populates)
 *   - .card__props-toggle + .card__props: collapsible properties (5x only, hidden by default)
 *
 * Visibility of sub-elements is controlled entirely by [data-dimension] CSS attribute
 * on the parent view container — no JS toggling needed on dimension switch.
 *
 * @param d - CardDatum to render
 * @returns The created HTMLDivElement
 */
export function renderDimensionCard(d: CardDatum): HTMLDivElement {
	const card = document.createElement('div');
	card.className = 'card';
	card.dataset['id'] = d.id;
	card.setAttribute('tabindex', '-1');

	// Phase 37 — Audit data attributes for CSS styling
	const changeStatus = auditState.getChangeStatus(d.id);
	if (changeStatus) {
		card.dataset['audit'] = changeStatus;
	} else {
		delete card.dataset['audit'];
	}
	if (d.source) {
		card.dataset['source'] = d.source;
	} else {
		delete card.dataset['source'];
	}

	// Header row: icon badge + title (always visible, used by all dimension levels)
	const headerEl = document.createElement('div');
	headerEl.className = 'card__header';

	const iconEl = document.createElement('span');
	iconEl.className = 'card__icon';
	iconEl.textContent = CARD_TYPE_ICONS[d.card_type] ?? 'N';
	headerEl.appendChild(iconEl);

	const titleEl = document.createElement('span');
	titleEl.className = 'card__title';
	titleEl.textContent = d.name || 'Untitled';
	titleEl.title = d.name;
	headerEl.appendChild(titleEl);

	card.appendChild(headerEl);

	// Content preview (hidden at 1x via CSS; 1-line clamp at 2x; 4-line at 5x)
	const previewEl = document.createElement('div');
	previewEl.className = 'card__preview';
	previewEl.textContent = d.body_text ?? d.status ?? d.folder ?? '';
	card.appendChild(previewEl);

	// Tags row (hidden at 1x/2x via CSS; shown at 5x; caller populates chips)
	const tagsEl = document.createElement('div');
	tagsEl.className = 'card__tags';
	card.appendChild(tagsEl);

	// Properties toggle button (5x only — hidden at 1x/2x via CSS)
	const propsToggle = document.createElement('button');
	propsToggle.className = 'card__props-toggle';
	propsToggle.textContent = 'Properties \u25BE'; // ▾
	propsToggle.setAttribute('aria-expanded', 'false');
	card.appendChild(propsToggle);

	// Properties section (collapsed by default; toggled via button)
	const propsEl = document.createElement('div');
	propsEl.className = 'card__props';
	card.appendChild(propsEl);

	// Wire properties toggle
	propsToggle.addEventListener('click', (e) => {
		e.stopPropagation();
		const isOpen = propsEl.classList.toggle('card__props--open');
		propsToggle.setAttribute('aria-expanded', String(isOpen));
		propsToggle.textContent = isOpen ? 'Properties \u25B4' : 'Properties \u25BE'; // ▴ / ▾
	});

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
