// Isometry v5 — Phase 100 Plan 03 SuperCalcConfig Plugin
// Extended in Phase 103 Plan 01 for null handling modes, COUNT semantics, and scope toggle.
//
// Design:
//   - afterRender creates a .hns-calc-config section in the harness sidebar
//   - Each visible column gets a label + <select> for SUM/AVG/COUNT/MIN/MAX/NONE
//   - On change: updates sharedConfig.cols and calls onConfigChange()
//   - Works alongside SuperCalcFooter via the shared CalcConfig object
//
// Requirements: CALC-02, SC2-09, SC2-10

import type { PluginHook, RenderContext } from './PluginTypes';
import {
	type AggFunction,
	type CalcConfig,
	getColConfig,
} from './SuperCalcFooter';

const AGG_OPTIONS: AggFunction[] = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'NONE'];

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the supercalc.config plugin.
 *
 * @param sharedConfig - CalcConfig shared with createSuperCalcFooterPlugin.
 *   Must be the same object so footer reads updated values on next render.
 * @param onConfigChange - Optional callback invoked when any config is changed
 *   (used by FeatureCatalog to trigger a rerender).
 */
export function createSuperCalcConfigPlugin(
	sharedConfig: CalcConfig,
	onConfigChange?: () => void,
): PluginHook {
	let _configEl: HTMLElement | null = null;

	return {
		afterRender(root: HTMLElement, ctx: RenderContext): void {
			// The harness sidebar is outside root. Walk up to find .hns-sidebar.
			// If not in a harness context, bail silently.
			const sidebar = document.querySelector<HTMLElement>('.hns-sidebar');
			if (!sidebar) return;

			// Find or create the calc config section
			let section = sidebar.querySelector<HTMLElement>('.hns-calc-config');
			if (!section) {
				section = document.createElement('div');
				section.className = 'hns-calc-config';

				const label = document.createElement('div');
				label.className = 'hns-data-label';
				label.textContent = 'Aggregate Config';
				section.appendChild(label);

				sidebar.appendChild(section);
				_configEl = section;
			} else {
				_configEl = section;
				// Remove previous column rows (keep label)
				const rows = section.querySelectorAll('.hns-calc-col-row');
				for (const row of rows) row.remove();
			}

			const { visibleCols } = ctx;

			for (let colIdx = 0; colIdx < visibleCols.length; colIdx++) {
				const colPath = visibleCols[colIdx];
				if (!colPath) continue;

				const columnName = colPath[colPath.length - 1] ?? `Col ${colIdx}`;
				const truncatedName = columnName.substring(0, 16);

				const row = document.createElement('div');
				row.className = 'hns-calc-col-row';

				const labelSpan = document.createElement('span');
				labelSpan.className = 'hns-data-label';
				labelSpan.style.marginBottom = '0';
				labelSpan.textContent = truncatedName;

				const colCfg = getColConfig(sharedConfig, colIdx);

				const select = document.createElement('select');
				const currentFn: AggFunction = colCfg.fn;

				for (const opt of AGG_OPTIONS) {
					const option = document.createElement('option');
					option.value = opt;
					option.textContent = opt;
					if (opt === currentFn) option.selected = true;
					select.appendChild(option);
				}

				select.addEventListener('change', () => {
					const existing = getColConfig(sharedConfig, colIdx);
					sharedConfig.cols.set(colIdx, {
						...existing,
						fn: select.value as AggFunction,
					});
					onConfigChange?.();
				});

				row.appendChild(labelSpan);
				row.appendChild(select);
				section.appendChild(row);
			}
		},

		destroy(): void {
			_configEl?.remove();
			_configEl = null;
		},
	};
}
