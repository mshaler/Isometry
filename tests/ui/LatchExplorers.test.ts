// @vitest-environment jsdom
// Isometry v5 — Phase 67
// Tests for LatchExplorers: LATCH axis filter sections with mount/update/destroy lifecycle.
//
// Requirements: LTCH-01, LTCH-02, LTPB-03, LTPB-04
// TDD Phase: RED -> GREEN -> REFACTOR

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Filter } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// Mock types
// ---------------------------------------------------------------------------

interface MockFilterProvider {
	addFilter: ReturnType<typeof vi.fn>;
	removeFilter: ReturnType<typeof vi.fn>;
	getFilters: ReturnType<typeof vi.fn>;
	setAxisFilter: ReturnType<typeof vi.fn>;
	clearAxis: ReturnType<typeof vi.fn>;
	hasAxisFilter: ReturnType<typeof vi.fn>;
	getAxisFilter: ReturnType<typeof vi.fn>;
	clearAllAxisFilters: ReturnType<typeof vi.fn>;
	hasActiveFilters: ReturnType<typeof vi.fn>;
	subscribe: ReturnType<typeof vi.fn>;
	// Phase 66: range filter API
	hasRangeFilter: ReturnType<typeof vi.fn>;
	clearRangeFilter: ReturnType<typeof vi.fn>;
	setRangeFilter: ReturnType<typeof vi.fn>;
	compile: ReturnType<typeof vi.fn>;
}

interface MockBridge {
	send: ReturnType<typeof vi.fn>;
}

interface MockCoordinator {
	subscribe: ReturnType<typeof vi.fn>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockFilter(): MockFilterProvider {
	const subscribers = new Set<() => void>();
	return {
		addFilter: vi.fn(),
		removeFilter: vi.fn(),
		getFilters: vi.fn().mockReturnValue([]),
		setAxisFilter: vi.fn(),
		clearAxis: vi.fn(),
		hasAxisFilter: vi.fn().mockReturnValue(false),
		getAxisFilter: vi.fn().mockReturnValue([]),
		clearAllAxisFilters: vi.fn(),
		hasActiveFilters: vi.fn().mockReturnValue(false),
		subscribe: vi.fn((cb: () => void) => {
			subscribers.add(cb);
			return () => subscribers.delete(cb);
		}),
		// Phase 66: range filter API
		hasRangeFilter: vi.fn().mockReturnValue(false),
		clearRangeFilter: vi.fn(),
		setRangeFilter: vi.fn(),
		compile: vi.fn().mockReturnValue({ where: 'deleted_at IS NULL', params: [] }),
	};
}

/** Notify all filter subscribers (simulates FilterProvider scheduling). */
function notifyFilterSubscribers(filter: MockFilterProvider): void {
	const calls = filter.subscribe.mock.calls as Array<[() => void]>;
	for (const [cb] of calls) {
		cb();
	}
}

function createMockBridge(): MockBridge {
	return {
		send: vi.fn().mockImplementation((type: string) => {
			if (type === 'histogram:query') return Promise.resolve({ bins: [] });
			return Promise.resolve({ rows: [] });
		}),
	};
}

function createMockCoordinator(): MockCoordinator {
	return {
		subscribe: vi.fn((_cb: () => void) => {
			return () => {};
		}),
	};
}

// Dynamic import for TDD RED phase
let LatchExplorers: typeof import('../../src/ui/LatchExplorers').LatchExplorers;

beforeEach(async () => {
	const mod = await import('../../src/ui/LatchExplorers');
	LatchExplorers = mod.LatchExplorers;
});

// ---------------------------------------------------------------------------
// DOM structure after mount
// ---------------------------------------------------------------------------

describe('LatchExplorers — mount DOM structure', () => {
	let container: HTMLDivElement;
	let filter: MockFilterProvider;
	let bridge: MockBridge;
	let coordinator: MockCoordinator;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		filter = createMockFilter();
		bridge = createMockBridge();
		coordinator = createMockCoordinator();
	});

	afterEach(() => {
		container.remove();
	});

	it('mount() creates .latch-explorers root element', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		const root = container.querySelector('.latch-explorers');
		expect(root).not.toBeNull();

		explorers.destroy();
	});

	it('mount() creates 5 CollapsibleSection sub-sections (L, A, T, C, H)', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		const sections = container.querySelectorAll('.collapsible-section');
		expect(sections.length).toBe(5);

		explorers.destroy();
	});

	it('mount() creates Clear all button', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		const clearBtn = container.querySelector('.latch-explorers__clear-all');
		expect(clearBtn).not.toBeNull();

		explorers.destroy();
	});

	it('Clear all button is initially hidden', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		const clearBtn = container.querySelector('.latch-explorers__clear-all') as HTMLElement;
		expect(clearBtn.style.display).toBe('none');

		explorers.destroy();
	});
});

// ---------------------------------------------------------------------------
// Location section — empty state
// ---------------------------------------------------------------------------

describe('LatchExplorers — Location section', () => {
	let container: HTMLDivElement;
	let filter: MockFilterProvider;
	let bridge: MockBridge;
	let coordinator: MockCoordinator;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		filter = createMockFilter();
		bridge = createMockBridge();
		coordinator = createMockCoordinator();
	});

	afterEach(() => {
		container.remove();
	});

	it('Location section shows empty state placeholder', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		const emptyEl = container.querySelector('.latch-explorers__empty');
		expect(emptyEl).not.toBeNull();
		expect(emptyEl!.textContent).toContain('No location properties available');

		explorers.destroy();
	});
});

// ---------------------------------------------------------------------------
// Alphabet section — text search input
// ---------------------------------------------------------------------------

describe('LatchExplorers — Alphabet section', () => {
	let container: HTMLDivElement;
	let filter: MockFilterProvider;
	let bridge: MockBridge;
	let coordinator: MockCoordinator;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		filter = createMockFilter();
		bridge = createMockBridge();
		coordinator = createMockCoordinator();
	});

	afterEach(() => {
		container.remove();
	});

	it('Alphabet section has a search input', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		const searchInput = container.querySelector('.latch-explorers__search-input');
		expect(searchInput).not.toBeNull();
		expect((searchInput as HTMLInputElement).type).toBe('text');

		explorers.destroy();
	});

	it('typing in search input calls addFilter with contains after debounce', async () => {
		vi.useFakeTimers();
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		const searchInput = container.querySelector('.latch-explorers__search-input') as HTMLInputElement;
		searchInput.value = 'hello';
		searchInput.dispatchEvent(new Event('input', { bubbles: true }));

		// Before debounce (300ms), addFilter should not be called
		expect(filter.addFilter).not.toHaveBeenCalled();

		// After debounce
		vi.advanceTimersByTime(300);

		expect(filter.addFilter).toHaveBeenCalledWith({ field: 'name', operator: 'contains', value: 'hello' });

		explorers.destroy();
		vi.useRealTimers();
	});

	it('clearing search input removes name contains filter', async () => {
		vi.useFakeTimers();
		// Simulate existing name contains filter
		filter.getFilters.mockReturnValue([{ field: 'name', operator: 'contains', value: 'hello' }]);

		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		const searchInput = container.querySelector('.latch-explorers__search-input') as HTMLInputElement;
		searchInput.value = '';
		searchInput.dispatchEvent(new Event('input', { bubbles: true }));

		vi.advanceTimersByTime(300);

		expect(filter.removeFilter).toHaveBeenCalledWith(0);

		explorers.destroy();
		vi.useRealTimers();
	});
});

// ---------------------------------------------------------------------------
// Category section — chip pills (Phase 67)
// ---------------------------------------------------------------------------

describe('LatchExplorers — Category chip pills', () => {
	let container: HTMLDivElement;
	let filter: MockFilterProvider;
	let bridge: MockBridge;
	let coordinator: MockCoordinator;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		filter = createMockFilter();
		bridge = createMockBridge();
		coordinator = createMockCoordinator();
	});

	afterEach(() => {
		container.remove();
	});

	it('Category section renders chip pills for folder, status, card_type', async () => {
		// Bridge returns distinct values with counts via GROUP BY
		bridge.send.mockImplementation((_type: string, payload: any) => {
			const sql = payload.sql as string;
			if (sql.includes('folder'))
				return Promise.resolve({
					rows: [
						{ folder: 'Work', count: 10 },
						{ folder: 'Personal', count: 5 },
					],
				});
			if (sql.includes('status')) return Promise.resolve({ rows: [{ status: 'active', count: 8 }] });
			if (sql.includes('card_type')) return Promise.resolve({ rows: [{ card_type: 'note', count: 3 }] });
			return Promise.resolve({ rows: [] });
		});

		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		// Wait for async bridge calls to resolve
		await vi.waitFor(() => {
			const chips = container.querySelectorAll('.latch-explorers__chip');
			expect(chips.length).toBeGreaterThanOrEqual(3);
		});

		explorers.destroy();
	});

	it('chip pills display count badges', async () => {
		bridge.send.mockImplementation((_type: string, payload: any) => {
			const sql = payload.sql as string;
			if (sql.includes('folder'))
				return Promise.resolve({
					rows: [
						{ folder: 'Work', count: 10 },
						{ folder: 'Personal', count: 5 },
					],
				});
			if (sql.includes('status')) return Promise.resolve({ rows: [] });
			if (sql.includes('card_type')) return Promise.resolve({ rows: [] });
			if (sql.includes('priority')) return Promise.resolve({ rows: [] });
			if (sql.includes('sort_order')) return Promise.resolve({ rows: [] });
			return Promise.resolve({ rows: [] });
		});

		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		await vi.waitFor(() => {
			const chips = container.querySelectorAll('.latch-explorers__chip');
			expect(chips.length).toBeGreaterThanOrEqual(2);
		});

		const firstCount = container.querySelector('.latch-explorers__chip-count');
		expect(firstCount).not.toBeNull();
		expect(firstCount!.textContent).toBe('10');

		explorers.destroy();
	});

	it('clicking a chip calls setAxisFilter to toggle value on', async () => {
		bridge.send.mockImplementation((_type: string, payload: any) => {
			const sql = payload.sql as string;
			if (sql.includes('folder'))
				return Promise.resolve({
					rows: [
						{ folder: 'Work', count: 10 },
						{ folder: 'Personal', count: 5 },
					],
				});
			if (sql.includes('status')) return Promise.resolve({ rows: [] });
			if (sql.includes('card_type')) return Promise.resolve({ rows: [] });
			if (sql.includes('priority')) return Promise.resolve({ rows: [] });
			if (sql.includes('sort_order')) return Promise.resolve({ rows: [] });
			return Promise.resolve({ rows: [] });
		});

		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		await vi.waitFor(() => {
			const chips = container.querySelectorAll('.latch-explorers__chip');
			expect(chips.length).toBeGreaterThanOrEqual(2);
		});

		// Click the first chip (folder: 'Work')
		const firstChip = container.querySelectorAll('.latch-explorers__chip')[0] as HTMLButtonElement;
		firstChip.click();

		expect(filter.setAxisFilter).toHaveBeenCalledWith('folder', ['Work']);

		explorers.destroy();
	});

	it('clicking an active chip toggles value off', async () => {
		// Pre-set axis filter with 'Work' already active
		filter.getAxisFilter.mockImplementation((field: string) => (field === 'folder' ? ['Work'] : []));

		bridge.send.mockImplementation((_type: string, payload: any) => {
			const sql = payload.sql as string;
			if (sql.includes('folder'))
				return Promise.resolve({
					rows: [
						{ folder: 'Work', count: 10 },
						{ folder: 'Personal', count: 5 },
					],
				});
			if (sql.includes('status')) return Promise.resolve({ rows: [] });
			if (sql.includes('card_type')) return Promise.resolve({ rows: [] });
			if (sql.includes('priority')) return Promise.resolve({ rows: [] });
			if (sql.includes('sort_order')) return Promise.resolve({ rows: [] });
			return Promise.resolve({ rows: [] });
		});

		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		await vi.waitFor(() => {
			const chips = container.querySelectorAll('.latch-explorers__chip');
			expect(chips.length).toBeGreaterThanOrEqual(2);
		});

		// Click the first chip (folder: 'Work') — should toggle off
		const firstChip = container.querySelectorAll('.latch-explorers__chip')[0] as HTMLButtonElement;
		firstChip.click();

		// Should call setAxisFilter with 'Work' removed (empty array)
		expect(filter.setAxisFilter).toHaveBeenCalledWith('folder', []);

		explorers.destroy();
	});

	it('uses GROUP BY COUNT query for chip data', async () => {
		bridge.send.mockImplementation((_type: string) => {
			return Promise.resolve({ rows: [] });
		});

		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		// Wait for async bridge calls
		await vi.waitFor(() => {
			expect(bridge.send).toHaveBeenCalled();
		});

		// Verify at least one call uses GROUP BY COUNT pattern
		const calls = bridge.send.mock.calls as Array<[string, any]>;
		const dbQueryCalls = calls.filter(([type]) => type === 'db:query');
		const hasGroupBy = dbQueryCalls.some(([, payload]) => {
			const sql = (payload as any).sql as string;
			return sql.includes('COUNT(*)') && sql.includes('GROUP BY');
		});
		expect(hasGroupBy).toBe(true);

		explorers.destroy();
	});
});

// ---------------------------------------------------------------------------
// Time section — preset range buttons
// ---------------------------------------------------------------------------

describe('LatchExplorers — Time preset buttons', () => {
	let container: HTMLDivElement;
	let filter: MockFilterProvider;
	let bridge: MockBridge;
	let coordinator: MockCoordinator;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		filter = createMockFilter();
		bridge = createMockBridge();
		coordinator = createMockCoordinator();
	});

	afterEach(() => {
		container.remove();
	});

	it('Time section shows preset range buttons', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		const presetBtns = container.querySelectorAll('.latch-explorers__time-preset');
		// 3 time fields x 4 presets = 12 buttons
		expect(presetBtns.length).toBe(12);

		explorers.destroy();
	});

	it('clicking a time preset calls addFilter with gte and lte', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		const firstPreset = container.querySelector('.latch-explorers__time-preset') as HTMLButtonElement;
		firstPreset.click();

		// Should have 2 calls: gte and lte
		expect(filter.addFilter).toHaveBeenCalledTimes(2);
		const calls = filter.addFilter.mock.calls as Array<[Filter]>;
		expect(calls[0]![0].operator).toBe('gte');
		expect(calls[1]![0].operator).toBe('lte');

		explorers.destroy();
	});

	it('clicking an already-active preset toggles it off (clears filters)', () => {
		// Simulate existing time filters
		filter.getFilters.mockReturnValue([
			{ field: 'created_at', operator: 'gte', value: '2026-01-01' },
			{ field: 'created_at', operator: 'lte', value: '2026-02-01' },
		]);

		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		// Click "Today" first to make it active
		const firstPreset = container.querySelector('.latch-explorers__time-preset') as HTMLButtonElement;
		firstPreset.click();

		// Now click it again (toggle off) — should remove filters but not add new ones
		filter.addFilter.mockClear();
		filter.removeFilter.mockClear();
		filter.getFilters.mockReturnValue([
			{ field: 'created_at', operator: 'gte', value: '2026-03-08' },
			{ field: 'created_at', operator: 'lte', value: '2026-03-09' },
		]);
		firstPreset.click();

		// Should have called removeFilter to clear existing gte/lte, but NOT added new ones
		expect(filter.removeFilter).toHaveBeenCalled();
		expect(filter.addFilter).not.toHaveBeenCalled();

		explorers.destroy();
	});
});

// ---------------------------------------------------------------------------
// Filter subscription — badge count updates
// ---------------------------------------------------------------------------

describe('LatchExplorers — badge count updates', () => {
	let container: HTMLDivElement;
	let filter: MockFilterProvider;
	let bridge: MockBridge;
	let coordinator: MockCoordinator;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		filter = createMockFilter();
		bridge = createMockBridge();
		coordinator = createMockCoordinator();
	});

	afterEach(() => {
		container.remove();
	});

	it('filter subscription updates count badges on section headers', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		// Verify subscribe was called
		expect(filter.subscribe).toHaveBeenCalled();

		// Simulate Category axis having active filters
		filter.hasAxisFilter.mockImplementation((field: string) => field === 'folder');

		// Fire the subscriber
		notifyFilterSubscribers(filter);

		// Category section should have a visible count badge
		const countBadges = container.querySelectorAll('.collapsible-section__count');
		// Find the Category section count badge (4th section — index 3)
		const categoryCount = countBadges[3] as HTMLElement;
		expect(categoryCount.style.display).not.toBe('none');

		explorers.destroy();
	});
});

// ---------------------------------------------------------------------------
// Clear all button
// ---------------------------------------------------------------------------

describe('LatchExplorers — Clear all button', () => {
	let container: HTMLDivElement;
	let filter: MockFilterProvider;
	let bridge: MockBridge;
	let coordinator: MockCoordinator;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		filter = createMockFilter();
		bridge = createMockBridge();
		coordinator = createMockCoordinator();
	});

	afterEach(() => {
		container.remove();
	});

	it('Clear all button calls clearAllAxisFilters when clicked', () => {
		filter.hasActiveFilters.mockReturnValue(true);
		filter.hasAxisFilter.mockReturnValue(true);

		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		// Make Clear all visible by simulating filter subscription notification
		notifyFilterSubscribers(filter);

		const clearBtn = container.querySelector('.latch-explorers__clear-all') as HTMLElement;
		clearBtn.click();

		expect(filter.clearAllAxisFilters).toHaveBeenCalled();

		explorers.destroy();
	});

	it('Clear all button becomes visible when filters are active', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		const clearBtn = container.querySelector('.latch-explorers__clear-all') as HTMLElement;
		expect(clearBtn.style.display).toBe('none');

		// Simulate active axis filter on folder field
		filter.hasAxisFilter.mockImplementation((field: string) => field === 'folder');
		notifyFilterSubscribers(filter);

		expect(clearBtn.style.display).not.toBe('none');

		explorers.destroy();
	});
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe('LatchExplorers — destroy', () => {
	let container: HTMLDivElement;
	let filter: MockFilterProvider;
	let bridge: MockBridge;
	let coordinator: MockCoordinator;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		filter = createMockFilter();
		bridge = createMockBridge();
		coordinator = createMockCoordinator();
	});

	afterEach(() => {
		container.remove();
	});

	it('destroy() removes root element from DOM', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		expect(container.querySelector('.latch-explorers')).not.toBeNull();
		explorers.destroy();
		expect(container.querySelector('.latch-explorers')).toBeNull();
	});

	it('destroy() unsubscribes from FilterProvider', () => {
		const unsubscribe = vi.fn();
		filter.subscribe.mockReturnValue(unsubscribe);

		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);
		explorers.destroy();

		expect(unsubscribe).toHaveBeenCalled();
	});

	it('destroy() unsubscribes from coordinator', () => {
		const unsubscribe = vi.fn();
		coordinator.subscribe.mockReturnValue(unsubscribe);

		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);
		explorers.destroy();

		expect(unsubscribe).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// :has() removal — data-time-field attribute selector
// ---------------------------------------------------------------------------

describe('LatchExplorers — data-time-field attribute (no :has() dependency)', () => {
	let container: HTMLDivElement;
	let filter: MockFilterProvider;
	let bridge: MockBridge;
	let coordinator: MockCoordinator;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		filter = createMockFilter();
		bridge = createMockBridge();
		coordinator = createMockCoordinator();
	});

	afterEach(() => {
		container.remove();
	});

	it('finds time presets container by data-time-field attribute without :has()', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		// Each .latch-explorers__time-presets div should have a data-time-field attribute
		const presetContainers = container.querySelectorAll('.latch-explorers__time-presets');
		expect(presetContainers.length).toBeGreaterThan(0);

		for (const pc of presetContainers) {
			const field = (pc as HTMLElement).dataset['timeField'];
			expect(field).toBeTruthy();
			// Can be found via [data-time-field] selector (no :has() needed)
			const found = container.querySelector(`.latch-explorers__time-presets[data-time-field="${field}"]`);
			expect(found).toBe(pc);
		}

		explorers.destroy();
	});

	it('UI updates correctly when time preset is activated (via data-time-field selector)', () => {
		const explorers = new LatchExplorers({
			filter: filter as any,
			bridge: bridge as any,
			coordinator: coordinator as any,
		});
		explorers.mount(container);

		// Click the first time preset button
		const firstPreset = container.querySelector('.latch-explorers__time-preset') as HTMLButtonElement;
		const field = firstPreset.dataset['field']!;
		firstPreset.click();

		// The preset button should now have the active class (UI updated via data-time-field lookup)
		expect(firstPreset.classList.contains('latch-explorers__time-preset--active')).toBe(true);

		// The data-time-field container for this field should be findable without :has()
		const presetsContainer = container.querySelector(`.latch-explorers__time-presets[data-time-field="${field}"]`) as HTMLElement;
		expect(presetsContainer).not.toBeNull();

		explorers.destroy();
	});
});
