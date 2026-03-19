// Isometry v5 — Phase 6 GalleryView
// CSS Grid gallery view with D3 data join, image tiles, and icon fallbacks.
//
// Design:
//   - Renders cards as uniform tiles in a responsive CSS Grid
//   - D3 data join with key function d => d.id (D-003 compliance)
//   - Resource cards: img.tile-image with body_text as src; onerror replaces with icon
//   - Non-resource cards: large CARD_TYPE_ICONS character centered, name below
//   - Column count adapts to container.clientWidth / GALLERY_TILE_WIDTH (min 1)
//   - Tile dimensions: 240x160px (larger than GridView's 180x120)
//
// Requirements: VIEW-06, D-003

import * as d3 from 'd3';
import { auditState } from '../audit/AuditState';
import { CARD_TYPE_ICONS, openDetailOverlay, renderDimensionCard } from './CardRenderer';
import type { CardDatum, IView } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GALLERY_TILE_WIDTH = 240;
const GALLERY_TILE_HEIGHT = 160;

// ---------------------------------------------------------------------------
// GalleryView
// ---------------------------------------------------------------------------

/**
 * CSS Grid gallery view for visual browsing of card data.
 *
 * Lifecycle:
 *   1. mount(container) — creates div.gallery-grid, appends to container
 *   2. render(cards) — D3 data join with enter/update/exit for gallery tiles
 *   3. destroy() — removes grid, clears references
 *
 * Tile structure:
 *   div.gallery-tile[data-id]
 *     img.tile-image (resource cards with body_text) OR div.tile-icon (others)
 *     span.tile-name
 */
export class GalleryView implements IView {
	private mountContainer: HTMLElement | null = null;
	private grid: HTMLDivElement | null = null;
	private currentCards: CardDatum[] = [];

	// Keyboard navigation state (A11Y-08 composite widget)
	private _focusedIndex = -1;
	private _lastCols = 1;
	private _lastTileCount = 0;
	private _onKeydown: ((e: KeyboardEvent) => void) | null = null;
	private _onDblClick: ((e: MouseEvent) => void) | null = null;

	// ---------------------------------------------------------------------------
	// IView lifecycle
	// ---------------------------------------------------------------------------

	mount(container: HTMLElement): void {
		this.mountContainer = container;

		const grid = document.createElement('div');
		grid.className = 'gallery-grid';
		grid.style.display = 'grid';
		grid.style.gap = '16px';
		grid.setAttribute('tabindex', '0');

		this.grid = grid;
		container.appendChild(grid);

		// --- Keyboard navigation (A11Y-08 composite widget) ---
		this._onKeydown = (e: KeyboardEvent) => {
			if (this._lastTileCount === 0) return;
			const cols = this._lastCols;
			const count = this._lastTileCount;

			switch (e.key) {
				case 'ArrowRight':
					e.preventDefault();
					this._focusedIndex = Math.min(this._focusedIndex + 1, count - 1);
					this._updateGalleryFocus();
					break;
				case 'ArrowLeft':
					e.preventDefault();
					this._focusedIndex = Math.max(this._focusedIndex - 1, 0);
					this._updateGalleryFocus();
					break;
				case 'ArrowDown':
					e.preventDefault();
					this._focusedIndex = Math.min(this._focusedIndex + cols, count - 1);
					this._updateGalleryFocus();
					break;
				case 'ArrowUp':
					e.preventDefault();
					this._focusedIndex = Math.max(this._focusedIndex - cols, 0);
					this._updateGalleryFocus();
					break;
				case 'Home':
					e.preventDefault();
					this._focusedIndex = 0;
					this._updateGalleryFocus();
					break;
				case 'End':
					e.preventDefault();
					this._focusedIndex = count - 1;
					this._updateGalleryFocus();
					break;
				case 'Escape':
					e.preventDefault();
					document.querySelector<HTMLElement>('[role="navigation"]')?.focus();
					break;
				case 'Enter':
				case ' ': {
					e.preventDefault();
					// Open 10x detail overlay for focused tile
					const focusedTile = this.grid?.querySelector<HTMLElement>('.gallery-tile--focused, .card--focused');
					if (focusedTile) {
						const cardId = focusedTile.dataset['id'];
						const card = this.currentCards.find((c) => c.id === cardId);
						if (card && this.mountContainer) {
							openDetailOverlay(card, this.mountContainer, () => {
								focusedTile.focus();
							});
						}
					}
					break;
				}
			}
		};
		grid.addEventListener('keydown', this._onKeydown);

		// --- 10x double-click trigger ---
		this._onDblClick = (e: MouseEvent) => {
			const tileEl = (e.target as HTMLElement).closest<HTMLElement>('.gallery-tile, .card');
			if (!tileEl) return;
			const cardId = tileEl.dataset['id'];
			const card = this.currentCards.find((c) => c.id === cardId);
			if (card && this.mountContainer) {
				openDetailOverlay(card, this.mountContainer, () => {
					tileEl.focus();
				});
			}
		};
		grid.addEventListener('dblclick', this._onDblClick);
	}

	render(cards: CardDatum[]): void {
		const grid = this.grid;
		if (!grid || !this.mountContainer) return;

		this.currentCards = [...cards];

		// Compute responsive column count
		const clientWidth = this.mountContainer.clientWidth;
		const cols = Math.max(1, Math.floor(clientWidth / GALLERY_TILE_WIDTH));
		grid.style.gridTemplateColumns = `repeat(${cols}, ${GALLERY_TILE_WIDTH}px)`;

		// Track for keyboard navigation (A11Y-08)
		this._lastCols = cols;
		this._lastTileCount = cards.length;

		// D3 data join with mandatory key function d => d.id (D-003)
		d3.select(grid)
			.selectAll<HTMLDivElement, CardDatum>('div.gallery-tile')
			.data(cards, (d) => d.id)
			.join(
				(enter) => {
					const tile = enter.append((d) => {
						// Use renderDimensionCard as the base, add gallery-tile class for sizing
						const card = renderDimensionCard(d);
						card.classList.add('gallery-tile');
						card.style.width = `${GALLERY_TILE_WIDTH}px`;
						card.style.height = `${GALLERY_TILE_HEIGHT}px`;

						// Resource cards with body_text: insert image before .card__preview
						if (d.card_type === 'resource' && d.body_text) {
							const img = document.createElement('img');
							img.className = 'tile-image';
							img.src = d.body_text;
							img.alt = d.name;
							img.style.width = '100%';
							img.style.flex = '1';
							img.style.objectFit = 'cover';
							img.style.minHeight = '0';

							img.addEventListener('error', () => {
								img.replaceWith(makeFallbackIcon(d));
							});

							const previewEl = card.querySelector('.card__preview');
							if (previewEl) {
								card.insertBefore(img, previewEl);
							} else {
								card.appendChild(img);
							}
						}

						return card;
					});

					return tile;
				},
				(update) => {
					// Update card content for changed cards
					update.each(function (d) {
						const el = this as HTMLDivElement;

						// Update audit data attributes
						const changeStatus = auditState.getChangeStatus(d.id);
						if (changeStatus) {
							el.dataset['audit'] = changeStatus;
						} else {
							delete el.dataset['audit'];
						}
						if (d.source) {
							el.dataset['source'] = d.source;
						} else {
							delete el.dataset['source'];
						}

						// Update title
						const titleEl = el.querySelector('.card__title');
						if (titleEl) titleEl.textContent = d.name || 'Untitled';
					});

					return update;
				},
				(exit) => {
					exit.remove();
					return exit;
				},
			);
	}

	destroy(): void {
		// Remove keyboard listener (A11Y-08)
		if (this.grid && this._onKeydown) {
			this.grid.removeEventListener('keydown', this._onKeydown);
			this._onKeydown = null;
		}
		if (this.grid && this._onDblClick) {
			this.grid.removeEventListener('dblclick', this._onDblClick);
			this._onDblClick = null;
		}
		this._focusedIndex = -1;

		if (this.grid && this.mountContainer) {
			this.mountContainer.removeChild(this.grid);
		}
		this.grid = null;
		this.mountContainer = null;
		this.currentCards = [];
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/** Update visual focus indicator on the currently focused gallery tile (A11Y-08). */
	private _updateGalleryFocus(): void {
		if (!this.grid) return;
		d3.select(this.grid)
			.selectAll<HTMLDivElement, CardDatum>('.gallery-tile')
			.classed('gallery-tile--focused', (_, i) => i === this._focusedIndex);
	}
}

// ---------------------------------------------------------------------------
// Module-level helper
// ---------------------------------------------------------------------------

function makeFallbackIcon(d: CardDatum): HTMLDivElement {
	const icon = document.createElement('div');
	icon.className = 'tile-icon';
	icon.textContent = CARD_TYPE_ICONS[d.card_type] ?? 'N';
	icon.style.fontSize = '48px';
	icon.style.display = 'flex';
	icon.style.alignItems = 'center';
	icon.style.justifyContent = 'center';
	icon.style.flex = '1';
	icon.style.width = '100%';
	icon.style.minHeight = '0';
	return icon;
}
