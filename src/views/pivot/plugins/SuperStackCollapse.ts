// Isometry v5 — Phase 99 Plan 02 SuperStackCollapse Plugin
// Click-to-collapse on pivot header cells with chevron indicators.
//
// Design:
//   - Uses shared SuperStackState (collapsedSet) passed from HarnessShell
//   - afterRender: scans overlay for collapsible headers, wires data-collapse-key,
//     updates chevron glyphs and pv-col-span--collapsed class
//   - onPointerEvent: handles pointerdown on collapsible headers, toggles collapsedSet,
//     calls onCollapseToggle() to trigger full re-render
//   - destroy: clears collapsedSet (state resets on plugin disable/re-enable)
//
// Collapse key format: "${level}\x1f${parentPath}\x1f${value}"
//   parentPath = \x1f-joined ancestor values at levels 0..(level-1); "" for level 0
//
// Requirements: SSP-07, SSP-08, SSP-09

import type { PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Shared state type
// ---------------------------------------------------------------------------

/** Shared state object passed to both spanning and collapse plugins. */
export interface SuperStackState {
	collapsedSet: Set<string>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a collapse key from data-level and data-parent-path attributes on a header element.
 *
 * Key format: "${level}\x1f${parentPath}\x1f${value}"
 * This matches the format used in buildHeaderCells in SuperStackSpans.ts.
 */
function buildCollapseKey(level: string, parentPath: string, value: string): string {
	return `${level}\x1f${parentPath}\x1f${value}`;
}

/**
 * Extract plain text value from a header element, stripping existing chevron/count children.
 * The header may contain: chevron span, text node with value, count span.
 * We want just the value text.
 */
function getHeaderValue(el: HTMLElement): string {
	// Walk child nodes: skip pv-span-chevron and pv-span-count elements
	let value = '';
	for (const node of el.childNodes) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent?.trim();
			if (text) value += text;
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const child = node as Element;
			if (!child.classList.contains('pv-span-chevron') && !child.classList.contains('pv-span-count')) {
				const text = child.textContent?.trim();
				if (text) value += text;
			}
		}
	}
	return value.trim();
}

/**
 * Walk up the DOM tree from the event target to find a collapsible header element.
 * Returns null if no collapsible ancestor found (bounded by root).
 */
function findCollapsibleAncestor(target: EventTarget | null, root?: Element): HTMLElement | null {
	let el = target as HTMLElement | null;
	while (el && el !== root?.parentElement) {
		if (el.classList?.contains('pv-col-span--collapsible') || el.classList?.contains('pv-row-span--collapsible')) {
			return el;
		}
		// Check by data-collapse-key presence
		if (el.hasAttribute?.('data-collapse-key')) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the superstack.collapse plugin.
 *
 * @param state - Shared SuperStackState object containing the collapsedSet.
 *   Must be the same object passed to createSuperStackSpansPlugin.
 * @param onCollapseToggle - Callback to trigger full PivotGrid re-render when collapse state changes.
 */
export function createSuperStackCollapsePlugin(state: SuperStackState, onCollapseToggle: () => void): PluginHook {
	let _hasEverCollapsed = false;

	return {
		/**
		 * afterRender: scan the overlay for collapsible header divs and:
		 * 1. Compute and set data-collapse-key if not already set
		 * 2. Update chevron glyph based on collapsed state
		 * 3. Add/remove pv-col-span--collapsed / pv-row-span--collapsed class
		 * 4. Add count suffix for collapsed groups
		 *
		 * Note: SuperStackSpans.ts already renders chevrons/counts when collapsedSet is
		 * populated. This afterRender hook updates the DOM for headers that may have been
		 * rendered by the base PivotGrid overlay (without collapse awareness).
		 */
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			// Process column header spans
			const colHeaders = root.querySelectorAll<HTMLElement>('.pv-col-span--collapsible');
			for (const header of colHeaders) {
				_processHeader(header, state);
			}

			// Process row header spans
			const rowHeaders = root.querySelectorAll<HTMLElement>('.pv-row-span--collapsible');
			for (const header of rowHeaders) {
				_processHeader(header, state);
			}

			// VPOL-01: once any collapse has occurred, set data-collapse-active on root
			// so CSS can make all chevrons permanently visible
			if (_hasEverCollapsed) {
				root.setAttribute('data-collapse-active', '');
			}
		},

		/**
		 * onPointerEvent: handle pointerdown on collapsible header cells.
		 * Walks up the DOM tree from the click target to find the header.
		 * Toggles collapse state and calls onCollapseToggle() to trigger re-render.
		 * Returns true to consume the event; false otherwise.
		 */
		onPointerEvent(type: string, e: PointerEvent, _ctx: RenderContext): boolean {
			if (type !== 'pointerdown') return false;

			const header = findCollapsibleAncestor(e.target);
			if (!header) return false;

			const key = header.getAttribute('data-collapse-key');
			if (!key) return false;

			// Toggle collapse state
			if (state.collapsedSet.has(key)) {
				state.collapsedSet.delete(key);
			} else {
				state.collapsedSet.add(key);
			}

			// VPOL-01: mark that at least one collapse toggle has occurred
			_hasEverCollapsed = true;

			onCollapseToggle();
			return true;
		},

		/**
		 * destroy: clear collapsedSet and reset _hasEverCollapsed so state resets when plugin is disabled/re-enabled.
		 */
		destroy(): void {
			state.collapsedSet.clear();
			_hasEverCollapsed = false;
		},
	};
}

// ---------------------------------------------------------------------------
// Internal: process a single header element
// ---------------------------------------------------------------------------

function _processHeader(header: HTMLElement, state: SuperStackState): void {
	// If data-collapse-key not yet set, compute it from data-level + data-parent-path + value
	let collapseKey = header.getAttribute('data-collapse-key');

	if (!collapseKey) {
		const level = header.getAttribute('data-level') ?? '0';
		const parentPath = header.getAttribute('data-parent-path') ?? '';
		const value = getHeaderValue(header);
		if (!value) return; // Cannot build key without a value
		collapseKey = buildCollapseKey(level, parentPath, value);
		header.setAttribute('data-collapse-key', collapseKey);
	}

	const isCollapsed = state.collapsedSet.has(collapseKey);

	// Update collapsed class
	const isColSpan = header.classList.contains('pv-col-span--collapsible');
	const collapsedClass = isColSpan ? 'pv-col-span--collapsed' : 'pv-row-span--collapsed';

	if (isCollapsed) {
		header.classList.add(collapsedClass);
	} else {
		header.classList.remove(collapsedClass);
	}

	// Update or insert chevron span
	let chevron = header.querySelector<HTMLElement>('.pv-span-chevron');
	if (!chevron) {
		chevron = document.createElement('span');
		chevron.className = 'pv-span-chevron';
		header.insertBefore(chevron, header.firstChild);
	}
	chevron.textContent = isCollapsed ? '▶' : '▼';

	// Ensure pv-span-count is present/absent based on collapsed state
	const countEl = header.querySelector<HTMLElement>('.pv-span-count');
	if (isCollapsed && !countEl) {
		// SuperStackSpans already adds count — only add if missing
		// Count = number of leaf children hidden (we use colSpan from the spanning output)
		// For base overlay (non-spanning plugin), we don't know the count, so omit
		// The spanning plugin handles count in its own afterRender
	} else if (!isCollapsed && countEl) {
		countEl.remove();
	}
}
