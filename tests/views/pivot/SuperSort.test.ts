// @vitest-environment jsdom
// Phase 100 Plan 02 — SuperSort plugin tests
// Tests for SuperSortHeaderClick and SuperSortChain plugins.
//
// Phase 105: Lifecycle describe blocks using makePluginHarness/usePlugin
//
// Requirements: SORT-01, SORT-02

import { beforeEach, describe, expect, it } from 'vitest';
import type { CellPlacement, RenderContext } from '../../../src/views/pivot/plugins/PluginTypes';
import { createSuperSortChainPlugin } from '../../../src/views/pivot/plugins/SuperSortChain';
import { createSuperSortHeaderClickPlugin } from '../../../src/views/pivot/plugins/SuperSortHeaderClick';
import { makePluginHarness } from './helpers/makePluginHarness';
import { usePlugin } from './helpers/usePlugin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinCtx(overrides: Partial<RenderContext> = {}): RenderContext {
	return {
		rowDimensions: [],
		colDimensions: [],
		visibleRows: [],
		allRows: [],
		visibleCols: [],
		data: new Map(),
		cells: [],
		rootEl: document.createElement('div'),
		scrollLeft: 0,
		scrollTop: 0,
		isPluginEnabled: () => false,
		...overrides,
	};
}

/** Build a leaf header element with data-col-start attribute. */
function makeLeafHeader(colStart: number): HTMLElement {
	const el = document.createElement('div');
	el.className = 'pv-col-span pv-col-span--leaf';
	el.setAttribute('data-col-start', String(colStart));
	el.textContent = `Col${colStart}`;
	return el;
}

function makePointerEvent(type: string, opts: { shiftKey?: boolean; target?: HTMLElement } = {}): PointerEvent {
	const event = new PointerEvent(type, {
		bubbles: true,
		shiftKey: opts.shiftKey ?? false,
	});
	if (opts.target) {
		Object.defineProperty(event, 'target', { value: opts.target, configurable: true });
	}
	return event;
}

/** Build flat cell placements: numRows x numCols with specified values. */
function makeCells(values: (number | null)[][]): CellPlacement[] {
	const cells: CellPlacement[] = [];
	for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
		for (let colIdx = 0; colIdx < values[rowIdx]!.length; colIdx++) {
			cells.push({
				key: `${rowIdx}-${colIdx}`,
				rowIdx,
				colIdx,
				value: values[rowIdx]![colIdx] ?? null,
			});
		}
	}
	return cells;
}

/** Get values at a specific colIdx, ordered by the resulting rowIdx. */
function getColValuesByRowIdx(cells: CellPlacement[], colIdx: number): (number | null)[] {
	return cells
		.filter((c) => c.colIdx === colIdx)
		.sort((a, b) => a.rowIdx - b.rowIdx)
		.map((c) => c.value);
}

// ---------------------------------------------------------------------------
// SuperSortHeaderClick
// ---------------------------------------------------------------------------

describe('SuperSortHeaderClick', () => {
	describe('initial state', () => {
		it('starts with no sorted column (sortState is null)', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const ctx = makeMinCtx();
			// transformData with no sort state returns cells unchanged
			const cells = makeCells([
				[1, 2],
				[3, 4],
			]);
			const result = plugin.transformData!(cells, ctx);
			expect(result).toBe(cells); // exact same reference — no copy
		});
	});

	describe('onPointerEvent', () => {
		it('clicking a leaf header sets sortState to { colIdx: 0, direction: "asc" }', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1); // data-col-start="1" → colIdx 0
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			const event = makePointerEvent('pointerdown', { target: header });
			const consumed = plugin.onPointerEvent!('pointerdown', event, ctx);
			expect(consumed).toBe(true);

			// After click, transformData should sort by colIdx 0 ascending
			// Verify via transformData behavior
			const cells = makeCells([
				[3, 10],
				[1, 20],
				[2, 30],
			]);
			const sorted = plugin.transformData!(cells, ctx);
			expect(getColValuesByRowIdx(sorted, 0)).toEqual([1, 2, 3]);
		});

		it('clicking same header cycles: asc → desc', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			// First click → asc
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);
			// Second click → desc
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);

			const cells = makeCells([
				[1, 10],
				[3, 20],
				[2, 30],
			]);
			const sorted = plugin.transformData!(cells, ctx);
			expect(getColValuesByRowIdx(sorted, 0)).toEqual([3, 2, 1]);
		});

		it('clicking same header cycles: desc → null (no sort)', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			// Three clicks: asc → desc → null
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);

			const cells = makeCells([
				[3, 10],
				[1, 20],
				[2, 30],
			]);
			const result = plugin.transformData!(cells, ctx);
			// No sort — returns same reference
			expect(result).toBe(cells);
		});

		it('clicking a different header clears previous sort and sets new to asc', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header1 = makeLeafHeader(1);
			const header2 = makeLeafHeader(2);
			root.appendChild(header1);
			root.appendChild(header2);
			const ctx = makeMinCtx({ rootEl: root });

			// Sort by col 0 asc
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header1 }), ctx);
			// Now sort by col 1 — should reset to asc
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header2 }), ctx);

			// col 1 is now sorted asc
			const cells = makeCells([
				[10, 3],
				[20, 1],
				[30, 2],
			]);
			const sorted = plugin.transformData!(cells, ctx);
			expect(getColValuesByRowIdx(sorted, 1)).toEqual([1, 2, 3]);
		});

		it('shift+click returns false (lets chain plugin handle it)', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			const event = makePointerEvent('pointerdown', { target: header, shiftKey: true });
			const consumed = plugin.onPointerEvent!('pointerdown', event, ctx);
			expect(consumed).toBe(false);
		});

		it('non-pointerdown events return false', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const ctx = makeMinCtx();
			const event = makePointerEvent('pointermove');
			const consumed = plugin.onPointerEvent!('pointermove', event, ctx);
			expect(consumed).toBe(false);
		});
	});

	describe('transformData', () => {
		it('sorts CellPlacement[] by value ascending when direction is asc', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1); // colIdx 0
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);

			const cells = makeCells(
				[
					[30, 'A'],
					[10, 'B'],
					[20, 'C'],
				].map(([v]) => [Number(v), 0]),
			);
			const cells2 = makeCells([
				[30, 0],
				[10, 0],
				[20, 0],
			]);
			const sorted = plugin.transformData!(cells2, ctx);
			expect(getColValuesByRowIdx(sorted, 0)).toEqual([10, 20, 30]);
		});

		it('sorts CellPlacement[] by value descending when direction is desc', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1); // colIdx 0
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			// asc then desc
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);

			const cells = makeCells([
				[10, 0],
				[30, 0],
				[20, 0],
			]);
			const sorted = plugin.transformData!(cells, ctx);
			expect(getColValuesByRowIdx(sorted, 0)).toEqual([30, 20, 10]);
		});

		it('null values sort to end in ascending order', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);

			const cells = makeCells([
				[null, 0],
				[10, 0],
				[null, 0],
				[5, 0],
			]);
			const sorted = plugin.transformData!(cells, ctx);
			expect(getColValuesByRowIdx(sorted, 0)).toEqual([5, 10, null, null]);
		});

		it('null values sort to end in descending order', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			// asc then desc
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);

			const cells = makeCells([
				[null, 0],
				[10, 0],
				[null, 0],
				[5, 0],
			]);
			const sorted = plugin.transformData!(cells, ctx);
			expect(getColValuesByRowIdx(sorted, 0)).toEqual([10, 5, null, null]);
		});

		it('reassigns rowIdx values to maintain sequential ordering after sort', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);

			const cells = makeCells([
				[30, 5],
				[10, 15],
				[20, 25],
			]);
			const sorted = plugin.transformData!(cells, ctx);

			// rowIdx should be 0, 1, 2 sequentially
			const rowIdxValues = [...new Set(sorted.map((c) => c.rowIdx))].sort((a, b) => a - b);
			expect(rowIdxValues).toEqual([0, 1, 2]);
		});
	});

	describe('afterRender', () => {
		it('adds pv-sort-arrow with ↑ on sorted-asc header', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);
			plugin.afterRender!(root, ctx);

			expect(header.querySelector('.pv-sort-arrow')?.textContent).toBe('↑');
			expect(header.classList.contains('pv-col-span--sorted-asc')).toBe(true);
		});

		it('adds pv-sort-arrow with ↓ on sorted-desc header', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);
			plugin.afterRender!(root, ctx);

			expect(header.querySelector('.pv-sort-arrow')?.textContent).toBe('↓');
			expect(header.classList.contains('pv-col-span--sorted-desc')).toBe(true);
		});
	});

	describe('destroy', () => {
		it('resets sortState to null on destroy', () => {
			const plugin = createSuperSortHeaderClickPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header }), ctx);
			plugin.destroy!();

			const cells = makeCells([
				[3, 0],
				[1, 0],
				[2, 0],
			]);
			const result = plugin.transformData!(cells, ctx);
			expect(result).toBe(cells); // no sort — same reference
		});
	});
});

// ---------------------------------------------------------------------------
// SuperSortChain
// ---------------------------------------------------------------------------

describe('SuperSortChain', () => {
	describe('onPointerEvent', () => {
		it('shift+click adds a column to the chain', () => {
			const plugin = createSuperSortChainPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			const event = makePointerEvent('pointerdown', { target: header, shiftKey: true });
			const consumed = plugin.onPointerEvent!('pointerdown', event, ctx);
			expect(consumed).toBe(true);

			// Verify chain is active by checking transformData sort behavior
			// Col 0, asc after first shift+click
			const cells = makeCells([
				[30, 0],
				[10, 0],
				[20, 0],
			]);
			const sorted = plugin.transformData!(cells, ctx);
			expect(getColValuesByRowIdx(sorted, 0)).toEqual([10, 20, 30]);
		});

		it('non-shift click returns false (single sort handles it)', () => {
			const plugin = createSuperSortChainPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			const event = makePointerEvent('pointerdown', { target: header, shiftKey: false });
			const consumed = plugin.onPointerEvent!('pointerdown', event, ctx);
			expect(consumed).toBe(false);
		});

		it('shift+clicking same column again cycles direction: asc → desc', () => {
			const plugin = createSuperSortChainPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header, shiftKey: true }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header, shiftKey: true }), ctx);

			const cells = makeCells([
				[10, 0],
				[30, 0],
				[20, 0],
			]);
			const sorted = plugin.transformData!(cells, ctx);
			expect(getColValuesByRowIdx(sorted, 0)).toEqual([30, 20, 10]);
		});

		it('shift+clicking same column a 3rd time removes it from chain', () => {
			const plugin = createSuperSortChainPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			// asc → desc → removed
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header, shiftKey: true }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header, shiftKey: true }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header, shiftKey: true }), ctx);

			// Chain is empty — transformData returns same reference
			const cells = makeCells([
				[3, 0],
				[1, 0],
				[2, 0],
			]);
			const result = plugin.transformData!(cells, ctx);
			expect(result).toBe(cells);
		});

		it('chain is limited to 3 entries — 4th shift+click replaces oldest', () => {
			const plugin = createSuperSortChainPlugin();
			const root = document.createElement('div');
			const h1 = makeLeafHeader(1);
			const h2 = makeLeafHeader(2);
			const h3 = makeLeafHeader(3);
			const h4 = makeLeafHeader(4);
			root.appendChild(h1);
			root.appendChild(h2);
			root.appendChild(h3);
			root.appendChild(h4);
			const ctx = makeMinCtx({ rootEl: root });

			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: h1, shiftKey: true }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: h2, shiftKey: true }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: h3, shiftKey: true }), ctx);
			// 4th shift+click — h1 (colIdx 0) should be replaced
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: h4, shiftKey: true }), ctx);

			// Verify h4 is in the chain by checking it sorts
			// The chain now has colIdx 1, 2, 3 (h2, h3, h4)
			// Sorting by chain[0]=1 asc: col at index 1
			const cells = makeCells([
				[0, 30, 0, 0],
				[0, 10, 0, 0],
				[0, 20, 0, 0],
			]);
			const sorted = plugin.transformData!(cells, ctx);
			expect(getColValuesByRowIdx(sorted, 1)).toEqual([10, 20, 30]);
		});
	});

	describe('transformData', () => {
		it('returns cells unchanged when chain is empty', () => {
			const plugin = createSuperSortChainPlugin();
			const ctx = makeMinCtx();
			const cells = makeCells([
				[3, 0],
				[1, 0],
			]);
			const result = plugin.transformData!(cells, ctx);
			expect(result).toBe(cells);
		});

		it('applies multi-key sort: primary sort first, secondary on tie', () => {
			const plugin = createSuperSortChainPlugin();
			const root = document.createElement('div');
			const h1 = makeLeafHeader(1); // colIdx 0
			const h2 = makeLeafHeader(2); // colIdx 1
			root.appendChild(h1);
			root.appendChild(h2);
			const ctx = makeMinCtx({ rootEl: root });

			// Sort by col0 asc, then col1 asc
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: h1, shiftKey: true }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: h2, shiftKey: true }), ctx);

			// Values: [col0, col1]
			// Row 0: [1, 30]
			// Row 1: [2, 10]
			// Row 2: [1, 20]
			// Row 3: [2, 5]
			const cells = makeCells([
				[1, 30],
				[2, 10],
				[1, 20],
				[2, 5],
			]);
			const sorted = plugin.transformData!(cells, ctx);

			// Expected order by (col0 asc, col1 asc):
			// [1, 20], [1, 30], [2, 5], [2, 10]
			expect(getColValuesByRowIdx(sorted, 0)).toEqual([1, 1, 2, 2]);
			expect(getColValuesByRowIdx(sorted, 1)).toEqual([20, 30, 5, 10]);
		});

		it('null values sort to end in chain sort', () => {
			const plugin = createSuperSortChainPlugin();
			const root = document.createElement('div');
			const h1 = makeLeafHeader(1);
			root.appendChild(h1);
			const ctx = makeMinCtx({ rootEl: root });

			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: h1, shiftKey: true }), ctx);

			const cells = makeCells([
				[null, 0],
				[10, 0],
				[null, 0],
				[5, 0],
			]);
			const sorted = plugin.transformData!(cells, ctx);
			expect(getColValuesByRowIdx(sorted, 0)).toEqual([5, 10, null, null]);
		});
	});

	describe('afterRender', () => {
		it('adds sort arrow and priority number to chain entries', () => {
			const plugin = createSuperSortChainPlugin();
			const root = document.createElement('div');
			const h1 = makeLeafHeader(1);
			const h2 = makeLeafHeader(2);
			root.appendChild(h1);
			root.appendChild(h2);
			const ctx = makeMinCtx({ rootEl: root });

			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: h1, shiftKey: true }), ctx);
			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: h2, shiftKey: true }), ctx);
			plugin.afterRender!(root, ctx);

			// h1 should have arrow + priority "1"
			expect(h1.querySelector('.pv-sort-arrow')?.textContent).toBe('↑');
			expect(h1.querySelector('.pv-sort-priority')?.textContent).toBe('1');
			// h2 should have arrow + priority "2"
			expect(h2.querySelector('.pv-sort-arrow')?.textContent).toBe('↑');
			expect(h2.querySelector('.pv-sort-priority')?.textContent).toBe('2');
		});
	});

	describe('destroy', () => {
		it('clears the chain on destroy', () => {
			const plugin = createSuperSortChainPlugin();
			const root = document.createElement('div');
			const header = makeLeafHeader(1);
			root.appendChild(header);
			const ctx = makeMinCtx({ rootEl: root });

			plugin.onPointerEvent!('pointerdown', makePointerEvent('pointerdown', { target: header, shiftKey: true }), ctx);
			plugin.destroy!();

			const cells = makeCells([
				[3, 0],
				[1, 0],
			]);
			const result = plugin.transformData!(cells, ctx);
			expect(result).toBe(cells);
		});
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — supersort.header-click
// ---------------------------------------------------------------------------

describe('Lifecycle — supersort.header-click', () => {
	it('hook has transformData function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.header-click');
		expect(typeof hook.transformData).toBe('function');
	});

	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.header-click');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook has destroy function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.header-click');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook transformLayout is undefined (header-click does not mutate layout)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.header-click');
		expect(hook.transformLayout).toBeUndefined();
	});

	it('transformData with no sort active returns same cell reference', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.header-click');
		const { cells } = harness.runPipeline();
		// Run transformData directly — no sort state set, should be pass-through
		const result = hook.transformData!(cells, harness.ctx);
		expect(result).toBe(cells);
	});

	it('afterRender runs without throwing via pipeline', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supersort.header-click');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.header-click');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.header-click');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — supersort.chain
// ---------------------------------------------------------------------------

describe('Lifecycle — supersort.chain', () => {
	it('hook has transformData function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.chain');
		expect(typeof hook.transformData).toBe('function');
	});

	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.chain');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook has destroy function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.chain');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook transformLayout is undefined (chain does not mutate layout)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.chain');
		expect(hook.transformLayout).toBeUndefined();
	});

	it('transformData with empty chain returns same cell reference', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.chain');
		const { cells } = harness.runPipeline();
		const result = hook.transformData!(cells, harness.ctx);
		expect(result).toBe(cells);
	});

	it('afterRender runs without throwing via pipeline', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supersort.chain');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.chain');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersort.chain');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});
});
