// Isometry v5 — Phase 6 GalleryView
// HTML/CSS Grid gallery view with image tiles and icon fallbacks.
//
// Design:
//   - Renders cards as uniform tiles in a responsive CSS Grid
//   - Resource cards: img.tile-image with body_text as src; onerror replaces with icon
//   - Non-resource cards: large CARD_TYPE_ICONS character centered, name below
//   - Column count adapts to container.clientWidth / GALLERY_TILE_WIDTH (min 1)
//   - Tile dimensions: 240x160px (larger than GridView's 180x120)
//   - No D3 dependency — pure HTML/CSS construction (no SVG, no drag-drop)
//
// Requirements: VIEW-06

import { auditState } from '../audit/AuditState';
import { CARD_TYPE_ICONS } from './CardRenderer';
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
 *   2. render(cards) — computes responsive columns, creates gallery tiles
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

	// ---------------------------------------------------------------------------
	// IView lifecycle
	// ---------------------------------------------------------------------------

	mount(container: HTMLElement): void {
		this.mountContainer = container;

		const grid = document.createElement('div');
		grid.className = 'gallery-grid';
		grid.style.display = 'grid';
		grid.style.gap = '16px';

		this.grid = grid;
		container.appendChild(grid);
	}

	render(cards: CardDatum[]): void {
		const grid = this.grid;
		if (!grid || !this.mountContainer) return;

		// Compute responsive column count
		const clientWidth = this.mountContainer.clientWidth;
		const cols = Math.max(1, Math.floor(clientWidth / GALLERY_TILE_WIDTH));
		grid.style.gridTemplateColumns = `repeat(${cols}, ${GALLERY_TILE_WIDTH}px)`;

		// Clear existing tiles
		while (grid.firstChild) {
			grid.removeChild(grid.firstChild);
		}

		// Render each card as a tile
		for (const card of cards) {
			grid.appendChild(this.renderGalleryTile(card));
		}
	}

	destroy(): void {
		if (this.grid && this.mountContainer) {
			this.mountContainer.removeChild(this.grid);
		}
		this.grid = null;
		this.mountContainer = null;
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private renderGalleryTile(d: CardDatum): HTMLDivElement {
		const tile = document.createElement('div');
		tile.className = 'gallery-tile';
		tile.dataset['id'] = d.id;
		tile.style.width = `${GALLERY_TILE_WIDTH}px`;
		tile.style.height = `${GALLERY_TILE_HEIGHT}px`;
		tile.style.overflow = 'hidden';
		tile.style.display = 'flex';
		tile.style.flexDirection = 'column';
		tile.style.alignItems = 'center';

		// Phase 37 — Audit data attributes for CSS styling
		const changeStatus = auditState.getChangeStatus(d.id);
		if (changeStatus) {
			tile.dataset['audit'] = changeStatus;
		} else {
			delete tile.dataset['audit'];
		}
		if (d.source) {
			tile.dataset['source'] = d.source;
		} else {
			delete tile.dataset['source'];
		}

		// Content area: image for resource cards with body_text, icon otherwise
		if (d.card_type === 'resource' && d.body_text) {
			const img = document.createElement('img');
			img.className = 'tile-image';
			img.src = d.body_text;
			img.alt = d.name;
			img.style.width = '100%';
			img.style.flex = '1';
			img.style.objectFit = 'cover';
			img.style.minHeight = '0';

			// On load error, replace img with fallback icon
			img.addEventListener('error', () => {
				img.replaceWith(this.makeFallbackIcon(d));
			});

			tile.appendChild(img);
		} else {
			tile.appendChild(this.makeFallbackIcon(d));
		}

		// Card name below content area
		const nameEl = document.createElement('span');
		nameEl.className = 'tile-name';
		nameEl.textContent = d.name;
		nameEl.style.fontSize = '12px';
		nameEl.style.textAlign = 'center';
		nameEl.style.overflow = 'hidden';
		nameEl.style.textOverflow = 'ellipsis';
		nameEl.style.whiteSpace = 'nowrap';
		nameEl.style.width = '100%';
		nameEl.style.padding = '4px 8px';
		nameEl.style.boxSizing = 'border-box';
		tile.appendChild(nameEl);

		return tile;
	}

	private makeFallbackIcon(d: CardDatum): HTMLDivElement {
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
}
