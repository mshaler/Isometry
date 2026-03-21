// Isometry v5 — Phase 102 Plan 03 SuperSelectClick Plugin
// Click and Cmd+click cell selection via onPointerEvent.
//
// Design:
//   - createSelectionState(): lightweight shared state passed to all 3 SuperSelect plugins
//   - createSuperSelectClickPlugin(state, onSelectionChange): handles pointerdown on .pv-data-cell
//     - Plain click: clear selection, select clicked cell, set anchor
//     - Cmd+click (metaKey): toggle clicked cell in selection without clearing
//     - Click on non-cell: clear all selection, return false
//   - afterRender: applies .selected class + data-selected="true" to selected cells
//   - destroy: clears selectedKeys, resets anchor
//
// Requirements: SLCT-01

import type { PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

/** Shared state passed to all 3 SuperSelect plugins. */
export interface SelectionState {
	selectedKeys: Set<string>;
	anchor: { rowIdx: number; colIdx: number } | null;
	listeners: Set<() => void>;
}

/**
 * Create a fresh SelectionState instance.
 * Pass the same object to all 3 SuperSelect plugin factories.
 */
export function createSelectionState(): SelectionState {
	return { selectedKeys: new Set(), anchor: null, listeners: new Set() };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Walk up the DOM tree from event target to find the closest .pv-data-cell ancestor.
 * Returns null if not found (bounded by root.parentElement).
 */
function findDataCell(target: EventTarget | null, root: HTMLElement): HTMLElement | null {
	let el = target as HTMLElement | null;
	while (el && el !== root.parentElement) {
		if (el.classList?.contains('pv-data-cell')) {
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
 * Create the superselect.click plugin.
 *
 * @param selectionState - Shared SelectionState object. Same instance must be
 *   passed to createSuperSelectLassoPlugin and createSuperSelectKeyboardPlugin.
 * @param onSelectionChange - Callback invoked when selection changes (triggers re-render).
 */
export function createSuperSelectClickPlugin(
	selectionState: SelectionState,
	onSelectionChange: () => void,
): PluginHook {
	return {
		/**
		 * Handle pointerdown events to manage cell selection.
		 * - Click on data cell: select it (clear existing unless Cmd held)
		 * - Cmd+click: toggle cell in additive selection
		 * - Click on non-cell: clear all selection
		 */
		onPointerEvent(type: string, e: PointerEvent, ctx: RenderContext): boolean {
			if (type !== 'pointerdown') return false;

			const cell = findDataCell(e.target, ctx.rootEl);

			if (!cell) {
				// Clicked outside a data cell — clear selection
				if (selectionState.selectedKeys.size > 0) {
					selectionState.selectedKeys.clear();
					selectionState.anchor = null;
					onSelectionChange();
				}
				return false;
			}

			const key = cell.getAttribute('data-key') ?? '';
			const rowIdx = parseInt(cell.getAttribute('data-row') ?? '0', 10);
			const colIdx = parseInt(cell.getAttribute('data-col') ?? '0', 10);

			if (e.metaKey) {
				// Cmd+click: toggle this cell in additive selection
				if (selectionState.selectedKeys.has(key)) {
					selectionState.selectedKeys.delete(key);
				} else {
					selectionState.selectedKeys.add(key);
				}
			} else {
				// Plain click: clear and select only this cell
				selectionState.selectedKeys.clear();
				selectionState.selectedKeys.add(key);
			}

			selectionState.anchor = { rowIdx, colIdx };
			onSelectionChange();
			return true;
		},

		/**
		 * Apply or remove .selected class and data-selected attribute to all data cells
		 * based on current selectedKeys set.
		 */
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			const cells = root.querySelectorAll<HTMLElement>('.pv-data-cell');
			for (const cell of cells) {
				const key = cell.getAttribute('data-key') ?? '';
				if (selectionState.selectedKeys.has(key)) {
					cell.classList.add('selected');
					cell.setAttribute('data-selected', 'true');
				} else {
					cell.classList.remove('selected');
					cell.removeAttribute('data-selected');
				}
			}
		},

		/**
		 * Clear selection state when plugin is disabled or grid is destroyed.
		 */
		destroy(): void {
			selectionState.selectedKeys.clear();
			selectionState.anchor = null;
		},
	};
}
