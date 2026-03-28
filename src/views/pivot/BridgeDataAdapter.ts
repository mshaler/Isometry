// Isometry v5 — Phase 122 Plan 01
// BridgeDataAdapter — wraps WorkerBridge + providers for production PivotGrid use.
//
// Design:
//   - Reads axes from SuperGridProviderLike.getStackedGroupBySQL()
//   - Builds SuperGridQueryConfig and calls bridge.superGridQuery()
//   - Converts CellDatum[] to Map<string, number|null> using getCellKey-compatible keys
//   - subscribe() delegates to coordinator.subscribe()
//   - getProviderContext() exposes raw providers for plugins that need them
//
// Requirements: CONV-01

import type { AxisMapping } from '../../providers/types';
import type { CellDatum } from '../../worker/protocol';
import type { SuperGridBridgeLike, SuperGridDensityLike, SuperGridFilterLike, SuperGridProviderLike } from '../types';
import type { DataAdapter, FetchDataResult } from './DataAdapter';
import { getCellKey } from './PivotMockData';
import type { HeaderDimension } from './PivotTypes';

// ---------------------------------------------------------------------------
// Construction options
// ---------------------------------------------------------------------------

export interface BridgeDataAdapterOptions {
	bridge: SuperGridBridgeLike;
	provider: SuperGridProviderLike;
	filter: SuperGridFilterLike;
	density: SuperGridDensityLike;
	coordinator: { subscribe(cb: () => void): () => void };
	schema?: unknown | null;
	calcExplorer?: { getConfig(): unknown } | null;
	depthGetter?: (() => number) | null;
}

// ---------------------------------------------------------------------------
// Axis → HeaderDimension conversion
// ---------------------------------------------------------------------------

/**
 * Convert an AxisMapping to a HeaderDimension for use in the pivot config panel.
 * The `values` array is intentionally empty — actual row/col values are dynamic
 * and come from the bridge query result, not pre-enumerated.
 */
function axisToHeaderDimension(axis: AxisMapping): HeaderDimension {
	return {
		id: axis.field,
		type: axis.field as HeaderDimension['type'],
		name: axis.field,
		values: [], // Dynamic; populated at render time from query results
	};
}

/**
 * Convert a HeaderDimension back to an AxisMapping for writing to the provider.
 * Preserves 'asc' as the default direction.
 */
function headerDimensionToAxis(dim: HeaderDimension): AxisMapping {
	return {
		field: dim.id as AxisMapping['field'],
		direction: 'asc',
	};
}

// ---------------------------------------------------------------------------
// Cell key building from CellDatum
// ---------------------------------------------------------------------------

/**
 * Extract a row/col path array from a CellDatum given an ordered axis list.
 * Null/undefined values are coerced to 'None' for consistency with SuperGrid.
 */
function extractPath(cell: CellDatum, axes: AxisMapping[]): string[] {
	return axes.map((axis) => String(cell[axis.field] ?? 'None'));
}

// ---------------------------------------------------------------------------
// BridgeDataAdapter
// ---------------------------------------------------------------------------

/**
 * Production DataAdapter implementation bridging WorkerBridge + providers to PivotGrid.
 * Replaces the hardcoded PivotMockData usage in PivotTable when a real bridge is provided.
 */
export class BridgeDataAdapter implements DataAdapter {
	private _bridge: SuperGridBridgeLike;
	private _provider: SuperGridProviderLike;
	private _filter: SuperGridFilterLike;
	private _density: SuperGridDensityLike;
	private _coordinator: { subscribe(cb: () => void): () => void };
	private _schema: unknown | null;
	private _calcExplorer: { getConfig(): unknown } | null;
	private _depthGetter: (() => number) | null;

	constructor(options: BridgeDataAdapterOptions) {
		this._bridge = options.bridge;
		this._provider = options.provider;
		this._filter = options.filter;
		this._density = options.density;
		this._coordinator = options.coordinator;
		this._schema = options.schema ?? null;
		this._calcExplorer = options.calcExplorer ?? null;
		this._depthGetter = options.depthGetter ?? null;
	}

	getAllDimensions(): HeaderDimension[] {
		// When SchemaProvider is wired, return all axis-eligible schema columns.
		// This populates the Available zone in PivotConfigPanel with the full field list.
		if (
			this._schema !== null &&
			typeof this._schema === 'object' &&
			typeof (this._schema as { getAxisColumns?: unknown }).getAxisColumns === 'function'
		) {
			const schemaWithAxes = this._schema as { getAxisColumns(): ReadonlyArray<{ name: string }> };
			return schemaWithAxes.getAxisColumns().map((col) => ({
				id: col.name,
				type: col.name as HeaderDimension['type'],
				name: col.name,
				values: [],
			}));
		}
		// Fallback when SchemaProvider is not yet wired: return currently-assigned axes only.
		const { rowAxes, colAxes } = this._provider.getStackedGroupBySQL();
		const seen = new Set<string>();
		const all: HeaderDimension[] = [];
		for (const axis of [...rowAxes, ...colAxes]) {
			if (!seen.has(axis.field)) {
				seen.add(axis.field);
				all.push(axisToHeaderDimension(axis));
			}
		}
		return all;
	}

	getRowDimensions(): HeaderDimension[] {
		const { rowAxes } = this._provider.getStackedGroupBySQL();
		return rowAxes.map(axisToHeaderDimension);
	}

	getColDimensions(): HeaderDimension[] {
		const { colAxes } = this._provider.getStackedGroupBySQL();
		return colAxes.map(axisToHeaderDimension);
	}

	setRowDimensions(dims: HeaderDimension[]): void {
		this._provider.setRowAxes(dims.map(headerDimensionToAxis));
	}

	setColDimensions(dims: HeaderDimension[]): void {
		this._provider.setColAxes(dims.map(headerDimensionToAxis));
	}

	async fetchData(rows: HeaderDimension[], cols: HeaderDimension[]): Promise<FetchDataResult> {
		const { where, params } = this._filter.compile();
		const densityState = this._density.getState();

		// Build the axes from the current dimension configuration
		const rowAxes: AxisMapping[] = rows.map(headerDimensionToAxis);
		let colAxes: AxisMapping[] = cols.map(headerDimensionToAxis);

		// Apply depth slicing: if a depth getter is set and depth > 0, limit colAxes (SGFX-01)
		if (this._depthGetter !== null) {
			const depth = this._depthGetter();
			if (depth > 0) {
				colAxes = colAxes.slice(0, depth);
			}
		}

		const cells = await this._bridge.superGridQuery({
			rowAxes,
			colAxes,
			where,
			params,
			granularity: densityState.axisGranularity,
		});

		// Convert CellDatum[] to Map<string, number|null> using getCellKey format
		// Key format: rowPath.join('|')::colPath.join('|') — matches PivotGrid's getCellKey
		// Also extract unique row/col combinations from the query results so PivotGrid
		// can render real axis values without relying on static HeaderDimension.values.
		const data = new Map<string, number | null>();
		const rowSet = new Map<string, string[]>(); // key: joined path, value: path array
		const colSet = new Map<string, string[]>();

		for (const cell of cells) {
			const rowPath = extractPath(cell, rowAxes);
			const colPath = extractPath(cell, colAxes);
			const key = getCellKey(rowPath, colPath);
			data.set(key, cell.count ?? null);

			const rowKey = rowPath.join('|');
			if (!rowSet.has(rowKey)) rowSet.set(rowKey, rowPath);
			const colKey = colPath.join('|');
			if (!colSet.has(colKey)) colSet.set(colKey, colPath);
		}

		// Sort combinations for stable display order (alphabetical per level)
		const rowCombinations = [...rowSet.values()].sort((a, b) => {
			for (let i = 0; i < a.length; i++) {
				const cmp = (a[i] ?? '').localeCompare(b[i] ?? '');
				if (cmp !== 0) return cmp;
			}
			return 0;
		});
		const colCombinations = [...colSet.values()].sort((a, b) => {
			for (let i = 0; i < a.length; i++) {
				const cmp = (a[i] ?? '').localeCompare(b[i] ?? '');
				if (cmp !== 0) return cmp;
			}
			return 0;
		});

		return { data, rowCombinations, colCombinations };
	}

	subscribe(cb: () => void): () => void {
		return this._coordinator.subscribe(cb);
	}

	getProviderContext(): Record<string, unknown> {
		return {
			bridge: this._bridge,
			provider: this._provider,
			filter: this._filter,
			density: this._density,
			schema: this._schema,
			calcExplorer: this._calcExplorer,
			depthGetter: this._depthGetter,
		};
	}

	// ---------------------------------------------------------------------------
	// Post-construction setters (same API surface as monolithic SuperGrid)
	// ---------------------------------------------------------------------------

	/** Wire a CalcExplorer for footer row aggregation (Phase 62). */
	setCalcExplorer(explorer: { getConfig(): unknown } | null): void {
		this._calcExplorer = explorer;
	}

	/** Wire a SchemaProvider for dynamic time/numeric field classification (DYNM-10). */
	setSchemaProvider(sp: unknown | null): void {
		this._schema = sp;
	}

	/** Wire a depth getter from PropertiesExplorer (SGFX-01). */
	setDepthGetter(getter: (() => number) | null): void {
		this._depthGetter = getter;
	}
}
