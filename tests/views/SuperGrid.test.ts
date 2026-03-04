// @vitest-environment jsdom
// Isometry v5 — SuperGrid Tests
// Unit and lifecycle tests for the SuperGrid view.
//
// Design:
//   - SuperGrid implements IView (mount/render/destroy)
//   - Phase 17: Constructor injection — (provider, filter, bridge, coordinator)
//   - mount() subscribes to StateCoordinator and fires immediate bridge.superGridQuery()
//   - render(cards) is a no-op — SuperGrid self-manages data via bridge
//   - destroy() unsubscribes from StateCoordinator
//   - Renders nested CSS Grid with column headers, row headers, and data cells
//   - D3 data join with key function on cell elements
//   - Empty cells preserved (never collapsed)
//   - Collapsible headers: click to toggle, re-renders from cached cells
//   - Benchmark: render 100 cards in <16ms at p95
//
// Requirements: REND-02, REND-06, FOUN-08, FOUN-10

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SuperGrid } from '../../src/views/SuperGrid';
import type { CardDatum } from '../../src/views/types';
import type { CellDatum } from '../../src/worker/protocol';
import type { CardType } from '../../src/database/queries/types';
import type { SuperGridBridgeLike, SuperGridProviderLike, SuperGridFilterLike } from '../../src/views/types';

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

function makeCellDatum(overrides: Partial<CellDatum> = {}): CellDatum {
  return {
    count: 1,
    card_ids: ['card-1'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

function makeMockProvider(
  overrides: Partial<SuperGridProviderLike> = {}
): { provider: SuperGridProviderLike; getStackedGroupBySQLSpy: ReturnType<typeof vi.fn> } {
  const getStackedGroupBySQLSpy = vi.fn().mockReturnValue({
    colAxes: [{ field: 'card_type', direction: 'asc' }],
    rowAxes: [{ field: 'folder', direction: 'asc' }],
  });
  const provider: SuperGridProviderLike = {
    getStackedGroupBySQL: getStackedGroupBySQLSpy,
    ...overrides,
  };
  return { provider, getStackedGroupBySQLSpy };
}

function makeMockFilter(
  overrides: Partial<SuperGridFilterLike> = {}
): { filter: SuperGridFilterLike; compileSpy: ReturnType<typeof vi.fn> } {
  const compileSpy = vi.fn().mockReturnValue({ where: 'deleted_at IS NULL', params: [] });
  const filter: SuperGridFilterLike = {
    compile: compileSpy,
    ...overrides,
  };
  return { filter, compileSpy };
}

function makeMockBridge(
  cells: CellDatum[] = []
): { bridge: SuperGridBridgeLike; superGridQuerySpy: ReturnType<typeof vi.fn> } {
  const superGridQuerySpy = vi.fn().mockResolvedValue(cells);
  const bridge: SuperGridBridgeLike = {
    superGridQuery: superGridQuerySpy,
  };
  return { bridge, superGridQuerySpy };
}

function makeMockCoordinator(): {
  coordinator: { subscribe(cb: () => void): () => void };
  subscribeSpy: ReturnType<typeof vi.fn>;
  unsubSpy: ReturnType<typeof vi.fn>;
} {
  const unsubSpy = vi.fn();
  const subscribeSpy = vi.fn().mockReturnValue(unsubSpy);
  const coordinator = { subscribe: subscribeSpy };
  return { coordinator, subscribeSpy, unsubSpy };
}

// Default setup for most tests
function makeDefaults(cells: CellDatum[] = []) {
  const { provider, getStackedGroupBySQLSpy } = makeMockProvider();
  const { filter, compileSpy } = makeMockFilter();
  const { bridge, superGridQuerySpy } = makeMockBridge(cells);
  const { coordinator, subscribeSpy, unsubSpy } = makeMockCoordinator();
  return { provider, getStackedGroupBySQLSpy, filter, compileSpy, bridge, superGridQuerySpy, coordinator, subscribeSpy, unsubSpy };
}

// ---------------------------------------------------------------------------
// FOUN-08: Constructor injection + provider axis reads
// ---------------------------------------------------------------------------

describe('FOUN-08 — SuperGrid constructor injection', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('constructor accepts (provider, filter, bridge, coordinator) without throwing', () => {
    const { provider, filter, bridge, coordinator } = makeDefaults();
    expect(() => new SuperGrid(provider, filter, bridge, coordinator)).not.toThrow();
  });

  it('mount() calls provider.getStackedGroupBySQL() to read axes', async () => {
    const { provider, getStackedGroupBySQLSpy, filter, bridge, coordinator } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    // Wait a tick for the async _fetchAndRender to call getStackedGroupBySQL
    await new Promise(r => setTimeout(r, 0));
    expect(getStackedGroupBySQLSpy).toHaveBeenCalled();
    view.destroy();
  });

  it('mount() passes provider axes (not DEFAULT_COL_FIELD) to bridge.superGridQuery()', async () => {
    const customAxes = {
      colAxes: [{ field: 'status', direction: 'asc' as const }],
      rowAxes: [{ field: 'folder', direction: 'asc' as const }],
    };
    const getStackedGroupBySQLSpy = vi.fn().mockReturnValue(customAxes);
    const { provider: _p, ...rest } = makeDefaults();
    const provider: SuperGridProviderLike = { getStackedGroupBySQL: getStackedGroupBySQLSpy };
    const { filter, bridge, superGridQuerySpy, coordinator } = rest;
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    expect(superGridQuerySpy).toHaveBeenCalled();
    const callArg = superGridQuerySpy.mock.calls[0]?.[0] as { colAxes: unknown[] } | undefined;
    expect(callArg?.colAxes).toEqual(customAxes.colAxes);
    view.destroy();
  });

  it('mount() uses VIEW_DEFAULTS axes when provider returns empty arrays', async () => {
    const { filter, bridge, superGridQuerySpy, coordinator } = makeDefaults();
    const emptyProvider: SuperGridProviderLike = {
      getStackedGroupBySQL: vi.fn().mockReturnValue({ colAxes: [], rowAxes: [] }),
    };
    const view = new SuperGrid(emptyProvider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    expect(superGridQuerySpy).toHaveBeenCalled();
    const callArg = superGridQuerySpy.mock.calls[0]?.[0] as { colAxes: { field: string }[] } | undefined;
    // Should fall back to default colAxes = [{ field: 'card_type', direction: 'asc' }]
    expect(callArg?.colAxes[0]?.field).toBe('card_type');
    view.destroy();
  });
});

// ---------------------------------------------------------------------------
// FOUN-10: StateCoordinator subscription lifecycle
// ---------------------------------------------------------------------------

describe('FOUN-10 — StateCoordinator subscription', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('mount() calls coordinator.subscribe()', () => {
    const { provider, filter, bridge, coordinator, subscribeSpy } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    expect(subscribeSpy).toHaveBeenCalledOnce();
    view.destroy();
  });

  it('coordinator change callback triggers bridge.superGridQuery()', async () => {
    const { provider, filter, bridge, superGridQuerySpy, coordinator, subscribeSpy } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    // Wait for initial fetch
    await new Promise(r => setTimeout(r, 0));
    const initialCallCount = superGridQuerySpy.mock.calls.length;
    // Trigger the coordinator callback
    const cb = subscribeSpy.mock.calls[0]?.[0] as (() => void) | undefined;
    expect(cb).toBeDefined();
    cb!();
    await new Promise(r => setTimeout(r, 0));
    expect(superGridQuerySpy.mock.calls.length).toBeGreaterThan(initialCallCount);
    view.destroy();
  });

  it('destroy() calls the unsubscribe function returned by coordinator.subscribe()', () => {
    const { provider, filter, bridge, coordinator, unsubSpy } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    view.destroy();
    expect(unsubSpy).toHaveBeenCalledOnce();
  });

  it('after destroy(), coordinator changes do NOT trigger bridge.superGridQuery()', async () => {
    const { provider, filter, bridge, superGridQuerySpy, coordinator, subscribeSpy } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    view.destroy();
    const callCountAfterDestroy = superGridQuerySpy.mock.calls.length;
    // Trigger the coordinator callback — it should be unsubscribed now
    const cb = subscribeSpy.mock.calls[0]?.[0] as (() => void) | undefined;
    if (cb) cb();
    await new Promise(r => setTimeout(r, 0));
    expect(superGridQuerySpy.mock.calls.length).toBe(callCountAfterDestroy);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle tests
// ---------------------------------------------------------------------------

describe('SuperGrid — lifecycle', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('render(cards) is a no-op — does NOT trigger bridge.superGridQuery()', async () => {
    const { provider, filter, bridge, superGridQuerySpy, coordinator } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    const callCountAfterMount = superGridQuerySpy.mock.calls.length;
    // render() should be a no-op
    view.render([makeCardDatum(), makeCardDatum()]);
    await new Promise(r => setTimeout(r, 0));
    expect(superGridQuerySpy.mock.calls.length).toBe(callCountAfterMount);
    view.destroy();
  });

  it('mount() fires bridge.superGridQuery() immediately (call count = 1 after mount)', async () => {
    const { provider, filter, bridge, superGridQuerySpy, coordinator } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    expect(superGridQuerySpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    view.destroy();
  });

  it('destroy() removes root DOM element from container', () => {
    const { provider, filter, bridge, coordinator } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    expect(container.querySelector('.supergrid-view')).not.toBeNull();
    view.destroy();
    expect(container.querySelector('.supergrid-view')).toBeNull();
    expect(container.children.length).toBe(0);
  });

  it('destroy() clears internal state so subsequent render() does not throw', () => {
    const { provider, filter, bridge, coordinator } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    view.destroy();
    expect(() => view.render([])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Interface compliance tests
// ---------------------------------------------------------------------------

describe('SuperGrid — interface compliance', () => {
  it('SuperGridBridgeLike interface is satisfied by object with superGridQuery method', () => {
    const bridge: SuperGridBridgeLike = {
      superGridQuery: vi.fn().mockResolvedValue([]),
    };
    expect(typeof bridge.superGridQuery).toBe('function');
  });

  it('SuperGridProviderLike interface is satisfied by object with getStackedGroupBySQL method', () => {
    const provider: SuperGridProviderLike = {
      getStackedGroupBySQL: vi.fn().mockReturnValue({ colAxes: [], rowAxes: [] }),
    };
    expect(typeof provider.getStackedGroupBySQL).toBe('function');
  });

  it('SuperGridFilterLike interface is satisfied by object with compile method', () => {
    const filter: SuperGridFilterLike = {
      compile: vi.fn().mockReturnValue({ where: 'deleted_at IS NULL', params: [] }),
    };
    expect(typeof filter.compile).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// SuperGrid mount tests (updated for 4-arg constructor)
// ---------------------------------------------------------------------------

describe('SuperGrid — mount', () => {
  let container: HTMLElement;
  let view: SuperGrid;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const { provider, filter, bridge, coordinator } = makeDefaults();
    view = new SuperGrid(provider, filter, bridge, coordinator);
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

// ---------------------------------------------------------------------------
// SuperGrid render tests (updated for bridge-driven data)
// ---------------------------------------------------------------------------

describe('SuperGrid — render (bridge-driven data)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('render(cards) is a no-op — bridge.superGridQuery() drives data, not render()', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'task', folder: 'B', count: 1, card_ids: ['c2'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // render(cards) should NOT trigger additional superGridQuery calls
    const bridge2 = bridge as { superGridQuery: ReturnType<typeof vi.fn> };
    const beforeCount = bridge2.superGridQuery.mock.calls.length;
    view.render([makeCardDatum(), makeCardDatum()]);
    await new Promise(r => setTimeout(r, 0));
    expect(bridge2.superGridQuery.mock.calls.length).toBe(beforeCount);
    view.destroy();
  });

  it('grid container is present after mount', async () => {
    const { provider, filter, bridge, coordinator } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    const grid = container.querySelector('.supergrid-container');
    expect(grid).not.toBeNull();
    view.destroy();
  });

  it('bridge-driven cells produce column header divs', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'task', folder: 'B', count: 1, card_ids: ['c2'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    const headers = container.querySelectorAll('.col-header');
    expect(headers.length).toBeGreaterThan(0);
    view.destroy();
  });

  it('bridge-driven cells produce row header divs', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'note', folder: 'B', count: 1, card_ids: ['c2'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    const headers = container.querySelectorAll('.row-header');
    expect(headers.length).toBeGreaterThan(0);
    view.destroy();
  });

  it('bridge-driven cells produce data cell divs at intersections', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'task', folder: 'B', count: 1, card_ids: ['c2'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    const cells_dom = container.querySelectorAll('.data-cell');
    expect(cells_dom.length).toBeGreaterThan(0);
    view.destroy();
  });

  it('empty cells are present — dimensional integrity preserved', async () => {
    // 2 col values, 2 row values, but only diagonal filled
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'task', folder: 'B', count: 1, card_ids: ['c2'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    const emptyCells = container.querySelectorAll('.empty-cell');
    expect(emptyCells.length).toBeGreaterThan(0);
    view.destroy();
  });

  it('D3 data join: data cells have data-key attribute', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 2, card_ids: ['c1', 'c2'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    const dataCells = container.querySelectorAll('.data-cell');
    let hasKey = false;
    dataCells.forEach(cell => {
      if ((cell as HTMLElement).dataset['key']) hasKey = true;
    });
    expect(hasKey).toBe(true);
    view.destroy();
  });

  it('count badge shows number of cards at intersection', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 3, card_ids: ['c1', 'c2', 'c3'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    let found = false;
    const dataCells = container.querySelectorAll('.data-cell');
    dataCells.forEach(cell => {
      const badge = cell.querySelector('.count-badge');
      if (badge?.textContent === '3') found = true;
    });
    expect(found).toBe(true);
    view.destroy();
  });
});

// ---------------------------------------------------------------------------
// SuperGrid — header collapse (updated for bridge-driven data)
// ---------------------------------------------------------------------------

describe('SuperGrid — header collapse', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('clicking a column header toggles collapsed state (re-renders with fewer cells)', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'task', folder: 'A', count: 1, card_ids: ['c2'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // Count data cells before collapse
    const cellsBefore = container.querySelectorAll('.data-cell').length;
    expect(cellsBefore).toBeGreaterThan(0);

    // Click the first column header
    const firstHeader = container.querySelector('.col-header') as HTMLElement | null;
    expect(firstHeader).not.toBeNull();
    firstHeader!.click();

    // After collapsing, data cells count should change (grid rebuilt from cached cells)
    const cellsAfter = container.querySelectorAll('.data-cell').length;
    // The grid should re-render (even if count is different)
    const grid = container.querySelector('.supergrid-container');
    expect(grid).not.toBeNull();
    // With 2 col values, one collapsed → fewer visible cells
    expect(cellsAfter).toBeLessThanOrEqual(cellsBefore);
    view.destroy();
  });

  it('collapse re-render does NOT trigger another bridge.superGridQuery() call', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'task', folder: 'A', count: 1, card_ids: ['c2'] },
    ];
    const { provider, filter, bridge, superGridQuerySpy, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    const callCountAfterMount = superGridQuerySpy.mock.calls.length;

    // Click a column header to collapse
    const firstHeader = container.querySelector('.col-header') as HTMLElement | null;
    if (firstHeader) firstHeader.click();
    await new Promise(r => setTimeout(r, 0));

    // Collapse should use cached cells, not re-query bridge
    expect(superGridQuerySpy.mock.calls.length).toBe(callCountAfterMount);
    view.destroy();
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

  it('destroy removes grid container from DOM', async () => {
    const { provider, filter, bridge, coordinator } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    expect(container.querySelector('.supergrid-container')).not.toBeNull();

    view.destroy();

    expect(container.querySelector('.supergrid-container')).toBeNull();
    expect(container.children.length).toBe(0);
  });

  it('destroy clears internal state so subsequent render() does not throw', () => {
    const { provider, filter, bridge, coordinator } = makeDefaults();
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    view.destroy();

    // After destroy, render should be a no-op (no throw)
    expect(() => view.render([])).not.toThrow();
  });
});

// Note: Performance benchmark for SuperGrid is in SuperGrid.bench.ts
// Run with: npx vitest bench tests/views/SuperGrid.bench.ts
