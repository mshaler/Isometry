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
import type { AxisMapping } from '../providers/types';
import {
  buildHeaderCells,
  buildGridTemplateColumns,
  type HeaderCell,
} from './supergrid/SuperStackHeader';
import { SuperZoom } from './supergrid/SuperZoom';
import { SuperGridSizer } from './supergrid/SuperGridSizer';
import { SuperGridBBoxCache } from './supergrid/SuperGridBBoxCache';
import { SuperGridSelect, classifyClickZone } from './supergrid/SuperGridSelect';

// ---------------------------------------------------------------------------
// Default no-op SuperGridSelectionLike — used when no selectionAdapter injected
// ---------------------------------------------------------------------------

/** A no-op selection adapter used as default when none is injected. */
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

  /** Set of 'level:value' keys for collapsed header groups */
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

    // Granularity label
    const granLabel = document.createElement('label');
    granLabel.textContent = 'Group by:';
    granLabel.style.fontWeight = '500';
    granLabel.style.opacity = '0.7';

    // Granularity <select> — direct jump picker (CONTEXT.md: "NOT sequential cycling")
    const granSelect = document.createElement('select');
    granSelect.className = 'granularity-picker';
    granSelect.style.cssText = 'font-size:11px;padding:2px 4px;border:1px solid rgba(128,128,128,0.3);borderRadius:4px;background:var(--sg-header-bg,#f0f0f0);cursor:pointer;';

    // None option = null granularity (no time hierarchy collapse)
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'None';
    granSelect.appendChild(noneOpt);

    // Day, week, month, quarter, year options
    const granOptions: Array<{ value: string; label: string }> = [
      { value: 'day', label: 'Day' },
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
      { value: 'quarter', label: 'Quarter' },
      { value: 'year', label: 'Year' },
    ];
    for (const opt of granOptions) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      granSelect.appendChild(el);
    }

    // Sync select to current density state
    const currentGranularity = this._densityProvider.getState().axisGranularity;
    granSelect.value = currentGranularity ?? '';

    // On granularity change: call setGranularity on density provider
    // This triggers StateCoordinator → hybrid routing → _fetchAndRender() for re-query
    granSelect.addEventListener('change', () => {
      const value = granSelect.value;
      this._densityProvider.setGranularity(value === '' ? null : value as import('../providers/types').TimeGranularity);
    });

    toolbar.appendChild(granLabel);
    toolbar.appendChild(granSelect);

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
        this._selectionAdapter.clear();
      }
    };
    document.addEventListener('keydown', this._boundEscapeHandler);

    // Subscribe to selection changes → update visuals + badge
    this._selectionUnsub = this._selectionAdapter.subscribe(() => {
      this._updateSelectionVisuals();
    });

    // Fire initial query and restore position after render completes
    void this._fetchAndRender().then(() => {
      // Mark initial mount complete BEFORE restoring position.
      // Subsequent _fetchAndRender calls from coordinator will now reset scroll.
      this._isInitialMount = false;
      if (this._rootEl) {
        this._positionProvider.restorePosition(this._rootEl);
      }

      // Attach SuperGridSelect lasso overlay (after first render so grid has content)
      this._sgSelect.attach(
        root,
        grid,
        this._bboxCache,
        this._selectionAdapter,
        (cellKey) => this._getCellCardIds(cellKey)
      );
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

    // Remove DOM — _rootEl contains toolbar, grid, and all children
    if (this._rootEl && this._rootEl.parentElement) {
      this._rootEl.parentElement.removeChild(this._rootEl);
    }
    this._rootEl = null;
    this._gridEl = null;
    this._densityToolbarEl = null;
    this._hiddenIndicatorEl = null;

    // Clear internal state
    this._collapsedSet = new Set();
    this._lastCells = [];
    this._lastColAxes = [];
    this._lastRowAxes = [];
    this._isInitialMount = true;
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
      });
      // Check if destroyed while waiting for response
      if (!this._gridEl) return;
      this._lastCells = cells;
      this._lastColAxes = colAxes;
      this._lastRowAxes = rowAxes;
      this._renderCells(cells, colAxes, rowAxes);

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
        _dragPayload = { field: rowAxisField, sourceDimension: 'row', sourceIndex: rowIdx };
        e.dataTransfer?.setData('text/x-supergrid-axis', '1');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
      });
      rowHeaderEl.appendChild(rowGrip);

      const rowLabel = document.createElement('span');
      rowLabel.textContent = rowCell.value;
      rowHeaderEl.appendChild(rowLabel);

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
    }

    const cellPlacements: CellPlacement[] = [];
    for (const rowCell of visibleRowCells) {
      const rowVal = rowCell.value;
      for (const colCell of leafColCells) {
        const colVal = colCell.value;
        // Find matching cell from bridge response
        const matchingCell = cells.find(
          c => String(c[colField] ?? 'unknown') === colVal && String(c[rowField] ?? 'None') === rowVal
        );
        cellPlacements.push({
          rowKey: rowVal,
          colKey: colVal,
          count: matchingCell?.count ?? 0,
          cardIds: matchingCell?.card_ids ?? [],
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
      .data(cellPlacements, d => `${d.rowKey}:${d.colKey}`)
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
        el.dataset['key'] = `${d.rowKey}:${d.colKey}`;
        // data-col-key enables auto-fit dblclick to measure column content width (SIZE-02)
        el.dataset['colKey'] = d.colKey;

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
          // Spreadsheet mode (DENS-03): card pills per card_id in cell
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
        } else {
          // -----------------------------------------------------------------
          // Matrix mode (DENS-03): count number + d3.interpolateBlues heat map
          // -----------------------------------------------------------------
          el.classList.remove('empty-cell');
          const heatColor = heatScale(d.count);
          el.style.backgroundColor = heatColor;
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.padding = 'calc(4px * var(--sg-zoom, 1))';
          // Use light text for dark backgrounds (high-count cells)
          const textColor = d.count > maxCount * 0.6 ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';
          el.innerHTML = `<span class="count-badge" style="font-size:calc(12px * var(--sg-zoom, 1));font-weight:bold;color:${textColor};">${d.count}</span>`;
        }

        // Phase 21 — click handler for cell selection (SLCT-01/02/03)
        // Uses `self` (class instance) because `this` inside D3.each() is the DOM element
        el.onclick = (e: MouseEvent) => {
          const zone = classifyClickZone(e.target);
          if (zone !== 'data-cell') return;

          const cellKey = `${d.rowKey}:${d.colKey}`;
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
  // Phase 21 — Selection helpers
  // ---------------------------------------------------------------------------

  /**
   * Get card_ids for a cell key from _lastCells cache.
   * cellKey format: "rowKey:colKey" (matches el.dataset['key']).
   */
  private _getCellCardIds(cellKey: string): string[] {
    const colField = this._lastColAxes[0]?.field ?? 'card_type';
    const rowField = this._lastRowAxes[0]?.field ?? 'folder';
    const sepIdx = cellKey.indexOf(':');
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
        const key = `${rowKeys[r]}:${colKeys[c]}`;
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
    // Only the granularity picker label+select are hidden when no time field is on an active axis.
    this._densityToolbarEl.style.display = 'flex';

    // Check if any active axis is a time field (for granularity picker visibility)
    const allActiveFields = [...colAxes, ...rowAxes].map(a => a.field);
    const hasTimeAxis = allActiveFields.some(f => ALLOWED_COL_TIME_FIELDS.has(f));

    // Show/hide granularity picker (DENS-01: hidden when no time field on any axis)
    const granLabel = this._densityToolbarEl.querySelector<HTMLLabelElement>('label:has(.granularity-picker)');
    const granSelect = this._densityToolbarEl.querySelector<HTMLSelectElement>('.granularity-picker');
    if (granSelect) {
      granSelect.style.display = hasTimeAxis ? '' : 'none';
    }
    if (granLabel) {
      granLabel.style.display = hasTimeAxis ? '' : 'none';
    }

    // Sync granularity picker to current density state (in case state changed externally)
    if (granSelect) {
      const currentGran = this._densityProvider.getState().axisGranularity;
      granSelect.value = currentGran ?? '';
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

  private _createColHeaderCell(cell: HeaderCell, gridRow: number, axisField: string, axisIndex: number, aggregateCount?: number): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'col-header';
    el.dataset['level'] = String(cell.level);
    el.dataset['value'] = cell.value;

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
    // Phase 22 Plan 02 (DENS-05): when granularity is active on a time-field axis,
    // show aggregate count in "January (47)" format.
    label.textContent = aggregateCount !== undefined
      ? `${cell.value} (${aggregateCount})`
      : cell.value;
    el.appendChild(label);

    // Click handler: Cmd+click = select all under this column header (SLCT-05),
    //                plain click = collapse/expand header
    const collapseKey = `${cell.level}:${cell.value}`;
    el.addEventListener('click', (e: MouseEvent) => {
      // Phase 21: Cmd+click selects all cards under this column header
      if (e.metaKey || e.ctrlKey) {
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
      // StateCoordinator subscription fires _fetchAndRender() automatically — do NOT call directly
    });
  }
}
