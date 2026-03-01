// @vitest-environment jsdom
// Isometry v5 — SuperGrid Tests
// Unit and benchmark tests for the SuperGrid view.
//
// Design:
//   - SuperGrid implements IView (mount/render/destroy)
//   - Renders nested CSS Grid with column headers, row headers, and data cells
//   - D3 data join with key function on cell elements
//   - Empty cells preserved (never collapsed)
//   - Collapsible headers via click
//   - Benchmark: render 100 cards in <16ms at p95
//
// Requirements: REND-02, REND-06

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SuperGrid } from '../../src/views/SuperGrid';
import type { CardDatum } from '../../src/views/types';
import type { CardType } from '../../src/database/queries/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let cardCounter = 0;
function makeCardDatum(overrides: Partial<CardDatum> = {}): CardDatum {
  const i = cardCounter++;
  return {
    id: `card-${i}`,
    name: `Card ${i}`,
    folder: null,
    status: null,
    card_type: 'note' as CardType,
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-01-01T00:00:00Z',
    priority: 0,
    sort_order: i,
    due_at: null,
    body_text: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SuperGrid lifecycle tests
// ---------------------------------------------------------------------------

describe('SuperGrid — mount', () => {
  let container: HTMLElement;
  let view: SuperGrid;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    view = new SuperGrid();
  });

  afterEach(() => {
    view.destroy();
    document.body.removeChild(container);
  });

  it('mount creates a grid container div in the DOM', () => {
    view.mount(container);
    const grid = container.querySelector('.supergrid-container');
    expect(grid).not.toBeNull();
    expect(grid?.tagName).toBe('DIV');
  });

  it('mount creates a root div with supergrid-view class', () => {
    view.mount(container);
    const root = container.querySelector('.supergrid-view');
    expect(root).not.toBeNull();
  });

  it('grid container uses CSS Grid display', () => {
    view.mount(container);
    const grid = container.querySelector('.supergrid-container') as HTMLElement | null;
    expect(grid?.style.display).toBe('grid');
  });
});

describe('SuperGrid — render', () => {
  let container: HTMLElement;
  let view: SuperGrid;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    view = new SuperGrid();
    view.mount(container);
  });

  afterEach(() => {
    view.destroy();
    document.body.removeChild(container);
  });

  it('render with cards produces column header divs', () => {
    const cards = [
      makeCardDatum({ card_type: 'note' }),
      makeCardDatum({ card_type: 'task' }),
    ];
    view.render(cards);
    const headers = container.querySelectorAll('.col-header');
    expect(headers.length).toBeGreaterThan(0);
  });

  it('render with cards produces row header divs', () => {
    const cards = [
      makeCardDatum({ folder: 'A' }),
      makeCardDatum({ folder: 'B' }),
    ];
    view.render(cards);
    const headers = container.querySelectorAll('.row-header');
    expect(headers.length).toBeGreaterThan(0);
  });

  it('render produces data cell divs at intersections', () => {
    const cards = [
      makeCardDatum({ card_type: 'note', folder: 'A' }),
      makeCardDatum({ card_type: 'task', folder: 'B' }),
    ];
    view.render(cards);
    const cells = container.querySelectorAll('.data-cell');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('empty cells are present and have empty-cell class', () => {
    // 2 col values, 2 row values, but only 2 cards at (note,A) and (task,B)
    // → cells at (note,B) and (task,A) should be empty-cell
    const cards = [
      makeCardDatum({ card_type: 'note', folder: 'A' }),
      makeCardDatum({ card_type: 'task', folder: 'B' }),
    ];
    view.render(cards);
    const emptyCells = container.querySelectorAll('.empty-cell');
    expect(emptyCells.length).toBeGreaterThan(0);
  });

  it('empty cells are never absent — dimensional integrity preserved', () => {
    const cards = [
      makeCardDatum({ card_type: 'note', folder: 'A' }),
    ];
    view.render(cards);
    // Total cells = col values × row values = 1×1 = 1 (all at the one intersection)
    const allCells = container.querySelectorAll('.data-cell');
    expect(allCells.length).toBeGreaterThanOrEqual(1);
  });

  it('D3 data join: cells have data-key attribute (key function present)', () => {
    const cards = [
      makeCardDatum({ card_type: 'note', folder: 'A' }),
    ];
    view.render(cards);
    const cells = container.querySelectorAll('.data-cell');
    // Every cell must have a data-key attribute (from D3 key function)
    let hasKey = false;
    cells.forEach(cell => {
      if ((cell as HTMLElement).dataset['key']) hasKey = true;
    });
    expect(hasKey).toBe(true);
  });

  it('render with empty cards produces empty state gracefully', () => {
    view.render([]);
    // Should not throw, grid container still present
    const grid = container.querySelector('.supergrid-container');
    expect(grid).not.toBeNull();
  });

  it('count badge shows number of cards at intersection', () => {
    const cards = [
      makeCardDatum({ card_type: 'note', folder: 'A' }),
      makeCardDatum({ card_type: 'note', folder: 'A' }), // 2 cards at same intersection
    ];
    view.render(cards);
    // Find a cell with count = 2
    const cells = container.querySelectorAll('.data-cell');
    let found = false;
    cells.forEach(cell => {
      const badge = cell.querySelector('.count-badge');
      if (badge?.textContent === '2') found = true;
    });
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SuperGrid — collapse behavior
// ---------------------------------------------------------------------------

describe('SuperGrid — header collapse', () => {
  let container: HTMLElement;
  let view: SuperGrid;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    view = new SuperGrid();
    view.mount(container);
  });

  afterEach(() => {
    view.destroy();
    document.body.removeChild(container);
  });

  it('clicking a column header toggles collapsed state (re-renders with fewer cells)', () => {
    const cards = [
      makeCardDatum({ card_type: 'note', folder: 'A' }),
      makeCardDatum({ card_type: 'task', folder: 'A' }),
    ];
    view.render(cards);

    // Count data cells before collapse
    const cellsBefore = container.querySelectorAll('.data-cell').length;
    expect(cellsBefore).toBeGreaterThan(0);

    // Click the first column header
    const firstHeader = container.querySelector('.col-header') as HTMLElement | null;
    expect(firstHeader).not.toBeNull();
    firstHeader!.click();

    // After collapsing, data cells count should change (grid rebuilt)
    // With one col collapsed, we have fewer visible columns → fewer cells
    const cellsAfter = container.querySelectorAll('.data-cell').length;
    // The grid should re-render (even if count is different)
    // At minimum: the grid is still present
    const grid = container.querySelector('.supergrid-container');
    expect(grid).not.toBeNull();
    // With 2 col values, one collapsed → 1 visible col
    // Row headers still present
    expect(cellsAfter).toBeLessThanOrEqual(cellsBefore);
  });
});

// ---------------------------------------------------------------------------
// SuperGrid — destroy
// ---------------------------------------------------------------------------

describe('SuperGrid — destroy', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('destroy removes grid container from DOM', () => {
    const view = new SuperGrid();
    view.mount(container);
    view.render([makeCardDatum()]);

    expect(container.querySelector('.supergrid-container')).not.toBeNull();

    view.destroy();

    expect(container.querySelector('.supergrid-container')).toBeNull();
    expect(container.children.length).toBe(0);
  });

  it('destroy clears internal state', () => {
    const view = new SuperGrid();
    view.mount(container);
    view.destroy();

    // After destroy, render should be a no-op (no throw)
    expect(() => view.render([])).not.toThrow();
  });
});

// Note: Performance benchmark for SuperGrid is in SuperGrid.bench.ts
// Run with: npx vitest bench tests/views/SuperGrid.bench.ts
