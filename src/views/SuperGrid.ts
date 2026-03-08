// Isometry v5 — Phase 17 SuperGrid
// Dependency-injected lifecycle with PAFVProvider axis reads, StateCoordinator
// subscription, and WorkerBridge query pipeline.
//
// Design:
//   - Implements IView (mount/render/destroy)
//   - Constructor injection: (provider, filter, bridge, coordinator)
//   - mount(): subscribes to StateCoordinator, fires immediate _fetchAndRender()
//   - render(cards): no-op — SuperGrid self-manages data via bridge.superGridQuery()
//   - destroy(): unsubscribes from StateCoordinator, clears internal state
//   - _fetchAndRender(): reads axes from provider, compiles filter, calls bridge.superGridQuery()
//   - _renderCells(): CSS Grid rendering pipeline (headers + data cells + D3 join)
//   - Collapsible headers: click re-renders from cached _lastCells (no re-query)
//   - Performance budget: <16ms for 100 visible cards
//
// Requirements: REND-02, REND-05, REND-06, FOUN-08, FOUN-10

import * as d3 from 'd3';
import { auditState } from '../audit/AuditState';
import type { AxisField, AxisMapping } from '../providers/types';
import type { CellDatum } from '../worker/protocol';
import { buildCellKey, buildDimensionKey, findCellInData, parseCellKey, RECORD_SEP, UNIT_SEP } from './supergrid/keys';
import { SortState } from './supergrid/SortState';
import { SuperGridBBoxCache } from './supergrid/SuperGridBBoxCache';
import { classifyClickZone, SuperGridSelect } from './supergrid/SuperGridSelect';
import { SuperGridSizer } from './supergrid/SuperGridSizer';
import { SuperGridVirtualizer } from './supergrid/SuperGridVirtualizer';
import { buildGridTemplateColumns, buildHeaderCells, type HeaderCell } from './supergrid/SuperStackHeader';
import { parseDateString, smartHierarchy } from './supergrid/SuperTimeUtils';
import { SuperZoom } from './supergrid/SuperZoom';
import type {
	CardDatum,
	IView,
	SuperGridBridgeLike,
	SuperGridDensityLike,
	SuperGridFilterLike,
	SuperGridPositionLike,
	SuperGridProviderLike,
	SuperGridSelectionLike,
} from './types';

// ---------------------------------------------------------------------------
// Default no-op SuperGridSelectionLike — used when no selectionAdapter injected
// ---------------------------------------------------------------------------

/** A no-op selection adapter used as default when none is injected.
 *  Matches SuperGridSelectionLike contract: select() replaces, addToSelection() is additive-only. */
const _noOpSelectionAdapter: SuperGridSelectionLike = {
	select: () => {},
	addToSelection: () => {},
	clear: () => {},
	isSelectedCell: () => false,
	isCardSelected: () => false,
	getSelectedCount: () => 0,
	subscribe: () => () => {},
};

// ---------------------------------------------------------------------------
// Default no-op SuperGridPositionLike — used when no positionProvider injected
// ---------------------------------------------------------------------------

/** A no-op position provider used as default when none is injected. */
const _noOpPositionProvider: SuperGridPositionLike = {
	savePosition: () => {},
	restorePosition: () => {},
	get zoomLevel() {
		return 1.0;
	},
	set zoomLevel(_v: number) {},
	setAxisCoordinates: () => {},
	reset: () => {},
};

// ---------------------------------------------------------------------------
// Default no-op SuperGridDensityLike — used when no densityProvider injected
// ---------------------------------------------------------------------------

/** A no-op density provider used as default when none is injected (Phase 22).
 * Defaults to viewMode='matrix' to preserve backward-compatible count-badge rendering
 * for all existing tests that do not inject a density provider. */
const _noOpDensityProvider: SuperGridDensityLike = {
	getState: () => ({ axisGranularity: null, hideEmpty: false, viewMode: 'matrix' as const, regionConfig: null }),
	setGranularity: () => {},
	setHideEmpty: () => {},
	setViewMode: () => {},
	subscribe: () => () => {},
};

// ---------------------------------------------------------------------------
// Axis DnD — module-level dragPayload singleton (DYNM-01/DYNM-02)
// ---------------------------------------------------------------------------

/**
 * Payload captured at dragstart and consumed at drop.
 * dataTransfer.getData() is security-blocked during dragover, so the full
 * payload must be stored in a module-level variable at dragstart time.
 *
 * Locked constraint (STATE.md): "HTML5 DnD dragPayload MUST be a module-level singleton."
 */
interface AxisDragPayload {
	field: string;
	sourceDimension: 'col' | 'row';
	sourceIndex: number;
}

let _dragPayload: AxisDragPayload | null = null;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// VIEW_DEFAULTS fallback: when provider returns empty axes, use these defaults
const DEFAULT_COL_AXES: AxisMapping[] = [{ field: 'card_type', direction: 'asc' }];
const DEFAULT_ROW_AXES: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];

// Phase 29: Row header depth is computed from rowHeaders.length at render time.
// Each row header level is 80px wide (ROW_HEADER_LEVEL_WIDTH matches buildGridTemplateColumns default).
const ROW_HEADER_LEVEL_WIDTH = 80;

// Phase 22 Plan 02 — time fields eligible for granularity-based query rewriting and aggregate counts (DENS-01, DENS-05)
const ALLOWED_COL_TIME_FIELDS = new Set(['created_at', 'modified_at', 'due_at']);

// ---------------------------------------------------------------------------
// SuperGrid
// ---------------------------------------------------------------------------

/**
 * SuperGrid view — the signature PAFV differentiator.
 *
 * Renders cards through stacked PAFV axes with nested CSS Grid headers.
 * Parent headers visually span their child column groups (grid-column: span N).
 * Up to 3 stacked axis levels on both row and column dimensions.
 *
 * Phase 17 changes:
 *   - Constructor now requires 4 dependencies: provider, filter, bridge, coordinator
 *   - render(cards) is a no-op — data comes from bridge.superGridQuery()
 *   - Subscribes to StateCoordinator in mount(), unsubscribes in destroy()
 *   - _fetchAndRender() drives the query/render cycle
 *
 * Lifecycle:
 *   1. mount(container) — creates DOM, subscribes to coordinator, fires initial _fetchAndRender()
 *   2. render(cards) — no-op (SuperGrid self-manages data)
 *   3. destroy() — unsubscribes, removes DOM, clears state
 */
export class SuperGrid implements IView {
	// ---------------------------------------------------------------------------
	// Dependencies (injected via constructor)
	// ---------------------------------------------------------------------------

	private readonly _provider: SuperGridProviderLike;
	private readonly _filter: SuperGridFilterLike;
	private readonly _bridge: SuperGridBridgeLike;
	private readonly _coordinator: { subscribe(cb: () => void): () => void };
	private readonly _positionProvider: SuperGridPositionLike;
	private readonly _densityProvider: SuperGridDensityLike;

	// ---------------------------------------------------------------------------
	// Internal state
	// ---------------------------------------------------------------------------

	/** Guards one-time post-render mount setup (position restore + lasso attach).
	 *  Decoupled from _fetchAndRender() promise to survive rAF coalescing abandonment. */
	private _mountSetupDone = false;

	/** Set of collapse keys for collapsed header groups (format changes in Fix 4) */
	private _collapsedSet: Set<string> = new Set();

	/** Phase 30 — tracks aggregate vs hide mode per collapse key */
	private _collapseModeMap: Map<string, 'aggregate' | 'hide'> = new Map();

	/** Root wrapper element */
	private _rootEl: HTMLDivElement | null = null;

	/** CSS Grid container — grid-template-columns set dynamically */
	private _gridEl: HTMLDivElement | null = null;

	/** Drop zone for col dimension — accepts row-origin drags (DYNM-01/DYNM-02) */
	private _colDropZoneEl: HTMLDivElement | null = null;

	/** Drop zone for row dimension — accepts col-origin drags (DYNM-01/DYNM-02) */
	private _rowDropZoneEl: HTMLDivElement | null = null;

	/** Last rendered CellDatum rows — used for collapse re-render without re-querying */
	private _lastCells: CellDatum[] = [];

	/** Last fetched colAxes — used for _renderCells() column placement */
	private _lastColAxes: AxisMapping[] = [];

	/** Last fetched rowAxes — used for _renderCells() row placement */
	private _lastRowAxes: AxisMapping[] = [];

	/** Current row header depth — count of 80px row header columns.
	 *  Set in _renderCells() from rowHeaders.length; used by SuperGridSizer during live-resize
	 *  so the correct number of header columns is preserved in grid-template-columns. */
	private _rowHeaderDepth = 1;

	/** Flag: true during mount(), false after first _fetchAndRender completes.
	 *  Used to distinguish initial render (where restorePosition runs) from
	 *  coordinator-triggered re-renders (where scroll resets to 0,0). */
	private _isInitialMount = true;

	/** Unsubscribe function from coordinator.subscribe() — called in destroy() */
	private _coordinatorUnsub: (() => void) | null = null;

	/** Unsubscribe function from densityProvider.subscribe() — called in destroy() */
	private _unsubDensity: (() => void) | null = null;

	/** Previous granularity — used to detect if a Worker re-query is needed vs client-side re-render */
	private _lastGranularity: string | null = null;

	// ---------------------------------------------------------------------------
	// Phase 19 Plan 02 — SuperZoom, scroll handler, and toast state
	// ---------------------------------------------------------------------------

	/** SuperZoom instance — wired in mount(), cleaned in destroy() */
	private _superZoom: SuperZoom | null = null;

	// ---------------------------------------------------------------------------
	// Phase 20 Plan 02 — SuperGridSizer (column resize)
	// ---------------------------------------------------------------------------

	/** SuperGridSizer instance — handles all column resize interaction */
	private readonly _sizer: SuperGridSizer;

	// ---------------------------------------------------------------------------
	// Phase 21 — SuperSelect (selection wiring)
	// ---------------------------------------------------------------------------

	/** BBoxCache — post-render DOM snapshot for O(1) lasso hit-testing */
	private readonly _bboxCache: SuperGridBBoxCache;

	/** SuperGridSelect — SVG lasso overlay, attached in mount(), detached in destroy() */
	private readonly _sgSelect: SuperGridSelect;

	/** Selection adapter — wraps SelectionProvider with cell-level API */
	private readonly _selectionAdapter: SuperGridSelectionLike;

	/** Unsubscribe fn from selectionAdapter.subscribe() — called in destroy() */
	private _selectionUnsub: (() => void) | null = null;

	/** Anchor cell for Shift+click 2D rectangular range selection */
	private _selectionAnchor: { rowKey: string; colKey: string } | null = null;

	/** Floating badge showing count of selected cards */
	private _badgeEl: HTMLDivElement | null = null;

	/** Bound Escape key handler stored so removeEventListener can reference exact same function */
	private _boundEscapeHandler: ((e: KeyboardEvent) => void) | null = null;

	/** rAF ID for scroll throttle — tracked to cancel on destroy() */
	private _scrollRafId: number | null = null;

	/** Bound scroll handler stored so removeEventListener can reference exact same function */
	private _boundScrollHandler = (): void => {
		if (this._scrollRafId !== null) return;
		this._scrollRafId = requestAnimationFrame(() => {
			this._scrollRafId = null;
			if (this._rootEl) {
				this._positionProvider.savePosition(this._rootEl);

				// Phase 38 — Virtual scroll: check if visible range changed
				if (this._virtualizer.isActive()) {
					const newRange = this._virtualizer.getVisibleRange();
					if (
						newRange.startRow !== this._lastRenderedRange.startRow ||
						newRange.endRow !== this._lastRenderedRange.endRow
					) {
						this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes);
					}
				}
			}
		});
	};

	/** Zoom toast element — created lazily on first zoom, removed in destroy() */
	private _toastEl: HTMLDivElement | null = null;

	/** Timeout ID for fade-out of toast */
	private _toastTimeout: ReturnType<typeof setTimeout> | null = null;

	// ---------------------------------------------------------------------------
	// Phase 22 Plan 03 — Density toolbar + hide-empty indicator (DENS-02, DENS-03)
	// ---------------------------------------------------------------------------

	/** Density toolbar element — contains hide-empty checkbox and view-mode select */
	private _densityToolbarEl: HTMLDivElement | null = null;

	/** "+N hidden" badge — shows count of hidden rows+columns when hideEmpty is true */
	private _hiddenIndicatorEl: HTMLDivElement | null = null;

	// ---------------------------------------------------------------------------
	// Phase 23 — SuperSort (SORT-01/SORT-02/SORT-03/SORT-04)
	// ---------------------------------------------------------------------------

	/** SortState instance — manages sort chain for cycle/multi-sort semantics */
	private _sortState: SortState;

	/** "Clear sorts" button in density toolbar — visible only when sorts are active */
	private _clearSortsBtnEl: HTMLButtonElement | null = null;

	// ---------------------------------------------------------------------------
	// Phase 38 — SuperGridVirtualizer (VSCR-01..VSCR-04)
	// ---------------------------------------------------------------------------

	/** Virtualizer instance — computes visible row range for data windowing */
	private readonly _virtualizer: SuperGridVirtualizer;

	/** Sentinel spacer element — provides correct total scroll height */
	private _spacerEl: HTMLDivElement | null = null;

	/** Last rendered row range — used by scroll handler to detect range changes */
	private _lastRenderedRange: { startRow: number; endRow: number } = { startRow: 0, endRow: 0 };

	// ---------------------------------------------------------------------------
	// Phase 24 — SuperFilter (FILT-01/FILT-02/FILT-03/FILT-04/FILT-05): filter icon + dropdown + toolbar button
	// ---------------------------------------------------------------------------

	/** Currently open filter dropdown element — null when no dropdown is open */
	private _filterDropdownEl: HTMLElement | null = null;

	/** Click-outside handler stored for removeEventListener cleanup */
	private _boundFilterOutsideClick: ((e: MouseEvent) => void) | null = null;

	/** "Clear filters" button in density toolbar — visible only when axis filters active (FILT-04) */
	private _clearFiltersBtnEl: HTMLButtonElement | null = null;

	/** Escape key handler stored for removeEventListener cleanup */
	private _boundFilterEscapeHandler: ((e: KeyboardEvent) => void) | null = null;

	// ---------------------------------------------------------------------------
	// Phase 26 — SuperTime (TIME-04/TIME-05)
	// ---------------------------------------------------------------------------

	/** TIME-04: Non-contiguous period selection — Tier 3 ephemeral (not persisted per D-005).
	 *  Stores strftime-formatted period keys (e.g. '2026-01', '2025-Q1') selected via Cmd+click. */
	private _periodSelection: Set<string> = new Set();

	/** TIME-04: "Show All" button — visible when period selection is active */
	private _showAllBtnEl: HTMLButtonElement | null = null;

	// ---------------------------------------------------------------------------
	// Phase 26 — SuperTime (TIME-01/TIME-02/TIME-03)
	// ---------------------------------------------------------------------------

	/** When true (default), auto-detection runs in _fetchAndRender() to compute smart hierarchy.
	 *  Set to false when user clicks a D/W/M/Q/Y pill (manual override).
	 *  Set back to true when user clicks the 'A' pill.
	 *  Default true: CONTEXT.md requires adaptive behavior ("re-runs on data change, not locked"). */
	private _isAutoGranularity: boolean = true;

	/** Granularity pills container element — stored for _updateDensityToolbar() sync */
	private _granPillsEl: HTMLDivElement | null = null;

	/** Label element for the granularity pills section */
	private _granPillsLabelEl: HTMLElement | null = null;

	// ---------------------------------------------------------------------------
	// Phase 27 — PLSH-04: Help overlay (Cmd+/ + '?' button)
	// ---------------------------------------------------------------------------

	/** Help overlay element — null when overlay not open */
	private _helpOverlayEl: HTMLDivElement | null = null;

	/** Bound Cmd+/ keydown handler stored for removeEventListener cleanup */
	private _boundHelpKeyHandler: ((e: KeyboardEvent) => void) | null = null;

	// ---------------------------------------------------------------------------
	// Phase 27 — PLSH-05: Right-click context menu on headers
	// ---------------------------------------------------------------------------

	/** Context menu element — null when no menu is open */
	private _contextMenuEl: HTMLDivElement | null = null;

	/** Click-outside handler stored for removeEventListener cleanup */
	private _boundContextMenuOutsideClick: ((e: MouseEvent) => void) | null = null;

	/** Hidden columns — Tier 3 ephemeral state (not persisted, resets on page reload) */
	private _hiddenCols: Set<string> = new Set();

	/** Hidden rows — Tier 3 ephemeral state (not persisted, resets on page reload) */
	private _hiddenRows: Set<string> = new Set();

	/** Bound contextmenu event delegation handler — registered once in mount(), removed in destroy() */
	private _boundContextMenuHandler: ((e: MouseEvent) => void) | null = null;

	// ---------------------------------------------------------------------------
	// Phase 25 — SuperSearch (SRCH-01/SRCH-02/SRCH-05)
	// ---------------------------------------------------------------------------

	/** Current search term — class-level Tier 3 ephemeral state (not persisted, per D-005) */
	private _searchTerm: string = '';

	/** Search input element ref — for Cmd+F focus */
	private _searchInputEl: HTMLInputElement | null = null;

	/** Debounce timer ID — cleared on destroy() and on immediate-clear path */
	private _searchDebounceId: ReturnType<typeof setTimeout> | null = null;

	/** Match count badge element — updated in _renderCells() */
	private _searchCountEl: HTMLSpanElement | null = null;

	/** Bound Cmd+F handler stored for removeEventListener cleanup */
	private _boundCmdFHandler: ((e: KeyboardEvent) => void) | null = null;

	// ---------------------------------------------------------------------------
	// Phase 27 — SuperCard tooltip (CARD-03)
	// ---------------------------------------------------------------------------

	/** Currently open SuperCard tooltip element — null when no tooltip is open */
	private _superCardTooltipEl: HTMLDivElement | null = null;

	/** Click-outside handler for SuperCard tooltip — stored for removeEventListener cleanup */
	private _boundTooltipOutsideClick: ((e: MouseEvent) => void) | null = null;

	// ---------------------------------------------------------------------------
	// Phase 31 Plan 02 — Visual drag UX: insertion line, source dimming, FLIP
	// ---------------------------------------------------------------------------

	/** Reusable insertion line DOM element for visual drag feedback */
	private _insertionLine: HTMLElement | null = null;

	/** Reference to the dimmed source header cell (for dragend cleanup even if DOM rebuilds) */
	private _dragSourceEl: HTMLElement | null = null;

	/** Last computed reorder target index from dragover midpoint calculation.
	 *  Used as fallback when dataset['reorderTargetIndex'] is not set (production path). */
	private _lastReorderTargetIndex: number = -1;

	/** FLIP snapshot: maps element keys to their pre-mutation DOMRect positions.
	 *  Set synchronously in drop handler before provider mutation; consumed in _renderCells. */
	private _flipSnapshot: Map<string, DOMRect> | null = null;

	// ---------------------------------------------------------------------------
	// Phase 59 — Card name cache (VFST-02)
	// ---------------------------------------------------------------------------

	/** Card ID -> display name cache. Populated from query results, cleared each _fetchAndRender. */
	private _cardNameCache: Map<string, string> = new Map();

	// ---------------------------------------------------------------------------
	// Phase 59 Plan 02 — Overflow badge tooltip (VFST-03)
	// ---------------------------------------------------------------------------

	/** Currently open overflow tooltip element — null when no tooltip is open */
	private _overflowTooltipEl: HTMLDivElement | null = null;

	/** Dismiss timer for overflow tooltip — allows cursor movement from badge to tooltip */
	private _overflowTooltipTimer: ReturnType<typeof setTimeout> | null = null;

	// ---------------------------------------------------------------------------
	// Constructor
	// ---------------------------------------------------------------------------

	constructor(
		provider: SuperGridProviderLike,
		filter: SuperGridFilterLike,
		bridge: SuperGridBridgeLike,
		coordinator: { subscribe(cb: () => void): () => void },
		positionProvider: SuperGridPositionLike = _noOpPositionProvider,
		selectionAdapter: SuperGridSelectionLike = _noOpSelectionAdapter,
		densityProvider: SuperGridDensityLike = _noOpDensityProvider,
	) {
		this._provider = provider;
		this._filter = filter;
		this._bridge = bridge;
		this._coordinator = coordinator;
		this._positionProvider = positionProvider;
		this._selectionAdapter = selectionAdapter;
		this._densityProvider = densityProvider;

		// Create SuperGridSizer with zoom callback and persistence callback
		this._sizer = new SuperGridSizer(
			() => this._positionProvider.zoomLevel,
			(widths: Map<string, number>) => {
				const obj: Record<string, number> = {};
				widths.forEach((v, k) => {
					obj[k] = v;
				});
				this._provider.setColWidths(obj);
			},
		);

		// Load persisted widths from provider (Tier 2 restore on construct)
		const persistedWidths = this._provider.getColWidths();
		if (Object.keys(persistedWidths).length > 0) {
			this._sizer.setColWidths(new Map(Object.entries(persistedWidths)));
		}

		// Create BBoxCache and SuperGridSelect instances
		this._bboxCache = new SuperGridBBoxCache();
		this._sgSelect = new SuperGridSelect();

		// Phase 38 — Initialize SuperGridVirtualizer with zoom-aware row height callback
		this._virtualizer = new SuperGridVirtualizer(
			() => {
				// Read --sg-row-height from rootEl computed style, fallback to BASE_ROW_HEIGHT * zoom
				if (this._rootEl) {
					const val = getComputedStyle(this._rootEl).getPropertyValue('--sg-row-height');
					const parsed = parseInt(val, 10);
					if (!Number.isNaN(parsed)) return parsed;
				}
				return Math.round(40 * this._positionProvider.zoomLevel);
			},
			() => {
				// Column header height = colHeaderLevels * rowHeight
				const rowHeight = this._rootEl
					? (() => {
							const val = getComputedStyle(this._rootEl).getPropertyValue('--sg-row-height');
							const parsed = parseInt(val, 10);
							return !Number.isNaN(parsed) ? parsed : Math.round(40 * this._positionProvider.zoomLevel);
						})()
					: Math.round(40 * this._positionProvider.zoomLevel);
				return (this._lastColAxes.length || 1) * rowHeight;
			},
		);

		// Phase 23 — Initialize SortState from provider (session restore on construct)
		this._sortState = new SortState(this._provider.getSortOverrides());
	}

	// ---------------------------------------------------------------------------
	// IView lifecycle
	// ---------------------------------------------------------------------------

	mount(container: HTMLElement): void {
		// Root wrapper
		const root = document.createElement('div');
		root.className = 'supergrid-view view-root';
		root.style.width = '100%';
		root.style.height = '100%';
		root.style.overflow = 'auto';
		root.style.position = 'relative';

		// CSS Grid container — role="table" for screen reader structural navigation (A11Y-04)
		const grid = document.createElement('div');
		grid.className = 'supergrid-container';
		grid.style.display = 'grid';
		grid.style.gap = '1px';
		grid.setAttribute('role', 'table');
		grid.setAttribute('aria-label', 'SuperGrid data projection');

		// ---------------------------------------------------------------------------
		// Axis drop zones (DYNM-01/DYNM-02) — persistent elements, wired once in mount()
		// ---------------------------------------------------------------------------

		// Col drop zone: accepts row-origin drags to append field to colAxes
		const colDropZone = document.createElement('div');
		colDropZone.className = 'axis-drop-zone axis-drop-zone--col';
		colDropZone.dataset['dropZone'] = 'col';
		colDropZone.style.position = 'absolute';
		colDropZone.style.top = '0';
		colDropZone.style.left = '0';
		colDropZone.style.right = '0';
		colDropZone.style.height = '6px';
		colDropZone.style.zIndex = '10';
		colDropZone.style.pointerEvents = 'auto';
		colDropZone.style.cursor = 'copy';
		this._wireDropZone(colDropZone, 'col');

		// Row drop zone: accepts col-origin drags to append field to rowAxes
		const rowDropZone = document.createElement('div');
		rowDropZone.className = 'axis-drop-zone axis-drop-zone--row';
		rowDropZone.dataset['dropZone'] = 'row';
		rowDropZone.style.position = 'absolute';
		rowDropZone.style.top = '0';
		rowDropZone.style.left = '0';
		rowDropZone.style.bottom = '0';
		rowDropZone.style.width = '6px';
		rowDropZone.style.zIndex = '10';
		rowDropZone.style.pointerEvents = 'auto';
		rowDropZone.style.cursor = 'copy';
		this._wireDropZone(rowDropZone, 'row');

		// ---------------------------------------------------------------------------
		// Phase 22 Plan 02 — Density toolbar (DENS-01: granularity picker)
		// Sits as a sibling ABOVE the grid scroll area but inside the root container.
		// Granularity picker: direct-jump <select> (not sequential cycling).
		// Visibility controlled by _updateDensityToolbar() — hidden when no time axis.
		// ---------------------------------------------------------------------------

		const toolbar = document.createElement('div');
		toolbar.className = 'supergrid-density-toolbar';
		toolbar.style.cssText =
			'display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:var(--text-sm);border-bottom:1px solid var(--border-subtle);position:relative;z-index:10;';

		// TIME-03: Granularity label (replaces old "Group by:" label)
		const granLabel = document.createElement('span');
		granLabel.textContent = 'Time:';
		granLabel.style.fontWeight = '500';
		granLabel.style.opacity = '0.7';
		granLabel.style.fontSize = 'var(--text-sm)';
		this._granPillsLabelEl = granLabel;

		// TIME-03: Segmented pills container (A|D|W|M|Q|Y) — replaces granularity <select>
		// 'A' = Auto (smart hierarchy), D/W/M/Q/Y = manual overrides
		const pillContainer = document.createElement('div');
		pillContainer.className = 'granularity-pills';
		pillContainer.style.cssText = 'display:flex;gap:2px;';

		const pillDefs: Array<{ label: string; value: import('../providers/types').TimeGranularity | null }> = [
			{ label: 'A', value: null }, // Auto
			{ label: 'D', value: 'day' },
			{ label: 'W', value: 'week' },
			{ label: 'M', value: 'month' },
			{ label: 'Q', value: 'quarter' },
			{ label: 'Y', value: 'year' },
		];

		for (const def of pillDefs) {
			const pill = document.createElement('button');
			pill.className = 'granularity-pill';
			pill.dataset['granValue'] = def.value ?? 'auto';
			pill.textContent = def.label;
			pill.style.cssText =
				'font-size:var(--text-xs);padding:2px 6px;border:1px solid var(--border-muted);border-radius:3px;cursor:pointer;background:var(--sg-header-bg, var(--bg-surface));';

			pill.addEventListener('click', () => {
				if (def.value === null) {
					// 'A' pill: enable auto mode, re-run smart detection
					this._isAutoGranularity = true;
					void this._fetchAndRender();
				} else {
					// Manual override: disable auto mode, set specific granularity
					this._isAutoGranularity = false;
					this._densityProvider.setGranularity(def.value);
					// Density subscriber → hybrid routing → _fetchAndRender() fires automatically
				}
			});

			pillContainer.appendChild(pill);
		}

		// Set initial active pill state (default: auto mode → 'A' pill active)
		this._syncPillActiveState(pillContainer);

		this._granPillsEl = pillContainer;

		toolbar.appendChild(granLabel);
		toolbar.appendChild(pillContainer);

		// Separator
		const sep1 = document.createElement('span');
		sep1.style.cssText = 'width:1px;height:14px;background:var(--border-muted);';
		toolbar.appendChild(sep1);

		// Hide-empty checkbox (DENS-02)
		const hideEmptyLabel = document.createElement('label');
		hideEmptyLabel.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
		const hideEmptyCheckbox = document.createElement('input');
		hideEmptyCheckbox.type = 'checkbox';
		hideEmptyCheckbox.checked = this._densityProvider.getState().hideEmpty;
		hideEmptyCheckbox.addEventListener('change', () => {
			this._densityProvider.setHideEmpty(hideEmptyCheckbox.checked);
		});
		const hideEmptyText = document.createElement('span');
		hideEmptyText.textContent = 'Hide empty';
		hideEmptyLabel.appendChild(hideEmptyCheckbox);
		hideEmptyLabel.appendChild(hideEmptyText);
		toolbar.appendChild(hideEmptyLabel);

		// Separator
		const sep2 = document.createElement('span');
		sep2.style.cssText = 'width:1px;height:14px;background:var(--border-muted);';
		toolbar.appendChild(sep2);

		// View mode select (DENS-03) — direct jump picker
		const viewModeLabel = document.createElement('label');
		viewModeLabel.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
		const viewModeLabelText = document.createElement('span');
		viewModeLabelText.textContent = 'View:';
		viewModeLabelText.style.fontWeight = '500';
		viewModeLabelText.style.opacity = '0.7';
		const viewModeSelect = document.createElement('select');
		viewModeSelect.setAttribute('data-control', 'view-mode');
		viewModeSelect.className = 'view-mode-control';
		viewModeSelect.style.cssText =
			'font-size:var(--text-sm);padding:2px 4px;border:1px solid var(--border-muted);border-radius:4px;background:var(--sg-header-bg, var(--bg-surface));cursor:pointer;';
		const viewModeOptions: Array<{ value: string; label: string }> = [
			{ value: 'matrix', label: 'Matrix' },
			{ value: 'spreadsheet', label: 'Spreadsheet' },
		];
		for (const opt of viewModeOptions) {
			const option = document.createElement('option');
			option.value = opt.value;
			option.textContent = opt.label;
			viewModeSelect.appendChild(option);
		}
		viewModeSelect.value = this._densityProvider.getState().viewMode;
		viewModeSelect.addEventListener('change', () => {
			this._densityProvider.setViewMode(viewModeSelect.value as import('../providers/types').ViewMode);
		});
		viewModeLabel.appendChild(viewModeLabelText);
		viewModeLabel.appendChild(viewModeSelect);
		toolbar.appendChild(viewModeLabel);

		// Phase 23 — Clear sorts button (SORT-01/SORT-02: belt-and-suspenders UX)
		// Visible only when hasActiveSorts() is true. Click clears sort chain and triggers re-query.
		const clearSortsBtn = document.createElement('button');
		clearSortsBtn.textContent = 'Clear sorts';
		clearSortsBtn.className = 'clear-sorts-btn';
		clearSortsBtn.style.display = 'none'; // hidden until sorts active
		clearSortsBtn.style.marginLeft = '8px';
		clearSortsBtn.style.fontSize = 'var(--text-sm)';
		clearSortsBtn.style.cursor = 'pointer';
		clearSortsBtn.style.padding = '2px 6px';
		clearSortsBtn.style.border = '1px solid var(--border-muted)';
		clearSortsBtn.style.borderRadius = '4px';
		clearSortsBtn.style.background = 'var(--sg-header-bg, var(--bg-surface))';
		clearSortsBtn.addEventListener('click', () => {
			this._sortState.clear();
			this._provider.setSortOverrides([]);
			// StateCoordinator subscription fires _fetchAndRender() automatically — do NOT call directly
		});
		toolbar.appendChild(clearSortsBtn);
		this._clearSortsBtnEl = clearSortsBtn;

		// Phase 24 Plan 03 — Clear filters button (FILT-04: visible when any axis filter active)
		// Mirrors Clear sorts pattern: created in mount(), hidden by default, shown in _renderCells().
		const clearFiltersBtn = document.createElement('button');
		clearFiltersBtn.textContent = 'Clear filters';
		clearFiltersBtn.className = 'clear-filters-btn';
		clearFiltersBtn.style.display = 'none'; // hidden until axis filters active
		clearFiltersBtn.style.marginLeft = '4px';
		clearFiltersBtn.style.fontSize = 'var(--text-sm)';
		clearFiltersBtn.style.cursor = 'pointer';
		clearFiltersBtn.style.padding = '2px 8px';
		clearFiltersBtn.style.border = '1px solid var(--border-muted)';
		clearFiltersBtn.style.borderRadius = '3px';
		clearFiltersBtn.style.background = 'transparent';
		clearFiltersBtn.addEventListener('click', () => {
			this._filter.clearAllAxisFilters();
			// StateCoordinator subscription fires _fetchAndRender() automatically — do NOT call directly
		});
		toolbar.appendChild(clearFiltersBtn);
		this._clearFiltersBtnEl = clearFiltersBtn;

		// Phase 26 Plan 03 — "Show All" button (TIME-04: visible when period selection is active)
		// Mirrors Clear filters pattern: created in mount(), hidden by default, shown in _renderCells().
		const showAllBtn = document.createElement('button');
		showAllBtn.textContent = 'Show All';
		showAllBtn.className = 'show-all-periods-btn';
		showAllBtn.style.display = 'none'; // hidden until period selection active
		showAllBtn.style.marginLeft = '4px';
		showAllBtn.style.fontSize = 'var(--text-sm)';
		showAllBtn.style.cursor = 'pointer';
		showAllBtn.style.padding = '2px 8px';
		showAllBtn.style.border = '1px solid var(--border-muted)';
		showAllBtn.style.borderRadius = '3px';
		showAllBtn.style.background = 'transparent';
		showAllBtn.addEventListener('click', () => {
			this._clearPeriodSelection();
		});
		toolbar.appendChild(showAllBtn);
		this._showAllBtnEl = showAllBtn;

		// Phase 25 — Search input (SRCH-01: always visible, no toggle state)
		const searchSep = document.createElement('span');
		searchSep.style.cssText = 'width:1px;height:14px;background:var(--border-muted);margin-left:4px;';
		toolbar.appendChild(searchSep);

		const searchInput = document.createElement('input');
		searchInput.type = 'text';
		searchInput.className = 'sg-search-input';
		searchInput.placeholder = 'Search...';
		searchInput.style.cssText =
			'font-size:var(--text-sm);padding:2px 6px;border:1px solid var(--border-muted);border-radius:4px;background:var(--sg-header-bg, var(--bg-surface));width:140px;margin-left:4px;';

		searchInput.addEventListener('input', () => {
			if (this._searchDebounceId !== null) clearTimeout(this._searchDebounceId);
			const term = searchInput.value;
			if (!term.trim()) {
				// SRCH-05: Immediate clear — no debounce
				this._searchTerm = '';
				void this._fetchAndRender();
			} else {
				// SRCH-02: 300ms debounce for non-empty search
				this._searchDebounceId = setTimeout(() => {
					this._searchTerm = term;
					void this._fetchAndRender();
				}, 300);
			}
		});

		// Escape on search input: clear search and stop propagation
		// (prevents document Escape handler from also firing — e.g., selection clear)
		searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				searchInput.value = '';
				this._searchTerm = '';
				if (this._searchDebounceId !== null) {
					clearTimeout(this._searchDebounceId);
					this._searchDebounceId = null;
				}
				void this._fetchAndRender();
			}
		});

		this._searchInputEl = searchInput;
		toolbar.appendChild(searchInput);

		// Match count badge — updated in _renderCells()
		const searchCount = document.createElement('span');
		searchCount.className = 'sg-search-count';
		searchCount.style.cssText = 'font-size:var(--text-xs);color:var(--text-muted);margin-left:4px;min-width:40px;';
		this._searchCountEl = searchCount;
		toolbar.appendChild(searchCount);

		// Phase 25 — Cmd+F handler (SRCH-01: intercept browser find, focus search input)
		this._boundCmdFHandler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
				e.preventDefault();
				this._searchInputEl?.focus();
			}
		};
		document.addEventListener('keydown', this._boundCmdFHandler);

		// Phase 27 — PLSH-04: '?' toolbar button + Cmd+/ handler (help overlay)
		const helpBtn = document.createElement('button');
		helpBtn.className = 'sg-help-btn';
		helpBtn.textContent = '?';
		helpBtn.title = 'Keyboard shortcuts (Cmd+/)';
		helpBtn.style.cssText =
			'font-size:var(--text-sm);padding:2px 6px;border:1px solid var(--border-muted);border-radius:4px;background:var(--sg-header-bg, var(--bg-surface));cursor:pointer;margin-left:4px;';
		helpBtn.addEventListener('click', () => {
			this._toggleHelpOverlay();
		});
		toolbar.appendChild(helpBtn);

		this._boundHelpKeyHandler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === '/') {
				e.preventDefault();
				this._toggleHelpOverlay();
			}
		};
		document.addEventListener('keydown', this._boundHelpKeyHandler);

		// Phase 25 — Inject search highlight style (one-time, scoped by ID guard)
		// sg-search-match: amber outline on matching matrix cells (SRCH-03)
		if (!document.querySelector('#sg-search-styles')) {
			const searchStyle = document.createElement('style');
			searchStyle.id = 'sg-search-styles';
			searchStyle.textContent =
				'.sg-search-match { outline: 2px solid var(--search-match-outline); outline-offset: -2px; }';
			document.head.appendChild(searchStyle);
		}

		// Phase 38 — Create sentinel spacer for virtual scroll height (VSCR-04)
		// Spacer is a child of rootEl (NOT gridEl) so it survives grid DOM teardown.
		// position: absolute so it doesn't affect normal flow or sticky headers.
		const spacer = document.createElement('div');
		spacer.className = 'virtual-scroll-spacer';
		spacer.style.height = '0px';

		root.appendChild(colDropZone);
		root.appendChild(rowDropZone);
		root.appendChild(toolbar);
		root.appendChild(grid);
		root.appendChild(spacer);
		container.appendChild(root);

		this._spacerEl = spacer;

		this._rootEl = root;
		this._gridEl = grid;
		this._densityToolbarEl = toolbar;
		this._colDropZoneEl = colDropZone;
		this._rowDropZoneEl = rowDropZone;

		// Phase 58 CSSB-03: Set data-view-mode on grid container for CSS mode selectors
		grid.dataset['viewMode'] = this._densityProvider.getState().viewMode;

		// Attach sizer to grid element (must happen before first render)
		this._sizer.attach(grid);

		// Phase 38 — Attach virtualizer to scroll container
		this._virtualizer.attach(root);

		// Subscribe to StateCoordinator — re-fetch on any provider change
		this._coordinatorUnsub = this._coordinator.subscribe(() => {
			void this._fetchAndRender();
		});

		// Subscribe to density provider changes (Phase 22 DENS-01..DENS-03).
		// Hybrid routing: granularity changes trigger Worker re-query (_fetchAndRender);
		// hideEmpty and viewMode changes re-render client-side from _lastCells (_renderCells).
		this._unsubDensity = this._densityProvider.subscribe(() => {
			const densityState = this._densityProvider.getState();
			// Phase 58 CSSB-03: Keep data-view-mode in sync with density state
			if (this._gridEl) this._gridEl.dataset['viewMode'] = densityState.viewMode;
			const newGranularity = densityState.axisGranularity;
			if (newGranularity !== this._lastGranularity) {
				// Granularity changed → SQL GROUP BY expression changes → must re-query Worker
				this._lastGranularity = newGranularity;
				void this._fetchAndRender();
			} else {
				// Only hideEmpty or viewMode changed → client-side re-render from cached cells
				if (this._lastCells.length > 0) {
					this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes);
				}
			}
		});

		// Wire SuperZoom — attach BEFORE first render so CSS vars are set for grid-template-columns
		// SuperZoom accepts SuperPositionProvider (concrete); SuperGridPositionLike is structurally
		// compatible (same shape). Cast via unknown to avoid import of concrete class here.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this._superZoom = new SuperZoom(this._positionProvider as any, (zoomLevel: number) => {
			this._showZoomToast(zoomLevel);
			// Reapply per-column widths with updated zoom level.
			// SuperZoom.applyZoom() sets --sg-row-height and --sg-zoom which are still needed.
			// But grid-template-columns uses per-column px values (not CSS Custom Properties),
			// so we must rebuild it whenever zoom changes.
			if (this._gridEl && this._sizer.getLeafColKeys().length > 0) {
				this._sizer.applyWidths(this._sizer.getLeafColKeys(), zoomLevel, this._gridEl);
			}
		});
		this._superZoom.attach(root, grid);
		this._superZoom.applyZoom();

		// Wire rAF-throttled scroll handler — passive: true (no need to preventDefault on scroll)
		root.addEventListener('scroll', this._boundScrollHandler, { passive: true });

		// ---------------------------------------------------------------------------
		// Phase 21 — Selection wiring (SLCT-01..SLCT-08)
		// ---------------------------------------------------------------------------

		// Attach BBoxCache to the grid element (for lasso hit-testing)
		this._bboxCache.attach(grid);

		// Create floating badge (initially hidden)
		const badge = document.createElement('div');
		badge.className = 'selection-badge';
		badge.style.position = 'sticky';
		badge.style.bottom = '8px';
		badge.style.right = '8px';
		badge.style.zIndex = '50';
		badge.style.backgroundColor = 'var(--selection-outline)';
		badge.style.color = 'white';
		badge.style.padding = '4px 10px';
		badge.style.borderRadius = '12px';
		badge.style.fontSize = 'var(--text-sm)';
		badge.style.fontWeight = 'bold';
		badge.style.pointerEvents = 'none';
		badge.style.display = 'none';
		root.appendChild(badge);
		this._badgeEl = badge;

		// Wire Escape key handler on document (works without focus on grid)
		this._boundEscapeHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && this._rootEl) {
				// PLSH-04: Close help overlay first (if open) — before other Escape handlers
				if (this._helpOverlayEl) {
					e.stopPropagation();
					this._closeHelpOverlay();
					return;
				}
				// PLSH-05: Close context menu first (if open)
				if (this._contextMenuEl) {
					this._closeContextMenu();
					return;
				}
				// TIME-04: Clear period selection first (if active).
				// First Escape clears period selection; second Escape clears card selection.
				if (this._periodSelection.size > 0) {
					this._clearPeriodSelection();
					return; // don't also clear card selection on same Escape
				}
				this._selectionAdapter.clear();
			}
		};
		document.addEventListener('keydown', this._boundEscapeHandler);

		// Subscribe to selection changes → update visuals + badge
		this._selectionUnsub = this._selectionAdapter.subscribe(() => {
			this._updateSelectionVisuals();
		});

		// Phase 27 — PLSH-05: Contextmenu event delegation on _gridEl (registered ONCE in mount())
		// Event delegation via .closest() — checks if target is inside a col-header or row-header.
		// Anti-pattern: Do NOT register contextmenu listener inside _renderCells() — would accumulate
		// duplicate listeners on every render (Pitfall 2).
		this._boundContextMenuHandler = (e: MouseEvent) => {
			const header = (e.target as Element).closest<HTMLElement>('.col-header, .row-header');
			if (!header) return;
			e.preventDefault();
			e.stopPropagation();
			const axisField = header.dataset['axisField'] ?? '';
			if (!axisField) return;
			const headerValue = header.dataset['value'] ?? '';
			const dimension = header.classList.contains('col-header') ? 'col' : 'row';
			const collapseKey = header.dataset['collapseKey'] ?? '';
			this._openContextMenu(e.clientX, e.clientY, axisField, dimension, headerValue, collapseKey);
		};
		grid.addEventListener('contextmenu', this._boundContextMenuHandler);

		// Defensive reset: ensure _mountSetupDone is false at start of mount()
		// (destroy() handles the normal path; this is belt-and-suspenders for re-mount)
		this._mountSetupDone = false;

		// Fire initial query — one-time mount setup (position restore + lasso attach) is
		// handled by _completeMountSetup(), which is called both from this .then() AND
		// from _fetchAndRender() after successful render. This survives rAF coalescing
		// that can abandon the first promise when a second _fetchAndRender() fires in
		// the same frame.
		void this._fetchAndRender().then(() => {
			this._completeMountSetup();
		});
	}

	/**
	 * No-op — SuperGrid self-manages data via bridge.superGridQuery().
	 * The IView interface requires this method but SuperGrid does not use
	 * coordinator-supplied cards. Data flows through _fetchAndRender() instead.
	 */
	render(_cards: CardDatum[]): void {
		// Intentional no-op — bridge.superGridQuery() drives SuperGrid data
	}

	destroy(): void {
		// Unsubscribe from coordinator FIRST to prevent in-flight callbacks
		if (this._coordinatorUnsub) {
			this._coordinatorUnsub();
			this._coordinatorUnsub = null;
		}

		// Unsubscribe from density provider (Phase 22)
		if (this._unsubDensity) {
			this._unsubDensity();
			this._unsubDensity = null;
		}

		// Phase 21 — Selection cleanup
		if (this._selectionUnsub) {
			this._selectionUnsub();
			this._selectionUnsub = null;
		}
		if (this._boundEscapeHandler) {
			document.removeEventListener('keydown', this._boundEscapeHandler);
			this._boundEscapeHandler = null;
		}
		this._sgSelect.detach();
		this._bboxCache.detach();
		this._selectionAnchor = null;

		// Detach SuperZoom (removes wheel + keydown listeners)
		if (this._superZoom) {
			this._superZoom.detach();
			this._superZoom = null;
		}

		// Detach SuperGridSizer
		this._sizer.detach();

		// Phase 38 — Detach virtualizer
		this._virtualizer.detach();
		this._spacerEl = null;
		this._lastRenderedRange = { startRow: 0, endRow: 0 };

		// Remove scroll listener and cancel any pending rAF
		if (this._rootEl) {
			this._rootEl.removeEventListener('scroll', this._boundScrollHandler);
		}
		if (this._scrollRafId !== null) {
			cancelAnimationFrame(this._scrollRafId);
			this._scrollRafId = null;
		}

		// Clean up zoom toast
		if (this._toastTimeout !== null) {
			clearTimeout(this._toastTimeout);
			this._toastTimeout = null;
		}
		if (this._toastEl) {
			this._toastEl.remove();
			this._toastEl = null;
		}

		// Phase 27 — PLSH-04: Close help overlay before removing DOM
		this._closeHelpOverlay();
		if (this._boundHelpKeyHandler) {
			document.removeEventListener('keydown', this._boundHelpKeyHandler);
			this._boundHelpKeyHandler = null;
		}

		// Phase 27 — PLSH-05: Close context menu and remove contextmenu listener
		this._closeContextMenu();
		if (this._boundContextMenuHandler && this._gridEl) {
			this._gridEl.removeEventListener('contextmenu', this._boundContextMenuHandler);
		}
		this._boundContextMenuHandler = null;
		this._hiddenCols.clear();
		this._hiddenRows.clear();

		// Phase 24 — Close filter dropdown before removing DOM
		this._closeFilterDropdown();

		// Phase 27 — Close SuperCard tooltip before removing DOM (CARD-03)
		this._closeSuperCardTooltip();

		// Phase 59 VFST-03 — Close overflow badge tooltip before removing DOM
		this._closeOverflowTooltip();

		// Remove DOM — _rootEl contains toolbar, grid, and all children
		if (this._rootEl?.parentElement) {
			this._rootEl.parentElement.removeChild(this._rootEl);
		}
		this._rootEl = null;
		this._gridEl = null;
		this._densityToolbarEl = null;
		this._hiddenIndicatorEl = null;
		this._clearSortsBtnEl = null;
		this._clearFiltersBtnEl = null;
		this._granPillsEl = null;
		this._granPillsLabelEl = null;

		// Phase 26 Plan 03 — Clean up period selection state (TIME-04)
		this._periodSelection.clear();
		this._showAllBtnEl = null;

		// Phase 25 — Clean up search state
		if (this._boundCmdFHandler) {
			document.removeEventListener('keydown', this._boundCmdFHandler);
			this._boundCmdFHandler = null;
		}
		if (this._searchDebounceId !== null) {
			clearTimeout(this._searchDebounceId);
			this._searchDebounceId = null;
		}
		this._searchInputEl = null;
		this._searchCountEl = null;
		this._searchTerm = '';

		// Phase 30 — Save collapse state to PAFVProvider before clearing (CLPS-05)
		if (this._collapsedSet.size > 0) {
			this._syncCollapseToProvider();
		}

		// Phase 31-02: Clean up visual drag UX state
		this._removeInsertionLine();
		this._dragSourceEl = null;
		this._lastReorderTargetIndex = -1;
		this._flipSnapshot = null;

		// Clear internal state
		this._collapsedSet = new Set();
		this._collapseModeMap = new Map();
		this._lastCells = [];
		this._lastColAxes = [];
		this._lastRowAxes = [];
		this._isInitialMount = true;
		this._mountSetupDone = false;
		this._colDropZoneEl = null;
		this._rowDropZoneEl = null;
	}

	// ---------------------------------------------------------------------------
	// Private — fetch and render pipeline
	// ---------------------------------------------------------------------------

	/**
	 * Fetch data from WorkerBridge and render.
	 * Reads axes from provider, compiles filter, calls bridge.superGridQuery().
	 * On success: crossfades grid (opacity 0→1 over 300ms) then calls _renderCells().
	 * On error: calls _showError().
	 */
	private async _fetchAndRender(): Promise<void> {
		const grid = this._gridEl;
		if (!grid) return;

		// Read axes from provider (with fallback to VIEW_DEFAULTS)
		const { colAxes: rawColAxes, rowAxes: rawRowAxes } = this._provider.getStackedGroupBySQL();
		const colAxes = rawColAxes.length > 0 ? rawColAxes : DEFAULT_COL_AXES;
		const rowAxes = rawRowAxes.length > 0 ? rawRowAxes : DEFAULT_ROW_AXES;

		// Compile filter
		const { where, params } = this._filter.compile();

		// Read density state for granularity (Phase 22 DENS-01)
		const densityState = this._densityProvider.getState();

		// Pre-render: set opacity to 0 for crossfade effect (DYNM-04)
		grid.style.opacity = '0';

		try {
			const cells = await this._bridge.superGridQuery({
				colAxes,
				rowAxes,
				where,
				params,
				granularity: densityState.axisGranularity,
				sortOverrides: this._sortState.getSorts(), // Phase 23 SORT-04
				// Phase 25 SRCH-04: pass searchTerm only when non-empty (undefined when inactive avoids FTS5 empty query crash)
				...(this._searchTerm ? { searchTerm: this._searchTerm } : {}),
			});
			// Check if destroyed while waiting for response
			if (!this._gridEl) return;

			// TIME-01/TIME-02: Smart hierarchy auto-detection (Phase 26)
			// Runs only when user has NOT manually overridden the granularity level.
			// Guard prevents infinite loop:
			//   _fetchAndRender() → setGranularity() → density subscriber → _fetchAndRender()
			//   → next call: same level computed → no setGranularity() call → render proceeds normally.
			if (this._isAutoGranularity) {
				const smartLevel = this._computeSmartHierarchy(cells, colAxes, rowAxes);
				if (smartLevel !== null) {
					const currentLevel = densityState.axisGranularity;
					if (smartLevel !== currentLevel) {
						// setGranularity() notifies subscribers → density subscriber → _fetchAndRender() again.
						// On re-call: same data → same computed level → level === currentLevel → no setGranularity → render.
						this._densityProvider.setGranularity(smartLevel);
						return; // let subscriber re-trigger with correct granularity
					}
				}
			}

			// Phase 59 VFST-02: Rebuild card name cache from query results
			this._cardNameCache.clear();
			for (const cell of cells) {
				for (let i = 0; i < cell.card_ids.length; i++) {
					const id = cell.card_ids[i]!;
					if (!this._cardNameCache.has(id)) {
						this._cardNameCache.set(id, cell.card_names[i] ?? id);
					}
				}
			}

			this._lastCells = cells;
			this._lastColAxes = colAxes;
			this._lastRowAxes = rowAxes;

			// Phase 30 — Restore collapse state from PAFVProvider on mount (CLPS-05)
			if (this._collapsedSet.size === 0) {
				const savedState = this._provider.getCollapseState();
				for (const entry of savedState) {
					this._collapsedSet.add(entry.key);
					this._collapseModeMap.set(entry.key, entry.mode);
				}
			}

			this._renderCells(cells, colAxes, rowAxes);

			// Complete one-time mount setup if not already done.
			// This ensures position restore + lasso attach happen even if the
			// mount() .then() promise was abandoned by rAF coalescing.
			this._completeMountSetup();

			// Scroll reset: coordinator-triggered re-renders (filter change, axis transpose)
			// reset scroll to (0,0). Initial mount is handled by restorePosition in mount().
			// Per CONTEXT.md: "Filter change -> reset scroll to (0,0). Different data = contextually
			// meaningless scroll position." and "Cross-dimension axis transpose -> reset scroll to (0,0)."
			if (!this._isInitialMount && this._rootEl) {
				this._rootEl.scrollTop = 0;
				this._rootEl.scrollLeft = 0;
				this._positionProvider.savePosition(this._rootEl);
				// Phase 38 — Reset virtualizer range on scroll reset
				this._lastRenderedRange = { startRow: 0, endRow: 0 };
			}

			// Post-render: transition opacity 0→1 over 300ms (DYNM-04)
			// D3 transitions auto-cancel previous transitions on the same element
			d3.select(grid).transition().duration(300).style('opacity', '1');
		} catch (err) {
			if (!this._gridEl) return;
			// Restore opacity on error so error message is visible
			grid.style.opacity = '1';
			this._showError(err instanceof Error ? err.message : String(err));
		}
	}

	/**
	 * Render the CSS Grid from a CellDatum array.
	 * Called from _fetchAndRender() and from collapse click handlers.
	 *
	 * The CellDatum shape is dynamic — cells have axis fields as named keys.
	 * For example with colAxes=[card_type] and rowAxes=[folder]:
	 *   { card_type: 'note', folder: 'A', count: 2, card_ids: ['id1','id2'] }
	 */
	private _renderCells(cells: CellDatum[], colAxes: AxisMapping[], rowAxes: AxisMapping[]): void {
		const grid = this._gridEl;
		if (!grid) return;

		// Phase 27 CARD-03: Close any open SuperCard tooltip before DOM rebuild (Pitfall 3).
		// Tooltip anchor element is about to be removed from DOM — clean up first.
		this._closeSuperCardTooltip();

		// Phase 59 VFST-03: Close overflow tooltip before DOM rebuild.
		this._closeOverflowTooltip();

		// Phase 22 Plan 02 — update density toolbar visibility based on whether
		// any active axis is a time field. Must run on every _renderCells call.
		this._updateDensityToolbar(colAxes, rowAxes);

		// ---------------------------------------------------------------------------
		// Extract distinct axis values from cells (Phase 28 — N-level compound keys)
		// ---------------------------------------------------------------------------

		// Build distinct axis value tuples from cells (all stacking levels).
		// Each tuple is an array of values at each axis level: [level0Val, level1Val, ...]
		// Using UNIT_SEP (\x1f) as the join/split character to deduplicate tuples.
		const colTuples = cells.map((c) => colAxes.map((ax) => String(c[ax.field] ?? 'unknown')));
		const rowTuples = cells.map((c) => rowAxes.map((ax) => String(c[ax.field] ?? 'None')));
		const colTupleSet = new Set(colTuples.map((t) => t.join(UNIT_SEP)));
		const rowTupleSet = new Set(rowTuples.map((t) => t.join(UNIT_SEP)));
		const colAxisValuesRaw = [...colTupleSet].sort().map((k) => k.split(UNIT_SEP));
		const rowAxisValuesRaw = [...rowTupleSet].sort().map((k) => k.split(UNIT_SEP));

		// ---------------------------------------------------------------------------
		// Phase 22 Plan 03 — Hide-empty filter (DENS-02)
		// Remove entire rows/columns where ALL cells have count=0.
		// Client-side filter on _lastCells — no Worker re-query needed.
		// Now uses compound dimension keys for multi-level axis comparison.
		// ---------------------------------------------------------------------------
		const densityStateForHide = this._densityProvider.getState();
		let colAxisValues = colAxisValuesRaw;
		let rowAxisValues = rowAxisValuesRaw;
		let hiddenColCount = 0;
		let hiddenRowCount = 0;

		if (densityStateForHide.hideEmpty) {
			colAxisValues = colAxisValuesRaw.filter((tuple) => {
				const tupleKey = tuple.join(UNIT_SEP);
				return cells.some(
					(c) => colAxes.map((ax) => String(c[ax.field] ?? 'unknown')).join(UNIT_SEP) === tupleKey && c.count > 0,
				);
			});
			rowAxisValues = rowAxisValuesRaw.filter((tuple) => {
				const tupleKey = tuple.join(UNIT_SEP);
				return cells.some(
					(c) => rowAxes.map((ax) => String(c[ax.field] ?? 'None')).join(UNIT_SEP) === tupleKey && c.count > 0,
				);
			});
			hiddenColCount = colAxisValuesRaw.length - colAxisValues.length;
			hiddenRowCount = rowAxisValuesRaw.length - rowAxisValues.length;
		}

		// ---------------------------------------------------------------------------
		// PLSH-05 fix — Filter out explicitly hidden columns/rows
		// Removes values the user hid via right-click context menu → Hide column/row.
		// Runs after hideEmpty so both filters compose (hidden + empty = excluded).
		// For multi-level axes: hidden key is the primary (first) axis value.
		// ---------------------------------------------------------------------------
		if (this._hiddenCols.size > 0) {
			const before = colAxisValues.length;
			colAxisValues = colAxisValues.filter((tuple) => !this._hiddenCols.has(tuple[0] ?? ''));
			hiddenColCount += before - colAxisValues.length;
		}
		if (this._hiddenRows.size > 0) {
			const before = rowAxisValues.length;
			rowAxisValues = rowAxisValues.filter((tuple) => !this._hiddenRows.has(tuple[0] ?? ''));
			hiddenRowCount += before - rowAxisValues.length;
		}

		// Update "+N hidden" badge (DENS-02)
		this._updateHiddenBadge(hiddenColCount + hiddenRowCount);

		// If no cells after filtering, produce an empty grid
		if (colAxisValues.length === 0 && rowAxisValues.length === 0) {
			while (grid.firstChild) grid.removeChild(grid.firstChild);

			// EMPTY-04: Show density-aware message when hideEmpty filtered everything
			if (densityStateForHide.hideEmpty && (colAxisValuesRaw.length > 0 || rowAxisValuesRaw.length > 0)) {
				const emptyMsg = document.createElement('div');
				emptyMsg.className = 'sg-density-empty';
				emptyMsg.style.cssText =
					'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:48px 24px;color:var(--text-muted);width:100%;';

				const heading = document.createElement('div');
				heading.style.cssText = 'font-size:var(--text-lg);font-weight:500;color:var(--text-secondary);';
				heading.textContent = 'All rows hidden by density settings';
				emptyMsg.appendChild(heading);

				const desc = document.createElement('div');
				desc.style.cssText = 'font-size:var(--text-base);';
				desc.textContent = `${colAxisValuesRaw.length} columns and ${rowAxisValuesRaw.length} rows contain only empty intersections`;
				emptyMsg.appendChild(desc);

				const showAllBtn = document.createElement('button');
				showAllBtn.className = 'sg-density-show-all';
				showAllBtn.textContent = 'Show All';
				showAllBtn.style.cssText =
					'margin-top:8px;padding:6px 16px;background:transparent;color:var(--accent);border:1px solid var(--accent);border-radius:4px;font-size:var(--text-base);cursor:pointer;transition:background 150ms;';
				showAllBtn.addEventListener('mouseenter', () => {
					showAllBtn.style.backgroundColor = 'var(--accent-bg)';
				});
				showAllBtn.addEventListener('mouseleave', () => {
					showAllBtn.style.backgroundColor = 'transparent';
				});
				showAllBtn.addEventListener('click', () => {
					this._densityProvider.setHideEmpty(false);
				});
				emptyMsg.appendChild(showAllBtn);

				grid.appendChild(emptyMsg);
			}

			return;
		}

		// Fallback field names for single-axis usage (header DnD, time axis checks, etc.)
		// These reference the primary (first) axis field — same as before for N=1 configs.
		const colField = colAxes[0]?.field ?? 'card_type';
		const rowField = rowAxes[0]?.field ?? 'folder';

		// ---------------------------------------------------------------------------
		// Compute headers via buildHeaderCells
		// ---------------------------------------------------------------------------

		const { headers: colHeaders, leafCount: _colLeafCount } = buildHeaderCells(colAxisValues, this._collapsedSet);
		const { headers: rowHeaders, leafCount: _rowLeafCount } = buildHeaderCells(rowAxisValues, this._collapsedSet);

		// ---------------------------------------------------------------------------
		// Set grid-template-columns
		// ---------------------------------------------------------------------------

		// Build leaf column keys from the last level of colHeaders (leaf-level HeaderCell values).
		// These are the ordered colKey values used to look up per-column widths.
		const leafColKeys = (colHeaders[colHeaders.length - 1] ?? []).map((c) => c.value);

		// Update sizer's leaf key tracking (for Shift+drag normalize and zoom recalc)
		this._sizer.setLeafColKeys(leafColKeys);

		// Phase 29: compute rowHeaderDepth from row axis levels (min 1 for backward compatibility)
		const rowHeaderDepth = rowHeaders.length || 1;
		this._rowHeaderDepth = rowHeaderDepth;

		// Build grid-template-columns using per-column widths from sizer (includes persisted widths)
		// Pass rowHeaderDepth so each row axis level gets its own 80px header column.
		grid.style.gridTemplateColumns = buildGridTemplateColumns(
			leafColKeys,
			this._sizer.getColWidths(),
			this._positionProvider.zoomLevel,
			rowHeaderDepth,
		);

		const colHeaderLevels = colHeaders.length;
		// Phase 29: use leaf-level row count (last level) for gridTemplateRows.
		// With N row axes, rowHeaders[last] contains the leaf-level cells whose count
		// determines how many CSS Grid rows are needed.
		const leafRowCells: HeaderCell[] = rowHeaders[rowHeaders.length - 1] ?? rowHeaders[0] ?? [];
		const totalRows = colHeaderLevels + leafRowCells.length;

		// Phase 50 — ARIA table structure for screen readers (A11Y-04)
		// rowcount = total logical data rows (not just visible/windowed); colcount = leaf column count
		grid.setAttribute('aria-rowcount', String(leafRowCells.length));
		grid.setAttribute('aria-colcount', String(leafColKeys.length));

		// Phase 38 — gridTemplateRows optimization: when virtualizer is active, use
		// fixed row height instead of 'auto' to avoid massive CSS string at 10K+ scale.
		// All row slots are still defined (for correct grid-row placement of windowed cells).
		if (this._virtualizer.isActive()) {
			const headerRowDefs = Array(colHeaderLevels).fill('auto');
			const dataRowDefs = Array(leafRowCells.length).fill('var(--sg-row-height, 40px)');
			grid.style.gridTemplateRows = [...headerRowDefs, ...dataRowDefs].join(' ');
		} else {
			grid.style.gridTemplateRows = Array(totalRows).fill('auto').join(' ');
		}

		// ---------------------------------------------------------------------------
		// Render column headers
		// ---------------------------------------------------------------------------

		while (grid.firstChild) grid.removeChild(grid.firstChild);

		for (let levelIdx = 0; levelIdx < colHeaders.length; levelIdx++) {
			const levelCells = colHeaders[levelIdx] ?? [];
			const gridRow = levelIdx + 1;

			const corner = document.createElement('div');
			corner.className = 'corner-cell sg-corner-cell sg-header';
			corner.style.gridRow = `${gridRow}`;
			// Phase 29: corner spans all row-header columns so it covers the full header area.
			corner.style.gridColumn = rowHeaderDepth > 1 ? `1 / span ${rowHeaderDepth}` : '1';
			// Sticky corner: sticks to both top and left edges, above all other sticky cells (z-index:3)
			corner.style.position = 'sticky';
			corner.style.top = '0';
			corner.style.left = '0';
			corner.style.zIndex = '3';
			// Phase 58 CSSB-03: backgroundColor handled by .sg-corner-cell + .sg-header CSS classes
			grid.appendChild(corner);

			// Axis field for this header level — grip encodes the field, not the displayed value
			const levelAxisField = colAxes[levelIdx]?.field ?? colField;

			// Leaf level = last level in colHeaders
			const isLeafLevel = levelIdx === colHeaders.length - 1;

			// Phase 22 Plan 02 (DENS-05): aggregate count for time-axis col headers.
			// When granularity is active and this axis is a time field, compute total card count
			// per header value and pass to createColHeaderCell for "January (47)" format display.
			const densityState = this._densityProvider.getState();
			const isTimeAxisCol = densityState.axisGranularity !== null && ALLOWED_COL_TIME_FIELDS.has(levelAxisField);

			for (let cellIdx = 0; cellIdx < levelCells.length; cellIdx++) {
				const cell = levelCells[cellIdx]!;

				// Compute aggregate count for this header value if granularity is active on a time field
				let aggregateCount: number | undefined;
				if (isTimeAxisCol) {
					aggregateCount = cells
						.filter((c) => String(c[levelAxisField] ?? 'unknown') === cell.value)
						.reduce((sum, c) => sum + c.count, 0);
				}
				// Phase 30 — aggregate count for collapsed headers in aggregate mode (CLPS-02)
				if (cell.isCollapsed && !isTimeAxisCol) {
					const collapseKey = `${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`;
					const mode = this._collapseModeMap.get(collapseKey);
					if (mode === 'aggregate') {
						aggregateCount = cells
							.filter((c) => String(c[levelAxisField] ?? 'unknown') === cell.value)
							.reduce((sum, c) => sum + c.count, 0);
					}
				}

				const el = this._createColHeaderCell(cell, gridRow, levelAxisField, levelIdx, aggregateCount);

				// Attach resize handle to leaf column headers (SIZE-01: drag resize)
				if (isLeafLevel) {
					this._sizer.addHandleToHeader(el, cell.value);

					// Phase 23 — Sort icon on leaf col headers (SORT-01/SORT-02/SORT-03)
					const axisField = colAxes[levelIdx]?.field;
					if (axisField) {
						const sortBtn = this._createSortIcon(axisField as AxisField);
						el.appendChild(sortBtn);

						// Phase 24 — Filter icon on leaf col headers (FILT-01)
						const filterIcon = this._createFilterIcon(axisField, 'col');
						el.appendChild(filterIcon);
					}
				}

				grid.appendChild(el);
			}
		}

		// ---------------------------------------------------------------------------
		// Render data cells via D3 data join
		// ---------------------------------------------------------------------------

		// Build leaf column cells for placement
		const leafColCells: HeaderCell[] = colHeaders[colHeaders.length - 1] ?? [];
		// colValueToStart maps compound col key (parentPath\x1fvalue or just value for level-0)
		// to the CSS Grid column start index.
		const colValueToStart = new Map<string, number>();
		for (const cell of leafColCells) {
			// Reconstruct compound col key from parentPath + value (matching the same format
			// used in buildDimensionKey: values joined by UNIT_SEP within the dimension).
			const fullColKey = cell.parentPath ? `${cell.parentPath}${UNIT_SEP}${cell.value}` : cell.value;
			colValueToStart.set(fullColKey, cell.colStart);
		}

		// Build CellPlacement data from cells (one per visible row×col intersection)
		interface CellPlacement {
			rowKey: string;
			colKey: string;
			count: number;
			cardIds: string[];
			cardNames: string[];
			matchedCardIds: string[]; // Phase 25 SRCH-03: IDs of cards matching current search term
			isSummary?: boolean; // Phase 30 CLPS-02: aggregate summary cell marker
		}

		// Preindex cells by compound key for O(1) lookup (Phase 28 — buildCellKey from keys.ts).
		// Key format: buildCellKey uses RECORD_SEP (\x1e) between row and col dimension keys.
		const cellMap = new Map<string, CellDatum>();
		for (const c of cells) {
			cellMap.set(buildCellKey(c, rowAxes, colAxes), c);
		}

		// Phase 30 — Filter out hide-mode collapsed groups from leaf cells (CLPS-03)
		const visibleLeafColCells = leafColCells.filter((cell) => {
			if (!cell.isCollapsed) return true;
			const ck = `${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`;
			return this._collapseModeMap.get(ck) !== 'hide';
		});
		const visibleLeafRowCells = leafRowCells.filter((cell) => {
			if (!cell.isCollapsed) return true;
			const ck = `${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`;
			return this._collapseModeMap.get(ck) !== 'hide';
		});

		// ---------------------------------------------------------------------------
		// Phase 38 — Virtual row windowing (VSCR-02)
		// When virtualizer is active (>100 leaf rows), only render visible + overscan rows.
		// ---------------------------------------------------------------------------
		this._virtualizer.setTotalRows(visibleLeafRowCells.length);
		const { startRow, endRow } = this._virtualizer.getVisibleRange();
		this._lastRenderedRange = { startRow, endRow };

		// When virtualizer is active, only render rows in the visible window
		const windowedLeafRowCells = this._virtualizer.isActive()
			? visibleLeafRowCells.slice(startRow, endRow)
			: visibleLeafRowCells;

		// Build visible row key set for fast lookup (row header filtering + aggregate filtering)
		const visibleRowKeySet: Set<string> | null = this._virtualizer.isActive()
			? new Set(windowedLeafRowCells.map((c) => (c.parentPath ? `${c.parentPath}${UNIT_SEP}${c.value}` : c.value)))
			: null; // null = all rows visible, skip filter

		// ---------------------------------------------------------------------------
		// Render row headers (Phase 29: N-level loop)
		// Moved after virtualizer windowing so visibleRowKeySet is available for filtering.
		// ---------------------------------------------------------------------------

		for (let levelIdx = 0; levelIdx < rowHeaders.length; levelIdx++) {
			const levelCells = rowHeaders[levelIdx] ?? [];
			const levelAxisField = rowAxes[levelIdx]?.field ?? rowField;

			for (const cell of levelCells) {
				// Phase 38 — Skip row headers for non-visible rows when virtualizer is active
				if (visibleRowKeySet) {
					const fullKey = cell.parentPath ? `${cell.parentPath}${UNIT_SEP}${cell.value}` : cell.value;
					if (!visibleRowKeySet.has(fullKey)) continue;
				}

				const el = this._createRowHeaderCell(
					cell,
					levelAxisField,
					levelIdx,
					colHeaderLevels,
					rowHeaderDepth,
					rowAxes,
					rowField,
				);
				grid.appendChild(el);
			}
		}

		// Rebuild colValueToStart using only visible leaf col cells (hide-mode groups excluded)
		const visibleColValueToStart = new Map<string, number>();
		// Re-assign colStart positions sequentially for visible cells
		let visColPos = 1;
		for (const cell of visibleLeafColCells) {
			const fullColKey = cell.parentPath ? `${cell.parentPath}${UNIT_SEP}${cell.value}` : cell.value;
			visibleColValueToStart.set(fullColKey, visColPos);
			visColPos++;
		}

		const cellPlacements: CellPlacement[] = [];
		for (const rowCell of windowedLeafRowCells) {
			// Reconstruct compound row key: parentPath\x1fvalue (or just value at level 0).
			const fullRowKey = rowCell.parentPath ? `${rowCell.parentPath}${UNIT_SEP}${rowCell.value}` : rowCell.value;
			for (const colCell of visibleLeafColCells) {
				// Reconstruct compound col key: parentPath\x1fvalue (or just value at level 0).
				const fullColKey = colCell.parentPath ? `${colCell.parentPath}${UNIT_SEP}${colCell.value}` : colCell.value;
				// Compound cell key: fullRowKey\x1efullColKey (RECORD_SEP between dimensions).
				const matchingCell = cellMap.get(`${fullRowKey}${RECORD_SEP}${fullColKey}`);
				cellPlacements.push({
					rowKey: fullRowKey,
					colKey: fullColKey,
					count: matchingCell?.count ?? 0,
					cardIds: matchingCell?.card_ids ?? [],
					cardNames: matchingCell?.card_names ?? [],
					matchedCardIds: (matchingCell?.['matchedCardIds'] as string[] | undefined) ?? [],
				});
			}
		}

		// Phase 32 — Deepest-wins: pre-compute suppressed collapse keys.
		// When multiple header levels are simultaneously collapsed in aggregate mode,
		// only the deepest collapsed level should produce summary cells. Parent-level
		// summaries are suppressed to prevent double-counting.
		// NOTE: This only affects render output — _collapsedSet and _collapseModeMap are untouched
		// so that expand/collapse toggle behavior remains correct.
		const suppressedCollapseKeys = new Set<string>();
		for (const key of this._collapsedSet) {
			if (this._collapseModeMap.get(key) !== 'aggregate') continue;
			const parts = key.split('\x1f');
			const levelStr = parts[0] ?? '0';
			const level = parseInt(levelStr, 10);
			// Reconstruct this key's full path: parentPath + value
			// Collapse key format: "${level}\x1f${parentPath}\x1f${value}"
			// parentPath may contain \x1f separators itself (e.g., "A\x1fX")
			const parentPath = parts.slice(1, -1).join('\x1f');
			const value = parts[parts.length - 1] ?? '';
			const thisPath = parentPath ? `${parentPath}\x1f${value}` : value;

			for (const otherKey of this._collapsedSet) {
				if (this._collapseModeMap.get(otherKey) !== 'aggregate') continue;
				if (otherKey === key) continue;
				const otherParts = otherKey.split('\x1f');
				const otherLevelStr = otherParts[0] ?? '0';
				const otherLevel = parseInt(otherLevelStr, 10);
				if (otherLevel <= level) continue;
				// Check if otherKey is a descendant of this key
				const otherParentPath = otherParts.slice(1, -1).join('\x1f');
				if (otherParentPath === thisPath || otherParentPath.startsWith(thisPath + '\x1f')) {
					suppressedCollapseKeys.add(key);
					break;
				}
			}
		}

		// Phase 30+32 — Inject aggregate summary cells for collapsed headers (CLPS-02)
		// Phase 32: Scan ALL col header levels (not just leaf) and _collapsedSet directly
		// to find aggregate-mode collapses, including those hidden by a parent collapse.
		// Deepest-wins suppression has already been pre-computed in suppressedCollapseKeys.

		// --- COL dimension aggregate injection ---
		// Build sets of ALL col/row header keys (visible at any level) for dimension disambiguation.
		const colHeaderKeySet = new Set<string>();
		for (let lvl = 0; lvl < colHeaders.length; lvl++) {
			for (const cell of colHeaders[lvl] ?? []) {
				colHeaderKeySet.add(`${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`);
			}
		}
		const rowHeaderKeySet = new Set<string>();
		for (let lvl = 0; lvl < rowHeaders.length; lvl++) {
			for (const cell of rowHeaders[lvl] ?? []) {
				rowHeaderKeySet.add(`${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`);
			}
		}

		// Collect effective col collapse keys: from _collapsedSet, classified as col dimension
		// by checking: (a) key exists in colHeaderKeySet, OR (b) level < colAxes.length and
		// the key's value matches data at that col axis field (for keys hidden by parent collapse).
		const effectiveColCollapseKeys: Array<{
			level: number;
			parentPath: string;
			value: string;
			fullKey: string;
		}> = [];
		for (const key of this._collapsedSet) {
			if (this._collapseModeMap.get(key) !== 'aggregate') continue;
			if (suppressedCollapseKeys.has(key)) continue;

			const parts = key.split('\x1f');
			const level = parseInt(parts[0] ?? '0', 10);
			if (level >= colAxes.length) continue;
			const parentPath = parts.slice(1, -1).join('\x1f');
			const value = parts[parts.length - 1] ?? '';
			const fullKey = parentPath ? `${parentPath}${UNIT_SEP}${value}` : value;

			// Dimension check: prefer colHeaderKeySet match; fall back to data field match
			const isInColHeaders = colHeaderKeySet.has(key);
			const isInRowHeaders = rowHeaderKeySet.has(key);
			if (!isInColHeaders) {
				// Key was hidden by parent collapse — verify via data field match
				const colField = colAxes[level]?.field;
				if (!colField) continue;
				// If the same key exists in row headers, skip it for col dimension
				if (isInRowHeaders) continue;
				const hasMatchingData = cells.some((c) => String((c as Record<string, unknown>)[colField] ?? 'None') === value);
				if (!hasMatchingData) continue;
			}

			effectiveColCollapseKeys.push({ level, parentPath, value, fullKey });

			// Ensure position mapping exists
			if (!visibleColValueToStart.has(fullKey)) {
				const headerCell = (colHeaders[level] ?? []).find((c) => c.parentPath === parentPath && c.value === value);
				if (headerCell) {
					visibleColValueToStart.set(fullKey, headerCell.colStart);
				}
			}
		}

		for (const { level, value, fullKey } of effectiveColCollapseKeys) {
			const colField = colAxes[level]?.field;

			// Phase 38: iterate windowedLeafRowCells (not all visible) to skip non-rendered rows
			for (const rowCell of windowedLeafRowCells) {
				const fullRowKey = rowCell.parentPath ? `${rowCell.parentPath}${UNIT_SEP}${rowCell.value}` : rowCell.value;

				// Sum all cells that belong to this collapsed col group at this row position
				const aggregateCount = cells
					.filter((c) => {
						const cellRowKey = rowAxes.map((a) => String(c[a.field] ?? 'None')).join(UNIT_SEP);
						if (cellRowKey !== fullRowKey) return false;
						if (!colField) return false;
						const cellColVal = String((c as Record<string, unknown>)[colField] ?? 'None');
						return cellColVal === value;
					})
					.reduce((sum, c) => sum + c.count, 0);

				const existingIdx = cellPlacements.findIndex((cp) => cp.rowKey === fullRowKey && cp.colKey === fullKey);
				if (existingIdx >= 0) {
					cellPlacements[existingIdx] = {
						rowKey: fullRowKey,
						colKey: fullKey,
						count: aggregateCount,
						cardIds: [],
						cardNames: [],
						matchedCardIds: [],
						isSummary: true,
					};
				} else {
					cellPlacements.push({
						rowKey: fullRowKey,
						colKey: fullKey,
						count: aggregateCount,
						cardIds: [],
						cardNames: [],
						matchedCardIds: [],
						isSummary: true,
					});
				}
			}
		}

		// --- ROW dimension aggregate injection ---
		const effectiveRowCollapseKeys: Array<{
			level: number;
			parentPath: string;
			value: string;
			fullKey: string;
		}> = [];
		for (const key of this._collapsedSet) {
			if (this._collapseModeMap.get(key) !== 'aggregate') continue;
			if (suppressedCollapseKeys.has(key)) continue;

			const parts = key.split('\x1f');
			const level = parseInt(parts[0] ?? '0', 10);
			if (level >= rowAxes.length) continue;
			const parentPath = parts.slice(1, -1).join('\x1f');
			const value = parts[parts.length - 1] ?? '';
			const fullKey = parentPath ? `${parentPath}${UNIT_SEP}${value}` : value;

			// Dimension check: prefer rowHeaderKeySet match; fall back to data field match
			const isInRowHeaders = rowHeaderKeySet.has(key);
			const isInColHeaders = colHeaderKeySet.has(key);
			if (!isInRowHeaders) {
				const rowField = rowAxes[level]?.field;
				if (!rowField) continue;
				if (isInColHeaders) continue;
				const hasMatchingData = cells.some((c) => String((c as Record<string, unknown>)[rowField] ?? 'None') === value);
				if (!hasMatchingData) continue;
			}

			effectiveRowCollapseKeys.push({ level, parentPath, value, fullKey });
		}

		for (const { level, value, fullKey } of effectiveRowCollapseKeys) {
			// Phase 38: skip row aggregate injection for non-visible rows
			if (visibleRowKeySet && !visibleRowKeySet.has(fullKey)) continue;

			const rowField = rowAxes[level]?.field;

			for (const colCell of visibleLeafColCells) {
				const fullColKey = colCell.parentPath ? `${colCell.parentPath}${UNIT_SEP}${colCell.value}` : colCell.value;

				const aggregateCount = cells
					.filter((c) => {
						const cellColKey = colAxes.map((a) => String(c[a.field] ?? 'unknown')).join(UNIT_SEP);
						if (cellColKey !== fullColKey) return false;
						if (!rowField) return false;
						const cellRowVal = String((c as Record<string, unknown>)[rowField] ?? 'None');
						return cellRowVal === value;
					})
					.reduce((sum, c) => sum + c.count, 0);

				const existingIdx = cellPlacements.findIndex((cp) => cp.rowKey === fullKey && cp.colKey === fullColKey);
				if (existingIdx >= 0) {
					cellPlacements[existingIdx] = {
						rowKey: fullKey,
						colKey: fullColKey,
						count: aggregateCount,
						cardIds: [],
						cardNames: [],
						matchedCardIds: [],
						isSummary: true,
					};
				} else {
					cellPlacements.push({
						rowKey: fullKey,
						colKey: fullColKey,
						count: aggregateCount,
						cardIds: [],
						cardNames: [],
						matchedCardIds: [],
						isSummary: true,
					});
				}
			}
		}

		// ---------------------------------------------------------------------------
		// Phase 22 Plan 03 — View mode rendering (DENS-03)
		// Compute heat map color scale ONCE before D3 loop (matrix mode).
		// d3.scaleSequential with interpolateBlues: low count = light, high count = saturated.
		// ---------------------------------------------------------------------------
		const densityStateForView = this._densityProvider.getState();
		const maxCount = Math.max(...cellPlacements.map((c) => c.count), 1);
		const _heatScale = d3.scaleSequential().domain([0, maxCount]).interpolator(d3.interpolateBlues);

		// D3 data join
		// Capture class instance for use inside D3's .each(function(d)) where `this` is the DOM element
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		const gridSelection = d3.select(grid);
		gridSelection
			.selectAll<HTMLDivElement, CellPlacement>('.data-cell')
			// Phase 28: D3 join key uses RECORD_SEP (\x1e) between row and col compound keys.
			// Phase 30: isSummary prefix prevents key collision with normal cells at same position.
			.data(cellPlacements, (d) => `${d.isSummary ? 'summary:' : ''}${d.rowKey}${RECORD_SEP}${d.colKey}`)
			.join(
				(enter) => enter.append('div').attr('class', 'data-cell sg-cell').attr('role', 'cell'),
				(update) => update,
				(exit) => exit.remove(),
			)
			// DENS-06: .each() after .join() fires on BOTH enter and update — gridColumn/gridRow
			// re-applied to all elements including survived update-path elements. This ensures
			// density-collapsed cells realign correctly when layout changes (fewer columns/rows).
			.each(function (d) {
				const el = this as HTMLDivElement;
				el.dataset['rowKey'] = d.rowKey; // compound row key (\x1f-joined within dimension)
				el.dataset['colKey'] = d.colKey; // compound col key (\x1f-joined within dimension)
				// Composite key for D3 data join identity and BBoxCache lookup.
				// Phase 28: uses RECORD_SEP (\x1e) between row/col dimensions, UNIT_SEP (\x1f) within.
				el.dataset['key'] = `${d.rowKey}${RECORD_SEP}${d.colKey}`;

				const colStart = visibleColValueToStart.get(d.colKey) ?? 1;
				// For multi-level row axes, visibleLeafRowCells leaf values are just the last-level value.
				// We match using the full compound row key (parentPath\x1fvalue).
				const rowIdx = visibleLeafRowCells.findIndex((c) => {
					const fullKey = c.parentPath ? `${c.parentPath}${UNIT_SEP}${c.value}` : c.value;
					return fullKey === d.rowKey;
				});
				const gridRow = colHeaderLevels + rowIdx + 1;

				el.style.gridColumn = `${colStart + rowHeaderDepth}`; // offset past all row header columns
				el.style.gridRow = `${gridRow}`;
				// Phase 58 CSSB-03: border and minHeight now handled by .sg-cell CSS class

				// Phase 58 CSSB-03: Zebra striping via sg-row--alt on odd-indexed data rows
				if (rowIdx % 2 === 1) {
					el.classList.add('sg-row--alt');
				} else {
					el.classList.remove('sg-row--alt');
				}

				// Phase 50 — ARIA cell indices for screen reader navigation (A11Y-04)
				// Uses 1-based logical data row index (not DOM index) for virtual scrolling correctness.
				// rowIdx is the position in the full visible dataset; colStart is already 1-based.
				el.setAttribute('aria-rowindex', String(rowIdx + 1));
				el.setAttribute('aria-colindex', String(colStart));

				// -----------------------------------------------------------------
				// Phase 37 — Audit data attributes on data cells
				// Change status: dominant among card_ids (deleted > modified > new)
				// Source provenance: dominant among card_ids (most common source)
				// -----------------------------------------------------------------
				if (d.cardIds.length > 0) {
					const dominantStatus = auditState.getDominantChangeStatus(d.cardIds);
					if (dominantStatus) {
						el.dataset['audit'] = dominantStatus;
					} else {
						delete el.dataset['audit'];
					}
					const dominantSource = auditState.getDominantSource(d.cardIds);
					if (dominantSource) {
						el.dataset['source'] = dominantSource;
					} else {
						delete el.dataset['source'];
					}
				} else {
					delete el.dataset['audit'];
					delete el.dataset['source'];
				}

				if (d.count === 0) {
					el.classList.add('empty-cell');
					// Phase 58 CSSB-03: background, display, alignment, padding handled by
					// .sg-cell (flex) + .sg-cell.empty-cell (bg, justify) + [data-view-mode] .sg-cell (padding)
					el.innerHTML = '';
				} else if (densityStateForView.viewMode === 'spreadsheet') {
					// -----------------------------------------------------------------
					// Spreadsheet mode (VFST-01): Plain text card name + overflow badge
					// Phase 59: Replaced pill/SuperCard rendering with value-first text
					// Phase 58 CSSB-03: display, flex-direction, alignment, padding handled by
					// .sg-cell (flex) + [data-view-mode="spreadsheet"] .sg-cell CSS rules
					// -----------------------------------------------------------------
					el.classList.remove('empty-cell');
					el.innerHTML = '';

					// Single name span (first card)
					const nameSpan = document.createElement('span');
					nameSpan.className = 'sg-cell-name';
					nameSpan.textContent = d.cardNames[0] ?? d.cardIds[0] ?? '';
					el.appendChild(nameSpan);

					// +N overflow badge (2+ cards) with hover tooltip (VFST-03)
					if (d.count > 1) {
						const badge = document.createElement('span');
						badge.className = 'sg-cell-overflow-badge';
						badge.textContent = `+${d.count - 1}`;
						badge.addEventListener('mouseenter', () => {
							if (self._overflowTooltipTimer) {
								clearTimeout(self._overflowTooltipTimer);
								self._overflowTooltipTimer = null;
							}
							self._openOverflowTooltip(badge, d);
						});
						badge.addEventListener('mouseleave', () => {
							self._overflowTooltipTimer = setTimeout(() => {
								self._closeOverflowTooltip();
							}, 150);
						});
						el.appendChild(badge);
					}
				} else {
					// -----------------------------------------------------------------
					// Matrix mode (DENS-03): SuperCard replaces count badge (CARD-01/CARD-02)
					// SuperCards never participate in d3.interpolateBlues heat map.
					// Cell backgroundColor is cleared — SuperCard provides visual identity.
					// -----------------------------------------------------------------
					el.classList.remove('empty-cell');
					// Phase 58 CSSB-03: display, alignment, padding handled by
					// .sg-cell (flex) + [data-view-mode="matrix"] .sg-cell CSS rules

					el.innerHTML = '';

					// Create SuperCard element (replaces count-badge span)
					const superCard = document.createElement('div');
					superCard.className = 'supergrid-card';
					superCard.setAttribute('data-supercard', 'true');
					// Phase 37 — Aggregation styling: mark cells with count > 1 or summary cells
					if (d.count > 1 || d.isSummary) {
						superCard.setAttribute('data-aggregate', 'true');
					}
					superCard.style.border = '1px dashed var(--border-muted)';
					superCard.style.borderRadius = '4px';
					superCard.style.fontStyle = 'italic';
					superCard.style.fontSize = 'calc(var(--text-sm) * var(--sg-zoom, 1))';
					superCard.style.padding = 'calc(4px * var(--sg-zoom, 1)) calc(8px * var(--sg-zoom, 1))';
					superCard.style.cursor = 'pointer';
					superCard.style.userSelect = 'none';
					superCard.style.background = 'var(--cell-empty-bg)';
					superCard.textContent = String(d.count);
					superCard.addEventListener('click', (e: MouseEvent) => {
						e.stopPropagation();
						self._openSuperCardTooltip(superCard, d);
					});
					el.appendChild(superCard);
				}

				// -----------------------------------------------------------------
				// Phase 25 SRCH-03 — Search highlight rendering
				// Applied AFTER view-mode content rendering so highlights overlay content.
				// -----------------------------------------------------------------
				const isSearchActive = self._searchTerm.trim().length > 0;
				const isMatch = isSearchActive && d.matchedCardIds.length > 0;

				// CARD-05: SuperCard cells are neutral to search — they neither dim nor highlight.
				// A cell containing a SuperCard element skips all opacity and border highlight logic.
				// Phase 59 VFST-01: Spreadsheet mode no longer renders SuperCard — only matrix mode has them.
				const hasSuperCard = densityStateForView.viewMode !== 'spreadsheet' && !!el.querySelector('[data-supercard]');

				// CARD-05: SuperCard cells are neutral to search.
				// Cells with a SuperCard skip opacity dimming/brightening and amber border highlight.
				// Spreadsheet pill mark-wrapping is still applied (pills are data-level, not cell-level).
				if (hasSuperCard) {
					// SuperCard cells: restore normal opacity and remove any stale highlight class
					el.style.opacity = '';
					el.classList.remove('sg-search-match');
				} else {
					// Opacity: dim non-matches, restore matches, clear when search inactive.
					// CRITICAL (Pitfall 4): Always set opacity — empty string removes inline style,
					// restoring CSS default. Never leave stale opacity after search is cleared.
					el.style.opacity = isSearchActive ? (isMatch ? '1' : '0.4') : '';

					if (isSearchActive && isMatch && densityStateForView.viewMode === 'matrix') {
						// Matrix mode: amber outline on matching cells (SRCH-03)
						el.classList.add('sg-search-match');
					} else {
						// Remove class when: search inactive, no match, or spreadsheet mode
						el.classList.remove('sg-search-match');
					}
				}

				// Spreadsheet mode: wrap matching text in <mark> tags via DOM manipulation (SRCH-03)
				// CRITICAL: <mark> tags MUST be created via createElement/appendChild, NOT innerHTML injection
				// Applied for ALL spreadsheet cells (including SuperCard cells) since pills are data-level.
				if (isSearchActive && isMatch && densityStateForView.viewMode === 'spreadsheet') {
					const searchTerms = self._searchTerm.trim().split(/\s+/).filter(Boolean);
					if (searchTerms.length > 0) {
						// Build case-insensitive regex with capture group for split()
						// Capture group in String.split() includes the captured text in the result array
						const escapedTerms = searchTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
						const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

						el.querySelectorAll('.sg-cell-name').forEach((nameEl) => {
							const text = nameEl.textContent ?? '';
							// Reset lastIndex before testing (global regex tracks position)
							regex.lastIndex = 0;
							if (regex.test(text)) {
								// Split text into alternating non-match / match segments
								// String.split() with a capturing group includes the captured text in the array
								regex.lastIndex = 0;
								const parts = text.split(regex);
								// Rebuild name contents via DOM nodes (not innerHTML) — SRCH-03 locked decision
								nameEl.textContent = '';
								for (let i = 0; i < parts.length; i++) {
									const part = parts[i]!;
									if (part.length === 0) continue;
									// Test if this part is a captured match (case-insensitive comparison vs terms)
									const isTerm = escapedTerms.some((t) => new RegExp(`^${t}$`, 'i').test(part));
									if (isTerm) {
										const mark = document.createElement('mark');
										mark.style.cssText =
											'background:var(--search-highlight);color:inherit;padding:0 1px;border-radius:2px;';
										mark.textContent = part;
										nameEl.appendChild(mark);
									} else {
										nameEl.appendChild(document.createTextNode(part));
									}
								}
							}
						});
					}
				}

				// Phase 21 — click handler for cell selection (SLCT-01/02/03)
				// Uses `self` (class instance) because `this` inside D3.each() is the DOM element
				el.onclick = (e: MouseEvent) => {
					const zone = classifyClickZone(e.target);
					if (zone !== 'data-cell') return;

					const cellKey = `${d.rowKey}${RECORD_SEP}${d.colKey}`;
					const cardIds = self._getCellCardIds(cellKey);

					if (e.shiftKey && self._selectionAnchor) {
						// Shift+click: 2D rectangular range from anchor to target
						const rangeCardIds = self._getRectangularRangeCardIds(self._selectionAnchor, {
							rowKey: d.rowKey,
							colKey: d.colKey,
						});
						self._selectionAdapter.select(rangeCardIds);
					} else if (e.metaKey || e.ctrlKey) {
						// Cmd+click: add to / toggle selection
						self._selectionAdapter.addToSelection(cardIds);
					} else {
						// Plain click: replace selection and set anchor
						self._selectionAdapter.select(cardIds);
						self._selectionAnchor = { rowKey: d.rowKey, colKey: d.colKey };
					}
				};
			});

		// Phase 38 — Update sentinel spacer height for correct scrollbar (VSCR-04)
		if (this._spacerEl) {
			if (this._virtualizer.isActive()) {
				const rowHeight = this._rootEl
					? (() => {
							const val = getComputedStyle(this._rootEl).getPropertyValue('--sg-row-height');
							const parsed = parseInt(val, 10);
							return !Number.isNaN(parsed) ? parsed : Math.round(40 * this._positionProvider.zoomLevel);
						})()
					: Math.round(40 * this._positionProvider.zoomLevel);
				const colHeaderHeight = colHeaderLevels * rowHeight;
				const dataHeight = this._virtualizer.getTotalHeight();
				this._spacerEl.style.height = `${colHeaderHeight + dataHeight}px`;
			} else {
				this._spacerEl.style.height = '0px';
			}
		}

		// Phase 21 — schedule BBoxCache snapshot after render (SLCT-08)
		this._bboxCache.scheduleSnapshot();

		// Phase 23 — Update Clear sorts button visibility (SORT-01/SORT-02)
		if (this._clearSortsBtnEl) {
			this._clearSortsBtnEl.style.display = this._sortState.hasActiveSorts() ? '' : 'none';
		}

		// Phase 24 Plan 03 — Update Clear filters button visibility (FILT-04)
		// Visible when any col or row axis has an active axis filter.
		if (this._clearFiltersBtnEl) {
			const hasAnyAxisFilter =
				this._lastColAxes.some((a) => this._filter.hasAxisFilter(a.field)) ||
				this._lastRowAxes.some((a) => this._filter.hasAxisFilter(a.field));
			this._clearFiltersBtnEl.style.display = hasAnyAxisFilter ? '' : 'none';
		}

		// Phase 26 Plan 03 — Update "Show All" button visibility (TIME-04)
		// Visible when period selection is active (at least one period selected).
		if (this._showAllBtnEl) {
			this._showAllBtnEl.style.display = this._periodSelection.size > 0 ? '' : 'none';
		}

		// Phase 25 — Update match count badge (SRCH-01)
		if (this._searchCountEl) {
			if (this._searchTerm.trim()) {
				const matchingCellCount = cells.filter(
					(c) => Array.isArray(c['matchedCardIds']) && (c['matchedCardIds'] as string[]).length > 0,
				).length;
				if (matchingCellCount > 0) {
					this._searchCountEl.textContent = `${matchingCellCount} cell${matchingCellCount !== 1 ? 's' : ''}`;
				} else {
					this._searchCountEl.textContent = 'No matches';
				}
			} else {
				this._searchCountEl.textContent = '';
			}
		}

		// Phase 31-02: Play FLIP animation if snapshot was captured before provider mutation
		this._playFlipAnimation();
	}

	/**
	 * Display an inline error message in the grid area.
	 */
	private _showError(message: string): void {
		const grid = this._gridEl;
		if (!grid) return;
		while (grid.firstChild) grid.removeChild(grid.firstChild);
		const errorEl = document.createElement('div');
		errorEl.className = 'supergrid-error';
		errorEl.style.padding = '16px';
		errorEl.style.color = 'red';
		errorEl.textContent = `SuperGrid error: ${message}`;
		grid.appendChild(errorEl);
	}

	// ---------------------------------------------------------------------------
	// Phase 27 — SuperCard tooltip lifecycle (CARD-03)
	// ---------------------------------------------------------------------------

	/**
	 * Open a SuperCard tooltip anchored below the clicked SuperCard element.
	 *
	 * Tooltip shows:
	 *   - Header: "{N} card(s)"
	 *   - Scrollable list of card IDs; clicking each calls selectionAdapter.addToSelection()
	 *
	 * Tooltip stays open for multi-select — clicking outside dismisses it.
	 * Pattern mirrors existing filter dropdown (rAF-deferred click-outside listener).
	 */
	private _openSuperCardTooltip(anchorEl: HTMLElement, d: { count: number; cardIds: string[] }): void {
		if (!this._rootEl) return;
		this._closeSuperCardTooltip();

		// Compute position relative to _rootEl (same pattern as _openFilterDropdown)
		const anchorRect = anchorEl.getBoundingClientRect();
		const rootRect = this._rootEl.getBoundingClientRect();
		const top = anchorRect.bottom - rootRect.top + this._rootEl.scrollTop;
		const left = anchorRect.left - rootRect.left + this._rootEl.scrollLeft;

		const tooltip = document.createElement('div');
		tooltip.className = 'sg-supercard-tooltip';
		tooltip.style.position = 'absolute';
		tooltip.style.top = `${top}px`;
		tooltip.style.left = `${left}px`;
		tooltip.style.zIndex = '25';
		tooltip.style.background = 'var(--sg-header-bg, var(--bg-surface))';
		tooltip.style.border = '1px solid var(--border-muted)';
		tooltip.style.borderRadius = '6px';
		tooltip.style.minWidth = '180px';
		tooltip.style.maxHeight = '300px';
		tooltip.style.overflowY = 'auto';
		tooltip.style.fontSize = 'var(--text-sm)';
		tooltip.style.boxShadow = 'var(--overlay-shadow)';

		// Header: "{N} card(s)"
		const header = document.createElement('div');
		header.className = 'sg-supercard-tooltip-header';
		header.textContent = `${d.count} card${d.count !== 1 ? 's' : ''}`;
		header.style.fontWeight = 'bold';
		header.style.padding = '8px 10px';
		header.style.borderBottom = '1px solid var(--border-subtle)';
		header.style.fontSize = 'var(--text-sm)';
		header.style.color = 'var(--text-secondary)';
		tooltip.appendChild(header);

		// Card ID list — clicking each adds card to selection
		const ids = d.cardIds;
		if (ids.length === 0) {
			const empty = document.createElement('div');
			empty.textContent = '(empty)';
			empty.style.padding = '8px 10px';
			empty.style.color = 'var(--text-muted)';
			tooltip.appendChild(empty);
		} else {
			for (const id of ids) {
				const trimmedId = id.trim();
				const item = document.createElement('div');
				item.className = 'sg-supercard-tooltip-item';
				item.textContent = trimmedId;
				item.style.padding = '5px 10px';
				item.style.cursor = 'pointer';
				item.style.fontSize = 'var(--text-sm)';
				item.style.whiteSpace = 'nowrap';
				item.style.overflow = 'hidden';
				item.style.textOverflow = 'ellipsis';
				item.addEventListener('mouseenter', () => {
					item.style.background = 'var(--cell-hover)';
				});
				item.addEventListener('mouseleave', () => {
					item.style.background = '';
				});
				item.addEventListener('click', (e: MouseEvent) => {
					e.stopPropagation();
					this._selectionAdapter.addToSelection([trimmedId]);
					// Tooltip stays open for multi-select
				});
				tooltip.appendChild(item);
			}
		}

		this._rootEl.appendChild(tooltip);
		this._superCardTooltipEl = tooltip;

		// rAF-deferred click-outside listener — same pattern as filter dropdown.
		// The rAF prevents the opening click from immediately dismissing the tooltip.
		requestAnimationFrame(() => {
			this._boundTooltipOutsideClick = (e: MouseEvent) => {
				if (this._superCardTooltipEl && !this._superCardTooltipEl.contains(e.target as Node)) {
					this._closeSuperCardTooltip();
				}
			};
			document.addEventListener('click', this._boundTooltipOutsideClick);
		});
	}

	/**
	 * Close the SuperCard tooltip and clean up the click-outside listener.
	 * Called at start of _renderCells() to prevent orphaned tooltips.
	 * Called in destroy() for cleanup.
	 */
	private _closeSuperCardTooltip(): void {
		if (this._boundTooltipOutsideClick) {
			document.removeEventListener('click', this._boundTooltipOutsideClick);
			this._boundTooltipOutsideClick = null;
		}
		if (this._superCardTooltipEl) {
			this._superCardTooltipEl.remove();
			this._superCardTooltipEl = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Phase 59 Plan 02 — Overflow badge tooltip (VFST-03)
	// ---------------------------------------------------------------------------

	/**
	 * Open hover-triggered tooltip for the +N overflow badge.
	 * Shows all card names in the cell with click-to-select.
	 * Tooltip dismisses on mouseleave with a 150ms delay to allow cursor
	 * movement from badge to tooltip.
	 */
	private _openOverflowTooltip(
		anchorEl: HTMLElement,
		d: { count: number; cardIds: string[]; cardNames: string[] },
	): void {
		if (!this._rootEl) return;
		this._closeOverflowTooltip();

		// Compute position relative to _rootEl (same pattern as _openSuperCardTooltip)
		const anchorRect = anchorEl.getBoundingClientRect();
		const rootRect = this._rootEl.getBoundingClientRect();
		const top = anchorRect.bottom - rootRect.top + this._rootEl.scrollTop;
		const left = anchorRect.left - rootRect.left + this._rootEl.scrollLeft;

		const tooltip = document.createElement('div');
		tooltip.className = 'sg-overflow-tooltip';
		tooltip.style.position = 'absolute';
		tooltip.style.top = `${top}px`;
		tooltip.style.left = `${left}px`;
		tooltip.style.zIndex = '25';
		tooltip.style.background = 'var(--sg-header-bg, var(--bg-surface))';
		tooltip.style.border = '1px solid var(--border-muted)';
		tooltip.style.borderRadius = '6px';
		tooltip.style.minWidth = '180px';
		tooltip.style.maxHeight = '300px';
		tooltip.style.overflowY = 'auto';
		tooltip.style.fontSize = 'var(--text-sm)';
		tooltip.style.boxShadow = 'var(--overlay-shadow)';

		// Header: "{N} cards" (always plural since badge only appears for 2+ cards)
		const header = document.createElement('div');
		header.className = 'sg-overflow-tooltip-header';
		header.textContent = `${d.count} cards`;
		header.style.fontWeight = 'bold';
		header.style.padding = '8px 10px';
		header.style.borderBottom = '1px solid var(--border-subtle)';
		header.style.fontSize = 'var(--text-sm)';
		header.style.color = 'var(--text-secondary)';
		tooltip.appendChild(header);

		// Card name list — clicking each adds card to selection
		for (let i = 0; i < d.cardIds.length; i++) {
			const cardId = d.cardIds[i]!;
			const cardName = this._cardNameCache.get(cardId) ?? d.cardNames[i] ?? cardId;

			const item = document.createElement('div');
			item.className = 'sg-overflow-tooltip-item';
			item.textContent = cardName;
			item.style.padding = '5px 10px';
			item.style.cursor = 'pointer';
			item.style.fontSize = 'var(--text-sm)';
			item.style.whiteSpace = 'nowrap';
			item.style.overflow = 'hidden';
			item.style.textOverflow = 'ellipsis';
			item.addEventListener('mouseenter', () => {
				item.style.background = 'var(--cell-hover)';
			});
			item.addEventListener('mouseleave', () => {
				item.style.background = '';
			});
			item.addEventListener('click', (e: MouseEvent) => {
				e.stopPropagation();
				this._selectionAdapter.addToSelection([cardId]);
			});
			tooltip.appendChild(item);
		}

		this._rootEl.appendChild(tooltip);
		this._overflowTooltipEl = tooltip;

		// Tooltip mouseenter/mouseleave for cursor movement tolerance
		tooltip.addEventListener('mouseenter', () => {
			if (this._overflowTooltipTimer) {
				clearTimeout(this._overflowTooltipTimer);
				this._overflowTooltipTimer = null;
			}
		});
		tooltip.addEventListener('mouseleave', () => {
			this._overflowTooltipTimer = setTimeout(() => {
				this._closeOverflowTooltip();
			}, 150);
		});
	}

	/**
	 * Close the overflow badge tooltip and clear dismiss timer.
	 * Called at start of _renderCells() and in destroy() for cleanup.
	 */
	private _closeOverflowTooltip(): void {
		if (this._overflowTooltipTimer) {
			clearTimeout(this._overflowTooltipTimer);
			this._overflowTooltipTimer = null;
		}
		if (this._overflowTooltipEl) {
			this._overflowTooltipEl.remove();
			this._overflowTooltipEl = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Phase 27 — PLSH-04: Help overlay (Cmd+/ + '?' button)
	// ---------------------------------------------------------------------------

	/**
	 * Toggle the help overlay open/closed.
	 */
	private _toggleHelpOverlay(): void {
		if (this._helpOverlayEl) {
			this._closeHelpOverlay();
		} else {
			this._openHelpOverlay();
		}
	}

	/**
	 * Open the help overlay showing keyboard shortcuts.
	 * Appended to _rootEl so it is scoped to the SuperGrid container.
	 */
	private _openHelpOverlay(): void {
		if (!this._rootEl || this._helpOverlayEl) return;

		const overlay = document.createElement('div');
		overlay.className = 'sg-help-overlay';
		overlay.style.cssText = [
			'position:absolute',
			'inset:0',
			'background:var(--overlay-bg)',
			'z-index:100',
			'display:flex',
			'align-items:center',
			'justify-content:center',
		].join(';');

		const content = document.createElement('div');
		content.className = 'sg-help-content';
		content.style.cssText = [
			'background:var(--sg-header-bg, var(--bg-surface))',
			'border:1px solid var(--border-muted)',
			'border-radius:8px',
			'padding:20px',
			'min-width:360px',
			'max-width:480px',
			'max-height:80vh',
			'overflow-y:auto',
			'font-size:var(--text-base)',
			'position:relative',
		].join(';');

		// Title
		const title = document.createElement('h3');
		title.textContent = 'SuperGrid Keyboard Shortcuts';
		title.style.cssText = 'margin:0 0 16px;font-size:var(--text-md);font-weight:600;';
		content.appendChild(title);

		// Close button
		const closeBtn = document.createElement('button');
		closeBtn.className = 'sg-help-close-btn';
		closeBtn.textContent = '\u00D7'; // ×
		closeBtn.title = 'Close';
		closeBtn.style.cssText =
			'position:absolute;top:12px;right:12px;border:none;background:none;cursor:pointer;font-size:var(--text-xl);line-height:1;color:var(--text-muted);padding:2px 6px;';
		closeBtn.addEventListener('click', () => {
			this._closeHelpOverlay();
		});
		content.appendChild(closeBtn);

		// Shortcut table
		const shortcuts: Array<{ category: string; key: string; description: string }> = [
			{ category: 'Search', key: 'Cmd+F', description: 'Focus search input' },
			{ category: 'Search', key: 'Escape', description: 'Clear search / deselect' },
			{ category: 'Selection', key: 'Click', description: 'Select cell' },
			{ category: 'Selection', key: 'Cmd+Click', description: 'Add to / toggle selection' },
			{ category: 'Selection', key: 'Shift+Click', description: 'Rectangular range select' },
			{ category: 'Sort', key: 'Click sort icon', description: 'Cycle sort direction' },
			{ category: 'Sort', key: 'Cmd+Click sort icon', description: 'Multi-sort' },
			{ category: 'Zoom', key: 'Cmd++ / Cmd+-', description: 'Zoom in / out' },
			{ category: 'Zoom', key: 'Cmd+0', description: 'Reset zoom' },
			{ category: 'Help', key: 'Cmd+/', description: 'Toggle this overlay' },
		];

		let currentCategory = '';
		for (const sc of shortcuts) {
			if (sc.category !== currentCategory) {
				currentCategory = sc.category;
				const cat = document.createElement('div');
				cat.className = 'sg-help-category';
				cat.textContent = sc.category;
				cat.style.cssText =
					'font-weight:600;font-size:var(--text-sm);text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-top:12px;margin-bottom:4px;';
				content.appendChild(cat);
			}
			const row = document.createElement('div');
			row.className = 'sg-help-shortcut';
			row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:3px 0;gap:12px;';
			const keyEl = document.createElement('kbd');
			keyEl.textContent = sc.key;
			keyEl.style.cssText =
				'font-family:monospace;font-size:var(--text-sm);background:var(--cell-hover);padding:2px 5px;border-radius:3px;white-space:nowrap;';
			const descEl = document.createElement('span');
			descEl.textContent = sc.description;
			descEl.style.cssText = 'color:var(--text-secondary);font-size:var(--text-sm);';
			row.appendChild(keyEl);
			row.appendChild(descEl);
			content.appendChild(row);
		}

		overlay.appendChild(content);

		// Click-outside to close (click on overlay backdrop, not content)
		overlay.addEventListener('click', (e: MouseEvent) => {
			if (e.target === overlay) {
				this._closeHelpOverlay();
			}
		});

		this._rootEl.appendChild(overlay);
		this._helpOverlayEl = overlay;
	}

	/**
	 * Close and remove the help overlay.
	 */
	private _closeHelpOverlay(): void {
		if (this._helpOverlayEl) {
			this._helpOverlayEl.remove();
			this._helpOverlayEl = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Phase 27 — PLSH-05: Right-click context menu on headers
	// ---------------------------------------------------------------------------

	/**
	 * Open a context menu at (x, y) for the given axis field and dimension.
	 * Menu contains: Sort ascending, Sort descending, Filter, Hide/Show column/row.
	 */
	private _openContextMenu(
		clientX: number,
		clientY: number,
		axisField: string,
		dimension: 'col' | 'row',
		headerValue: string = '',
		collapseKey: string = '',
	): void {
		if (!this._rootEl) return;
		this._closeContextMenu(); // Close any existing menu

		const rootRect = this._rootEl.getBoundingClientRect();
		const left = clientX - rootRect.left + this._rootEl.scrollLeft;
		const top = clientY - rootRect.top + this._rootEl.scrollTop;

		const menu = document.createElement('div');
		menu.className = 'sg-context-menu';
		menu.style.cssText = [
			'position:absolute',
			`left:${left}px`,
			`top:${top}px`,
			'z-index:30',
			'background:var(--sg-header-bg, var(--bg-surface))',
			'border:1px solid var(--border-muted)',
			'border-radius:6px',
			'min-width:180px',
			'padding:4px 0',
			'font-size:var(--text-sm)',
			'box-shadow:var(--overlay-shadow)',
		].join(';');

		const currentSortDir = this._sortState.getDirection(axisField as AxisField);

		// Sort ascending item
		const sortAscItem = document.createElement('div');
		sortAscItem.className = 'sg-context-menu-item';
		const isAsc = currentSortDir === 'asc' && this._sortState.getPriority(axisField as AxisField) > 0;
		sortAscItem.textContent = `${isAsc ? '? ' : ''}Sort ascending`;
		sortAscItem.style.cssText = 'padding:7px 14px;cursor:pointer;';
		sortAscItem.addEventListener('mouseenter', () => {
			sortAscItem.style.background = 'var(--cell-hover)';
		});
		sortAscItem.addEventListener('mouseleave', () => {
			sortAscItem.style.background = '';
		});
		sortAscItem.addEventListener('click', () => {
			// PLSH-05 fix: update _sortState BEFORE provider — mirrors header-click pattern (line 2157–2163).
			// Without this, _fetchAndRender reads stale _sortState.getSorts() and the query ignores the sort.
			this._sortState = new SortState([{ field: axisField as AxisField, direction: 'asc' as const }]);
			this._provider.setSortOverrides(this._sortState.getSorts());
			this._closeContextMenu();
			// StateCoordinator subscription fires _fetchAndRender() automatically
		});
		menu.appendChild(sortAscItem);

		// Sort descending item
		const sortDescItem = document.createElement('div');
		sortDescItem.className = 'sg-context-menu-item';
		const isDesc = currentSortDir === 'desc' && this._sortState.getPriority(axisField as AxisField) > 0;
		sortDescItem.textContent = `${isDesc ? '? ' : ''}Sort descending`;
		sortDescItem.style.cssText = 'padding:7px 14px;cursor:pointer;';
		sortDescItem.addEventListener('mouseenter', () => {
			sortDescItem.style.background = 'var(--cell-hover)';
		});
		sortDescItem.addEventListener('mouseleave', () => {
			sortDescItem.style.background = '';
		});
		sortDescItem.addEventListener('click', () => {
			// PLSH-05 fix: update _sortState BEFORE provider — mirrors header-click pattern (line 2157–2163).
			// Without this, _fetchAndRender reads stale _sortState.getSorts() and the query ignores the sort.
			this._sortState = new SortState([{ field: axisField as AxisField, direction: 'desc' as const }]);
			this._provider.setSortOverrides(this._sortState.getSorts());
			this._closeContextMenu();
			// StateCoordinator subscription fires _fetchAndRender() automatically
		});
		menu.appendChild(sortDescItem);

		// Separator
		const sep = document.createElement('div');
		sep.style.cssText = 'height:1px;background:var(--border-subtle);margin:4px 0;';
		menu.appendChild(sep);

		// Filter item
		const filterItem = document.createElement('div');
		filterItem.className = 'sg-context-menu-item';
		filterItem.textContent = 'Filter';
		filterItem.style.cssText = 'padding:7px 14px;cursor:pointer;';
		filterItem.addEventListener('mouseenter', () => {
			filterItem.style.background = 'var(--cell-hover)';
		});
		filterItem.addEventListener('mouseleave', () => {
			filterItem.style.background = '';
		});
		filterItem.addEventListener('click', () => {
			this._closeContextMenu();
			// Find the filter icon for this field and simulate opening it
			const filterIcon = this._rootEl?.querySelector<HTMLElement>(`[data-filter-field="${axisField}"]`);
			if (filterIcon) filterIcon.click();
		});
		menu.appendChild(filterItem);

		// Hide/Show column or row item
		// PLSH-05 fix: store the header VALUE (e.g., "Active") — not the field name (e.g., "status") —
		// so _renderCells() can filter colValues/rowValues by the hidden set.
		const isCol = dimension === 'col';
		const hiddenSet = isCol ? this._hiddenCols : this._hiddenRows;
		const hideKey = headerValue || axisField; // Prefer value; fall back to field for safety
		const isHidden = hiddenSet.has(hideKey);
		const hideItem = document.createElement('div');
		hideItem.className = 'sg-context-menu-item';
		hideItem.textContent = isHidden ? `Show ${isCol ? 'column' : 'row'}` : `Hide ${isCol ? 'column' : 'row'}`;
		hideItem.style.cssText = 'padding:7px 14px;cursor:pointer;';
		hideItem.addEventListener('mouseenter', () => {
			hideItem.style.background = 'var(--cell-hover)';
		});
		hideItem.addEventListener('mouseleave', () => {
			hideItem.style.background = '';
		});
		hideItem.addEventListener('click', () => {
			if (isHidden) {
				hiddenSet.delete(hideKey);
			} else {
				hiddenSet.add(hideKey);
			}
			this._closeContextMenu();
			void this._fetchAndRender();
		});
		menu.appendChild(hideItem);

		// Phase 30 — Mode-switch item for collapsed headers (CLPS-04)
		if (collapseKey && this._collapsedSet.has(collapseKey)) {
			const sep2 = document.createElement('div');
			sep2.style.cssText = 'height:1px;background:var(--border-subtle);margin:4px 0;';
			menu.appendChild(sep2);

			const currentMode = this._collapseModeMap.get(collapseKey) ?? 'aggregate';
			const newMode = currentMode === 'aggregate' ? 'hide' : 'aggregate';

			const modeItem = document.createElement('div');
			modeItem.className = 'sg-context-menu-item';
			modeItem.textContent = currentMode === 'aggregate' ? 'Switch to hide mode' : 'Switch to aggregate mode';
			modeItem.style.cssText = 'padding:7px 14px;cursor:pointer;';
			modeItem.addEventListener('mouseenter', () => {
				modeItem.style.background = 'var(--cell-hover)';
			});
			modeItem.addEventListener('mouseleave', () => {
				modeItem.style.background = '';
			});
			modeItem.addEventListener('click', () => {
				this._collapseModeMap.set(collapseKey, newMode);
				// Phase 30 — sync to PAFVProvider for Tier 2 persistence (CLPS-05)
				this._syncCollapseToProvider();
				this._closeContextMenu();
				this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes);
			});
			menu.appendChild(modeItem);
		}

		this._rootEl.appendChild(menu);
		this._contextMenuEl = menu;

		// rAF-deferred click-outside to dismiss
		requestAnimationFrame(() => {
			this._boundContextMenuOutsideClick = (e: MouseEvent) => {
				if (this._contextMenuEl && !this._contextMenuEl.contains(e.target as Node)) {
					this._closeContextMenu();
				}
			};
			document.addEventListener('click', this._boundContextMenuOutsideClick);
		});
	}

	/**
	 * Close and remove the context menu.
	 */
	private _closeContextMenu(): void {
		if (this._boundContextMenuOutsideClick) {
			document.removeEventListener('click', this._boundContextMenuOutsideClick);
			this._boundContextMenuOutsideClick = null;
		}
		if (this._contextMenuEl) {
			this._contextMenuEl.remove();
			this._contextMenuEl = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Phase 30 — Collapse state sync helper (CLPS-05)
	// ---------------------------------------------------------------------------

	/** Sync local collapse state to PAFVProvider for Tier 2 persistence */
	private _syncCollapseToProvider(): void {
		const state: Array<{ key: string; mode: 'aggregate' | 'hide' }> = [];
		for (const key of this._collapsedSet) {
			state.push({ key, mode: this._collapseModeMap.get(key) ?? 'aggregate' });
		}
		this._provider.setCollapseState(state);
	}

	// ---------------------------------------------------------------------------
	// Phase 23 — Sort icon creation (_createSortIcon)
	// ---------------------------------------------------------------------------

	/**
	 * Create a sort icon <span> for a leaf header (column or row).
	 *
	 * States:
	 *   - Inactive: shows ⇅ (\u21C5) at opacity 0, revealed to 0.5 on parent hover
	 *   - Active asc: shows ▲ (\u25B2) at opacity 1
	 *   - Active desc: shows ▼ (\u25BC) at opacity 1
	 *   - Multi-sort active: adds <sup class="sort-priority"> child with 1-indexed priority
	 *
	 * Click events:
	 *   - Plain click: cycle(field) — single-sort replace
	 *   - Cmd/Ctrl+click: addOrCycle(field) — multi-sort add/cycle
	 *   - stopPropagation() prevents header collapse click
	 *
	 * @param axisField - The axis field this sort icon represents
	 */
	private _createSortIcon(axisField: AxisField): HTMLSpanElement {
		const sortBtn = document.createElement('span');
		sortBtn.className = 'sort-icon';
		sortBtn.setAttribute('data-sort-field', axisField);

		const priority = this._sortState.getPriority(axisField);
		const direction = this._sortState.getDirection(axisField);

		if (priority > 0) {
			// Active sort: show direction arrow
			sortBtn.textContent = direction === 'asc' ? '\u25B2' : '\u25BC'; // ▲ or ▼
			sortBtn.style.opacity = '1';
			sortBtn.style.fontWeight = 'bold';
			// Multi-sort: add numbered priority badge
			if (this._sortState.getSorts().length > 1) {
				const badge = document.createElement('sup');
				badge.textContent = String(priority);
				badge.className = 'sort-priority';
				badge.style.fontSize = '9px';
				badge.style.marginLeft = '1px';
				sortBtn.appendChild(badge);
			}
		} else {
			// Inactive: show subtle up-down arrows (hidden, revealed on parent hover)
			sortBtn.textContent = '\u21C5'; // ⇅
			sortBtn.style.opacity = '0';
		}

		// Styling
		sortBtn.style.cursor = 'pointer';
		sortBtn.style.marginLeft = '4px';
		sortBtn.style.fontSize = 'var(--text-xs)';
		sortBtn.style.flexShrink = '0';
		sortBtn.style.userSelect = 'none';
		sortBtn.style.transition = 'opacity 0.15s';

		// Click handler — CRITICAL: stopPropagation prevents header collapse
		sortBtn.addEventListener('click', (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			if (e.metaKey || e.ctrlKey) {
				this._sortState.addOrCycle(axisField);
			} else {
				this._sortState.cycle(axisField);
			}
			// Provider mutation → coordinator → _fetchAndRender (consistent with Phase 18 pattern)
			// Do NOT call _fetchAndRender directly — coordinator fires it automatically
			this._provider.setSortOverrides(this._sortState.getSorts());
		});

		// Hover show/hide for inactive sort icons — defer to rAF so parentElement is available
		requestAnimationFrame(() => {
			const parent = sortBtn.parentElement;
			if (parent) {
				parent.addEventListener('mouseenter', () => {
					if (this._sortState.getPriority(axisField) === 0) {
						sortBtn.style.opacity = '0.5';
					}
				});
				parent.addEventListener('mouseleave', () => {
					if (this._sortState.getPriority(axisField) === 0) {
						sortBtn.style.opacity = '0';
					}
				});
			}
		});

		return sortBtn;
	}

	// ---------------------------------------------------------------------------
	// Phase 24 — Filter icon + dropdown methods (FILT-01/FILT-02)
	// ---------------------------------------------------------------------------

	/**
	 * Create a filter icon <span> for a leaf header (column or row).
	 *
	 * States:
	 *   - Inactive (no axis filter): shows ▽ (\u25BD) at opacity 0, revealed to 0.5 on parent hover
	 *   - Active (axis filter set): shows ▼ (\u25BC) at opacity 1 with accent color
	 *
	 * Click handler: calls _openFilterDropdown() with stopPropagation (prevents collapse).
	 *
	 * @param axisField - The axis field this filter icon represents
	 * @param dimension - 'col' or 'row'
	 */
	private _createFilterIcon(axisField: string, dimension: 'col' | 'row'): HTMLSpanElement {
		const icon = document.createElement('span');
		icon.className = 'filter-icon';
		icon.dataset['filterField'] = axisField;

		const isActive = this._filter.hasAxisFilter(axisField);

		if (isActive) {
			icon.textContent = '\u25BC'; // ▼ filled down triangle
			icon.style.opacity = '1';
			icon.style.color = 'var(--sg-filter-active-color, var(--accent))';
		} else {
			icon.textContent = '\u25BD'; // ▽ hollow down triangle
			icon.style.opacity = '0';
			icon.style.color = '';
		}

		// Styling — mirrors _createSortIcon
		icon.style.cursor = 'pointer';
		icon.style.marginLeft = '4px';
		icon.style.fontSize = 'var(--text-xs)';
		icon.style.flexShrink = '0';
		icon.style.userSelect = 'none';
		icon.style.transition = 'opacity 0.15s';

		// Click handler — CRITICAL: stopPropagation prevents header collapse
		icon.addEventListener('click', (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			this._openFilterDropdown(icon, axisField, dimension);
		});

		// Hover show/hide for inactive filter icons — defer to rAF so parentElement is available
		requestAnimationFrame(() => {
			const parent = icon.parentElement;
			if (parent) {
				parent.addEventListener('mouseenter', () => {
					if (!this._filter.hasAxisFilter(axisField)) {
						icon.style.opacity = '0.5';
					}
				});
				parent.addEventListener('mouseleave', () => {
					if (!this._filter.hasAxisFilter(axisField)) {
						icon.style.opacity = '0';
					}
				});
			}
		});

		return icon;
	}

	/**
	 * Get distinct axis values and their aggregated counts from _lastCells.
	 * Used to populate the filter dropdown without a Worker round-trip (FILT-02).
	 *
	 * @param axisField - The axis field to aggregate
	 * @param dimension - 'col' or 'row' (affects null handling: 'unknown' vs 'None')
	 */
	private _getAxisValues(axisField: string, dimension: 'col' | 'row'): { value: string; count: number }[] {
		const nullLabel = dimension === 'row' ? 'None' : 'unknown';

		// Aggregate counts per distinct value
		const countMap = new Map<string, number>();
		for (const cell of this._lastCells) {
			const val = String(cell[axisField] ?? nullLabel);
			countMap.set(val, (countMap.get(val) ?? 0) + (cell.count ?? 0));
		}

		// Return sorted alphabetically
		return [...countMap.entries()]
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => a.value.localeCompare(b.value));
	}

	/**
	 * Open the filter dropdown anchored to the given element.
	 * Closes any existing dropdown first (single dropdown at a time).
	 *
	 * Dropdown is appended to _rootEl (NOT _gridEl) so it survives _renderCells
	 * DOM clearing. z-index 20 (above all header z-index levels 2/3).
	 *
	 * @param anchorEl - The filter icon element to anchor to
	 * @param axisField - The axis field to filter
	 * @param dimension - 'col' or 'row'
	 */
	private _openFilterDropdown(anchorEl: HTMLElement, axisField: string, dimension: 'col' | 'row'): void {
		if (!this._rootEl) return;

		// Close any existing dropdown first
		this._closeFilterDropdown();

		// Get distinct values from _lastCells (FILT-02: no Worker round-trip on open)
		const axisValues = this._getAxisValues(axisField, dimension);

		// Compute position relative to _rootEl
		const anchorRect = anchorEl.getBoundingClientRect();
		const rootRect = this._rootEl.getBoundingClientRect();
		const top = anchorRect.bottom - rootRect.top + this._rootEl.scrollTop;
		const left = anchorRect.left - rootRect.left + this._rootEl.scrollLeft;

		// Create dropdown element
		const dropdown = document.createElement('div');
		dropdown.className = 'sg-filter-dropdown';
		dropdown.style.position = 'absolute';
		dropdown.style.top = `${top}px`;
		dropdown.style.left = `${left}px`;
		dropdown.style.zIndex = '20';
		dropdown.style.background = 'var(--sg-header-bg, var(--bg-surface))';
		dropdown.style.border = '1px solid var(--border-muted)';
		dropdown.style.borderRadius = '6px';
		dropdown.style.padding = '6px 0';
		dropdown.style.minWidth = '180px';
		dropdown.style.maxHeight = '280px';
		dropdown.style.overflowY = 'auto';
		dropdown.style.boxShadow = 'var(--overlay-shadow)';

		// Phase 24 Plan 03 — Search input at top (FILT-03)
		// Filters visible checkbox rows as user types (case-insensitive substring match).
		// Does NOT modify filter state — search only hides/shows labels.
		const searchInput = document.createElement('input');
		searchInput.type = 'text';
		searchInput.className = 'sg-filter-search';
		searchInput.placeholder = 'Search...';
		searchInput.style.cssText =
			'width:100%;box-sizing:border-box;padding:4px 6px;border:1px solid var(--border-subtle);border-radius:3px;font-size:var(--text-sm);margin-bottom:4px;outline:none;';
		dropdown.appendChild(searchInput);

		// Phase 24 Plan 03 — Select All / Clear buttons row (FILT-03)
		const actionsRow = document.createElement('div');
		actionsRow.className = 'sg-filter-actions';
		actionsRow.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;padding:0 6px;';

		const selectAllBtn = document.createElement('button');
		selectAllBtn.className = 'sg-filter-select-all';
		selectAllBtn.textContent = 'Select All';
		selectAllBtn.style.cssText =
			'font-size:var(--text-sm);padding:2px 8px;cursor:pointer;border:1px solid var(--border-muted);border-radius:3px;background:transparent;';

		const clearBtn = document.createElement('button');
		clearBtn.className = 'sg-filter-clear';
		clearBtn.textContent = 'Clear';
		clearBtn.style.cssText =
			'font-size:var(--text-sm);padding:2px 8px;cursor:pointer;border:1px solid var(--border-muted);border-radius:3px;background:transparent;';

		actionsRow.appendChild(selectAllBtn);
		actionsRow.appendChild(clearBtn);
		dropdown.appendChild(actionsRow);

		// Helper: get currently visible (search-matched) labels
		const getVisibleLabels = (): HTMLLabelElement[] =>
			Array.from(dropdown.querySelectorAll<HTMLLabelElement>('label')).filter((l) => l.style.display !== 'none');

		// Select All click: check all visible checkboxes, call clearAxis if no search, else union
		selectAllBtn.addEventListener('click', () => {
			const searchTerm = searchInput.value.trim();
			const visibleLabels = getVisibleLabels();
			visibleLabels.forEach((l) => {
				const cb = l.querySelector<HTMLInputElement>('input[type="checkbox"]');
				if (cb) cb.checked = true;
			});

			if (!searchTerm) {
				// No search active: Select All = show all = remove filter
				this._filter.clearAxis(axisField);
			} else {
				// Search active: union visible values with already-checked values
				const allCheckedValues: string[] = [];
				dropdown.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
					if (cb.checked) allCheckedValues.push(cb.value);
				});
				this._filter.setAxisFilter(axisField, allCheckedValues);
			}
		});

		// Clear click: uncheck all visible checkboxes, call setAxisFilter([]) if no search
		clearBtn.addEventListener('click', () => {
			const searchTerm = searchInput.value.trim();
			const visibleLabels = getVisibleLabels();
			visibleLabels.forEach((l) => {
				const cb = l.querySelector<HTMLInputElement>('input[type="checkbox"]');
				if (cb) cb.checked = false;
			});

			if (!searchTerm) {
				// No search active: Clear = show all = remove filter (FILT-05 semantics)
				this._filter.setAxisFilter(axisField, []);
			} else {
				// Search active: remove visible values from selection
				const remainingValues: string[] = [];
				dropdown.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
					if (cb.checked) remainingValues.push(cb.value);
				});
				this._filter.setAxisFilter(axisField, remainingValues);
			}
		});

		// Current filter values (empty array if no filter active)
		const activeValues = this._filter.hasAxisFilter(axisField) ? this._filter.getAxisFilter(axisField) : null; // null = all values checked

		// Build checkbox list
		for (const { value, count } of axisValues) {
			const label = document.createElement('label');
			label.style.display = 'flex';
			label.style.alignItems = 'center';
			label.style.padding = '4px 10px';
			label.style.cursor = 'pointer';
			label.style.fontSize = 'var(--text-sm)';
			label.style.gap = '6px';
			label.style.whiteSpace = 'nowrap';

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.value = value;
			// All checked when no filter active; only activeValues checked when filter active
			checkbox.checked = activeValues === null || activeValues.includes(value);

			checkbox.addEventListener('change', () => {
				// Collect all currently checked values
				const checkedValues: string[] = [];
				dropdown.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
					if (cb.checked) checkedValues.push(cb.value);
				});
				// setAxisFilter with [] clears the filter (FILT-05 semantics from Plan 01)
				this._filter.setAxisFilter(axisField, checkedValues);
			});

			// Phase 24 Plan 03 — Cmd+click "only this value" (FILT-03)
			// On mousedown with metaKey/ctrlKey: uncheck all others, check only this, call setAxisFilter.
			label.addEventListener('mousedown', (e: MouseEvent) => {
				if (e.metaKey || e.ctrlKey) {
					e.preventDefault(); // prevent default checkbox toggle
					// Uncheck all other checkboxes
					dropdown.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
						cb.checked = false;
					});
					// Check only this checkbox
					checkbox.checked = true;
					// Call setAxisFilter with only this value
					this._filter.setAxisFilter(axisField, [value]);
				}
			});

			const text = document.createTextNode(` ${value} (${count})`);
			label.appendChild(checkbox);
			label.appendChild(text);
			dropdown.appendChild(label);
		}

		// Phase 24 Plan 03 — Search input event: filter visible checkbox rows (FILT-03)
		// Wired after labels are appended so querySelectorAll finds them.
		searchInput.addEventListener('input', () => {
			const term = searchInput.value.toLowerCase();
			dropdown.querySelectorAll<HTMLLabelElement>('label').forEach((l) => {
				const labelText = l.textContent?.toLowerCase() ?? '';
				l.style.display = !term || labelText.includes(term) ? '' : 'none';
			});
		});

		// Append to _rootEl (NOT _gridEl — must survive _renderCells DOM clearing)
		this._rootEl.appendChild(dropdown);
		this._filterDropdownEl = dropdown;

		// Click-outside dismiss — rAF-deferred so this click doesn't immediately dismiss
		this._boundFilterOutsideClick = (e: MouseEvent) => {
			if (this._filterDropdownEl && !this._filterDropdownEl.contains(e.target as Node)) {
				this._closeFilterDropdown();
			}
		};
		requestAnimationFrame(() => {
			document.addEventListener('click', this._boundFilterOutsideClick!, { capture: true });
		});

		// Escape key dismiss
		this._boundFilterEscapeHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				this._closeFilterDropdown();
			}
		};
		document.addEventListener('keydown', this._boundFilterEscapeHandler);
	}

	/**
	 * Close the currently open filter dropdown (if any).
	 * Removes DOM element, clears event listeners, nulls references.
	 */
	private _closeFilterDropdown(): void {
		if (this._filterDropdownEl) {
			this._filterDropdownEl.remove();
			this._filterDropdownEl = null;
		}
		if (this._boundFilterOutsideClick) {
			document.removeEventListener('click', this._boundFilterOutsideClick, { capture: true });
			this._boundFilterOutsideClick = null;
		}
		if (this._boundFilterEscapeHandler) {
			document.removeEventListener('keydown', this._boundFilterEscapeHandler);
			this._boundFilterEscapeHandler = null;
		}
	}

	/**
	 * Show a transient zoom toast overlay centered in the visible grid area.
	 * Toast displays the current zoom percentage (e.g., "150%").
	 * Fades out after ~1 second. Creates element lazily on first call.
	 */
	private _showZoomToast(zoomLevel: number): void {
		if (!this._rootEl) return;

		// Create toast element lazily
		if (!this._toastEl) {
			const toast = document.createElement('div');
			toast.className = 'supergrid-zoom-toast';
			toast.style.position = 'absolute';
			toast.style.top = '50%';
			toast.style.left = '50%';
			toast.style.transform = 'translate(-50%, -50%)';
			toast.style.backgroundColor = 'var(--overlay-bg)';
			toast.style.color = 'white';
			toast.style.padding = '8px 16px';
			toast.style.borderRadius = '8px';
			toast.style.fontSize = 'var(--text-md)';
			toast.style.fontWeight = 'bold';
			toast.style.pointerEvents = 'none';
			toast.style.zIndex = '100';
			toast.style.transition = 'opacity 0.3s ease';
			this._rootEl.appendChild(toast);
			this._toastEl = toast;
		}

		// Update text and show
		this._toastEl.textContent = `${Math.round(zoomLevel * 100)}%`;
		this._toastEl.style.opacity = '1';

		// Clear any previous fade timeout and schedule new one
		if (this._toastTimeout !== null) {
			clearTimeout(this._toastTimeout);
		}
		this._toastTimeout = setTimeout(() => {
			if (this._toastEl) {
				this._toastEl.style.opacity = '0';
			}
			this._toastTimeout = null;
		}, 1000);
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/**
	 * One-time post-render mount setup: marks initial mount complete, restores
	 * scroll position, and attaches lasso overlay.
	 *
	 * Decoupled from _fetchAndRender() promise resolution because
	 * WorkerBridge.superGridQuery() uses rAF coalescing that can abandon earlier
	 * callers' promises. This method is idempotent — guarded by _mountSetupDone.
	 */
	private _completeMountSetup(): void {
		if (this._mountSetupDone || !this._rootEl || !this._gridEl) return;
		this._mountSetupDone = true;
		this._isInitialMount = false;
		this._positionProvider.restorePosition(this._rootEl);
		this._sgSelect.attach(this._rootEl, this._gridEl, this._bboxCache, this._selectionAdapter, (cellKey) =>
			this._getCellCardIds(cellKey),
		);
	}

	// Phase 21 — Selection helpers
	// ---------------------------------------------------------------------------

	/**
	 * Get card_ids for a cell key from _lastCells cache.
	 * Phase 28: cellKey format is "rowKey\x1ecolKey" (RECORD_SEP between dimensions).
	 * Within each dimension key, values are UNIT_SEP (\x1f)-joined.
	 * Uses findCellInData from keys.ts — single source of truth for key parsing.
	 *
	 * Phase 32: Aggregate proxy lookup — when direct lookup returns empty (as with
	 * summary cells from collapsed non-leaf headers), collect card_ids from all
	 * child cells whose dimension keys start with the summary cell's partial key.
	 */
	private _getCellCardIds(cellKey: string): string[] {
		const cell = findCellInData(cellKey, this._lastCells, this._lastRowAxes, this._lastColAxes);
		if (cell?.card_ids?.length) return cell.card_ids;

		// Phase 32 — Aggregate proxy: collect card_ids from child cells under collapsed group.
		// Summary cells from non-leaf collapses have shorter compound keys (e.g., "R1\x1eA"
		// instead of "R1\x1eA\x1fX\x1fP"). Match all cells whose keys start with the partial key.
		const { rowKey, colKey } = parseCellKey(cellKey);
		const collectedIds: string[] = [];
		for (const c of this._lastCells) {
			const cRowKey = buildDimensionKey(c, this._lastRowAxes);
			const cColKey = buildDimensionKey(c, this._lastColAxes);
			// Match: child cell's key starts with (or equals) the summary cell's key prefix
			const rowMatch = cRowKey === rowKey || cRowKey.startsWith(rowKey + UNIT_SEP);
			const colMatch = cColKey === colKey || cColKey.startsWith(colKey + UNIT_SEP);
			if (rowMatch && colMatch && c.card_ids?.length) {
				collectedIds.push(...c.card_ids);
			}
		}
		return collectedIds;
	}

	/**
	 * Direct DOM walk for selection visuals — NOT a full D3 re-render.
	 * Updates blue tint + outline on selected cells and updates the badge.
	 *
	 * NOTE: Adds/removes 'sg-selected' CSS class as a cross-module sentinel.
	 * SuperGridSelect._clearLassoHighlights() reads this class to avoid overwriting
	 * selection background during lasso cleanup. This is an intentional cross-module
	 * dependency — revisit during Phase 27 modularization when SuperGrid.ts is split.
	 */
	private _updateSelectionVisuals(): void {
		if (!this._gridEl) return;
		const cells = this._gridEl.querySelectorAll<HTMLElement>('.data-cell');
		for (const cell of cells) {
			const key = cell.dataset['key'] ?? '';
			const cardIds = this._getCellCardIds(key);
			const isSelected = cardIds.length > 0 && cardIds.some((id) => this._selectionAdapter.isCardSelected(id));
			// Phase 58 CSSB-03: Selection visuals fully driven by .sg-selected CSS class
			// (background-color !important, outline, outline-offset). No inline styles needed.
			if (isSelected) {
				cell.classList.add('sg-selected');
			} else {
				cell.classList.remove('sg-selected');
			}
		}
		// Update badge
		const count = this._selectionAdapter.getSelectedCount();
		if (this._badgeEl) {
			this._badgeEl.style.display = count > 0 ? '' : 'none';
			this._badgeEl.textContent = `${count} card${count !== 1 ? 's' : ''} selected`;
		}
	}

	/**
	 * Compute all card_ids in a rectangular 2D range from anchor to target cell.
	 * Phase 28: uses compound dimension keys (buildDimensionKey) for multi-level axes.
	 * Row/col order is determined by the order cells appear in _lastCells.
	 */
	private _getRectangularRangeCardIds(
		anchor: { rowKey: string; colKey: string },
		target: { rowKey: string; colKey: string },
	): string[] {
		// Build ordered compound dimension keys (deduped, preserving first-occurrence order)
		const colKeys = [...new Set(this._lastCells.map((c) => buildDimensionKey(c, this._lastColAxes)))];
		const rowKeys = [...new Set(this._lastCells.map((c) => buildDimensionKey(c, this._lastRowAxes)))];

		const r1 = Math.min(rowKeys.indexOf(anchor.rowKey), rowKeys.indexOf(target.rowKey));
		const r2 = Math.max(rowKeys.indexOf(anchor.rowKey), rowKeys.indexOf(target.rowKey));
		const c1 = Math.min(colKeys.indexOf(anchor.colKey), colKeys.indexOf(target.colKey));
		const c2 = Math.max(colKeys.indexOf(anchor.colKey), colKeys.indexOf(target.colKey));

		if (r1 < 0 || c1 < 0) return []; // anchor/target not in current data

		const cardIds: string[] = [];
		for (let r = r1; r <= r2; r++) {
			for (let c = c1; c <= c2; c++) {
				const key = `${rowKeys[r]}${RECORD_SEP}${colKeys[c]}`;
				cardIds.push(...this._getCellCardIds(key));
			}
		}
		return [...new Set(cardIds)];
	}

	// ---------------------------------------------------------------------------

	/**
	 * Update density toolbar visibility and granularity picker state.
	 * Called on every _renderCells() invocation.
	 *
	 * Granularity picker is HIDDEN when no time field (created_at / modified_at / due_at)
	 * is assigned to any active axis. Shown when at least one time field is on col or row axes.
	 *
	 * Phase 22 Plan 02 (DENS-01): only the granularity label + select are toggled;
	 * the toolbar element itself remains in DOM (destroy() nulls it out).
	 */
	private _updateDensityToolbar(colAxes: AxisMapping[], rowAxes: AxisMapping[]): void {
		if (!this._densityToolbarEl) return;

		// Phase 22 Plan 03: toolbar is always visible (has hide-empty + view-mode controls).
		// Only the granularity pills label are hidden when no time field is on an active axis.
		this._densityToolbarEl.style.display = 'flex';

		// Check if any active axis is a time field (for granularity pills visibility)
		const allActiveFields = [...colAxes, ...rowAxes].map((a) => a.field);
		const hasTimeAxis = allActiveFields.some((f) => ALLOWED_COL_TIME_FIELDS.has(f));

		// TIME-03: Show/hide granularity pills (hidden when no time field on any axis)
		if (this._granPillsEl) {
			this._granPillsEl.style.display = hasTimeAxis ? 'flex' : 'none';
		}
		if (this._granPillsLabelEl) {
			this._granPillsLabelEl.style.display = hasTimeAxis ? '' : 'none';
		}

		// TIME-03: Sync active pill state to current density + auto mode
		if (this._granPillsEl) {
			this._syncPillActiveState(this._granPillsEl);
		}

		// Sync hide-empty checkbox to current density state
		const hideEmptyCheckbox = this._densityToolbarEl.querySelector<HTMLInputElement>('input[type="checkbox"]');
		if (hideEmptyCheckbox) {
			hideEmptyCheckbox.checked = this._densityProvider.getState().hideEmpty;
		}

		// Sync view mode select to current density state
		const viewModeSelect = this._densityToolbarEl.querySelector<HTMLSelectElement>('[data-control="view-mode"]');
		if (viewModeSelect) {
			viewModeSelect.value = this._densityProvider.getState().viewMode;
		}
	}

	/**
	 * Sync the 'active' class on each granularity pill based on current state.
	 *
	 * Active pill determination:
	 *   - If _isAutoGranularity = true → 'A' pill is active (regardless of axisGranularity)
	 *   - If _isAutoGranularity = false → pill matching axisGranularity is active
	 *
	 * Active pill gets 'active' class + distinct visual style (darker background, bold).
	 * Inactive pills get default style.
	 */
	private _syncPillActiveState(pillContainer: HTMLDivElement): void {
		const currentGran = this._densityProvider.getState().axisGranularity;

		const pills = pillContainer.querySelectorAll<HTMLButtonElement>('button.granularity-pill');
		pills.forEach((pill) => {
			const granValue = pill.dataset['granValue'] ?? '';
			let isActive: boolean;

			if (this._isAutoGranularity) {
				// Auto mode: 'A' pill is active
				isActive = granValue === 'auto';
			} else {
				// Manual mode: pill matching current granularity is active
				isActive = granValue === (currentGran ?? '');
			}

			if (isActive) {
				pill.classList.add('active');
				pill.style.background = 'var(--selection-bg)';
				pill.style.fontWeight = '600';
			} else {
				pill.classList.remove('active');
				pill.style.background = 'var(--sg-header-bg, var(--bg-surface))';
				pill.style.fontWeight = '';
			}
		});
	}

	/**
	 * Update the "+N hidden" badge in the density toolbar.
	 * Creates the badge lazily on first call. Hides when count is 0.
	 */
	private _updateHiddenBadge(hiddenCount: number): void {
		if (!this._densityToolbarEl) return;

		if (hiddenCount > 0) {
			// Create badge lazily
			if (!this._hiddenIndicatorEl) {
				const badge = document.createElement('div');
				badge.className = 'supergrid-hidden-badge';
				badge.style.cssText =
					'font-size:var(--text-sm);color:var(--text-muted);padding:2px 6px;border-radius:10px;background:var(--cell-hover);';
				this._densityToolbarEl.appendChild(badge);
				this._hiddenIndicatorEl = badge;
			}
			this._hiddenIndicatorEl.style.display = '';
			this._hiddenIndicatorEl.textContent = `+${hiddenCount} hidden`;
		} else {
			// Hide badge when nothing is hidden
			if (this._hiddenIndicatorEl) {
				this._hiddenIndicatorEl.style.display = 'none';
			}
		}
	}

	// ---------------------------------------------------------------------------

	/**
	 * TIME-01/TIME-02: Compute the smart hierarchy level from cell data.
	 *
	 * Scans active axes for the first time field (created_at/modified_at/due_at),
	 * collects all raw date string values from the cells for that field, and parses them
	 * via parseDateString() to find the min/max date range. Returns smartHierarchy(min, max).
	 *
	 * Returns null when:
	 *   - No time field on any active axis
	 *   - No parseable date values (e.g., all strftime-formatted: '2026-01')
	 *   - Empty cells array
	 *
	 * Called from _fetchAndRender() only when _isAutoGranularity=true.
	 */
	private _computeSmartHierarchy(
		cells: CellDatum[],
		colAxes: AxisMapping[],
		rowAxes: AxisMapping[],
	): import('../providers/types').TimeGranularity | null {
		// Find first time field among all active axes
		const allAxes = [...colAxes, ...rowAxes];
		const timeField = allAxes.find((a) => ALLOWED_COL_TIME_FIELDS.has(a.field))?.field;
		if (!timeField) return null; // no time axis

		// Collect all raw date strings from cells for this time field.
		// When granularity is null (first mount), values are raw ISO strings (e.g., '2026-03-05').
		// When granularity is already set (subsequent renders), values are strftime-bucketed
		// (e.g., '2026-03' for month) — parseDateString will return null for these, so
		// _computeSmartHierarchy returns null and setGranularity is NOT called (correct behavior:
		// granularity is already set, nothing to auto-detect).
		const rawValues = cells.map((c) => String(c[timeField] ?? '')).filter((v) => v.length > 0);

		const parsed = rawValues.map(parseDateString).filter((d): d is Date => d !== null);

		if (parsed.length === 0) return null; // no parseable dates

		const minDate = new Date(Math.min(...parsed.map((d) => d.getTime())));
		const maxDate = new Date(Math.max(...parsed.map((d) => d.getTime())));

		return smartHierarchy(minDate, maxDate);
	}

	// ---------------------------------------------------------------------------

	/**
	 * TIME-04: Clear all period selection state and notify FilterProvider.
	 *
	 * Finds the active time field on any axis, calls filter.clearAxis(timeField),
	 * and clears the _periodSelection set. The Show All button will be hidden on
	 * the next _renderCells() call via _updatePeriodSelectionUI().
	 *
	 * Idempotent: returns immediately if _periodSelection is already empty.
	 */
	private _clearPeriodSelection(): void {
		if (this._periodSelection.size === 0) return;
		// Find the time field that was selected
		const allAxes = [...this._lastColAxes, ...this._lastRowAxes];
		const timeField = allAxes.find((a) => ALLOWED_COL_TIME_FIELDS.has(a.field))?.field;
		if (timeField) {
			this._filter.clearAxis(timeField);
		}
		this._periodSelection.clear();
		// Immediately hide the Show All button (don't wait for next _renderCells)
		if (this._showAllBtnEl) {
			this._showAllBtnEl.style.display = 'none';
		}
	}

	// ---------------------------------------------------------------------------

	/**
	 * Phase 29: Create a single row-header cell at the given axis level.
	 * Mirrors _createColHeaderCell but operates on the row dimension.
	 *
	 * @param cell         - HeaderCell from rowHeaders[levelIdx]
	 * @param axisField    - the field name for this axis level (e.g. 'folder', 'status')
	 * @param levelIdx     - which row axis level (0 = outermost/parent, N-1 = leaf)
	 * @param colHeaderLevels - number of column header rows (offsets CSS Grid row start)
	 * @param rowHeaderDepth  - total number of row header CSS Grid columns
	 * @param rowAxes      - all row axis descriptors (for Cmd+click multi-level selection)
	 * @param rowField     - fallback field name when rowAxes is empty
	 */
	private _createRowHeaderCell(
		cell: HeaderCell,
		axisField: string,
		levelIdx: number,
		colHeaderLevels: number,
		_rowHeaderDepth: number,
		rowAxes: ReadonlyArray<{ field: string }>,
		_rowField: string,
	): HTMLDivElement {
		const el = document.createElement('div');
		el.className = 'row-header sg-header';
		el.setAttribute('role', 'rowheader');
		el.dataset['level'] = String(levelIdx);
		el.dataset['value'] = cell.value;
		// PLSH-05: data-axis-field enables contextmenu event delegation to identify which field
		el.dataset['axisField'] = axisField;
		// Phase 30 — store collapse key for context menu mode switching (CLPS-04)
		el.dataset['collapseKey'] = `${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`;
		// Unique DOM key: level + parentPath + value — prevents collisions when same value
		// appears under different parents (e.g. 'active' under both Work and Personal).
		const parentPathStr = cell.parentPath ?? '';
		el.dataset['key'] = `${levelIdx}_${parentPathStr}_${cell.value}`;
		el.dataset['parentPath'] = parentPathStr;

		// CSS Grid positioning:
		// gridColumn = levelIdx + 1 (each axis level occupies its own CSS Grid column)
		// gridRow    = header rows + cell.colStart / span cell.colSpan (cell.colStart is 1-based)
		el.style.gridColumn = `${levelIdx + 1}`;
		if (cell.colSpan > 1) {
			el.style.gridRow = `${colHeaderLevels + cell.colStart} / span ${cell.colSpan}`;
		} else {
			el.style.gridRow = `${colHeaderLevels + cell.colStart}`;
		}

		// Sticky with cascading left offset (L0=0px, L1=80px, L2=160px…)
		el.style.position = 'sticky';
		el.style.left = `${levelIdx * ROW_HEADER_LEVEL_WIDTH}px`;
		el.style.zIndex = '2';
		// Phase 58 CSSB-03: backgroundColor, display, alignment, fontWeight, padding,
		// border, overflow, text-truncation all handled by .sg-header + .row-header.sg-header CSS

		// Grip handle — initiates HTML5 DnD for axis transpose/reorder (DYNM-01/DYNM-02/DYNM-03)
		// data-axis-index = levelIdx (axis level), NOT row value position — FIXES TODO at old line 1343
		const grip = document.createElement('span');
		grip.className = 'axis-grip';
		grip.textContent = '\u283F'; // Unicode braille dot pattern (grip icon)
		grip.setAttribute('draggable', 'true');
		grip.dataset['axisIndex'] = String(levelIdx); // axis level index
		grip.dataset['axisDimension'] = 'row';
		grip.style.cursor = 'grab';
		grip.style.marginRight = '4px';
		grip.style.opacity = '0.5';
		grip.style.fontSize = 'var(--text-sm)';
		grip.style.flexShrink = '0';
		grip.addEventListener('dragstart', (e: DragEvent) => {
			_dragPayload = { field: axisField, sourceDimension: 'row', sourceIndex: levelIdx };
			e.dataTransfer?.setData('text/x-supergrid-axis', '1');
			if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
			// Phase 31-02: Dim source header to 0.3 opacity during drag
			const headerCell = grip.closest('.row-header') as HTMLElement | null;
			if (headerCell) headerCell.style.opacity = '0.3';
			this._dragSourceEl = headerCell;
			e.stopPropagation();
		});
		// Phase 31-02: dragend restores opacity and cleans up insertion line
		grip.addEventListener('dragend', () => {
			if (this._dragSourceEl) {
				this._dragSourceEl.style.opacity = '';
				this._dragSourceEl = null;
			}
			this._removeInsertionLine();
			this._lastReorderTargetIndex = -1;
		});
		el.prepend(grip);

		// Phase 30 — chevron collapse indicator (row symmetry — CLPS-06)
		const chevron = document.createElement('span');
		chevron.className = 'collapse-chevron';
		chevron.textContent = cell.isCollapsed ? '\u25B6' : '\u25BC';
		chevron.style.cssText = 'margin-right:4px;font-size:8px;opacity:0.5;flex-shrink:0;';
		el.appendChild(chevron);

		// Label — Phase 30: show aggregate count badge for collapsed row headers in aggregate mode (CLPS-06)
		const label = document.createElement('span');
		label.style.overflow = 'hidden';
		label.style.textOverflow = 'ellipsis';
		{
			const rowCollapseKey = `${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`;
			const rowMode = cell.isCollapsed ? this._collapseModeMap.get(rowCollapseKey) : undefined;
			if (rowMode === 'aggregate') {
				const rowAggCount = this._lastCells
					.filter((c) => String(c[axisField] ?? 'None') === cell.value)
					.reduce((sum, c) => sum + c.count, 0);
				label.textContent = `${cell.value} (${rowAggCount})`;
			} else {
				label.textContent = cell.value;
			}
		}
		el.appendChild(label);

		// Sort icon (every level represents a distinct axis field)
		const sortBtn = this._createSortIcon(axisField as AxisField);
		el.appendChild(sortBtn);

		// Filter icon
		const filterIcon = this._createFilterIcon(axisField, 'row');
		el.appendChild(filterIcon);

		// Phase 30 — Plain click: collapse toggle for row headers (CLPS-06 row symmetry)
		// Cmd+click continues to handle selection (below)
		el.addEventListener('click', (e: MouseEvent) => {
			if (!(e.metaKey || e.ctrlKey)) {
				const collapseKey = `${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`;
				if (this._collapsedSet.has(collapseKey)) {
					this._collapsedSet.delete(collapseKey);
					this._collapseModeMap.delete(collapseKey);
				} else {
					this._collapsedSet.add(collapseKey);
					this._collapseModeMap.set(collapseKey, 'aggregate');
				}
				// Phase 30 — sync to PAFVProvider for Tier 2 persistence (CLPS-05)
				this._syncCollapseToProvider();
				this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes);
				return;
			}

			if (e.metaKey || e.ctrlKey) {
				const allCardIds: string[] = [];
				// Build the key prefix for this header cell (parentPath + UNIT_SEP + value)
				const matchPrefix = cell.parentPath ? `${cell.parentPath}${UNIT_SEP}${cell.value}` : cell.value;

				for (const cd of this._lastCells) {
					// Build prefix from cell data values for axes 0..levelIdx
					const cellValues = rowAxes
						.slice(0, levelIdx + 1)
						.map((ax) => String((cd as Record<string, unknown>)[ax.field] ?? 'None'));
					const cellPrefix = cellValues.join(UNIT_SEP);

					if (cellPrefix === matchPrefix || cellPrefix.startsWith(matchPrefix + UNIT_SEP)) {
						allCardIds.push(...(cd.card_ids ?? []));
					}
				}
				this._selectionAdapter.addToSelection(allCardIds);
				e.stopPropagation();
			}
		});

		return el;
	}

	// ---------------------------------------------------------------------------

	private _createColHeaderCell(
		cell: HeaderCell,
		gridRow: number,
		axisField: string,
		axisIndex: number,
		aggregateCount?: number,
	): HTMLDivElement {
		const el = document.createElement('div');
		el.className = 'col-header sg-header';
		el.setAttribute('role', 'columnheader');
		el.setAttribute('aria-colindex', String(cell.colStart));
		el.dataset['level'] = String(cell.level);
		el.dataset['value'] = cell.value;
		// PLSH-05: data-axis-field enables contextmenu event delegation to identify which field was right-clicked
		el.dataset['axisField'] = axisField;
		// Phase 30 — store collapse key for context menu mode switching (CLPS-04)
		el.dataset['collapseKey'] = `${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`;

		// CSS Grid positioning: +1 because column 1 is the row header area
		el.style.gridRow = `${gridRow}`;
		el.style.gridColumn = `${cell.colStart + 1} / span ${cell.colSpan}`;
		// Phase 58 CSSB-03: fontWeight, textAlign, padding, borderBottom, cursor, userSelect,
		// display, alignment, backgroundColor all handled by .sg-header + .col-header.sg-header CSS
		// Sticky column header: sticks to top edge during vertical scroll
		el.style.position = 'sticky';
		el.style.top = '0';
		el.style.zIndex = '2';

		if (cell.isCollapsed) {
			el.style.opacity = '0.6';
		}

		// Grip handle — initiates HTML5 DnD for axis transpose/reorder (DYNM-01/DYNM-02/DYNM-03)
		const grip = document.createElement('span');
		grip.className = 'axis-grip';
		grip.textContent = '\u283F'; // Unicode braille dot pattern (grip icon)
		grip.setAttribute('draggable', 'true');
		grip.dataset['axisIndex'] = String(axisIndex); // for same-dimension reorder
		grip.dataset['axisDimension'] = 'col';
		grip.style.cursor = 'grab';
		grip.style.marginRight = '4px';
		grip.style.opacity = '0.5';
		grip.style.fontSize = 'var(--text-sm)';
		grip.style.flexShrink = '0';
		grip.addEventListener('dragstart', (e: DragEvent) => {
			// field = axis field name (e.g. 'card_type'), not the displayed value (e.g. 'note')
			_dragPayload = { field: axisField, sourceDimension: 'col', sourceIndex: axisIndex };
			e.dataTransfer?.setData('text/x-supergrid-axis', '1');
			if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
			// Phase 31-02: Dim source header to 0.3 opacity during drag
			const headerCell = grip.closest('.col-header') as HTMLElement | null;
			if (headerCell) headerCell.style.opacity = '0.3';
			this._dragSourceEl = headerCell;
			e.stopPropagation(); // prevent header collapse click
		});
		// Phase 31-02: dragend restores opacity and cleans up insertion line
		grip.addEventListener('dragend', () => {
			if (this._dragSourceEl) {
				this._dragSourceEl.style.opacity = '';
				this._dragSourceEl = null;
			}
			this._removeInsertionLine();
			this._lastReorderTargetIndex = -1;
		});
		el.prepend(grip);

		// Phase 30 — chevron collapse indicator
		const chevron = document.createElement('span');
		chevron.className = 'collapse-chevron';
		chevron.textContent = cell.isCollapsed ? '\u25B6' : '\u25BC'; // right-pointing or down-pointing triangle
		chevron.style.cssText = 'margin-right:4px;font-size:8px;opacity:0.5;flex-shrink:0;';
		el.appendChild(chevron);

		const label = document.createElement('span');
		label.className = 'col-header-label';
		// Phase 22 Plan 02 (DENS-05): when granularity is active on a time-field axis,
		// show aggregate count in "January (47)" format.
		label.textContent = aggregateCount !== undefined ? `${cell.value} (${aggregateCount})` : cell.value;
		el.appendChild(label);

		// TIME-04: Apply accent background if this period is selected
		// (Safe because _renderCells() rebuilds all headers from scratch on each call)
		if (ALLOWED_COL_TIME_FIELDS.has(axisField) && this._periodSelection.has(cell.value)) {
			el.style.backgroundColor = 'var(--drag-over-bg)'; // teal drag-over accent — token adapts to theme
		}

		// Click handler: Cmd+click = period selection (TIME-04) for time axes with active granularity,
		//                Cmd+click = select all under this column header (SLCT-05) for non-time axes,
		//                plain click = collapse/expand header
		// Collapse key includes parentPath to prevent collisions when same value
		// appears under different parents at the same level.
		const collapseKey = `${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`;
		el.addEventListener('click', (e: MouseEvent) => {
			if (e.metaKey || e.ctrlKey) {
				// TIME-04: Check if this is a time axis with active granularity
				// If so, handle as period selection — do NOT fall through to SLCT-05
				const isTimeField = ALLOWED_COL_TIME_FIELDS.has(axisField);
				const hasGranularity = this._densityProvider.getState().axisGranularity !== null;
				if (isTimeField && hasGranularity) {
					const periodKey = cell.value; // strftime-formatted value (e.g., '2026-01', '2025-Q1')
					if (this._periodSelection.has(periodKey)) {
						this._periodSelection.delete(periodKey);
					} else {
						this._periodSelection.add(periodKey);
					}
					// TIME-05: compile to FilterProvider IN (?) clause
					if (this._periodSelection.size === 0) {
						this._filter.clearAxis(axisField);
					} else {
						this._filter.setAxisFilter(axisField, [...this._periodSelection]);
					}
					// Re-render from cached cells to apply teal accent and update Show All button.
					// FilterProvider subscriber → StateCoordinator → _fetchAndRender() will also fire
					// asynchronously (full re-query); this immediate re-render gives instant visual feedback.
					this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes);
					return; // CRITICAL: prevent fallthrough to SLCT-05
				}

				// Non-time or no-granularity: existing SLCT-05 card selection
				const colVal = cell.value;
				const colField = this._lastColAxes[0]?.field ?? 'card_type';
				const allCardIds: string[] = [];
				for (const cd of this._lastCells) {
					if (String(cd[colField] ?? 'unknown') === colVal) {
						allCardIds.push(...(cd.card_ids ?? []));
					}
				}
				this._selectionAdapter.addToSelection(allCardIds);
				return; // don't collapse
			}

			// Plain click: toggle collapse/expand (Phase 30 — aggregate-first default)
			if (this._collapsedSet.has(collapseKey)) {
				this._collapsedSet.delete(collapseKey);
				this._collapseModeMap.delete(collapseKey);
			} else {
				this._collapsedSet.add(collapseKey);
				this._collapseModeMap.set(collapseKey, 'aggregate'); // default: aggregate-first
			}
			// Phase 30 — sync to PAFVProvider for Tier 2 persistence (CLPS-05)
			this._syncCollapseToProvider();
			// Re-render from cached cells (no re-query)
			this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes);
		});

		return el;
	}

	// ---------------------------------------------------------------------------
	// Phase 31 Plan 02 — Visual drag UX helpers (insertion line, midpoint, FLIP)
	// ---------------------------------------------------------------------------

	/**
	 * Calculate the target insertion index based on pointer position vs header cell midpoints.
	 * Returns the index where the dragged axis should be inserted.
	 */
	private _calcReorderTargetIndex(e: DragEvent, dimension: 'col' | 'row', headerCells: HTMLElement[]): number {
		const pointerPos = dimension === 'col' ? e.clientX : e.clientY;

		for (let i = 0; i < headerCells.length; i++) {
			const rect = headerCells[i]!.getBoundingClientRect();
			const midpoint = dimension === 'col' ? rect.left + rect.width / 2 : rect.top + rect.height / 2;

			if (pointerPos < midpoint) return i;
		}
		return headerCells.length - 1; // past last element
	}

	/**
	 * Show the insertion line indicator at the given position.
	 * Creates the element lazily and repositions it.
	 */
	private _showInsertionLine(container: HTMLElement, position: number, dimension: 'col' | 'row'): void {
		if (!this._insertionLine) {
			this._insertionLine = document.createElement('div');
			this._insertionLine.className = 'reorder-insertion-line';
			this._insertionLine.style.position = 'absolute';
			this._insertionLine.style.zIndex = '15';
			this._insertionLine.style.pointerEvents = 'none';
			this._insertionLine.style.backgroundColor = 'var(--accent)';
			container.appendChild(this._insertionLine);
		}

		if (dimension === 'col') {
			// Vertical line spanning header area
			const headerHeight = this._lastColAxes.length * 40; // approximate row height per level
			this._insertionLine.style.width = '2px';
			this._insertionLine.style.height = `${headerHeight}px`;
			this._insertionLine.style.left = `${position}px`;
			this._insertionLine.style.top = '0';
		} else {
			// Horizontal line spanning row header area
			const headerWidth = this._lastRowAxes.length * ROW_HEADER_LEVEL_WIDTH;
			this._insertionLine.style.height = '2px';
			this._insertionLine.style.width = `${headerWidth}px`;
			this._insertionLine.style.top = `${position}px`;
			this._insertionLine.style.left = '0';
		}
	}

	/**
	 * Remove the insertion line from DOM.
	 */
	private _removeInsertionLine(): void {
		if (this._insertionLine) {
			this._insertionLine.remove();
			this._insertionLine = null;
		}
	}

	/**
	 * Get a FLIP key for a header or data cell element.
	 * Used for FLIP animation snapshot/playback.
	 */
	private _getElementFlipKey(el: HTMLElement): string | null {
		if (el.classList.contains('data-cell')) {
			return el.dataset['key'] ?? null;
		}
		if (el.classList.contains('col-header')) {
			const level = el.dataset['level'];
			const value = el.dataset['value'];
			return level != null && value != null ? `ch-${level}-${value}` : null;
		}
		if (el.classList.contains('row-header')) {
			const level = el.dataset['level'];
			const value = el.dataset['value'];
			return level != null && value != null ? `rh-${level}-${value}` : null;
		}
		return null;
	}

	/**
	 * Capture a FLIP snapshot of all headers and data cells before provider mutation.
	 * Stored in _flipSnapshot for consumption by _playFlipAnimation.
	 */
	private _captureFlipSnapshot(): void {
		const grid = this._gridEl;
		if (!grid) return;
		this._flipSnapshot = new Map();
		grid.querySelectorAll('.data-cell, .col-header, .row-header').forEach((el) => {
			const key = this._getElementFlipKey(el as HTMLElement);
			if (key) this._flipSnapshot!.set(key, el.getBoundingClientRect());
		});
	}

	/**
	 * Play FLIP animation: animate elements from old positions to new positions.
	 * Consumes _flipSnapshot (set to null after playing).
	 */
	private _playFlipAnimation(): void {
		if (!this._flipSnapshot || !this._gridEl) return;
		const snapshot = this._flipSnapshot;
		this._flipSnapshot = null; // consume once

		this._gridEl.querySelectorAll('.data-cell, .col-header, .row-header').forEach((el) => {
			const key = this._getElementFlipKey(el as HTMLElement);
			const oldRect = key ? snapshot.get(key) : undefined;
			if (!oldRect) return; // new element — no animation

			const newRect = el.getBoundingClientRect();
			const dx = oldRect.left - newRect.left;
			const dy = oldRect.top - newRect.top;
			if (dx === 0 && dy === 0) return; // no movement

			(el as HTMLElement).animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
				duration: 200,
				easing: 'ease-out',
			});
		});
	}

	/**
	 * Wire drop zone listeners for axis transpose (cross-dimension) and reorder (same-dimension).
	 *
	 * Cross-dimension drop (sourceDimension !== targetDimension):
	 *   Removes field from source dimension, appends to target dimension.
	 *   Guards: min-1 axis per dimension, no duplicate fields.
	 *
	 * Same-dimension drop (sourceDimension === targetDimension):
	 *   Calls reorderColAxes/reorderRowAxes (non-destructive splice that preserves
	 *   colWidths, sortOverrides, and collapseState — Phase 31 Plan 01).
	 *   Guard: sourceIndex === targetIndex is a no-op; single-axis dimension is a no-op.
	 *   Target index comes from dropZoneEl.dataset['reorderTargetIndex'] (test helpers)
	 *   or _lastReorderTargetIndex (production midpoint calculation from dragover).
	 *
	 * Provider mutation triggers StateCoordinator → _fetchAndRender() automatically.
	 */
	private _wireDropZone(dropZoneEl: HTMLElement, targetDimension: 'col' | 'row'): void {
		dropZoneEl.addEventListener('dragover', (e: DragEvent) => {
			if (e.dataTransfer?.types.includes('text/x-supergrid-axis')) {
				e.preventDefault();
				dropZoneEl.classList.add('drag-over');

				// Phase 31-02: Same-dimension midpoint calculation + insertion line
				if (_dragPayload && _dragPayload.sourceDimension === targetDimension && this._gridEl) {
					const headerSelector =
						targetDimension === 'col' ? '.col-header[data-level="0"]' : '.row-header[data-level="0"]';
					const headerCells = Array.from(this._gridEl.querySelectorAll<HTMLElement>(headerSelector));
					if (headerCells.length > 1) {
						const targetIdx = this._calcReorderTargetIndex(e, targetDimension, headerCells);
						this._lastReorderTargetIndex = targetIdx;

						// Compute insertion line position from header cell boundaries
						if (headerCells.length > 0) {
							const containerRect = this._gridEl.getBoundingClientRect();
							let linePos: number;
							if (targetIdx < headerCells.length) {
								const cellRect = headerCells[targetIdx]!.getBoundingClientRect();
								linePos =
									targetDimension === 'col' ? cellRect.left - containerRect.left : cellRect.top - containerRect.top;
							} else {
								const lastRect = headerCells[headerCells.length - 1]!.getBoundingClientRect();
								linePos =
									targetDimension === 'col' ? lastRect.right - containerRect.left : lastRect.bottom - containerRect.top;
							}
							this._showInsertionLine(this._gridEl, linePos, targetDimension);
						}
					}
				}
			}
		});

		dropZoneEl.addEventListener('dragleave', () => {
			dropZoneEl.classList.remove('drag-over');
			// Phase 31-02: Clean up insertion line on dragleave
			this._removeInsertionLine();
			this._lastReorderTargetIndex = -1;
		});

		dropZoneEl.addEventListener('drop', (e: DragEvent) => {
			e.preventDefault();
			dropZoneEl.classList.remove('drag-over');
			// Phase 31-02: Clean up insertion line on drop
			this._removeInsertionLine();

			const payload = _dragPayload;
			_dragPayload = null; // clear immediately after reading

			if (!payload) return;

			const { colAxes, rowAxes } = this._provider.getStackedGroupBySQL();

			// ---------------------------------------------------------------------------
			// Same-dimension reorder (DYNM-03 + Phase 31-02)
			// ---------------------------------------------------------------------------
			if (payload.sourceDimension === targetDimension) {
				const axes = targetDimension === 'col' ? colAxes : rowAxes;

				// Guard: single-axis dimension can't reorder
				if (axes.length <= 1) return;

				// Determine target insertion index.
				// Tests set dataset['reorderTargetIndex'] on the drop zone; production
				// uses _lastReorderTargetIndex from dragover midpoint calculation.
				const targetIndexStr = dropZoneEl.dataset['reorderTargetIndex'];
				const targetIndex =
					targetIndexStr !== undefined
						? parseInt(targetIndexStr, 10)
						: this._lastReorderTargetIndex >= 0
							? this._lastReorderTargetIndex
							: payload.sourceIndex;

				// Guard: same-position drop is a no-op
				if (payload.sourceIndex === targetIndex) return;

				// Guard: out-of-bounds target index
				if (targetIndex < 0 || targetIndex >= axes.length) return;

				// Phase 31-02: Capture FLIP snapshot before provider mutation
				this._captureFlipSnapshot();

				// Phase 31-02: Call reorderColAxes/reorderRowAxes (non-destructive — preserves
				// colWidths, sortOverrides, collapseState) instead of setColAxes/setRowAxes
				if (targetDimension === 'col') {
					this._provider.reorderColAxes(payload.sourceIndex, targetIndex);
				} else {
					this._provider.reorderRowAxes(payload.sourceIndex, targetIndex);
				}
				// Clean up the reorder target index hint after use
				delete dropZoneEl.dataset['reorderTargetIndex'];
				this._lastReorderTargetIndex = -1;
				// StateCoordinator subscription fires _fetchAndRender() automatically
				return;
			}

			// ---------------------------------------------------------------------------
			// Cross-dimension transpose (DYNM-01/DYNM-02)
			// ---------------------------------------------------------------------------
			const sourceAxes = payload.sourceDimension === 'col' ? colAxes : rowAxes;
			const targetAxes = targetDimension === 'col' ? colAxes : rowAxes;

			// Guard: min-1 axis per dimension
			if (sourceAxes.length <= 1) return;

			// Guard: no duplicate fields in target dimension
			if (targetAxes.some((a) => a.field === payload.field)) return;

			// Commit: remove from source, append to target (preserving direction)
			const movedAxis = sourceAxes.find((a) => a.field === payload.field);
			if (!movedAxis) return;

			const newSource = sourceAxes.filter((a) => a.field !== payload.field);
			const newTarget: AxisMapping[] = [
				...targetAxes,
				{ field: payload.field as AxisField, direction: movedAxis.direction },
			];

			// Phase 31-02: Capture FLIP snapshot before provider mutation
			this._captureFlipSnapshot();

			if (payload.sourceDimension === 'col') {
				// col→row transpose
				this._provider.setColAxes(newSource);
				this._provider.setRowAxes(newTarget);
			} else {
				// row→col transpose
				this._provider.setRowAxes(newSource);
				this._provider.setColAxes(newTarget);
			}

			// TIME-04 Pitfall 4: Clear stale period selection when time axis removed via transpose.
			// After provider mutation, check if the time field still exists on any axis.
			if (this._periodSelection.size > 0) {
				const allNewAxes = [...newSource, ...newTarget];
				const hasTimeField = allNewAxes.some((a) => ALLOWED_COL_TIME_FIELDS.has(a.field));
				if (!hasTimeField) {
					this._clearPeriodSelection();
				}
			}
			// StateCoordinator subscription fires _fetchAndRender() automatically — do NOT call directly
		});
	}
}
