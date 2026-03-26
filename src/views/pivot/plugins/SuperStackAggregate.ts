// Isometry v5 — Phase 99 Plan 02 SuperStackAggregate Plugin
// SUM aggregation display for collapsed group data cells.
//
// Design:
//   - Uses shared SuperStackState (collapsedSet) passed from HarnessShell
//   - afterRender: for each collapsed column/row group, finds data cells
//     in the collapsed column and overwrites their text with SUM from ctx.data
//   - Applies pv-agg-cell CSS class (accent-light background + 3px accent left border)
//   - Null values treated as 0 in SUM
//
// Cell finding strategy (afterRender):
//   A. Scan overlay for collapsed headers with data-collapse-key + data-col-start + data-col-span
//   B. For each row in ctx.visibleRows, compute SUM from ctx.data across hidden child col paths
//   C. Apply pv-agg-cell to matching table cells (Layer 1) via parent document traversal
//   D. Also handle cells pre-marked with data-agg-col attribute (for testability)
//
// Requirements: SSP-10, SSP-11

import type { PluginHook, RenderContext } from './PluginTypes';
import type { SuperStackState } from './SuperStackCollapse';

// ---------------------------------------------------------------------------
// CSS class constant
// ---------------------------------------------------------------------------

/** CSS class applied to aggregated cells (accent-light background + 3px accent left border). */
const AGG_CELL_CLASS = 'pv-agg-cell';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute SUM of values, treating null as 0.
 */
function sum(values: (number | null)[]): number {
	return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the superstack.aggregate plugin.
 *
 * @param state - Shared SuperStackState containing collapsedSet.
 *   Must be the same object used by superstack.spanning and superstack.collapse.
 */
export function createSuperStackAggregatePlugin(state: SuperStackState): PluginHook {
	return {
		/**
		 * afterRender: apply SUM aggregation and pv-agg-cell class to data cells
		 * in collapsed column/row groups.
		 *
		 * Two-pass approach:
		 * Pass A: Handle cells pre-marked with data-agg-col (testability + harness use).
		 * Pass B: Handle cells found via overlay collapsed header metadata (full runtime flow).
		 */
		afterRender(root: HTMLElement, ctx: RenderContext): void {
			// Clean up stale aggregate styling from previous renders.
			// When a group is expanded, cells must lose pv-agg-cell and restore original values.
			const tableContainer = root.parentElement;
			if (tableContainer) {
				const staleAggCells = tableContainer.querySelectorAll<HTMLElement>(`.${AGG_CELL_CLASS}`);
				for (const cell of staleAggCells) {
					cell.classList.remove(AGG_CELL_CLASS);
				}
			}

			// Fast path: nothing collapsed
			if (state.collapsedSet.size === 0) {
				return;
			}

			// Pass A: Find cells pre-marked with data-agg-col matching a collapse key
			// This handles the test harness case and any code that pre-marks cells.
			const markedCells = root.querySelectorAll<HTMLElement>('[data-agg-col]');
			for (const cell of markedCells) {
				const aggCol = cell.getAttribute('data-agg-col');
				if (aggCol && state.collapsedSet.has(aggCol)) {
					cell.classList.add(AGG_CELL_CLASS);
				}
			}

			// Pass B: Full runtime flow — find collapsed column headers in overlay,
			// then locate corresponding data cells in the Layer 1 table via document traversal.
			//
			// Only runs if ctx.visibleRows/visibleCols are populated (real render context).
			if (ctx.visibleRows.length === 0 || ctx.visibleCols.length === 0) return;

			// Find all collapsed column headers in the overlay
			const collapsedColHeaders = root.querySelectorAll<HTMLElement>('.pv-col-span--collapsed[data-collapse-key]');

			if (collapsedColHeaders.length === 0) return;

			// Find the Layer 1 table — it's a sibling of the overlay in the grid root
			if (!tableContainer) return;

			const table = tableContainer.querySelector<HTMLTableElement>('.pv-table');
			if (!table) return;

			// Build a list of collapsed column groups: {collapseKey, hiddenColPaths[]}
			// A collapsed header at colStart (1-based) with colSpan N covers leaf columns
			// [colStart-1, colStart-1+N) in ctx.visibleCols.
			// Since the superstack.spanning plugin rebuilds headers using buildHeaderCells,
			// we determine the hidden column range from the header's data attributes.
			for (const header of collapsedColHeaders) {
				const collapseKey = header.getAttribute('data-collapse-key');
				if (!collapseKey || !state.collapsedSet.has(collapseKey)) continue;

				// Read col range from spanning plugin data attributes
				const colStartAttr = header.getAttribute('data-col-start');
				const colSpanAttr = header.getAttribute('data-col-span');

				if (!colStartAttr || !colSpanAttr) continue;

				const colStart = parseInt(colStartAttr, 10) - 1; // 0-based
				const colSpanCount = parseInt(colSpanAttr, 10);

				if (Number.isNaN(colStart) || Number.isNaN(colSpanCount)) continue;

				// The hidden child col paths are those NOT visible in the collapsed output.
				// In the collapsed state, the spanning plugin shows 1 representative slot for
				// the entire group. The "hidden" children = all slots that share this parent
				// minus the representative.
				// Since we don't have direct access to the full (pre-collapse) visibleCols,
				// we look up the full column list from the original data map keys.
				// Simpler: use ctx.visibleCols at [colStart] as the representative column,
				// then sum all ctx.data values for the current row across columns with the
				// same collapse prefix.
				if (colStart >= ctx.visibleCols.length) continue;

				const representativeCol = ctx.visibleCols[colStart];
				if (!representativeCol) continue;

				// Find all col paths that share the same ancestor path up to the collapse level
				// The collapse key format: "level\x1fparentPath\x1fvalue"
				const parts = collapseKey.split('\x1f');
				if (parts.length < 3) continue;
				const level = parseInt(parts[0]!, 10);
				const ancestorValue = parts[parts.length - 1]!;

				// Hidden child col paths: all visibleCols entries that have ancestorValue at [level]
				// This matches the same logic used in buildHeaderCells to form the collapsed group.
				const hiddenColPaths = ctx.visibleCols.filter((colPath) => {
					return colPath[level] === ancestorValue;
				});

				if (hiddenColPaths.length <= 1) continue; // Nothing actually hidden

				// Find table data rows (tbody tr) — each corresponds to a visibleRow
				const tbodyRows = table.querySelectorAll<HTMLTableRowElement>('tbody tr');

				tbodyRows.forEach((tr, rowIdx) => {
					const rowPath = ctx.visibleRows[rowIdx];
					if (!rowPath) return;

					// Compute SUM across all hidden child column paths for this row
					const cellValues = hiddenColPaths.map((colPath) => {
						const key = `${rowPath.join('|')}::${colPath.join('|')}`;
						return ctx.data.get(key) ?? null;
					});
					const total = sum(cellValues);

					// Find the data cell at the collapsed column position (colStart, 0-based)
					// The cell is the (colStart + rowDimCount + 1)-th td in the row
					// (first rowDimCount tds are invisible row header spacers)
					const rowDimCount = ctx.rowDimensions.length;
					const cells = tr.querySelectorAll<HTMLTableCellElement>('td.pv-data-cell');
					const targetCell = cells[colStart];

					if (targetCell) {
						targetCell.classList.add(AGG_CELL_CLASS);
						targetCell.textContent = String(total);
					}
				});
			}

			// Similar for collapsed row groups (collapsed row headers)
			const collapsedRowHeaders = root.querySelectorAll<HTMLElement>('.pv-row-span--collapsed[data-collapse-key]');

			for (const header of collapsedRowHeaders) {
				const collapseKey = header.getAttribute('data-collapse-key');
				if (!collapseKey || !state.collapsedSet.has(collapseKey)) continue;

				const colStartAttr = header.getAttribute('data-col-start');
				const colSpanAttr = header.getAttribute('data-col-span');

				if (!colStartAttr || !colSpanAttr) continue;

				const rowStart = parseInt(colStartAttr, 10) - 1; // 0-based (col-start = row-start for row headers)
				const rowSpanCount = parseInt(colSpanAttr, 10);

				if (Number.isNaN(rowStart) || Number.isNaN(rowSpanCount)) continue;
				if (rowStart >= ctx.visibleRows.length) continue;

				const parts = collapseKey.split('\x1f');
				if (parts.length < 3) continue;
				const level = parseInt(parts[0]!, 10);
				const ancestorValue = parts[parts.length - 1]!;

				const hiddenRowPaths = ctx.visibleRows.filter((rowPath) => {
					return rowPath[level] === ancestorValue;
				});

				if (hiddenRowPaths.length <= 1) continue;

				const tbodyRows = table?.querySelectorAll<HTMLTableRowElement>('tbody tr');
				if (!tbodyRows) continue;

				// For the collapsed row: the representative row is at rowStart
				// Find all data cells in that row and compute SUM across hidden row paths
				const representativeRowTr = tbodyRows[rowStart];
				if (!representativeRowTr) continue;

				const cells = representativeRowTr.querySelectorAll<HTMLTableCellElement>('td.pv-data-cell');

				cells.forEach((cell, colIdx) => {
					const colPath = ctx.visibleCols[colIdx];
					if (!colPath) return;

					const cellValues = hiddenRowPaths.map((rowPath) => {
						const key = `${rowPath.join('|')}::${colPath.join('|')}`;
						return ctx.data.get(key) ?? null;
					});
					const total = sum(cellValues);

					cell.classList.add(AGG_CELL_CLASS);
					cell.textContent = String(total);
				});
			}
		},
	};
}
