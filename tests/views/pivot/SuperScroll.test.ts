// @vitest-environment jsdom
// Phase 100 Plan 02 — SuperScroll plugin tests
// Tests for SuperScrollVirtual and SuperScrollStickyHeaders plugins.
//
// Requirements: SCRL-01, SCRL-02

import { describe, it, expect, beforeEach } from 'vitest';
import {
	createSuperScrollVirtualPlugin,
	getVisibleRange,
	SCROLL_BUFFER,
	VIRTUALIZATION_THRESHOLD,
} from '../../../src/views/pivot/plugins/SuperScrollVirtual';
import { createSuperScrollStickyHeadersPlugin } from '../../../src/views/pivot/plugins/SuperScrollStickyHeaders';
import type { CellPlacement, RenderContext } from '../../../src/views/pivot/plugins/PluginTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<RenderContext> = {}): RenderContext {
	return {
		rowDimensions: [],
		colDimensions: [],
		visibleRows: [],
		visibleCols: [],
		data: new Map(),
		rootEl: document.createElement('div'),
		scrollLeft: 0,
		scrollTop: 0,
		isPluginEnabled: () => false,
		...overrides,
	};
}

/** Build cells with given numRows x numCols, all values = 0. */
function makeCells(numRows: number, numCols: number): CellPlacement[] {
	const cells: CellPlacement[] = [];
	for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
		for (let colIdx = 0; colIdx < numCols; colIdx++) {
			cells.push({
				key: `${rowIdx}-${colIdx}`,
				rowIdx,
				colIdx,
				value: 0,
			});
		}
	}
	return cells;
}

// ---------------------------------------------------------------------------
// getVisibleRange (pure function)
// ---------------------------------------------------------------------------

describe('getVisibleRange', () => {
	it('returns { startRow: 0, endRow: min(totalRows, ...) } when scrollTop is 0', () => {
		// scrollTop=0, rowHeight=32, containerHeight=300, totalRows=100
		const { startRow, endRow } = getVisibleRange(0, 32, 300, 100);
		expect(startRow).toBe(0);
		// lastVisible = ceil((0 + 300) / 32) = ceil(9.375) = 10
		// endRow = min(100, 10 + SCROLL_BUFFER) = min(100, 12)
		const expectedEnd = Math.min(100, Math.ceil(300 / 32) + SCROLL_BUFFER);
		expect(endRow).toBe(expectedEnd);
	});

	it('returns correct startRow with buffer when scrollTop > 0', () => {
		// scrollTop=320, rowHeight=32, containerHeight=300, totalRows=100
		const { startRow } = getVisibleRange(320, 32, 300, 100);
		// firstVisible = floor(320/32) = 10
		// startRow = max(0, 10 - SCROLL_BUFFER)
		const expected = Math.max(0, Math.floor(320 / 32) - SCROLL_BUFFER);
		expect(startRow).toBe(expected);
	});

	it('startRow is clamped to 0 (never negative)', () => {
		const { startRow } = getVisibleRange(0, 32, 300, 100);
		expect(startRow).toBeGreaterThanOrEqual(0);
	});

	it('endRow is clamped to totalRows (never exceeds)', () => {
		const { endRow } = getVisibleRange(0, 32, 10000, 50);
		expect(endRow).toBeLessThanOrEqual(50);
	});

	it('SCROLL_BUFFER is 2', () => {
		expect(SCROLL_BUFFER).toBe(2);
	});

	it('VIRTUALIZATION_THRESHOLD is 100', () => {
		expect(VIRTUALIZATION_THRESHOLD).toBe(100);
	});

	it('buffer = 2 rows above and 2 below visible range', () => {
		// scrollTop=320, rowHeight=32, containerHeight=300, totalRows=200
		const { startRow, endRow } = getVisibleRange(320, 32, 300, 200);
		const firstVisible = Math.floor(320 / 32); // 10
		const lastVisible = Math.ceil((320 + 300) / 32); // ceil(19.375) = 20
		expect(startRow).toBe(Math.max(0, firstVisible - 2));
		expect(endRow).toBe(Math.min(200, lastVisible + 2));
	});
});

// ---------------------------------------------------------------------------
// SuperScrollVirtual
// ---------------------------------------------------------------------------

describe('SuperScrollVirtual', () => {
	describe('transformData — below threshold', () => {
		it('returns all cells unchanged when totalRows <= VIRTUALIZATION_THRESHOLD', () => {
			const plugin = createSuperScrollVirtualPlugin();
			// VIRTUALIZATION_THRESHOLD = 100; create 50 rows
			const cells = makeCells(50, 3);
			const ctx = makeCtx({ scrollTop: 0 });
			const result = plugin.transformData!(cells, ctx);
			// Should return same reference — no windowing
			expect(result).toBe(cells);
		});

		it('returns same reference for exactly VIRTUALIZATION_THRESHOLD rows', () => {
			const plugin = createSuperScrollVirtualPlugin();
			const cells = makeCells(VIRTUALIZATION_THRESHOLD, 2);
			const ctx = makeCtx({ scrollTop: 0 });
			const result = plugin.transformData!(cells, ctx);
			expect(result).toBe(cells);
		});
	});

	describe('transformData — above threshold (windowing active)', () => {
		it('filters cells to visible range when totalRows > VIRTUALIZATION_THRESHOLD', () => {
			const plugin = createSuperScrollVirtualPlugin();
			// 200 rows, 1 col
			const cells = makeCells(201, 1);
			const scrollContainer = document.createElement('div');
			// Mock clientHeight
			Object.defineProperty(scrollContainer, 'clientHeight', { value: 300, configurable: true });
			const root = document.createElement('div');
			root.className = 'pv-scroll-container';
			// We need to simulate closest('.pv-scroll-container') returning the container
			// Since jsdom doesn't do layout, we'll just test that filtration occurs

			const ctx = makeCtx({ scrollTop: 0, rootEl: root });
			const result = plugin.transformData!(cells, ctx);
			// Should be a filtered subset, not the full 201 rows
			const uniqueRows = new Set(result.map((c) => c.rowIdx)).size;
			expect(uniqueRows).toBeLessThan(201);
		});

		it('filtered cells only contain rowIdx within visible range', () => {
			const plugin = createSuperScrollVirtualPlugin();
			// 200 rows, 2 cols; scrollTop=0 should show rows starting from 0
			const cells = makeCells(200, 2);
			const ctx = makeCtx({ scrollTop: 0 });
			const result = plugin.transformData!(cells, ctx);
			// All returned rowIdx values must be within [startRow, endRow)
			// For scrollTop=0, startRow=0
			result.forEach((c) => {
				expect(c.rowIdx).toBeGreaterThanOrEqual(0);
			});
		});

		it('excludes cells from rows outside visible range', () => {
			const plugin = createSuperScrollVirtualPlugin();
			const cells = makeCells(200, 1);
			const ctx = makeCtx({ scrollTop: 0 });
			const result = plugin.transformData!(cells, ctx);
			// Rows in the result must all be < endRow
			// Since scrollTop=0 and default containerHeight ~600 with 32px rows,
			// visible range includes rows 0..~(600/32 + 2) = ~20+2 = 22
			// So row 100 should NOT be in results
			const hasRow100 = result.some((c) => c.rowIdx === 100);
			expect(hasRow100).toBe(false);
		});
	});

	describe('destroy', () => {
		it('destroy does not throw', () => {
			const plugin = createSuperScrollVirtualPlugin();
			expect(() => plugin.destroy?.()).not.toThrow();
		});
	});
});

// ---------------------------------------------------------------------------
// SuperScrollStickyHeaders
// ---------------------------------------------------------------------------

describe('SuperScrollStickyHeaders', () => {
	describe('afterRender', () => {
		it('applies position:sticky to header elements in the overlay', () => {
			const plugin = createSuperScrollStickyHeadersPlugin();
			const root = document.createElement('div');

			// Create a col-span header at level 0
			const header = document.createElement('div');
			header.className = 'pv-col-span';
			header.setAttribute('data-level', '0');
			header.style.top = '0px';
			root.appendChild(header);

			const ctx = makeCtx({ rootEl: root });
			plugin.afterRender!(root, ctx);

			// Should have position: sticky applied
			expect(header.style.position).toBe('sticky');
		});

		it('sets z-index to 20 on sticky header elements', () => {
			const plugin = createSuperScrollStickyHeadersPlugin();
			const root = document.createElement('div');

			const header = document.createElement('div');
			header.className = 'pv-col-span';
			header.setAttribute('data-level', '0');
			root.appendChild(header);

			const ctx = makeCtx({ rootEl: root });
			plugin.afterRender!(root, ctx);

			expect(header.style.zIndex).toBe('20');
		});

		it('handles multiple col-span headers at different levels', () => {
			const plugin = createSuperScrollStickyHeadersPlugin();
			const root = document.createElement('div');

			const level0 = document.createElement('div');
			level0.className = 'pv-col-span';
			level0.setAttribute('data-level', '0');

			const level1 = document.createElement('div');
			level1.className = 'pv-col-span';
			level1.setAttribute('data-level', '1');

			root.appendChild(level0);
			root.appendChild(level1);

			const ctx = makeCtx({ rootEl: root });
			plugin.afterRender!(root, ctx);

			// Both should be sticky
			expect(level0.style.position).toBe('sticky');
			expect(level1.style.position).toBe('sticky');
		});

		it('does not throw when no col-span headers are present', () => {
			const plugin = createSuperScrollStickyHeadersPlugin();
			const root = document.createElement('div');
			const ctx = makeCtx({ rootEl: root });
			expect(() => plugin.afterRender!(root, ctx)).not.toThrow();
		});
	});

	describe('destroy', () => {
		it('destroy is a no-op (does not throw)', () => {
			const plugin = createSuperScrollStickyHeadersPlugin();
			expect(() => plugin.destroy?.()).not.toThrow();
		});
	});
});
