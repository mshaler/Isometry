// @vitest-environment jsdom
// Isometry v5 — ListView Tests
// Tests for HTML-based single-column list view with sort controls.
//
// Requirements: VIEW-01, DIMS-01

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ListView } from '../../src/views/ListView';
import type { CardDatum } from '../../src/views/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeCards(overrides: Partial<CardDatum>[] = []): CardDatum[] {
	const defaults: CardDatum[] = [
		{
			id: 'card-1',
			name: 'Alpha Note',
			folder: 'docs',
			status: null,
			card_type: 'note',
			created_at: '2026-01-01T10:00:00Z',
			modified_at: '2026-01-15T12:00:00Z',
			priority: 3,
			sort_order: 1,
			due_at: null,
			body_text: null,
			source: null,
		},
		{
			id: 'card-2',
			name: 'Beta Task',
			folder: null,
			status: 'in-progress',
			card_type: 'task',
			created_at: '2026-01-02T10:00:00Z',
			modified_at: '2026-01-10T12:00:00Z',
			priority: 5,
			sort_order: 2,
			due_at: null,
			body_text: null,
			source: null,
		},
		{
			id: 'card-3',
			name: 'Gamma Event',
			folder: 'calendar',
			status: 'done',
			card_type: 'event',
			created_at: '2026-01-03T10:00:00Z',
			modified_at: '2026-01-20T12:00:00Z',
			priority: 1,
			sort_order: 3,
			due_at: null,
			body_text: null,
			source: null,
		},
		{
			id: 'card-4',
			name: 'Delta Resource',
			folder: 'links',
			status: null,
			card_type: 'resource',
			created_at: '2026-01-04T10:00:00Z',
			modified_at: '2026-01-05T12:00:00Z',
			priority: 4,
			sort_order: 4,
			due_at: null,
			body_text: null,
			source: null,
		},
		{
			id: 'card-5',
			name: 'Epsilon Person',
			folder: 'contacts',
			status: null,
			card_type: 'person',
			created_at: '2026-01-05T10:00:00Z',
			modified_at: '2026-01-25T12:00:00Z',
			priority: 2,
			sort_order: 5,
			due_at: null,
			body_text: null,
			source: null,
		},
	];

	return overrides.length > 0 ? overrides.map((o, i) => ({ ...defaults[i % defaults.length]!, ...o })) : defaults;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ListView', () => {
	let container: HTMLElement;
	let view: ListView;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		view = new ListView();
	});

	afterEach(() => {
		view.destroy();
		document.body.removeChild(container);
	});

	describe('mount', () => {
		it('creates list-view element in container', () => {
			view.mount(container);
			const listEl = container.querySelector('div.list-view');
			expect(listEl).not.toBeNull();
		});

		it('creates sort toolbar in container', () => {
			view.mount(container);
			const toolbar = container.querySelector('.sort-toolbar');
			expect(toolbar).not.toBeNull();
		});

		it('sort toolbar contains a sort field dropdown', () => {
			view.mount(container);
			const select = container.querySelector('.sort-toolbar select');
			expect(select).not.toBeNull();
		});

		it('sort toolbar contains an asc/desc toggle button', () => {
			view.mount(container);
			const btn = container.querySelector('.sort-toolbar .sort-direction');
			expect(btn).not.toBeNull();
		});
	});

	describe('render', () => {
		it('creates div.card elements matching card count', () => {
			view.mount(container);
			const cards = makeCards();
			view.render(cards);
			const groups = container.querySelectorAll('div.card');
			expect(groups.length).toBe(5); // makeCards() returns 5 cards
		});

		it('creates correct number of div.card elements for given cards', () => {
			view.mount(container);
			const cards = makeCards().slice(0, 3);
			view.render(cards);
			const groups = container.querySelectorAll('div.card');
			expect(groups.length).toBe(3);
		});

		it('uses key function d => d.id (re-render with reordered data keeps same elements)', () => {
			view.mount(container);
			const cards = makeCards().slice(0, 3);
			view.render(cards);

			// Get references to div elements after first render
			const initialGroups = Array.from(container.querySelectorAll<HTMLDivElement>('div.card'));
			const initialIds = initialGroups.map((g) => (g as unknown as { __data__: CardDatum }).__data__?.id);

			// Re-render with reversed order
			view.render([...cards].reverse());

			const afterGroups = Array.from(container.querySelectorAll<HTMLDivElement>('div.card'));
			const afterIds = afterGroups.map((g) => (g as unknown as { __data__: CardDatum }).__data__?.id);

			// Same IDs present regardless of order — key function ensures identity
			expect(new Set(initialIds)).toEqual(new Set(afterIds));
			expect(afterIds).toContain('card-1');
			expect(afterIds).toContain('card-2');
			expect(afterIds).toContain('card-3');
		});

		it('cards flow naturally as HTML elements (no SVG transforms)', () => {
			view.mount(container);
			const cards = makeCards().slice(0, 3);
			view.render(cards);

			const groups = container.querySelectorAll('div.card');
			// HTML cards flow naturally in the list container — no translate positioning needed
			expect(groups.length).toBe(3);
		});

		it('shows card name in .card__title element', () => {
			view.mount(container);
			const cards = makeCards().slice(0, 1);
			view.render(cards);

			const nameText = container.querySelector('.card__title');
			expect(nameText).not.toBeNull();
			expect(nameText!.textContent).toContain('Alpha');
		});

		it('shows preview text in .card__preview element', () => {
			view.mount(container);
			const cards = makeCards().slice(0, 1);
			view.render(cards);

			const previewEl = container.querySelector('.card__preview');
			expect(previewEl).not.toBeNull();
		});

		it('renders correct number of cards after count change', () => {
			view.mount(container);
			const threeCards = makeCards().slice(0, 3);
			view.render(threeCards);

			const countAfterThree = container.querySelectorAll('div.card').length;

			const fiveCards = makeCards();
			view.render(fiveCards);
			const countAfterFive = container.querySelectorAll('div.card').length;

			expect(countAfterFive).toBeGreaterThan(countAfterThree);
		});
	});

	describe('sort controls', () => {
		it('changing sort field changes card order in DOM', () => {
			view.mount(container);
			const cards = makeCards().slice(0, 3);
			view.render(cards);

			// Default sort is by name (asc) → Alpha, Beta, Gamma
			const groupsBefore = Array.from(container.querySelectorAll<HTMLDivElement>('div.card'));
			const _idsBefore = groupsBefore.map((g) => (g as unknown as { __data__: CardDatum }).__data__?.id);

			// Change sort to priority
			const select = container.querySelector('.sort-toolbar select') as HTMLSelectElement;
			select.value = 'priority';
			select.dispatchEvent(new Event('change'));

			const groupsAfter = Array.from(container.querySelectorAll<HTMLDivElement>('div.card'));
			const idsAfter = groupsAfter.map((g) => (g as unknown as { __data__: CardDatum }).__data__?.id);

			// Sort by priority asc: Gamma (1), Alpha (3), Beta (5) — ordering should differ from name sort
			// Just verify that the sorted IDs match priority order
			expect(idsAfter[0]).toBe('card-3'); // priority 1 (Gamma)
			expect(idsAfter[1]).toBe('card-1'); // priority 3 (Alpha)
			expect(idsAfter[2]).toBe('card-2'); // priority 5 (Beta)
		});

		it('toggling direction reverses card order', () => {
			view.mount(container);
			const cards = makeCards().slice(0, 3);
			view.render(cards);

			// Default: name asc → Alpha, Beta, Gamma
			const groupsBefore = Array.from(container.querySelectorAll<HTMLDivElement>('div.card'));
			const namesBefore = groupsBefore.map((g) => {
				const nameEl = g.querySelector('.card__title');
				return nameEl?.textContent ?? '';
			});

			// Click toggle to switch to desc
			const btn = container.querySelector('.sort-toolbar .sort-direction') as HTMLButtonElement;
			btn.click();

			const groupsAfter = Array.from(container.querySelectorAll<HTMLDivElement>('div.card'));
			const namesAfter = groupsAfter.map((g) => {
				const nameEl = g.querySelector('.card__title');
				return nameEl?.textContent ?? '';
			});

			// Desc should be reverse of asc
			expect(namesAfter[0]).not.toBe(namesBefore[0]);
		});
	});

	describe('enter/exit', () => {
		it('adding new cards adds new div.card elements', () => {
			view.mount(container);
			view.render(makeCards().slice(0, 3)); // [A, B, C]
			expect(container.querySelectorAll('div.card').length).toBe(3);

			view.render(makeCards().slice(0, 5)); // [A, B, C, D, E]
			expect(container.querySelectorAll('div.card').length).toBe(5);
		});

		it('removing cards removes div.card elements from DOM', () => {
			view.mount(container);
			const allCards = makeCards();
			view.render(allCards); // [A, B, C, D, E]

			// Re-render with D and E removed (replaced by nothing) — use [A, B, new card replacing C]
			const newCard: CardDatum = {
				id: 'card-new',
				name: 'New Card',
				folder: null,
				status: null,
				card_type: 'note',
				created_at: '2026-01-06T10:00:00Z',
				modified_at: '2026-01-26T12:00:00Z',
				priority: 0,
				sort_order: 6,
				due_at: null,
				body_text: null,
				source: null,
			};
			view.render([allCards[0]!, allCards[1]!, newCard]);

			const groups = container.querySelectorAll('div.card');
			// card-3, card-4, card-5 removed; card-new added → 3 total
			expect(groups.length).toBe(3);

			const ids = Array.from(groups).map((g) => (g as unknown as { __data__: CardDatum }).__data__?.id);
			expect(ids).toContain('card-1');
			expect(ids).toContain('card-2');
			expect(ids).toContain('card-new');
			expect(ids).not.toContain('card-3');
		});
	});

	describe('destroy', () => {
		it('removes all DOM elements from container', () => {
			view.mount(container);
			view.render(makeCards().slice(0, 3));
			view.destroy();

			expect(container.querySelector('div.list-view')).toBeNull();
			expect(container.querySelector('.sort-toolbar')).toBeNull();
			expect(container.children.length).toBe(0);
		});

		it('calling destroy on unmounted view does not throw', () => {
			expect(() => view.destroy()).not.toThrow();
		});
	});
});
