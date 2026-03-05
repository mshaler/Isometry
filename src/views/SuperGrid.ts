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
import type { IView, CardDatum, SuperGridBridgeLike, SuperGridProviderLike, SuperGridFilterLike, SuperGridPositionLike, SuperGridSelectionLike, SuperGridDensityLike } from './types';
import type { CellDatum } from '../worker/protocol';
import type { AxisMapping, AxisField } from '../providers/types';
import {
  buildHeaderCells,
  buildGridTemplateColumns,
  type HeaderCell,
} from './supergrid/SuperStackHeader';
import { SuperZoom } from './supergrid/SuperZoom';
import { SuperGridSizer } from './supergrid/SuperGridSizer';
import { SuperGridBBoxCache } from './supergrid/SuperGridBBoxCache';
import { SuperGridSelect, classifyClickZone } from './supergrid/SuperGridSelect';
import { SortState } from './supergrid/SortState';
import { parseDateString, smartHierarchy } from './supergrid/SuperTimeUtils';

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
  get zoomLevel() { return 1.0; },
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

// Row header column width (matches buildGridTemplateColumns default)
const ROW_HEADER_WIDTH = 160;

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

  /** Root wrapper element */
  private _rootEl: HTMLDivElement | null = null;

  /** CSS Grid container — grid-template-columns set dynamically */
  private _gridEl: HTMLDivElement | null = null;

  /** Last rendered CellDatum rows — used for collapse re-render without re-querying */
  private _lastCells: CellDatum[] = [];

  /** Last fetched colAxes — used for _renderCells() column placement */
  private _lastColAxes: AxisMapping[] = [];

  /** Last fetched rowAxes — used for _renderCells() row placement */
  private _lastRowAxes: AxisMapping[] = [];

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

  /** Drop zone for col dimension — accepts row-origin drags (DYNM-01/DYNM-02) */
  private _colDropZoneEl: HTMLDivElement | null = null;

  /** Drop zone for row dimension — accepts col-origin drags (DYNM-01/DYNM-02) */
  private _rowDropZoneEl: HTMLDivElement | null = null;

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
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(
    provider: SuperGridProviderLike,
    filter: SuperGridFilterLike,
    bridge: SuperGridBridgeLike,
    coordinator: { subscribe(cb: () => void): () => void },
    positionProvider: SuperGridPositionLike = _noOpPositionProvider,
    selectionAdapter: SuperGridSelectionLike = _noOpSelectionAdapter,
    densityProvider: SuperGridDensityLike = _noOpDensityProvider
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
        widths.forEach((v, k) => { obj[k] = v; });
        this._provider.setColWidths(obj);
      }
    );

    // Load persisted widths from provider (Tier 2 restore on construct)
    const persistedWidths = this._provider.getColWidths();
    if (Object.keys(persistedWidths).length > 0) {
      this._sizer.setColWidths(new Map(Object.entries(persistedWidths)));
    }

    // Create BBoxCache and SuperGridSelect instances
    this._bboxCache = new SuperGridBBoxCache();
    this._sgSelect = new SuperGridSelect();

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

    // CSS Grid container
    const grid = document.createElement('div');
    grid.className = 'supergrid-container';
    grid.style.display = 'grid';
    grid.style.gap = '1px';

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
    toolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:12px;border-bottom:1px solid rgba(128,128,128,0.2);position:relative;z-index:10;';

    // TIME-03: Granularity label (replaces old "Group by:" label)
    const granLabel = document.createElement('span');
    granLabel.textContent = 'Time:';
    granLabel.style.fontWeight = '500';
    granLabel.style.opacity = '0.7';
    granLabel.style.fontSize = '11px';
    this._granPillsLabelEl = granLabel;

    // TIME-03: Segmented pills container (A|D|W|M|Q|Y) — replaces granularity <select>
    // 'A' = Auto (smart hierarchy), D/W/M/Q/Y = manual overrides
    const pillContainer = document.createElement('div');
    pillContainer.className = 'granularity-pills';
    pillContainer.style.cssText = 'display:flex;gap:2px;';

    const pillDefs: Array<{ label: string; value: import('../providers/types').TimeGranularity | null }> = [
      { label: 'A', value: null },      // Auto
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
      pill.style.cssText = 'font-size:10px;padding:2px 6px;border:1px solid rgba(128,128,128,0.3);border-radius:3px;cursor:pointer;background:var(--sg-header-bg,#f0f0f0);';

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
    sep1.style.cssText = 'width:1px;height:14px;background:rgba(128,128,128,0.3);';
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
    sep2.style.cssText = 'width:1px;height:14px;background:rgba(128,128,128,0.3);';
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
    viewModeSelect.style.cssText = 'font-size:11px;padding:2px 4px;border:1px solid rgba(128,128,128,0.3);border-radius:4px;background:var(--sg-header-bg,#f0f0f0);cursor:pointer;';
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
    clearSortsBtn.style.fontSize = '11px';
    clearSortsBtn.style.cursor = 'pointer';
    clearSortsBtn.style.padding = '2px 6px';
    clearSortsBtn.style.border = '1px solid rgba(128,128,128,0.3)';
    clearSortsBtn.style.borderRadius = '4px';
    clearSortsBtn.style.background = 'var(--sg-header-bg,#f0f0f0)';
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
    clearFiltersBtn.style.fontSize = '11px';
    clearFiltersBtn.style.cursor = 'pointer';
    clearFiltersBtn.style.padding = '2px 8px';
    clearFiltersBtn.style.border = '1px solid rgba(128,128,128,0.3)';
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
    showAllBtn.style.fontSize = '11px';
    showAllBtn.style.cursor = 'pointer';
    showAllBtn.style.padding = '2px 8px';
    showAllBtn.style.border = '1px solid rgba(128,128,128,0.3)';
    showAllBtn.style.borderRadius = '3px';
    showAllBtn.style.background = 'transparent';
    showAllBtn.addEventListener('click', () => {
      this._clearPeriodSelection();
    });
    toolbar.appendChild(showAllBtn);
    this._showAllBtnEl = showAllBtn;

    // Phase 25 — Search input (SRCH-01: always visible, no toggle state)
    const searchSep = document.createElement('span');
    searchSep.style.cssText = 'width:1px;height:14px;background:rgba(128,128,128,0.3);margin-left:4px;';
    toolbar.appendChild(searchSep);

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'sg-search-input';
    searchInput.placeholder = 'Search...';
    searchInput.style.cssText = 'font-size:11px;padding:2px 6px;border:1px solid rgba(128,128,128,0.3);border-radius:4px;background:var(--sg-header-bg,#f0f0f0);width:140px;margin-left:4px;';

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
    searchCount.style.cssText = 'font-size:10px;color:rgba(128,128,128,0.7);margin-left:4px;min-width:40px;';
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
    helpBtn.style.cssText = 'font-size:11px;padding:2px 6px;border:1px solid rgba(128,128,128,0.3);border-radius:4px;background:var(--sg-header-bg,#f0f0f0);cursor:pointer;margin-left:4px;';
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
      searchStyle.textContent = '.sg-search-match { outline: 2px solid rgba(245, 158, 11, 0.8); outline-offset: -2px; }';
      document.head.appendChild(searchStyle);
    }

    root.appendChild(colDropZone);
    root.appendChild(rowDropZone);
    root.appendChild(toolbar);
    root.appendChild(grid);
    container.appendChild(root);

    this._rootEl = root;
    this._gridEl = grid;
    this._densityToolbarEl = toolbar;
    this._colDropZoneEl = colDropZone;
    this._rowDropZoneEl = rowDropZone;

    // Attach sizer to grid element (must happen before first render)
    this._sizer.attach(grid);

    // Subscribe to StateCoordinator — re-fetch on any provider change
    this._coordinatorUnsub = this._coordinator.subscribe(() => {
      void this._fetchAndRender();
    });

    // Subscribe to density provider changes (Phase 22 DENS-01..DENS-03).
    // Hybrid routing: granularity changes trigger Worker re-query (_fetchAndRender);
    // hideEmpty and viewMode changes re-render client-side from _lastCells (_renderCells).
    this._unsubDensity = this._densityProvider.subscribe(() => {
      const densityState = this._densityProvider.getState();
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
        this._sizer.applyWidths(
          this._sizer.getLeafColKeys(),
          zoomLevel,
          this._gridEl
        );
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
    badge.style.backgroundColor = '#1a56f0';
    badge.style.color = 'white';
    badge.style.padding = '4px 10px';
    badge.style.borderRadius = '12px';
    badge.style.fontSize = '12px';
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
      const dimension = header.classList.contains('col-header') ? 'col' : 'row';
      this._openContextMenu(e.clientX, e.clientY, axisField, dimension);
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

    // Remove DOM — _rootEl contains toolbar, grid, and all children
    if (this._rootEl && this._rootEl.parentElement) {
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

    // Clear internal state
    this._collapsedSet = new Set();
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
        sortOverrides: this._sortState.getSorts(),  // Phase 23 SORT-04
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

      this._lastCells = cells;
      this._lastColAxes = colAxes;
      this._lastRowAxes = rowAxes;
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
      }

      // Post-render: transition opacity 0→1 over 300ms (DYNM-04)
      // D3 transitions auto-cancel previous transitions on the same element
      d3.select(grid)
        .transition()
        .duration(300)
        .style('opacity', '1');
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

    // Phase 22 Plan 02 — update density toolbar visibility based on whether
    // any active axis is a time field. Must run on every _renderCells call.
    this._updateDensityToolbar(colAxes, rowAxes);

    // ---------------------------------------------------------------------------
    // Extract distinct axis values from cells
    // ---------------------------------------------------------------------------

    // Primary col field (first colAxis)
    const colField = colAxes[0]?.field ?? 'card_type';
    // Primary row field (first rowAxis)
    const rowField = rowAxes[0]?.field ?? 'folder';

    // Build distinct col values and row values from the cells
    const colValuesRaw = [...new Set(cells.map(c => String(c[colField] ?? 'unknown')))].sort();
    const rowValuesRaw = [...new Set(cells.map(c => String(c[rowField] ?? 'None')))].sort();

    // ---------------------------------------------------------------------------
    // Phase 22 Plan 03 — Hide-empty filter (DENS-02)
    // Remove entire rows/columns where ALL cells have count=0.
    // Client-side filter on _lastCells — no Worker re-query needed.
    // ---------------------------------------------------------------------------
    const densityStateForHide = this._densityProvider.getState();
    let colValues = colValuesRaw;
    let rowValues = rowValuesRaw;
    let hiddenColCount = 0;
    let hiddenRowCount = 0;

    if (densityStateForHide.hideEmpty) {
      colValues = colValuesRaw.filter(cv =>
        cells.some(c => String(c[colField] ?? 'unknown') === cv && c.count > 0)
      );
      rowValues = rowValuesRaw.filter(rv =>
        cells.some(c => String(c[rowField] ?? 'None') === rv && c.count > 0)
      );
      hiddenColCount = colValuesRaw.length - colValues.length;
      hiddenRowCount = rowValuesRaw.length - rowValues.length;
    }

    // Update "+N hidden" badge (DENS-02)
    this._updateHiddenBadge(hiddenColCount + hiddenRowCount);

    // If no cells after filtering, produce an empty grid
    if (colValues.length === 0 && rowValues.length === 0) {
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      return;
    }

    // Build single-level axis value tuples (using filtered values)
    const colAxisValues: string[][] = colValues.map(v => [v]);
    const rowAxisValues: string[][] = rowValues.map(v => [v]);

    // ---------------------------------------------------------------------------
    // Compute headers via buildHeaderCells
    // ---------------------------------------------------------------------------

    const { headers: colHeaders, leafCount: colLeafCount } = buildHeaderCells(
      colAxisValues,
      this._collapsedSet
    );
    const { headers: rowHeaders, leafCount: _rowLeafCount } = buildHeaderCells(
      rowAxisValues,
      this._collapsedSet
    );

    // ---------------------------------------------------------------------------
    // Set grid-template-columns
    // ---------------------------------------------------------------------------

    // Build leaf column keys from the last level of colHeaders (leaf-level HeaderCell values).
    // These are the ordered colKey values used to look up per-column widths.
    const leafColKeys = (colHeaders[colHeaders.length - 1] ?? []).map(c => c.value);

    // Update sizer's leaf key tracking (for Shift+drag normalize and zoom recalc)
    this._sizer.setLeafColKeys(leafColKeys);

    // Build grid-template-columns using per-column widths from sizer (includes persisted widths)
    grid.style.gridTemplateColumns = buildGridTemplateColumns(
      leafColKeys,
      this._sizer.getColWidths(),
      this._positionProvider.zoomLevel,
      ROW_HEADER_WIDTH
    );

    const colHeaderLevels = colHeaders.length;
    const visibleRowCells: HeaderCell[] = rowHeaders[0] ?? [];
    const totalRows = colHeaderLevels + visibleRowCells.length;
    grid.style.gridTemplateRows = Array(totalRows).fill('auto').join(' ');

    // ---------------------------------------------------------------------------
    // Render column headers
    // ---------------------------------------------------------------------------

    while (grid.firstChild) grid.removeChild(grid.firstChild);

    for (let levelIdx = 0; levelIdx < colHeaders.length; levelIdx++) {
      const levelCells = colHeaders[levelIdx] ?? [];
      const gridRow = levelIdx + 1;

      const corner = document.createElement('div');
      corner.className = 'corner-cell';
      corner.style.gridRow = `${gridRow}`;
      corner.style.gridColumn = '1';
      // Sticky corner: sticks to both top and left edges, above all other sticky cells (z-index:3)
      corner.style.position = 'sticky';
      corner.style.top = '0';
      corner.style.left = '0';
      corner.style.zIndex = '3';
      corner.style.backgroundColor = 'var(--sg-header-bg, #f0f0f0)';
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
            .filter(c => String(c[levelAxisField] ?? 'unknown') === cell.value)
            .reduce((sum, c) => sum + c.count, 0);
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
    // Render row headers
    // ---------------------------------------------------------------------------

    for (let rowIdx = 0; rowIdx < visibleRowCells.length; rowIdx++) {
      const rowCell = visibleRowCells[rowIdx]!;
      const gridRow = colHeaderLevels + rowIdx + 1;

      const rowHeaderEl = document.createElement('div');
      rowHeaderEl.className = 'row-header';
      rowHeaderEl.style.gridRow = `${gridRow}`;
      rowHeaderEl.style.gridColumn = '1';
      rowHeaderEl.style.fontWeight = 'bold';
      rowHeaderEl.style.padding = '4px 8px';
      rowHeaderEl.style.borderBottom = '1px solid rgba(128,128,128,0.2)';
      rowHeaderEl.style.display = 'flex';
      rowHeaderEl.style.alignItems = 'center';
      // Sticky row header: sticks to left edge during horizontal scroll
      rowHeaderEl.style.position = 'sticky';
      rowHeaderEl.style.left = '0';
      rowHeaderEl.style.zIndex = '2';
      rowHeaderEl.style.backgroundColor = 'var(--sg-header-bg, #f0f0f0)';

      // Axis field for row headers: primary row axis field
      // The grip encodes the axis field name (e.g. 'folder'), not the displayed value (e.g. 'A')
      const rowAxisField = rowAxes[0]?.field ?? rowField;
      // PLSH-05: data-axis-field enables contextmenu event delegation to identify which field was right-clicked
      rowHeaderEl.dataset['axisField'] = rowAxisField;

      // Grip handle — initiates HTML5 DnD for axis transpose/reorder (DYNM-01/DYNM-02/DYNM-03)
      const rowGrip = document.createElement('span');
      rowGrip.className = 'axis-grip';
      rowGrip.textContent = '\u283F'; // Unicode braille dot pattern (grip icon)
      rowGrip.setAttribute('draggable', 'true');
      rowGrip.dataset['axisIndex'] = String(rowIdx); // for same-dimension reorder
      rowGrip.dataset['axisDimension'] = 'row';
      rowGrip.style.cursor = 'grab';
      rowGrip.style.marginRight = '4px';
      rowGrip.style.opacity = '0.5';
      rowGrip.style.fontSize = '12px';
      rowGrip.style.flexShrink = '0';
      rowGrip.addEventListener('dragstart', (e: DragEvent) => {
        // sourceIndex = which rowAxes[] entry this grip represents (axis index),
        // NOT the row-value index (rowIdx). For single-level rendering: always 0.
        // TODO: update to levelIdx when multi-level row headers are rendered.
        const rowAxisLevelIndex = 0;
        _dragPayload = { field: rowAxisField, sourceDimension: 'row', sourceIndex: rowAxisLevelIndex };
        e.dataTransfer?.setData('text/x-supergrid-axis', '1');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
      });
      rowHeaderEl.appendChild(rowGrip);

      const rowLabel = document.createElement('span');
      rowLabel.textContent = rowCell.value;
      rowHeaderEl.appendChild(rowLabel);

      // Phase 23 — Sort icon on row headers (SORT-01/SORT-02/SORT-03)
      // Row headers are always single-level = always leaf level
      if (rowAxes[0]?.field) {
        const rowSortBtn = this._createSortIcon(rowAxes[0].field as AxisField);
        rowHeaderEl.appendChild(rowSortBtn);

        // Phase 24 — Filter icon on row headers (FILT-01)
        const rowFilterIcon = this._createFilterIcon(rowAxes[0].field, 'row');
        rowHeaderEl.appendChild(rowFilterIcon);
      }

      // Phase 21: Cmd+click on row header selects all cards under that row (SLCT-05)
      rowHeaderEl.addEventListener('click', (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey) {
          const rowVal = rowCell.value;
          const rowField = rowAxes[0]?.field ?? 'folder';
          const allCardIds: string[] = [];
          for (const cd of this._lastCells) {
            if (String(cd[rowField] ?? 'None') === rowVal) {
              allCardIds.push(...(cd.card_ids ?? []));
            }
          }
          this._selectionAdapter.addToSelection(allCardIds);
        }
      });

      grid.appendChild(rowHeaderEl);
    }

    // ---------------------------------------------------------------------------
    // Render data cells via D3 data join
    // ---------------------------------------------------------------------------

    // Build leaf column cells for placement
    const leafColCells: HeaderCell[] = colHeaders[colHeaders.length - 1] ?? [];
    const colValueToStart = new Map<string, number>();
    for (const cell of leafColCells) {
      colValueToStart.set(cell.value, cell.colStart);
    }

    // Build CellPlacement data from cells (one per visible row×col intersection)
    interface CellPlacement {
      rowKey: string;
      colKey: string;
      count: number;
      cardIds: string[];
      matchedCardIds: string[];  // Phase 25 SRCH-03: IDs of cards matching current search term
    }

    // Preindex cells for O(1) lookup instead of O(N) .find() per placement (Fix 8).
    // Key format: rowVal\x1fcolVal (row-first to match dataset key convention).
    const cellMap = new Map<string, CellDatum>();
    for (const c of cells) {
      const ck = `${String(c[rowField] ?? 'None')}\x1f${String(c[colField] ?? 'unknown')}`;
      cellMap.set(ck, c);
    }

    const cellPlacements: CellPlacement[] = [];
    for (const rowCell of visibleRowCells) {
      const rowVal = rowCell.value;
      for (const colCell of leafColCells) {
        const colVal = colCell.value;
        // O(1) lookup via preindex (was O(N) cells.find())
        const matchingCell = cellMap.get(`${rowVal}\x1f${colVal}`);
        cellPlacements.push({
          rowKey: rowVal,
          colKey: colVal,
          count: matchingCell?.count ?? 0,
          cardIds: matchingCell?.card_ids ?? [],
          matchedCardIds: (matchingCell?.['matchedCardIds'] as string[] | undefined) ?? [],
        });
      }
    }

    // ---------------------------------------------------------------------------
    // Phase 22 Plan 03 — View mode rendering (DENS-03)
    // Compute heat map color scale ONCE before D3 loop (matrix mode).
    // d3.scaleSequential with interpolateBlues: low count = light, high count = saturated.
    // ---------------------------------------------------------------------------
    const densityStateForView = this._densityProvider.getState();
    const maxCount = Math.max(...cellPlacements.map(c => c.count), 1);
    const heatScale = d3.scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolateBlues);

    // D3 data join
    // Capture class instance for use inside D3's .each(function(d)) where `this` is the DOM element
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const gridSelection = d3.select(grid);
    gridSelection
      .selectAll<HTMLDivElement, CellPlacement>('.data-cell')
      .data(cellPlacements, d => `${d.rowKey}\x1f${d.colKey}`)
      .join(
        enter => enter.append('div').attr('class', 'data-cell'),
        update => update,
        exit => exit.remove()
      )
      // DENS-06: .each() after .join() fires on BOTH enter and update — gridColumn/gridRow
      // re-applied to all elements including survived update-path elements. This ensures
      // density-collapsed cells realign correctly when layout changes (fewer columns/rows).
      .each(function (d) {
        const el = this as HTMLDivElement;
        el.dataset['rowKey'] = d.rowKey;
        el.dataset['colKey'] = d.colKey;
        // Composite key for D3 data join identity and BBoxCache lookup.
        // Uses U+001F unit separator — not present in user data (colons are legal in axis values).
        el.dataset['key'] = `${d.rowKey}\x1f${d.colKey}`;

        const colStart = colValueToStart.get(d.colKey) ?? 1;
        const rowIdx = visibleRowCells.findIndex(c => c.value === d.rowKey);
        const gridRow = colHeaderLevels + rowIdx + 1;

        el.style.gridColumn = `${colStart + 1}`; // +1 because col 1 = row header
        el.style.gridRow = `${gridRow}`;
        el.style.borderBottom = '1px solid rgba(128,128,128,0.1)';
        el.style.borderRight = '1px solid rgba(128,128,128,0.1)';
        // Use CSS Custom Property for zoom-aware row height (set by SuperZoom.applyZoom())
        el.style.minHeight = 'var(--sg-row-height, 40px)';

        if (d.count === 0) {
          el.classList.add('empty-cell');
          el.style.backgroundColor = 'rgba(255,255,255,0.02)';
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.padding = 'calc(4px * var(--sg-zoom, 1))';
          el.innerHTML = '';
        } else if (densityStateForView.viewMode === 'spreadsheet') {
          // -----------------------------------------------------------------
          // Spreadsheet mode (DENS-03): SuperCard above card pills (CARD-01)
          // -----------------------------------------------------------------
          el.classList.remove('empty-cell');
          el.style.backgroundColor = '';
          el.style.display = 'flex';
          el.style.flexDirection = 'column';
          el.style.alignItems = 'flex-start';
          el.style.justifyContent = 'flex-start';
          el.style.padding = 'calc(4px * var(--sg-zoom, 1))';

          // Render card pills (max 3 visible, then "+N more" badge)
          const maxVisible = 3;
          const visibleIds = d.cardIds.slice(0, maxVisible);
          const remaining = d.cardIds.length - visibleIds.length;
          let html = '';
          for (const cardId of visibleIds) {
            html += `<div class="card-pill" style="display:flex;align-items:center;gap:4px;padding:2px 6px;margin:1px 0;border-radius:3px;background:rgba(128,128,128,0.1);font-size:calc(11px * var(--sg-zoom, 1));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${cardId}</div>`;
          }
          if (remaining > 0) {
            html += `<div class="overflow-badge" style="font-size:calc(10px * var(--sg-zoom, 1));color:rgba(128,128,128,0.6);padding:2px;">+${remaining} more</div>`;
          }
          el.innerHTML = html;

          // Phase 27 CARD-01: Prepend SuperCard as first child above card pills
          const superCardSpreadsheet = document.createElement('div');
          superCardSpreadsheet.className = 'supergrid-card';
          superCardSpreadsheet.setAttribute('data-supercard', 'true');
          superCardSpreadsheet.style.border = '1px dashed rgba(128,128,128,0.4)';
          superCardSpreadsheet.style.borderRadius = '4px';
          superCardSpreadsheet.style.fontStyle = 'italic';
          superCardSpreadsheet.style.fontSize = 'calc(12px * var(--sg-zoom, 1))';
          superCardSpreadsheet.style.padding = 'calc(2px * var(--sg-zoom, 1)) calc(6px * var(--sg-zoom, 1))';
          superCardSpreadsheet.style.cursor = 'pointer';
          superCardSpreadsheet.style.userSelect = 'none';
          superCardSpreadsheet.style.background = 'rgba(0,0,0,0.03)';
          superCardSpreadsheet.style.marginBottom = 'calc(2px * var(--sg-zoom, 1))';
          superCardSpreadsheet.textContent = String(d.count);
          superCardSpreadsheet.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            self._openSuperCardTooltip(superCardSpreadsheet, d);
          });
          el.insertBefore(superCardSpreadsheet, el.firstChild);
        } else {
          // -----------------------------------------------------------------
          // Matrix mode (DENS-03): SuperCard replaces count badge (CARD-01/CARD-02)
          // SuperCards never participate in d3.interpolateBlues heat map.
          // Cell backgroundColor is cleared — SuperCard provides visual identity.
          // -----------------------------------------------------------------
          el.classList.remove('empty-cell');
          // CARD-02: cell does NOT get heat map color — clear it explicitly
          el.style.backgroundColor = '';
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.padding = 'calc(4px * var(--sg-zoom, 1))';

          el.innerHTML = '';

          // Create SuperCard element (replaces count-badge span)
          const superCard = document.createElement('div');
          superCard.className = 'supergrid-card';
          superCard.setAttribute('data-supercard', 'true');
          superCard.style.border = '1px dashed rgba(128,128,128,0.4)';
          superCard.style.borderRadius = '4px';
          superCard.style.fontStyle = 'italic';
          superCard.style.fontSize = 'calc(12px * var(--sg-zoom, 1))';
          superCard.style.padding = 'calc(4px * var(--sg-zoom, 1)) calc(8px * var(--sg-zoom, 1))';
          superCard.style.cursor = 'pointer';
          superCard.style.userSelect = 'none';
          superCard.style.background = 'rgba(0,0,0,0.03)';
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
        // This preserves the at-a-glance count display regardless of search state.
        const hasSuperCard = !!el.querySelector('[data-supercard]');

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
            const escapedTerms = searchTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

            el.querySelectorAll('.card-pill').forEach(pill => {
              const text = pill.textContent ?? '';
              // Reset lastIndex before testing (global regex tracks position)
              regex.lastIndex = 0;
              if (regex.test(text)) {
                // Split text into alternating non-match / match segments
                // String.split() with a capturing group includes the captured text in the array
                regex.lastIndex = 0;
                const parts = text.split(regex);
                // Rebuild pill contents via DOM nodes (not innerHTML) — SRCH-03 locked decision
                pill.textContent = '';
                for (let i = 0; i < parts.length; i++) {
                  const part = parts[i]!;
                  if (part.length === 0) continue;
                  // Test if this part is a captured match (case-insensitive comparison vs terms)
                  const isTerm = escapedTerms.some(t => new RegExp(`^${t}$`, 'i').test(part));
                  if (isTerm) {
                    const mark = document.createElement('mark');
                    mark.style.cssText = 'background:rgba(245,158,11,0.4);color:inherit;padding:0 1px;border-radius:2px;';
                    mark.textContent = part;
                    pill.appendChild(mark);
                  } else {
                    pill.appendChild(document.createTextNode(part));
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

          const cellKey = `${d.rowKey}\x1f${d.colKey}`;
          const cardIds = self._getCellCardIds(cellKey);

          if (e.shiftKey && self._selectionAnchor) {
            // Shift+click: 2D rectangular range from anchor to target
            const rangeCardIds = self._getRectangularRangeCardIds(
              self._selectionAnchor,
              { rowKey: d.rowKey, colKey: d.colKey }
            );
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

    // Phase 21 — schedule BBoxCache snapshot after render (SLCT-08)
    this._bboxCache.scheduleSnapshot();

    // Phase 23 — Update Clear sorts button visibility (SORT-01/SORT-02)
    if (this._clearSortsBtnEl) {
      this._clearSortsBtnEl.style.display = this._sortState.hasActiveSorts() ? '' : 'none';
    }

    // Phase 24 Plan 03 — Update Clear filters button visibility (FILT-04)
    // Visible when any col or row axis has an active axis filter.
    if (this._clearFiltersBtnEl) {
      const hasAnyAxisFilter = this._lastColAxes.some(a => this._filter.hasAxisFilter(a.field))
        || this._lastRowAxes.some(a => this._filter.hasAxisFilter(a.field));
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
        const matchingCellCount = cells.filter(c =>
          Array.isArray(c['matchedCardIds']) && (c['matchedCardIds'] as string[]).length > 0
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
    tooltip.style.background = 'var(--sg-header-bg, #f5f5f5)';
    tooltip.style.border = '1px solid rgba(128,128,128,0.3)';
    tooltip.style.borderRadius = '6px';
    tooltip.style.minWidth = '180px';
    tooltip.style.maxHeight = '300px';
    tooltip.style.overflowY = 'auto';
    tooltip.style.fontSize = '12px';
    tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';

    // Header: "{N} card(s)"
    const header = document.createElement('div');
    header.className = 'sg-supercard-tooltip-header';
    header.textContent = `${d.count} card${d.count !== 1 ? 's' : ''}`;
    header.style.fontWeight = 'bold';
    header.style.padding = '8px 10px';
    header.style.borderBottom = '1px solid rgba(128,128,128,0.2)';
    header.style.fontSize = '11px';
    header.style.color = 'rgba(0,0,0,0.6)';
    tooltip.appendChild(header);

    // Card ID list — clicking each adds card to selection
    const ids = d.cardIds;
    if (ids.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '(empty)';
      empty.style.padding = '8px 10px';
      empty.style.color = 'rgba(128,128,128,0.6)';
      tooltip.appendChild(empty);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      for (const id of ids) {
        const trimmedId = id.trim();
        const item = document.createElement('div');
        item.className = 'sg-supercard-tooltip-item';
        item.textContent = trimmedId;
        item.style.padding = '5px 10px';
        item.style.cursor = 'pointer';
        item.style.fontSize = '11px';
        item.style.whiteSpace = 'nowrap';
        item.style.overflow = 'hidden';
        item.style.textOverflow = 'ellipsis';
        item.addEventListener('mouseenter', () => {
          item.style.background = 'rgba(128,128,128,0.08)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = '';
        });
        item.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          self._selectionAdapter.addToSelection([trimmedId]);
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
      'background:rgba(0,0,0,0.5)',
      'z-index:100',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');

    const content = document.createElement('div');
    content.className = 'sg-help-content';
    content.style.cssText = [
      'background:var(--sg-header-bg,#fff)',
      'border:1px solid rgba(128,128,128,0.3)',
      'border-radius:8px',
      'padding:20px',
      'min-width:360px',
      'max-width:480px',
      'max-height:80vh',
      'overflow-y:auto',
      'font-size:13px',
      'position:relative',
    ].join(';');

    // Title
    const title = document.createElement('h3');
    title.textContent = 'SuperGrid Keyboard Shortcuts';
    title.style.cssText = 'margin:0 0 16px;font-size:14px;font-weight:600;';
    content.appendChild(title);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sg-help-close-btn';
    closeBtn.textContent = '\u00D7'; // ×
    closeBtn.title = 'Close';
    closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;border:none;background:none;cursor:pointer;font-size:18px;line-height:1;color:rgba(0,0,0,0.5);padding:2px 6px;';
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
        cat.style.cssText = 'font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:rgba(0,0,0,0.5);margin-top:12px;margin-bottom:4px;';
        content.appendChild(cat);
      }
      const row = document.createElement('div');
      row.className = 'sg-help-shortcut';
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:3px 0;gap:12px;';
      const keyEl = document.createElement('kbd');
      keyEl.textContent = sc.key;
      keyEl.style.cssText = 'font-family:monospace;font-size:11px;background:rgba(0,0,0,0.07);padding:2px 5px;border-radius:3px;white-space:nowrap;';
      const descEl = document.createElement('span');
      descEl.textContent = sc.description;
      descEl.style.cssText = 'color:rgba(0,0,0,0.7);font-size:12px;';
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
  private _openContextMenu(clientX: number, clientY: number, axisField: string, dimension: 'col' | 'row'): void {
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
      'background:var(--sg-header-bg,#f5f5f5)',
      'border:1px solid rgba(128,128,128,0.3)',
      'border-radius:6px',
      'min-width:180px',
      'padding:4px 0',
      'font-size:12px',
      'box-shadow:0 4px 12px rgba(0,0,0,0.12)',
    ].join(';');

    const currentSortDir = this._sortState.getDirection(axisField as AxisField);

    // Sort ascending item
    const sortAscItem = document.createElement('div');
    sortAscItem.className = 'sg-context-menu-item';
    const isAsc = currentSortDir === 'asc' && this._sortState.getPriority(axisField as AxisField) > 0;
    sortAscItem.textContent = `${isAsc ? '? ' : ''}Sort ascending`;
    sortAscItem.style.cssText = 'padding:7px 14px;cursor:pointer;';
    sortAscItem.addEventListener('mouseenter', () => { sortAscItem.style.background = 'rgba(128,128,128,0.08)'; });
    sortAscItem.addEventListener('mouseleave', () => { sortAscItem.style.background = ''; });
    sortAscItem.addEventListener('click', () => {
      this._provider.setSortOverrides([{ field: axisField as AxisField, direction: 'asc' as const }]);
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
    sortDescItem.addEventListener('mouseenter', () => { sortDescItem.style.background = 'rgba(128,128,128,0.08)'; });
    sortDescItem.addEventListener('mouseleave', () => { sortDescItem.style.background = ''; });
    sortDescItem.addEventListener('click', () => {
      this._provider.setSortOverrides([{ field: axisField as AxisField, direction: 'desc' as const }]);
      this._closeContextMenu();
      // StateCoordinator subscription fires _fetchAndRender() automatically
    });
    menu.appendChild(sortDescItem);

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(128,128,128,0.15);margin:4px 0;';
    menu.appendChild(sep);

    // Filter item
    const filterItem = document.createElement('div');
    filterItem.className = 'sg-context-menu-item';
    filterItem.textContent = 'Filter';
    filterItem.style.cssText = 'padding:7px 14px;cursor:pointer;';
    filterItem.addEventListener('mouseenter', () => { filterItem.style.background = 'rgba(128,128,128,0.08)'; });
    filterItem.addEventListener('mouseleave', () => { filterItem.style.background = ''; });
    filterItem.addEventListener('click', () => {
      this._closeContextMenu();
      // Find the filter icon for this field and simulate opening it
      const filterIcon = this._rootEl?.querySelector<HTMLElement>(`[data-filter-field="${axisField}"]`);
      if (filterIcon) filterIcon.click();
    });
    menu.appendChild(filterItem);

    // Hide/Show column or row item
    const isCol = dimension === 'col';
    const hiddenSet = isCol ? this._hiddenCols : this._hiddenRows;
    const isHidden = hiddenSet.has(axisField);
    const hideItem = document.createElement('div');
    hideItem.className = 'sg-context-menu-item';
    hideItem.textContent = isHidden
      ? `Show ${isCol ? 'column' : 'row'}`
      : `Hide ${isCol ? 'column' : 'row'}`;
    hideItem.style.cssText = 'padding:7px 14px;cursor:pointer;';
    hideItem.addEventListener('mouseenter', () => { hideItem.style.background = 'rgba(128,128,128,0.08)'; });
    hideItem.addEventListener('mouseleave', () => { hideItem.style.background = ''; });
    hideItem.addEventListener('click', () => {
      if (isHidden) {
        hiddenSet.delete(axisField);
      } else {
        hiddenSet.add(axisField);
      }
      this._closeContextMenu();
      void this._fetchAndRender();
    });
    menu.appendChild(hideItem);

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
    sortBtn.style.fontSize = '10px';
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
      icon.style.color = 'var(--sg-filter-active-color, #1a56f0)';
    } else {
      icon.textContent = '\u25BD'; // ▽ hollow down triangle
      icon.style.opacity = '0';
      icon.style.color = '';
    }

    // Styling — mirrors _createSortIcon
    icon.style.cursor = 'pointer';
    icon.style.marginLeft = '4px';
    icon.style.fontSize = '10px';
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
    dropdown.style.background = 'var(--sg-header-bg, #f8f8f8)';
    dropdown.style.border = '1px solid rgba(128,128,128,0.3)';
    dropdown.style.borderRadius = '6px';
    dropdown.style.padding = '6px 0';
    dropdown.style.minWidth = '180px';
    dropdown.style.maxHeight = '280px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

    // Phase 24 Plan 03 — Search input at top (FILT-03)
    // Filters visible checkbox rows as user types (case-insensitive substring match).
    // Does NOT modify filter state — search only hides/shows labels.
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'sg-filter-search';
    searchInput.placeholder = 'Search...';
    searchInput.style.cssText = 'width:100%;box-sizing:border-box;padding:4px 6px;border:1px solid rgba(128,128,128,0.2);border-radius:3px;font-size:12px;margin-bottom:4px;outline:none;';
    dropdown.appendChild(searchInput);

    // Phase 24 Plan 03 — Select All / Clear buttons row (FILT-03)
    const actionsRow = document.createElement('div');
    actionsRow.className = 'sg-filter-actions';
    actionsRow.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;padding:0 6px;';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'sg-filter-select-all';
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.style.cssText = 'font-size:11px;padding:2px 8px;cursor:pointer;border:1px solid rgba(128,128,128,0.3);border-radius:3px;background:transparent;';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'sg-filter-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'font-size:11px;padding:2px 8px;cursor:pointer;border:1px solid rgba(128,128,128,0.3);border-radius:3px;background:transparent;';

    actionsRow.appendChild(selectAllBtn);
    actionsRow.appendChild(clearBtn);
    dropdown.appendChild(actionsRow);

    // Helper: get currently visible (search-matched) labels
    const getVisibleLabels = (): HTMLLabelElement[] =>
      Array.from(dropdown.querySelectorAll<HTMLLabelElement>('label')).filter(l => l.style.display !== 'none');

    // Select All click: check all visible checkboxes, call clearAxis if no search, else union
    selectAllBtn.addEventListener('click', () => {
      const searchTerm = searchInput.value.trim();
      const visibleLabels = getVisibleLabels();
      visibleLabels.forEach(l => {
        const cb = l.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (cb) cb.checked = true;
      });

      if (!searchTerm) {
        // No search active: Select All = show all = remove filter
        this._filter.clearAxis(axisField);
      } else {
        // Search active: union visible values with already-checked values
        const allCheckedValues: string[] = [];
        dropdown.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
          if (cb.checked) allCheckedValues.push(cb.value);
        });
        this._filter.setAxisFilter(axisField, allCheckedValues);
      }
    });

    // Clear click: uncheck all visible checkboxes, call setAxisFilter([]) if no search
    clearBtn.addEventListener('click', () => {
      const searchTerm = searchInput.value.trim();
      const visibleLabels = getVisibleLabels();
      visibleLabels.forEach(l => {
        const cb = l.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (cb) cb.checked = false;
      });

      if (!searchTerm) {
        // No search active: Clear = show all = remove filter (FILT-05 semantics)
        this._filter.setAxisFilter(axisField, []);
      } else {
        // Search active: remove visible values from selection
        const remainingValues: string[] = [];
        dropdown.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
          if (cb.checked) remainingValues.push(cb.value);
        });
        this._filter.setAxisFilter(axisField, remainingValues);
      }
    });

    // Current filter values (empty array if no filter active)
    const activeValues = this._filter.hasAxisFilter(axisField)
      ? this._filter.getAxisFilter(axisField)
      : null; // null = all values checked

    // Build checkbox list
    for (const { value, count } of axisValues) {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.padding = '4px 10px';
      label.style.cursor = 'pointer';
      label.style.fontSize = '12px';
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
        dropdown.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
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
          dropdown.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
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
      dropdown.querySelectorAll<HTMLLabelElement>('label').forEach(l => {
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
      toast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      toast.style.color = 'white';
      toast.style.padding = '8px 16px';
      toast.style.borderRadius = '8px';
      toast.style.fontSize = '14px';
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
    this._sgSelect.attach(
      this._rootEl,
      this._gridEl,
      this._bboxCache,
      this._selectionAdapter,
      (cellKey) => this._getCellCardIds(cellKey)
    );
  }

  // Phase 21 — Selection helpers
  // ---------------------------------------------------------------------------

  /**
   * Get card_ids for a cell key from _lastCells cache.
   * cellKey format: "rowKey\x1fcolKey" (matches el.dataset['key']).
   * Uses U+001F unit separator to avoid ambiguity with colons in axis values.
   */
  private _getCellCardIds(cellKey: string): string[] {
    const colField = this._lastColAxes[0]?.field ?? 'card_type';
    const rowField = this._lastRowAxes[0]?.field ?? 'folder';
    const sepIdx = cellKey.indexOf('\x1f');
    if (sepIdx === -1) return [];
    const rowKey = cellKey.slice(0, sepIdx);
    const colKey = cellKey.slice(sepIdx + 1);
    const cell = this._lastCells.find(
      c => String(c[colField] ?? 'unknown') === colKey && String(c[rowField] ?? 'None') === rowKey
    );
    return cell?.card_ids ?? [];
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
      const isSelected = cardIds.length > 0 && cardIds.some(id => this._selectionAdapter.isCardSelected(id));
      cell.style.backgroundColor = isSelected
        ? 'rgba(26, 86, 240, 0.12)'
        : (cell.classList.contains('empty-cell') ? 'rgba(255,255,255,0.02)' : '');
      cell.style.outline = isSelected ? '2px solid #1a56f0' : '';
      cell.style.outlineOffset = isSelected ? '-2px' : '';
      // Sentinel class for cross-module state awareness (read by SuperGridSelect)
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
   * Uses ordered row/col keys from _lastCells to determine the rectangle bounds.
   */
  private _getRectangularRangeCardIds(
    anchor: { rowKey: string; colKey: string },
    target: { rowKey: string; colKey: string }
  ): string[] {
    const colField = this._lastColAxes[0]?.field ?? 'card_type';
    const rowField = this._lastRowAxes[0]?.field ?? 'folder';

    const colKeys = [...new Set(this._lastCells.map(c => String(c[colField] ?? 'unknown')))];
    const rowKeys = [...new Set(this._lastCells.map(c => String(c[rowField] ?? 'None')))];

    const r1 = Math.min(rowKeys.indexOf(anchor.rowKey), rowKeys.indexOf(target.rowKey));
    const r2 = Math.max(rowKeys.indexOf(anchor.rowKey), rowKeys.indexOf(target.rowKey));
    const c1 = Math.min(colKeys.indexOf(anchor.colKey), colKeys.indexOf(target.colKey));
    const c2 = Math.max(colKeys.indexOf(anchor.colKey), colKeys.indexOf(target.colKey));

    if (r1 < 0 || c1 < 0) return []; // anchor/target not in current data

    const cardIds: string[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const key = `${rowKeys[r]}\x1f${colKeys[c]}`;
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
    const allActiveFields = [...colAxes, ...rowAxes].map(a => a.field);
    const hasTimeAxis = allActiveFields.some(f => ALLOWED_COL_TIME_FIELDS.has(f));

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
    pills.forEach(pill => {
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
        pill.style.background = 'rgba(26, 86, 240, 0.15)';
        pill.style.fontWeight = '600';
      } else {
        pill.classList.remove('active');
        pill.style.background = 'var(--sg-header-bg,#f0f0f0)';
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
        badge.style.cssText = 'font-size:11px;color:rgba(128,128,128,0.8);padding:2px 6px;border-radius:10px;background:rgba(128,128,128,0.1);';
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
    rowAxes: AxisMapping[]
  ): import('../providers/types').TimeGranularity | null {
    // Find first time field among all active axes
    const allAxes = [...colAxes, ...rowAxes];
    const timeField = allAxes.find(a => ALLOWED_COL_TIME_FIELDS.has(a.field))?.field;
    if (!timeField) return null; // no time axis

    // Collect all raw date strings from cells for this time field.
    // When granularity is null (first mount), values are raw ISO strings (e.g., '2026-03-05').
    // When granularity is already set (subsequent renders), values are strftime-bucketed
    // (e.g., '2026-03' for month) — parseDateString will return null for these, so
    // _computeSmartHierarchy returns null and setGranularity is NOT called (correct behavior:
    // granularity is already set, nothing to auto-detect).
    const rawValues = cells
      .map(c => String(c[timeField] ?? ''))
      .filter(v => v.length > 0);

    const parsed = rawValues
      .map(parseDateString)
      .filter((d): d is Date => d !== null);

    if (parsed.length === 0) return null; // no parseable dates

    const minDate = new Date(Math.min(...parsed.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...parsed.map(d => d.getTime())));

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
    const timeField = allAxes.find(a => ALLOWED_COL_TIME_FIELDS.has(a.field))?.field;
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

  private _createColHeaderCell(cell: HeaderCell, gridRow: number, axisField: string, axisIndex: number, aggregateCount?: number): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'col-header';
    el.dataset['level'] = String(cell.level);
    el.dataset['value'] = cell.value;
    // PLSH-05: data-axis-field enables contextmenu event delegation to identify which field was right-clicked
    el.dataset['axisField'] = axisField;

    // CSS Grid positioning: +1 because column 1 is the row header area
    el.style.gridRow = `${gridRow}`;
    el.style.gridColumn = `${cell.colStart + 1} / span ${cell.colSpan}`;
    el.style.fontWeight = 'bold';
    el.style.textAlign = 'center';
    el.style.padding = '4px 8px';
    el.style.borderBottom = '2px solid rgba(128,128,128,0.3)';
    el.style.cursor = 'pointer';
    el.style.userSelect = 'none';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    // Sticky column header: sticks to top edge during vertical scroll
    el.style.position = 'sticky';
    el.style.top = '0';
    el.style.zIndex = '2';
    el.style.backgroundColor = 'var(--sg-header-bg, #f0f0f0)';

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
    grip.style.fontSize = '12px';
    grip.style.flexShrink = '0';
    grip.addEventListener('dragstart', (e: DragEvent) => {
      // field = axis field name (e.g. 'card_type'), not the displayed value (e.g. 'note')
      _dragPayload = { field: axisField, sourceDimension: 'col', sourceIndex: axisIndex };
      e.dataTransfer?.setData('text/x-supergrid-axis', '1');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation(); // prevent header collapse click
    });
    el.prepend(grip);

    const label = document.createElement('span');
    label.className = 'col-header-label';
    // Phase 22 Plan 02 (DENS-05): when granularity is active on a time-field axis,
    // show aggregate count in "January (47)" format.
    label.textContent = aggregateCount !== undefined
      ? `${cell.value} (${aggregateCount})`
      : cell.value;
    el.appendChild(label);

    // TIME-04: Apply accent background if this period is selected
    // (Safe because _renderCells() rebuilds all headers from scratch on each call)
    if (ALLOWED_COL_TIME_FIELDS.has(axisField) && this._periodSelection.has(cell.value)) {
      el.style.backgroundColor = 'rgba(0, 150, 136, 0.18)'; // teal accent — distinct from blue card selection
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

      // Plain click: toggle collapse/expand
      if (this._collapsedSet.has(collapseKey)) {
        this._collapsedSet.delete(collapseKey);
      } else {
        this._collapsedSet.add(collapseKey);
      }
      // Re-render from cached cells (no re-query)
      this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes);
    });

    return el;
  }

  /**
   * Wire drop zone listeners for axis transpose (cross-dimension) and reorder (same-dimension).
   *
   * Cross-dimension drop (sourceDimension !== targetDimension):
   *   Removes field from source dimension, appends to target dimension.
   *   Guards: min-1 axis per dimension, no duplicate fields.
   *
   * Same-dimension drop (sourceDimension === targetDimension):
   *   Reorders the axis array by removing from sourceIndex and inserting at targetIndex.
   *   Guard: sourceIndex === targetIndex is a no-op; single-axis dimension is a no-op.
   *   Target index comes from dropZoneEl.dataset['reorderTargetIndex'] (set by test helpers
   *   or by future visual insertion-point calculation).
   *
   * Provider mutation triggers StateCoordinator → _fetchAndRender() automatically.
   */
  private _wireDropZone(dropZoneEl: HTMLElement, targetDimension: 'col' | 'row'): void {
    dropZoneEl.addEventListener('dragover', (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('text/x-supergrid-axis')) {
        e.preventDefault();
        dropZoneEl.classList.add('drag-over');
      }
    });

    dropZoneEl.addEventListener('dragleave', () => {
      dropZoneEl.classList.remove('drag-over');
    });

    dropZoneEl.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      dropZoneEl.classList.remove('drag-over');

      const payload = _dragPayload;
      _dragPayload = null; // clear immediately after reading

      if (!payload) return;

      const { colAxes, rowAxes } = this._provider.getStackedGroupBySQL();

      // ---------------------------------------------------------------------------
      // Same-dimension reorder (DYNM-03)
      // ---------------------------------------------------------------------------
      if (payload.sourceDimension === targetDimension) {
        const axes = targetDimension === 'col' ? colAxes : rowAxes;

        // Guard: single-axis dimension can't reorder
        if (axes.length <= 1) return;

        // Determine target insertion index.
        // Tests set dataset['reorderTargetIndex'] on the drop zone; in production
        // this can be computed from pointer position relative to header cells.
        const targetIndexStr = dropZoneEl.dataset['reorderTargetIndex'];
        const targetIndex = targetIndexStr !== undefined ? parseInt(targetIndexStr, 10) : payload.sourceIndex;

        // Guard: same-position drop is a no-op
        if (payload.sourceIndex === targetIndex) return;

        // Guard: out-of-bounds target index
        if (targetIndex < 0 || targetIndex >= axes.length) return;

        // Reorder: remove from sourceIndex, insert at targetIndex
        const newAxes = [...axes];
        const [moved] = newAxes.splice(payload.sourceIndex, 1);
        if (!moved) return;
        newAxes.splice(targetIndex, 0, moved);

        if (targetDimension === 'col') {
          this._provider.setColAxes(newAxes);
        } else {
          this._provider.setRowAxes(newAxes);
        }
        // Clean up the reorder target index hint after use
        delete dropZoneEl.dataset['reorderTargetIndex'];
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
      if (targetAxes.some(a => a.field === payload.field)) return;

      // Commit: remove from source, append to target (preserving direction)
      const movedAxis = sourceAxes.find(a => a.field === payload.field);
      if (!movedAxis) return;

      const newSource = sourceAxes.filter(a => a.field !== payload.field);
      const newTarget = [...targetAxes, { field: payload.field, direction: movedAxis.direction }];

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
        const hasTimeField = allNewAxes.some(a => ALLOWED_COL_TIME_FIELDS.has(a.field));
        if (!hasTimeField) {
          this._clearPeriodSelection();
        }
      }
      // StateCoordinator subscription fires _fetchAndRender() automatically — do NOT call directly
    });
  }
}
