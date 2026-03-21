// Isometry v5 — Phase 102 Plan 02 SuperSearchHighlight Plugin
// CSS class highlighting on matching cells.
//
// Design:
//   - Reads SearchState from SuperSearchInput (shared state object)
//   - afterRender: iterates .pv-data-cell elements in root
//   - Matching cells: add .search-match class, reset opacity
//   - Non-matching cells when search active: remove .search-match, set opacity 0.35
//   - Empty term: remove all .search-match classes and reset opacity
//   - destroy: clean up all highlights across the document
//
// Requirements: SRCH-02

import type { PluginHook, RenderContext } from './PluginTypes';
import type { SearchState } from './SuperSearchInput';

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Factory for the supersearch.highlight plugin.
 *
 * @param searchState - Shared search state from SuperSearchInput. Must be the
 *   same object reference to stay in sync with the input plugin.
 *
 * Returns a PluginHook whose:
 *   - afterRender: applies .search-match class and opacity to .pv-data-cell elements
 *   - destroy: removes all highlights and resets opacity
 */
export function createSuperSearchHighlightPlugin(searchState: SearchState): PluginHook {
	/**
	 * Clean up all highlights in a container.
	 */
	function _clearHighlights(container: ParentNode): void {
		const cells = container.querySelectorAll<HTMLElement>('.pv-data-cell');
		for (const cell of cells) {
			cell.classList.remove('search-match');
			cell.style.opacity = '';
		}
	}

	return {
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			const cells = root.querySelectorAll<HTMLElement>('.pv-data-cell');
			const term = searchState.term;

			if (!term) {
				// No active search — remove all highlights
				for (const cell of cells) {
					cell.classList.remove('search-match');
					cell.style.opacity = '';
				}
				return;
			}

			const lowerTerm = term.toLowerCase();

			for (const cell of cells) {
				const text = cell.textContent ?? '';
				if (text.toLowerCase().includes(lowerTerm)) {
					cell.classList.add('search-match');
					cell.style.opacity = '';
				} else {
					cell.classList.remove('search-match');
					cell.style.opacity = '0.35';
				}
			}
		},

		destroy(): void {
			// Clean up all highlights in the document
			_clearHighlights(document);
		},
	};
}
