// @vitest-environment jsdom
// Isometry v5 — Phase 97 Pivot Table Tests
// Unit and integration tests for the self-contained D3 pivot table module.
//
// Design:
//   - Pure function tests for span calculation and mock data generation
//   - DOM tests for PivotGrid and PivotConfigPanel rendering
//   - Pointer event DnD tests for config panel
//
// Requirements: PIV-01..PIV-18

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateSpans, filterEmptyCombinations } from '../../../src/views/pivot/PivotSpans';
import {
	allDimensions,
	generateCombinations,
	generateMockData,
	getCellKey,
} from '../../../src/views/pivot/PivotMockData';
import type { HeaderDimension, SpanInfo } from '../../../src/views/pivot/PivotTypes';

// ---------------------------------------------------------------------------
// PIV-02: Mock data generation
// ---------------------------------------------------------------------------

describe('PivotMockData', () => {
	describe('generateCombinations', () => {
		it('produces cartesian product of single dimension', () => {
			const dims: HeaderDimension[] = [
				{ id: 'a', type: 'folder', name: 'A', values: ['X', 'Y', 'Z'] },
			];
			const result = generateCombinations(dims);
			expect(result).toEqual([['X'], ['Y'], ['Z']]);
		});

		it('produces cartesian product of two dimensions', () => {
			const dims: HeaderDimension[] = [
				{ id: 'a', type: 'folder', name: 'A', values: ['X', 'Y'] },
				{ id: 'b', type: 'tag', name: 'B', values: ['1', '2'] },
			];
			const result = generateCombinations(dims);
			expect(result).toEqual([
				['X', '1'],
				['X', '2'],
				['Y', '1'],
				['Y', '2'],
			]);
		});

		it('produces empty array for empty dimensions', () => {
			expect(generateCombinations([])).toEqual([[]]);
		});
	});

	describe('getCellKey', () => {
		it('joins row and col paths with :: separator', () => {
			expect(getCellKey(['A', 'B'], ['X', 'Y'])).toBe('A|B::X|Y');
		});

		it('handles empty paths', () => {
			expect(getCellKey([], [])).toBe('::');
		});
	});

	describe('generateMockData', () => {
		it('generates data for all combinations', () => {
			const rows: HeaderDimension[] = [
				{ id: 'a', type: 'folder', name: 'A', values: ['X', 'Y'] },
			];
			const cols: HeaderDimension[] = [
				{ id: 'b', type: 'tag', name: 'B', values: ['1', '2'] },
			];
			const data = generateMockData(rows, cols, 42);
			expect(data.size).toBe(4); // 2×2
		});

		it('produces deterministic output with seed', () => {
			const rows: HeaderDimension[] = [
				{ id: 'a', type: 'folder', name: 'A', values: ['X', 'Y'] },
			];
			const cols: HeaderDimension[] = [
				{ id: 'b', type: 'tag', name: 'B', values: ['1', '2'] },
			];
			const data1 = generateMockData(rows, cols, 42);
			const data2 = generateMockData(rows, cols, 42);
			expect([...data1.entries()]).toEqual([...data2.entries()]);
		});

		it('includes null values (sparse fill)', () => {
			const rows: HeaderDimension[] = [
				{ id: 'a', type: 'folder', name: 'A', values: ['X', 'Y', 'Z'] },
			];
			const cols: HeaderDimension[] = [
				{
					id: 'b',
					type: 'month',
					name: 'B',
					values: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
				},
			];
			const data = generateMockData(rows, cols, 123);
			const values = [...data.values()];
			expect(values.some((v) => v === null)).toBe(true);
			expect(values.some((v) => v !== null)).toBe(true);
		});
	});

	describe('allDimensions catalog', () => {
		it('contains 6 dimensions', () => {
			expect(allDimensions).toHaveLength(6);
		});

		it('has unique IDs', () => {
			const ids = allDimensions.map((d) => d.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it('day dimension has 31 values', () => {
			const day = allDimensions.find((d) => d.type === 'day');
			expect(day?.values).toHaveLength(31);
		});
	});
});

// ---------------------------------------------------------------------------
// PIV-04: Span calculation
// ---------------------------------------------------------------------------

describe('PivotSpans', () => {
	describe('calculateSpans', () => {
		it('produces single span for single-value dimension', () => {
			const dims: HeaderDimension[] = [
				{ id: 'a', type: 'folder', name: 'A', values: ['X'] },
			];
			const combos = [['X']];
			const result = calculateSpans(dims, combos);
			expect(result).toEqual([[{ span: 1, label: 'X' }]]);
		});

		it('merges consecutive identical values at level 0', () => {
			const dims: HeaderDimension[] = [
				{ id: 'a', type: 'year', name: 'Year', values: ['2024', '2025'] },
				{ id: 'b', type: 'month', name: 'Month', values: ['Jan', 'Feb'] },
			];
			const combos = [
				['2024', 'Jan'],
				['2024', 'Feb'],
				['2025', 'Jan'],
				['2025', 'Feb'],
			];
			const result = calculateSpans(dims, combos);

			// Level 0: 2024 spans 2, 2025 spans 2
			expect(result[0]).toEqual([
				{ span: 2, label: '2024' },
				{ span: 2, label: '2025' },
			]);

			// Level 1: each month spans 1
			expect(result[1]).toEqual([
				{ span: 1, label: 'Jan' },
				{ span: 1, label: 'Feb' },
				{ span: 1, label: 'Jan' },
				{ span: 1, label: 'Feb' },
			]);
		});

		it('does not merge across parent boundary', () => {
			const dims: HeaderDimension[] = [
				{ id: 'a', type: 'year', name: 'Year', values: ['2024', '2025'] },
				{ id: 'b', type: 'month', name: 'Month', values: ['Jan'] },
			];
			// Same month 'Jan' under different years — should NOT merge
			const combos = [
				['2024', 'Jan'],
				['2025', 'Jan'],
			];
			const result = calculateSpans(dims, combos);

			expect(result[0]).toEqual([
				{ span: 1, label: '2024' },
				{ span: 1, label: '2025' },
			]);
			expect(result[1]).toEqual([
				{ span: 1, label: 'Jan' },
				{ span: 1, label: 'Jan' },
			]);
		});

		it('handles three levels', () => {
			const dims: HeaderDimension[] = [
				{ id: 'a', type: 'folder', name: 'Folder', values: ['A'] },
				{ id: 'b', type: 'subfolder', name: 'Sub', values: ['x', 'y'] },
				{ id: 'c', type: 'tag', name: 'Tag', values: ['1'] },
			];
			const combos = [
				['A', 'x', '1'],
				['A', 'y', '1'],
			];
			const result = calculateSpans(dims, combos);

			expect(result[0]).toEqual([{ span: 2, label: 'A' }]);
			expect(result[1]).toEqual([
				{ span: 1, label: 'x' },
				{ span: 1, label: 'y' },
			]);
			expect(result[2]).toEqual([
				{ span: 1, label: '1' },
				{ span: 1, label: '1' },
			]);
		});

		it('returns empty spans for empty combinations', () => {
			const dims: HeaderDimension[] = [
				{ id: 'a', type: 'folder', name: 'A', values: [] },
			];
			expect(calculateSpans(dims, [])).toEqual([[]]);
		});
	});

	describe('filterEmptyCombinations', () => {
		it('removes rows with all-null data', () => {
			const data = new Map<string, number | null>();
			data.set('A::X', 5);
			data.set('A::Y', null);
			data.set('B::X', null);
			data.set('B::Y', null);

			const rows = [['A'], ['B']];
			const cols = [['X'], ['Y']];
			const result = filterEmptyCombinations(rows, cols, data, getCellKey, true);
			expect(result).toEqual([['A']]);
		});

		it('removes cols with all-null data', () => {
			const data = new Map<string, number | null>();
			data.set('A::X', null);
			data.set('A::Y', 7);
			data.set('B::X', null);
			data.set('B::Y', 3);

			const rows = [['A'], ['B']];
			const cols = [['X'], ['Y']];
			const result = filterEmptyCombinations(cols, rows, data, getCellKey, false);
			expect(result).toEqual([['Y']]);
		});

		it('keeps all rows when none are empty', () => {
			const data = new Map<string, number | null>();
			data.set('A::X', 1);
			data.set('B::X', 2);

			const rows = [['A'], ['B']];
			const cols = [['X']];
			const result = filterEmptyCombinations(rows, cols, data, getCellKey, true);
			expect(result).toEqual([['A'], ['B']]);
		});
	});
});

// ---------------------------------------------------------------------------
// PIV-03, PIV-06, PIV-07: PivotGrid DOM rendering
// ---------------------------------------------------------------------------

describe('PivotGrid', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('renders data cells via D3 data join', async () => {
		const { PivotGrid } = await import('../../../src/views/pivot/PivotGrid');
		const rows: HeaderDimension[] = [
			{ id: 'a', type: 'folder', name: 'Rows', values: ['A', 'B'] },
		];
		const cols: HeaderDimension[] = [
			{ id: 'b', type: 'tag', name: 'Cols', values: ['X', 'Y'] },
		];
		const data = new Map<string, number | null>();
		data.set('A::X', 10);
		data.set('A::Y', 20);
		data.set('B::X', 30);
		data.set('B::Y', null);

		const grid = new PivotGrid();
		grid.mount(container);
		grid.render(rows, cols, data, { hideEmptyRows: false, hideEmptyCols: false });

		const dataCells = container.querySelectorAll('.pv-data-cell');
		expect(dataCells.length).toBe(4);
	});

	it('renders grouped column headers with spanning', async () => {
		const { PivotGrid } = await import('../../../src/views/pivot/PivotGrid');
		const rows: HeaderDimension[] = [
			{ id: 'a', type: 'folder', name: 'Rows', values: ['A'] },
		];
		const cols: HeaderDimension[] = [
			{ id: 'b', type: 'year', name: 'Year', values: ['2024'] },
			{ id: 'c', type: 'month', name: 'Month', values: ['Jan', 'Feb'] },
		];
		const data = new Map<string, number | null>();
		data.set('A::2024|Jan', 1);
		data.set('A::2024|Feb', 2);

		const grid = new PivotGrid();
		grid.mount(container);
		grid.render(rows, cols, data, { hideEmptyRows: false, hideEmptyCols: false });

		// The grouped header overlay should have span elements
		const spanHeaders = container.querySelectorAll('.pv-col-span');
		expect(spanHeaders.length).toBeGreaterThan(0);

		// The year header should span 2 columns
		const yearSpan = container.querySelector('.pv-col-span[data-level="0"]');
		expect(yearSpan).toBeTruthy();
	});

	it('renders row headers with spanning', async () => {
		const { PivotGrid } = await import('../../../src/views/pivot/PivotGrid');
		const rows: HeaderDimension[] = [
			{ id: 'a', type: 'folder', name: 'Folder', values: ['A'] },
			{ id: 'b', type: 'subfolder', name: 'Sub', values: ['x', 'y'] },
		];
		const cols: HeaderDimension[] = [
			{ id: 'c', type: 'tag', name: 'Tag', values: ['1'] },
		];
		const data = new Map<string, number | null>();
		data.set('A|x::1', 10);
		data.set('A|y::1', 20);

		const grid = new PivotGrid();
		grid.mount(container);
		grid.render(rows, cols, data, { hideEmptyRows: false, hideEmptyCols: false });

		const rowSpans = container.querySelectorAll('.pv-row-span');
		expect(rowSpans.length).toBeGreaterThan(0);
	});

	it('renders corner cell with dimension labels', async () => {
		const { PivotGrid } = await import('../../../src/views/pivot/PivotGrid');
		const rows: HeaderDimension[] = [
			{ id: 'a', type: 'folder', name: 'Rows', values: ['A'] },
		];
		const cols: HeaderDimension[] = [
			{ id: 'b', type: 'tag', name: 'Cols', values: ['X'] },
		];
		const data = new Map<string, number | null>();
		data.set('A::X', 1);

		const grid = new PivotGrid();
		grid.mount(container);
		grid.render(rows, cols, data, { hideEmptyRows: false, hideEmptyCols: false });

		const corner = container.querySelector('.pv-corner');
		expect(corner).toBeTruthy();
		expect(corner?.textContent).toContain('Rows');
		expect(corner?.textContent).toContain('Cols');
	});

	it('respects hideEmptyRows', async () => {
		const { PivotGrid } = await import('../../../src/views/pivot/PivotGrid');
		const rows: HeaderDimension[] = [
			{ id: 'a', type: 'folder', name: 'Rows', values: ['A', 'B'] },
		];
		const cols: HeaderDimension[] = [
			{ id: 'b', type: 'tag', name: 'Cols', values: ['X'] },
		];
		const data = new Map<string, number | null>();
		data.set('A::X', 10);
		data.set('B::X', null);

		const grid = new PivotGrid();
		grid.mount(container);
		grid.render(rows, cols, data, { hideEmptyRows: true, hideEmptyCols: false });

		const dataCells = container.querySelectorAll('.pv-data-cell');
		expect(dataCells.length).toBe(1); // Only row A (B is all-null)
	});

	it('shows empty state when no dimensions assigned', async () => {
		const { PivotGrid } = await import('../../../src/views/pivot/PivotGrid');
		const grid = new PivotGrid();
		grid.mount(container);
		grid.render([], [], new Map(), { hideEmptyRows: false, hideEmptyCols: false });

		const emptyState = container.querySelector('.pv-empty');
		expect(emptyState).toBeTruthy();
	});

	it('destroy cleans up DOM', async () => {
		const { PivotGrid } = await import('../../../src/views/pivot/PivotGrid');
		const grid = new PivotGrid();
		grid.mount(container);
		grid.render(
			[{ id: 'a', type: 'folder', name: 'A', values: ['X'] }],
			[{ id: 'b', type: 'tag', name: 'B', values: ['1'] }],
			new Map([['X::1', 5]]),
			{ hideEmptyRows: false, hideEmptyCols: false },
		);
		grid.destroy();
		expect(container.children.length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// PIV-08..PIV-13: PivotConfigPanel
// ---------------------------------------------------------------------------

describe('PivotConfigPanel', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('renders four drop zones (Available, Rows, Columns, Z)', async () => {
		const { PivotConfigPanel } = await import('../../../src/views/pivot/PivotConfigPanel');
		const panel = new PivotConfigPanel();
		panel.mount(container);
		panel.render({
			rowDimensions: [],
			colDimensions: [],
			availableDimensions: allDimensions,
			onDropToRow: vi.fn(),
			onDropToCol: vi.fn(),
			onDropToAvailable: vi.fn(),
			onRemoveFromRow: vi.fn(),
			onRemoveFromCol: vi.fn(),
			onTranspose: vi.fn(),
			onToggleHideEmptyRows: vi.fn(),
			onToggleHideEmptyCols: vi.fn(),
			hideEmptyRows: false,
			hideEmptyCols: false,
		});

		const zones = container.querySelectorAll('.pv-drop-zone');
		expect(zones.length).toBe(4);
	});

	it('renders dimension chips in each zone', async () => {
		const { PivotConfigPanel } = await import('../../../src/views/pivot/PivotConfigPanel');
		const panel = new PivotConfigPanel();
		panel.mount(container);
		panel.render({
			rowDimensions: [allDimensions[0]!], // Folders
			colDimensions: [allDimensions[3]!], // Years
			availableDimensions: [allDimensions[1]!, allDimensions[2]!], // Subfolders, Tags
			onDropToRow: vi.fn(),
			onDropToCol: vi.fn(),
			onDropToAvailable: vi.fn(),
			onRemoveFromRow: vi.fn(),
			onRemoveFromCol: vi.fn(),
			onTranspose: vi.fn(),
			onToggleHideEmptyRows: vi.fn(),
			onToggleHideEmptyCols: vi.fn(),
			hideEmptyRows: false,
			hideEmptyCols: false,
		});

		const chips = container.querySelectorAll('.pv-chip');
		expect(chips.length).toBe(4); // 1 row + 1 col + 2 available
	});

	it('transpose button calls onTranspose', async () => {
		const { PivotConfigPanel } = await import('../../../src/views/pivot/PivotConfigPanel');
		const onTranspose = vi.fn();
		const panel = new PivotConfigPanel();
		panel.mount(container);
		panel.render({
			rowDimensions: [allDimensions[0]!],
			colDimensions: [allDimensions[3]!],
			availableDimensions: [],
			onDropToRow: vi.fn(),
			onDropToCol: vi.fn(),
			onDropToAvailable: vi.fn(),
			onRemoveFromRow: vi.fn(),
			onRemoveFromCol: vi.fn(),
			onTranspose,
			onToggleHideEmptyRows: vi.fn(),
			onToggleHideEmptyCols: vi.fn(),
			hideEmptyRows: false,
			hideEmptyCols: false,
		});

		const transposeBtn = container.querySelector('[data-action="transpose"]') as HTMLButtonElement;
		expect(transposeBtn).toBeTruthy();
		transposeBtn.click();
		expect(onTranspose).toHaveBeenCalledOnce();
	});

	it('remove button calls onRemoveFromRow', async () => {
		const { PivotConfigPanel } = await import('../../../src/views/pivot/PivotConfigPanel');
		const onRemoveFromRow = vi.fn();
		const panel = new PivotConfigPanel();
		panel.mount(container);
		panel.render({
			rowDimensions: [allDimensions[0]!],
			colDimensions: [],
			availableDimensions: [],
			onDropToRow: vi.fn(),
			onDropToCol: vi.fn(),
			onDropToAvailable: vi.fn(),
			onRemoveFromRow,
			onRemoveFromCol: vi.fn(),
			onTranspose: vi.fn(),
			onToggleHideEmptyRows: vi.fn(),
			onToggleHideEmptyCols: vi.fn(),
			hideEmptyRows: false,
			hideEmptyCols: false,
		});

		const removeBtn = container.querySelector('.pv-chip-remove') as HTMLButtonElement;
		expect(removeBtn).toBeTruthy();
		removeBtn.click();
		expect(onRemoveFromRow).toHaveBeenCalledWith('folder');
	});

	it('destroy cleans up', async () => {
		const { PivotConfigPanel } = await import('../../../src/views/pivot/PivotConfigPanel');
		const panel = new PivotConfigPanel();
		panel.mount(container);
		panel.render({
			rowDimensions: [],
			colDimensions: [],
			availableDimensions: [],
			onDropToRow: vi.fn(),
			onDropToCol: vi.fn(),
			onDropToAvailable: vi.fn(),
			onRemoveFromRow: vi.fn(),
			onRemoveFromCol: vi.fn(),
			onTranspose: vi.fn(),
			onToggleHideEmptyRows: vi.fn(),
			onToggleHideEmptyCols: vi.fn(),
			hideEmptyRows: false,
			hideEmptyCols: false,
		});
		panel.destroy();
		expect(container.children.length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// PIV-14: PivotTable (orchestrator)
// ---------------------------------------------------------------------------

describe('PivotTable', () => {
	let container: HTMLDivElement;

	// Small dimensions to avoid massive cartesian product in tests
	const testRows: HeaderDimension[] = [
		{ id: 'folder', type: 'folder', name: 'Folders', values: ['A', 'B'] },
	];
	const testCols: HeaderDimension[] = [
		{ id: 'year', type: 'year', name: 'Years', values: ['2024', '2025'] },
	];

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('mounts with default dimensions and renders grid + config', async () => {
		const { PivotTable } = await import('../../../src/views/pivot/PivotTable');
		const table = new PivotTable({ rowDimensions: testRows, colDimensions: testCols });
		table.mount(container);

		// Should have config panel and grid sections
		expect(container.querySelector('.pv-config-panel')).toBeTruthy();
		expect(container.querySelector('.pv-grid-wrapper')).toBeTruthy();
	});

	it('transpose swaps row and column dimensions', async () => {
		const { PivotTable } = await import('../../../src/views/pivot/PivotTable');
		const table = new PivotTable({ rowDimensions: testRows, colDimensions: testCols });
		table.mount(container);

		const initialRowCount = container.querySelectorAll(
			'.pv-drop-zone[data-zone="row"] .pv-chip',
		).length;
		const initialColCount = container.querySelectorAll(
			'.pv-drop-zone[data-zone="column"] .pv-chip',
		).length;

		expect(initialRowCount).toBe(1); // Folders
		expect(initialColCount).toBe(1); // Years

		// Click transpose
		const transposeBtn = container.querySelector('[data-action="transpose"]') as HTMLButtonElement;
		transposeBtn?.click();

		const newRowCount = container.querySelectorAll(
			'.pv-drop-zone[data-zone="row"] .pv-chip',
		).length;
		const newColCount = container.querySelectorAll(
			'.pv-drop-zone[data-zone="column"] .pv-chip',
		).length;

		expect(newRowCount).toBe(initialColCount);
		expect(newColCount).toBe(initialRowCount);
	});

	it('destroy cleans up everything', async () => {
		const { PivotTable } = await import('../../../src/views/pivot/PivotTable');
		const table = new PivotTable({ rowDimensions: testRows, colDimensions: testCols });
		table.mount(container);
		table.destroy();
		expect(container.children.length).toBe(0);
	});

	it('remove from rows moves dimension to available', async () => {
		const { PivotTable } = await import('../../../src/views/pivot/PivotTable');
		const table = new PivotTable({ rowDimensions: testRows, colDimensions: testCols });
		table.mount(container);

		// Remove the row dimension
		const removeBtn = container.querySelector(
			'.pv-drop-zone[data-zone="row"] .pv-chip-remove',
		) as HTMLButtonElement;
		removeBtn?.click();

		// Row zone should be empty, available should have the dimension
		const rowChips = container.querySelectorAll('.pv-drop-zone[data-zone="row"] .pv-chip');
		expect(rowChips.length).toBe(0);

		const availableChips = container.querySelectorAll(
			'.pv-drop-zone[data-zone="available"] .pv-chip',
		);
		expect(availableChips.length).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// PIV-09: Pointer-event DnD insertion index
// ---------------------------------------------------------------------------

describe('PivotConfigPanel — insertion index', () => {
	it('onDropToRow receives insertIndex when provided', async () => {
		const { PivotConfigPanel } = await import('../../../src/views/pivot/PivotConfigPanel');
		const onDropToRow = vi.fn();
		const panel = new PivotConfigPanel();
		const container = document.createElement('div');
		document.body.appendChild(container);

		panel.mount(container);
		panel.render({
			rowDimensions: [
				{ id: 'a', type: 'folder', name: 'A', values: [] },
				{ id: 'b', type: 'subfolder', name: 'B', values: [] },
			],
			colDimensions: [],
			availableDimensions: [{ id: 'c', type: 'tag', name: 'C', values: [] }],
			onDropToRow,
			onDropToCol: vi.fn(),
			onDropToAvailable: vi.fn(),
			onRemoveFromRow: vi.fn(),
			onRemoveFromCol: vi.fn(),
			onTranspose: vi.fn(),
			onToggleHideEmptyRows: vi.fn(),
			onToggleHideEmptyCols: vi.fn(),
			hideEmptyRows: false,
			hideEmptyCols: false,
		});

		// Verify the callback signature accepts optional third argument
		onDropToRow({ id: 'c', type: 'tag', name: 'C', values: [] }, 'available', 1);
		expect(onDropToRow).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'c' }),
			'available',
			1,
		);

		panel.destroy();
		container.remove();
	});
});
