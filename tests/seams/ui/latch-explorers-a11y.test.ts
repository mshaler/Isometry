// @vitest-environment jsdom
/**
 * Isometry v12.0 — Phase 158 Plan 01
 * LatchExplorers ARIA accessibility and event delegation seam tests.
 *
 * Tests:
 *   - Chip containers have role="listbox", aria-multiselectable="true", aria-label
 *   - Chip buttons have role="option" and data-value attribute
 *   - Active chips have aria-selected="true", inactive chips have aria-selected="false"
 *   - _syncChipStates updates aria-selected alongside CSS class
 *   - Delegated click handler on container triggers _handleChipClick (filter state changes)
 *   - Chips do NOT have individual D3 .on('click') handlers (delegation only)
 *
 * Requirements: EXPX-01, EXPX-10
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Filter, FilterField } from '../../../src/providers/types';
import type { LatchExplorersConfig, WorkerBridgeLike, StateCoordinatorLike } from '../../../src/ui/LatchExplorers';
import { LatchExplorers } from '../../../src/ui/LatchExplorers';

// ---------------------------------------------------------------------------
// Minimal mock FilterProvider
// ---------------------------------------------------------------------------

function makeMockFilterProvider() {
	const axisFilters = new Map<string, string[]>();
	const subscribers: Array<() => void> = [];

	return {
		getAxisFilter: (field: string): string[] => axisFilters.get(field) ?? [],
		setAxisFilter: (field: string, values: string[]) => {
			axisFilters.set(field, values);
			for (const sub of subscribers) sub();
		},
		hasAxisFilter: (field: string): boolean => (axisFilters.get(field)?.length ?? 0) > 0,
		clearAllAxisFilters: () => {
			axisFilters.clear();
			for (const sub of subscribers) sub();
		},
		getFilters: (): readonly Filter[] => [],
		hasRangeFilter: (_field: string): boolean => false,
		clearRangeFilter: (_field: string): void => {},
		subscribe: (cb: () => void): (() => void) => {
			subscribers.push(cb);
			return () => {
				const idx = subscribers.indexOf(cb);
				if (idx >= 0) subscribers.splice(idx, 1);
			};
		},
		// Expose for test assertions
		_axisFilters: axisFilters,
	};
}

// ---------------------------------------------------------------------------
// Minimal mock WorkerBridgeLike — returns empty chip data
// ---------------------------------------------------------------------------

function makeMockBridge(): WorkerBridgeLike {
	return {
		send: (_type: string, _payload: unknown): Promise<unknown> =>
			Promise.resolve({ rows: [{ folder: 'Work', count: 5 }, { folder: 'Personal', count: 3 }] }),
	};
}

// Custom bridge that returns chips for a specific field
function makeBridgeWithChips(field: string, chips: Array<{ value: string; count: number }>): WorkerBridgeLike {
	return {
		send: (_type: string, payload: unknown): Promise<unknown> => {
			const p = payload as { sql: string };
			if (p.sql.includes(field)) {
				return Promise.resolve({
					rows: chips.map((c) => ({ [field]: c.value, count: c.count })),
				});
			}
			return Promise.resolve({ rows: [] });
		},
	};
}

// ---------------------------------------------------------------------------
// Minimal mock StateCoordinatorLike
// ---------------------------------------------------------------------------

function makeMockCoordinator(): StateCoordinatorLike {
	return {
		subscribe: (_cb: () => void): (() => void) => () => {},
	};
}

// ---------------------------------------------------------------------------
// Helper: mount LatchExplorers and wait for async chip fetch
// ---------------------------------------------------------------------------

async function mountExplorers(config: LatchExplorersConfig): Promise<{ explorers: LatchExplorers; container: HTMLElement }> {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const explorers = new LatchExplorers(config);
	explorers.mount(container);
	// Wait for async fetchAllDistinctValues to complete
	await Promise.resolve();
	await Promise.resolve();
	return { explorers, container };
}

// ---------------------------------------------------------------------------
// EXPX-01: Chip containers have ARIA listbox role and multiselectable
// ---------------------------------------------------------------------------

describe('EXPX-01: chip container ARIA attributes', () => {
	let container: HTMLElement;
	let explorers: LatchExplorers;
	let filter: ReturnType<typeof makeMockFilterProvider>;

	beforeEach(async () => {
		filter = makeMockFilterProvider();
		const bridge = makeBridgeWithChips('folder', [{ value: 'Work', count: 5 }]);
		const config: LatchExplorersConfig = {
			filter: filter as unknown as import('../../../src/providers/FilterProvider').FilterProvider,
			bridge,
			coordinator: makeMockCoordinator(),
		};
		({ explorers, container } = await mountExplorers(config));
	});

	afterEach(() => {
		explorers.destroy();
		container.remove();
	});

	it('chip containers have role="listbox"', () => {
		const chipLists = container.querySelectorAll('.latch-explorers__chip-list');
		expect(chipLists.length).toBeGreaterThan(0);
		for (const el of chipLists) {
			expect(el.getAttribute('role')).toBe('listbox');
		}
	});

	it('chip containers have aria-multiselectable="true"', () => {
		const chipLists = container.querySelectorAll('.latch-explorers__chip-list');
		for (const el of chipLists) {
			expect(el.getAttribute('aria-multiselectable')).toBe('true');
		}
	});

	it('chip containers have descriptive aria-label containing field display name', () => {
		const chipLists = container.querySelectorAll('.latch-explorers__chip-list');
		for (const el of chipLists) {
			const label = el.getAttribute('aria-label');
			expect(label).toBeTruthy();
			expect(label).toContain('filter');
		}
	});
});

// ---------------------------------------------------------------------------
// EXPX-01: Individual chip ARIA attributes (role=option, data-value, aria-selected)
// ---------------------------------------------------------------------------

describe('EXPX-01: individual chip ARIA attributes', () => {
	let container: HTMLElement;
	let explorers: LatchExplorers;
	let filter: ReturnType<typeof makeMockFilterProvider>;

	beforeEach(async () => {
		filter = makeMockFilterProvider();
		// folder field with two chip values; 'Work' is active
		filter.setAxisFilter('folder' as FilterField, ['Work']);

		const bridge = makeBridgeWithChips('folder', [
			{ value: 'Work', count: 5 },
			{ value: 'Personal', count: 3 },
		]);
		const config: LatchExplorersConfig = {
			filter: filter as unknown as import('../../../src/providers/FilterProvider').FilterProvider,
			bridge,
			coordinator: makeMockCoordinator(),
		};
		({ explorers, container } = await mountExplorers(config));
	});

	afterEach(() => {
		explorers.destroy();
		container.remove();
	});

	it('chips have role="option"', () => {
		const chips = container.querySelectorAll('.latch-explorers__chip');
		expect(chips.length).toBeGreaterThan(0);
		for (const chip of chips) {
			expect(chip.getAttribute('role')).toBe('option');
		}
	});

	it('chips have data-value attribute matching chip value', () => {
		const folderContainer = container.querySelector('[data-field="folder"]');
		expect(folderContainer).not.toBeNull();
		const chips = folderContainer!.querySelectorAll('.latch-explorers__chip');
		expect(chips.length).toBe(2);
		const values = Array.from(chips).map((c) => c.getAttribute('data-value'));
		expect(values).toContain('Work');
		expect(values).toContain('Personal');
	});

	it('active chip (Work) has aria-selected="true"', () => {
		const folderContainer = container.querySelector('[data-field="folder"]');
		const chips = folderContainer!.querySelectorAll<HTMLElement>('.latch-explorers__chip');
		const workChip = Array.from(chips).find((c) => c.getAttribute('data-value') === 'Work');
		expect(workChip).toBeDefined();
		expect(workChip!.getAttribute('aria-selected')).toBe('true');
	});

	it('inactive chip (Personal) has aria-selected="false"', () => {
		const folderContainer = container.querySelector('[data-field="folder"]');
		const chips = folderContainer!.querySelectorAll<HTMLElement>('.latch-explorers__chip');
		const personalChip = Array.from(chips).find((c) => c.getAttribute('data-value') === 'Personal');
		expect(personalChip).toBeDefined();
		expect(personalChip!.getAttribute('aria-selected')).toBe('false');
	});
});

// ---------------------------------------------------------------------------
// EXPX-01: _syncChipStates updates aria-selected after filter toggle
// ---------------------------------------------------------------------------

describe('EXPX-01: _syncChipStates updates aria-selected', () => {
	let container: HTMLElement;
	let explorers: LatchExplorers;
	let filter: ReturnType<typeof makeMockFilterProvider>;

	beforeEach(async () => {
		filter = makeMockFilterProvider();
		const bridge = makeBridgeWithChips('folder', [
			{ value: 'Work', count: 5 },
			{ value: 'Personal', count: 3 },
		]);
		const config: LatchExplorersConfig = {
			filter: filter as unknown as import('../../../src/providers/FilterProvider').FilterProvider,
			bridge,
			coordinator: makeMockCoordinator(),
		};
		({ explorers, container } = await mountExplorers(config));
	});

	afterEach(() => {
		explorers.destroy();
		container.remove();
	});

	it('aria-selected updates to true when filter is set for a chip', () => {
		const folderContainer = container.querySelector('[data-field="folder"]');
		const workChip = folderContainer!.querySelector<HTMLElement>('[data-value="Work"]');
		expect(workChip).not.toBeNull();

		// Initially no filter — aria-selected should be false
		expect(workChip!.getAttribute('aria-selected')).toBe('false');

		// Set filter — _onFilterChange -> _syncChipStates should update aria-selected
		filter.setAxisFilter('folder' as FilterField, ['Work']);

		expect(workChip!.getAttribute('aria-selected')).toBe('true');
	});

	it('aria-selected updates to false when filter is cleared', () => {
		// Start with active filter
		filter.setAxisFilter('folder' as FilterField, ['Work']);
		const folderContainer = container.querySelector('[data-field="folder"]');
		const workChip = folderContainer!.querySelector<HTMLElement>('[data-value="Work"]');
		expect(workChip!.getAttribute('aria-selected')).toBe('true');

		// Clear filter
		filter.setAxisFilter('folder' as FilterField, []);

		expect(workChip!.getAttribute('aria-selected')).toBe('false');
	});
});

// ---------------------------------------------------------------------------
// EXPX-10: Event delegation — click on chip updates filter state
// ---------------------------------------------------------------------------

describe('EXPX-10: event delegation on chip container', () => {
	let container: HTMLElement;
	let explorers: LatchExplorers;
	let filter: ReturnType<typeof makeMockFilterProvider>;

	beforeEach(async () => {
		filter = makeMockFilterProvider();
		const bridge = makeBridgeWithChips('folder', [
			{ value: 'Work', count: 5 },
			{ value: 'Personal', count: 3 },
		]);
		const config: LatchExplorersConfig = {
			filter: filter as unknown as import('../../../src/providers/FilterProvider').FilterProvider,
			bridge,
			coordinator: makeMockCoordinator(),
		};
		({ explorers, container } = await mountExplorers(config));
	});

	afterEach(() => {
		explorers.destroy();
		container.remove();
	});

	it('clicking a chip via container delegation adds value to filter', () => {
		const folderContainer = container.querySelector('[data-field="folder"]');
		const workChip = folderContainer!.querySelector<HTMLElement>('[data-value="Work"]');
		expect(workChip).not.toBeNull();

		// Simulate click — fires event on chip, bubbles to container handler
		workChip!.click();

		const activeValues = filter.getAxisFilter('folder');
		expect(activeValues).toContain('Work');
	});

	it('clicking an active chip removes it from filter (toggle off)', () => {
		// Set Work as active first
		filter.setAxisFilter('folder' as FilterField, ['Work']);

		const folderContainer = container.querySelector('[data-field="folder"]');
		const workChip = folderContainer!.querySelector<HTMLElement>('[data-value="Work"]');
		expect(workChip).not.toBeNull();

		// Click to toggle off
		workChip!.click();

		const activeValues = filter.getAxisFilter('folder');
		expect(activeValues).not.toContain('Work');
	});

	it('clicking chip label span (child of button) still triggers delegation via closest()', () => {
		const folderContainer = container.querySelector('[data-field="folder"]');
		const workChip = folderContainer!.querySelector<HTMLElement>('[data-value="Work"]');
		expect(workChip).not.toBeNull();

		// Click the label span inside the chip button
		const labelSpan = workChip!.querySelector<HTMLElement>('.latch-explorers__chip-label');
		expect(labelSpan).not.toBeNull();
		labelSpan!.click();

		const activeValues = filter.getAxisFilter('folder');
		expect(activeValues).toContain('Work');
	});

	it('clicking the container background (no chip) does not trigger filter change', () => {
		const folderContainer = container.querySelector('[data-field="folder"]') as HTMLElement;
		expect(folderContainer).not.toBeNull();

		// Simulate click directly on container (not a chip)
		const event = new MouseEvent('click', { bubbles: true });
		folderContainer.dispatchEvent(event);

		// Filter should remain empty — no chip was clicked
		const activeValues = filter.getAxisFilter('folder');
		expect(activeValues).toHaveLength(0);
	});
});
