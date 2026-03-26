// Isometry v5 — Phase 100 Plan 02 SuperSortChain Plugin
// Multi-column chain sort via Shift+click with priority indicators.
//
// Design:
//   - Internal state: _chain holds up to 3 { colIdx, direction } entries
//   - onPointerEvent: only responds to Shift+click on .pv-col-span--leaf
//     If colIdx already in chain: cycle direction (asc → desc → remove)
//     Else: push new { colIdx, direction: 'asc' }
//     If chain.length > 3: shift() to remove oldest
//   - transformData: groups cells by rowIdx, applies multi-key sort in chain order
//     Nulls always sort to end. Reassigns rowIdx sequentially.
//   - afterRender: appends ↑/↓ arrows and priority numbers (1-based) to chain headers
//   - destroy: clears the chain
//
// Requirements: SORT-02

import type { CellPlacement, PluginHook, RenderContext } from './PluginTypes';
import type { SortDirection } from './SuperSortHeaderClick';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHAIN = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the closest .pv-col-span--leaf ancestor of the event target.
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
 * Null-safe comparator: nulls always sort to end.
 */
function compareValues(a: number | null, b: number | null, direction: SortDirection): number {
	if (a === null && b === null) return 0;
	if (a === null) return 1;
	if (b === null) return -1;
	return direction === 'asc' ? a - b : b - a;
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the supersort.chain plugin.
 * Adds multi-column sort capability via Shift+click.
 * Works alongside SuperSortHeaderClick (which handles non-shift clicks).
 */
export function createSuperSortChainPlugin(): PluginHook {
	// Chain of sort keys in priority order (index 0 = highest priority)
	const _chain: Array<{ colIdx: number; direction: SortDirection }> = [];

	return {
		/**
		 * Handle Shift+pointerdown on .pv-col-span--leaf elements.
		 * Non-shift clicks are ignored (handled by SuperSortHeaderClick).
		 */
		onPointerEvent(type: string, e: PointerEvent, _ctx: RenderContext): boolean {
			if (type !== 'pointerdown') return false;
			if (!e.shiftKey) return false;

			const leaf = findLeafHeader(e.target);
			if (!leaf) return false;

			const colIdx = getColIdx(leaf);
			if (colIdx < 0) return false;

			const existingIdx = _chain.findIndex((entry) => entry.colIdx === colIdx);

			if (existingIdx >= 0) {
				// Cycle direction on existing: asc → desc → remove
				const entry = _chain[existingIdx]!;
				if (entry.direction === 'asc') {
					_chain[existingIdx] = { colIdx, direction: 'desc' };
				} else {
					// desc → remove
					_chain.splice(existingIdx, 1);
				}
			} else {
				// Add new entry
				_chain.push({ colIdx, direction: 'asc' });
				// Enforce max chain size
				if (_chain.length > MAX_CHAIN) {
					_chain.shift(); // remove oldest (first) entry
				}
			}

			return true;
		},

		/**
		 * Apply multi-key sort to cells.
		 * Groups by rowIdx, sorts using chain entries in priority order.
		 * Nulls sort to end. Reassigns rowIdx sequentially.
		 */
		transformData(cells: CellPlacement[], _ctx: RenderContext): CellPlacement[] {
			if (_chain.length === 0) return cells;

			// Group cells by rowIdx
			const rowMap = new Map<number, CellPlacement[]>();
			for (const cell of cells) {
				if (!rowMap.has(cell.rowIdx)) rowMap.set(cell.rowIdx, []);
				rowMap.get(cell.rowIdx)!.push(cell);
			}

			/**
			 * Get the value at a specific colIdx for a row's cells.
			 */
			function getRowValue(rowCells: CellPlacement[], colIdx: number): number | null {
				const cell = rowCells.find((c) => c.colIdx === colIdx);
				return cell?.value ?? null;
			}

			// Sort rows using chain as a multi-key comparator
			const sortedRows = [...rowMap.values()].sort((a, b) => {
				for (const { colIdx, direction } of _chain) {
					const cmp = compareValues(getRowValue(a, colIdx), getRowValue(b, colIdx), direction);
					if (cmp !== 0) return cmp;
				}
				return 0; // stable tie
			});

			// Reassign rowIdx sequentially
			const result: CellPlacement[] = [];
			for (let newRowIdx = 0; newRowIdx < sortedRows.length; newRowIdx++) {
				for (const cell of sortedRows[newRowIdx]!) {
					result.push({ ...cell, rowIdx: newRowIdx });
				}
			}
			return result;
		},

		/**
		 * Update DOM with chain sort indicators.
		 * Each chain entry gets an arrow (↑/↓) and a priority number (1-based).
		 */
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			const allLeaves = root.querySelectorAll<HTMLElement>('.pv-col-span--leaf');

			// First pass: clean up existing chain indicators from all leaf headers.
			// Only clean up if chain has entries (to avoid clobbering header-click arrows
			// when chain is empty and supersort.header-click has set its own indicators).
			if (_chain.length > 0) {
				for (const leaf of allLeaves) {
					leaf.querySelector('.pv-sort-arrow')?.remove();
					leaf.querySelector('.pv-sort-priority')?.remove();
					leaf.classList.remove('pv-col-span--sorted-asc', 'pv-col-span--sorted-desc');
				}
			}

			// Second pass: add indicators for each chain entry
			for (let priority = 0; priority < _chain.length; priority++) {
				const { colIdx, direction } = _chain[priority]!;

				for (const leaf of allLeaves) {
					if (getColIdx(leaf) === colIdx) {
						leaf.classList.add(direction === 'asc' ? 'pv-col-span--sorted-asc' : 'pv-col-span--sorted-desc');

						const arrow = document.createElement('span');
						arrow.className = 'pv-sort-arrow';
						arrow.textContent = direction === 'asc' ? '↑' : '↓';
						leaf.appendChild(arrow);

						const priorityEl = document.createElement('span');
						priorityEl.className = 'pv-sort-priority';
						priorityEl.textContent = String(priority + 1); // 1-based
						leaf.appendChild(priorityEl);
					}
				}
			}
		},

		/**
		 * Clear the chain when plugin is disabled or grid destroyed.
		 */
		destroy(): void {
			_chain.length = 0;
		},
	};
}
