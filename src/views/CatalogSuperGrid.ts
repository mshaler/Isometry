// Isometry v5 — Phase 88 Plan 03
// CatalogSuperGrid: SuperGrid instance for the Data Explorer Catalog.
// Queries the datasets table (not cards) via datasets:query Worker handler.
// Provides adapter implementations for SuperGridProviderLike, SuperGridBridgeLike,
// SuperGridFilterLike so the real SuperGrid renders datasets as cells.
//
// Design:
//   - CatalogProviderAdapter: fixed col axes (one per dataset field), no rows
//   - CatalogBridgeAdapter: converts datasets:query results into CellDatum[]
//   - CatalogFilterAdapter: no-op (datasets table needs no filtering)
//   - CatalogSuperGrid: orchestrates mount/refresh/destroy, event delegation for clicks
//
// Requirements: DEXP-01, DEXP-03, DEXP-07

import type { AggregationMode, AxisMapping } from '../providers/types';
import type { AppDialog } from '../ui/AppDialog';
import type { CellDatum } from '../worker/protocol';
import type { WorkerBridge } from '../worker/WorkerBridge';
import { SuperGrid } from './SuperGrid';
import type {
	CalcQueryPayload,
	CalcQueryResult,
	SuperGridBridgeLike,
	SuperGridFilterLike,
	SuperGridProviderLike,
} from './types';
import type { SortEntry } from './supergrid/SortState';
import type { SuperGridQueryConfig } from '../worker/protocol';

// ---------------------------------------------------------------------------
// CatalogProviderAdapter — implements SuperGridProviderLike
// ---------------------------------------------------------------------------

/**
 * Provides fixed column axes for the datasets catalog — each row is a dataset,
 * each column is a field. No row axes (datasets are flat).
 */
class CatalogProviderAdapter implements SuperGridProviderLike {
	// Fixed column axes matching the datasets table fields
	private _colAxes: AxisMapping[] = [{ field: 'name' as AxisMapping['field'], direction: 'asc' }];
	private _rowAxes: AxisMapping[] = [];
	private _colWidths: Record<string, number> = {};
	private _sortOverrides: SortEntry[] = [];
	private _collapseState: Array<{ key: string; mode: 'aggregate' | 'hide' }> = [];

	getStackedGroupBySQL(): { colAxes: AxisMapping[]; rowAxes: AxisMapping[] } {
		return { colAxes: this._colAxes, rowAxes: this._rowAxes };
	}

	setColAxes(axes: AxisMapping[]): void {
		this._colAxes = axes;
	}

	setRowAxes(axes: AxisMapping[]): void {
		this._rowAxes = axes;
	}

	getColWidths(): Record<string, number> {
		return { ...this._colWidths };
	}

	setColWidths(widths: Record<string, number>): void {
		this._colWidths = widths;
	}

	getSortOverrides(): SortEntry[] {
		return [...this._sortOverrides];
	}

	setSortOverrides(sorts: SortEntry[]): void {
		this._sortOverrides = sorts;
	}

	getCollapseState(): Array<{ key: string; mode: 'aggregate' | 'hide' }> {
		return [...this._collapseState];
	}

	setCollapseState(state: Array<{ key: string; mode: 'aggregate' | 'hide' }>): void {
		this._collapseState = state;
	}

	reorderColAxes(_fromIndex: number, _toIndex: number): void {
		// Catalog columns are fixed — no reordering
	}

	reorderRowAxes(_fromIndex: number, _toIndex: number): void {
		// No row axes — no-op
	}

	getAggregation(): AggregationMode {
		return 'count';
	}
}

// ---------------------------------------------------------------------------
// CatalogBridgeAdapter — implements SuperGridBridgeLike
// ---------------------------------------------------------------------------

/**
 * Converts datasets:query results into CellDatum[] for SuperGrid rendering.
 * Each dataset becomes a row (row_key = dataset id).
 * Each field value becomes a cell (col_key = field name).
 * card_ids stores the dataset id for click identification.
 * count encodes is_active (1 = active, 0 = inactive) for row highlighting.
 */
class CatalogBridgeAdapter implements SuperGridBridgeLike {
	constructor(private _bridge: WorkerBridge) {}

	async superGridQuery(_config: SuperGridQueryConfig): Promise<CellDatum[]> {
		// Query datasets table via Plan 01 handler
		const datasets = await this._bridge.send('datasets:query', {});

		// Convert each dataset row into a set of CellDatum (one per visible field).
		// SuperGrid renders one row per dataset. Each field becomes a cell.
		// col_key = field name, row_key = dataset id
		// card_ids contains the dataset id for click interception via event delegation
		return datasets.flatMap((ds) => {
			const lastImported = ds.last_imported_at
				? new Date(ds.last_imported_at).toLocaleDateString()
				: '—';

			const fields: Array<{ field: string; value: string }> = [
				{ field: 'name', value: ds.name },
				{ field: 'source_type', value: ds.source_type },
				{ field: 'card_count', value: String(ds.card_count) },
				{ field: 'connection_count', value: String(ds.connection_count) },
				{ field: 'last_imported_at', value: lastImported },
			];

			return fields.map((f) => ({
				col_key: f.field,
				row_key: ds.id,
				// Encode is_active in count: SuperGrid uses count for badge display.
				// Active row (count=1) can be styled via CSS targeting count badge.
				count: ds.is_active ? 1 : 0,
				card_ids: [ds.id],
				card_names: [f.value],
			}));
		});
	}

	async calcQuery(_payload: CalcQueryPayload): Promise<CalcQueryResult> {
		// No calc footer for catalog — return empty result
		return { rows: [] };
	}
}

// ---------------------------------------------------------------------------
// CatalogFilterAdapter — implements SuperGridFilterLike
// ---------------------------------------------------------------------------

/**
 * No-op filter adapter for the datasets catalog.
 * The catalog shows all datasets — no filtering needed.
 */
class CatalogFilterAdapter implements SuperGridFilterLike {
	compile(): { where: string; params: unknown[] } {
		return { where: '', params: [] };
	}

	hasAxisFilter(_field: string): boolean {
		return false;
	}

	getAxisFilter(_field: string): string[] {
		return [];
	}

	setAxisFilter(_field: string, _values: string[]): void {
		// No-op
	}

	clearAxis(_field: string): void {
		// No-op
	}

	clearAllAxisFilters(): void {
		// No-op
	}
}

// ---------------------------------------------------------------------------
// CatalogSuperGrid
// ---------------------------------------------------------------------------

export interface CatalogSuperGridConfig {
	bridge: WorkerBridge;
	onDatasetClick: (datasetId: string, name: string, sourceType: string, isActive: boolean) => void;
}

/**
 * CatalogSuperGrid wraps a real SuperGrid instance bound to the datasets table.
 * Provides adapter implementations for SuperGridProviderLike, SuperGridBridgeLike,
 * and SuperGridFilterLike so the SuperGrid renders dataset rows as cells.
 *
 * Row click interception uses event delegation on the mount container — listens
 * for clicks on .sg-cell elements and extracts dataset id from the cell's row_key
 * data attribute (SuperGrid stamps data-row-key on each cell element).
 */
export class CatalogSuperGrid {
	private _superGrid: SuperGrid | null = null;
	private _provider: CatalogProviderAdapter;
	private _bridgeAdapter: CatalogBridgeAdapter;
	private _filterAdapter: CatalogFilterAdapter;
	private _coordinatorCallbacks: Set<() => void> = new Set();
	private _config: CatalogSuperGridConfig;
	private _container: HTMLElement | null = null;
	private _clickHandler: ((e: MouseEvent) => void) | null = null;

	constructor(config: CatalogSuperGridConfig) {
		this._config = config;
		this._provider = new CatalogProviderAdapter();
		this._bridgeAdapter = new CatalogBridgeAdapter(config.bridge);
		this._filterAdapter = new CatalogFilterAdapter();
	}

	mount(container: HTMLElement): void {
		this._container = container;

		// Create a mini coordinator that CatalogSuperGrid controls for refresh
		const coordinator = {
			subscribe: (cb: () => void): (() => void) => {
				this._coordinatorCallbacks.add(cb);
				return () => {
					this._coordinatorCallbacks.delete(cb);
				};
			},
		};

		this._superGrid = new SuperGrid(
			this._provider,
			this._filterAdapter,
			this._bridgeAdapter,
			coordinator,
		);
		this._superGrid.mount(container);

		// Event delegation for dataset row clicks.
		// SuperGrid stamps data-row-key and data-col-key on each cell element.
		// We intercept clicks on cells and call onDatasetClick with the dataset id.
		// card_ids[0] = dataset id (set in CatalogBridgeAdapter).
		// count = is_active (1 = active, 0 = inactive).
		const clickHandler = (e: MouseEvent): void => {
			const target = e.target as HTMLElement;
			// Walk up to find the cell element (SuperGrid renders .sg-cell divs)
			const cellEl = target.closest('[data-row-key]') as HTMLElement | null;
			if (!cellEl) return;

			const rowKey = cellEl.dataset['rowKey'];
			if (!rowKey) return;

			// Find the dataset id from the row_key (which is the dataset id in our adapter)
			const datasetId = rowKey;

			// Determine if this dataset is active by checking all cells in this row.
			// The count attribute encodes is_active (1 = active, 0 = inactive).
			// We check the data-count attribute that SuperGrid stamps on cells.
			const countAttr = cellEl.dataset['count'];
			const isActive = countAttr === '1';

			// Derive name from other cells in the same row
			// Look for a cell with col_key = 'name' in the same row
			let name = datasetId;
			const nameCell = container.querySelector(`[data-row-key="${CSS.escape(datasetId)}"][data-col-key="name"]`) as HTMLElement | null;
			if (nameCell) {
				name = nameCell.textContent?.trim() ?? datasetId;
			}

			// Derive source_type from the source_type cell
			let sourceType = '';
			const sourceCell = container.querySelector(`[data-row-key="${CSS.escape(datasetId)}"][data-col-key="source_type"]`) as HTMLElement | null;
			if (sourceCell) {
				sourceType = sourceCell.textContent?.trim() ?? '';
			}

			this._config.onDatasetClick(datasetId, name, sourceType, isActive);
		};

		container.addEventListener('click', clickHandler);
		this._clickHandler = clickHandler;
	}

	/** Trigger a re-fetch and re-render of the catalog grid */
	refresh(): void {
		for (const cb of this._coordinatorCallbacks) {
			cb();
		}
	}

	destroy(): void {
		if (this._container && this._clickHandler) {
			this._container.removeEventListener('click', this._clickHandler);
			this._clickHandler = null;
		}
		this._superGrid?.destroy();
		this._superGrid = null;
		this._coordinatorCallbacks.clear();
		this._container = null;
	}
}
