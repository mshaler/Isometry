// Isometry v5 — Phase 100 Plan 03 SuperCalcFooter Plugin
// Extended in Phase 103 Plan 01 for null handling modes, COUNT semantics, scope, and AggResult.
//
// Design:
//   - computeAggregate: pure function for SUM/AVG/COUNT/MIN/MAX/NONE with NullMode + CountMode
//   - NullMode: 'exclude' (default) | 'zero' (substitute 0) | 'strict' (warn on any null)
//   - CountMode: 'column' (non-nulls, default) | 'all' (total rows)
//   - ScopeMode: 'view' (visible rows, default) | 'all' (pre-filter allRows)
//   - AggResult: structured { value, warning? } instead of bare number | null
//   - createSuperCalcFooterPlugin: afterRender creates sticky .pv-calc-footer
//   - Accepts optional CalcConfig so SuperCalcConfig can drive aggregate selection
//   - Internal CalcConfig defaults to scope 'view' + SUM/exclude/column for all columns
//
// Requirements: CALC-01, SC2-01, SC2-02, SC2-03, SC2-04, SC2-05, SC2-06, SC2-07

import type { PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Aggregate function type
// ---------------------------------------------------------------------------

export type AggFunction = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'NONE';

// ---------------------------------------------------------------------------
// Null handling, count mode, and scope types (Phase 103 Plan 01)
// ---------------------------------------------------------------------------

/** How null values participate in aggregate computation. Default: 'exclude'. */
export type NullMode = 'exclude' | 'zero' | 'strict';

/** Whether COUNT returns non-null count or total row count. Default: 'column'. */
export type CountMode = 'column' | 'all';

/** Whether footer aggregates visible rows only or all pre-filter rows. Default: 'view'. */
export type ScopeMode = 'view' | 'all';

/** Per-column aggregate configuration. */
export interface ColCalcConfig {
	fn: AggFunction;
	/** How nulls participate in this column's aggregate. Default: 'exclude'. */
	nullMode: NullMode;
	/** Whether COUNT returns non-nulls or total rows. Only relevant when fn === 'COUNT'. Default: 'column'. */
	countMode: CountMode;
}

/** Global calc configuration shared between footer and config plugins. */
export interface CalcConfig {
	/** Per-column configurations, keyed by column index. Missing entries default to SUM/exclude/column. */
	cols: Map<number, ColCalcConfig>;
	/** Aggregation scope: 'view' (filter-aware) or 'all' (full dataset). Default: 'view'. */
	scope: ScopeMode;
}

/** Structured aggregate result with optional strict-mode warning. */
export interface AggResult {
	value: number | null;
	warning?: 'incomplete-data';
}

// ---------------------------------------------------------------------------
// Warning glyph
// ---------------------------------------------------------------------------

/** Warning glyph for strict mode: ⚠ */
export const WARNING_GLYPH = '\u26A0';

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
// Helper: get per-column config with defaults
// ---------------------------------------------------------------------------

/**
 * Get per-column config from CalcConfig, with defaults for missing entries.
 * Defaults: { fn: 'SUM', nullMode: 'exclude', countMode: 'column' }
 */
export function getColConfig(calcConfig: CalcConfig, colIdx: number): ColCalcConfig {
	return (
		calcConfig.cols.get(colIdx) ?? {
			fn: 'SUM',
			nullMode: 'exclude',
			countMode: 'column',
		}
	);
}

// ---------------------------------------------------------------------------
// Pure aggregate function
// ---------------------------------------------------------------------------

/**
 * Compute an aggregate over an array of values with configurable null handling.
 *
 * @param fn         - Aggregate function to apply
 * @param values     - Input values (may contain nulls)
 * @param nullMode   - How nulls are handled: 'exclude' (default) | 'zero' | 'strict'
 * @param countMode  - For COUNT: 'column' (non-nulls) | 'all' (total rows)
 * @returns AggResult with value and optional warning
 *
 * NullMode semantics:
 *   'exclude' — Operate only on non-null values (SQLite/JS default behavior).
 *               SUM: nulls treated as 0. AVG/MIN/MAX: nulls ignored. COUNT: counts non-nulls.
 *   'zero'    — Substitute 0 for every null before computing.
 *               AVG divides by total rows (including zero-substituted). COUNT still counts original non-nulls.
 *   'strict'  — Return { value: null, warning: 'incomplete-data' } if ANY null present.
 *               If no nulls, compute as 'exclude'.
 *
 * CountMode semantics (only relevant for fn === 'COUNT'):
 *   'column'  — Count of originally non-null values (default, preserves prior behavior).
 *   'all'     — Total row count regardless of nulls (COUNT(*) behavior).
 */
export function computeAggregate(
	fn: AggFunction,
	values: (number | null)[],
	nullMode: NullMode = 'exclude',
	countMode: CountMode = 'column',
): AggResult {
	// NONE always returns null
	if (fn === 'NONE') return { value: null };

	// Strict mode: return warning if any null present
	if (nullMode === 'strict' && values.some((v) => v === null)) {
		return { value: null, warning: 'incomplete-data' };
	}

	// COUNT is handled specially based on countMode
	if (fn === 'COUNT') {
		if (countMode === 'all') {
			return { value: values.length };
		}
		// countMode === 'column': count original non-nulls (zero substitution doesn't change this)
		return { value: values.filter((v) => v !== null).length };
	}

	// Empty array check (applies to all other functions)
	if (values.length === 0) return { value: null };

	// SUM with 'exclude': treats nulls as 0 (original behavior preserved)
	// This is distinct from 'zero' semantically but identical arithmetically for SUM.
	if (fn === 'SUM' && nullMode !== 'zero') {
		return { value: values.reduce<number>((acc, v) => acc + (v ?? 0), 0) };
	}

	// Build working array based on nullMode
	let working: number[];
	if (nullMode === 'zero') {
		// Substitute 0 for nulls
		working = values.map((v) => (v === null ? 0 : v));
	} else {
		// 'exclude' or 'strict' with no nulls: filter to non-nulls
		working = values.filter((v): v is number => v !== null);
	}

	// For 'exclude' and 'strict' (no-null branch): if all values were null, working is empty
	if (working.length === 0) return { value: null };

	if (fn === 'SUM') {
		// Only reached when nullMode === 'zero'
		return { value: working.reduce((acc, v) => acc + v, 0) };
	}

	if (fn === 'AVG') {
		const sum = working.reduce((acc, v) => acc + v, 0);
		if (nullMode === 'zero') {
			// Divide by total rows (including zero-substituted)
			return { value: sum / values.length };
		}
		// 'exclude' / 'strict' no-null: divide by non-null count
		return { value: sum / working.length };
	}

	if (fn === 'MIN') {
		return { value: Math.min(...working) };
	}

	if (fn === 'MAX') {
		return { value: Math.max(...working) };
	}

	return { value: null };
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the supercalc.footer plugin.
 *
 * @param sharedConfig - Optional CalcConfig from registerAllPlugins.
 *   If provided, aggregate functions and null modes are read from sharedConfig.cols.
 *   If omitted, an internal config is used (scope 'view', SUM/exclude/column for all columns).
 */
export function createSuperCalcFooterPlugin(sharedConfig?: CalcConfig): PluginHook {
	const internalConfig: CalcConfig = {
		cols: new Map<number, ColCalcConfig>(),
		scope: 'view',
	};
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

			// Apply footer container styling per UI-SPEC:
			// - 2px solid border-muted top border separates footer from data
			// - monospace font, normal weight for aggregate numbers
			footer.style.cssText =
				'display:flex;border-top:2px solid var(--border-muted);font-family:var(--font-mono);font-weight:400;';

			// Derive layout info for sizing (layout is attached to ctx by PivotGrid)
			const layout =
				'layout' in ctx
					? (ctx as RenderContext & { layout: { headerWidth: number; cellWidth: number } }).layout
					: null;
			const cellW = layout?.cellWidth ?? 72;
			const headerW = layout?.headerWidth ?? 120;

			// Choose row set based on scope
			const rows = config.scope === 'all' ? ctx.allRows : ctx.visibleRows;
			const { visibleCols, data } = ctx;

			if (visibleCols.length === 0) {
				footer.innerHTML = '';
				return;
			}

			// Row-header spacer: aligns aggregate cells with data columns
			const spacer = document.createElement('div');
			spacer.style.cssText = `width:${headerW * ctx.rowDimensions.length}px;min-width:${headerW * ctx.rowDimensions.length}px;flex-shrink:0;`;
			footer.appendChild(spacer);

			// Derive column dimension name for tooltip label (use last/leaf dimension)
			const colDimName =
				ctx.colDimensions.length > 0 ? (ctx.colDimensions[ctx.colDimensions.length - 1]?.name ?? '') : '';

			// For each visible column, collect values and compute aggregate
			for (let colIdx = 0; colIdx < visibleCols.length; colIdx++) {
				const colPath = visibleCols[colIdx];
				if (!colPath) continue;

				// Collect all cell values for this column across the selected rows
				const columnValues: (number | null)[] = rows.map((rowPath) => {
					const key = `${rowPath.join('|')}::${colPath.join('|')}`;
					return data.get(key) ?? null;
				});

				const colCfg = getColConfig(config, colIdx);
				const result = computeAggregate(colCfg.fn, columnValues, colCfg.nullMode, colCfg.countMode);

				const cell = document.createElement('div');
				cell.className = 'pv-calc-cell';
				// Per UI-SPEC: right-aligned, monospace font, 11px, match cell width
				cell.style.cssText = `width:${cellW}px;min-width:${cellW}px;text-align:right;padding:4px 8px;font-size:11px;font-family:var(--font-mono);box-sizing:border-box;`;

				if (result.warning === 'incomplete-data') {
					// Strict mode warning: column has nulls
					cell.style.color = 'var(--pv-warning-fg)';
					cell.style.background = 'var(--pv-warning-bg)';
					cell.title = 'Column contains empty values — switch to Exclude or Zero mode for a result';
					cell.textContent = WARNING_GLYPH;
				} else if (result.value !== null) {
					const glyph = document.createElement('span');
					glyph.className = 'pv-calc-glyph';
					glyph.textContent = GLYPHS[colCfg.fn];
					cell.appendChild(glyph);
					// Format number with locale-aware thousands separators
					const formatted =
						typeof result.value === 'number' ? result.value.toLocaleString() : String(result.value);
					cell.appendChild(document.createTextNode(` ${formatted}`));
					// Tooltip shows full label per UI-SPEC: "{FUNCTION} of {field}"
					cell.title = `${colCfg.fn} of ${colDimName}`;
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
