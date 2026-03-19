// Isometry v5 — Phase 94 GridView (HTML-based)
// HTML div-based responsive grid view with dimension-aware card rendering.
//
// Design:
//   - Implements IView: mount() once, render() on each data update, destroy() before replacement
//   - D3 key function `d => d.id` is MANDATORY on every .data() call (VIEW-09)
//   - Column count = Math.max(1, Math.floor(containerWidth / CELL_WIDTH))
//   - Cards render as HTML div.card elements via renderDimensionCard()
//   - [data-dimension] CSS on parent container controls visual density (1x/2x/5x)
//   - Double-click or Enter on focused card opens 10x detail overlay
//   - Phase 94 DIMS-01: migrated from SVG to HTML
//
// Requirements: VIEW-02, DIMS-01

import * as d3 from 'd3';
import { openDetailOverlay, renderDimensionCard } from './CardRenderer';
import type { CardDatum, IView } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_WIDTH = 180;
const CELL_GAP = 12;

// ---------------------------------------------------------------------------
// GridView implementation
// ---------------------------------------------------------------------------

/**
 * HTML-based responsive grid view with dimension-aware rendering.
 *
 * Renders cards as HTML div.card tiles using renderDimensionCard().
 * Dimension level (1x/2x/5x) is controlled by [data-dimension] CSS attribute
 * on the parent view container — no JS toggling needed on dimension switch.
 *
 * @implements IView
 */
export class GridView implements IView {
	private container: HTMLElement | null = null;
	private _gridEl: HTMLDivElement | null = null;
	private currentCards: CardDatum[] = [];

	// Keyboard navigation state (A11Y-08 composite widget)
	private _focusedIndex = -1;
	private _lastCols = 1;
	private _lastCardCount = 0;
	private _onKeydown: ((e: KeyboardEvent) => void) | null = null;
	private _onDblClick: ((e: MouseEvent) => void) | null = null;

	// ---------------------------------------------------------------------------
	// IView: mount
	// ---------------------------------------------------------------------------

	/**
	 * Mount the view into the given container element.
	 * Creates the HTML grid container.
	 * Called once by ViewManager before the first render.
	 */
	mount(container: HTMLElement): void {
		this.container = container;

		const gridEl = document.createElement('div');
		gridEl.className = 'grid-view';
		gridEl.style.display = 'grid';
		gridEl.style.gap = `${CELL_GAP}px`;
		gridEl.setAttribute('tabindex', '0');
		gridEl.setAttribute('aria-label', 'Grid view, 0 cards');
		this._gridEl = gridEl;
		container.appendChild(gridEl);

		// --- Keyboard navigation (A11Y-08 composite widget) ---
		this._onKeydown = (e: KeyboardEvent) => {
			if (this._lastCardCount === 0) return;
			const cols = this._lastCols;
			const count = this._lastCardCount;

			switch (e.key) {
				case 'ArrowRight':
					e.preventDefault();
					this._focusedIndex = Math.min(this._focusedIndex + 1, count - 1);
					this._updateFocusVisual();
					break;
				case 'ArrowLeft':
					e.preventDefault();
					this._focusedIndex = Math.max(this._focusedIndex - 1, 0);
					this._updateFocusVisual();
					break;
				case 'ArrowDown':
					e.preventDefault();
					this._focusedIndex = Math.min(this._focusedIndex + cols, count - 1);
					this._updateFocusVisual();
					break;
				case 'ArrowUp':
					e.preventDefault();
					this._focusedIndex = Math.max(this._focusedIndex - cols, 0);
					this._updateFocusVisual();
					break;
				case 'Home':
					e.preventDefault();
					this._focusedIndex = 0;
					this._updateFocusVisual();
					break;
				case 'End':
					e.preventDefault();
					this._focusedIndex = count - 1;
					this._updateFocusVisual();
					break;
				case 'Escape':
					e.preventDefault();
					document.querySelector<HTMLElement>('[role="navigation"]')?.focus();
					break;
				case 'Enter':
				case ' ': {
					e.preventDefault();
					// Open 10x detail overlay for focused card
					const focusedCardEl = this._gridEl?.querySelector<HTMLElement>('.card--focused, .card:focus');
					if (focusedCardEl) {
						const cardId = focusedCardEl.dataset['id'];
						const card = this.currentCards.find((c) => c.id === cardId);
						if (card && this.container) {
							openDetailOverlay(card, this.container, () => {
								focusedCardEl.focus();
							});
						}
					}
					break;
				}
			}
		};
		gridEl.addEventListener('keydown', this._onKeydown);

		// --- 10x double-click trigger ---
		this._onDblClick = (e: MouseEvent) => {
			const cardEl = (e.target as HTMLElement).closest<HTMLElement>('.card');
			if (!cardEl) return;
			const cardId = cardEl.dataset['id'];
			const card = this.currentCards.find((c) => c.id === cardId);
			if (card && this.container) {
				openDetailOverlay(card, this.container, () => {
					cardEl.focus();
				});
			}
		};
		gridEl.addEventListener('dblclick', this._onDblClick);
	}

	// ---------------------------------------------------------------------------
	// IView: render
	// ---------------------------------------------------------------------------

	/**
	 * Render cards in a responsive grid using a D3 data join with key function `d => d.id`.
	 *
	 * Column count is computed from container.clientWidth.
	 * Cards are rendered as HTML div.card tiles via renderDimensionCard().
	 *
	 * @param cards - Array of CardDatum to render.
	 */
	render(cards: CardDatum[]): void {
		if (!this._gridEl || !this.container) return;

		this.currentCards = [...cards];

		// Update ARIA label for screen readers (A11Y-03)
		this._gridEl.setAttribute('aria-label', `Grid view, ${cards.length} cards`);

		// Compute grid dimensions from container width
		const containerWidth = this.container.clientWidth;
		const cols = Math.max(1, Math.floor((containerWidth + CELL_GAP) / (CELL_WIDTH + CELL_GAP)));

		// Track for keyboard navigation (A11Y-08)
		this._lastCols = cols;
		this._lastCardCount = cards.length;

		// Set CSS grid template columns
		this._gridEl.style.gridTemplateColumns = `repeat(${cols}, ${CELL_WIDTH}px)`;

		// D3 data join with mandatory key function d => d.id (VIEW-09)
		d3.select(this._gridEl)
			.selectAll<HTMLDivElement, CardDatum>('div.card')
			.data(cards, (d) => d.id)
			.join(
				(enter) => enter.append((d) => renderDimensionCard(d)),
				(update) => {
					update.each(function (d) {
						const el = this as HTMLDivElement;
						const titleEl = el.querySelector('.card__title');
						if (titleEl) titleEl.textContent = d.name || 'Untitled';
						const previewEl = el.querySelector('.card__preview');
						if (previewEl) previewEl.textContent = d.body_text ?? d.status ?? d.folder ?? '';
					});
					return update;
				},
				(exit) => {
					exit.remove();
					return exit;
				},
			);
	}

	// ---------------------------------------------------------------------------
	// IView: destroy
	// ---------------------------------------------------------------------------

	/**
	 * Tear down the view — remove event listeners, remove DOM elements.
	 * Called by ViewManager before mounting the next view.
	 */
	destroy(): void {
		// Remove keyboard listener (A11Y-08)
		if (this._gridEl && this._onKeydown) {
			this._gridEl.removeEventListener('keydown', this._onKeydown);
			this._onKeydown = null;
		}
		if (this._gridEl && this._onDblClick) {
			this._gridEl.removeEventListener('dblclick', this._onDblClick);
			this._onDblClick = null;
		}
		this._focusedIndex = -1;

		if (this._gridEl) {
			this._gridEl.remove();
			this._gridEl = null;
		}
		this.container = null;
		this.currentCards = [];
	}

	// ---------------------------------------------------------------------------
	// Private: focus visual (A11Y-08)
	// ---------------------------------------------------------------------------

	/** Update visual focus indicator on the currently focused card. */
	private _updateFocusVisual(): void {
		if (!this._gridEl) return;
		d3.select(this._gridEl).selectAll<HTMLDivElement, CardDatum>('div.card').classed('card--focused', false);
		if (this._focusedIndex >= 0) {
			d3.select(this._gridEl)
				.selectAll<HTMLDivElement, CardDatum>('div.card')
				.filter((_, i) => i === this._focusedIndex)
				.classed('card--focused', true)
				.each(function () {
					(this as HTMLElement).focus();
				});
		}
	}
}
