// @vitest-environment jsdom
// Isometry v5 — Phase 141 Plan 01
// Integration tests for PivotGrid layer event bridge wiring.
//
// Design:
//   - Verifies data-key/data-row/data-col attributes set on .pv-data-cell after render()
//   - Verifies pointerdown on scroll container routes to plugin pipeline with real RenderContext
//   - Verifies afterRender receives scroll container (not overlay) as rootEl
//
// Requirements: EVNT-01, EVNT-02, EVNT-03

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PivotGrid } from '../../../src/views/pivot/PivotGrid';
import { getCellKey } from '../../../src/views/pivot/PivotMockData';
import type { HeaderDimension } from '../../../src/views/pivot/PivotTypes';
import type { PluginRegistry } from '../../../src/views/pivot/plugins/PluginRegistry';
import type { CellPlacement, GridLayout, RenderContext } from '../../../src/views/pivot/plugins/PluginTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal row/col dimensions for 2×2 pivot */
function makeTestDimensions(): { rowDims: HeaderDimension[]; colDims: HeaderDimension[] } {
	const rowDims: HeaderDimension[] = [
		{ id: 'row', type: 'folder', name: 'Row', values: ['A', 'B'] },
	];
	const colDims: HeaderDimension[] = [
		{ id: 'col', type: 'tag', name: 'Col', values: ['X', 'Y'] },
	];
	return { rowDims, colDims };
}

/** Build a 2×2 data map */
function makeTestData(): {
	data: Map<string, number | null>;
	rowCombinations: string[][];
	colCombinations: string[][];
} {
	const rowCombinations = [['A'], ['B']];
	const colCombinations = [['X'], ['Y']];
	const data = new Map<string, number | null>();
	for (const row of rowCombinations) {
		for (const col of colCombinations) {
			data.set(getCellKey(row, col), Math.random());
		}
	}
	return { data, rowCombinations, colCombinations };
}

/** Minimal mock PluginRegistry that captures afterRender rootEl and runOnPointerEvent calls */
function makeMockRegistry() {
	let lastAfterRenderRoot: HTMLElement | null = null;
	const runOnPointerEvent = vi.fn();
	const runAfterRender = vi.fn((root: HTMLElement, _ctx: RenderContext) => {
		lastAfterRenderRoot = root;
	});

	const registry = {
		isEnabled: vi.fn(() => false),
		enable: vi.fn(),
		disable: vi.fn(),
		getAll: vi.fn(() => []),
		runTransformData: vi.fn((cells: CellPlacement[]) => cells),
		runTransformLayout: vi.fn((layout: GridLayout) => layout),
		runAfterRender,
		runOnPointerEvent,
		runOnScroll: vi.fn(),
		get lastAfterRenderRoot() {
			return lastAfterRenderRoot;
		},
	} as unknown as PluginRegistry & { lastAfterRenderRoot: HTMLElement | null };

	return registry;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let pivotGrid: PivotGrid;
let mockRegistry: ReturnType<typeof makeMockRegistry>;

const options = { hideEmptyRows: false, hideEmptyCols: false };

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	pivotGrid = new PivotGrid();
	pivotGrid.mount(container);
	mockRegistry = makeMockRegistry();
	pivotGrid.setRegistry(mockRegistry as unknown as PluginRegistry);
});

afterEach(() => {
	pivotGrid.destroy();
	container.remove();
});

// ---------------------------------------------------------------------------
// EVNT-01: Data attributes on cells
// ---------------------------------------------------------------------------

describe('EVNT-01: data-key/data-row/data-col attributes on cells', () => {
	it('sets data-key on each .pv-data-cell after render()', () => {
		const { rowDims, colDims } = makeTestDimensions();
		const { data, rowCombinations, colCombinations } = makeTestData();

		pivotGrid.render(rowDims, colDims, data, rowCombinations, colCombinations, options);

		const cells = container.querySelectorAll<HTMLElement>('.pv-data-cell');
		expect(cells.length).toBeGreaterThan(0);
		for (const cell of cells) {
			expect(cell.getAttribute('data-key')).toBeTruthy();
		}
	});

	it('sets data-row on each .pv-data-cell after render()', () => {
		const { rowDims, colDims } = makeTestDimensions();
		const { data, rowCombinations, colCombinations } = makeTestData();

		pivotGrid.render(rowDims, colDims, data, rowCombinations, colCombinations, options);

		const cells = container.querySelectorAll<HTMLElement>('.pv-data-cell');
		expect(cells.length).toBeGreaterThan(0);
		for (const cell of cells) {
			expect(cell.getAttribute('data-row')).toMatch(/^\d+$/);
		}
	});

	it('sets data-col on each .pv-data-cell after render()', () => {
		const { rowDims, colDims } = makeTestDimensions();
		const { data, rowCombinations, colCombinations } = makeTestData();

		pivotGrid.render(rowDims, colDims, data, rowCombinations, colCombinations, options);

		const cells = container.querySelectorAll<HTMLElement>('.pv-data-cell');
		expect(cells.length).toBeGreaterThan(0);
		for (const cell of cells) {
			expect(cell.getAttribute('data-col')).toMatch(/^\d+$/);
		}
	});

	it('data-key matches expected getCellKey format for the first cell', () => {
		const { rowDims, colDims } = makeTestDimensions();
		const { data, rowCombinations, colCombinations } = makeTestData();

		pivotGrid.render(rowDims, colDims, data, rowCombinations, colCombinations, options);

		// First cell is row 0 ("A"), col 0 ("X")
		const expectedKey = getCellKey(['A'], ['X']);
		const firstCell = container.querySelector<HTMLElement>('.pv-data-cell');
		expect(firstCell?.getAttribute('data-key')).toBe(expectedKey);
	});

	it('data-row and data-col match rowIdx and colIdx of the cell', () => {
		const { rowDims, colDims } = makeTestDimensions();
		const rowCombinations = [['A'], ['B']];
		const colCombinations = [['X'], ['Y']];
		const data = new Map<string, number | null>([
			[getCellKey(['A'], ['X']), 1],
			[getCellKey(['A'], ['Y']), 2],
			[getCellKey(['B'], ['X']), 3],
			[getCellKey(['B'], ['Y']), 4],
		]);

		pivotGrid.render(rowDims, colDims, data, rowCombinations, colCombinations, options);

		const cells = container.querySelectorAll<HTMLElement>('.pv-data-cell');
		// 4 cells: (0,0), (0,1), (1,0), (1,1)
		const found = new Set<string>();
		for (const cell of cells) {
			const row = cell.getAttribute('data-row');
			const col = cell.getAttribute('data-col');
			found.add(`${row},${col}`);
		}
		expect(found.has('0,0')).toBe(true);
		expect(found.has('0,1')).toBe(true);
		expect(found.has('1,0')).toBe(true);
		expect(found.has('1,1')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// EVNT-02: Pointer event bridge on scroll container
// ---------------------------------------------------------------------------

describe('EVNT-02: pointerdown on scroll container triggers plugin pipeline', () => {
	it('dispatching pointerdown on scroll container calls runOnPointerEvent', () => {
		const { rowDims, colDims } = makeTestDimensions();
		const { data, rowCombinations, colCombinations } = makeTestData();

		pivotGrid.render(rowDims, colDims, data, rowCombinations, colCombinations, options);

		const scrollContainer = container.querySelector<HTMLElement>('.pv-scroll-container');
		expect(scrollContainer).not.toBeNull();

		scrollContainer!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

		expect(mockRegistry.runOnPointerEvent).toHaveBeenCalledWith(
			'pointerdown',
			expect.any(PointerEvent),
			expect.objectContaining({ cells: expect.any(Array) }),
		);
	});

	it('runOnPointerEvent context contains real cells from last render', () => {
		const { rowDims, colDims } = makeTestDimensions();
		const { data, rowCombinations, colCombinations } = makeTestData();

		pivotGrid.render(rowDims, colDims, data, rowCombinations, colCombinations, options);

		const scrollContainer = container.querySelector<HTMLElement>('.pv-scroll-container');
		scrollContainer!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

		const call = (mockRegistry.runOnPointerEvent as ReturnType<typeof vi.fn>).mock.calls[0]!;
		const ctx = call[2] as RenderContext;
		// 2 rows × 2 cols = 4 cells
		expect(ctx.cells.length).toBe(4);
	});

	it('runOnPointerEvent context rootEl is the scroll container', () => {
		const { rowDims, colDims } = makeTestDimensions();
		const { data, rowCombinations, colCombinations } = makeTestData();

		pivotGrid.render(rowDims, colDims, data, rowCombinations, colCombinations, options);

		const scrollContainer = container.querySelector<HTMLElement>('.pv-scroll-container');
		scrollContainer!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

		const call = (mockRegistry.runOnPointerEvent as ReturnType<typeof vi.fn>).mock.calls[0]!;
		const ctx = call[2] as RenderContext;
		expect(ctx.rootEl.classList.contains('pv-scroll-container')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// EVNT-03: afterRender receives scroll container as rootEl
// ---------------------------------------------------------------------------

describe('EVNT-03: afterRender rootEl is scroll container (not overlay)', () => {
	it('afterRender receives element with class pv-scroll-container', () => {
		const { rowDims, colDims } = makeTestDimensions();
		const { data, rowCombinations, colCombinations } = makeTestData();

		pivotGrid.render(rowDims, colDims, data, rowCombinations, colCombinations, options);

		expect(mockRegistry.lastAfterRenderRoot).not.toBeNull();
		expect(mockRegistry.lastAfterRenderRoot!.classList.contains('pv-scroll-container')).toBe(true);
	});

	it('afterRender rootEl contains .pv-data-cell elements', () => {
		const { rowDims, colDims } = makeTestDimensions();
		const { data, rowCombinations, colCombinations } = makeTestData();

		pivotGrid.render(rowDims, colDims, data, rowCombinations, colCombinations, options);

		const root = mockRegistry.lastAfterRenderRoot!;
		const cells = root.querySelectorAll('.pv-data-cell');
		expect(cells.length).toBeGreaterThan(0);
	});

	it('afterRender rootEl is NOT the overlay (pv-overlay)', () => {
		const { rowDims, colDims } = makeTestDimensions();
		const { data, rowCombinations, colCombinations } = makeTestData();

		pivotGrid.render(rowDims, colDims, data, rowCombinations, colCombinations, options);

		expect(mockRegistry.lastAfterRenderRoot!.classList.contains('pv-overlay')).toBe(false);
	});
});
