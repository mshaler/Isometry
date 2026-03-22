// Isometry v5 — Phase 97 PivotGrid
// D3-based pivot grid renderer with two-layer header spanning.
//
// Design:
//   - Layer 1: scrollable <table> providing scroll surface + data cells.
//              Header cells in Layer 1 are INVISIBLE (transparent, no text) —
//              they exist only for scroll sizing so the Layer 2 overlay aligns.
//   - Layer 2: floating absolutely-positioned overlay with grouped spanning headers.
//              Clipped to the root viewport via overflow:hidden.
//              Column spans track horizontal scroll; row spans track vertical scroll.
//   - D3 data join for data cells with stable key function
//   - Corner cell shows dimension labels + resize handles
//   - Resize handles for header width/height (corner) and cell width/height (bottom-right)
//
// Requirements: PIV-03, PIV-04, PIV-05, PIV-06, PIV-07, PIV-18

import * as d3 from 'd3';
import type { HeaderDimension } from './PivotTypes';
import { calculateSpans, filterEmptyCombinations } from './PivotSpans';
import { generateCombinations, getCellKey } from './PivotMockData';
import type { PluginRegistry } from './plugins/PluginRegistry';
import type { GridLayout, RenderContext } from './plugins/PluginTypes';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_HEADER_WIDTH = 120;
const DEFAULT_HEADER_HEIGHT = 36;
const DEFAULT_CELL_WIDTH = 72;
const DEFAULT_CELL_HEIGHT = 32;

// ---------------------------------------------------------------------------
// Render options
// ---------------------------------------------------------------------------

export interface PivotGridRenderOptions {
	hideEmptyRows: boolean;
	hideEmptyCols: boolean;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CellPlacement {
	key: string;
	rowIdx: number;
	colIdx: number;
	value: number | null;
}

interface ResizingState {
	type: 'header-width' | 'header-height' | 'cell-all';
	startX: number;
	startY: number;
	startWidth: number;
	startHeight: number;
}

// ---------------------------------------------------------------------------
// PivotGrid
// ---------------------------------------------------------------------------

export class PivotGrid {
	private _rootEl: HTMLDivElement | null = null;
	private _scrollContainer: HTMLDivElement | null = null;
	private _overlayEl: HTMLDivElement | null = null;
	private _tableEl: HTMLTableElement | null = null;

	// Sizing state
	private _headerWidth = DEFAULT_HEADER_WIDTH;
	private _headerHeight = DEFAULT_HEADER_HEIGHT;
	private _cellWidth = DEFAULT_CELL_WIDTH;
	private _cellHeight = DEFAULT_CELL_HEIGHT;

	// Scroll tracking
	private _scrollLeft = 0;
	private _scrollTop = 0;

	// Resize state
	private _resizing: ResizingState | null = null;

	// Plugin registry (optional — enables plugin pipeline hooks)
	private _registry: PluginRegistry | null = null;

	// Bound listeners for cleanup
	private _boundHandlePointerMove: ((e: PointerEvent) => void) | null = null;
	private _boundHandlePointerUp: ((e: PointerEvent) => void) | null = null;

	// Last render args for resize re-render
	private _lastRows: HeaderDimension[] = [];
	private _lastCols: HeaderDimension[] = [];
	private _lastData: Map<string, number | null> = new Map();
	private _lastOptions: PivotGridRenderOptions = { hideEmptyRows: false, hideEmptyCols: false };

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	mount(container: HTMLElement): void {
		this._rootEl = document.createElement('div');
		this._rootEl.className = 'pv-grid-root';
		this._rootEl.style.cssText =
			'position:relative;width:100%;height:100%;overflow:hidden;';

		// Layer 1: Scrollable table
		this._scrollContainer = document.createElement('div');
		this._scrollContainer.className = 'pv-scroll-container';
		this._scrollContainer.style.cssText =
			'position:absolute;inset:0;overflow:auto;z-index:1;';
		this._scrollContainer.addEventListener('scroll', this._handleScroll);
		this._rootEl.appendChild(this._scrollContainer);

		this._tableEl = document.createElement('table');
		this._tableEl.className = 'pv-table';
		this._tableEl.style.cssText = 'border-collapse:collapse;table-layout:fixed;';
		this._scrollContainer.appendChild(this._tableEl);

		// Layer 2: Floating overlay for grouped headers — clipped to root
		this._overlayEl = document.createElement('div');
		this._overlayEl.className = 'pv-overlay';
		this._overlayEl.style.cssText =
			'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:10;overflow:hidden;';
		// Route pointer events from the overlay to the plugin registry
		this._overlayEl.addEventListener('pointerdown', (e: PointerEvent) => {
			if (this._registry && this._overlayEl) {
				const layout: GridLayout = {
					headerWidth: this._headerWidth,
					headerHeight: this._headerHeight,
					cellWidth: this._cellWidth,
					cellHeight: this._cellHeight,
					colWidths: new Map(),
					zoom: 1.0,
				};
				const ctx: RenderContext & { layout: GridLayout } = {
					rowDimensions: this._lastRows,
					colDimensions: this._lastCols,
					visibleRows: [],
					allRows: [], // overlay pointerdown doesn't need real allRows
					visibleCols: [],
					data: this._lastData,
					rootEl: this._overlayEl,
					scrollLeft: this._scrollLeft,
					scrollTop: this._scrollTop,
					isPluginEnabled: this._registry.isEnabled.bind(this._registry),
					layout,
				};
				this._registry.runOnPointerEvent('pointerdown', e, ctx);
			}
		});
		this._rootEl.appendChild(this._overlayEl);

		container.appendChild(this._rootEl);
	}

	destroy(): void {
		this._cleanupResizeListeners();
		this._scrollContainer?.removeEventListener('scroll', this._handleScroll);
		this._rootEl?.remove();
		this._rootEl = null;
		this._scrollContainer = null;
		this._overlayEl = null;
		this._tableEl = null;
	}

	// -----------------------------------------------------------------------
	// Plugin registry integration
	// -----------------------------------------------------------------------

	/** Inject a PluginRegistry — enables pipeline hooks during render(). */
	setRegistry(registry: PluginRegistry): void {
		this._registry = registry;
	}

	/** Expose the overlay element for plugins that need direct DOM access. */
	getOverlayEl(): HTMLElement | null {
		return this._overlayEl;
	}

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

	render(
		rowDimensions: HeaderDimension[],
		colDimensions: HeaderDimension[],
		data: Map<string, number | null>,
		options: PivotGridRenderOptions,
	): void {
		this._lastRows = rowDimensions;
		this._lastCols = colDimensions;
		this._lastData = data;
		this._lastOptions = options;

		if (!this._tableEl || !this._overlayEl || !this._rootEl) return;

		// Empty state
		if (rowDimensions.length === 0 || colDimensions.length === 0) {
			this._tableEl.innerHTML = '';
			this._overlayEl.innerHTML = '';
			const empty = document.createElement('div');
			empty.className = 'pv-empty';
			empty.textContent = 'Add dimensions to both rows and columns to see data';
			this._scrollContainer!.appendChild(empty);
			return;
		}

		// Remove any lingering empty state
		this._rootEl.querySelector('.pv-empty')?.remove();

		// Generate combinations
		const rowCombinations = generateCombinations(rowDimensions);
		const colCombinations = generateCombinations(colDimensions);
		const allRows = rowCombinations; // capture before hide-empty filter for scope: 'all'

		// Filter empties
		let visibleRows = rowCombinations;
		let visibleCols = colCombinations;

		if (options.hideEmptyRows) {
			visibleRows = filterEmptyCombinations(
				rowCombinations,
				colCombinations,
				data,
				getCellKey,
				true,
			);
		}
		if (options.hideEmptyCols) {
			visibleCols = filterEmptyCombinations(
				colCombinations,
				visibleRows,
				data,
				getCellKey,
				false,
			);
		}

		// Calculate spans
		const rowSpans = rowDimensions.length > 0 ? calculateSpans(rowDimensions, visibleRows) : [];
		const colSpans =
			colDimensions.length > 0 ? calculateSpans(colDimensions, visibleCols) : [];

		const totalRowHeaderWidth = this._headerWidth * rowDimensions.length;
		const totalColHeaderHeight = this._headerHeight * colDimensions.length;

		// ---- Layer 1: Scrollable table (headers invisible, data cells visible) ----
		this._renderTable(rowDimensions, colDimensions, visibleRows, visibleCols, data);

		// ---- Layer 2: Floating overlay (grouped visible headers) ----
		this._renderOverlay(
			rowDimensions,
			colDimensions,
			visibleRows,
			visibleCols,
			rowSpans,
			colSpans,
			totalRowHeaderWidth,
			totalColHeaderHeight,
		);

		// ---- Plugin pipeline: afterRender ----
		if (this._registry && this._overlayEl) {
			const layout: GridLayout = {
				headerWidth: this._headerWidth,
				headerHeight: this._headerHeight,
				cellWidth: this._cellWidth,
				cellHeight: this._cellHeight,
				colWidths: new Map(),
				zoom: 1.0,
			};
			const ctx: RenderContext & { layout: GridLayout } = {
				rowDimensions,
				colDimensions,
				visibleRows,
				allRows,
				visibleCols,
				data,
				rootEl: this._overlayEl,
				scrollLeft: this._scrollLeft,
				scrollTop: this._scrollTop,
				isPluginEnabled: this._registry.isEnabled.bind(this._registry),
				layout,
			};
			this._registry.runAfterRender(this._overlayEl, ctx);
		}
	}

	// -----------------------------------------------------------------------
	// Layer 1: Scrollable table
	// Headers are INVISIBLE — they provide scroll sizing only.
	// Data cells are the only visible elements in Layer 1.
	// -----------------------------------------------------------------------

	private _renderTable(
		rowDims: HeaderDimension[],
		colDims: HeaderDimension[],
		visibleRows: string[][],
		visibleCols: string[][],
		data: Map<string, number | null>,
	): void {
		if (!this._tableEl) return;

		const table = d3.select(this._tableEl);

		// Build thead (invisible spacers)
		let thead = table.select<HTMLTableSectionElement>('thead');
		if (thead.empty()) thead = table.append('thead');

		const theadRows = thead.selectAll<HTMLTableRowElement, number>('tr').data(
			d3.range(colDims.length),
			(d) => `col-header-${d}`,
		);

		theadRows.exit().remove();

		const theadRowsEnter = theadRows.enter().append('tr');
		const merged = theadRowsEnter.merge(theadRows);

		merged.each((dimIdx, i, nodes) => {
			const tr = d3.select(nodes[i]!);

			// Corner spacer cells (invisible)
			const corners = tr
				.selectAll<HTMLTableCellElement, number>('.pv-corner-th')
				.data(d3.range(rowDims.length), (d) => `corner-${dimIdx}-${d}`);
			corners.exit().remove();
			corners
				.enter()
				.append('th')
				.attr('class', 'pv-corner-th')
				.merge(corners)
				.style('width', `${this._headerWidth}px`)
				.style('min-width', `${this._headerWidth}px`)
				.style('max-width', `${this._headerWidth}px`)
				.style('height', `${this._headerHeight}px`)
				.style('border', 'none')
				.style('padding', '0');

			// Column header spacer cells (invisible — no text, no background)
			const colHeaders = tr
				.selectAll<HTMLTableCellElement, number>('.pv-col-th')
				.data(d3.range(visibleCols.length), (d) => `col-th-${dimIdx}-${d}`);
			colHeaders.exit().remove();
			colHeaders
				.enter()
				.append('th')
				.attr('class', 'pv-col-th')
				.merge(colHeaders)
				.style('width', `${this._cellWidth}px`)
				.style('min-width', `${this._cellWidth}px`)
				.style('max-width', `${this._cellWidth}px`)
				.style('height', `${this._headerHeight}px`)
				.style('border', 'none')
				.style('padding', '0')
				.text('');
		});

		// Build tbody — row header spacers (invisible) + data cells (visible)
		let tbody = table.select<HTMLTableSectionElement>('tbody');
		if (tbody.empty()) tbody = table.append('tbody');

		const rows = tbody
			.selectAll<HTMLTableRowElement, string[]>('tr')
			.data(visibleRows, (d) => d.join('|'));

		rows.exit().remove();
		const rowsEnter = rows.enter().append('tr');
		const allRows = rowsEnter.merge(rows);

		allRows.each((rowPath, rowIdx, nodes) => {
			const tr = d3.select(nodes[rowIdx]!);

			// Row header spacer cells (invisible)
			const rowHeaders = tr
				.selectAll<HTMLTableCellElement, number>('.pv-row-th')
				.data(d3.range(rowDims.length), (d) => `row-th-${rowIdx}-${d}`);
			rowHeaders.exit().remove();
			rowHeaders
				.enter()
				.append('th')
				.attr('class', 'pv-row-th')
				.merge(rowHeaders)
				.style('width', `${this._headerWidth}px`)
				.style('min-width', `${this._headerWidth}px`)
				.style('max-width', `${this._headerWidth}px`)
				.style('height', `${this._cellHeight}px`)
				.style('border', 'none')
				.style('padding', '0')
				.text('');

			// Data cells (VISIBLE — the only visible thing in Layer 1)
			const cellData: CellPlacement[] = visibleCols.map((colPath, colIdx) => {
				const key = getCellKey(rowPath, colPath);
				return { key, rowIdx, colIdx, value: data.get(key) ?? null };
			});

			const cells = tr
				.selectAll<HTMLTableCellElement, CellPlacement>('.pv-data-cell')
				.data(cellData, (d) => d.key);

			cells.exit().remove();
			cells
				.enter()
				.append('td')
				.attr('class', 'pv-data-cell')
				.merge(cells)
				.style('width', `${this._cellWidth}px`)
				.style('min-width', `${this._cellWidth}px`)
				.style('max-width', `${this._cellWidth}px`)
				.style('height', `${this._cellHeight}px`)
				.attr('data-row-parity', (d) => (d.rowIdx % 2 === 0 ? 'even' : 'odd'))
				.text((d) => (d.value !== null ? String(d.value) : ''));
		});
	}

	// -----------------------------------------------------------------------
	// Layer 2: Floating overlay (grouped headers — the ONLY visible headers)
	// -----------------------------------------------------------------------

	private _renderOverlay(
		rowDims: HeaderDimension[],
		colDims: HeaderDimension[],
		visibleRows: string[][],
		visibleCols: string[][],
		rowSpans: ReturnType<typeof calculateSpans>,
		colSpans: ReturnType<typeof calculateSpans>,
		totalRowHeaderWidth: number,
		totalColHeaderHeight: number,
	): void {
		if (!this._overlayEl) return;
		const overlay = d3.select(this._overlayEl);
		overlay.selectAll('*').remove();

		// ---- Grouped column headers ----
		for (let dimIdx = 0; dimIdx < colDims.length; dimIdx++) {
			let cumulativeOffset = 0;
			const spans = colSpans[dimIdx] ?? [];
			const isLeafLevel = dimIdx === colDims.length - 1;

			for (let spanIdx = 0; spanIdx < spans.length; spanIdx++) {
				const spanInfo = spans[spanIdx]!;
				overlay
					.append('div')
					.attr('class', `pv-col-span ${isLeafLevel ? 'pv-col-span--leaf' : ''}`)
					.attr('data-level', String(dimIdx))
					.style('position', 'absolute')
					.style(
						'left',
						`${totalRowHeaderWidth + cumulativeOffset * this._cellWidth}px`,
					)
					.style('top', `${dimIdx * this._headerHeight}px`)
					.style('width', `${this._cellWidth * spanInfo.span}px`)
					.style('height', `${this._headerHeight}px`)
					.style('z-index', '11')
					.style('box-sizing', 'border-box')
					.style('transform', `translateX(-${this._scrollLeft}px)`)
					.style('pointer-events', 'auto')
					.text(spanInfo.label);

				cumulativeOffset += spanInfo.span;
			}
		}

		// ---- Grouped row headers ----
		for (let dimIdx = 0; dimIdx < rowDims.length; dimIdx++) {
			let cumulativeOffset = 0;
			const spans = rowSpans[dimIdx] ?? [];
			const isLeafLevel = dimIdx === rowDims.length - 1;

			for (let spanIdx = 0; spanIdx < spans.length; spanIdx++) {
				const spanInfo = spans[spanIdx]!;
				overlay
					.append('div')
					.attr('class', `pv-row-span ${isLeafLevel ? 'pv-row-span--leaf' : ''}`)
					.attr('data-level', String(dimIdx))
					.style('position', 'absolute')
					.style('left', `${dimIdx * this._headerWidth}px`)
					.style(
						'top',
						`${totalColHeaderHeight + cumulativeOffset * this._cellHeight}px`,
					)
					.style('width', `${this._headerWidth}px`)
					.style('height', `${this._cellHeight * spanInfo.span}px`)
					.style('z-index', '12')
					.style('box-sizing', 'border-box')
					.style('transform', `translateY(-${this._scrollTop}px)`)
					.style('pointer-events', 'auto')
					.text(spanInfo.label);

				cumulativeOffset += spanInfo.span;
			}
		}

		// ---- Corner cell (highest z-index) ----
		const corner = overlay
			.append('div')
			.attr('class', 'pv-corner')
			.style('position', 'absolute')
			.style('top', '0')
			.style('left', '0')
			.style('width', `${totalRowHeaderWidth}px`)
			.style('height', `${totalColHeaderHeight}px`)
			.style('z-index', '30')
			.style('box-sizing', 'border-box')
			.style('pointer-events', 'auto');

		// Dimension labels
		corner
			.append('div')
			.attr('class', 'pv-corner-labels')
			.html(
				`<span class="pv-corner-dim">${rowDims.map((d) => d.name).join(' / ')}</span>` +
				`<span class="pv-corner-vs">vs</span>` +
				`<span class="pv-corner-dim">${colDims.map((d) => d.name).join(' / ')}</span>`,
			);

		// Resize handle: header width (right edge)
		corner
			.append('div')
			.attr('class', 'pv-resize-handle pv-resize-handle--width')
			.on('pointerdown', (e: PointerEvent) => {
				e.preventDefault();
				this._startResize('header-width', e);
			});

		// Resize handle: header height (bottom edge)
		corner
			.append('div')
			.attr('class', 'pv-resize-handle pv-resize-handle--height')
			.on('pointerdown', (e: PointerEvent) => {
				e.preventDefault();
				this._startResize('header-height', e);
			});

		// ---- Cell resize handle (bottom-right corner of grid) ----
		overlay
			.append('div')
			.attr('class', 'pv-resize-handle pv-resize-handle--cell')
			.style(
				'left',
				`${totalRowHeaderWidth + visibleCols.length * this._cellWidth - this._scrollLeft - 6}px`,
			)
			.style(
				'top',
				`${totalColHeaderHeight + visibleRows.length * this._cellHeight - this._scrollTop - 6}px`,
			)
			.on('pointerdown', (e: PointerEvent) => {
				e.preventDefault();
				this._startResize('cell-all', e);
			});
	}

	// -----------------------------------------------------------------------
	// Scroll handler
	// -----------------------------------------------------------------------

	private _handleScroll = (): void => {
		if (!this._scrollContainer) return;
		this._scrollLeft = this._scrollContainer.scrollLeft;
		this._scrollTop = this._scrollContainer.scrollTop;

		// Update overlay transforms for scroll tracking
		if (this._overlayEl) {
			this._overlayEl.querySelectorAll<HTMLDivElement>('.pv-col-span').forEach((el) => {
				el.style.transform = `translateX(-${this._scrollLeft}px)`;
			});
			this._overlayEl.querySelectorAll<HTMLDivElement>('.pv-row-span').forEach((el) => {
				el.style.transform = `translateY(-${this._scrollTop}px)`;
			});
		}

		// Plugin pipeline: onScroll
		if (this._registry && this._overlayEl) {
			const layout: GridLayout = {
				headerWidth: this._headerWidth,
				headerHeight: this._headerHeight,
				cellWidth: this._cellWidth,
				cellHeight: this._cellHeight,
				colWidths: new Map(),
				zoom: 1.0,
			};
			const ctx: RenderContext & { layout: GridLayout } = {
				rowDimensions: this._lastRows,
				colDimensions: this._lastCols,
				visibleRows: [],
				allRows: [], // scroll handler doesn't need real allRows
				visibleCols: [],
				data: this._lastData,
				rootEl: this._overlayEl,
				scrollLeft: this._scrollLeft,
				scrollTop: this._scrollTop,
				isPluginEnabled: this._registry.isEnabled.bind(this._registry),
				layout,
			};
			this._registry.runOnScroll(this._scrollLeft, this._scrollTop, ctx);
		}
	};

	// -----------------------------------------------------------------------
	// Resize
	// -----------------------------------------------------------------------

	private _startResize(type: ResizingState['type'], e: PointerEvent): void {
		this._resizing = {
			type,
			startX: e.clientX,
			startY: e.clientY,
			startWidth: type === 'cell-all' ? this._cellWidth : this._headerWidth,
			startHeight: type === 'cell-all' ? this._cellHeight : this._headerHeight,
		};

		this._boundHandlePointerMove = this._handleResizeMove.bind(this);
		this._boundHandlePointerUp = this._handleResizeUp.bind(this);

		document.addEventListener('pointermove', this._boundHandlePointerMove);
		document.addEventListener('pointerup', this._boundHandlePointerUp);
	}

	private _handleResizeMove(e: PointerEvent): void {
		if (!this._resizing) return;

		if (this._resizing.type === 'header-width') {
			const delta = e.clientX - this._resizing.startX;
			this._headerWidth = Math.max(60, this._resizing.startWidth + delta);
		} else if (this._resizing.type === 'header-height') {
			const delta = e.clientY - this._resizing.startY;
			this._headerHeight = Math.max(24, this._resizing.startHeight + delta);
		} else if (this._resizing.type === 'cell-all') {
			const deltaX = e.clientX - this._resizing.startX;
			const deltaY = e.clientY - this._resizing.startY;
			this._cellWidth = Math.max(40, this._resizing.startWidth + deltaX);
			this._cellHeight = Math.max(24, this._resizing.startHeight + deltaY);
		}

		// Re-render with new sizes
		this.render(this._lastRows, this._lastCols, this._lastData, this._lastOptions);
	}

	private _handleResizeUp(): void {
		this._resizing = null;
		this._cleanupResizeListeners();
	}

	private _cleanupResizeListeners(): void {
		if (this._boundHandlePointerMove) {
			document.removeEventListener('pointermove', this._boundHandlePointerMove);
			this._boundHandlePointerMove = null;
		}
		if (this._boundHandlePointerUp) {
			document.removeEventListener('pointerup', this._boundHandlePointerUp);
			this._boundHandlePointerUp = null;
		}
	}
}
