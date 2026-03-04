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
import type { IView, CardDatum, SuperGridBridgeLike, SuperGridProviderLike, SuperGridFilterLike } from './types';
import type { CellDatum } from '../worker/protocol';
import type { AxisMapping } from '../providers/types';
import {
  buildHeaderCells,
  buildGridTemplateColumns,
  type HeaderCell,
} from './supergrid/SuperStackHeader';

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

  /** Unsubscribe function from coordinator.subscribe() — called in destroy() */
  private _coordinatorUnsub: (() => void) | null = null;

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(
    provider: SuperGridProviderLike,
    filter: SuperGridFilterLike,
    bridge: SuperGridBridgeLike,
    coordinator: { subscribe(cb: () => void): () => void }
  ) {
    this._provider = provider;
    this._filter = filter;
    this._bridge = bridge;
    this._coordinator = coordinator;
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

    // CSS Grid container
    const grid = document.createElement('div');
    grid.className = 'supergrid-container';
    grid.style.display = 'grid';
    grid.style.gap = '1px';

    root.appendChild(grid);
    container.appendChild(root);

    this._rootEl = root;
    this._gridEl = grid;

    // Subscribe to StateCoordinator — re-fetch on any provider change
    this._coordinatorUnsub = this._coordinator.subscribe(() => {
      void this._fetchAndRender();
    });

    // Fire initial query immediately
    void this._fetchAndRender();
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
  }

  // ---------------------------------------------------------------------------
  // Private — fetch and render pipeline
  // ---------------------------------------------------------------------------

  /**
   * Fetch data from WorkerBridge and render.
   * Reads axes from provider, compiles filter, calls bridge.superGridQuery().
   * On success: calls _renderCells(). On error: calls _showError().
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

    try {
      const cells = await this._bridge.superGridQuery({ colAxes, rowAxes, where, params });
      // Check if destroyed while waiting for response
      if (!this._gridEl) return;
      this._lastCells = cells;
      this._lastColAxes = colAxes;
      this._lastRowAxes = rowAxes;
      this._renderCells(cells, colAxes, rowAxes);
    } catch (err) {
      if (!this._gridEl) return;
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
      corner.style.backgroundColor = 'rgba(0,0,0,0.05)';
      grid.appendChild(corner);

      for (const cell of levelCells) {
        const el = this._createColHeaderCell(cell, gridRow);
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
      rowHeaderEl.textContent = rowCell.value;
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
        el.style.padding = '4px';
        el.style.borderBottom = '1px solid rgba(128,128,128,0.1)';
        el.style.borderRight = '1px solid rgba(128,128,128,0.1)';
        el.style.minHeight = '40px';

        if (d.count === 0) {
          el.classList.add('empty-cell');
          el.style.backgroundColor = 'rgba(255,255,255,0.02)';
          el.innerHTML = '';
        } else {
          el.classList.remove('empty-cell');
          el.style.backgroundColor = '';
          el.innerHTML = `<span class="count-badge" style="font-size:12px;font-weight:bold;">${d.count}</span>`;
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _createColHeaderCell(cell: HeaderCell, gridRow: number): HTMLDivElement {
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

    if (cell.isCollapsed) {
      el.style.opacity = '0.6';
    }

    el.textContent = cell.value;

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
}
