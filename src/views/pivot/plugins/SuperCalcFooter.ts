// Isometry v5 — Phase 100 Plan 03 SuperCalcFooter Plugin
// Aggregate footer row with configurable functions per column.
//
// Design:
//   - computeAggregate: pure function for SUM/AVG/COUNT/MIN/MAX/NONE
//   - createSuperCalcFooterPlugin: afterRender creates sticky .pv-calc-footer
//   - Accepts optional sharedConfig so SuperCalcConfig can drive aggregate selection
//   - Internal Map defaults to SUM for all columns when no sharedConfig provided
//
// Requirements: CALC-01

import type { PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Aggregate function type
// ---------------------------------------------------------------------------

export type AggFunction = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'NONE';

// ---------------------------------------------------------------------------
// Pure aggregate function
// ---------------------------------------------------------------------------

/**
 * Compute an aggregate over an array of values.
 *
 * SUM   — sum of all values, null treated as 0. Returns null if array is empty.
 * AVG   — mean of non-null values. Returns null if no non-null values or empty.
 * COUNT — count of non-null values. Returns 0 for empty/all-null arrays.
 * MIN   — minimum of non-null values. Returns null if no non-null values or empty.
 * MAX   — maximum of non-null values. Returns null if no non-null values or empty.
 * NONE  — always returns null.
 */
export function computeAggregate(
	fn: AggFunction,
	values: (number | null)[],
): number | null {
	if (fn === 'NONE') return null;

	if (fn === 'COUNT') {
		return values.filter((v) => v !== null).length;
	}

	if (values.length === 0) return null;

	if (fn === 'SUM') {
		return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
	}

	const nonNulls = values.filter((v): v is number => v !== null);

	if (fn === 'AVG') {
		if (nonNulls.length === 0) return null;
		return nonNulls.reduce((a, b) => a + b, 0) / nonNulls.length;
	}

	if (fn === 'MIN') {
		if (nonNulls.length === 0) return null;
		return Math.min(...nonNulls);
	}

	if (fn === 'MAX') {
		if (nonNulls.length === 0) return null;
		return Math.max(...nonNulls);
	}

	return null;
}

// ---------------------------------------------------------------------------
// Glyph map
// ---------------------------------------------------------------------------

const GLYPHS: Record<AggFunction, string> = {
	SUM: '∑',
	AVG: 'x̄',
	COUNT: '#',
	MIN: '↓',
	MAX: '↑',
	NONE: '',
};

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the supercalc.footer plugin.
 *
 * @param sharedConfig - Optional shared config object from SuperCalcConfig.
 *   If provided, aggregate functions are read from sharedConfig.aggFunctions.
 *   If omitted, an internal Map is used (defaults to SUM for all columns).
 */
export function createSuperCalcFooterPlugin(
	sharedConfig?: { aggFunctions: Map<number, AggFunction> },
): PluginHook {
	const internalConfig = { aggFunctions: new Map<number, AggFunction>() };
	const config = sharedConfig ?? internalConfig;

	let _footerEl: HTMLElement | null = null;

	return {
		afterRender(root: HTMLElement, ctx: RenderContext): void {
			// Find the grid wrapper (parent of root / the scroll container)
			const gridWrapper = root.parentElement;
			if (!gridWrapper) return;

			// Find or create the footer container as a sibling of root
			let footer = gridWrapper.querySelector<HTMLElement>('.pv-calc-footer');
			if (!footer) {
				footer = document.createElement('div');
				footer.className = 'pv-calc-footer';
				gridWrapper.appendChild(footer);
				_footerEl = footer;
			} else {
				_footerEl = footer;
				// Clear previous cells
				footer.innerHTML = '';
			}

			const { visibleCols, data, visibleRows } = ctx;

			if (visibleCols.length === 0) {
				footer.innerHTML = '';
				return;
			}

			// For each visible column, collect values and compute aggregate
			for (let colIdx = 0; colIdx < visibleCols.length; colIdx++) {
				const colPath = visibleCols[colIdx];
				if (!colPath) continue;

				// Collect all cell values for this column across all visible rows
				const columnValues: (number | null)[] = visibleRows.map((rowPath) => {
					const key = `${rowPath.join('|')}::${colPath.join('|')}`;
					return data.get(key) ?? null;
				});

				const fn: AggFunction = config.aggFunctions.get(colIdx) ?? 'SUM';
				const result = computeAggregate(fn, columnValues);

				const cell = document.createElement('div');
				cell.className = 'pv-calc-cell';

				if (result !== null) {
					const glyph = document.createElement('span');
					glyph.className = 'pv-calc-glyph';
					glyph.textContent = GLYPHS[fn];
					cell.appendChild(glyph);
					cell.appendChild(document.createTextNode(` ${result}`));
				} else {
					cell.style.color = 'var(--pv-cell-empty-fg)';
					cell.textContent = '—';
				}

				footer.appendChild(cell);
			}
		},

		destroy(): void {
			_footerEl?.remove();
			_footerEl = null;
		},
	};
}
