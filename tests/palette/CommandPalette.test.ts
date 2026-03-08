// @vitest-environment jsdom
// Isometry v5 -- Phase 51 Plan 02
// CommandPalette UI component tests: DOM structure, keyboard navigation, ARIA, execution.
//
// Requirements: CMDK-01, CMDK-03, CMDK-04, CMDK-05, CMDK-06

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaletteSearchResult } from '../../src/palette/CommandPalette';
import { CommandPalette } from '../../src/palette/CommandPalette';
import type { PaletteCommand } from '../../src/palette/CommandRegistry';
import { CommandRegistry } from '../../src/palette/CommandRegistry';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestRegistry(): CommandRegistry {
	const registry = new CommandRegistry();
	registry.registerAll([
		{
			id: 'view:list',
			label: 'List View',
			category: 'Views',
			shortcut: 'Cmd+1',
			execute: vi.fn(),
		},
		{
			id: 'view:grid',
			label: 'Grid View',
			category: 'Views',
			shortcut: 'Cmd+2',
			execute: vi.fn(),
		},
		{
			id: 'action:clear-filters',
			label: 'Clear Filters',
			category: 'Actions',
			visible: () => true,
			execute: vi.fn(),
		},
		{
			id: 'setting:cycle-theme',
			label: 'Cycle Theme',
			category: 'Settings',
			shortcut: 'Cmd+Shift+T',
			execute: vi.fn(),
		},
	]);
	return registry;
}

function createMockSearchCards(): ReturnType<
	typeof vi.fn<(query: string, limit: number) => Promise<PaletteSearchResult[]>>
> {
	return vi.fn<(query: string, limit: number) => Promise<PaletteSearchResult[]>>().mockResolvedValue([]);
}

function createContainer(): HTMLElement {
	const el = document.createElement('div');
	document.body.appendChild(el);
	return el;
}

function dispatchKeydown(target: HTMLElement, key: string, opts: Partial<KeyboardEvent> = {}): void {
	const event = new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
		...opts,
	});
	target.dispatchEvent(event);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandPalette', () => {
	let registry: CommandRegistry;
	let searchCards: ReturnType<typeof vi.fn<(query: string, limit: number) => Promise<PaletteSearchResult[]>>>;
	let container: HTMLElement;
	let palette: CommandPalette;
	let announcer: { announce: ReturnType<typeof vi.fn<(msg: string) => void>> };

	beforeEach(() => {
		localStorage.clear();
		registry = createTestRegistry();
		searchCards = createMockSearchCards();
		container = createContainer();
		announcer = { announce: vi.fn<(msg: string) => void>() };
		palette = new CommandPalette(registry, searchCards, announcer);
	});

	afterEach(() => {
		palette.destroy();
		container.remove();
	});

	// -----------------------------------------------------------------------
	// DOM structure
	// -----------------------------------------------------------------------

	describe('DOM structure after mount', () => {
		it('creates overlay with command-palette class', () => {
			palette.mount(container);
			const overlay = container.querySelector('.command-palette');
			expect(overlay).not.toBeNull();
		});

		it('creates input with combobox role', () => {
			palette.mount(container);
			const input = container.querySelector('.command-palette__input');
			expect(input).not.toBeNull();
			expect(input!.getAttribute('role')).toBe('combobox');
		});

		it('creates results container with listbox role', () => {
			palette.mount(container);
			const listbox = container.querySelector('.command-palette__results');
			expect(listbox).not.toBeNull();
			expect(listbox!.getAttribute('role')).toBe('listbox');
			expect(listbox!.getAttribute('id')).toBe('palette-listbox');
		});

		it('input has aria-controls pointing to listbox', () => {
			palette.mount(container);
			const input = container.querySelector('.command-palette__input');
			expect(input!.getAttribute('aria-controls')).toBe('palette-listbox');
		});

		it('input has aria-autocomplete="list"', () => {
			palette.mount(container);
			const input = container.querySelector('.command-palette__input');
			expect(input!.getAttribute('aria-autocomplete')).toBe('list');
		});

		it('input has aria-expanded="false" initially', () => {
			palette.mount(container);
			const input = container.querySelector('.command-palette__input');
			expect(input!.getAttribute('aria-expanded')).toBe('false');
		});
	});

	// -----------------------------------------------------------------------
	// Open / Close
	// -----------------------------------------------------------------------

	describe('open and close', () => {
		it('open() adds is-visible class to overlay', () => {
			palette.mount(container);
			palette.open();
			const overlay = container.querySelector('.command-palette');
			expect(overlay!.classList.contains('is-visible')).toBe(true);
		});

		it('close() removes is-visible class', () => {
			palette.mount(container);
			palette.open();
			palette.close();
			const overlay = container.querySelector('.command-palette');
			expect(overlay!.classList.contains('is-visible')).toBe(false);
		});

		it('open() sets aria-expanded to true', () => {
			palette.mount(container);
			palette.open();
			const input = container.querySelector('.command-palette__input');
			expect(input!.getAttribute('aria-expanded')).toBe('true');
		});

		it('close() sets aria-expanded to false', () => {
			palette.mount(container);
			palette.open();
			palette.close();
			const input = container.querySelector('.command-palette__input');
			expect(input!.getAttribute('aria-expanded')).toBe('false');
		});

		it('open() focuses the input', async () => {
			palette.mount(container);
			palette.open();
			// requestAnimationFrame is used; flush with a microtask
			await new Promise((r) => requestAnimationFrame(r));
			const input = container.querySelector('.command-palette__input');
			expect(document.activeElement).toBe(input);
		});

		it('isVisible() returns correct state', () => {
			palette.mount(container);
			expect(palette.isVisible()).toBe(false);
			palette.open();
			expect(palette.isVisible()).toBe(true);
			palette.close();
			expect(palette.isVisible()).toBe(false);
		});

		it('open() announces via announcer', () => {
			palette.mount(container);
			palette.open();
			expect(announcer.announce).toHaveBeenCalledWith('Command palette opened');
		});

		it('close() restores previous focus', async () => {
			palette.mount(container);
			const button = document.createElement('button');
			container.appendChild(button);
			button.focus();
			expect(document.activeElement).toBe(button);

			palette.open();
			palette.close();
			await new Promise((r) => requestAnimationFrame(r));
			expect(document.activeElement).toBe(button);
		});
	});

	// -----------------------------------------------------------------------
	// Result rendering
	// -----------------------------------------------------------------------

	describe('result rendering', () => {
		it('renders option elements with role="option"', () => {
			palette.mount(container);
			palette.open();
			const options = container.querySelectorAll('[role="option"]');
			expect(options.length).toBeGreaterThan(0);
		});

		it('renders category headers with role="presentation"', () => {
			palette.mount(container);
			palette.open();
			const headers = container.querySelectorAll('.command-palette__category');
			expect(headers.length).toBeGreaterThan(0);
			for (const header of headers) {
				expect(header.getAttribute('role')).toBe('presentation');
			}
		});

		it('renders shortcut hints as kbd elements', () => {
			palette.mount(container);
			palette.open();
			const kbds = container.querySelectorAll('.command-palette__kbd');
			expect(kbds.length).toBeGreaterThan(0);
			// The "List View" command has Cmd+1 shortcut
			const kbdTexts = Array.from(kbds).map((k) => k.textContent);
			expect(kbdTexts).toContain('Cmd+1');
		});

		it('first option is selected by default', () => {
			palette.mount(container);
			palette.open();
			const firstOption = container.querySelector('#palette-option-0');
			expect(firstOption).not.toBeNull();
			expect(firstOption!.getAttribute('aria-selected')).toBe('true');
		});

		it('aria-activedescendant points to first option on open', () => {
			palette.mount(container);
			palette.open();
			const input = container.querySelector('.command-palette__input');
			expect(input!.getAttribute('aria-activedescendant')).toBe('palette-option-0');
		});

		it('shows empty state when no results match', () => {
			palette.mount(container);
			palette.open();
			// Type a query that matches nothing
			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			input.value = 'xyznonexistent';
			input.dispatchEvent(new Event('input', { bubbles: true }));

			const empty = container.querySelector('.command-palette__empty');
			expect(empty).not.toBeNull();
			expect(empty!.textContent).toBe('No results found');
		});
	});

	// -----------------------------------------------------------------------
	// Keyboard navigation
	// -----------------------------------------------------------------------

	describe('keyboard navigation', () => {
		it('ArrowDown moves selection to next option', () => {
			palette.mount(container);
			palette.open();

			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			dispatchKeydown(input, 'ArrowDown');

			const opt0 = container.querySelector('#palette-option-0');
			const opt1 = container.querySelector('#palette-option-1');
			expect(opt0!.getAttribute('aria-selected')).toBe('false');
			expect(opt1!.getAttribute('aria-selected')).toBe('true');
		});

		it('ArrowUp moves selection to previous option', () => {
			palette.mount(container);
			palette.open();

			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			// Move down first
			dispatchKeydown(input, 'ArrowDown');
			// Then back up
			dispatchKeydown(input, 'ArrowUp');

			const opt0 = container.querySelector('#palette-option-0');
			expect(opt0!.getAttribute('aria-selected')).toBe('true');
		});

		it('ArrowDown wraps from last to first', () => {
			palette.mount(container);
			palette.open();

			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			const options = container.querySelectorAll('[role="option"]');
			const count = options.length;

			// Move down through all options + 1 to wrap
			for (let i = 0; i < count; i++) {
				dispatchKeydown(input, 'ArrowDown');
			}

			// Should be back at first
			expect(container.querySelector('#palette-option-0')!.getAttribute('aria-selected')).toBe('true');
		});

		it('ArrowUp wraps from first to last', () => {
			palette.mount(container);
			palette.open();

			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			dispatchKeydown(input, 'ArrowUp');

			const options = container.querySelectorAll('[role="option"]');
			const lastOption = options[options.length - 1];
			expect(lastOption!.getAttribute('aria-selected')).toBe('true');
		});

		it('aria-activedescendant updates on arrow navigation', () => {
			palette.mount(container);
			palette.open();

			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			dispatchKeydown(input, 'ArrowDown');

			expect(input.getAttribute('aria-activedescendant')).toBe('palette-option-1');
		});

		it('Escape closes the palette', () => {
			palette.mount(container);
			palette.open();
			expect(palette.isVisible()).toBe(true);

			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			dispatchKeydown(input, 'Escape');

			expect(palette.isVisible()).toBe(false);
		});

		it('Enter executes selected command and closes', () => {
			palette.mount(container);
			palette.open();

			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			dispatchKeydown(input, 'Enter');

			expect(palette.isVisible()).toBe(false);
			// The first visible command's execute should have been called
			const firstCmd = registry.getVisible()[0]!;
			expect(firstCmd.execute).toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// Command execution
	// -----------------------------------------------------------------------

	describe('command execution', () => {
		it('executing a command pushes it to recents', () => {
			palette.mount(container);
			palette.open();

			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			dispatchKeydown(input, 'Enter');

			const raw = localStorage.getItem('isometry:palette-recents');
			expect(raw).not.toBeNull();
			const recents = JSON.parse(raw!);
			expect(recents.length).toBeGreaterThan(0);
		});

		it('card commands do not get pushed to recents', () => {
			// Create a palette with card results
			const cardRegistry = new CommandRegistry();
			const cardCommand: PaletteCommand = {
				id: 'card:abc123',
				label: 'Test Card',
				category: 'Cards',
				execute: vi.fn(),
			};
			cardRegistry.register(cardCommand);

			const cardPalette = new CommandPalette(cardRegistry, searchCards, announcer);
			cardPalette.mount(container);
			cardPalette.open();

			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			dispatchKeydown(input, 'Enter');

			const raw = localStorage.getItem('isometry:palette-recents');
			const recents = raw ? JSON.parse(raw) : [];
			expect(recents).not.toContain('card:abc123');

			cardPalette.destroy();
		});
	});

	// -----------------------------------------------------------------------
	// Card search integration
	// -----------------------------------------------------------------------

	describe('card search', () => {
		it('triggers searchCards after debounce for queries >= 2 chars', async () => {
			vi.useFakeTimers();

			palette.mount(container);
			palette.open();

			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			input.value = 'te';
			input.dispatchEvent(new Event('input', { bubbles: true }));

			// searchCards should not be called immediately
			expect(searchCards).not.toHaveBeenCalled();

			// Advance past debounce
			await vi.advanceTimersByTimeAsync(250);

			expect(searchCards).toHaveBeenCalledWith('te', 5);

			vi.useRealTimers();
		});

		it('card search results appear in Cards category', async () => {
			vi.useFakeTimers();

			searchCards.mockResolvedValue([
				{
					card: { id: 'card1', name: 'Test Card One' },
					snippet: 'snippet 1',
				},
			]);

			palette.mount(container);
			palette.open();

			const input = container.querySelector('.command-palette__input') as HTMLInputElement;
			input.value = 'test';
			input.dispatchEvent(new Event('input', { bubbles: true }));

			// Advance past debounce
			await vi.advanceTimersByTimeAsync(250);
			// Let the promise resolve
			await vi.runAllTimersAsync();

			// Check for Cards category
			const categories = container.querySelectorAll('.command-palette__category');
			const categoryTexts = Array.from(categories).map((c) => c.textContent);
			expect(categoryTexts).toContain('Cards');

			vi.useRealTimers();
		});
	});

	// -----------------------------------------------------------------------
	// Backdrop click
	// -----------------------------------------------------------------------

	describe('backdrop interactions', () => {
		it('clicking backdrop closes palette', () => {
			palette.mount(container);
			palette.open();
			expect(palette.isVisible()).toBe(true);

			const overlay = container.querySelector('.command-palette')!;
			overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

			expect(palette.isVisible()).toBe(false);
		});

		it('clicking card does not close palette', () => {
			palette.mount(container);
			palette.open();

			const card = container.querySelector('.command-palette__card')!;
			card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

			expect(palette.isVisible()).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Destroy
	// -----------------------------------------------------------------------

	describe('destroy', () => {
		it('removes overlay from DOM', () => {
			palette.mount(container);
			palette.destroy();
			expect(container.querySelector('.command-palette')).toBeNull();
		});
	});
});
