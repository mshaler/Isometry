// Phase 38 Plan 01 — SuperGridVirtualizer (VSCR-01..VSCR-04)
//
// Pure computation module for row-level virtual scrolling.
// Computes visible row range from scrollTop, rowHeight, and viewport.
// Mirrors SuperGridSizer/SuperZoom attach/detach lifecycle pattern.
//
// Two-layer strategy:
//   Layer 1 (CSS): content-visibility: auto on .data-cell (progressive enhancement)
//   Layer 2 (JS):  This module — row windowing when leafRows > VIRTUALIZATION_THRESHOLD
//
// The virtualizer does NOT touch DOM. It only computes { startRow, endRow }.
// SuperGrid._renderCells() uses this range to slice data before D3 join.

/** Row count above which JS virtualization activates. Below this, only CSS
 *  content-visibility: auto provides rendering optimization. */
export const VIRTUALIZATION_THRESHOLD = 100;

/** Extra rows rendered above and below the viewport to prevent flicker. */
export const OVERSCAN_ROWS = 5;

/**
 * Computes the visible row window for SuperGrid virtual scrolling.
 *
 * Lifecycle:
 *   - Constructed with callback for dynamic row height (zoom-aware)
 *   - attach(rootEl) — stores the scroll container reference
 *   - setTotalRows(n) — called on every _renderCells() with leaf row count
 *   - getVisibleRange() — returns { startRow, endRow } for data slicing
 *   - detach() — cleanup, resets state
 */
export class SuperGridVirtualizer {
	private _rootEl: HTMLElement | null = null;
	private _totalRows = 0;
	private readonly _getRowHeight: () => number;
	private readonly _getColHeaderHeight: () => number;

	constructor(getRowHeight: () => number, getColHeaderHeight: () => number) {
		this._getRowHeight = getRowHeight;
		this._getColHeaderHeight = getColHeaderHeight;
	}

	/** Attach to the scroll container (rootEl with overflow: auto). */
	attach(rootEl: HTMLElement): void {
		this._rootEl = rootEl;
	}

	/** Detach from scroll container, reset state. */
	detach(): void {
		this._rootEl = null;
		this._totalRows = 0;
	}

	/** Update total leaf row count (called on every render). */
	setTotalRows(count: number): void {
		this._totalRows = count;
	}

	/** Returns true when row count exceeds threshold and JS windowing is active. */
	isActive(): boolean {
		return this._totalRows > VIRTUALIZATION_THRESHOLD;
	}

	/**
	 * Compute the visible row range from current scroll position.
	 *
	 * When not active or no rootEl: returns { 0, totalRows } (render all).
	 * When active: returns { startRow, endRow } with OVERSCAN_ROWS buffer.
	 * Row height is read dynamically on every call (handles zoom changes).
	 */
	getVisibleRange(): { startRow: number; endRow: number } {
		if (!this._rootEl || !this.isActive()) {
			return { startRow: 0, endRow: this._totalRows };
		}

		const scrollTop = this._rootEl.scrollTop;
		const viewportHeight = this._rootEl.clientHeight;
		const rowHeight = this._getRowHeight();

		// Adjust scrollTop by column header height (headers are above data rows)
		const colHeaderHeight = this._getColHeaderHeight();
		const adjustedScrollTop = Math.max(0, scrollTop - colHeaderHeight);

		const firstVisible = Math.floor(adjustedScrollTop / rowHeight);
		const lastVisible = Math.ceil((adjustedScrollTop + viewportHeight) / rowHeight);

		const endRow = Math.min(this._totalRows, lastVisible + OVERSCAN_ROWS);
		const startRow = Math.min(Math.max(0, firstVisible - OVERSCAN_ROWS), endRow);

		return { startRow, endRow };
	}

	/** Total virtual height for sentinel spacer (zoom-aware via callback). */
	getTotalHeight(): number {
		return this._totalRows * this._getRowHeight();
	}
}
