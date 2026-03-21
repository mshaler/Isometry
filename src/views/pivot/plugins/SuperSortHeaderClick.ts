// Isometry v5 — Phase 100 Plan 02 SuperSortHeaderClick Plugin
// Header-click single-column sort with asc/desc/null cycle.
//
// Design:
//   - Internal state: _sortState tracks { colIdx, direction } | null
//   - onPointerEvent: handles pointerdown on .pv-col-span--leaf (non-shift)
//     Reads data-col-start (1-based) → converts to 0-based colIdx
//     Cycles: none → asc → desc → none
//   - transformData: groups cells by rowIdx, sorts groups by the value at _sortState.colIdx
//     Nulls sort to end in both directions. Reassigns rowIdx sequentially.
//   - afterRender: updates DOM with ↑/↓ arrow indicators and sorted-asc/desc classes
//   - destroy: resets sortState to null
//
// Requirements: SORT-01

import type { CellPlacement, PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortDirection = 'asc' | 'desc';
export type SortState = { colIdx: number; direction: SortDirection } | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the closest .pv-col-span--leaf ancestor of the event target.
 * Returns null if not found (bounded by root).
 */
function findLeafHeader(target: EventTarget | null): HTMLElement | null {
	let el = target as HTMLElement | null;
	while (el) {
		if (el.classList?.contains('pv-col-span--leaf')) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}

/**
 * Read the colIdx from a leaf header element.
 * data-col-start is 1-based → convert to 0-based.
 */
function getColIdx(el: HTMLElement): number {
	const colStart = el.getAttribute('data-col-start');
	if (colStart == null) return -1;
	return parseInt(colStart, 10) - 1;
}

/**
 * Cycle sort direction: null → 'asc' → 'desc' → null
 */
function cycleDirection(current: SortDirection | null): SortDirection | null {
	if (current === null) return 'asc';
	if (current === 'asc') return 'desc';
	return null;
}

/**
 * Null-safe comparator: nulls always sort to end regardless of direction.
 */
function compareValues(a: number | null, b: number | null, direction: SortDirection): number {
	if (a === null && b === null) return 0;
	if (a === null) return 1; // nulls to end
	if (b === null) return -1;
	return direction === 'asc' ? a - b : b - a;
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the supersort.header-click plugin.
 *
 * @param sharedSort - Optional shared state for reading from chain plugin.
 *   If provided, plugin reads/writes state through sharedSort.state.
 *   If omitted, plugin manages its own internal state.
 */
export function createSuperSortHeaderClickPlugin(
	sharedSort?: { state: SortState; onSort?: () => void },
): PluginHook {
	// Internal state — used when sharedSort is not provided
	let _sortState: SortState = null;

	function getState(): SortState {
		return sharedSort ? sharedSort.state : _sortState;
	}

	function setState(s: SortState): void {
		if (sharedSort) {
			sharedSort.state = s;
			sharedSort.onSort?.();
		} else {
			_sortState = s;
		}
	}

	return {
		/**
		 * Handle pointerdown on .pv-col-span--leaf elements.
		 * Shift+click is delegated to the chain plugin.
		 */
		onPointerEvent(type: string, e: PointerEvent, _ctx: RenderContext): boolean {
			if (type !== 'pointerdown') return false;
			// Shift+click → chain plugin handles it
			if (e.shiftKey) return false;

			const leaf = findLeafHeader(e.target);
			if (!leaf) return false;

			const colIdx = getColIdx(leaf);
			if (colIdx < 0) return false;

			const current = getState();
			if (current && current.colIdx === colIdx) {
				// Cycle on same column
				const next = cycleDirection(current.direction);
				setState(next === null ? null : { colIdx, direction: next });
			} else {
				// New column → set to asc
				setState({ colIdx, direction: 'asc' });
			}

			return true;
		},

		/**
		 * Sort cells by value at _sortState.colIdx.
		 * Groups by rowIdx, sorts groups, reassigns rowIdx sequentially.
		 */
		transformData(cells: CellPlacement[], _ctx: RenderContext): CellPlacement[] {
			const state = getState();
			if (state === null) return cells;

			// Group cells by rowIdx
			const rowMap = new Map<number, CellPlacement[]>();
			for (const cell of cells) {
				if (!rowMap.has(cell.rowIdx)) rowMap.set(cell.rowIdx, []);
				rowMap.get(cell.rowIdx)!.push(cell);
			}

			// Get the value at state.colIdx for each row
			function getRowSortValue(rowCells: CellPlacement[]): number | null {
				const cell = rowCells.find((c) => c.colIdx === state!.colIdx);
				return cell?.value ?? null;
			}

			// Sort the rows
			const sortedRows = [...rowMap.values()].sort((a, b) =>
				compareValues(getRowSortValue(a), getRowSortValue(b), state.direction),
			);

			// Reassign rowIdx sequentially
			const result: CellPlacement[] = [];
			for (let newRowIdx = 0; newRowIdx < sortedRows.length; newRowIdx++) {
				for (const cell of sortedRows[newRowIdx]) {
					result.push({ ...cell, rowIdx: newRowIdx });
				}
			}
			return result;
		},

		/**
		 * Update DOM with sort indicator arrows and classes.
		 */
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			const state = getState();
			const leaves = root.querySelectorAll<HTMLElement>('.pv-col-span--leaf');

			for (const leaf of leaves) {
				// Remove existing arrow
				leaf.querySelector('.pv-sort-arrow')?.remove();
				// Remove sorted classes
				leaf.classList.remove('pv-col-span--sorted-asc', 'pv-col-span--sorted-desc');

				if (state !== null) {
					const colIdx = getColIdx(leaf);
					if (colIdx === state.colIdx) {
						leaf.classList.add(
							state.direction === 'asc'
								? 'pv-col-span--sorted-asc'
								: 'pv-col-span--sorted-desc',
						);
						const arrow = document.createElement('span');
						arrow.className = 'pv-sort-arrow';
						arrow.textContent = state.direction === 'asc' ? '↑' : '↓';
						leaf.appendChild(arrow);
					}
				}
			}
		},

		/**
		 * Reset sort state when plugin is disabled or grid destroyed.
		 */
		destroy(): void {
			setState(null);
		},
	};
}
