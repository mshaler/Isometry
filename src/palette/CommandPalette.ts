// Isometry v5 -- Phase 51 Plan 02
// CommandPalette UI component with WAI-ARIA combobox pattern.
//
// Mount/destroy lifecycle follows HelpOverlay pattern.
// Dual-path search: synchronous fuzzy for commands, debounced async for card search.
//
// Requirements: CMDK-01, CMDK-03, CMDK-04, CMDK-05, CMDK-06

import '../styles/command-palette.css';
import { COMBOBOX_ATTRS } from '../accessibility/combobox-contract';
import type { PaletteCommand } from './CommandRegistry';
import { type CommandRegistry, getRecentCommands, pushRecent } from './CommandRegistry';

// ---------------------------------------------------------------------------
// Minimal search result interface (avoids importing full WorkerBridge types)
// ---------------------------------------------------------------------------

/** Minimal card search result -- matches WorkerBridge.searchCards() shape. */
export interface PaletteSearchResult {
	card: { id: string; name: string };
	snippet: string;
}

// ---------------------------------------------------------------------------
// Category display order and icons
// ---------------------------------------------------------------------------

const CATEGORY_ORDER: ReadonlyArray<string> = ['Recents', 'Views', 'Actions', 'Cards', 'Settings'];

const CATEGORY_ICONS: Record<string, string> = {
	Recents: '\u23F1', // stopwatch
	Views: '\u25A6', // square with orthogonal crosshatch fill
	Actions: '\u26A1', // high voltage
	Cards: '\u2750', // upper right drop-shadowed white square
	Settings: '\u2699', // gear
};

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

/**
 * Command palette overlay with fuzzy search, card search, keyboard navigation,
 * and WAI-ARIA combobox accessibility pattern.
 *
 * Usage:
 *   const palette = new CommandPalette(registry, bridge.searchCards.bind(bridge));
 *   palette.mount(container);
 *   palette.open();   // Cmd+K handler calls this
 *   palette.close();  // Escape or backdrop click
 *   palette.destroy(); // cleanup
 */
export class CommandPalette {
	// Dependencies (injected via constructor)
	private readonly _registry: CommandRegistry;
	private readonly _searchCards: (query: string, limit: number) => Promise<PaletteSearchResult[]>;
	private readonly _announcer: { announce: (msg: string) => void } | undefined;

	// DOM references
	private _overlayEl: HTMLElement | null = null;
	private _inputEl: HTMLInputElement | null = null;
	private _listboxEl: HTMLElement | null = null;

	// State
	private _visible = false;
	private _selectedIndex = 0;
	private _currentResults: PaletteCommand[] = [];
	private _pendingCards: PaletteCommand[] = [];
	private _cardSearchTimer: ReturnType<typeof setTimeout> | null = null;
	private _cardSearchGeneration = 0;
	private _previousFocus: HTMLElement | null = null;

	// Handlers (stored for cleanup)
	private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
	private _inputHandler: ((e: Event) => void) | null = null;
	private _backdropClickHandler: ((e: MouseEvent) => void) | null = null;

	constructor(
		registry: CommandRegistry,
		searchCards: (query: string, limit: number) => Promise<PaletteSearchResult[]>,
		announcer?: { announce: (msg: string) => void },
	) {
		this._registry = registry;
		this._searchCards = searchCards;
		this._announcer = announcer;
	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	/** Create overlay DOM structure and attach event listeners. */
	mount(container: HTMLElement): void {
		// Outer overlay (backdrop)
		const overlay = document.createElement('div');
		overlay.className = 'command-palette';

		// Card container
		const card = document.createElement('div');
		card.className = 'command-palette__card';

		// Input with COMBOBOX_ATTRS
		const input = document.createElement('input');
		input.type = 'text';
		input.placeholder = 'Type a command or search...';
		input.className = 'command-palette__input';
		for (const [attr, value] of Object.entries(COMBOBOX_ATTRS.input)) {
			input.setAttribute(attr, value);
		}

		// Results listbox
		const listbox = document.createElement('div');
		listbox.className = 'command-palette__results';
		for (const [attr, value] of Object.entries(COMBOBOX_ATTRS.listbox)) {
			listbox.setAttribute(attr, value);
		}

		// Assemble DOM
		card.appendChild(input);
		card.appendChild(listbox);
		overlay.appendChild(card);
		container.appendChild(overlay);

		// Store references
		this._overlayEl = overlay;
		this._inputEl = input;
		this._listboxEl = listbox;

		// Backdrop click handler: click on overlay (not card) closes palette
		this._backdropClickHandler = (e: MouseEvent) => {
			if (e.target === overlay) {
				this.close();
			}
		};
		overlay.addEventListener('click', this._backdropClickHandler);

		// Input handler for search-as-you-type
		this._inputHandler = () => {
			this._onInput(input.value);
		};
		input.addEventListener('input', this._inputHandler);

		// Keyboard handler on input for navigation
		this._keydownHandler = (e: KeyboardEvent) => {
			if (!this._visible) return;
			this._onKeydown(e);
		};
		input.addEventListener('keydown', this._keydownHandler);
	}

	/** Show the palette overlay and populate with default results. */
	open(): void {
		if (!this._overlayEl || !this._inputEl) return;

		// Capture current focus for restoration on close
		this._previousFocus = document.activeElement as HTMLElement | null;

		// Show overlay
		this._overlayEl.classList.add('is-visible');
		this._visible = true;
		this._inputEl.setAttribute('aria-expanded', 'true');

		// Clear input
		this._inputEl.value = '';

		// Populate with recents + visible commands
		const recents = getRecentCommands(this._registry);
		const visible = this._registry.getVisible();
		this._pendingCards = [];
		this._selectedIndex = 0;
		this._renderResults(visible, [], recents);

		// Focus input (requestAnimationFrame for DOM settlement per project pattern)
		requestAnimationFrame(() => {
			this._inputEl?.focus();
		});

		this._announcer?.announce('Command palette opened');
	}

	/** Hide the palette overlay and restore focus. */
	close(): void {
		if (!this._overlayEl || !this._inputEl) return;

		this._overlayEl.classList.remove('is-visible');
		this._visible = false;
		this._inputEl.setAttribute('aria-expanded', 'false');

		// Clear pending card search
		if (this._cardSearchTimer !== null) {
			clearTimeout(this._cardSearchTimer);
			this._cardSearchTimer = null;
		}
		this._pendingCards = [];

		// Restore focus
		const prev = this._previousFocus;
		requestAnimationFrame(() => {
			prev?.focus();
		});
	}

	/** Remove overlay from DOM and clean up all listeners. */
	destroy(): void {
		if (this._overlayEl) {
			if (this._backdropClickHandler) {
				this._overlayEl.removeEventListener('click', this._backdropClickHandler);
			}
			this._overlayEl.remove();
		}
		if (this._inputEl) {
			if (this._inputHandler) {
				this._inputEl.removeEventListener('input', this._inputHandler);
			}
			if (this._keydownHandler) {
				this._inputEl.removeEventListener('keydown', this._keydownHandler);
			}
		}

		// Clear pending timer
		if (this._cardSearchTimer !== null) {
			clearTimeout(this._cardSearchTimer);
		}

		// Null out all references
		this._overlayEl = null;
		this._inputEl = null;
		this._listboxEl = null;
		this._keydownHandler = null;
		this._inputHandler = null;
		this._backdropClickHandler = null;
		this._previousFocus = null;
	}

	/** Whether the palette is currently visible. */
	isVisible(): boolean {
		return this._visible;
	}

	// ---------------------------------------------------------------------------
	// Search
	// ---------------------------------------------------------------------------

	/** Dual-path search: sync commands + debounced async cards. */
	private _onInput(query: string): void {
		// Synchronous path: fuzzy-filter static commands
		if (query === '') {
			// Empty query: show recents + all visible
			const recents = getRecentCommands(this._registry);
			const visible = this._registry.getVisible();
			this._pendingCards = [];
			this._selectedIndex = 0;
			this._renderResults(visible, [], recents);
			return;
		}

		const commands = this._registry.search(query);
		this._selectedIndex = 0;
		this._renderResults(commands, this._pendingCards);

		// Async path: debounced card search (>= 2 chars)
		if (this._cardSearchTimer !== null) {
			clearTimeout(this._cardSearchTimer);
			this._cardSearchTimer = null;
		}

		if (query.length >= 2) {
			this._cardSearchGeneration++;
			const generation = this._cardSearchGeneration;

			this._cardSearchTimer = setTimeout(() => {
				void this._searchCards(query, 5).then((results) => {
					// Race condition guard: discard stale results
					if (generation !== this._cardSearchGeneration) return;
					if (!this._visible) return;

					this._pendingCards = results.map((r) => ({
						id: `card:${r.card.id}`,
						label: r.card.name,
						category: 'Cards' as const,
						execute: () => {
							// Navigate to card in List view (default best view)
							// Dispatches a custom event that main.ts can listen to
							window.dispatchEvent(
								new CustomEvent('isometry:navigate-to-card', {
									detail: { cardId: r.card.id },
								}),
							);
						},
					}));

					// Re-render with current commands + card results
					const currentQuery = this._inputEl?.value ?? '';
					const cmds = currentQuery === '' ? this._registry.getVisible() : this._registry.search(currentQuery);
					this._renderResults(cmds, this._pendingCards);
				});
			}, 200);
		} else {
			this._pendingCards = [];
		}
	}

	// ---------------------------------------------------------------------------
	// Keyboard navigation
	// ---------------------------------------------------------------------------

	/** Handle keyboard events for navigation within the palette. */
	private _onKeydown(e: KeyboardEvent): void {
		switch (e.key) {
			case 'Escape':
				e.preventDefault();
				this.close();
				break;

			case 'ArrowDown':
				e.preventDefault();
				if (this._currentResults.length > 0) {
					this._selectedIndex = (this._selectedIndex + 1) % this._currentResults.length;
					this._updateSelection();
				}
				break;

			case 'ArrowUp':
				e.preventDefault();
				if (this._currentResults.length > 0) {
					this._selectedIndex = this._selectedIndex <= 0 ? this._currentResults.length - 1 : this._selectedIndex - 1;
					this._updateSelection();
				}
				break;

			case 'Enter':
				e.preventDefault();
				this._executeSelected();
				break;
		}
	}

	// ---------------------------------------------------------------------------
	// Execution
	// ---------------------------------------------------------------------------

	/** Execute the currently selected command. */
	private _executeSelected(): void {
		const command = this._currentResults[this._selectedIndex];
		if (!command) return;

		// Only push non-card commands to recents
		if (!command.id.startsWith('card:')) {
			pushRecent(command.id);
		}

		this.close();
		command.execute();
	}

	// ---------------------------------------------------------------------------
	// Rendering
	// ---------------------------------------------------------------------------

	/**
	 * Render grouped results into the listbox.
	 *
	 * @param commands - Fuzzy-matched commands (sync results)
	 * @param cards - Card search results (async, may be empty)
	 * @param recents - Recent commands (only shown on empty query)
	 */
	private _renderResults(commands: PaletteCommand[], cards: PaletteCommand[], recents?: PaletteCommand[]): void {
		if (!this._listboxEl || !this._inputEl) return;

		// Clear listbox
		this._listboxEl.innerHTML = '';

		// Build combined results list
		// Group by category in order: Recents > Views > Actions > Cards > Settings
		const groups = new Map<string, PaletteCommand[]>();

		// Add recents as their own category (empty query only)
		if (recents && recents.length > 0) {
			groups.set('Recents', recents);
		}

		// Group commands by category
		for (const cmd of commands) {
			// Skip commands already in recents to avoid duplication
			if (recents?.some((r) => r.id === cmd.id)) continue;

			const cat = cmd.category;
			if (!groups.has(cat)) {
				groups.set(cat, []);
			}
			groups.get(cat)!.push(cmd);
		}

		// Add cards
		if (cards.length > 0) {
			groups.set('Cards', cards);
		}

		// Build ordered result array
		const combined: PaletteCommand[] = [];
		for (const cat of CATEGORY_ORDER) {
			const cmds = groups.get(cat);
			if (cmds && cmds.length > 0) {
				combined.push(...cmds);
			}
		}

		this._currentResults = combined;

		// Empty state
		if (combined.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'command-palette__empty';
			empty.textContent = 'No results found';
			this._listboxEl.appendChild(empty);
			this._inputEl.setAttribute('aria-activedescendant', '');
			return;
		}

		// Clamp selected index
		if (this._selectedIndex >= combined.length) {
			this._selectedIndex = 0;
		}

		// Render grouped results with category headers
		let flatIndex = 0;
		for (const cat of CATEGORY_ORDER) {
			const cmds = groups.get(cat);
			if (!cmds || cmds.length === 0) continue;

			// Category header (non-selectable)
			const header = document.createElement('div');
			header.className = 'command-palette__category';
			header.setAttribute('role', 'presentation');
			header.textContent = cat;
			this._listboxEl.appendChild(header);

			// Options
			for (const cmd of cmds) {
				const option = document.createElement('div');
				option.className = 'command-palette__option';
				option.setAttribute('role', COMBOBOX_ATTRS.option.role);
				option.id = `palette-option-${flatIndex}`;
				option.setAttribute('aria-selected', flatIndex === this._selectedIndex ? 'true' : 'false');

				// Icon
				const icon = document.createElement('span');
				icon.className = 'command-palette__icon';
				icon.textContent = cmd.icon ?? CATEGORY_ICONS[cat] ?? '';
				option.appendChild(icon);

				// Label
				const label = document.createElement('span');
				label.className = 'command-palette__label';
				label.textContent = cmd.label;
				option.appendChild(label);

				// Keyboard shortcut hint
				if (cmd.shortcut) {
					const kbd = document.createElement('kbd');
					kbd.className = 'command-palette__kbd';
					kbd.textContent = cmd.shortcut;
					option.appendChild(kbd);
				}

				// Click handler
				const idx = flatIndex;
				option.addEventListener('click', () => {
					this._selectedIndex = idx;
					this._executeSelected();
				});

				this._listboxEl.appendChild(option);
				flatIndex++;
			}
		}

		// Update aria-activedescendant
		this._inputEl.setAttribute('aria-activedescendant', `palette-option-${this._selectedIndex}`);
	}

	/** Update aria-selected and aria-activedescendant after arrow key navigation. */
	private _updateSelection(): void {
		if (!this._listboxEl || !this._inputEl) return;

		const options = this._listboxEl.querySelectorAll('[role="option"]');
		for (let i = 0; i < options.length; i++) {
			options[i]!.setAttribute('aria-selected', i === this._selectedIndex ? 'true' : 'false');
		}

		this._inputEl.setAttribute('aria-activedescendant', `palette-option-${this._selectedIndex}`);

		// Scroll selected option into view (scrollIntoView may not exist in test environments)
		const selected = this._listboxEl.querySelector(`#palette-option-${this._selectedIndex}`);
		if (selected && typeof selected.scrollIntoView === 'function') {
			selected.scrollIntoView({ block: 'nearest' });
		}
	}
}
