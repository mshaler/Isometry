// Isometry v5 -- Phase 65 Plan 02
// ChartRenderer: orchestrates chart mount/update/destroy lifecycle.
//
// Requirements: NOTE-06, NOTE-07, NOTE-08
//
// Design:
//   - Parses data-chart-config attributes from placeholder divs
//   - Resolves field aliases via AliasProvider (display name -> column name)
//   - Sends chart:query to Worker via WorkerBridge
//   - Dispatches to type-specific renderers (bar, pie, line, scatter)
//   - FilterProvider subscription for live chart updates
//   - Debounced re-query (300ms) on filter changes
//   - Query generation counter discards stale results (race condition guard)

import type { AliasProvider } from '../../providers/AliasProvider';
import { ALLOWED_AXIS_FIELDS } from '../../providers/allowlist';
import type { FilterProvider } from '../../providers/FilterProvider';
import type { SchemaProvider } from '../../providers/SchemaProvider';
import type { AxisField } from '../../providers/types';
import type { WorkerBridge } from '../../worker/WorkerBridge';
import { renderBarChart } from './BarChart';
import type { ChartConfig } from './ChartParser';
import { parseChartConfig } from './ChartParser';
import { renderLineChart } from './LineChart';
import { renderPieChart } from './PieChart';
import { renderScatterChart } from './ScatterChart';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ChartRendererConfig {
	bridge: WorkerBridge;
	filter: FilterProvider;
	alias: AliasProvider;
	/** Optional SchemaProvider for dynamic field resolution (DYNM-06 extension). */
	schema?: SchemaProvider | undefined;
}

// ---------------------------------------------------------------------------
// ChartRenderer
// ---------------------------------------------------------------------------

/**
 * Orchestrates D3 chart lifecycle: mount, update (via filter subscription),
 * and destroy. Charts are rendered programmatically into sanitized
 * placeholder divs (two-pass security model per NOTE-08).
 */
export class ChartRenderer {
	private readonly _bridge: WorkerBridge;
	private readonly _filter: FilterProvider;
	private readonly _alias: AliasProvider;
	private readonly _schema: SchemaProvider | undefined;

	/** Track mounted charts by chart ID for in-place updates. */
	private _activeCharts: Map<string, { config: ChartConfig; container: HTMLDivElement }> = new Map();

	/** Generation counter to discard stale query results. */
	private _queryGeneration = 0;

	/** Debounce timer for filter change re-query. */
	private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(config: ChartRendererConfig) {
		this._bridge = config.bridge;
		this._filter = config.filter;
		this._alias = config.alias;
		this._schema = config.schema;
	}

	// -----------------------------------------------------------------------
	// Public API
	// -----------------------------------------------------------------------

	/**
	 * Find all `.notebook-explorer__chart-card` divs in previewEl, parse config,
	 * resolve aliases, query Worker, and render charts.
	 */
	async mountCharts(previewEl: HTMLElement): Promise<void> {
		const cards = previewEl.querySelectorAll<HTMLDivElement>('.notebook-explorer__chart-card[data-chart-config]');
		if (cards.length === 0) return;

		const generation = ++this._queryGeneration;

		for (const card of cards) {
			const chartId = card.getAttribute('data-chart-id') ?? '';
			const encoded = card.getAttribute('data-chart-config') ?? '';

			// Decode base64 config
			let rawText: string;
			try {
				rawText = atob(encoded);
			} catch {
				this._renderError(card, 'Failed to decode chart config');
				continue;
			}

			// Parse config
			const result = parseChartConfig(rawText);
			if ('error' in result) {
				this._renderError(card, result.error);
				continue;
			}

			const config = result;

			// Resolve field aliases and validate
			const resolvedConfig = this._resolveAndValidate(config);
			if (typeof resolvedConfig === 'string') {
				this._renderError(card, resolvedConfig);
				continue;
			}

			// Track active chart
			this._activeCharts.set(chartId, { config: resolvedConfig, container: card });

			// Query and render
			await this._queryAndRender(chartId, resolvedConfig, card, generation);
		}
	}

	/**
	 * Subscribe to FilterProvider changes. On change, debounce 300ms,
	 * then re-query and update all active chart containers in-place.
	 *
	 * @returns Unsubscribe function
	 */
	startFilterSubscription(): () => void {
		return this._filter.subscribe(() => {
			if (this._debounceTimer !== null) {
				clearTimeout(this._debounceTimer);
			}
			this._debounceTimer = setTimeout(() => {
				this._debounceTimer = null;
				void this._refreshAllCharts();
			}, 300);
		});
	}

	/**
	 * Remove all active chart SVGs and clear state.
	 */
	destroyCharts(): void {
		if (this._debounceTimer !== null) {
			clearTimeout(this._debounceTimer);
			this._debounceTimer = null;
		}
		for (const { container } of this._activeCharts.values()) {
			// Remove SVG and tooltip from container
			const svg = container.querySelector('svg');
			svg?.remove();
			const tip = container.querySelector('.notebook-explorer__chart-tooltip');
			tip?.remove();
			const err = container.querySelector('.notebook-explorer__chart-error');
			err?.remove();
		}
		this._activeCharts.clear();
	}

	// -----------------------------------------------------------------------
	// Private: field resolution
	// -----------------------------------------------------------------------

	/**
	 * Resolve display names to column names via AliasProvider.
	 * Also validates that resolved fields exist in the allowlist.
	 *
	 * Returns a new ChartConfig with resolved field names, or an error string.
	 */
	private _resolveAndValidate(config: ChartConfig): ChartConfig | string {
		const resolved = { ...config };

		if (config.x) {
			const field = this._resolveField(config.x);
			if (!field) return `Unknown field: ${config.x}`;
			resolved.x = field;
		}

		if (config.y && config.y !== 'count') {
			const field = this._resolveField(config.y);
			if (!field) return `Unknown field: ${config.y}`;
			resolved.y = field;
		}

		if (config.value) {
			const field = this._resolveField(config.value);
			if (!field) return `Unknown field: ${config.value}`;
			resolved.value = field;
		}

		return resolved;
	}

	/**
	 * Resolve a display name to a column name.
	 *
	 * Checks if displayName is itself an axis field (direct column name),
	 * then iterates axis fields to find alias matches.
	 * Uses SchemaProvider when available, falls back to ALLOWED_AXIS_FIELDS.
	 */
	private _resolveField(displayName: string): string | null {
		const axisFields = this._schema?.initialized
			? this._schema.getAxisColumns().map((c) => c.name)
			: [...ALLOWED_AXIS_FIELDS];

		// Direct column name check
		if (axisFields.includes(displayName)) {
			return displayName;
		}

		// Reverse alias lookup: iterate all axis fields, check alias match
		for (const field of axisFields) {
			if (this._alias.getAlias(field as AxisField) === displayName) {
				return field;
			}
		}

		return null;
	}

	// -----------------------------------------------------------------------
	// Private: query and render
	// -----------------------------------------------------------------------

	/**
	 * Send chart:query to Worker and dispatch to type-specific renderer.
	 */
	private async _queryAndRender(
		_chartId: string,
		config: ChartConfig,
		container: HTMLDivElement,
		generation: number,
	): Promise<void> {
		try {
			// Compile current filter state
			const { where, params } = this._filter.compile();

			// Determine x/y fields for query
			let xField: string;
			let yField: string | null;

			if (config.type === 'pie') {
				xField = config.value!;
				yField = null;
			} else if (config.type === 'scatter') {
				xField = config.x!;
				yField = config.y!;
			} else {
				// bar, line
				xField = config.x!;
				yField = config.y === 'count' ? null : (config.y ?? null);
			}

			const payload: {
				chartType: 'bar' | 'pie' | 'line' | 'scatter';
				xField: string;
				yField: string | null;
				where: string;
				params: unknown[];
				limit?: number;
			} = {
				chartType: config.type,
				xField,
				yField,
				where,
				params,
			};
			if (config.limit !== undefined) {
				payload.limit = config.limit;
			}

			const response = await this._bridge.send('chart:query', payload);

			// Discard stale results
			if (generation !== this._queryGeneration) return;

			// Dispatch to type-specific renderer
			switch (config.type) {
				case 'bar':
					if (response.type === 'labeled') {
						renderBarChart(container, response.rows, config);
					}
					break;
				case 'pie':
					if (response.type === 'labeled') {
						renderPieChart(container, response.rows, config);
					}
					break;
				case 'line':
					if (response.type === 'labeled') {
						renderLineChart(container, response.rows, config);
					}
					break;
				case 'scatter':
					if (response.type === 'xy') {
						renderScatterChart(container, response.rows, config);
					}
					break;
			}
		} catch (err) {
			// Discard stale errors
			if (generation !== this._queryGeneration) return;
			this._renderError(container, err instanceof Error ? err.message : 'Chart query failed');
		}
	}

	/**
	 * Re-query and update all active charts on filter change.
	 */
	private async _refreshAllCharts(): Promise<void> {
		const generation = ++this._queryGeneration;

		for (const [chartId, { config, container }] of this._activeCharts) {
			await this._queryAndRender(chartId, config, container, generation);
		}
	}

	/**
	 * Render an inline error message in a chart container.
	 */
	private _renderError(container: HTMLDivElement, message: string): void {
		// Remove existing error if any
		const existing = container.querySelector('.notebook-explorer__chart-error');
		existing?.remove();

		const errorEl = document.createElement('div');
		errorEl.className = 'notebook-explorer__chart-error';
		errorEl.textContent = message;
		container.appendChild(errorEl);
	}
}
