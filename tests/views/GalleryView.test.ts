// @vitest-environment jsdom
// Isometry v5 — GalleryView Tests
// Tests for GalleryView: D3 data join (enter/update/exit), tile rendering,
// responsive columns, image fallback, icon display, lifecycle.
//
// Requirements: VIEW-06, D-003

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GalleryView } from '../../src/views/GalleryView';
import type { CardDatum } from '../../src/views/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<CardDatum> = {}): CardDatum {
	return {
		id: 'c1',
		name: 'Test Card',
		folder: null,
		status: null,
		card_type: 'note',
		created_at: '2026-01-01T00:00:00Z',
		modified_at: '2026-01-01T00:00:00Z',
		priority: 0,
		sort_order: 0,
		due_at: null,
		body_text: null,
		source: null,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// GalleryView tests
// ---------------------------------------------------------------------------

describe('GalleryView', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	it('mounts gallery grid into container', () => {
		const view = new GalleryView();
		view.mount(container);

		const grid = container.querySelector('.gallery-grid');
		expect(grid).not.toBeNull();
		expect(grid?.tagName).toBe('DIV');
	});

	it('renders resource card with img tag', () => {
		const view = new GalleryView();
		view.mount(container);

		const card = makeCard({
			id: 'res1',
			card_type: 'resource',
			body_text: 'https://example.com/img.png',
		});
		view.render([card]);

		const img = container.querySelector('img.tile-image') as HTMLImageElement | null;
		expect(img).not.toBeNull();
		expect(img?.src).toBe('https://example.com/img.png');
	});

	it('renders non-resource card with icon fallback', () => {
		const view = new GalleryView();
		view.mount(container);

		const card = makeCard({ card_type: 'note' });
		view.render([card]);

		const icon = container.querySelector('.tile-icon');
		expect(icon).not.toBeNull();
		expect(icon?.textContent).toBe('N');
	});

	it('renders card name below tile content', () => {
		const view = new GalleryView();
		view.mount(container);

		const card = makeCard({ name: 'My Tile Card' });
		view.render([card]);

		const nameEl = container.querySelector('span.tile-name');
		expect(nameEl).not.toBeNull();
		expect(nameEl?.textContent).toBe('My Tile Card');
	});

	it('falls back to icon when image fails to load', () => {
		const view = new GalleryView();
		view.mount(container);

		const card = makeCard({
			id: 'res2',
			card_type: 'resource',
			body_text: 'https://example.com/broken.png',
		});
		view.render([card]);

		const img = container.querySelector('img.tile-image') as HTMLImageElement | null;
		expect(img).not.toBeNull();

		// Simulate image load error (jsdom does not fire error automatically)
		img!.dispatchEvent(new Event('error'));

		// img should be replaced by a div.tile-icon
		const icon = container.querySelector('.tile-icon');
		expect(icon).not.toBeNull();
		// The img should no longer be in the DOM
		expect(container.querySelector('img.tile-image')).toBeNull();
	});

	it('adapts column count to container width', () => {
		const view = new GalleryView();
		view.mount(container);

		// Set container width to 1200px -> 1200/240 = 5 columns
		Object.defineProperty(container, 'clientWidth', { configurable: true, value: 1200 });

		view.render([makeCard()]);

		const grid = container.querySelector('.gallery-grid') as HTMLElement | null;
		expect(grid?.style.gridTemplateColumns).toBe('repeat(5, 240px)');
	});

	it('uses minimum 1 column for narrow containers', () => {
		const view = new GalleryView();
		view.mount(container);

		// Set container width to 100px -> 100/240 = 0 -> clamp to 1
		Object.defineProperty(container, 'clientWidth', { configurable: true, value: 100 });

		view.render([makeCard()]);

		const grid = container.querySelector('.gallery-grid') as HTMLElement | null;
		expect(grid?.style.gridTemplateColumns).toBe('repeat(1, 240px)');
	});

	it('each tile has data-id attribute matching card id', () => {
		const view = new GalleryView();
		view.mount(container);

		const cards = [makeCard({ id: 'card-x', name: 'Card X' }), makeCard({ id: 'card-y', name: 'Card Y' })];
		view.render(cards);

		const tiles = container.querySelectorAll('.gallery-tile');
		expect(tiles.length).toBe(2);

		const ids = Array.from(tiles).map((t) => (t as HTMLElement).dataset['id']);
		expect(ids).toContain('card-x');
		expect(ids).toContain('card-y');
	});

	it('renders empty state gracefully with no tiles', () => {
		const view = new GalleryView();
		view.mount(container);

		view.render([]);

		const tiles = container.querySelectorAll('.gallery-tile');
		expect(tiles.length).toBe(0);
	});

	it('destroy removes DOM and clears references', () => {
		const view = new GalleryView();
		view.mount(container);
		view.render([makeCard()]);

		expect(container.querySelector('.gallery-grid')).not.toBeNull();

		view.destroy();

		expect(container.querySelector('.gallery-grid')).toBeNull();
		expect(container.children.length).toBe(0);
	});

	// ---------------------------------------------------------------------------
	// D3 data join tests (D-003 compliance)
	// ---------------------------------------------------------------------------

	describe('D3 data join (enter/update/exit)', () => {
		it('re-render with same cards does NOT destroy/recreate tiles (update path)', () => {
			const view = new GalleryView();
			view.mount(container);

			const cards = [makeCard({ id: 'a', name: 'Alpha' }), makeCard({ id: 'b', name: 'Beta' })];
			view.render(cards);

			// Capture DOM references to existing tiles
			const tilesBefore = container.querySelectorAll('.gallery-tile');
			expect(tilesBefore.length).toBe(2);
			const tileA = tilesBefore[0];
			const tileB = tilesBefore[1];

			// Re-render with same IDs, updated names
			const updated = [makeCard({ id: 'a', name: 'Alpha Updated' }), makeCard({ id: 'b', name: 'Beta Updated' })];
			view.render(updated);

			const tilesAfter = container.querySelectorAll('.gallery-tile');
			expect(tilesAfter.length).toBe(2);

			// Same DOM nodes should be reused (D3 update path, NOT wipe-and-rebuild)
			expect(tilesAfter[0]).toBe(tileA);
			expect(tilesAfter[1]).toBe(tileB);

			// Content should be updated
			expect(tilesAfter[0]!.querySelector('.tile-name')?.textContent).toBe('Alpha Updated');
			expect(tilesAfter[1]!.querySelector('.tile-name')?.textContent).toBe('Beta Updated');
		});

		it('render with fewer cards removes exiting tiles (exit path)', () => {
			const view = new GalleryView();
			view.mount(container);

			const cards = [
				makeCard({ id: 'a', name: 'Alpha' }),
				makeCard({ id: 'b', name: 'Beta' }),
				makeCard({ id: 'c', name: 'Gamma' }),
			];
			view.render(cards);
			expect(container.querySelectorAll('.gallery-tile').length).toBe(3);

			// Remove card 'b'
			const fewer = [makeCard({ id: 'a', name: 'Alpha' }), makeCard({ id: 'c', name: 'Gamma' })];
			view.render(fewer);

			const tilesAfter = container.querySelectorAll('.gallery-tile');
			expect(tilesAfter.length).toBe(2);

			const ids = Array.from(tilesAfter).map((t) => (t as HTMLElement).dataset['id']);
			expect(ids).toContain('a');
			expect(ids).toContain('c');
			expect(ids).not.toContain('b');
		});

		it('render with additional cards appends new tiles (enter path)', () => {
			const view = new GalleryView();
			view.mount(container);

			const initial = [makeCard({ id: 'a', name: 'Alpha' })];
			view.render(initial);

			const tilesBefore = container.querySelectorAll('.gallery-tile');
			expect(tilesBefore.length).toBe(1);
			const originalTile = tilesBefore[0];

			// Add a new card
			const expanded = [makeCard({ id: 'a', name: 'Alpha' }), makeCard({ id: 'b', name: 'Beta' })];
			view.render(expanded);

			const tilesAfter = container.querySelectorAll('.gallery-tile');
			expect(tilesAfter.length).toBe(2);

			// Original tile should be reused (update path)
			expect(tilesAfter[0]).toBe(originalTile);

			// New tile should have the new card's data
			expect((tilesAfter[1] as HTMLElement).dataset['id']).toBe('b');
			expect(tilesAfter[1]!.querySelector('.tile-name')?.textContent).toBe('Beta');
		});

		it('each tile has correct structure (tile-image or tile-icon + tile-name)', () => {
			const view = new GalleryView();
			view.mount(container);

			const cards = [
				makeCard({ id: 'note1', card_type: 'note', name: 'Note Card' }),
				makeCard({ id: 'res1', card_type: 'resource', body_text: 'https://img.test/pic.jpg', name: 'Resource Card' }),
			];
			view.render(cards);

			const tiles = container.querySelectorAll('.gallery-tile');
			expect(tiles.length).toBe(2);

			// Note card: should have tile-icon + tile-name
			const noteTile = tiles[0]!;
			expect(noteTile.querySelector('.tile-icon')).not.toBeNull();
			expect(noteTile.querySelector('.tile-name')?.textContent).toBe('Note Card');

			// Resource card: should have tile-image + tile-name
			const resTile = tiles[1]!;
			expect(resTile.querySelector('.tile-image')).not.toBeNull();
			expect(resTile.querySelector('.tile-name')?.textContent).toBe('Resource Card');
		});

		it('audit data attributes are applied correctly', () => {
			const view = new GalleryView();
			view.mount(container);

			const cards = [makeCard({ id: 'src1', source: 'apple_notes', name: 'Sourced' })];
			view.render(cards);

			const tile = container.querySelector('.gallery-tile') as HTMLElement;
			expect(tile).not.toBeNull();
			expect(tile.dataset['source']).toBe('apple_notes');
			expect(tile.dataset['id']).toBe('src1');
		});
	});
});
