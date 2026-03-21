// Isometry v5 — Phase 100 Plan 02 SuperScrollVirtual Plugin
// Virtual scrolling data windowing for pivot table rows.
//
// Design:
//   - Ports getVisibleRange logic from SuperGridVirtualizer.ts
//   - SCROLL_BUFFER = 2 rows above/below viewport (lighter than SuperGrid's OVERSCAN_ROWS=5)
//   - VIRTUALIZATION_THRESHOLD = 100 rows (matches SuperGridVirtualizer)
//   - transformData: counts unique rowIdx values; if > threshold, filters to visible range
//   - afterRender: manages top/bottom sentinel spacer divs for accurate scroll sizing
//   - onScroll: compares new range to _lastRange; re-render only when range changes
//   - destroy: removes sentinel elements, resets state
//
// Requirements: SCRL-01

import type { CellPlacement, PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Extra rows rendered above and below the viewport to prevent flicker. */
export const SCROLL_BUFFER = 2;

/** Row count above which JS virtualization activates. */
export const VIRTUALIZATION_THRESHOLD = 100;

/** Default row height in pixels (matches DEFAULT_CELL_HEIGHT in PivotGrid.ts). */
const DEFAULT_ROW_HEIGHT = 32;

/** Default container height fallback when DOM measurement is unavailable. */
const DEFAULT_CONTAINER_HEIGHT = 600;

// ---------------------------------------------------------------------------
// Pure function — exported for testing
// ---------------------------------------------------------------------------

/**
 * Compute the visible row window for pivot virtual scrolling.
 *
 * Ported from SuperGridVirtualizer.getVisibleRange() with SCROLL_BUFFER instead of OVERSCAN_ROWS.
 *
 * @param scrollTop - Current scroll offset in pixels
 * @param rowHeight - Height of each row in pixels
 * @param containerHeight - Height of the scroll viewport in pixels
 * @param totalRows - Total number of rows in the dataset
 * @returns { startRow, endRow } — inclusive start, exclusive end
 */
export function getVisibleRange(
	scrollTop: number,
	rowHeight: number,
	containerHeight: number,
	totalRows: number,
): { startRow: number; endRow: number } {
	const firstVisible = Math.floor(scrollTop / rowHeight);
	const lastVisible = Math.ceil((scrollTop + containerHeight) / rowHeight);
	const startRow = Math.max(0, firstVisible - SCROLL_BUFFER);
	const endRow = Math.min(totalRows, lastVisible + SCROLL_BUFFER);
	return { startRow, endRow };
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the superscroll.virtual plugin.
 * Applies data windowing to CellPlacement[] when totalRows > VIRTUALIZATION_THRESHOLD.
 */
export function createSuperScrollVirtualPlugin(): PluginHook {
	let _lastRange: { startRow: number; endRow: number } | null = null;
	let _totalRows = 0;

	function computeRange(ctx: RenderContext, rowCount: number): { startRow: number; endRow: number } {
		// Try to get row height from the layout extension (cast — PivotGrid extends RenderContext)
		const layout = (ctx as unknown as { layout?: { cellHeight?: number } }).layout;
		const rowHeight = layout?.cellHeight ?? DEFAULT_ROW_HEIGHT;

		// Try to get container height from DOM
		const scrollContainer = ctx.rootEl?.closest?.('.pv-scroll-container') as HTMLElement | null;
		const containerHeight = scrollContainer?.clientHeight ?? DEFAULT_CONTAINER_HEIGHT;

		return getVisibleRange(ctx.scrollTop, rowHeight, containerHeight, rowCount);
	}

	return {
		/**
		 * Filter cells to visible row range when totalRows > VIRTUALIZATION_THRESHOLD.
		 * Returns the same cells reference when virtualization is inactive.
		 */
		transformData(cells: CellPlacement[], ctx: RenderContext): CellPlacement[] {
			// Count unique row indices
			const rowSet = new Set<number>();
			for (const cell of cells) rowSet.add(cell.rowIdx);
			const totalRows = rowSet.size;
			_totalRows = totalRows;

			// Bypass virtualization for small datasets
			if (totalRows <= VIRTUALIZATION_THRESHOLD) return cells;

			const range = computeRange(ctx, totalRows);
			_lastRange = range;

			// Filter to visible range [startRow, endRow)
			return cells.filter((c) => c.rowIdx >= range.startRow && c.rowIdx < range.endRow);
		},

		/**
		 * Insert or update spacer sentinel divs to maintain accurate scroll dimensions.
		 * Top sentinel = height of hidden rows above viewport.
		 * Bottom sentinel = height of hidden rows below viewport.
		 */
		afterRender(root: HTMLElement, ctx: RenderContext): void {
			if (!_lastRange || _totalRows <= VIRTUALIZATION_THRESHOLD) return;

			// Get or create the scroll container
			const scrollContainer = root.closest?.('.pv-scroll-container') as HTMLElement | null;
			if (!scrollContainer) return;

			const layout = (ctx as unknown as { layout?: { cellHeight?: number } }).layout;
			const rowHeight = layout?.cellHeight ?? DEFAULT_ROW_HEIGHT;

			const topHeight = _lastRange.startRow * rowHeight;
			const bottomHeight = (_totalRows - _lastRange.endRow) * rowHeight;

			// Upsert top sentinel
			let topSentinel = scrollContainer.querySelector<HTMLElement>('.pv-scroll-sentinel-top');
			if (!topSentinel) {
				topSentinel = document.createElement('div');
				topSentinel.className = 'pv-scroll-sentinel-top';
				scrollContainer.prepend(topSentinel);
			}
			topSentinel.style.height = `${topHeight}px`;

			// Upsert bottom sentinel
			let bottomSentinel = scrollContainer.querySelector<HTMLElement>(
				'.pv-scroll-sentinel-bottom',
			);
			if (!bottomSentinel) {
				bottomSentinel = document.createElement('div');
				bottomSentinel.className = 'pv-scroll-sentinel-bottom';
				scrollContainer.append(bottomSentinel);
			}
			bottomSentinel.style.height = `${bottomHeight}px`;
		},

		/**
		 * Track scroll changes — update range if viewport moved to new rows.
		 * Stores range for next transformData call; does not trigger re-render directly.
		 */
		onScroll(_scrollLeft: number, scrollTop: number, ctx: RenderContext): void {
			if (_totalRows <= VIRTUALIZATION_THRESHOLD) return;

			const newRange = computeRange({ ...ctx, scrollTop }, _totalRows);
			_lastRange = newRange;
		},

		/**
		 * Remove sentinel elements and reset internal state.
		 */
		destroy(): void {
			_lastRange = null;
			_totalRows = 0;
			// Note: sentinel elements live in the scroll container — they will be cleaned up
			// when PivotGrid.destroy() removes the entire DOM tree. No need to track the
			// scroll container reference here to avoid memory leaks.
		},
	};
}
