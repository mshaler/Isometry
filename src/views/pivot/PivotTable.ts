// Isometry v5 — Phase 97 PivotTable
// Main orchestrator for the self-contained D3 pivot table.
//
// Design:
//   - Manages dimension assignment state (rows, cols, available)
//   - Wires PivotConfigPanel callbacks to state mutations
//   - Triggers PivotGrid re-render on every state change
//   - Self-contained: uses mock data, no external provider dependencies
//
// Requirements: PIV-14

import type { HeaderDimension, PivotState } from './PivotTypes';
import { allDimensions, generateMockData } from './PivotMockData';
import { PivotGrid } from './PivotGrid';
import { PivotConfigPanel } from './PivotConfigPanel';
import type { PluginRegistry } from './plugins/PluginRegistry';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_ROW_DIMS: HeaderDimension[] = [
	allDimensions.find((d) => d.type === 'folder')!,
	allDimensions.find((d) => d.type === 'subfolder')!,
	allDimensions.find((d) => d.type === 'tag')!,
];

const DEFAULT_COL_DIMS: HeaderDimension[] = [
	allDimensions.find((d) => d.type === 'year')!,
	allDimensions.find((d) => d.type === 'month')!,
	allDimensions.find((d) => d.type === 'day')!,
];

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
}

export class PivotTable {
	private _rootEl: HTMLDivElement | null = null;
	private _headerEl: HTMLDivElement | null = null;
	private _configContainer: HTMLDivElement | null = null;
	private _gridContainer: HTMLDivElement | null = null;

	private _configPanel: PivotConfigPanel;
	private _grid: PivotGrid;
	private _registry: PluginRegistry | null;

	// State
	private _state: PivotState;

	constructor(options?: PivotTableOptions) {
		this._configPanel = new PivotConfigPanel();
		this._grid = new PivotGrid();
		this._registry = options?.registry ?? null;
		this._state = {
			rowDimensions: options?.rowDimensions ?? [...DEFAULT_ROW_DIMS],
			colDimensions: options?.colDimensions ?? [...DEFAULT_COL_DIMS],
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
		this._rootEl.className = 'pv-root';
		this._rootEl.style.cssText = 'display:flex;flex-direction:column;height:100%;';

		// Header bar
		this._headerEl = document.createElement('div');
		this._headerEl.className = 'pv-header';
		this._headerEl.style.cssText =
			'background:var(--pv-surface,white);border-bottom:1px solid var(--pv-gridline,#e5e7eb);padding:16px 24px;';
		const h1 = document.createElement('h1');
		h1.textContent = 'SuperGrid';
		h1.style.cssText = 'font-size:1.5rem;font-weight:700;color:var(--pv-fg,#111827);margin:0;';
		this._headerEl.appendChild(h1);
		this._rootEl.appendChild(this._headerEl);

		// Config panel area
		this._configContainer = document.createElement('div');
		this._configContainer.style.cssText =
			'background:var(--pv-surface,white);border-bottom:1px solid var(--pv-gridline,#e5e7eb);padding:16px 24px;';
		this._configPanel.mount(this._configContainer);
		this._rootEl.appendChild(this._configContainer);

		// Grid area (flex:1 fills remaining space)
		this._gridContainer = document.createElement('div');
		this._gridContainer.className = 'pv-grid-wrapper';
		this._gridContainer.style.cssText = 'flex:1;padding:24px;overflow:auto;';
		this._grid.mount(this._gridContainer);
		this._rootEl.appendChild(this._gridContainer);

		container.appendChild(this._rootEl);

		// Initial render
		this._renderAll();
	}

	destroy(): void {
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
		return allDimensions.filter(
			(d) =>
				!this._state.rowDimensions.some((rd) => rd.id === d.id) &&
				!this._state.colDimensions.some((cd) => cd.id === d.id),
		);
	}

	private _handleDropToRow = (
		dimension: HeaderDimension,
		sourceZone: string,
		insertIndex?: number,
	): void => {
		// Remove from source
		if (sourceZone === 'column') {
			this._state.colDimensions = this._state.colDimensions.filter(
				(d) => d.id !== dimension.id,
			);
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
		this._renderAll();
	};

	private _handleDropToCol = (
		dimension: HeaderDimension,
		sourceZone: string,
		insertIndex?: number,
	): void => {
		if (sourceZone === 'row') {
			this._state.rowDimensions = this._state.rowDimensions.filter(
				(d) => d.id !== dimension.id,
			);
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
		this._renderAll();
	};

	private _handleDropToAvailable = (dimension: HeaderDimension, sourceZone: string): void => {
		if (sourceZone === 'row') {
			this._state.rowDimensions = this._state.rowDimensions.filter(
				(d) => d.id !== dimension.id,
			);
		} else if (sourceZone === 'column') {
			this._state.colDimensions = this._state.colDimensions.filter(
				(d) => d.id !== dimension.id,
			);
		}
		this._renderAll();
	};

	private _handleRemoveFromRow = (dimensionId: string): void => {
		this._state.rowDimensions = this._state.rowDimensions.filter(
			(d) => d.id !== dimensionId,
		);
		this._renderAll();
	};

	private _handleRemoveFromCol = (dimensionId: string): void => {
		this._state.colDimensions = this._state.colDimensions.filter(
			(d) => d.id !== dimensionId,
		);
		this._renderAll();
	};

	private _handleTranspose = (): void => {
		const temp = this._state.rowDimensions;
		this._state.rowDimensions = this._state.colDimensions;
		this._state.colDimensions = temp;
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

		// Generate mock data for current configuration
		const data = generateMockData(
			this._state.rowDimensions,
			this._state.colDimensions,
			12345, // Stable seed for consistent rendering
		);

		// Re-render grid
		this._grid.render(this._state.rowDimensions, this._state.colDimensions, data, {
			hideEmptyRows: this._state.hideEmptyRows,
			hideEmptyCols: this._state.hideEmptyCols,
		});
	}
}
