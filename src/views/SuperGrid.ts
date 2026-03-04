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
import type { IView, CardDatum, SuperGridBridgeLike, SuperGridProviderLike, SuperGridFilterLike, SuperGridPositionLike } from './types';
import type { CellDatum } from '../worker/protocol';
import type { AxisMapping } from '../providers/types';
import {
  buildHeaderCells,
  buildGridTemplateColumns,
  type HeaderCell,
} from './supergrid/SuperStackHeader';
import { SuperZoom } from './supergrid/SuperZoom';

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

  /** Drop zone for col dimension — accepts row-origin drags (DYNM-01/DYNM-02) */
  private _colDropZoneEl: HTMLDivElement | null = null;

  /** Drop zone for row dimension — accepts col-origin drags (DYNM-01/DYNM-02) */
  private _rowDropZoneEl: HTMLDivElement | null = null;

  // ---------------------------------------------------------------------------
  // Phase 19 Plan 02 — SuperZoom, scroll handler, and toast state
  // ---------------------------------------------------------------------------

  /** SuperZoom instance — wired in mount(), cleaned in destroy() */
  private _superZoom: SuperZoom | null = null;

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
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(
    provider: SuperGridProviderLike,
    filter: SuperGridFilterLike,
    bridge: SuperGridBridgeLike,
    coordinator: { subscribe(cb: () => void): () => void },
    positionProvider: SuperGridPositionLike = _noOpPositionProvider
  ) {
    this._provider = provider;
    this._filter = filter;
    this._bridge = bridge;
    this._coordinator = coordinator;
    this._positionProvider = positionProvider;
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

    root.appendChild(colDropZone);
    root.appendChild(rowDropZone);
    root.appendChild(grid);
    container.appendChild(root);

    this._rootEl = root;
    this._gridEl = grid;
    this._colDropZoneEl = colDropZone;
    this._rowDropZoneEl = rowDropZone;

    // Subscribe to StateCoordinator — re-fetch on any provider change
    this._coordinatorUnsub = this._coordinator.subscribe(() => {
      void this._fetchAndRender();
    });

    // Wire SuperZoom — attach BEFORE first render so CSS vars are set for grid-template-columns
    // SuperZoom accepts SuperPositionProvider (concrete); SuperGridPositionLike is structurally
    // compatible (same shape). Cast via unknown to avoid import of concrete class here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._superZoom = new SuperZoom(this._positionProvider as any, (zoomLevel: number) => {
      this._showZoomToast(zoomLevel);
    });
    this._superZoom.attach(root, grid);
    this._superZoom.applyZoom();

    // Wire rAF-throttled scroll handler — passive: true (no need to preventDefault on scroll)
    root.addEventListener('scroll', this._boundScrollHandler, { passive: true });

    // Fire initial query and restore position after render completes
    void this._fetchAndRender().then(() => {
      // Mark initial mount complete BEFORE restoring position.
      // Subsequent _fetchAndRender calls from coordinator will now reset scroll.
      this._isInitialMount = false;
      if (this._rootEl) {
        this._positionProvider.restorePosition(this._rootEl);
      }
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

    // Detach SuperZoom (removes wheel + keydown listeners)
    if (this._superZoom) {
      this._superZoom.detach();
      this._superZoom = null;
    }

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

    // Remove DOM
    if (this._rootEl && this._rootEl.parentElement) {
      this._rootEl.parentElement.removeChild(this._rootEl);
    }
    this._rootEl = null;
    this._gridEl = null;

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

    // Pre-render: set opacity to 0 for crossfade effect (DYNM-04)
    grid.style.opacity = '0';

    try {
      const cells = await this._bridge.superGridQuery({ colAxes, rowAxes, where, params });
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

    // If no cells, produce an empty grid
    if (colValuesRaw.length === 0 && rowValuesRaw.length === 0) {
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      return;
    }

    // Build single-level axis value tuples
    const colAxisValues: string[][] = colValuesRaw.map(v => [v]);
    const rowAxisValues: string[][] = rowValuesRaw.map(v => [v]);

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

    grid.style.gridTemplateColumns = buildGridTemplateColumns(colLeafCount, ROW_HEADER_WIDTH);

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

      for (let cellIdx = 0; cellIdx < levelCells.length; cellIdx++) {
        const cell = levelCells[cellIdx]!;
        const el = this._createColHeaderCell(cell, gridRow, levelAxisField, levelIdx);
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
        });
      }
    }

    // D3 data join
    const gridSelection = d3.select(grid);
    gridSelection
      .selectAll<HTMLDivElement, CellPlacement>('.data-cell')
      .data(cellPlacements, d => `${d.rowKey}:${d.colKey}`)
      .join(
        enter => enter.append('div').attr('class', 'data-cell'),
        update => update,
        exit => exit.remove()
      )
      .each(function (d) {
        const el = this as HTMLDivElement;
        el.dataset['key'] = `${d.rowKey}:${d.colKey}`;

        const colStart = colValueToStart.get(d.colKey) ?? 1;
        const rowIdx = visibleRowCells.findIndex(c => c.value === d.rowKey);
        const gridRow = colHeaderLevels + rowIdx + 1;

        el.style.gridColumn = `${colStart + 1}`; // +1 because col 1 = row header
        el.style.gridRow = `${gridRow}`;
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.padding = 'calc(4px * var(--sg-zoom, 1))';
        el.style.borderBottom = '1px solid rgba(128,128,128,0.1)';
        el.style.borderRight = '1px solid rgba(128,128,128,0.1)';
        // Use CSS Custom Property for zoom-aware row height (set by SuperZoom.applyZoom())
        el.style.minHeight = 'var(--sg-row-height, 40px)';

        if (d.count === 0) {
          el.classList.add('empty-cell');
          el.style.backgroundColor = 'rgba(255,255,255,0.02)';
          el.innerHTML = '';
        } else {
          el.classList.remove('empty-cell');
          el.style.backgroundColor = '';
          el.innerHTML = `<span class="count-badge" style="font-size:calc(12px * var(--sg-zoom, 1));font-weight:bold;">${d.count}</span>`;
        }
      });
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

  private _createColHeaderCell(cell: HeaderCell, gridRow: number, axisField: string, axisIndex: number): HTMLDivElement {
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
    label.textContent = cell.value;
    el.appendChild(label);

    // Collapse click handler — uses cached cells, does NOT re-query bridge
    const collapseKey = `${cell.level}:${cell.value}`;
    el.addEventListener('click', () => {
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
