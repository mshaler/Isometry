// Isometry v5 -- Phase 62 Plan 02
// CalcExplorer: per-column aggregate function configuration panel.
//
// Requirements: CALC-02, CALC-03
//
// Design:
//   - Renders inside SuperWidget passthrough slot ("Calc" panel)
//   - Shows one dropdown per axis-assigned column (from PAFVProvider)
//   - Numeric fields (priority, sort_order) default to SUM with SUM/AVG/COUNT/MIN/MAX/OFF options
//   - Text fields default to COUNT with COUNT/OFF options
//   - Config persisted to ui_state via bridge.send('ui:set', { key: 'calc:config' })
//   - PAFVProvider subscription rebuilds dropdown list on axis changes
//   - getConfig() public API for SuperGrid footer rendering (Plan 03)

import type { AliasProvider } from '../providers/AliasProvider';
import type { PAFVProvider } from '../providers/PAFVProvider';
import type { SchemaProvider } from '../providers/SchemaProvider';
import type { AggregationMode, AxisField } from '../providers/types';
import type { WorkerBridge } from '../worker/WorkerBridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-column aggregate configuration. 'off' disables the column from footer. */
export interface CalcConfig {
	columns: Record<string, AggregationMode | 'off'>;
}

/** Constructor dependencies for CalcExplorer. */
export interface CalcExplorerConfig {
	bridge: WorkerBridge;
	pafv: PAFVProvider;
	container: HTMLElement;
	onConfigChange: (config: CalcConfig) => void;
	/** Optional SchemaProvider for dynamic numeric detection (DYNM-07). */
	schema?: SchemaProvider | undefined;
	/** Optional AliasProvider for dynamic display names (DYNM-08). */
	alias?: AliasProvider | undefined;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Numeric field aggregate options. */
const NUMERIC_OPTIONS: ReadonlyArray<AggregationMode | 'off'> = ['sum', 'avg', 'count', 'min', 'max', 'off'];

/** Text field aggregate options. */
const TEXT_OPTIONS: ReadonlyArray<AggregationMode | 'off'> = ['count', 'off'];

/** Display labels for aggregate modes. */
const MODE_LABELS: Record<string, string> = {
	sum: 'SUM',
	avg: 'AVG',
	count: 'COUNT',
	min: 'MIN',
	max: 'MAX',
	off: 'OFF',
};

// ---------------------------------------------------------------------------
// CalcExplorer
// ---------------------------------------------------------------------------

export class CalcExplorer {
	private readonly _bridge: WorkerBridge;
	private readonly _pafv: PAFVProvider;
	private readonly _container: HTMLElement;
	private readonly _onConfigChange: (config: CalcConfig) => void;
	private readonly _schema: SchemaProvider | undefined;
	private readonly _alias: AliasProvider | undefined;

	private _config: CalcConfig = { columns: {} };
	private _unsubscribePafv: (() => void) | null = null;
	private _unsubscribeSchema: (() => void) | null = null;
	private _persistTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(config: CalcExplorerConfig) {
		this._bridge = config.bridge;
		this._pafv = config.pafv;
		this._container = config.container;
		this._onConfigChange = config.onConfigChange;
		this._schema = config.schema;
		this._alias = config.alias;
	}

	// -----------------------------------------------------------------------
	// Private — numeric detection
	// -----------------------------------------------------------------------

	/**
	 * Returns true if the field supports numeric aggregation (SUM, AVG, MIN, MAX).
	 * Uses SchemaProvider when available; returns false when schema is not initialized.
	 */
	private _isNumeric(field: string): boolean {
		if (this._schema?.initialized) {
			const cols = this._schema.getNumericColumns();
			return cols.some((c) => c.name === field);
		}
		return false;
	}

	/**
	 * Returns the display-friendly name for a field.
	 * Uses AliasProvider when available, falls back to snake_case-to-Title-Case conversion.
	 */
	private _displayName(field: string): string {
		if (this._alias) {
			return this._alias.getAlias(field as AxisField);
		}
		// Fallback: snake_case to Title Case
		return field
			.split('_')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	/**
	 * Mount the CalcExplorer: load persisted config, subscribe to PAFV changes,
	 * and render the initial UI.
	 */
	async mount(): Promise<void> {
		// Load persisted config from ui_state
		try {
			const result = await this._bridge.send('ui:get', { key: 'calc:config' });
			if (result.value) {
				const parsed = JSON.parse(result.value);
				if (parsed && typeof parsed === 'object' && parsed.columns) {
					this._config = parsed as CalcConfig;
				}
			}
		} catch {
			// No persisted config or parse error -- use defaults
		}

		// Subscribe to PAFVProvider changes to rebuild dropdown list
		this._unsubscribePafv = this._pafv.subscribe(() => {
			this._render();
		});

		// Subscribe to SchemaProvider changes to re-render with updated numeric detection
		if (this._schema) {
			this._unsubscribeSchema = this._schema.subscribe(() => {
				this._render();
			});
		}

		this._render();
	}

	/**
	 * Get the current CalcConfig for consumers (e.g., SuperGrid footer).
	 */
	getConfig(): CalcConfig {
		return {
			columns: { ...this._config.columns },
		};
	}

	/**
	 * Tear down: unsubscribe from PAFVProvider, cancel pending persist, clear container.
	 */
	destroy(): void {
		if (this._unsubscribePafv) {
			this._unsubscribePafv();
			this._unsubscribePafv = null;
		}
		if (this._unsubscribeSchema) {
			this._unsubscribeSchema();
			this._unsubscribeSchema = null;
		}
		if (this._persistTimer !== null) {
			clearTimeout(this._persistTimer);
			this._persistTimer = null;
		}
		this._container.textContent = '';
	}

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

	private _render(): void {
		this._container.textContent = '';

		// Get current axis-assigned columns
		const { colAxes, rowAxes } = this._pafv.getStackedGroupBySQL();
		const seen = new Set<string>();
		const fields: AxisField[] = [];

		for (const axis of [...colAxes, ...rowAxes]) {
			if (!seen.has(axis.field)) {
				seen.add(axis.field);
				fields.push(axis.field);
			}
		}

		if (fields.length === 0) {
			const emptyMsg = document.createElement('div');
			emptyMsg.className = 'calc-row';
			emptyMsg.style.justifyContent = 'center';
			emptyMsg.style.color = 'var(--text-muted)';
			emptyMsg.style.fontStyle = 'italic';
			emptyMsg.style.fontSize = 'var(--text-sm)';
			emptyMsg.textContent = 'Assign axes to configure';
			this._container.appendChild(emptyMsg);
			return;
		}

		const wrapper = document.createElement('div');
		wrapper.className = 'calc-explorer';

		for (const field of fields) {
			const isNumeric = this._isNumeric(field);
			const options = isNumeric ? NUMERIC_OPTIONS : TEXT_OPTIONS;
			const defaultMode = isNumeric ? 'sum' : 'count';

			// Get current value from config or use default
			const currentValue = this._config.columns[field] ?? defaultMode;

			const row = document.createElement('div');
			row.className = 'calc-row';
			if (currentValue !== 'off') {
				row.classList.add('calc-row--active');
			}

			const displayName = this._displayName(field);

			const label = document.createElement('label');
			const glyph = document.createElement('span');
			glyph.className = 'calc-row__type-glyph';
			glyph.textContent = isNumeric ? '#' : 'Aa';
			label.appendChild(glyph);
			label.appendChild(document.createTextNode(displayName));
			const selectId = 'calc-select-' + field;
			label.htmlFor = selectId;
			row.appendChild(label);

			const select = document.createElement('select');
			select.id = selectId;
			select.className = 'calc-select';
			select.setAttribute('aria-label', `Aggregate for ${displayName}`);

			for (const opt of options) {
				const option = document.createElement('option');
				option.value = opt;
				option.textContent = MODE_LABELS[opt] ?? opt.toUpperCase();
				if (opt === currentValue) {
					option.selected = true;
				}
				select.appendChild(option);
			}

			select.addEventListener('change', () => {
				this._config.columns[field] = select.value as AggregationMode | 'off';
				this._persist();
				this._onConfigChange(this.getConfig());
			});

			row.appendChild(select);
			wrapper.appendChild(row);
		}

		this._container.appendChild(wrapper);
	}

	// -----------------------------------------------------------------------
	// Persistence (debounced)
	// -----------------------------------------------------------------------

	private _persist(): void {
		if (this._persistTimer !== null) {
			clearTimeout(this._persistTimer);
		}
		this._persistTimer = setTimeout(() => {
			this._persistTimer = null;
			void this._bridge.send('ui:set', {
				key: 'calc:config',
				value: JSON.stringify(this._config),
			});
		}, 300);
	}
}
