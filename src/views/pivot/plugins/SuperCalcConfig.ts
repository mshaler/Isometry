// Isometry v5 — Phase 100 Plan 03 SuperCalcConfig Plugin
// Extended in Phase 103 Plan 01 for null handling modes, COUNT semantics, and scope toggle.
// Extended in Phase 103 Plan 02 with scope radio fieldset, null mode select, COUNT sub-mode select.
//
// Design:
//   - afterRender creates a .hns-calc-config section in the harness sidebar
//   - Scope fieldset: radio buttons for 'view' (filter-aware) or 'all' (full dataset)
//   - Each visible column gets a label + fn <select> + nullMode <select> + countMode <select>
//   - nullMode select hidden when fn === 'NONE'; countMode select shown only when fn === 'COUNT'
//   - On change: updates sharedConfig and calls onConfigChange()
//   - Works alongside SuperCalcFooter via the shared CalcConfig object
//
// Requirements: CALC-02, SC2-09, SC2-10, SC2-11, SC2-12, SC2-13, SC2-14, SC2-15

import type { PluginHook, RenderContext } from './PluginTypes';
import {
	type AggFunction,
	type CalcConfig,
	type CountMode,
	getColConfig,
	type NullMode,
	type ScopeMode,
} from './SuperCalcFooter';

const AGG_OPTIONS: AggFunction[] = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'NONE'];

const NULL_MODE_OPTIONS: { value: NullMode; label: string }[] = [
	{ value: 'exclude', label: 'Exclude nulls' },
	{ value: 'zero', label: 'Nulls as zero' },
	{ value: 'strict', label: 'Strict' },
];

const COUNT_MODE_OPTIONS: { value: CountMode; label: string }[] = [
	{ value: 'column', label: 'Non-null values' },
	{ value: 'all', label: 'All rows' },
];

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
export function createSuperCalcConfigPlugin(sharedConfig: CalcConfig, onConfigChange?: () => void): PluginHook {
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
				// Remove previous column rows (keep label and scope fieldset)
				const rows = section.querySelectorAll('.hns-calc-col-row');
				for (const row of rows) row.remove();
			}

			// ---- Scope toggle ----
			let scopeFieldset = section.querySelector<HTMLFieldSetElement>('.hns-calc-scope');
			if (!scopeFieldset) {
				scopeFieldset = document.createElement('fieldset');
				scopeFieldset.className = 'hns-calc-scope';

				const legend = document.createElement('legend');
				legend.textContent = 'Aggregation scope';
				scopeFieldset.appendChild(legend);

				for (const mode of ['view', 'all'] as ScopeMode[]) {
					const radioLabel = document.createElement('label');
					const radio = document.createElement('input');
					radio.type = 'radio';
					radio.name = 'calc-scope';
					radio.value = mode;
					radio.checked = sharedConfig.scope === mode;
					radio.addEventListener('change', () => {
						sharedConfig.scope = mode;
						onConfigChange?.();
					});
					radioLabel.appendChild(radio);
					radioLabel.appendChild(
						document.createTextNode(mode === 'view' ? ' Current view (respects filters)' : ' All data'),
					);
					scopeFieldset.appendChild(radioLabel);
				}

				// Insert after the section label, before column rows
				const sectionLabel = section.querySelector('.hns-data-label');
				if (sectionLabel?.nextSibling) {
					section.insertBefore(scopeFieldset, sectionLabel.nextSibling);
				} else {
					section.appendChild(scopeFieldset);
				}
			} else {
				// Update radio checked state to reflect current scope
				const radios = scopeFieldset.querySelectorAll<HTMLInputElement>('input[name="calc-scope"]');
				for (const radio of radios) {
					radio.checked = radio.value === sharedConfig.scope;
				}
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

				// ---- Aggregate function select ----
				const select = document.createElement('select');
				const currentFn: AggFunction = colCfg.fn;

				for (const opt of AGG_OPTIONS) {
					const option = document.createElement('option');
					option.value = opt;
					option.textContent = opt;
					if (opt === currentFn) option.selected = true;
					select.appendChild(option);
				}

				// ---- Null mode select ----
				const nullSelect = document.createElement('select');
				nullSelect.className = 'hns-calc-null-mode';
				for (const opt of NULL_MODE_OPTIONS) {
					const option = document.createElement('option');
					option.value = opt.value;
					option.textContent = opt.label;
					if (opt.value === colCfg.nullMode) option.selected = true;
					nullSelect.appendChild(option);
				}
				nullSelect.style.display = currentFn === 'NONE' ? 'none' : '';
				nullSelect.addEventListener('change', () => {
					sharedConfig.cols.set(colIdx, {
						...getColConfig(sharedConfig, colIdx),
						nullMode: nullSelect.value as NullMode,
					});
					onConfigChange?.();
				});

				// ---- Count mode select ----
				const countSelect = document.createElement('select');
				countSelect.className = 'hns-calc-count-mode';
				countSelect.title = 'Non-null values (original data)';
				for (const opt of COUNT_MODE_OPTIONS) {
					const option = document.createElement('option');
					option.value = opt.value;
					option.textContent = opt.label;
					if (opt.value === colCfg.countMode) option.selected = true;
					countSelect.appendChild(option);
				}
				countSelect.style.display = currentFn === 'COUNT' ? '' : 'none';
				countSelect.addEventListener('change', () => {
					sharedConfig.cols.set(colIdx, {
						...getColConfig(sharedConfig, colIdx),
						countMode: countSelect.value as CountMode,
					});
					onConfigChange?.();
				});

				// ---- Fn change: update both visibility toggles ----
				select.addEventListener('change', () => {
					const newFn = select.value as AggFunction;
					sharedConfig.cols.set(colIdx, {
						...getColConfig(sharedConfig, colIdx),
						fn: newFn,
					});
					nullSelect.style.display = newFn === 'NONE' ? 'none' : '';
					countSelect.style.display = newFn === 'COUNT' ? '' : 'none';
					onConfigChange?.();
				});

				row.appendChild(labelSpan);
				row.appendChild(select);
				row.appendChild(nullSelect);
				row.appendChild(countSelect);
				section.appendChild(row);
			}
		},

		destroy(): void {
			_configEl?.remove();
			_configEl = null;
		},
	};
}
