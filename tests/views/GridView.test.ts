// @vitest-environment jsdom
// Isometry v5 — GridView Tests
// Tests for HTML-based responsive grid view.
//
// Requirements: VIEW-02, DIMS-01

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GridView } from '../../src/views/GridView';
import type { CardDatum } from '../../src/views/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeCards(count: number = 6): CardDatum[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `card-${i + 1}`,
		name: `Card ${i + 1}`,
		folder: i % 2 === 0 ? 'folder-a' : null,
		status: i % 3 === 0 ? 'active' : null,
		card_type: (['note', 'task', 'event', 'resource', 'person'] as const)[i % 5]!,
		created_at: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
		modified_at: `2026-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
		priority: i + 1,
		sort_order: i + 1,
		due_at: null,
		body_text: null,
		source: null,
	}));
}

// Helper to set container clientWidth via Object.defineProperty
function setContainerWidth(el: HTMLElement, width: number): void {
	Object.defineProperty(el, 'clientWidth', {
		configurable: true,
		value: width,
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GridView', () => {
	let container: HTMLElement;
	let view: GridView;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		view = new GridView();
	});

	afterEach(() => {
		view.destroy();
		document.body.removeChild(container);
	});

	describe('mount', () => {
		it('creates grid-view element in container', () => {
			view.mount(container);
			const gridEl = container.querySelector('div.grid-view');
			expect(gridEl).not.toBeNull();
		});

		it('sets grid display style', () => {
			view.mount(container);
			const gridEl = container.querySelector('div.grid-view') as HTMLElement;
			expect(gridEl.style.display).toBe('grid');
		});
	});

	describe('render', () => {
		it('creates div.card elements matching card count', () => {
			setContainerWidth(container, 540); // 3 cols of 180
			view.mount(container);
			const cards = makeCards(6);
			view.render(cards);
			const groups = container.querySelectorAll('div.card');
			expect(groups.length).toBe(6);
		});

		it('uses key function d => d.id (re-render with reordered data preserves IDs)', () => {
			setContainerWidth(container, 540);
			view.mount(container);
			const cards = makeCards(4);
			view.render(cards);

			// Get IDs after first render
			const initialGroups = Array.from(container.querySelectorAll<HTMLDivElement>('div.card'));
			const initialIds = initialGroups.map((g) => (g as unknown as { __data__: CardDatum }).__data__?.id);

			// Re-render with reversed order
			view.render([...cards].reverse());

			const afterGroups = Array.from(container.querySelectorAll<HTMLDivElement>('div.card'));
			const afterIds = afterGroups.map((g) => (g as unknown as { __data__: CardDatum }).__data__?.id);

			// Same IDs present regardless of order
			expect(new Set(initialIds)).toEqual(new Set(afterIds));
			expect(afterIds).toContain('card-1');
			expect(afterIds).toContain('card-2');
			expect(afterIds).toContain('card-3');
			expect(afterIds).toContain('card-4');
		});

		it('sets CSS grid template columns for 3 columns at width 576', () => {
			setContainerWidth(container, 576); // 3 cols: floor((576+12)/192) = 3
			view.mount(container);
			const cards = makeCards(6);
			view.render(cards);

			const gridEl = container.querySelector('div.grid-view') as HTMLElement;
			expect(gridEl.style.gridTemplateColumns).toBe('repeat(3, 180px)');
		});

		it('adapts column count to container width (2 columns at width 384)', () => {
			setContainerWidth(container, 384); // 2 cols: floor((384+12)/192) = 2
			view.mount(container);
			const cards = makeCards(4);
			view.render(cards);

			const gridEl = container.querySelector('div.grid-view') as HTMLElement;
			expect(gridEl.style.gridTemplateColumns).toBe('repeat(2, 180px)');
		});

		it('ensures at least 1 column for narrow containers (width 100)', () => {
			setContainerWidth(container, 100); // floor((100+12)/192) = 0 → Math.max(1, 0) = 1
			view.mount(container);
			const cards = makeCards(3);
			view.render(cards);

			const gridEl = container.querySelector('div.grid-view') as HTMLElement;
			expect(gridEl.style.gridTemplateColumns).toBe('repeat(1, 180px)');
		});

		it('renders correct number of cards', () => {
			setContainerWidth(container, 576); // 3 cols
			view.mount(container);
			const cards = makeCards(6); // 6 cards / 3 cols = 2 rows
			view.render(cards);

			const cardEls = container.querySelectorAll('div.card');
			expect(cardEls.length).toBe(6);
		});

		it('card count matches data length', () => {
			setContainerWidth(container, 576); // 3 cols
			view.mount(container);
			const cards = makeCards(6); // 2 rows
			view.render(cards);

			const cardEls = container.querySelectorAll('div.card');
			expect(cardEls.length).toBe(6);
		});
	});

	describe('enter/exit', () => {
		it('adding new cards adds new div.card elements', () => {
			setContainerWidth(container, 540);
			view.mount(container);
			const cards = makeCards(4);
			view.render(cards);
			expect(container.querySelectorAll('div.card').length).toBe(4);

			view.render(makeCards(6));
			expect(container.querySelectorAll('div.card').length).toBe(6);
		});

		it('removing cards removes div.card elements from DOM', () => {
			setContainerWidth(container, 540);
			view.mount(container);
			const initial = makeCards(4); // [1,2,3,4]
			view.render(initial);

			// Replace with 2 new cards — original cards [3,4] removed
			const newCards: CardDatum[] = [
				initial[0]!, // card-1 stays
				initial[1]!, // card-2 stays
				{
					id: 'card-new-a',
					name: 'New A',
					folder: null,
					status: null,
					card_type: 'note',
					created_at: '2026-02-01T10:00:00Z',
					modified_at: '2026-02-01T12:00:00Z',
					priority: 0,
					sort_order: 10,
					due_at: null,
					body_text: null,
					source: null,
				},
				{
					id: 'card-new-b',
					name: 'New B',
					folder: null,
					status: null,
					card_type: 'note',
					created_at: '2026-02-02T10:00:00Z',
					modified_at: '2026-02-02T12:00:00Z',
					priority: 0,
					sort_order: 11,
					due_at: null,
					body_text: null,
					source: null,
				},
			];
			view.render(newCards);

			const groups = container.querySelectorAll('div.card');
			expect(groups.length).toBe(4); // same count, but different cards

			const ids = Array.from(groups).map((g) => (g as unknown as { __data__: CardDatum }).__data__?.id);
			expect(ids).toContain('card-1');
			expect(ids).toContain('card-2');
			expect(ids).toContain('card-new-a');
			expect(ids).toContain('card-new-b');
			expect(ids).not.toContain('card-3');
			expect(ids).not.toContain('card-4');
		});
	});

	describe('destroy', () => {
		it('removes grid-view from container', () => {
			view.mount(container);
			view.render(makeCards(3));
			view.destroy();

			expect(container.querySelector('div.grid-view')).toBeNull();
			expect(container.children.length).toBe(0);
		});

		it('calling destroy on unmounted view does not throw', () => {
			expect(() => view.destroy()).not.toThrow();
		});
	});
});
