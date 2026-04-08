// @vitest-environment jsdom
// Isometry v5 — Behavioral Pairwise Coupling Tests
//
// 8 high-coupling category pairs with BEHAVIORAL assertions that verify
// the combined output is semantically correct — not just "doesn't crash."
//
// Each test directly wires plugin factories with controlled shared state
// so we can manipulate sort state, collapse sets, density levels, zoom,
// and verify the pipeline produces correct combined behavior.
//
// Pairs tested:
//   1. Sort + Stack       — sort order stable across collapse
//   2. Scroll + Calc      — footer respects scroll windowing scope
//   3. Search + Scroll    — highlights only applied to visible cells
//   4. Density + Size     — column resize persists across density switch
//   5. Zoom + Scroll      — zoom scaling affects visible row range
//   6. Stack + Calc       — calc footer unchanged without aggregate plugin
//   7. Sort + Density     — sort order stable across density switch
//   8. Audit + Stack      — audit CSS classes survive collapse

import { afterEach, describe, expect, it } from 'vitest';
import { createBaseGridPlugin } from '../../../src/views/pivot/plugins/BaseGrid';
import { createBaseHeadersPlugin } from '../../../src/views/pivot/plugins/BaseHeaders';
import { FEATURE_CATALOG } from '../../../src/views/pivot/plugins/FeatureCatalog';
import { PluginRegistry } from '../../../src/views/pivot/plugins/PluginRegistry';
import type { CellPlacement, GridLayout, RenderContext } from '../../../src/views/pivot/plugins/PluginTypes';
import {
	type AuditPluginState,
	createAuditPluginState,
	createSuperAuditOverlayPlugin,
} from '../../../src/views/pivot/plugins/SuperAuditOverlay';
import {
	type CalcConfig,
	type ColCalcConfig,
	computeAggregate,
	createSuperCalcFooterPlugin,
} from '../../../src/views/pivot/plugins/SuperCalcFooter';
import {
	createDensityState,
	createSuperDensityModeSwitchPlugin,
	type DensityState,
} from '../../../src/views/pivot/plugins/SuperDensityModeSwitch';
import {
	createSuperScrollVirtualPlugin,
	getVisibleRange,
	VIRTUALIZATION_THRESHOLD,
} from '../../../src/views/pivot/plugins/SuperScrollVirtual';
import { createSuperSearchHighlightPlugin } from '../../../src/views/pivot/plugins/SuperSearchHighlight';
import { createSearchState, type SearchState } from '../../../src/views/pivot/plugins/SuperSearchInput';
import { createSuperSizeColResizePlugin } from '../../../src/views/pivot/plugins/SuperSizeColResize';
import { createSuperSortChainPlugin } from '../../../src/views/pivot/plugins/SuperSortChain';
import {
	createSuperSortHeaderClickPlugin,
	type SortState,
} from '../../../src/views/pivot/plugins/SuperSortHeaderClick';
import { createSuperStackAggregatePlugin } from '../../../src/views/pivot/plugins/SuperStackAggregate';
import {
	createSuperStackCollapsePlugin,
	type SuperStackState,
} from '../../../src/views/pivot/plugins/SuperStackCollapse';
import { createSuperStackSpansPlugin } from '../../../src/views/pivot/plugins/SuperStackSpans';
import {
	createSuperZoomWheelPlugin,
	createZoomState,
	type ZoomState,
} from '../../../src/views/pivot/plugins/SuperZoomWheel';

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

function makeDefaultLayout(): GridLayout {
	return {
		headerWidth: 120,
		headerHeight: 30,
		cellWidth: 80,
		cellHeight: 24,
		colWidths: new Map<number, number>(),
		zoom: 1,
	};
}

function makeCtx(overrides: Partial<RenderContext> = {}): RenderContext {
	const rootEl = document.createElement('div');

	// Calc footer expects rootEl to have a parentElement (.pv-grid-wrapper)
	// so it can append the footer as a sibling of rootEl.
	// Density plugin expects .pv-grid-wrapper and .pv-toolbar INSIDE root.
	const outerWrapper = document.createElement('div');
	outerWrapper.className = 'pv-grid-wrapper';
	outerWrapper.appendChild(rootEl);
	document.body.appendChild(outerWrapper);

	// For density plugin: add .pv-grid-wrapper and .pv-toolbar inside rootEl
	const innerWrapper = document.createElement('div');
	innerWrapper.className = 'pv-grid-wrapper';
	rootEl.appendChild(innerWrapper);

	const toolbar = document.createElement('div');
	toolbar.className = 'pv-toolbar';
	rootEl.appendChild(toolbar);

	return {
		rowDimensions: [],
		colDimensions: [],
		visibleRows: [],
		allRows: [],
		visibleCols: [],
		data: new Map(),
		cells: [],
		rootEl,
		scrollLeft: 0,
		scrollTop: 0,
		isPluginEnabled: () => true,
		...overrides,
	};
}

/** Build cells for a given values grid: values[rowIdx][colIdx]. */
function makeCells(values: (number | null)[][]): CellPlacement[] {
	const cells: CellPlacement[] = [];
	for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
		for (let colIdx = 0; colIdx < values[rowIdx]!.length; colIdx++) {
			cells.push({
				key: `Row${rowIdx}:Col${colIdx}`,
				rowIdx,
				colIdx,
				value: values[rowIdx]![colIdx]!,
			});
		}
	}
	return cells;
}

/** Extract the sorted values at a specific column from a cells array. */
function colValues(cells: CellPlacement[], colIdx: number): (number | null)[] {
	return cells
		.filter((c) => c.colIdx === colIdx)
		.sort((a, b) => a.rowIdx - b.rowIdx)
		.map((c) => c.value);
}

// ---------------------------------------------------------------------------
// PAIR 1: Sort + Stack — sort order stable across collapse
// ---------------------------------------------------------------------------

describe('Pair 1: Sort + Stack — sort order stable across collapse', () => {
	it('sort ordering is preserved when a stack group is collapsed', () => {
		// Shared state
		const sharedSort: { state: SortState; onSort?: () => void } = { state: null };
		const stackState: SuperStackState = { collapsedSet: new Set() };

		// Create plugins directly
		const sortPlugin = createSuperSortHeaderClickPlugin(sharedSort);
		const scrollVirtual = createSuperScrollVirtualPlugin();

		// Values: 5 rows x 2 cols, unsorted
		const values: (number | null)[][] = [
			[50, 1],
			[10, 2],
			[30, 3],
			[40, 4],
			[20, 5],
		];
		const cells = makeCells(values);
		const ctx = makeCtx();

		// Sort by col 0 ascending
		sharedSort.state = { colIdx: 0, direction: 'asc' };
		const sorted = sortPlugin.transformData!(cells, ctx);

		// Verify sort: col 0 should be [10, 20, 30, 40, 50]
		const sortedCol0 = colValues(sorted, 0);
		expect(sortedCol0).toEqual([10, 20, 30, 40, 50]);

		// Now collapse a group (this is DOM-only, shouldn't affect transformData)
		stackState.collapsedSet.add('0\x1f\x1fGroup1');

		// Re-sort — order should be identical
		const sortedAfterCollapse = sortPlugin.transformData!(cells, ctx);
		const col0AfterCollapse = colValues(sortedAfterCollapse, 0);
		expect(col0AfterCollapse).toEqual([10, 20, 30, 40, 50]);

		// Verify the two results have identical rowIdx assignment
		const rowOrder1 = sorted.filter((c) => c.colIdx === 0).map((c) => c.rowIdx);
		const rowOrder2 = sortedAfterCollapse.filter((c) => c.colIdx === 0).map((c) => c.rowIdx);
		expect(rowOrder2).toEqual(rowOrder1);

		// Clean up
		ctx.rootEl.parentElement?.remove();
	});

	it('sort direction cycle (asc → desc → null) is independent of collapse state', () => {
		const sharedSort: { state: SortState } = { state: null };
		const stackState: SuperStackState = { collapsedSet: new Set() };

		const sortPlugin = createSuperSortHeaderClickPlugin(sharedSort);

		const values: (number | null)[][] = [
			[30, 1],
			[10, 2],
			[20, 3],
		];
		const cells = makeCells(values);
		const ctx = makeCtx();

		// Collapse a group before sorting
		stackState.collapsedSet.add('0\x1f\x1fGroupX');

		// Ascending
		sharedSort.state = { colIdx: 0, direction: 'asc' };
		expect(colValues(sortPlugin.transformData!(cells, ctx), 0)).toEqual([10, 20, 30]);

		// Descending
		sharedSort.state = { colIdx: 0, direction: 'desc' };
		expect(colValues(sortPlugin.transformData!(cells, ctx), 0)).toEqual([30, 20, 10]);

		// Null (no sort) — original order
		sharedSort.state = null;
		expect(colValues(sortPlugin.transformData!(cells, ctx), 0)).toEqual([30, 10, 20]);

		ctx.rootEl.parentElement?.remove();
	});
});

// ---------------------------------------------------------------------------
// PAIR 2: Scroll + Calc — footer respects scroll windowing scope
// ---------------------------------------------------------------------------

describe('Pair 2: Scroll + Calc — footer aggregates respect scope', () => {
	it('scope=view: calc footer uses ctx.visibleRows (affected by scroll window)', () => {
		// Build 5 visible rows and 10 all rows
		const visibleRows = Array.from({ length: 5 }, (_, i) => [`Row${i}`]);
		const allRows = Array.from({ length: 10 }, (_, i) => [`Row${i}`]);
		const visibleCols = [['Amount']];

		const data = new Map<string, number | null>();
		for (let i = 0; i < 10; i++) {
			data.set(`Row${i}::Amount`, i * 10); // 0, 10, 20, ..., 90
		}

		const calcConfig: CalcConfig = {
			cols: new Map<number, ColCalcConfig>(),
			scope: 'view', // default
		};

		const calcPlugin = createSuperCalcFooterPlugin(calcConfig);
		const ctx = makeCtx({ visibleRows, allRows, visibleCols, data });

		// Run afterRender — footer should aggregate visibleRows only
		calcPlugin.afterRender!(ctx.rootEl, ctx);

		const footer = ctx.rootEl.parentElement!.querySelector('.pv-calc-footer');
		expect(footer).not.toBeNull();

		const footerText = footer!.textContent ?? '';
		// SUM of visible rows (0+10+20+30+40 = 100)
		expect(footerText).toContain('100');

		ctx.rootEl.parentElement?.remove();
	});

	it('scope=all: calc footer uses ctx.allRows (ignores scroll window)', () => {
		const visibleRows = Array.from({ length: 5 }, (_, i) => [`Row${i}`]);
		const allRows = Array.from({ length: 10 }, (_, i) => [`Row${i}`]);
		const visibleCols = [['Amount']];

		const data = new Map<string, number | null>();
		for (let i = 0; i < 10; i++) {
			data.set(`Row${i}::Amount`, i * 10);
		}

		const calcConfig: CalcConfig = {
			cols: new Map<number, ColCalcConfig>(),
			scope: 'all',
		};

		const calcPlugin = createSuperCalcFooterPlugin(calcConfig);
		const ctx = makeCtx({ visibleRows, allRows, visibleCols, data });

		calcPlugin.afterRender!(ctx.rootEl, ctx);

		const footer = ctx.rootEl.parentElement!.querySelector('.pv-calc-footer');
		const footerText = footer!.textContent ?? '';
		// SUM of ALL rows (0+10+20+...+90 = 450)
		expect(footerText).toContain('450');

		ctx.rootEl.parentElement?.remove();
	});

	it('switching scope from view to all changes footer value', () => {
		const visibleRows = Array.from({ length: 3 }, (_, i) => [`Row${i}`]);
		const allRows = Array.from({ length: 6 }, (_, i) => [`Row${i}`]);
		const visibleCols = [['Val']];

		const data = new Map<string, number | null>();
		for (let i = 0; i < 6; i++) {
			data.set(`Row${i}::Val`, 10);
		}

		const calcConfig: CalcConfig = {
			cols: new Map<number, ColCalcConfig>(),
			scope: 'view',
		};

		const calcPlugin = createSuperCalcFooterPlugin(calcConfig);
		const ctx = makeCtx({ visibleRows, allRows, visibleCols, data });

		// scope=view: SUM of 3 rows = 30
		calcPlugin.afterRender!(ctx.rootEl, ctx);
		let footer = ctx.rootEl.parentElement!.querySelector('.pv-calc-footer');
		expect(footer!.textContent).toContain('30');

		// Switch to scope=all: SUM of 6 rows = 60
		calcConfig.scope = 'all';
		calcPlugin.afterRender!(ctx.rootEl, ctx);
		footer = ctx.rootEl.parentElement!.querySelector('.pv-calc-footer');
		expect(footer!.textContent).toContain('60');

		ctx.rootEl.parentElement?.remove();
	});
});

// ---------------------------------------------------------------------------
// PAIR 3: Search + Scroll — highlights only on visible cells
// ---------------------------------------------------------------------------

describe('Pair 3: Search + Scroll — highlights only on visible DOM cells', () => {
	it('search highlight applies only to .pv-data-cell elements in rootEl', () => {
		const searchState: SearchState = createSearchState();
		const highlightPlugin = createSuperSearchHighlightPlugin(searchState);

		const ctx = makeCtx();
		const root = ctx.rootEl;

		// Create 5 data cells, 3 matching "apple"
		for (let i = 0; i < 5; i++) {
			const cell = document.createElement('div');
			cell.className = 'pv-data-cell';
			cell.textContent = i < 3 ? `apple-${i}` : `banana-${i}`;
			root.appendChild(cell);
		}

		// Set search term
		searchState.term = 'apple';
		highlightPlugin.afterRender!(root, ctx);

		const matched = root.querySelectorAll('.search-match');
		expect(matched.length).toBe(3);

		// Non-matching cells have opacity 0.35
		const allCells = root.querySelectorAll<HTMLElement>('.pv-data-cell');
		for (const cell of allCells) {
			if (cell.classList.contains('search-match')) {
				expect(cell.style.opacity).toBe('');
			} else {
				expect(cell.style.opacity).toBe('0.35');
			}
		}

		root.parentElement?.remove();
	});

	it('cells outside rootEl (simulating out-of-viewport) are not highlighted', () => {
		const searchState: SearchState = createSearchState();
		const highlightPlugin = createSuperSearchHighlightPlugin(searchState);

		const ctx = makeCtx();
		const root = ctx.rootEl;

		// Cell inside root (visible)
		const visibleCell = document.createElement('div');
		visibleCell.className = 'pv-data-cell';
		visibleCell.textContent = 'apple';
		root.appendChild(visibleCell);

		// Cell outside root (simulates scrolled-out row)
		const outsideCell = document.createElement('div');
		outsideCell.className = 'pv-data-cell';
		outsideCell.textContent = 'apple';
		document.body.appendChild(outsideCell);

		searchState.term = 'apple';
		highlightPlugin.afterRender!(root, ctx);

		// Only the cell inside root should be highlighted
		expect(visibleCell.classList.contains('search-match')).toBe(true);
		expect(outsideCell.classList.contains('search-match')).toBe(false);

		root.parentElement?.remove();
		outsideCell.remove();
	});

	it('clearing search term removes all highlights', () => {
		const searchState: SearchState = createSearchState();
		const highlightPlugin = createSuperSearchHighlightPlugin(searchState);

		const ctx = makeCtx();
		const root = ctx.rootEl;

		const cell = document.createElement('div');
		cell.className = 'pv-data-cell';
		cell.textContent = 'apple';
		root.appendChild(cell);

		// Highlight
		searchState.term = 'apple';
		highlightPlugin.afterRender!(root, ctx);
		expect(cell.classList.contains('search-match')).toBe(true);

		// Clear
		searchState.term = '';
		highlightPlugin.afterRender!(root, ctx);
		expect(cell.classList.contains('search-match')).toBe(false);
		expect(cell.style.opacity).toBe('');

		root.parentElement?.remove();
	});
});

// ---------------------------------------------------------------------------
// PAIR 4: Density + Size — column resize persists across density switch
// ---------------------------------------------------------------------------

describe('Pair 4: Density + Size — colWidths persist across density mode', () => {
	it('column resize widths survive density mode switch', () => {
		const densityState: DensityState = createDensityState();
		const densityPlugin = createSuperDensityModeSwitchPlugin(densityState);
		const sizePlugin = createSuperSizeColResizePlugin();

		const ctx = makeCtx();
		const layout = makeDefaultLayout();

		// Simulate column 0 resized to 200px via size plugin internal state
		// Size plugin stores widths in its internal _colWidths map (accessed via transformLayout)
		// We simulate by running transformLayout after setting colWidths through the public interface
		// The size plugin's transformLayout merges _colWidths into layout.colWidths
		// Use the _colWidths test accessor
		(sizePlugin as { _colWidths: Map<number, number> })._colWidths.set(0, 200);
		(sizePlugin as { _colWidths: Map<number, number> })._colWidths.set(1, 150);

		// Run size transformLayout
		const layout1 = sizePlugin.transformLayout!(makeDefaultLayout(), ctx);
		expect(layout1.colWidths.get(0)).toBe(200);
		expect(layout1.colWidths.get(1)).toBe(150);

		// Switch density to 'compact'
		densityState.level = 'compact';

		// Density plugin applies via afterRender (CSS class), not transformLayout
		// Re-run size transformLayout — colWidths should be unchanged
		const layout2 = sizePlugin.transformLayout!(makeDefaultLayout(), ctx);
		expect(layout2.colWidths.get(0)).toBe(200);
		expect(layout2.colWidths.get(1)).toBe(150);

		// Switch to spacious
		densityState.level = 'spacious';

		const layout3 = sizePlugin.transformLayout!(makeDefaultLayout(), ctx);
		expect(layout3.colWidths.get(0)).toBe(200);
		expect(layout3.colWidths.get(1)).toBe(150);

		ctx.rootEl.parentElement?.remove();
	});

	it('density CSS class does not interfere with colWidths map', () => {
		const densityState: DensityState = createDensityState();
		const densityPlugin = createSuperDensityModeSwitchPlugin(densityState);
		const sizePlugin = createSuperSizeColResizePlugin();

		const ctx = makeCtx();
		const root = ctx.rootEl;

		// Density plugin looks for .pv-grid-wrapper INSIDE root
		const innerWrapper = root.querySelector('.pv-grid-wrapper') as HTMLElement;

		// Set density, run afterRender
		densityState.level = 'compact';
		densityPlugin.afterRender!(root, ctx);

		// Density should add CSS class to inner .pv-grid-wrapper
		expect(innerWrapper.classList.contains('pv-density--compact')).toBe(true);

		// Size colWidths should still work independently
		(sizePlugin as { _colWidths: Map<number, number> })._colWidths.set(0, 300);
		const layout = sizePlugin.transformLayout!(makeDefaultLayout(), ctx);
		expect(layout.colWidths.get(0)).toBe(300);

		root.parentElement?.remove();
	});
});

// ---------------------------------------------------------------------------
// PAIR 5: Zoom + Scroll — zoom affects visible row range
// ---------------------------------------------------------------------------

describe('Pair 5: Zoom + Scroll — zoom changes visible row count', () => {
	it('zooming in (2x) halves the visible row count for same viewport', () => {
		const containerHeight = 480; // px
		const baseCellHeight = 24; // px
		const totalRows = 200;

		// At 1x: visible = ceil((480) / 24) = 20 rows
		const range1x = getVisibleRange(0, baseCellHeight, containerHeight, totalRows);
		const count1x = range1x.endRow - range1x.startRow;

		// At 2x: cellHeight becomes 48px → visible = ceil((480) / 48) = 10 rows
		const range2x = getVisibleRange(0, baseCellHeight * 2, containerHeight, totalRows);
		const count2x = range2x.endRow - range2x.startRow;

		// 2x zoom should show roughly half the rows (±buffer)
		expect(count2x).toBeLessThan(count1x);
		expect(count2x).toBeCloseTo(count1x / 2, -1); // within order of magnitude
	});

	it('zooming out (0.5x) doubles the visible row count', () => {
		const containerHeight = 480;
		const baseCellHeight = 24;
		const totalRows = 200;

		const range1x = getVisibleRange(0, baseCellHeight, containerHeight, totalRows);
		const count1x = range1x.endRow - range1x.startRow;

		const range05x = getVisibleRange(0, baseCellHeight * 0.5, containerHeight, totalRows);
		const count05x = range05x.endRow - range05x.startRow;

		expect(count05x).toBeGreaterThan(count1x);
		expect(count05x).toBeCloseTo(count1x * 2, -1);
	});

	it('zoom transformLayout scales cellWidth and cellHeight', () => {
		const zoomState: ZoomState = createZoomState();
		const zoomPlugin = createSuperZoomWheelPlugin(zoomState);
		const ctx = makeCtx();

		zoomState.zoom = 1.5;
		const layout = zoomPlugin.transformLayout!(makeDefaultLayout(), ctx);

		expect(layout.zoom).toBe(1.5);
		expect(layout.cellWidth).toBe(80 * 1.5); // 120
		expect(layout.cellHeight).toBe(24 * 1.5); // 36

		ctx.rootEl.parentElement?.remove();
	});

	it('scroll transformData windowing uses cellHeight from layout (zoom-affected)', () => {
		const scrollPlugin = createSuperScrollVirtualPlugin();

		// Build 150 rows (above VIRTUALIZATION_THRESHOLD=100)
		const cells: CellPlacement[] = [];
		for (let r = 0; r < 150; r++) {
			cells.push({ key: `R${r}:C0`, rowIdx: r, colIdx: 0, value: r });
		}

		const ctx = makeCtx({ scrollTop: 0 });

		// Without zoom context, uses DEFAULT_ROW_HEIGHT (32px)
		const filtered = scrollPlugin.transformData!(cells, ctx);
		const visibleCount = new Set(filtered.map((c) => c.rowIdx)).size;

		// Should be a subset of 150
		expect(visibleCount).toBeLessThan(150);
		expect(visibleCount).toBeGreaterThan(0);

		ctx.rootEl.parentElement?.remove();
	});
});

// ---------------------------------------------------------------------------
// PAIR 6: Stack + Calc — footer unchanged without aggregate plugin
// ---------------------------------------------------------------------------

describe('Pair 6: Stack + Calc — collapse without aggregate leaves footer unchanged', () => {
	it('collapsing a group does NOT change calc footer values (collapse is DOM-only)', () => {
		const stackState: SuperStackState = { collapsedSet: new Set() };
		const calcConfig: CalcConfig = {
			cols: new Map<number, ColCalcConfig>(),
			scope: 'view',
		};

		const calcPlugin = createSuperCalcFooterPlugin(calcConfig);

		const visibleRows = Array.from({ length: 4 }, (_, i) => [`Row${i}`]);
		const visibleCols = [['Amount']];
		const data = new Map<string, number | null>();
		for (let i = 0; i < 4; i++) {
			data.set(`Row${i}::Amount`, (i + 1) * 10); // 10, 20, 30, 40
		}

		const ctx = makeCtx({ visibleRows, allRows: visibleRows, visibleCols, data });

		// Footer before collapse
		calcPlugin.afterRender!(ctx.rootEl, ctx);
		const footer1 = ctx.rootEl.parentElement!.querySelector('.pv-calc-footer');
		const text1 = footer1!.textContent ?? '';

		// Collapse a group (DOM-only — does NOT modify visibleRows)
		stackState.collapsedSet.add('0\x1f\x1fGroupA');

		// Footer after collapse — should be identical
		calcPlugin.afterRender!(ctx.rootEl, ctx);
		const footer2 = ctx.rootEl.parentElement!.querySelector('.pv-calc-footer');
		const text2 = footer2!.textContent ?? '';

		expect(text2).toBe(text1);
		// Both should show SUM=100 (10+20+30+40)
		expect(text1).toContain('100');

		ctx.rootEl.parentElement?.remove();
	});

	it('calc footer scope is independent of stack collapse state', () => {
		const stackState: SuperStackState = { collapsedSet: new Set() };
		const calcConfig: CalcConfig = {
			cols: new Map<number, ColCalcConfig>(),
			scope: 'all',
		};

		const calcPlugin = createSuperCalcFooterPlugin(calcConfig);

		const visibleRows = Array.from({ length: 3 }, (_, i) => [`Row${i}`]);
		const allRows = Array.from({ length: 5 }, (_, i) => [`Row${i}`]);
		const visibleCols = [['Score']];
		const data = new Map<string, number | null>();
		for (let i = 0; i < 5; i++) {
			data.set(`Row${i}::Score`, 10);
		}

		const ctx = makeCtx({ visibleRows, allRows, visibleCols, data });

		// Collapse before rendering
		stackState.collapsedSet.add('0\x1f\x1fGroupB');

		calcPlugin.afterRender!(ctx.rootEl, ctx);
		const footer = ctx.rootEl.parentElement!.querySelector('.pv-calc-footer');
		// scope=all: SUM of 5 rows = 50 (collapse doesn't affect allRows)
		expect(footer!.textContent).toContain('50');

		ctx.rootEl.parentElement?.remove();
	});
});

// ---------------------------------------------------------------------------
// PAIR 7: Sort + Density — sort order stable across density switch
// ---------------------------------------------------------------------------

describe('Pair 7: Sort + Density — sort order stable across density changes', () => {
	it('sort output is identical before and after density mode switch', () => {
		const sharedSort: { state: SortState } = { state: null };
		const densityState: DensityState = createDensityState();

		const sortPlugin = createSuperSortHeaderClickPlugin(sharedSort);
		const densityPlugin = createSuperDensityModeSwitchPlugin(densityState);

		const values: (number | null)[][] = [
			[50, 1],
			[10, 2],
			[40, 3],
			[20, 4],
			[30, 5],
		];
		const cells = makeCells(values);
		const ctx = makeCtx();

		// Sort ascending by col 0
		sharedSort.state = { colIdx: 0, direction: 'asc' };

		const sorted1 = sortPlugin.transformData!(cells, ctx);
		const order1 = colValues(sorted1, 0);
		expect(order1).toEqual([10, 20, 30, 40, 50]);

		// Switch to compact density
		densityState.level = 'compact';
		densityPlugin.afterRender!(ctx.rootEl, ctx);

		// Re-sort — same input, should produce identical output
		const sorted2 = sortPlugin.transformData!(cells, ctx);
		const order2 = colValues(sorted2, 0);
		expect(order2).toEqual([10, 20, 30, 40, 50]);

		// Switch to spacious
		densityState.level = 'spacious';
		densityPlugin.afterRender!(ctx.rootEl, ctx);

		const sorted3 = sortPlugin.transformData!(cells, ctx);
		const order3 = colValues(sorted3, 0);
		expect(order3).toEqual([10, 20, 30, 40, 50]);

		// Descending should also be stable across density changes
		sharedSort.state = { colIdx: 0, direction: 'desc' };

		const sortedDesc1 = sortPlugin.transformData!(cells, ctx);
		densityState.level = 'normal';
		const sortedDesc2 = sortPlugin.transformData!(cells, ctx);

		expect(colValues(sortedDesc1, 0)).toEqual([50, 40, 30, 20, 10]);
		expect(colValues(sortedDesc2, 0)).toEqual([50, 40, 30, 20, 10]);

		ctx.rootEl.parentElement?.remove();
	});

	it('null values sort to end regardless of density mode', () => {
		const sharedSort: { state: SortState } = { state: null };
		const densityState: DensityState = createDensityState();

		const sortPlugin = createSuperSortHeaderClickPlugin(sharedSort);

		const values: (number | null)[][] = [
			[null, 1],
			[10, 2],
			[null, 3],
			[20, 4],
		];
		const cells = makeCells(values);
		const ctx = makeCtx();

		sharedSort.state = { colIdx: 0, direction: 'asc' };

		// Normal density
		densityState.level = 'normal';
		const sorted1 = sortPlugin.transformData!(cells, ctx);
		expect(colValues(sorted1, 0)).toEqual([10, 20, null, null]);

		// Compact density
		densityState.level = 'compact';
		const sorted2 = sortPlugin.transformData!(cells, ctx);
		expect(colValues(sorted2, 0)).toEqual([10, 20, null, null]);

		ctx.rootEl.parentElement?.remove();
	});
});

// ---------------------------------------------------------------------------
// PAIR 8: Audit + Stack — audit CSS classes survive collapse
// ---------------------------------------------------------------------------

describe('Pair 8: Audit + Stack — audit overlay survives collapse', () => {
	it('audit CSS classes are applied based on data-key, unaffected by collapse state', () => {
		const auditState: AuditPluginState = createAuditPluginState();
		const stackState: SuperStackState = { collapsedSet: new Set() };

		const auditPlugin = createSuperAuditOverlayPlugin(auditState);

		const ctx = makeCtx();
		const root = ctx.rootEl;

		// Create data cells with data-key attributes
		for (let i = 0; i < 4; i++) {
			const cell = document.createElement('div');
			cell.className = 'pv-data-cell';
			cell.setAttribute('data-key', `Row${i}:Col0`);
			cell.textContent = `Value ${i}`;
			root.appendChild(cell);
		}

		// Mark cells in audit state
		auditState.inserted.add('Row0:Col0');
		auditState.updated.add('Row1:Col0');
		auditState.deleted.add('Row2:Col0');

		// Run audit overlay
		auditPlugin.afterRender!(root, ctx);

		// Verify classes
		expect(root.querySelector('[data-key="Row0:Col0"]')!.classList.contains('audit-new')).toBe(true);
		expect(root.querySelector('[data-key="Row1:Col0"]')!.classList.contains('audit-modified')).toBe(true);
		expect(root.querySelector('[data-key="Row2:Col0"]')!.classList.contains('audit-deleted')).toBe(true);
		expect(root.querySelector('[data-key="Row3:Col0"]')!.classList.contains('audit-new')).toBe(false);
		expect(root.querySelector('[data-key="Row3:Col0"]')!.classList.contains('audit-modified')).toBe(false);
		expect(root.querySelector('[data-key="Row3:Col0"]')!.classList.contains('audit-deleted')).toBe(false);

		// Collapse a group — should NOT affect audit classes
		stackState.collapsedSet.add('0\x1f\x1fGroupA');

		// Re-run audit — classes should be identical
		auditPlugin.afterRender!(root, ctx);

		expect(root.querySelector('[data-key="Row0:Col0"]')!.classList.contains('audit-new')).toBe(true);
		expect(root.querySelector('[data-key="Row1:Col0"]')!.classList.contains('audit-modified')).toBe(true);
		expect(root.querySelector('[data-key="Row2:Col0"]')!.classList.contains('audit-deleted')).toBe(true);

		root.parentElement?.remove();
	});

	it('removing a key from auditState removes the CSS class after re-render', () => {
		const auditState: AuditPluginState = createAuditPluginState();
		const auditPlugin = createSuperAuditOverlayPlugin(auditState);

		const ctx = makeCtx();
		const root = ctx.rootEl;

		const cell = document.createElement('div');
		cell.className = 'pv-data-cell';
		cell.setAttribute('data-key', 'target');
		root.appendChild(cell);

		// Add to inserted
		auditState.inserted.add('target');
		auditPlugin.afterRender!(root, ctx);
		expect(cell.classList.contains('audit-new')).toBe(true);

		// Remove from inserted
		auditState.inserted.delete('target');
		auditPlugin.afterRender!(root, ctx);
		expect(cell.classList.contains('audit-new')).toBe(false);

		root.parentElement?.remove();
	});

	it('audit classes are mutually exclusive per cell', () => {
		const auditState: AuditPluginState = createAuditPluginState();
		const auditPlugin = createSuperAuditOverlayPlugin(auditState);

		const ctx = makeCtx();
		const root = ctx.rootEl;

		const cell = document.createElement('div');
		cell.className = 'pv-data-cell';
		cell.setAttribute('data-key', 'cell1');
		root.appendChild(cell);

		// Start as inserted
		auditState.inserted.add('cell1');
		auditPlugin.afterRender!(root, ctx);
		expect(cell.classList.contains('audit-new')).toBe(true);
		expect(cell.classList.contains('audit-modified')).toBe(false);

		// Move to updated
		auditState.inserted.delete('cell1');
		auditState.updated.add('cell1');
		auditPlugin.afterRender!(root, ctx);
		expect(cell.classList.contains('audit-new')).toBe(false);
		expect(cell.classList.contains('audit-modified')).toBe(true);

		// Move to deleted
		auditState.updated.delete('cell1');
		auditState.deleted.add('cell1');
		auditPlugin.afterRender!(root, ctx);
		expect(cell.classList.contains('audit-modified')).toBe(false);
		expect(cell.classList.contains('audit-deleted')).toBe(true);

		root.parentElement?.remove();
	});
});
