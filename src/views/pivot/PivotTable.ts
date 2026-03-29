// Isometry v5 — Phase 97 PivotTable
// Main orchestrator for the self-contained D3 pivot table.
//
// Design:
//   - Manages dimension assignment state (rows, cols, available)
//   - Wires PivotConfigPanel callbacks to state mutations
//   - Triggers PivotGrid re-render on every state change
//   - Accepts a DataAdapter for flexible data sourcing (mock or production bridge)
//   - Self-contained when no adapter is provided: defaults to MockDataAdapter
//
// Requirements: PIV-14, CONV-01

import '../../styles/pivot.css';
import styles from '../../styles/pivot.module.css';
import type { DataAdapter } from './DataAdapter';
import { MockDataAdapter } from './MockDataAdapter';
import { PivotConfigPanel } from './PivotConfigPanel';
import { PivotGrid } from './PivotGrid';
import type { HeaderDimension, PivotState } from './PivotTypes';
import type { PluginRegistry } from './plugins/PluginRegistry';

// ---------------------------------------------------------------------------
// PivotTable
// ---------------------------------------------------------------------------

export interface PivotTableOptions {
	/** Override default row dimensions (for testing with smaller data sets). */
	rowDimensions?: HeaderDimension[];
	/** Override default column dimensions. */
	colDimensions?: HeaderDimension[];
	/** Optional plugin registry — enables plugin hooks during render cycle. */
	registry?: PluginRegistry;
	/** Optional data adapter — defaults to MockDataAdapter when not provided. */
	adapter?: DataAdapter;
}

export class PivotTable {
	private _rootEl: HTMLDivElement | null = null;
	private _headerEl: HTMLDivElement | null = null;
	private _configContainer: HTMLDivElement | null = null;
	private _gridContainer: HTMLDivElement | null = null;

	// Empty state / error banner overlay elements
	private _emptyEl: HTMLElement | null = null;
	private _errorEl: HTMLElement | null = null;

	private _configPanel: PivotConfigPanel;
	private _grid: PivotGrid;
	private _registry: PluginRegistry | null;
	private _adapter: DataAdapter;

	// Unsubscribe from adapter's external change notifications
	private _adapterUnsub: (() => void) | null = null;

	// State
	private _state: PivotState;

	constructor(options?: PivotTableOptions) {
		this._configPanel = new PivotConfigPanel();
		this._grid = new PivotGrid();
		this._registry = options?.registry ?? null;
		this._adapter = options?.adapter ?? new MockDataAdapter();

		this._state = {
			rowDimensions: options?.rowDimensions ?? [...this._adapter.getRowDimensions()],
			colDimensions: options?.colDimensions ?? [...this._adapter.getColDimensions()],
			hideEmptyRows: false,
			hideEmptyCols: false,
			sizes: { headerWidth: 120, headerHeight: 32, cellWidth: 100, cellHeight: 32 },
		};

		// Wire registry into grid if provided
		if (this._registry) {
			this._grid.setRegistry(this._registry);
		}
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	mount(container: HTMLElement): void {
		this._rootEl = document.createElement('div');
		this._rootEl.className = styles.pvRoot;
		this._rootEl.style.cssText = 'display:flex;flex-direction:column;position:absolute;inset:0;overflow:hidden;';
		this._rootEl.setAttribute('data-tour-target', 'supergrid');

		// Header bar — fixed height, never shrinks
		this._headerEl = document.createElement('div');
		this._headerEl.className = styles.pvHeader;
		this._headerEl.style.cssText =
			'flex-shrink:0;background:var(--pv-surface,white);border-bottom:1px solid var(--pv-gridline,#e5e7eb);padding:16px 24px;';
		const h1 = document.createElement('h1');
		h1.textContent = 'SuperGrid';
		h1.style.cssText = 'font-size:1.5rem;font-weight:700;color:var(--pv-fg,#111827);margin:0;';
		this._headerEl.appendChild(h1);
		this._rootEl.appendChild(this._headerEl);

		// Config panel area — scrollable, capped at 30% to guarantee grid space
		this._configContainer = document.createElement('div');
		this._configContainer.style.cssText =
			'flex-shrink:0;max-height:30%;overflow-y:auto;background:var(--pv-surface,white);border-bottom:1px solid var(--pv-gridline,#e5e7eb);padding:16px 24px;';
		this._configPanel.mount(this._configContainer);
		this._rootEl.appendChild(this._configContainer);

		// Grid area (flex:1 fills remaining space)
		this._gridContainer = document.createElement('div');
		this._gridContainer.className = styles.pvGridWrapper;
		this._gridContainer.style.cssText = 'flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;';
		this._grid.mount(this._gridContainer);
		this._rootEl.appendChild(this._gridContainer);

		container.appendChild(this._rootEl);

		// Subscribe to external data changes (e.g., StateCoordinator updates via BridgeDataAdapter).
		// On each external change, sync _state.rowDimensions/colDimensions from the adapter's
		// current state before re-rendering. This keeps PivotTable in sync when an external
		// source (e.g. ProjectionExplorer) changes pafv axes directly.
		if (this._adapter.subscribe) {
			this._adapterUnsub = this._adapter.subscribe(() => {
				this._state.rowDimensions = [...this._adapter.getRowDimensions()];
				this._state.colDimensions = [...this._adapter.getColDimensions()];
				this._renderAll();
			});
		}

		// Initial render
		this._renderAll();
	}

	destroy(): void {
		// Unsubscribe from adapter external changes
		this._adapterUnsub?.();
		this._adapterUnsub = null;

		this._clearEmptyState();
		this._clearErrorBanner();

		this._configPanel.destroy();
		this._grid.destroy();
		this._rootEl?.remove();
		this._rootEl = null;
		this._headerEl = null;
		this._configContainer = null;
		this._gridContainer = null;
	}

	// -----------------------------------------------------------------------
	// Public API
	// -----------------------------------------------------------------------

	/**
	 * Trigger a full re-render with the current state.
	 * Used by HarnessShell when the PluginRegistry signals a toggle change.
	 */
	rerender(): void {
		this._renderAll();
	}

	// -----------------------------------------------------------------------
	// State mutations
	// -----------------------------------------------------------------------

	private _getAvailable(): HeaderDimension[] {
		return this._adapter
			.getAllDimensions()
			.filter(
				(d) =>
					!this._state.rowDimensions.some((rd) => rd.id === d.id) &&
					!this._state.colDimensions.some((cd) => cd.id === d.id),
			);
	}

	private _handleDropToRow = (dimension: HeaderDimension, sourceZone: string, insertIndex?: number): void => {
		// Remove from source
		if (sourceZone === 'column') {
			this._state.colDimensions = this._state.colDimensions.filter((d) => d.id !== dimension.id);
		}
		// Remove from current position (if same-zone reorder)
		const filtered = this._state.rowDimensions.filter((d) => d.id !== dimension.id);

		if (insertIndex !== undefined && insertIndex >= 0) {
			// Insert at specific position (within-zone reorder or cross-zone with position)
			filtered.splice(insertIndex, 0, dimension);
			this._state.rowDimensions = filtered;
		} else if (!this._state.rowDimensions.some((d) => d.id === dimension.id)) {
			// Append to end (cross-zone without position)
			this._state.rowDimensions = [...filtered, dimension];
		} else {
			this._state.rowDimensions = filtered;
			this._state.rowDimensions.push(dimension);
		}
		this._adapter.setRowDimensions(this._state.rowDimensions);
		this._renderAll();
	};

	private _handleDropToCol = (dimension: HeaderDimension, sourceZone: string, insertIndex?: number): void => {
		if (sourceZone === 'row') {
			this._state.rowDimensions = this._state.rowDimensions.filter((d) => d.id !== dimension.id);
		}
		const filtered = this._state.colDimensions.filter((d) => d.id !== dimension.id);

		if (insertIndex !== undefined && insertIndex >= 0) {
			filtered.splice(insertIndex, 0, dimension);
			this._state.colDimensions = filtered;
		} else if (!this._state.colDimensions.some((d) => d.id === dimension.id)) {
			this._state.colDimensions = [...filtered, dimension];
		} else {
			this._state.colDimensions = filtered;
			this._state.colDimensions.push(dimension);
		}
		this._adapter.setColDimensions(this._state.colDimensions);
		this._renderAll();
	};

	private _handleDropToAvailable = (dimension: HeaderDimension, sourceZone: string): void => {
		if (sourceZone === 'row') {
			this._state.rowDimensions = this._state.rowDimensions.filter((d) => d.id !== dimension.id);
		} else if (sourceZone === 'column') {
			this._state.colDimensions = this._state.colDimensions.filter((d) => d.id !== dimension.id);
		}
		this._renderAll();
	};

	private _handleRemoveFromRow = (dimensionId: string): void => {
		this._state.rowDimensions = this._state.rowDimensions.filter((d) => d.id !== dimensionId);
		this._adapter.setRowDimensions(this._state.rowDimensions);
		this._renderAll();
	};

	private _handleRemoveFromCol = (dimensionId: string): void => {
		this._state.colDimensions = this._state.colDimensions.filter((d) => d.id !== dimensionId);
		this._adapter.setColDimensions(this._state.colDimensions);
		this._renderAll();
	};

	private _handleTranspose = (): void => {
		const temp = this._state.rowDimensions;
		this._state.rowDimensions = this._state.colDimensions;
		this._state.colDimensions = temp;
		this._adapter.setRowDimensions(this._state.rowDimensions);
		this._adapter.setColDimensions(this._state.colDimensions);
		this._renderAll();
	};

	private _handleToggleHideEmptyRows = (): void => {
		this._state.hideEmptyRows = !this._state.hideEmptyRows;
		this._renderAll();
	};

	private _handleToggleHideEmptyCols = (): void => {
		this._state.hideEmptyCols = !this._state.hideEmptyCols;
		this._renderAll();
	};

	// -----------------------------------------------------------------------
	// Full render
	// -----------------------------------------------------------------------

	private _renderAll(): void {
		// Re-render config panel
		this._configPanel.render({
			rowDimensions: this._state.rowDimensions,
			colDimensions: this._state.colDimensions,
			availableDimensions: this._getAvailable(),
			hideEmptyRows: this._state.hideEmptyRows,
			hideEmptyCols: this._state.hideEmptyCols,
			onDropToRow: this._handleDropToRow,
			onDropToCol: this._handleDropToCol,
			onDropToAvailable: this._handleDropToAvailable,
			onRemoveFromRow: this._handleRemoveFromRow,
			onRemoveFromCol: this._handleRemoveFromCol,
			onTranspose: this._handleTranspose,
			onToggleHideEmptyRows: this._handleToggleHideEmptyRows,
			onToggleHideEmptyCols: this._handleToggleHideEmptyCols,
		});

		// Empty state: no axes configured (no-axes state — skip fetchData entirely)
		const hasAxes = this._state.rowDimensions.length > 0 && this._state.colDimensions.length > 0;

		if (!hasAxes) {
			this._showEmptyState('no-axes');
			return;
		}

		// Fetch data from adapter and render grid
		this._adapter
			.fetchData(this._state.rowDimensions, this._state.colDimensions)
			.then((result) => {
				// Empty state: axes set but query returned zero rows
				if (result.data.size === 0) {
					this._showEmptyState('no-data');
					return;
				}
				this._clearEmptyState();
				this._clearErrorBanner();
				this._grid.render(
					this._state.rowDimensions,
					this._state.colDimensions,
					result.data,
					result.rowCombinations,
					result.colCombinations,
					{
						hideEmptyRows: this._state.hideEmptyRows,
						hideEmptyCols: this._state.hideEmptyCols,
					},
				);
			})
			.catch((err: unknown) => {
				console.error('[PivotTable] fetchData failed:', err);
				this._showErrorBanner();
			});
	}

	// -----------------------------------------------------------------------
	// Empty state / error banner
	// -----------------------------------------------------------------------

	private _showEmptyState(type: 'no-axes' | 'no-data'): void {
		this._clearErrorBanner();
		if (this._gridContainer) this._gridContainer.style.display = 'none';

		if (!this._emptyEl) {
			this._emptyEl = document.createElement('div');
			this._emptyEl.className = 'view-empty-panel';
			this._emptyEl.style.cssText =
				'display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;' +
				'padding:var(--space-xl);gap:var(--space-sm);text-align:center;';
			this._rootEl?.appendChild(this._emptyEl);
		}

		if (type === 'no-axes') {
			this._emptyEl.innerHTML = `
				<h2 style="font-size:var(--text-xl);font-weight:700;margin:0;">No axes configured</h2>
				<p style="font-size:var(--text-md);color:var(--text-muted);margin:0;">Drag a field to the Row or Column zone to build the grid.</p>
				<button class="sg-empty-cta" style="margin-top:var(--space-sm);padding:var(--space-xs) var(--space-lg);border:1px solid var(--accent);color:var(--accent);background:transparent;border-radius:4px;cursor:pointer;font-size:var(--text-md);">Configure Axes</button>
			`;
		} else {
			this._emptyEl.innerHTML = `
				<h2 style="font-size:var(--text-xl);font-weight:700;margin:0;">No matching cards</h2>
				<p style="font-size:var(--text-md);color:var(--text-muted);margin:0;">Current filters returned no results. Clear filters or import more data.</p>
				<button class="sg-empty-cta" style="margin-top:var(--space-sm);padding:var(--space-xs) var(--space-lg);border:1px solid var(--accent);color:var(--accent);background:transparent;border-radius:4px;cursor:pointer;font-size:var(--text-md);">Import Data</button>
			`;
		}
	}

	private _clearEmptyState(): void {
		if (this._emptyEl) {
			this._emptyEl.remove();
			this._emptyEl = null;
		}
		if (this._gridContainer) this._gridContainer.style.display = 'flex';
	}

	private _showErrorBanner(): void {
		this._clearEmptyState();
		if (this._gridContainer) this._gridContainer.style.display = 'none';

		if (!this._errorEl) {
			this._errorEl = document.createElement('div');
			this._errorEl.className = 'view-error-banner';
			this._errorEl.style.cssText =
				'padding:var(--space-md);background:var(--danger-bg);border:1px solid var(--danger-border);' +
				'border-radius:4px;margin:var(--space-lg);';
			this._rootEl?.appendChild(this._errorEl);
		}

		this._errorEl.innerHTML = `
			<p style="margin:0 0 var(--space-sm) 0;color:var(--text-primary);">Grid data unavailable — check the worker bridge connection and retry.</p>
			<button class="retry-btn" style="padding:var(--space-xs) var(--space-lg);border:1px solid var(--accent);color:var(--accent);background:transparent;border-radius:4px;cursor:pointer;font-size:var(--text-md);">Retry Query</button>
		`;

		this._errorEl.querySelector('.retry-btn')?.addEventListener('click', () => {
			this._clearErrorBanner();
			this._renderAll();
		});
	}

	private _clearErrorBanner(): void {
		if (this._errorEl) {
			this._errorEl.remove();
			this._errorEl = null;
		}
	}
}
