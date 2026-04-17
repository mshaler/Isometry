// Isometry v5 — Phase 122 Plan 02
// CatalogSuperGrid: uses PivotTable + CatalogDataAdapter instead of monolithic SuperGrid.
// Queries the datasets table (not cards) via datasets:query Worker handler.
// Provides CatalogDataAdapter implementing DataAdapter so PivotTable renders datasets.
//
// Design:
//   - CatalogProviderAdapter: fixed col axes (one per dataset field), no rows
//   - CatalogBridgeAdapter: converts datasets:query results into CellDatum[]
//   - CatalogFilterAdapter: no-op (datasets table needs no filtering)
//   - CatalogDataAdapter: implements DataAdapter, wraps the above adapters
//   - CatalogSuperGrid: orchestrates mount/refresh/destroy, event delegation for clicks
//   - data-row-key stamping: MutationObserver stamps data-row-key on PivotGrid <tr>s
//     after each render so the click handler can identify dataset rows.
//
// Requirements: DEXP-01, DEXP-03, DEXP-07, CONV-04

import * as d3 from 'd3';
import '../styles/catalog-actions.css';
import type { AggregationMode, AxisMapping } from '../providers/types';
import type { AppDialog } from '../ui/AppDialog';
import type { CellDatum, SuperGridQueryConfig } from '../worker/protocol';
import type { WorkerBridge } from '../worker/WorkerBridge';
import type { DataAdapter, FetchDataResult } from './pivot/DataAdapter';
import { getCellKey } from './pivot/PivotMockData';
import { PivotTable } from './pivot/PivotTable';
import type { HeaderDimension } from './pivot/PivotTypes';
import type { SortEntry } from './supergrid/SortState';
import type {
	CalcQueryPayload,
	CalcQueryResult,
	SuperGridBridgeLike,
	SuperGridFilterLike,
	SuperGridProviderLike,
} from './types';

// ---------------------------------------------------------------------------
// Catalog field definitions (fixed schema)
// ---------------------------------------------------------------------------

const CATALOG_FIELDS = [
	'name',
	'source_type',
	'card_count',
	'connection_count',
	'last_imported_at',
	'actions',
] as const;

type CatalogField = (typeof CATALOG_FIELDS)[number];

// Synthetic row dimension ID for dataset grouping
const DATASET_DIM = 'dataset';

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
	/** Cached active row key from most recent datasets:query response (dataset id as string, or null) */
	activeRowKey: string | null = null;

	/** Cached datasets from most recent query for field value lookup */
	lastDatasets: Array<Record<string, unknown>> = [];

	constructor(private _bridge: WorkerBridge) {}

	async superGridQuery(_config: SuperGridQueryConfig): Promise<CellDatum[]> {
		// Query datasets table via Plan 01 handler
		const datasets = await this._bridge.send('datasets:query', {});

		// Cache datasets for click handler field lookups
		this.lastDatasets = datasets;

		// Cache active row key for isActive detection in click handler and highlight pass
		this.activeRowKey = datasets.find((ds) => ds['is_active'])?.['id']?.toString() ?? null;

		// Convert each dataset row into a set of CellDatum (one per visible field).
		// PivotTable renders one row per dataset. Each field becomes a cell.
		// col_key = field name, row_key = dataset id
		// card_ids contains the dataset id for click interception via event delegation
		return datasets.flatMap((ds) => {
			const lastImportedRaw = ds['last_imported_at'];
			const lastImported = lastImportedRaw ? new Date(String(lastImportedRaw)).toLocaleDateString() : '—';

			const fields: Array<{ field: string; value: string }> = [
				{ field: 'name', value: String(ds['name'] ?? '') },
				{ field: 'source_type', value: String(ds['source_type'] ?? '') },
				{ field: 'card_count', value: String(ds['card_count'] ?? 0) },
				{ field: 'connection_count', value: String(ds['connection_count'] ?? 0) },
				{ field: 'last_imported_at', value: lastImported },
				{ field: 'actions', value: '' },
			];

			const dsId = String(ds['id'] ?? '');
			return fields.map((f) => ({
				col_key: f.field,
				row_key: dsId,
				// Encode is_active in count: PivotTable uses count for cell value display.
				// Active row (count=1) can be styled via CSS targeting count badge.
				count: ds['is_active'] ? 1 : 0,
				card_ids: [dsId],
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
// CatalogDataAdapter — implements DataAdapter
// ---------------------------------------------------------------------------

/**
 * DataAdapter implementation for CatalogSuperGrid.
 * Maps datasets to rows and field names to columns.
 * Wraps CatalogBridgeAdapter for data fetching.
 *
 * Dimension layout:
 *   - rowDimensions: [{ id: DATASET_DIM, values: [dataset IDs] }]
 *   - colDimensions: [{ id: 'field', values: CATALOG_FIELDS }]
 *   - cell key format: getCellKey([datasetId], [fieldName])
 *   - cell value: 1 for active row, 0 for inactive (numeric only — PivotGrid limitation)
 *
 * Note: PivotTable only renders numeric values in cells. Field text values
 * (name, source_type, etc.) are stored in CatalogBridgeAdapter.lastDatasets
 * and exposed to click handlers via CatalogSuperGrid's DOM-level observer.
 */
class CatalogDataAdapter implements DataAdapter {
	private _bridgeAdapter: CatalogBridgeAdapter;
	private _coordinator: { subscribe(cb: () => void): () => void };
	// Cached dataset IDs from last fetch — used to populate row dimension values
	private _datasetIds: string[] = [];
	// Row dimension with current dataset IDs
	private _rowDims: HeaderDimension[] = [];
	// Column dimensions (fixed field names)
	private _colDims: HeaderDimension[] = [
		{
			id: 'field' as HeaderDimension['type'],
			type: 'field' as HeaderDimension['type'],
			name: 'Field',
			values: [...CATALOG_FIELDS],
		},
	];

	constructor(bridgeAdapter: CatalogBridgeAdapter, coordinator: { subscribe(cb: () => void): () => void }) {
		this._bridgeAdapter = bridgeAdapter;
		this._coordinator = coordinator;
	}

	getAllDimensions(): HeaderDimension[] {
		return [...this._rowDims, ...this._colDims];
	}

	getRowDimensions(): HeaderDimension[] {
		return this._rowDims;
	}

	getColDimensions(): HeaderDimension[] {
		return this._colDims;
	}

	setRowDimensions(_dims: HeaderDimension[]): void {
		// Catalog rows (datasets) are fixed — no user reordering
	}

	setColDimensions(_dims: HeaderDimension[]): void {
		// Catalog columns (fields) are fixed — no user reordering
	}

	async fetchData(rows: HeaderDimension[], cols: HeaderDimension[]): Promise<FetchDataResult> {
		// Query datasets via bridge adapter (reuses same datasets:query handler)
		const cells = await this._bridgeAdapter.superGridQuery({} as SuperGridQueryConfig);

		// Build dataset ID set from cells to update row dimensions
		const seenIds = new Set<string>();
		for (const cell of cells) {
			const id = String(cell['row_key']);
			seenIds.add(id);
		}
		this._datasetIds = [...seenIds];
		// Update row dimension with current dataset IDs
		this._rowDims = [
			{
				id: DATASET_DIM as HeaderDimension['type'],
				type: DATASET_DIM as HeaderDimension['type'],
				name: 'Dataset',
				values: this._datasetIds,
			},
		];

		// Build Map<cellKey, value>
		// Key = getCellKey([datasetId], [fieldName])
		// Value = 1 for active row, 0 for inactive
		const data = new Map<string, number | null>();
		const rowSet = new Map<string, string[]>();
		const colSet = new Map<string, string[]>();

		for (const cell of cells) {
			const datasetId = String(cell['row_key']);
			const fieldName = String(cell['col_key']);
			const key = getCellKey([datasetId], [fieldName]);
			data.set(key, cell.count ?? null);

			if (!rowSet.has(datasetId)) rowSet.set(datasetId, [datasetId]);
			if (!colSet.has(fieldName)) colSet.set(fieldName, [fieldName]);
		}

		// Preserve the insertion order from the query result (datasets:query returns
		// rows in the order they were inserted — stable enough for catalog display).
		const rowCombinations = [...rowSet.values()];
		const colCombinations = [...colSet.values()];

		return { data, rowCombinations, colCombinations };
	}

	subscribe(cb: () => void): () => void {
		return this._coordinator.subscribe(cb);
	}

	/** Expose bridge adapter for access to lastDatasets and activeRowKey */
	getBridgeAdapter(): CatalogBridgeAdapter {
		return this._bridgeAdapter;
	}
}

// ---------------------------------------------------------------------------
// CatalogSuperGrid
// ---------------------------------------------------------------------------

export interface CatalogSuperGridConfig {
	bridge: WorkerBridge;
	onDatasetClick: (datasetId: string, name: string, sourceType: string, isActive: boolean) => void;
	/** Called when the delete action button is clicked for a dataset row. */
	onDeleteDataset?: (datasetId: string, name: string, cardCount: number) => void;
	/** Called when the re-import action button is clicked for a dataset row. Wired in Plan 02. */
	onReimportDataset?: (datasetId: string, name: string, sourceType: string) => void;
}

/**
 * CatalogSuperGrid wraps a PivotTable instance bound to the datasets table.
 * Provides CatalogDataAdapter implementing DataAdapter so PivotTable renders dataset rows as cells.
 *
 * Row click interception uses event delegation on the mount container — listens
 * for clicks on [data-row-key] elements. data-row-key is stamped on PivotGrid <tr>
 * elements and their child cells by a MutationObserver after each render cycle,
 * using D3's datum binding on <tr> elements (which hold the rowPath = [datasetId]).
 */
export class CatalogSuperGrid {
	private _pivotTable: PivotTable | null = null;
	private _bridgeAdapter: CatalogBridgeAdapter;
	private _filterAdapter: CatalogFilterAdapter;
	private _dataAdapter: CatalogDataAdapter;
	private _coordinatorCallbacks: Set<() => void> = new Set();
	private _config: CatalogSuperGridConfig;
	private _container: HTMLElement | null = null;
	private _clickHandler: ((e: MouseEvent) => void) | null = null;
	private _observer: MutationObserver | null = null;

	constructor(config: CatalogSuperGridConfig) {
		this._config = config;
		this._bridgeAdapter = new CatalogBridgeAdapter(config.bridge);
		this._filterAdapter = new CatalogFilterAdapter();

		// Create a mini coordinator that CatalogSuperGrid controls for refresh
		const coordinator = {
			subscribe: (cb: () => void): (() => void) => {
				this._coordinatorCallbacks.add(cb);
				return () => {
					this._coordinatorCallbacks.delete(cb);
				};
			},
		};

		this._dataAdapter = new CatalogDataAdapter(this._bridgeAdapter, coordinator);
	}

	mount(container: HTMLElement): void {
		this._container = container;

		this._pivotTable = new PivotTable({
			adapter: this._dataAdapter,
		});
		this._pivotTable.mount(container);

		// Event delegation for dataset row clicks and action button clicks.
		// data-row-key is stamped on <tr> and .pv-data-cell elements by the
		// MutationObserver below after each PivotGrid render cycle.
		const clickHandler = (e: MouseEvent): void => {
			const target = e.target as HTMLElement;

			// Check if an action button was clicked first — intercept before row click
			const actionBtn = target.closest('.catalog-actions__btn') as HTMLElement | null;
			if (actionBtn) {
				e.stopPropagation();
				const action = actionBtn.dataset['action'];
				const datasetId = actionBtn.dataset['datasetId'];
				if (!datasetId) return;

				const ds = this._bridgeAdapter.lastDatasets.find((d) => String(d['id']) === datasetId);
				const name = ds ? String(ds['name'] ?? '') : '';
				const sourceType = ds ? String(ds['source_type'] ?? '') : '';
				const cardCount = ds ? Number(ds['card_count'] ?? 0) : 0;

				if (action === 'delete' && this._config.onDeleteDataset) {
					this._config.onDeleteDataset(datasetId, name, cardCount);
				} else if (action === 'reimport' && this._config.onReimportDataset) {
					this._config.onReimportDataset(datasetId, name, sourceType);
				}
				return;
			}

			// Walk up to find an element with data-row-key
			const cellEl = target.closest('[data-row-key]') as HTMLElement | null;
			if (!cellEl) return;

			const rowKey = cellEl.dataset['rowKey'];
			if (!rowKey) return;

			// Dataset ID = rowKey (stamped from D3 rowPath[0])
			const datasetId = rowKey;

			// Determine if this dataset is active
			const isActive = String(datasetId) === String(this._bridgeAdapter.activeRowKey);

			// Look up name and source_type from cached datasets
			const ds = this._bridgeAdapter.lastDatasets.find((d) => String(d['id']) === datasetId);
			const name = ds ? String(ds['name'] ?? datasetId) : datasetId;
			const sourceType = ds ? String(ds['source_type'] ?? '') : '';

			this._config.onDatasetClick(datasetId, name, sourceType, isActive);
		};

		container.addEventListener('click', clickHandler);
		this._clickHandler = clickHandler;

		// MutationObserver: after each PivotGrid render, stamp data-row-key on
		// <tr> and .pv-data-cell elements so the click handler and active row
		// highlighter can use them.
		//
		// D3 binds rowPath arrays to <tr> elements via .data(visibleRows, (d) => d.join('|')).
		// d3.select(tr).datum() returns the rowPath array (e.g. [datasetId]).
		// We extract rowPath[0] as the dataset ID.
		const observer = new MutationObserver(() => {
			this._stampRowKeys();
			this._applyActiveRowHighlight();
			this._renderActionButtons();
		});
		observer.observe(container, { childList: true, subtree: true });
		this._observer = observer;
	}

	/**
	 * Stamp data-row-key on all <tr> elements in the PivotGrid tbody
	 * and propagate to their .pv-data-cell children.
	 * Uses d3.select(tr).datum() to read the rowPath bound by PivotGrid's D3 data join.
	 */
	private _stampRowKeys(): void {
		if (!this._container) return;
		// Disconnect observer temporarily to avoid infinite loop from our own DOM mutations
		this._observer?.disconnect();
		try {
			const rows = this._container.querySelectorAll<HTMLTableRowElement>('tbody tr');
			for (const tr of rows) {
				// D3 binds rowPath (string[]) as datum on the <tr> element
				const rowPath = d3.select(tr).datum() as string[] | undefined;
				if (!rowPath || rowPath.length === 0) continue;
				const datasetId = rowPath[0]!;

				// Stamp data-row-key on <tr> and all its .pv-data-cell children
				tr.dataset['rowKey'] = datasetId;
				const cells = tr.querySelectorAll<HTMLElement>('.pv-data-cell');
				for (const cell of cells) {
					cell.dataset['rowKey'] = datasetId;
				}
			}
		} finally {
			// Re-connect observer
			if (this._container) {
				this._observer?.observe(this._container, { childList: true, subtree: true });
			}
		}
	}

	/** Apply .data-explorer__catalog-row--active CSS class to all cells in the active dataset row */
	private _applyActiveRowHighlight(): void {
		if (!this._container) return;
		const activeKey = this._bridgeAdapter.activeRowKey;
		// Remove from all cells first
		const allCells = this._container.querySelectorAll('[data-row-key]');
		for (const cell of allCells) {
			cell.classList.remove('data-explorer__catalog-row--active');
		}
		// Apply to active row cells
		if (activeKey) {
			const activeCells = this._container.querySelectorAll(`[data-row-key="${CSS.escape(String(activeKey))}"]`);
			for (const cell of activeCells) {
				cell.classList.add('data-explorer__catalog-row--active');
			}
		}
	}

	/**
	 * Render action buttons (re-import ↺ and delete ✕) into the 'actions' column cell
	 * for each dataset row. Called from MutationObserver after each render cycle.
	 * Skips rows that already have buttons rendered (idempotent).
	 */
	private _renderActionButtons(): void {
		if (!this._container) return;
		// Disconnect observer temporarily to avoid infinite loop from DOM mutations
		this._observer?.disconnect();
		try {
			const rows = this._container.querySelectorAll<HTMLTableRowElement>('tbody tr');
			for (const tr of rows) {
				const cells = tr.querySelectorAll<HTMLElement>('.pv-data-cell');
				// Actions column is the last cell (index = CATALOG_FIELDS.length - 1)
				const actionsCell = cells[cells.length - 1];
				if (!actionsCell || actionsCell.querySelector('.catalog-actions__btn')) continue; // Already rendered

				const rowKey = tr.dataset['rowKey'];
				if (!rowKey) continue;

				// Look up dataset name for aria-labels
				const ds = this._bridgeAdapter.lastDatasets.find((d) => String(d['id']) === rowKey);
				const dsName = ds ? String(ds['name'] ?? '') : '';

				// Clear PivotGrid's default cell content
				actionsCell.textContent = '';
				actionsCell.classList.add('catalog-actions__cell');

				// Create button container
				const wrapper = document.createElement('div');
				wrapper.className = 'catalog-actions__wrapper';

				// Re-import button (↺)
				const reimportBtn = document.createElement('button');
				reimportBtn.type = 'button';
				reimportBtn.className = 'catalog-actions__btn catalog-actions__btn--reimport';
				reimportBtn.textContent = '\u21BA'; // ↺
				reimportBtn.setAttribute('aria-label', `Re-import dataset ${dsName}`);
				reimportBtn.title = 'Re-import';
				reimportBtn.dataset['action'] = 'reimport';
				reimportBtn.dataset['datasetId'] = rowKey;

				// Delete button (✕)
				const deleteBtn = document.createElement('button');
				deleteBtn.type = 'button';
				deleteBtn.className = 'catalog-actions__btn catalog-actions__btn--delete';
				deleteBtn.textContent = '\u2715'; // ✕
				deleteBtn.setAttribute('aria-label', `Delete dataset ${dsName}`);
				deleteBtn.title = 'Delete';
				deleteBtn.dataset['action'] = 'delete';
				deleteBtn.dataset['datasetId'] = rowKey;

				wrapper.appendChild(reimportBtn);
				wrapper.appendChild(deleteBtn);
				actionsCell.appendChild(wrapper);
			}
		} finally {
			// Re-connect observer
			if (this._container) {
				this._observer?.observe(this._container, { childList: true, subtree: true });
			}
		}
	}

	/** Trigger a re-fetch and re-render of the catalog grid */
	refresh(): void {
		for (const cb of this._coordinatorCallbacks) {
			cb();
		}
	}

	destroy(): void {
		this._observer?.disconnect();
		this._observer = null;
		if (this._container && this._clickHandler) {
			this._container.removeEventListener('click', this._clickHandler);
			this._clickHandler = null;
		}
		this._pivotTable?.destroy();
		this._pivotTable = null;
		this._coordinatorCallbacks.clear();
		this._container = null;
	}
}
