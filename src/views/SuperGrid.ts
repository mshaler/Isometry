// Isometry v5 — Phase 7 SuperGrid
// Nested dimensional header view with CSS Grid layout and collapsible header groups.
//
// Design:
//   - Implements IView (mount/render/destroy)
//   - Renders nested column headers using CSS grid-column: span N (via buildHeaderCells)
//   - Default: column axis = card_type, row axis = folder
//   - In-memory card grouping from coordinator-supplied cards array
//   - D3 data join with key function on every .data() call (VIEW-09 requirement)
//   - Empty cells rendered at every intersection (dimensional integrity)
//   - Collapsible headers: click to toggle, rebuilds grid
//   - Performance budget: <16ms for 100 visible cards
//
// Requirements: REND-02, REND-05, REND-06

import * as d3 from 'd3';
import type { IView, CardDatum } from './types';
import {
  buildHeaderCells,
  buildGridTemplateColumns,
  type HeaderCell,
} from './supergrid/SuperStackHeader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CellDatum {
  rowKey: string;
  colKey: string;
  count: number;
  cards: CardDatum[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Default axis fields when no PAFVProvider is supplied
const DEFAULT_COL_FIELD = 'card_type';
const DEFAULT_ROW_FIELD = 'folder';

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
 * Lifecycle:
 *   1. mount(container) — creates root div.supergrid-view and inner div.supergrid-container
 *   2. render(cards) — builds axis values, calls buildHeaderCells, renders CSS Grid
 *   3. destroy() — removes DOM, clears state
 */
export class SuperGrid implements IView {
  /** Set of 'level:value' keys for collapsed header groups */
  private collapsedSet: Set<string> = new Set();

  /** Root wrapper element */
  private rootEl: HTMLDivElement | null = null;

  /** CSS Grid container — grid-template-columns set dynamically */
  private gridEl: HTMLDivElement | null = null;

  /** Last rendered cards — used for re-render on collapse toggle */
  private lastCards: CardDatum[] = [];

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

    this.rootEl = root;
    this.gridEl = grid;
  }

  render(cards: CardDatum[]): void {
    const grid = this.gridEl;
    if (!grid) return;

    this.lastCards = cards;

    if (cards.length === 0) {
      // Empty state: clear grid
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      return;
    }

    // ---------------------------------------------------------------------------
    // Step 1: Extract distinct axis values from card data
    // ---------------------------------------------------------------------------

    // Column axis: card_type
    const colValuesRaw = [...new Set(cards.map(c => c[DEFAULT_COL_FIELD] ?? 'unknown'))].sort();
    // Row axis: folder
    const rowValuesRaw = [...new Set(cards.map(c => c[DEFAULT_ROW_FIELD] ?? 'None'))].sort();

    // Build single-level axis value tuples (each is a [value] tuple)
    const colAxisValues: string[][] = colValuesRaw.map(v => [String(v)]);
    const rowAxisValues: string[][] = rowValuesRaw.map(v => [String(v)]);

    // ---------------------------------------------------------------------------
    // Step 2: Compute headers via buildHeaderCells
    // ---------------------------------------------------------------------------

    const { headers: colHeaders, leafCount: colLeafCount } = buildHeaderCells(
      colAxisValues,
      this.collapsedSet
    );
    const { headers: rowHeaders, leafCount: rowLeafCount } = buildHeaderCells(
      rowAxisValues,
      this.collapsedSet
    );

    // ---------------------------------------------------------------------------
    // Step 3: Set grid-template-columns
    // ---------------------------------------------------------------------------

    // Grid layout:
    //   Column 1: row-header area (ROW_HEADER_WIDTH px)
    //   Columns 2+: leaf data columns
    grid.style.gridTemplateColumns = buildGridTemplateColumns(colLeafCount, ROW_HEADER_WIDTH);

    // Grid rows:
    //   Rows 1..(colHeaders.length): column header levels
    //   Rows (colHeaders.length+1)..(colHeaders.length+rowLeafCount): data rows
    const colHeaderLevels = colHeaders.length;
    const totalRows = colHeaderLevels + rowLeafCount;

    // Each row is auto height; set grid-template-rows for clarity
    grid.style.gridTemplateRows = Array(totalRows).fill('auto').join(' ');

    // ---------------------------------------------------------------------------
    // Step 4: Render column headers
    // ---------------------------------------------------------------------------

    // Clear grid
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    // For each column header level, render cells
    for (let levelIdx = 0; levelIdx < colHeaders.length; levelIdx++) {
      const levelCells = colHeaders[levelIdx] ?? [];
      const gridRow = levelIdx + 1;

      // Corner cell for this row (row header area — top-left corner)
      const corner = document.createElement('div');
      corner.className = 'corner-cell';
      corner.style.gridRow = `${gridRow}`;
      corner.style.gridColumn = '1';
      corner.style.backgroundColor = 'rgba(0,0,0,0.05)';
      grid.appendChild(corner);

      // Render column header cells for this level
      for (const cell of levelCells) {
        const el = this.createColHeaderCell(cell, gridRow);
        grid.appendChild(el);
      }
    }

    // ---------------------------------------------------------------------------
    // Step 5: Render row headers and data cells
    // ---------------------------------------------------------------------------

    // Build visible row values (accounting for any collapsed row headers)
    // For single-level rows, rowHeaders[0] contains all visible row header cells
    const visibleRowCells: HeaderCell[] = rowHeaders[0] ?? [];

    // Build index of visible column values from colHeaders (leaf level = last level)
    const leafColCells: HeaderCell[] = colHeaders[colHeaders.length - 1] ?? [];

    // For single-level axes: leaf cells == all column header cells
    // Map column value → colStart for cell placement
    const colValueToStart = new Map<string, number>();
    for (const cell of leafColCells) {
      colValueToStart.set(cell.value, cell.colStart);
    }

    // Precompute cell data with D3 key function
    const cellData: CellDatum[] = [];
    for (const rowCell of visibleRowCells) {
      const rowVal = rowCell.value;
      for (const colCell of leafColCells) {
        const colVal = colCell.value;
        const matchingCards = cards.filter(
          c =>
            String(c[DEFAULT_COL_FIELD] ?? 'unknown') === colVal &&
            String(c[DEFAULT_ROW_FIELD] ?? 'None') === rowVal
        );
        cellData.push({
          rowKey: rowVal,
          colKey: colVal,
          count: matchingCards.length,
          cards: matchingCards,
        });
      }
    }

    // Render row headers and data cells row by row
    for (let rowIdx = 0; rowIdx < visibleRowCells.length; rowIdx++) {
      const rowCell = visibleRowCells[rowIdx]!;
      const gridRow = colHeaderLevels + rowIdx + 1;

      // Row header cell
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

    // Render data cells using D3 data join with key function
    const gridSelection = d3.select(grid);

    gridSelection
      .selectAll<HTMLDivElement, CellDatum>('.data-cell')
      .data(cellData, d => `${d.rowKey}:${d.colKey}`)
      .join(
        enter => {
          return enter.append('div').attr('class', 'data-cell');
        },
        update => update,
        exit => exit.remove()
      )
      .each(function (d) {
        const el = this as HTMLDivElement;
        // Set data-key for test verification of D3 key function
        el.dataset['key'] = `${d.rowKey}:${d.colKey}`;

        // Find grid position
        const colStart = colValueToStart.get(d.colKey) ?? 1;
        // Find row position: rowIdx for this rowKey
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
          // Empty cell
          el.classList.add('empty-cell');
          el.style.backgroundColor = 'rgba(255,255,255,0.02)';
          el.innerHTML = '';
        } else {
          el.classList.remove('empty-cell');
          el.style.backgroundColor = '';
          // Count badge
          el.innerHTML = `<span class="count-badge" style="font-size:12px;font-weight:bold;">${d.count}</span>`;
        }
      });
  }

  destroy(): void {
    if (this.rootEl && this.rootEl.parentElement) {
      this.rootEl.parentElement.removeChild(this.rootEl);
    }
    this.rootEl = null;
    this.gridEl = null;
    this.collapsedSet = new Set();
    this.lastCards = [];
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private createColHeaderCell(cell: HeaderCell, gridRow: number): HTMLDivElement {
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

    // Collapse click handler
    const collapseKey = `${cell.level}:${cell.value}`;
    el.addEventListener('click', () => {
      if (this.collapsedSet.has(collapseKey)) {
        this.collapsedSet.delete(collapseKey);
      } else {
        this.collapsedSet.add(collapseKey);
      }
      // Re-render with updated collapse state
      this.render(this.lastCards);
    });

    return el;
  }
}
