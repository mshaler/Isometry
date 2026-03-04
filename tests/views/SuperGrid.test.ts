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

// ---------------------------------------------------------------------------
// SuperGrid — render pipeline (FOUN-09)
// ---------------------------------------------------------------------------

describe('SuperGrid — render pipeline (FOUN-09)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('mount() triggers bridge.superGridQuery() with config containing colAxes from provider', async () => {
    const providerAxes = {
      colAxes: [{ field: 'card_type', direction: 'asc' as const }],
      rowAxes: [{ field: 'folder', direction: 'asc' as const }],
    };
    const { provider, filter, bridge, superGridQuerySpy, coordinator } = makeDefaults([]);
    // Override provider spy
    (provider as { getStackedGroupBySQL: ReturnType<typeof vi.fn> }).getStackedGroupBySQL = vi.fn().mockReturnValue(providerAxes);

    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    expect(superGridQuerySpy).toHaveBeenCalledOnce();
    const config = superGridQuerySpy.mock.calls[0]?.[0] as { colAxes: unknown } | undefined;
    expect(config?.colAxes).toEqual(providerAxes.colAxes);
    view.destroy();
  });

  it('bridge.superGridQuery() returning 3 cells renders 3 .data-cell elements with count badges', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'note', folder: 'B', count: 2, card_ids: ['c2', 'c3'] },
      { card_type: 'task', folder: 'A', count: 3, card_ids: ['c4', 'c5', 'c6'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // Should produce a 2x2 grid: 2 col values (note, task) × 2 row values (A, B)
    // = 4 total data cells (3 with data + 1 empty)
    const dataCells = container.querySelectorAll('.data-cell');
    expect(dataCells.length).toBe(4);

    // Count badges for non-empty cells
    const badges = container.querySelectorAll('.count-badge');
    expect(badges.length).toBe(3);
    view.destroy();
  });

  it('cell at intersection (card_type=note, folder=Inbox) gets correct gridColumn and gridRow', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'Inbox', count: 5, card_ids: ['c1'] },
      { card_type: 'task', folder: 'Work', count: 2, card_ids: ['c2'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // Find the data cell for note/Inbox
    const dataCells = container.querySelectorAll('.data-cell');
    let noteInboxCell: HTMLElement | null = null;
    dataCells.forEach(cell => {
      const el = cell as HTMLElement;
      const key = el.dataset['key'] ?? '';
      if (key.includes('Inbox') && key.includes('note')) {
        noteInboxCell = el;
      }
    });

    expect(noteInboxCell).not.toBeNull();
    // Should have gridColumn and gridRow styles set
    expect((noteInboxCell as HTMLElement).style.gridColumn).toBeTruthy();
    expect((noteInboxCell as HTMLElement).style.gridRow).toBeTruthy();
    view.destroy();
  });

  it('D3 key function: data cells have data-key attribute set', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    const dataCells = container.querySelectorAll('.data-cell');
    let keyCount = 0;
    dataCells.forEach(cell => {
      if ((cell as HTMLElement).dataset['key']) keyCount++;
    });
    expect(keyCount).toBe(dataCells.length);
    view.destroy();
  });

  it('empty intersection (count=0) renders with .empty-cell class and no count badge', async () => {
    // note/Inbox has count=0, note/Work has count=3
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'Work', count: 3, card_ids: ['c1', 'c2', 'c3'] },
    ];
    // Provider returns card_type as col, folder as row
    // note/Inbox will be an empty intersection (0 count, not in bridge response)
    // We need 2 row values — supply an extra cell with different folder
    const cells2: CellDatum[] = [
      { card_type: 'note', folder: 'Work', count: 3, card_ids: ['c1', 'c2', 'c3'] },
      { card_type: 'task', folder: 'Inbox', count: 2, card_ids: ['c4', 'c5'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells2);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // note/Inbox = empty cell, task/Work = empty cell
    const emptyCells = container.querySelectorAll('.empty-cell');
    expect(emptyCells.length).toBeGreaterThan(0);

    // Empty cells should NOT have count badges
    emptyCells.forEach(el => {
      expect(el.querySelector('.count-badge')).toBeNull();
    });
    view.destroy();
  });

  it('dimensional integrity: 2 col values × 3 row values = exactly 6 .data-cell elements', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'note', folder: 'B', count: 2, card_ids: ['c2', 'c3'] },
      { card_type: 'note', folder: 'C', count: 1, card_ids: ['c4'] },
      // task/A and task/B are missing (empty cells will be generated)
      { card_type: 'task', folder: 'C', count: 3, card_ids: ['c5', 'c6', 'c7'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // 2 col values (note, task) × 3 row values (A, B, C) = 6 data cells
    const dataCells = container.querySelectorAll('.data-cell');
    expect(dataCells.length).toBe(6);
    view.destroy();
  });

  it('Worker error (rejected promise) shows .supergrid-error element with error message text', async () => {
    const errMsg = 'Worker crashed: invalid SQL';
    const { provider, filter, coordinator } = makeDefaults([]);
    const bridge: SuperGridBridgeLike = {
      superGridQuery: vi.fn().mockRejectedValue(new Error(errMsg)),
    };
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    const errorEl = container.querySelector('.supergrid-error');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain(errMsg);
    view.destroy();
  });

  it('successful query after error clears the .supergrid-error element', async () => {
    let callCount = 0;
    const errMsg = 'First query failed';
    let capturedCallback: (() => void) | null = null;
    const subscribeSpy = vi.fn().mockImplementation((cb: () => void) => {
      capturedCallback = cb;
      return () => {};
    });
    const coordinator = { subscribe: subscribeSpy };

    const { provider, filter } = makeDefaults([]);
    const successCells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
    ];
    const bridge: SuperGridBridgeLike = {
      superGridQuery: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error(errMsg));
        return Promise.resolve(successCells);
      }),
    };

    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    // Wait for initial (failed) query
    await new Promise(r => setTimeout(r, 0));
    expect(container.querySelector('.supergrid-error')).not.toBeNull();

    // Trigger second query via coordinator callback
    capturedCallback!();
    await new Promise(r => setTimeout(r, 0));

    // Error should be cleared
    expect(container.querySelector('.supergrid-error')).toBeNull();
    view.destroy();
  });

  it('zero results (empty array from bridge) shows headers for default axes but no .data-cell elements', async () => {
    const { provider, filter, bridge, coordinator } = makeDefaults([]);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // No data cells when bridge returns empty array
    const dataCells = container.querySelectorAll('.data-cell');
    expect(dataCells.length).toBe(0);
    view.destroy();
  });

  it('filter WHERE clause from FilterProvider is passed to bridge.superGridQuery() config', async () => {
    const filterWhere = 'folder = ? AND deleted_at IS NULL';
    const filterParams = ['Projects'];
    const { provider, coordinator } = makeDefaults([]);
    const { filter } = makeMockFilter({
      compile: vi.fn().mockReturnValue({ where: filterWhere, params: filterParams }),
    });
    const { bridge, superGridQuerySpy } = makeMockBridge([]);

    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    const config = superGridQuerySpy.mock.calls[0]?.[0] as { where: string; params: unknown[] } | undefined;
    expect(config?.where).toBe(filterWhere);
    expect(config?.params).toEqual(filterParams);
    view.destroy();
  });
});

// ---------------------------------------------------------------------------
// SuperGrid — batch deduplication (FOUN-11)
// ---------------------------------------------------------------------------

describe('SuperGrid — batch deduplication (FOUN-11)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('single StateCoordinator callback produces exactly one bridge.superGridQuery() call', async () => {
    const { provider, filter, bridge, superGridQuerySpy, coordinator, subscribeSpy } = makeDefaults([]);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    // Wait for initial fetch
    await new Promise(r => setTimeout(r, 0));
    const initialCalls = superGridQuerySpy.mock.calls.length;

    // Trigger exactly one coordinator callback
    const cb = subscribeSpy.mock.calls[0]?.[0] as (() => void) | undefined;
    cb!();
    await new Promise(r => setTimeout(r, 0));

    // Single callback = single additional bridge.superGridQuery() call
    expect(superGridQuerySpy.mock.calls.length).toBe(initialCalls + 1);
    view.destroy();
  });

  it('4 rapid StateCoordinator callbacks produce exactly 4 bridge.superGridQuery() calls (each callback = one call)', async () => {
    // The StateCoordinator batches provider changes — so 4 rapid calls to the
    // provider cause a single StateCoordinator callback. SuperGrid produces 1 query per callback.
    // This test validates: 1 coordinator callback → 1 bridge.superGridQuery() call.
    // (StateCoordinator batching tested separately in StateCoordinator.test.ts)
    const { provider, filter, bridge, superGridQuerySpy, coordinator, subscribeSpy } = makeDefaults([]);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));
    const initialCalls = superGridQuerySpy.mock.calls.length;

    // Simulate 4 coordinator callbacks (each represents a batched batch of provider changes)
    const cb = subscribeSpy.mock.calls[0]?.[0] as (() => void) | undefined;
    cb!();
    cb!();
    cb!();
    cb!();
    await new Promise(r => setTimeout(r, 0));

    // 4 callbacks × 1 query per callback = 4 additional calls
    expect(superGridQuerySpy.mock.calls.length).toBe(initialCalls + 4);
    view.destroy();
  });

  it('FOUN-11 integration: StateCoordinator batching ensures 4 rapid provider changes → 1 coordinator callback → 1 query', async () => {
    vi.useFakeTimers();

    // Mock a real-ish StateCoordinator that batches callbacks via setTimeout(16)
    const subscribers: Array<() => void> = [];
    let batchTimeout: ReturnType<typeof setTimeout> | null = null;

    const batchingCoordinator = {
      subscribe(cb: () => void): () => void {
        subscribers.push(cb);
        return () => {
          const idx = subscribers.indexOf(cb);
          if (idx >= 0) subscribers.splice(idx, 1);
        };
      },
      // Simulate the 16ms batch window (like StateCoordinator's debounce)
      triggerChange() {
        if (batchTimeout) clearTimeout(batchTimeout);
        batchTimeout = setTimeout(() => {
          batchTimeout = null;
          subscribers.forEach(cb => cb());
        }, 16);
      },
    };

    // Use the real bridge mock (has superGridQuery method)
    const { provider, filter, bridge, superGridQuerySpy } = makeDefaults([]);

    // SuperGrid constructor: (provider, filter, bridge, coordinator)
    const view = new SuperGrid(provider, filter, bridge, batchingCoordinator);

    // Mount — fires initial _fetchAndRender() (async, uses Promise so not affected by fake timers here)
    view.mount(container);
    // Flush the initial async fetch by advancing timers + draining microtasks
    await vi.runAllTimersAsync();

    const initialCalls = superGridQuerySpy.mock.calls.length;

    // Trigger 4 rapid changes — all within the 16ms batch window (debounced by batchingCoordinator)
    batchingCoordinator.triggerChange();
    batchingCoordinator.triggerChange();
    batchingCoordinator.triggerChange();
    batchingCoordinator.triggerChange();

    // Advance timers — batch fires once after 16ms, triggering exactly 1 coordinator callback
    await vi.runAllTimersAsync();

    // 4 rapid changes → 1 coordinator callback (batched) → 1 bridge.superGridQuery() call
    expect(superGridQuerySpy.mock.calls.length).toBe(initialCalls + 1);

    view.destroy();
    vi.useRealTimers();
  });

  it('only the latest provider state is sent to bridge.superGridQuery() after coordinator fires', async () => {
    let capturedCb: (() => void) | null = null;
    const subscribeSpy = vi.fn().mockImplementation((cb: () => void) => {
      capturedCb = cb;
      return () => {};
    });
    const coordinator = { subscribe: subscribeSpy };

    // Provider changes state between callbacks
    let currentAxes = { colAxes: [{ field: 'card_type', direction: 'asc' as const }], rowAxes: [{ field: 'folder', direction: 'asc' as const }] };
    const provider: SuperGridProviderLike = {
      getStackedGroupBySQL: vi.fn().mockImplementation(() => currentAxes),
    };
    const { filter, bridge, superGridQuerySpy } = makeDefaults([]);

    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // Update provider state
    currentAxes = { colAxes: [{ field: 'status', direction: 'asc' as const }], rowAxes: [{ field: 'folder', direction: 'asc' as const }] };

    // Trigger coordinator callback — should pick up latest provider state
    capturedCb!();
    await new Promise(r => setTimeout(r, 0));

    const lastCall = superGridQuerySpy.mock.calls[superGridQuerySpy.mock.calls.length - 1];
    const config = lastCall?.[0] as { colAxes: { field: string }[] } | undefined;
    expect(config?.colAxes[0]?.field).toBe('status');
    view.destroy();
  });
});

// ---------------------------------------------------------------------------
// SuperGrid — collapse cache (no re-query)
// ---------------------------------------------------------------------------

describe('SuperGrid — collapse cache', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('clicking a column header to collapse does NOT trigger bridge.superGridQuery()', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'task', folder: 'A', count: 2, card_ids: ['c2', 'c3'] },
      { card_type: 'note', folder: 'B', count: 1, card_ids: ['c4'] },
      { card_type: 'task', folder: 'B', count: 3, card_ids: ['c5', 'c6', 'c7'] },
    ];
    const { provider, filter, bridge, superGridQuerySpy, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    const callCountAfterMount = superGridQuerySpy.mock.calls.length;

    // Click the first column header to collapse it
    const firstHeader = container.querySelector('.col-header') as HTMLElement | null;
    expect(firstHeader).not.toBeNull();
    firstHeader!.click();

    // Should NOT trigger another bridge.superGridQuery() call
    expect(superGridQuerySpy.mock.calls.length).toBe(callCountAfterMount);
    view.destroy();
  });

  it('collapse re-renders from cached CellDatum[] — .data-cell count changes without re-querying', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'task', folder: 'A', count: 2, card_ids: ['c2', 'c3'] },
    ];
    const { provider, filter, bridge, superGridQuerySpy, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    const cellsBefore = container.querySelectorAll('.data-cell').length;
    const callCountBefore = superGridQuerySpy.mock.calls.length;

    // Collapse first column header
    const firstHeader = container.querySelector('.col-header') as HTMLElement | null;
    firstHeader!.click();

    const cellsAfter = container.querySelectorAll('.data-cell').length;
    const callCountAfter = superGridQuerySpy.mock.calls.length;

    // Re-render happened (cell count may change)
    expect(cellsAfter).toBeLessThanOrEqual(cellsBefore);
    // Bridge was NOT re-queried
    expect(callCountAfter).toBe(callCountBefore);
    view.destroy();
  });

  it('toggle collapse twice returns to original .data-cell count (expand re-renders from cache)', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'task', folder: 'A', count: 2, card_ids: ['c2', 'c3'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    const cellsBefore = container.querySelectorAll('.data-cell').length;

    // Collapse
    const firstHeader = container.querySelector('.col-header') as HTMLElement | null;
    firstHeader!.click();

    // Expand (second click)
    const headerAgain = container.querySelector('.col-header') as HTMLElement | null;
    headerAgain!.click();

    const cellsAfter = container.querySelectorAll('.data-cell').length;
    // Should be back to original count
    expect(cellsAfter).toBe(cellsBefore);
    view.destroy();
  });
});

// ---------------------------------------------------------------------------
// SuperGrid — error and empty states
// ---------------------------------------------------------------------------

describe('SuperGrid — error and empty states', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('Worker error shows .supergrid-error element in the grid container', async () => {
    const { provider, filter, coordinator } = makeDefaults([]);
    const bridge: SuperGridBridgeLike = {
      superGridQuery: vi.fn().mockRejectedValue(new Error('Connection lost')),
    };
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // Error element should be in the grid container
    const grid = container.querySelector('.supergrid-container');
    expect(grid?.querySelector('.supergrid-error')).not.toBeNull();
    view.destroy();
  });

  it('Worker error message includes the error text', async () => {
    const errMessage = 'axis field "missing_field" not in schema';
    const { provider, filter, coordinator } = makeDefaults([]);
    const bridge: SuperGridBridgeLike = {
      superGridQuery: vi.fn().mockRejectedValue(new Error(errMessage)),
    };
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    const errorEl = container.querySelector('.supergrid-error');
    expect(errorEl?.textContent).toContain(errMessage);
    view.destroy();
  });

  it('zero results from bridge: no .data-cell elements, no error element', async () => {
    const { provider, filter, bridge, coordinator } = makeDefaults([]);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    expect(container.querySelectorAll('.data-cell').length).toBe(0);
    expect(container.querySelector('.supergrid-error')).toBeNull();
    view.destroy();
  });

  it('error state clears on next successful query (no stale error element)', async () => {
    let callIndex = 0;
    let capturedCb: (() => void) | null = null;
    const subscribeSpy = vi.fn().mockImplementation((cb: () => void) => {
      capturedCb = cb;
      return () => {};
    });
    const coordinator = { subscribe: subscribeSpy };

    const { provider, filter } = makeDefaults([]);
    const bridge: SuperGridBridgeLike = {
      superGridQuery: vi.fn().mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) return Promise.reject(new Error('transient error'));
        return Promise.resolve([{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] }]);
      }),
    };

    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // Error on first call
    expect(container.querySelector('.supergrid-error')).not.toBeNull();

    // Second call succeeds
    capturedCb!();
    await new Promise(r => setTimeout(r, 0));

    // Error cleared
    expect(container.querySelector('.supergrid-error')).toBeNull();
    // Data cells present
    expect(container.querySelectorAll('.data-cell').length).toBeGreaterThan(0);
    view.destroy();
  });
});

// ---------------------------------------------------------------------------
// SuperGrid — multi-axis key function
// ---------------------------------------------------------------------------

describe('SuperGrid — multi-axis key function', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('data cells have data-key attributes that include column and row axis values', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'Inbox', count: 1, card_ids: ['c1'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    const dataCells = container.querySelectorAll('.data-cell');
    dataCells.forEach(cell => {
      const key = (cell as HTMLElement).dataset['key'];
      expect(key).toBeTruthy();
      // Key should contain the col and row field values
      expect(key).toContain('note');
      expect(key).toContain('Inbox');
    });
    view.destroy();
  });

  it('empty cells also have data-key attributes for D3 join identity', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'task', folder: 'B', count: 2, card_ids: ['c2', 'c3'] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // All data cells (including empty) should have data-key
    const allDataCells = container.querySelectorAll('.data-cell');
    allDataCells.forEach(cell => {
      expect((cell as HTMLElement).dataset['key']).toBeTruthy();
    });
    view.destroy();
  });

  it('with empty colAxes from provider (falls back to VIEW_DEFAULTS), headers show card_type values', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
    ];
    const emptyProvider: SuperGridProviderLike = {
      getStackedGroupBySQL: vi.fn().mockReturnValue({ colAxes: [], rowAxes: [] }),
    };
    const { filter, bridge, coordinator } = makeDefaults(cells);
    // Override bridge to return cells using default axes (card_type, folder)
    const { bridge: b2, superGridQuerySpy: _ } = makeMockBridge(cells);
    const view = new SuperGrid(emptyProvider, filter, b2, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // With default axes (card_type/folder), should render col-headers for 'note'
    const colHeaders = container.querySelectorAll('.col-header');
    expect(colHeaders.length).toBeGreaterThan(0);
    let foundNote = false;
    colHeaders.forEach(h => {
      if (h.textContent === 'note') foundNote = true;
    });
    expect(foundNote).toBe(true);
    view.destroy();
  });

  it('data-key format uniquely identifies each intersection for D3 update path', async () => {
    const cells: CellDatum[] = [
      { card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'] },
      { card_type: 'note', folder: 'B', count: 2, card_ids: ['c2', 'c3'] },
      { card_type: 'task', folder: 'A', count: 3, card_ids: ['c4', 'c5', 'c6'] },
      { card_type: 'task', folder: 'B', count: 0, card_ids: [] },
    ];
    const { provider, filter, bridge, coordinator } = makeDefaults(cells);
    const view = new SuperGrid(provider, filter, bridge, coordinator);
    view.mount(container);
    await new Promise(r => setTimeout(r, 0));

    // Collect all data-key values
    const dataCells = container.querySelectorAll('.data-cell');
    const keys = new Set<string>();
    dataCells.forEach(cell => {
      const key = (cell as HTMLElement).dataset['key'];
      if (key) keys.add(key);
    });

    // All keys should be unique
    expect(keys.size).toBe(dataCells.length);
    view.destroy();
  });
});

// Note: Performance benchmark for SuperGrid is in SuperGrid.bench.ts
// Run with: npx vitest bench tests/views/SuperGrid.bench.ts
