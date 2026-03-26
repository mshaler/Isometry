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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardType } from '../../src/database/queries/types';
import type { TimeGranularity, ViewMode } from '../../src/providers/types';
import { SuperGrid } from '../../src/views';
import { classifyClickZone } from '../../src/views/supergrid/SuperGridSelect';
import type {
	CardDatum,
	SuperGridBridgeLike,
	SuperGridDensityLike,
	SuperGridFilterLike,
	SuperGridProviderLike,
	SuperGridSelectionLike,
} from '../../src/views/types';
import type { CellDatum } from '../../src/worker/protocol';

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
		source: null,
		...overrides,
	};
}

function _makeCellDatum(overrides: Partial<CellDatum> = {}): CellDatum {
	return {
		count: 1,
		card_ids: ['card-1'],
		card_names: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

function makeMockProvider(overrides: Partial<SuperGridProviderLike> = {}): {
	provider: SuperGridProviderLike;
	getStackedGroupBySQLSpy: ReturnType<typeof vi.fn>;
} {
	const getStackedGroupBySQLSpy = vi.fn().mockReturnValue({
		colAxes: [{ field: 'card_type', direction: 'asc' }],
		rowAxes: [{ field: 'folder', direction: 'asc' }],
	});
	const provider: SuperGridProviderLike = {
		getStackedGroupBySQL: getStackedGroupBySQLSpy,
		setColAxes: vi.fn(),
		setRowAxes: vi.fn(),
		// Phase 20 — colWidths accessors (return empty widths; SuperGridSizer wires real values in Plan 02)
		getColWidths: vi.fn().mockReturnValue({}),
		setColWidths: vi.fn(),
		// Phase 23 — sort overrides (return empty sorts by default)
		getSortOverrides: vi.fn().mockReturnValue([]),
		setSortOverrides: vi.fn(),
		// Phase 30 — collapse state (return empty state by default)
		getCollapseState: vi.fn().mockReturnValue([]),
		setCollapseState: vi.fn(),
		// Phase 31 — reorder axes (no-op stubs for test mocks)
		reorderColAxes: vi.fn(),
		reorderRowAxes: vi.fn(),
		// Phase 84 — aggregation mode (defaults to 'count' for backward compat)
		getAggregation: vi.fn().mockReturnValue('count'),
		...overrides,
	};
	return { provider, getStackedGroupBySQLSpy };
}

function makeMockFilter(overrides: Partial<SuperGridFilterLike> = {}): {
	filter: SuperGridFilterLike;
	compileSpy: ReturnType<typeof vi.fn>;
} {
	const compileSpy = vi.fn().mockReturnValue({ where: 'deleted_at IS NULL', params: [] });
	const filter: SuperGridFilterLike = {
		compile: compileSpy,
		// Phase 24 — axis filter read/write (FILT-01, FILT-02)
		hasAxisFilter: vi.fn().mockReturnValue(false),
		getAxisFilter: vi.fn().mockReturnValue([]),
		setAxisFilter: vi.fn(),
		clearAxis: vi.fn(),
		clearAllAxisFilters: vi.fn(),
		...overrides,
	};
	return { filter, compileSpy };
}

function makeMockBridge(cells: CellDatum[] = []): {
	bridge: SuperGridBridgeLike;
	superGridQuerySpy: ReturnType<typeof vi.fn>;
} {
	const superGridQuerySpy = vi.fn().mockResolvedValue(cells);
	const bridge: SuperGridBridgeLike = {
		superGridQuery: superGridQuerySpy,
		calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
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
	return {
		provider,
		getStackedGroupBySQLSpy,
		filter,
		compileSpy,
		bridge,
		superGridQuerySpy,
		coordinator,
		subscribeSpy,
		unsubSpy,
	};
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
		expect(() => new SuperGrid({ provider, filter, bridge, coordinator })).not.toThrow();
	});

	it('mount() calls provider.getStackedGroupBySQL() to read axes', async () => {
		const { provider, getStackedGroupBySQLSpy, filter, bridge, coordinator } = makeDefaults();
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		// Wait a tick for the async _fetchAndRender to call getStackedGroupBySQL
		await new Promise((r) => setTimeout(r, 0));
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
		const provider: SuperGridProviderLike = {
			getStackedGroupBySQL: getStackedGroupBySQLSpy,
			setColAxes: vi.fn(),
			setRowAxes: vi.fn(),
			getColWidths: vi.fn().mockReturnValue({}),
			setColWidths: vi.fn(),
			getSortOverrides: vi.fn().mockReturnValue([]),
			setSortOverrides: vi.fn(),
			getCollapseState: vi.fn().mockReturnValue([]),
			setCollapseState: vi.fn(),
			reorderColAxes: vi.fn(),
			reorderRowAxes: vi.fn(),
			// Phase 84 — aggregation mode (defaults to 'count')
			getAggregation: vi.fn().mockReturnValue('count'),
		};
		const { filter, bridge, superGridQuerySpy, coordinator } = rest;
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));
		expect(superGridQuerySpy).toHaveBeenCalled();
		const callArg = superGridQuerySpy.mock.calls[0]?.[0] as { colAxes: unknown[] } | undefined;
		expect(callArg?.colAxes).toEqual(customAxes.colAxes);
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
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		expect(subscribeSpy).toHaveBeenCalledOnce();
		view.destroy();
	});

	it('coordinator change callback triggers bridge.superGridQuery()', async () => {
		const { provider, filter, bridge, superGridQuerySpy, coordinator, subscribeSpy } = makeDefaults();
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		// Wait for initial fetch
		await new Promise((r) => setTimeout(r, 0));
		const initialCallCount = superGridQuerySpy.mock.calls.length;
		// Trigger the coordinator callback
		const cb = subscribeSpy.mock.calls[0]?.[0] as (() => void) | undefined;
		expect(cb).toBeDefined();
		cb!();
		await new Promise((r) => setTimeout(r, 0));
		expect(superGridQuerySpy.mock.calls.length).toBeGreaterThan(initialCallCount);
		view.destroy();
	});

	it('destroy() calls the unsubscribe function returned by coordinator.subscribe()', () => {
		const { provider, filter, bridge, coordinator, unsubSpy } = makeDefaults();
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		view.destroy();
		expect(unsubSpy).toHaveBeenCalledOnce();
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
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));
		const callCountAfterMount = superGridQuerySpy.mock.calls.length;
		// render() should be a no-op
		view.render([makeCardDatum(), makeCardDatum()]);
		await new Promise((r) => setTimeout(r, 0));
		expect(superGridQuerySpy.mock.calls.length).toBe(callCountAfterMount);
		view.destroy();
	});

	it('mount() fires bridge.superGridQuery() immediately (call count = 1 after mount)', async () => {
		const { provider, filter, bridge, superGridQuerySpy, coordinator } = makeDefaults();
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));
		expect(superGridQuerySpy.mock.calls.length).toBeGreaterThanOrEqual(1);
		view.destroy();
	});
	it('destroy() clears internal state so subsequent render() does not throw', () => {
		const { provider, filter, bridge, coordinator } = makeDefaults();
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		view.destroy();
		expect(() => view.render([])).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Interface compliance tests
// ---------------------------------------------------------------------------

describe('SuperGrid — interface compliance', () => {
	it('SuperGridBridgeLike interface is satisfied by object with superGridQuery and calcQuery methods', () => {
		const bridge: SuperGridBridgeLike = {
			superGridQuery: vi.fn().mockResolvedValue([]),
			calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
		};
		expect(typeof bridge.superGridQuery).toBe('function');
		expect(typeof bridge.calcQuery).toBe('function');
	});

	it('SuperGridProviderLike interface is satisfied by object with getStackedGroupBySQL + setColAxes + setRowAxes methods', () => {
		const provider: SuperGridProviderLike = {
			getStackedGroupBySQL: vi.fn().mockReturnValue({ colAxes: [], rowAxes: [] }),
			setColAxes: vi.fn(),
			setRowAxes: vi.fn(),
			getColWidths: vi.fn().mockReturnValue({}),
			setColWidths: vi.fn(),
			getSortOverrides: vi.fn().mockReturnValue([]),
			setSortOverrides: vi.fn(),
			getCollapseState: vi.fn().mockReturnValue([]),
			setCollapseState: vi.fn(),
			reorderColAxes: vi.fn(),
			reorderRowAxes: vi.fn(),
			// Phase 84 — aggregation mode (defaults to 'count')
			getAggregation: vi.fn().mockReturnValue('count'),
		};
		expect(typeof provider.getStackedGroupBySQL).toBe('function');
		expect(typeof provider.setColAxes).toBe('function');
		expect(typeof provider.setRowAxes).toBe('function');
	});

	it('SuperGridFilterLike interface is satisfied by object with compile + axis filter methods', () => {
		const filter: SuperGridFilterLike = {
			compile: vi.fn().mockReturnValue({ where: 'deleted_at IS NULL', params: [] }),
			// Phase 24 — axis filter methods added to SuperGridFilterLike (Plan 01)
			hasAxisFilter: vi.fn().mockReturnValue(false),
			getAxisFilter: vi.fn().mockReturnValue([]),
			setAxisFilter: vi.fn(),
			clearAxis: vi.fn(),
			clearAllAxisFilters: vi.fn(),
		};
		expect(typeof filter.compile).toBe('function');
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
			{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] },
			{ card_type: 'task', folder: 'B', count: 1, card_ids: ['c2'], card_names: [] },
		];
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		// render(cards) should NOT trigger additional superGridQuery calls
		const bridge2 = bridge as unknown as { superGridQuery: ReturnType<typeof vi.fn> };
		const beforeCount = bridge2.superGridQuery.mock.calls.length;
		view.render([makeCardDatum(), makeCardDatum()]);
		await new Promise((r) => setTimeout(r, 0));
		expect(bridge2.superGridQuery.mock.calls.length).toBe(beforeCount);
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
	it('collapse re-render does NOT trigger another bridge.superGridQuery() call', async () => {
		const cells: CellDatum[] = [
			{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] },
			{ card_type: 'task', folder: 'A', count: 1, card_ids: ['c2'], card_names: [] },
		];
		const { provider, filter, bridge, superGridQuerySpy, coordinator } = makeDefaults(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		const callCountAfterMount = superGridQuerySpy.mock.calls.length;

		// Click a column header to collapse
		const firstHeader = container.querySelector('.col-header') as HTMLElement | null;
		if (firstHeader) firstHeader.click();
		await new Promise((r) => setTimeout(r, 0));

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
	it('destroy clears internal state so subsequent render() does not throw', () => {
		const { provider, filter, bridge, coordinator } = makeDefaults();
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
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
		(provider as unknown as { getStackedGroupBySQL: ReturnType<typeof vi.fn> }).getStackedGroupBySQL = vi
			.fn()
			.mockReturnValue(providerAxes);

		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		expect(superGridQuerySpy).toHaveBeenCalledOnce();
		const config = superGridQuerySpy.mock.calls[0]?.[0] as { colAxes: unknown } | undefined;
		expect(config?.colAxes).toEqual(providerAxes.colAxes);
		view.destroy();
	});
	it('D3 key function: data cells have data-key attribute set', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		const dataCells = container.querySelectorAll('.data-cell');
		let keyCount = 0;
		dataCells.forEach((cell) => {
			if ((cell as HTMLElement).dataset['key']) keyCount++;
		});
		expect(keyCount).toBe(dataCells.length);
		view.destroy();
	});
	it('zero results (empty array from bridge) shows headers for default axes but no .data-cell elements', async () => {
		const { provider, filter, bridge, coordinator } = makeDefaults([]);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

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

		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

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
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		// Wait for initial fetch
		await new Promise((r) => setTimeout(r, 0));
		const initialCalls = superGridQuerySpy.mock.calls.length;

		// Trigger exactly one coordinator callback
		const cb = subscribeSpy.mock.calls[0]?.[0] as (() => void) | undefined;
		cb!();
		await new Promise((r) => setTimeout(r, 0));

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
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));
		const initialCalls = superGridQuerySpy.mock.calls.length;

		// Simulate 4 coordinator callbacks (each represents a batched batch of provider changes)
		const cb = subscribeSpy.mock.calls[0]?.[0] as (() => void) | undefined;
		cb!();
		cb!();
		cb!();
		cb!();
		await new Promise((r) => setTimeout(r, 0));

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
					subscribers.forEach((cb) => cb());
				}, 16);
			},
		};

		// Use the real bridge mock (has superGridQuery method)
		const { provider, filter, bridge, superGridQuerySpy } = makeDefaults([]);

		// SuperGrid constructor: (provider, filter, bridge, coordinator)
		const view = new SuperGrid({ provider, filter, bridge, coordinator: batchingCoordinator });

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
			calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
		};
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		// Error element should be in the grid container
		const grid = container.querySelector('.supergrid-container');
		expect(grid?.querySelector('.supergrid-error')).not.toBeNull();
		view.destroy();
	});
	it('zero results from bridge: no .data-cell elements, no error element', async () => {
		const { provider, filter, bridge, coordinator } = makeDefaults([]);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		expect(container.querySelectorAll('.data-cell').length).toBe(0);
		expect(container.querySelector('.supergrid-error')).toBeNull();
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
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'Inbox', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		const dataCells = container.querySelectorAll('.data-cell');
		dataCells.forEach((cell) => {
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
			{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] },
			{ card_type: 'task', folder: 'B', count: 2, card_ids: ['c2', 'c3'], card_names: [] },
		];
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		// All data cells (including empty) should have data-key
		const allDataCells = container.querySelectorAll('.data-cell');
		allDataCells.forEach((cell) => {
			expect((cell as HTMLElement).dataset['key']).toBeTruthy();
		});
		view.destroy();
	});
	it('data-key format uniquely identifies each intersection for D3 update path', async () => {
		const cells: CellDatum[] = [
			{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] },
			{ card_type: 'note', folder: 'B', count: 2, card_ids: ['c2', 'c3'], card_names: [] },
			{ card_type: 'task', folder: 'A', count: 3, card_ids: ['c4', 'c5', 'c6'], card_names: [] },
			{ card_type: 'task', folder: 'B', count: 0, card_ids: [], card_names: [] },
		];
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		// Collect all data-key values
		const dataCells = container.querySelectorAll('.data-cell');
		const keys = new Set<string>();
		dataCells.forEach((cell) => {
			const key = (cell as HTMLElement).dataset['key'];
			if (key) keys.add(key);
		});

		// All keys should be unique
		expect(keys.size).toBe(dataCells.length);
		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// Phase 18 — DYNM-01/DYNM-02: Axis DnD (grip handles + cross-dimension transpose)
// Phase 96: Migrated from HTML5 DnD to pointer events
// ---------------------------------------------------------------------------

// Helper: build a provider mock that also exposes setColAxes/setRowAxes spies
function makeMockProviderWithSetters(axes?: {
	colAxes?: Array<{ field: string; direction: 'asc' | 'desc' }>;
	rowAxes?: Array<{ field: string; direction: 'asc' | 'desc' }>;
}) {
	const currentAxes = {
		colAxes: axes?.colAxes ?? [{ field: 'card_type', direction: 'asc' as const }],
		rowAxes: axes?.rowAxes ?? [{ field: 'folder', direction: 'asc' as const }],
	};
	const setColAxesSpy = vi.fn().mockImplementation((newAxes: typeof currentAxes.colAxes) => {
		currentAxes.colAxes = [...newAxes];
	});
	const setRowAxesSpy = vi.fn().mockImplementation((newAxes: typeof currentAxes.rowAxes) => {
		currentAxes.rowAxes = [...newAxes];
	});
	const getStackedGroupBySQLSpy = vi.fn().mockImplementation(() => ({
		colAxes: [...currentAxes.colAxes],
		rowAxes: [...currentAxes.rowAxes],
	}));
	const provider = {
		getStackedGroupBySQL: getStackedGroupBySQLSpy,
		setColAxes: setColAxesSpy,
		setRowAxes: setRowAxesSpy,
		// Phase 20 — colWidths accessors (return empty widths by default)
		getColWidths: vi.fn().mockReturnValue({}),
		setColWidths: vi.fn(),
		// Phase 23 — sort overrides
		getSortOverrides: vi.fn().mockReturnValue([]),
		setSortOverrides: vi.fn(),
		// Phase 30 — collapse state
		getCollapseState: vi.fn().mockReturnValue([]),
		setCollapseState: vi.fn(),
		// Phase 31 — reorder axes (no-op stubs)
		reorderColAxes: vi.fn(),
		reorderRowAxes: vi.fn(),
		// Phase 84 — aggregation mode (defaults to 'count')
		getAggregation: vi.fn().mockReturnValue('count'),
	};
	return { provider, getStackedGroupBySQLSpy, setColAxesSpy, setRowAxesSpy };
}

// Helper: fire a PointerEvent on an element (Phase 96 — pointer-event DnD)
function firePointerEvent(el: Element, type: string, coords: { clientX?: number; clientY?: number } = {}): void {
	const event = new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		pointerId: 1,
		clientX: coords.clientX ?? 0,
		clientY: coords.clientY ?? 0,
	});
	el.dispatchEvent(event);
}

// Helper: simulate a full pointer DnD sequence on a grip → drop zone
// 1. pointerdown on grip (sets _dragPayload)
// 2. set data-sg-drop-target on the drop zone (test escape hatch for jsdom zero-rects)
// 3. pointerup on grip (triggers _handlePointerDrop via test escape hatch)
function fireGripToDrop(grip: Element, dropZone: HTMLElement): void {
	firePointerEvent(grip, 'pointerdown');
	dropZone.dataset['sgDropTarget'] = dropZone.dataset['dropZone'] ?? 'col';
	firePointerEvent(grip, 'pointerup');
}

describe('DYNM-01/DYNM-02 — SuperGrid axis DnD (grip handles + cross-dimension transpose)', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	// -------------------------------------------------------------------------
	// Interface tests
	// -------------------------------------------------------------------------

	it('SuperGridProviderLike interface includes setColAxes method', () => {
		// TypeScript compile-time check that the interface has these methods.
		// At runtime, we verify a conforming object can be constructed.
		const provider: import('../../src/views/types').SuperGridProviderLike = {
			getStackedGroupBySQL: vi.fn().mockReturnValue({ colAxes: [], rowAxes: [] }),
			setColAxes: vi.fn(),
			setRowAxes: vi.fn(),
			getColWidths: vi.fn().mockReturnValue({}),
			setColWidths: vi.fn(),
			getSortOverrides: vi.fn().mockReturnValue([]),
			setSortOverrides: vi.fn(),
			getCollapseState: vi.fn().mockReturnValue([]),
			setCollapseState: vi.fn(),
			reorderColAxes: vi.fn(),
			reorderRowAxes: vi.fn(),
			// Phase 84 — aggregation mode (defaults to 'count')
			getAggregation: vi.fn().mockReturnValue('count'),
		};
		expect(typeof provider.setColAxes).toBe('function');
	});

	it('SuperGridProviderLike interface includes setRowAxes method', () => {
		const provider: import('../../src/views/types').SuperGridProviderLike = {
			getStackedGroupBySQL: vi.fn().mockReturnValue({ colAxes: [], rowAxes: [] }),
			setColAxes: vi.fn(),
			setRowAxes: vi.fn(),
			getColWidths: vi.fn().mockReturnValue({}),
			setColWidths: vi.fn(),
			getSortOverrides: vi.fn().mockReturnValue([]),
			setSortOverrides: vi.fn(),
			getCollapseState: vi.fn().mockReturnValue([]),
			setCollapseState: vi.fn(),
			reorderColAxes: vi.fn(),
			reorderRowAxes: vi.fn(),
			// Phase 84 — aggregation mode (defaults to 'count')
			getAggregation: vi.fn().mockReturnValue('count'),
		};
		expect(typeof provider.setRowAxes).toBe('function');
	});
});

// ---------------------------------------------------------------------------
// Phase 18 — DYNM-03: Same-dimension axis reorder (Phase 96: pointer events)
// ---------------------------------------------------------------------------

// Helper: fire a pointerdown on a grip and a pointerup to trigger a same-dimension drop.
// Sets dataset['reorderTargetIndex'] and data-sg-drop-target on the drop zone as test escape hatches.
// (module-level so both DYNM-03 and Phase 31-02 describe blocks can use it)
function fireSameDimDrop(fromGrip: Element, toDropZone: Element, targetAxisIndex: number): void {
	// pointerdown on the grip — sets _dragPayload
	firePointerEvent(fromGrip, 'pointerdown');
	// Set target axis index and drop zone target via dataset (test escape hatches)
	(toDropZone as HTMLElement).dataset['reorderTargetIndex'] = String(targetAxisIndex);
	(toDropZone as HTMLElement).dataset['sgDropTarget'] = (toDropZone as HTMLElement).dataset['dropZone'] ?? 'col';
	// pointerup on the grip — calls _handlePointerDrop with test escape hatch
	firePointerEvent(fromGrip, 'pointerup');
}
// Note: Performance benchmark for SuperGrid is in SuperGrid.bench.ts

// ---------------------------------------------------------------------------
// POSN-02 + POSN-03: SuperGridPositionLike interface, sticky headers, scroll handler
// ---------------------------------------------------------------------------

import type { SuperGridPositionLike } from '../../src/views/types';

function makeMockPositionProvider(): {
	positionProvider: SuperGridPositionLike;
	savePositionSpy: ReturnType<typeof vi.fn>;
	restorePositionSpy: ReturnType<typeof vi.fn>;
	resetSpy: ReturnType<typeof vi.fn>;
} {
	let _zoomLevel = 1.0;
	const savePositionSpy = vi.fn();
	const restorePositionSpy = vi.fn();
	const resetSpy = vi.fn();
	const positionProvider: SuperGridPositionLike = {
		savePosition: savePositionSpy,
		restorePosition: restorePositionSpy,
		get zoomLevel() {
			return _zoomLevel;
		},
		set zoomLevel(v: number) {
			_zoomLevel = v;
		},
		setAxisCoordinates: vi.fn(),
		reset: resetSpy,
	};
	return { positionProvider, savePositionSpy, restorePositionSpy, resetSpy };
}

function makeDefaultsWithPosition(cells: CellDatum[] = []) {
	const defaults = makeDefaults(cells);
	const { positionProvider, savePositionSpy, restorePositionSpy, resetSpy } = makeMockPositionProvider();
	return { ...defaults, positionProvider, savePositionSpy, restorePositionSpy, resetSpy };
}

describe('POSN-02 + POSN-03 — SuperGrid sticky headers and scroll position', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	it('SuperGrid constructor accepts 5th positionProvider argument without throwing', () => {
		const { provider, filter, bridge, coordinator, positionProvider } = makeDefaultsWithPosition();
		expect(() => new SuperGrid({ provider, filter, bridge, coordinator, positionProvider })).not.toThrow();
	});
	it('column headers have z-index:2 after render', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator, positionProvider } = makeDefaultsWithPosition(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator, positionProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		const colHeaders = container.querySelectorAll('.col-header');
		colHeaders.forEach((header) => {
			const el = header as HTMLElement;
			expect(el.style.zIndex).toBe('2');
		});
		view.destroy();
	});

	it('column headers have sg-header class (background-color via CSS — prevents scroll bleed-through)', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator, positionProvider } = makeDefaultsWithPosition(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator, positionProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		const colHeaders = container.querySelectorAll('.col-header');
		colHeaders.forEach((header) => {
			// Phase 58 CSSB-03: backgroundColor now via .sg-header CSS class, not inline
			expect(header.classList.contains('sg-header')).toBe(true);
		});
		view.destroy();
	});
	it('row headers have z-index:2 after render', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator, positionProvider } = makeDefaultsWithPosition(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator, positionProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		const rowHeaders = container.querySelectorAll('.row-header');
		rowHeaders.forEach((header) => {
			const el = header as HTMLElement;
			expect(el.style.zIndex).toBe('2');
		});
		view.destroy();
	});

	it('row headers have sg-header class (background-color via CSS)', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator, positionProvider } = makeDefaultsWithPosition(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator, positionProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		const rowHeaders = container.querySelectorAll('.row-header');
		rowHeaders.forEach((header) => {
			// Phase 58 CSSB-03: backgroundColor now via .sg-header CSS class, not inline
			expect(header.classList.contains('sg-header')).toBe(true);
		});
		view.destroy();
	});
	it('corner cells have sg-corner-cell sg-header classes (background-color via CSS)', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator, positionProvider } = makeDefaultsWithPosition(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator, positionProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		const corners = container.querySelectorAll('.corner-cell');
		corners.forEach((corner) => {
			// Phase 58 CSSB-03: backgroundColor now via .sg-corner-cell + .sg-header CSS classes
			expect(corner.classList.contains('sg-corner-cell')).toBe(true);
			expect(corner.classList.contains('sg-header')).toBe(true);
		});
		view.destroy();
	});
	it('SuperPositionProvider changes do NOT trigger bridge.superGridQuery calls (not in StateCoordinator)', async () => {
		// SuperPositionProvider must NOT be registered with StateCoordinator
		// Verify: no additional bridge calls from position provider operations
		const { provider, filter, bridge, superGridQuerySpy, coordinator, positionProvider } = makeDefaultsWithPosition([]);
		const view = new SuperGrid({ provider, filter, bridge, coordinator, positionProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));
		const callCountAfterMount = superGridQuerySpy.mock.calls.length;

		// Directly mutate positionProvider state — should NOT trigger any bridge calls
		positionProvider.zoomLevel = 1.5;
		positionProvider.reset();
		await new Promise((r) => setTimeout(r, 0));

		expect(superGridQuerySpy.mock.calls.length).toBe(callCountAfterMount);
		view.destroy();
	});
});
// ---------------------------------------------------------------------------
// Phase 20 — SIZE-01, SIZE-02, SIZE-03, SIZE-04: SuperGridSizer integration
// ---------------------------------------------------------------------------

describe('SIZE-01/02/03/04 — SuperGridSizer integration in SuperGrid', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});
	it('_sizer.detach is called in destroy() — no handles remain after destroy', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));
		view.destroy();

		// After destroy, no handles remain (DOM removed)
		const handles = container.querySelectorAll('.col-resize-handle');
		expect(handles.length).toBe(0);
	});
});
// Run with: npx vitest bench tests/views/SuperGrid.bench.ts

// ---------------------------------------------------------------------------
// Phase 21 — SLCT-01/02/03/05/07: SuperSelect integration tests
// ---------------------------------------------------------------------------

// Helper: create a SuperGridSelectionLike mock
function makeMockSelectionAdapter() {
	const selectedCells = new Set<string>();
	const subscribers = new Set<() => void>();

	const adapter = {
		select: vi.fn((cardIds: string[]) => {
			selectedCells.clear();
			// track as cell keys in the adapter
			adapter._selectedCardIds = new Set(cardIds);
			subscribers.forEach((cb) => cb());
		}),
		addToSelection: vi.fn((_cardIds: string[]) => {
			subscribers.forEach((cb) => cb());
		}),
		clear: vi.fn(() => {
			selectedCells.clear();
			adapter._selectedCardIds = new Set();
			subscribers.forEach((cb) => cb());
		}),
		isSelectedCell: vi.fn((_cellKey: string) => false),
		isCardSelected: vi.fn((cardId: string) => adapter._selectedCardIds.has(cardId)),
		getSelectedCount: vi.fn(() => adapter._selectedCardIds.size),
		subscribe: vi.fn((cb: () => void) => {
			subscribers.add(cb);
			return () => subscribers.delete(cb);
		}),
		_selectedCardIds: new Set<string>(),
	};
	return adapter;
}

describe('SLCT — SuperSelect integration', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		cardCounter = 0;
	});

	afterEach(() => {
		if (container.parentElement) {
			document.body.removeChild(container);
		}
	});
	it('SLCT-07: Escape does nothing when grid is not mounted (no error)', () => {
		const { provider, filter, bridge, coordinator } = makeDefaults();
		const selectionAdapter = makeMockSelectionAdapter();
		const _view = new SuperGrid({ provider, filter, bridge, coordinator, selectionAdapter });
		// Do NOT mount — just check no error thrown when Escape pressed
		expect(() => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		}).not.toThrow();
		// clear should not have been called (no mounted grid)
		expect(selectionAdapter.clear).not.toHaveBeenCalled();
	});

	it('SLCT-07: non-Escape keys do NOT clear selection', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const selectionAdapter = makeMockSelectionAdapter();
		const view = new SuperGrid({ provider, filter, bridge, coordinator, selectionAdapter });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(selectionAdapter.clear).not.toHaveBeenCalled();
		view.destroy();
	});
	it('SuperGridSelect is detached in destroy() — SVG overlay removed', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const selectionAdapter = makeMockSelectionAdapter();
		const view = new SuperGrid({ provider, filter, bridge, coordinator, selectionAdapter });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));
		view.destroy();

		const svg = container.querySelector('svg');
		expect(svg).toBeNull();
	});
	// ---------------------------------------------------------------------------
	// No-op adapter (6th arg omitted) — no regression in existing tests
	// ---------------------------------------------------------------------------

	it('6th arg (selectionAdapter) is optional — constructor without it does not throw', () => {
		const { provider, filter, bridge, coordinator } = makeDefaults();
		expect(() => new SuperGrid({ provider, filter, bridge, coordinator })).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// SLCT-04 gap closure: isCardSelected + _updateSelectionVisuals fix
// ---------------------------------------------------------------------------

describe('SLCT — isCardSelected gap closure (Plan 21-04)', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		cardCounter = 0;
	});

	afterEach(() => {
		if (container.parentElement) {
			document.body.removeChild(container);
		}
	});

	it('SuperGridSelectionLike interface includes isCardSelected method', () => {
		// The interface must include isCardSelected so that _updateSelectionVisuals can use it
		const adapter: SuperGridSelectionLike = {
			select: vi.fn(),
			addToSelection: vi.fn(),
			clear: vi.fn(),
			isSelectedCell: vi.fn().mockReturnValue(false),
			isCardSelected: vi.fn().mockReturnValue(false),
			getSelectedCount: vi.fn().mockReturnValue(0),
			subscribe: vi.fn().mockReturnValue(() => {}),
		};
		expect(typeof adapter.isCardSelected).toBe('function');
	});
	it('cells whose card_ids are NOT selected have no blue tint or outline', async () => {
		const cells: CellDatum[] = [
			{ card_type: 'note', folder: 'A', count: 1, card_ids: ['unselected-card'], card_names: [] },
		];
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);

		const selectionAdapter: SuperGridSelectionLike = {
			select: vi.fn(),
			addToSelection: vi.fn(),
			clear: vi.fn(),
			isSelectedCell: vi.fn().mockReturnValue(false),
			isCardSelected: vi.fn().mockReturnValue(false), // no cards selected
			getSelectedCount: vi.fn().mockReturnValue(0),
			subscribe: vi.fn((cb: () => void) => {
				setTimeout(cb, 10);
				return () => {};
			}),
		};

		const view = new SuperGrid({ provider, filter, bridge, coordinator, selectionAdapter });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 50));

		const dataCells = container.querySelectorAll<HTMLElement>('.data-cell:not(.empty-cell)');
		let foundBlue = false;
		dataCells.forEach((cell) => {
			if (cell.style.backgroundColor === 'var(--selection-bg)') {
				foundBlue = true;
			}
			if (cell.style.outline === '2px solid var(--selection-outline)') {
				foundBlue = true;
			}
		});
		expect(foundBlue).toBe(false);
		view.destroy();
	});

	it('_noOpSelectionAdapter satisfies SuperGridSelectionLike including isCardSelected', () => {
		// Constructing SuperGrid with no 6th arg (uses _noOpSelectionAdapter) should not throw
		const { provider, filter, bridge, coordinator } = makeDefaults();
		expect(() => new SuperGrid({ provider, filter, bridge, coordinator })).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// DENS-01 / DENS-05 — Phase 22 Plan 02: Density toolbar + granularity picker
// ---------------------------------------------------------------------------

describe('DENS — density toolbar and granularity picker (Phase 22 Plan 02)', () => {
	let container: HTMLElement;

	beforeEach(() => {
		cardCounter = 0;
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	// Helper: create a mock density provider satisfying SuperGridDensityLike
	function makeMockDensity(
		overrides: {
			axisGranularity?: TimeGranularity | null;
			hideEmpty?: boolean;
			viewMode?: 'spreadsheet' | 'matrix';
		} = {},
	): SuperGridDensityLike & { setGranularity: ReturnType<typeof vi.fn>; _trigger: () => void } {
		const state = {
			axisGranularity: overrides.axisGranularity ?? null,
			hideEmpty: overrides.hideEmpty ?? false,
			viewMode: (overrides.viewMode ?? 'spreadsheet') as 'spreadsheet' | 'matrix',
			regionConfig: null as null,
		};
		const subscribers: Array<() => void> = [];
		const setGranularitySpy = vi.fn((g: TimeGranularity | null) => {
			state.axisGranularity = g;
		});
		return {
			getState: vi.fn(() => ({ ...state })),
			setGranularity: setGranularitySpy,
			setHideEmpty: vi.fn(),
			setViewMode: vi.fn(),
			subscribe: vi.fn((cb: () => void) => {
				subscribers.push(cb);
				return () => {};
			}),
			_trigger: () => subscribers.forEach((cb) => cb()),
		};
	}
	it('granularity picker is hidden when no time field is on any axis (toolbar remains visible)', async () => {
		// Default axes: card_type + folder (non-time)
		// Toolbar remains visible (has hide-empty + view-mode controls), but granularity picker is hidden
		const { provider, filter, bridge, coordinator } = makeDefaults([]);
		const density = makeMockDensity({ axisGranularity: null });
		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider: density });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));
		const toolbar = container.querySelector<HTMLElement>('.supergrid-density-toolbar');
		// Toolbar is visible (now always shows for hide-empty and view-mode controls)
		expect(toolbar?.style.display).not.toBe('none');
		// Granularity picker itself is hidden
		const picker = toolbar?.querySelector<HTMLElement>('.granularity-picker');
		if (picker) {
			expect(picker.style.display).toBe('none');
		}
		view.destroy();
	});

	it('granularity picker is shown when a time field (created_at) is on an axis', async () => {
		// Override provider to return a time field axis
		const timeProvider: SuperGridProviderLike = {
			getStackedGroupBySQL: vi.fn().mockReturnValue({
				colAxes: [{ field: 'created_at', direction: 'asc' }],
				rowAxes: [{ field: 'folder', direction: 'asc' }],
			}),
			setColAxes: vi.fn(),
			setRowAxes: vi.fn(),
			getColWidths: vi.fn().mockReturnValue({}),
			setColWidths: vi.fn(),
			getSortOverrides: vi.fn().mockReturnValue([]),
			setSortOverrides: vi.fn(),
			getCollapseState: vi.fn().mockReturnValue([]),
			setCollapseState: vi.fn(),
			reorderColAxes: vi.fn(),
			reorderRowAxes: vi.fn(),
			// Phase 84 — aggregation mode (defaults to 'count')
			getAggregation: vi.fn().mockReturnValue('count'),
		};
		const { filter, bridge, coordinator } = makeDefaults([]);
		const density = makeMockDensity({ axisGranularity: null });
		const view = new SuperGrid({ provider: timeProvider, filter, bridge, coordinator, densityProvider: density });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));
		const toolbar = container.querySelector<HTMLElement>('.supergrid-density-toolbar');
		// Toolbar should be visible (flex) when time axis present
		expect(toolbar?.style.display).not.toBe('none');
		view.destroy();
	});
	it('granularity change triggers bridge.superGridQuery with granularity in config', async () => {
		// Provider returns time field
		const timeProvider: SuperGridProviderLike = {
			getStackedGroupBySQL: vi.fn().mockReturnValue({
				colAxes: [{ field: 'created_at', direction: 'asc' }],
				rowAxes: [{ field: 'folder', direction: 'asc' }],
			}),
			setColAxes: vi.fn(),
			setRowAxes: vi.fn(),
			getColWidths: vi.fn().mockReturnValue({}),
			setColWidths: vi.fn(),
			getSortOverrides: vi.fn().mockReturnValue([]),
			setSortOverrides: vi.fn(),
			getCollapseState: vi.fn().mockReturnValue([]),
			setCollapseState: vi.fn(),
			reorderColAxes: vi.fn(),
			reorderRowAxes: vi.fn(),
			// Phase 84 — aggregation mode (defaults to 'count')
			getAggregation: vi.fn().mockReturnValue('count'),
		};
		const { filter, bridge, superGridQuerySpy, coordinator } = makeDefaults([]);
		const density = makeMockDensity({ axisGranularity: 'month' });
		const view = new SuperGrid({ provider: timeProvider, filter, bridge, coordinator, densityProvider: density });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		// Verify bridge.superGridQuery was called with granularity: 'month'
		expect(superGridQuerySpy).toHaveBeenCalled();
		const callArg = superGridQuerySpy.mock.calls[0]?.[0] as { granularity?: string } | undefined;
		expect(callArg?.granularity).toBe('month');
		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// Helper: create a mock density provider for Plan 22-03 tests (DENS-02, DENS-03)
// ---------------------------------------------------------------------------

function makeMockDensityProvider(overrides: { hideEmpty?: boolean; viewMode?: ViewMode } = {}): {
	densityProvider: SuperGridDensityLike;
	subscribers: Array<() => void>;
	notify: () => void;
} {
	const subscribers: Array<() => void> = [];
	const state = {
		axisGranularity: null as null,
		hideEmpty: overrides.hideEmpty ?? false,
		viewMode: (overrides.viewMode ?? 'matrix') as ViewMode,
		regionConfig: null as null,
	};
	const densityProvider: SuperGridDensityLike = {
		getState: vi.fn(() => ({ ...state })),
		setGranularity: vi.fn(),
		setHideEmpty: vi.fn((v: boolean) => {
			state.hideEmpty = v;
		}),
		setViewMode: vi.fn((v: ViewMode) => {
			state.viewMode = v;
		}),
		subscribe: vi.fn((cb: () => void) => {
			subscribers.push(cb);
			return () => {
				const idx = subscribers.indexOf(cb);
				if (idx >= 0) subscribers.splice(idx, 1);
			};
		}),
	};
	const notify = () => subscribers.forEach((cb) => cb());
	return { densityProvider, subscribers, notify };
}

// ---------------------------------------------------------------------------
// DENS-02 — Hide-empty client-side filter (Phase 22 Plan 03)
// ---------------------------------------------------------------------------

describe('DENS-02 — Hide-empty filter', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});
	it('Test 4: toggling hideEmpty re-renders from _lastCells without calling bridge.superGridQuery again', async () => {
		const cells: CellDatum[] = [
			{ card_type: 'note', folder: 'A', count: 2, card_ids: ['c1', 'c2'], card_names: [] },
			{ card_type: 'task', folder: 'A', count: 0, card_ids: [], card_names: [] },
		];
		const { provider, filter, coordinator } = makeDefaults([]);
		const { bridge, superGridQuerySpy } = makeMockBridge(cells);
		const { densityProvider, notify } = makeMockDensityProvider({ hideEmpty: false, viewMode: 'matrix' });

		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 10));

		const callsBefore = superGridQuerySpy.mock.calls.length;

		// Simulate hideEmpty toggle without granularity change
		(densityProvider.setHideEmpty as unknown as (v: boolean) => void)(true);
		notify();
		await new Promise((r) => setTimeout(r, 10));

		expect(superGridQuerySpy.mock.calls.length).toBe(callsBefore);
		view.destroy();
	});
	it('Test 6: "+N hidden" badge is not visible when hideEmpty=false or nothing is hidden', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 2, card_ids: ['c1', 'c2'], card_names: [] }];
		const { provider, filter, coordinator } = makeDefaults([]);
		const { bridge } = makeMockBridge(cells);
		const { densityProvider } = makeMockDensityProvider({ hideEmpty: false });

		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 10));

		const badge = container.querySelector('.supergrid-hidden-badge');
		if (badge) {
			expect((badge as HTMLElement).style.display).toBe('none');
		} else {
			expect(badge).toBeNull();
		}
		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// EMPTY-04 — Density-aware empty state message (Phase 43 Plan 02)
// ---------------------------------------------------------------------------

describe('EMPTY-04 — Density-aware empty state', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});
	it('does NOT show density message when hideEmpty=false and grid is genuinely empty (no data)', async () => {
		// No cells at all — genuinely empty grid, not density-filtered
		const cells: CellDatum[] = [];
		const { provider, filter, coordinator } = makeDefaults([]);
		const { bridge } = makeMockBridge(cells);
		const { densityProvider } = makeMockDensityProvider({ hideEmpty: false });

		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 10));

		const emptyMsg = container.querySelector('.sg-density-empty');
		expect(emptyMsg).toBeNull();

		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// DENS-03 — Spreadsheet mode card pills and matrix mode heat map (Phase 22 Plan 03)
// ---------------------------------------------------------------------------

describe('DENS-03 — View mode: spreadsheet and matrix', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});
	it('Test 4: matrix mode SuperCards do NOT have heat map background on the parent cell (CARD-02)', async () => {
		// Phase 27 CARD-02: SuperCards are visually distinct from heat map — parent cell has no background color
		const cells: CellDatum[] = [
			{ card_type: 'note', folder: 'A', count: 5, card_ids: ['c1', 'c2', 'c3', 'c4', 'c5'], card_names: [] },
		];
		const { provider, filter, coordinator } = makeDefaults([]);
		const { bridge } = makeMockBridge(cells);
		const { densityProvider } = makeMockDensityProvider({ viewMode: 'matrix' });

		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 10));

		const dataCells = container.querySelectorAll<HTMLElement>('.data-cell:not(.empty-cell)');
		// Parent cell should NOT have heat map background (backgroundColor is empty)
		let foundHeatBg = false;
		dataCells.forEach((cell) => {
			const bg = cell.style.backgroundColor;
			if (bg && bg !== '' && bg !== 'rgba(255, 255, 255, 0.02)') {
				foundHeatBg = true;
			}
		});
		expect(foundHeatBg).toBe(false);
		view.destroy();
	});
	it('Test 6: toggling viewMode re-renders from _lastCells without Worker re-query', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 2, card_ids: ['c1', 'c2'], card_names: [] }];
		const { provider, filter, coordinator } = makeDefaults([]);
		const { bridge, superGridQuerySpy } = makeMockBridge(cells);
		const { densityProvider, notify } = makeMockDensityProvider({ viewMode: 'matrix' });

		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 10));

		const callsBefore = superGridQuerySpy.mock.calls.length;

		(densityProvider.setViewMode as unknown as (v: string) => void)('spreadsheet');
		notify();
		await new Promise((r) => setTimeout(r, 10));

		expect(superGridQuerySpy.mock.calls.length).toBe(callsBefore);
		view.destroy();
	});
});
describe('FILT-02 — filter dropdown populated from _lastCells', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		cardCounter = 0;
	});

	afterEach(() => {
		if (container.parentElement) {
			document.body.removeChild(container);
		}
	});
	it('FILT-01: SuperGridFilterLike interface now includes hasAxisFilter, getAxisFilter, setAxisFilter, clearAxis, clearAllAxisFilters', () => {
		// TypeScript compile-time check via runtime verification
		const filter: SuperGridFilterLike = {
			compile: vi.fn().mockReturnValue({ where: '', params: [] }),
			hasAxisFilter: vi.fn().mockReturnValue(false),
			getAxisFilter: vi.fn().mockReturnValue([]),
			setAxisFilter: vi.fn(),
			clearAxis: vi.fn(),
			clearAllAxisFilters: vi.fn(),
		};
		expect(typeof filter.hasAxisFilter).toBe('function');
		expect(typeof filter.getAxisFilter).toBe('function');
		expect(typeof filter.setAxisFilter).toBe('function');
		expect(typeof filter.clearAxis).toBe('function');
		expect(typeof filter.clearAllAxisFilters).toBe('function');
	});
});
// ---------------------------------------------------------------------------
// Phase 25 — SuperSearch (SRCH-01/SRCH-02/SRCH-05)
// ---------------------------------------------------------------------------

describe('SRCH-01/SRCH-02/SRCH-05 — SuperSearch: Cmd+F, debounce, immediate clear', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		cardCounter = 0;
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		if (container.parentElement) {
			document.body.removeChild(container);
		}
	});
	// -------------------------------------------------------------------------
	// Lifecycle: destroy() cleanup
	// -------------------------------------------------------------------------

	it('destroy() removes Cmd+F keydown listener from document', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		vi.runAllTimers();
		await Promise.resolve();

		const superGridQuerySpy = bridge.superGridQuery as ReturnType<typeof vi.fn>;
		view.destroy();

		const callCountAfterDestroy = superGridQuerySpy.mock.calls.length;

		// After destroy, Cmd+F should not focus anything (no error thrown)
		expect(() => {
			const event = new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true });
			document.dispatchEvent(event);
		}).not.toThrow();

		// No additional queries fired (the handler is gone)
		expect(superGridQuerySpy.mock.calls.length).toBe(callCountAfterDestroy);
	});
	it('_fetchAndRender passes searchTerm as undefined when _searchTerm is empty', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		vi.runAllTimers();
		await Promise.resolve();

		const superGridQuerySpy = bridge.superGridQuery as ReturnType<typeof vi.fn>;

		// Initial render (no search term) — searchTerm should be undefined
		const lastCall = superGridQuerySpy.mock.calls[superGridQuerySpy.mock.calls.length - 1]!;
		expect(lastCall).toBeDefined();
		// searchTerm should be undefined (not empty string)
		expect(lastCall[0]!.searchTerm).toBeUndefined();

		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// Phase 25 — SRCH-03/SRCH-06: Cell highlight rendering and re-render survival
// ---------------------------------------------------------------------------

describe('SRCH-03/SRCH-06 — Search highlight rendering', () => {
	let container: HTMLElement;

	// Helper: create a mock density provider satisfying SuperGridDensityLike
	function makeMockDensityForSearch(viewMode: 'matrix' | 'spreadsheet' = 'matrix'): SuperGridDensityLike {
		const state = {
			axisGranularity: null as null,
			hideEmpty: false,
			viewMode: viewMode as 'matrix' | 'spreadsheet',
			regionConfig: null as null,
		};
		return {
			getState: vi.fn(() => ({ ...state })),
			setGranularity: vi.fn(),
			setHideEmpty: vi.fn(),
			setViewMode: vi.fn(),
			subscribe: vi.fn(() => () => {}),
		};
	}

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		cardCounter = 0;
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		if (container.parentElement) {
			document.body.removeChild(container);
		}
	});
	it('SRCH-03: when search is NOT active, cells have no sg-search-match class and opacity is empty string', async () => {
		const cells: CellDatum[] = [
			{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] } as CellDatum,
		];
		const density = makeMockDensityForSearch('matrix');
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider: density });
		view.mount(container);
		vi.runAllTimers();
		await Promise.resolve();

		// No search active — check cells have no highlight styling
		const dataCells = container.querySelectorAll<HTMLElement>('.data-cell');
		for (const cell of Array.from(dataCells)) {
			expect(cell.classList.contains('sg-search-match')).toBe(false);
			expect(cell.style.opacity).toBe('');
		}

		view.destroy();
	});
});
// ---------------------------------------------------------------------------
// TIME-01/TIME-02 — Phase 26 Plan 02: Auto-detection wiring in _fetchAndRender()
// ---------------------------------------------------------------------------

describe('TIME-01/TIME-02 — Auto-detection in _fetchAndRender()', () => {
	let container: HTMLElement;

	beforeEach(() => {
		cardCounter = 0;
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	// Helper: density mock for auto-detection tests
	function makeAutoDetectDensity(
		axisGranularity: TimeGranularity | null = null,
	): SuperGridDensityLike & { setGranularity: ReturnType<typeof vi.fn>; _trigger: () => void } {
		const state = {
			axisGranularity,
			hideEmpty: false,
			viewMode: 'matrix' as const,
			regionConfig: null as null,
		};
		const subscribers: Array<() => void> = [];
		const setGranularitySpy = vi.fn((g: TimeGranularity | null) => {
			state.axisGranularity = g;
		});
		return {
			getState: vi.fn(() => ({ ...state })),
			setGranularity: setGranularitySpy,
			setHideEmpty: vi.fn(),
			setViewMode: vi.fn(),
			subscribe: vi.fn((cb: () => void) => {
				subscribers.push(cb);
				return () => {};
			}),
			_trigger: () => subscribers.forEach((cb) => cb()),
		};
	}

	// Helper: time axis provider (created_at as col axis)
	function makeTimeAxisProvider(field = 'created_at'): SuperGridProviderLike {
		return {
			getStackedGroupBySQL: vi.fn().mockReturnValue({
				colAxes: [{ field, direction: 'asc' }],
				rowAxes: [{ field: 'folder', direction: 'asc' }],
			}),
			setColAxes: vi.fn(),
			setRowAxes: vi.fn(),
			getColWidths: vi.fn().mockReturnValue({}),
			setColWidths: vi.fn(),
			getSortOverrides: vi.fn().mockReturnValue([]),
			setSortOverrides: vi.fn(),
			getCollapseState: vi.fn().mockReturnValue([]),
			setCollapseState: vi.fn(),
			reorderColAxes: vi.fn(),
			reorderRowAxes: vi.fn(),
			// Phase 84 — aggregation mode (defaults to 'count')
			getAggregation: vi.fn().mockReturnValue('count'),
		};
	}
	it('TIME-01/02: loop guard — does NOT call setGranularity when computed level equals current', async () => {
		// Computed level will be 'year' (6-year span), but current is already 'year'
		// Guard: no setGranularity call should occur
		const cells: CellDatum[] = [
			{ created_at: '2020-01-01', folder: 'A', count: 3, card_ids: ['c1', 'c2', 'c3'], card_names: [] },
			{ created_at: '2026-01-01', folder: 'A', count: 1, card_ids: ['c4'], card_names: [] },
		];
		const density = makeAutoDetectDensity('year'); // already at computed level
		const { filter, coordinator } = makeDefaults([]);
		const bridge: SuperGridBridgeLike = {
			superGridQuery: vi.fn().mockResolvedValue(cells),
			calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
		};

		const view = new SuperGrid({
			provider: makeTimeAxisProvider(),
			filter,
			bridge,
			coordinator,
			densityProvider: density,
		});
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		expect(density.setGranularity).not.toHaveBeenCalled();
		view.destroy();
	});

	it('TIME-01/02: no setGranularity when cells have strftime-formatted values (already bucketed)', async () => {
		// '2026-01', '2026-02' = strftime output (can't be parsed as full ISO dates) → null → no detection
		const cells: CellDatum[] = [
			{ created_at: '2026-01', folder: 'A', count: 2, card_ids: ['c1', 'c2'], card_names: [] },
			{ created_at: '2026-02', folder: 'A', count: 3, card_ids: ['c3', 'c4', 'c5'], card_names: [] },
		];
		const density = makeAutoDetectDensity('month');
		const { filter, coordinator } = makeDefaults([]);
		const bridge: SuperGridBridgeLike = {
			superGridQuery: vi.fn().mockResolvedValue(cells),
			calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
		};

		const view = new SuperGrid({
			provider: makeTimeAxisProvider(),
			filter,
			bridge,
			coordinator,
			densityProvider: density,
		});
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		expect(density.setGranularity).not.toHaveBeenCalled();
		view.destroy();
	});

	it('TIME-01/02: no setGranularity when no time field on any axis', async () => {
		// Default axes: card_type + folder (non-time) → _computeSmartHierarchy returns null
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 1, card_ids: ['c1'], card_names: [] }];
		const density = makeAutoDetectDensity(null);
		const { provider, filter, coordinator } = makeDefaults(cells);
		const bridge: SuperGridBridgeLike = {
			superGridQuery: vi.fn().mockResolvedValue(cells),
			calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
		};

		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider: density });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		expect(density.setGranularity).not.toHaveBeenCalled();
		view.destroy();
	});
});
// ---------------------------------------------------------------------------
// Phase 27 — CARD-01/CARD-02: SuperCard rendering in matrix and spreadsheet modes
// ---------------------------------------------------------------------------

describe('CARD-01/CARD-02 — SuperCard rendering', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	// Helper: build view with density (matrix mode by default)
	function makeViewWithDensity(cells: CellDatum[], viewMode: 'matrix' | 'spreadsheet' = 'matrix') {
		const density: SuperGridDensityLike = {
			getState: vi.fn().mockReturnValue({
				axisGranularity: null,
				hideEmpty: false,
				viewMode,
				regionConfig: null,
			}),
			setGranularity: vi.fn(),
			setHideEmpty: vi.fn(),
			setViewMode: vi.fn(),
			subscribe: vi.fn(() => () => {}),
		};
		const { provider, filter, coordinator } = makeDefaults([]);
		const { bridge } = makeMockBridge(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider: density });
		return { view };
	}
	// VFST-01 spreadsheet: no card pills in value-first rendering
	it('CARD-01 spreadsheet: no card pills in value-first rendering (VFST-01)', async () => {
		const cells: CellDatum[] = [
			{ card_type: 'note', folder: 'A', count: 2, card_ids: ['c1', 'c2'], card_names: ['X', 'Y'] },
		];
		const { view } = makeViewWithDensity(cells, 'spreadsheet');
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		const pills = container.querySelectorAll('.card-pill');
		expect(pills.length).toBe(0);
		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// CARD-04 — Selection exclusion (SuperCard click does NOT trigger data-cell selection)
// ---------------------------------------------------------------------------

describe('CARD-04 — Selection exclusion', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		cardCounter = 0;
	});

	afterEach(() => {
		if (container.parentElement) document.body.removeChild(container);
	});
	it('CARD-04: classifyClickZone returns "supergrid-card" for element with .supergrid-card class', () => {
		const el = document.createElement('div');
		el.className = 'supergrid-card';
		el.setAttribute('data-supercard', 'true');
		document.body.appendChild(el);

		const zone = classifyClickZone(el);
		expect(zone).toBe('supergrid-card');

		document.body.removeChild(el);
	});
});

// ---------------------------------------------------------------------------
// CARD-05 — FTS search exclusion (SuperCard cells skip highlight during search)
// ---------------------------------------------------------------------------

describe('CARD-05 — FTS search exclusion', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		cardCounter = 0;
	});

	afterEach(() => {
		if (container.parentElement) document.body.removeChild(container);
	});

	function _makeViewWithSearch(cells: CellDatum[], searchTerm: string) {
		const density: SuperGridDensityLike = {
			getState: vi.fn().mockReturnValue({
				axisGranularity: null,
				hideEmpty: false,
				viewMode: 'matrix' as const,
				regionConfig: null,
			}),
			setGranularity: vi.fn(),
			setHideEmpty: vi.fn(),
			setViewMode: vi.fn(),
			subscribe: vi.fn(() => () => {}),
		};
		// Bridge returns cells with matchedCardIds for search
		const cellsWithMatch = cells.map((c) => ({
			...c,
			matchedCardIds: searchTerm ? c.card_ids : [],
		}));
		const { provider, filter, coordinator } = makeDefaults([]);
		const { bridge } = makeMockBridge(cellsWithMatch);
		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider: density });
		// Set the search term directly (simulating internal state)
		(view as unknown as { _searchTerm: string })._searchTerm = searchTerm;
		return { view };
	}

	it('CARD-05: SuperCard cells have normal opacity (not dimmed) when search is active and cell is a non-match', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 2, card_ids: ['c1', 'c2'], card_names: [] }];
		// Provide cells without matchedCardIds to simulate non-match
		const density: SuperGridDensityLike = {
			getState: vi.fn().mockReturnValue({
				axisGranularity: null,
				hideEmpty: false,
				viewMode: 'matrix' as const,
				regionConfig: null,
			}),
			setGranularity: vi.fn(),
			setHideEmpty: vi.fn(),
			setViewMode: vi.fn(),
			subscribe: vi.fn(() => () => {}),
		};
		const cellsNoMatch = [{ ...cells[0]!, matchedCardIds: [] }];
		const { provider, filter, coordinator } = makeDefaults([]);
		const { bridge } = makeMockBridge(cellsNoMatch);
		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider: density });
		(view as unknown as { _searchTerm: string })._searchTerm = 'some-search';
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		// Find a data cell that contains a SuperCard
		const dataCells = container.querySelectorAll('.data-cell');
		let superCardCell: HTMLElement | null = null;
		dataCells.forEach((cell) => {
			if (cell.querySelector('[data-supercard]')) {
				superCardCell = cell as HTMLElement;
			}
		});

		// If SuperCard cell found, its opacity should NOT be '0.4' (dimmed)
		if (superCardCell) {
			expect((superCardCell as HTMLElement).style.opacity).not.toBe('0.4');
		}
		view.destroy();
	});

	it('CARD-05: SuperCard cells do NOT get sg-search-match class during search', async () => {
		const cells: CellDatum[] = [{ card_type: 'note', folder: 'A', count: 2, card_ids: ['c1', 'c2'], card_names: [] }];
		const density: SuperGridDensityLike = {
			getState: vi.fn().mockReturnValue({
				axisGranularity: null,
				hideEmpty: false,
				viewMode: 'matrix' as const,
				regionConfig: null,
			}),
			setGranularity: vi.fn(),
			setHideEmpty: vi.fn(),
			setViewMode: vi.fn(),
			subscribe: vi.fn(() => () => {}),
		};
		// Simulate: cells with matchedCardIds to trigger highlight path
		const cellsWithMatch = [{ ...cells[0]!, matchedCardIds: ['c1'] }];
		const { provider, filter, coordinator } = makeDefaults([]);
		const { bridge } = makeMockBridge(cellsWithMatch);
		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider: density });
		(view as unknown as { _searchTerm: string })._searchTerm = 'some-search';
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		// Data cells that contain SuperCard should NOT have sg-search-match class
		const dataCells = container.querySelectorAll('.data-cell');
		dataCells.forEach((cell) => {
			if (cell.querySelector('[data-supercard]')) {
				expect(cell.classList.contains('sg-search-match')).toBe(false);
			}
		});
		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// PLSH-04 — Help overlay (Cmd+/ shortcut + '?' button)
// ---------------------------------------------------------------------------

describe('PLSH-04 — Help overlay', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		cardCounter = 0;
	});

	afterEach(() => {
		if (container.parentElement) document.body.removeChild(container);
	});
	it('PLSH-04: pressing Escape when overlay open does NOT clear selection (overlay handles it first)', async () => {
		const { provider, filter, bridge, coordinator } = makeDefaults([]);
		const selection: SuperGridSelectionLike = {
			select: vi.fn(),
			addToSelection: vi.fn(),
			clear: vi.fn(),
			isSelectedCell: vi.fn().mockReturnValue(false),
			isCardSelected: vi.fn().mockReturnValue(false),
			getSelectedCount: vi.fn().mockReturnValue(0),
			subscribe: vi.fn(() => () => {}),
		};
		const view = new SuperGrid({ provider, filter, bridge, coordinator, selectionAdapter: selection });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		// Open overlay
		document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', metaKey: true, bubbles: true }));

		// Press Escape -- overlay closes but selection.clear should NOT be called
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(container.querySelector('.sg-help-overlay')).toBeNull();
		expect(selection.clear).not.toHaveBeenCalled();
		view.destroy();
	});
	it('PLSH-04: destroy() removes the Cmd+/ keydown listener (no overlay after destroy)', async () => {
		const { provider, filter, bridge, coordinator } = makeDefaults([]);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		view.destroy();

		// Dispatching Cmd+/ after destroy should not create overlay (no container to append to)
		document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', metaKey: true, bubbles: true }));

		// rootEl is null after destroy so no overlay can be created
		expect(document.querySelector('.sg-help-overlay')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// PLSH-05 -- Right-click context menu on headers
// ---------------------------------------------------------------------------

describe('PLSH-05 -- Right-click context menu', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		cardCounter = 0;
	});

	afterEach(() => {
		if (container.parentElement) document.body.removeChild(container);
	});

	function makeGridWithCells() {
		const cells: CellDatum[] = [
			{ card_type: 'note', folder: 'A', count: 2, card_ids: ['c1', 'c2'], card_names: [] },
			{ card_type: 'task', folder: 'B', count: 1, card_ids: ['c3'], card_names: [] },
		];
		return cells;
	}
	it('PLSH-05: right-clicking non-header area does not show context menu', async () => {
		const cells = makeGridWithCells();
		const { provider, filter, bridge, coordinator } = makeDefaults(cells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		// Right-click on a data cell (not a header)
		const dataCell = container.querySelector<HTMLElement>('.data-cell');
		if (dataCell) {
			dataCell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
			expect(container.querySelector('.sg-context-menu')).toBeNull();
		}
		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// SuperGrid compound keys (Phase 28) — STAK-03, STAK-04
// ---------------------------------------------------------------------------

describe('SuperGrid compound keys (Phase 28)', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		cardCounter = 0;
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	// Helper: build a provider mock with multi-level axes
	function makeMultiAxisProvider(
		colAxes: Array<{ field: string; direction: 'asc' | 'desc' }>,
		rowAxes: Array<{ field: string; direction: 'asc' | 'desc' }>,
	): SuperGridProviderLike {
		return {
			getStackedGroupBySQL: vi.fn().mockReturnValue({ colAxes, rowAxes }),
			setColAxes: vi.fn(),
			setRowAxes: vi.fn(),
			getColWidths: vi.fn().mockReturnValue({}),
			setColWidths: vi.fn(),
			getSortOverrides: vi.fn().mockReturnValue([]),
			setSortOverrides: vi.fn(),
			getCollapseState: vi.fn().mockReturnValue([]),
			setCollapseState: vi.fn(),
			reorderColAxes: vi.fn(),
			reorderRowAxes: vi.fn(),
			// Phase 84 — aggregation mode (defaults to 'count')
			getAggregation: vi.fn().mockReturnValue('count'),
		};
	}
	it('STAK-03: all data-cell keys are unique with multi-level axes (D3 join identity)', async () => {
		// 2 col axes, 2 row axes — ensures no duplicate keys
		const cells: CellDatum[] = [
			{ card_type: 'note', status: 'active', folder: 'Work', priority: 1, count: 1, card_ids: ['c1'], card_names: [] },
			{
				card_type: 'note',
				status: 'done',
				folder: 'Work',
				priority: 1,
				count: 2,
				card_ids: ['c2', 'c3'],
				card_names: [],
			},
			{ card_type: 'task', status: 'active', folder: 'Work', priority: 1, count: 0, card_ids: [], card_names: [] },
			{ card_type: 'task', status: 'done', folder: 'Work', priority: 1, count: 1, card_ids: ['c4'], card_names: [] },
		];
		const provider = makeMultiAxisProvider(
			[
				{ field: 'card_type', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
			],
			[{ field: 'folder', direction: 'asc' }],
		);
		const { filter, bridge: _bridge, coordinator } = makeDefaults(cells);
		const { bridge: b2 } = makeMockBridge(cells);
		const view = new SuperGrid({ provider, filter, bridge: b2, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		const dataCells = container.querySelectorAll<HTMLElement>('.data-cell');
		const keys = Array.from(dataCells).map((c) => c.dataset['key'] ?? '');
		const uniqueKeys = new Set(keys);
		expect(uniqueKeys.size).toBe(dataCells.length);
		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// RHDR — Multi-Level Row Headers (Phase 29)
// ---------------------------------------------------------------------------
// RED PHASE: These tests define the rendering contract that Plan 02 must satisfy.
// All tests in this describe block are expected to FAIL until Plan 02 implements
// multi-level row header rendering.
// ---------------------------------------------------------------------------

describe('RHDR — Multi-Level Row Headers (Phase 29)', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	// ---------------------------------------------------------------------------
	// Helper: build a provider mock with 2 row axes + 1 col axis
	// folder (level 0) + status (level 1) as row axes, card_type as col axis
	// ---------------------------------------------------------------------------
	function makeMultiRowAxisProvider(
		colAxes: Array<{ field: string; direction: 'asc' | 'desc' }>,
		rowAxes: Array<{ field: string; direction: 'asc' | 'desc' }>,
	): SuperGridProviderLike {
		return {
			getStackedGroupBySQL: vi.fn().mockReturnValue({ colAxes, rowAxes }),
			setColAxes: vi.fn(),
			setRowAxes: vi.fn(),
			getColWidths: vi.fn().mockReturnValue({}),
			setColWidths: vi.fn(),
			getSortOverrides: vi.fn().mockReturnValue([]),
			setSortOverrides: vi.fn(),
			getCollapseState: vi.fn().mockReturnValue([]),
			setCollapseState: vi.fn(),
			reorderColAxes: vi.fn(),
			reorderRowAxes: vi.fn(),
			// Phase 84 — aggregation mode (defaults to 'count')
			getAggregation: vi.fn().mockReturnValue('count'),
		};
	}

	// Standard 2-row-axis test data:
	// folder=Work → status=active + status=done
	// folder=Personal → status=active
	const multiRowCells: CellDatum[] = [
		{ card_type: 'note', folder: 'Work', status: 'active', count: 2, card_ids: ['c1', 'c2'], card_names: [] },
		{ card_type: 'note', folder: 'Work', status: 'done', count: 1, card_ids: ['c3'], card_names: [] },
		{ card_type: 'note', folder: 'Personal', status: 'active', count: 3, card_ids: ['c4', 'c5', 'c6'], card_names: [] },
		{ card_type: 'task', folder: 'Work', status: 'active', count: 0, card_ids: [], card_names: [] },
		{ card_type: 'task', folder: 'Work', status: 'done', count: 1, card_ids: ['c7'], card_names: [] },
		{ card_type: 'task', folder: 'Personal', status: 'active', count: 2, card_ids: ['c8', 'c9'], card_names: [] },
	];
	// ---------------------------------------------------------------------------
	// RHDR-02: Axis grips present at each level with correct data-axis-index
	// ---------------------------------------------------------------------------
	it('renders axis-grip on every row header level with correct data-axis-index (RHDR-02)', async () => {
		const provider = makeMultiRowAxisProvider(
			[{ field: 'card_type', direction: 'asc' }],
			[
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
			],
		);
		const { filter, coordinator } = makeDefaults(multiRowCells);
		const { bridge } = makeMockBridge(multiRowCells);
		const view = new SuperGrid({ provider, filter, bridge, coordinator });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 0));

		const rowHeaders = container.querySelectorAll<HTMLElement>('.row-header');

		// Every row header should have an .axis-grip child
		let allHaveGrip = true;
		for (const header of rowHeaders) {
			if (!header.querySelector('.axis-grip')) {
				allHaveGrip = false;
				break;
			}
		}
		expect(allHaveGrip).toBe(true);

		// Level 0 row headers (data-level="0") should have grips with data-axis-index="0"
		const level0Headers = Array.from(rowHeaders).filter((h) => h.dataset['level'] === '0');
		for (const header of level0Headers) {
			const grip = header.querySelector<HTMLElement>('.axis-grip');
			expect(grip?.dataset['axisIndex']).toBe('0');
			expect(grip?.dataset['axisDimension']).toBe('row');
		}

		// Level 1 row headers (data-level="1") should have grips with data-axis-index="1"
		const level1Headers = Array.from(rowHeaders).filter((h) => h.dataset['level'] === '1');
		for (const header of level1Headers) {
			const grip = header.querySelector<HTMLElement>('.axis-grip');
			expect(grip?.dataset['axisIndex']).toBe('1');
			expect(grip?.dataset['axisDimension']).toBe('row');
		}

		view.destroy();
	});
});
// ---------------------------------------------------------------------------
// VFST-03 — Overflow badge tooltip (Phase 59 Plan 02)
// ---------------------------------------------------------------------------

describe('VFST-03 — overflow badge tooltip', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});
	it('single-card cell has no badge, therefore no tooltip trigger', async () => {
		const cells: CellDatum[] = [
			{
				card_type: 'note',
				folder: 'A',
				count: 1,
				card_ids: ['c1'],
				card_names: ['Single Card'],
				matchedCardIds: [],
			} as CellDatum,
		];
		const { provider, filter, coordinator } = makeDefaults([]);
		const { bridge } = makeMockBridge(cells);
		const { densityProvider } = makeMockDensityProvider({ viewMode: 'spreadsheet' });

		const view = new SuperGrid({ provider, filter, bridge, coordinator, densityProvider });
		view.mount(container);
		await new Promise((r) => setTimeout(r, 10));

		const badge = container.querySelector('.sg-cell-overflow-badge');
		expect(badge).toBeNull();

		const tooltip = container.querySelector('.sg-overflow-tooltip');
		expect(tooltip).toBeNull();

		view.destroy();
	});
});