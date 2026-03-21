// Isometry v5 — Phase 102 Plan 02 SuperSearchInput Plugin
// Search input in toolbar with debounced transformData filtering.
//
// Design:
//   - SearchState: shared state between input and highlight plugins
//   - createSuperSearchInputPlugin: factory that creates toolbar input + filtering
//   - transformData filters CellPlacement[] to cells whose key contains the search term
//   - afterRender creates .pv-search-toolbar with input[type="search"] and clear button
//   - Input events are debounced 300ms to avoid excessive re-renders
//   - Shared SearchState allows highlight plugin to read the current term
//
// Requirements: SRCH-01

import type { CellPlacement, PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// SearchState
// ---------------------------------------------------------------------------

/** Shared state between SuperSearchInput and SuperSearchHighlight plugins. */
export interface SearchState {
	term: string;
	listeners: Set<(term: string) => void>;
}

/**
 * Create a fresh SearchState with empty term.
 * Pass the same instance to both createSuperSearchInputPlugin and
 * createSuperSearchHighlightPlugin to keep them in sync.
 */
export function createSearchState(): SearchState {
	return { term: '', listeners: new Set() };
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Factory for the supersearch.input plugin.
 *
 * @param searchState - Shared search state (same object reference as highlight plugin).
 * @param onSearchChange - Called after debounce fires to trigger re-render.
 *
 * Returns a PluginHook whose:
 *   - transformData: filters CellPlacement[] by key (case-insensitive) when term is non-empty
 *   - afterRender: mounts .pv-search-toolbar with input + clear button into .pv-toolbar
 *   - destroy: removes .pv-search-toolbar from DOM and cancels any pending debounce
 */
export function createSuperSearchInputPlugin(
	searchState: SearchState,
	onSearchChange: () => void,
): PluginHook {
	let _container: HTMLElement | null = null;
	let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

	return {
		transformData(cells: CellPlacement[], _ctx: RenderContext): CellPlacement[] {
			if (!searchState.term) {
				return cells;
			}
			const lowerTerm = searchState.term.toLowerCase();
			return cells.filter((cell) => cell.key.toLowerCase().includes(lowerTerm));
		},

		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			// Find the pivot toolbar
			const toolbar = root.querySelector('.pv-toolbar');
			if (!toolbar) return;

			// Idempotent: if already mounted, skip
			if (toolbar.querySelector('.pv-search-toolbar')) return;

			// Create search toolbar container
			_container = document.createElement('div');
			_container.className = 'pv-search-toolbar';

			// Search input
			const input = document.createElement('input');
			input.type = 'search';
			input.className = 'pv-search-input';
			input.placeholder = 'Search cells...';
			input.value = searchState.term;
			input.setAttribute('aria-label', 'Search cells');

			// Clear button
			const clearBtn = document.createElement('button');
			clearBtn.className = 'pv-search-clear';
			clearBtn.textContent = '✕';
			clearBtn.setAttribute('aria-label', 'Clear search');
			clearBtn.style.display = searchState.term ? '' : 'none';

			// Debounced input handler
			input.addEventListener('input', () => {
				// Show/hide clear button immediately
				clearBtn.style.display = input.value ? '' : 'none';

				// Cancel previous debounce
				if (_debounceTimer !== null) {
					clearTimeout(_debounceTimer);
				}
				_debounceTimer = setTimeout(() => {
					_debounceTimer = null;
					searchState.term = input.value;
					// Notify listeners
					for (const listener of searchState.listeners) {
						listener(searchState.term);
					}
					onSearchChange();
				}, 300);
			});

			// Clear button handler
			clearBtn.addEventListener('click', () => {
				if (_debounceTimer !== null) {
					clearTimeout(_debounceTimer);
					_debounceTimer = null;
				}
				input.value = '';
				clearBtn.style.display = 'none';
				searchState.term = '';
				for (const listener of searchState.listeners) {
					listener('');
				}
				onSearchChange();
			});

			_container.appendChild(input);
			_container.appendChild(clearBtn);
			toolbar.appendChild(_container);
		},

		destroy(): void {
			// Cancel pending debounce
			if (_debounceTimer !== null) {
				clearTimeout(_debounceTimer);
				_debounceTimer = null;
			}
			// Remove toolbar from DOM
			if (_container?.parentElement) {
				_container.parentElement.removeChild(_container);
			}
			_container = null;
		},
	};
}
