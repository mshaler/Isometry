// Isometry v5 — Phase 122 Plan 01
// DataAdapter interface tests: MockDataAdapter + BridgeDataAdapter
//
// TDD RED phase: these tests drive the DataAdapter.ts, MockDataAdapter.ts, BridgeDataAdapter.ts
// implementations.
//
// Requirements: CONV-01, CONV-03

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataAdapter } from '../../../src/views/pivot/DataAdapter';
import { MockDataAdapter } from '../../../src/views/pivot/MockDataAdapter';
import { BridgeDataAdapter } from '../../../src/views/pivot/BridgeDataAdapter';
import { allDimensions } from '../../../src/views/pivot/PivotMockData';
import type { HeaderDimension } from '../../../src/views/pivot/PivotTypes';
import type { SuperGridBridgeLike, SuperGridProviderLike, SuperGridFilterLike, SuperGridDensityLike } from '../../../src/views/types';
import type { CellDatum } from '../../../src/worker/protocol';
import type { AxisMapping } from '../../../src/providers/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAxisMapping(field: string): AxisMapping {
	return { field: field as AxisMapping['field'], direction: 'asc' };
}

function makeMockBridge(cells: CellDatum[] = []): SuperGridBridgeLike {
	return {
		superGridQuery: vi.fn().mockResolvedValue(cells),
		calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
	};
}

function makeMockProvider(rowAxes: AxisMapping[] = [], colAxes: AxisMapping[] = []): SuperGridProviderLike {
	return {
		getStackedGroupBySQL: vi.fn().mockReturnValue({ rowAxes, colAxes }),
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
		getAggregation: vi.fn().mockReturnValue('count'),
	};
}

function makeMockFilter(): SuperGridFilterLike {
	return {
		compile: vi.fn().mockReturnValue({ where: '', params: [] }),
		hasAxisFilter: vi.fn().mockReturnValue(false),
		getAxisFilter: vi.fn().mockReturnValue([]),
		setAxisFilter: vi.fn(),
		clearAxis: vi.fn(),
		clearAllAxisFilters: vi.fn(),
	};
}

function makeMockDensity(): SuperGridDensityLike {
	return {
		getState: vi.fn().mockReturnValue({
			axisGranularity: null,
			hideEmpty: false,
			viewMode: 'spreadsheet',
			regionConfig: null,
		}),
		setGranularity: vi.fn(),
		setHideEmpty: vi.fn(),
		setViewMode: vi.fn(),
		subscribe: vi.fn().mockReturnValue(() => {}),
	};
}

function makeMockCoordinator() {
	return {
		subscribe: vi.fn().mockReturnValue(() => {}),
	};
}

// ---------------------------------------------------------------------------
// MockDataAdapter tests
// ---------------------------------------------------------------------------

describe('MockDataAdapter', () => {
	let adapter: MockDataAdapter;

	beforeEach(() => {
		adapter = new MockDataAdapter();
	});

	it('Test 1: getAllDimensions() returns allDimensions from PivotMockData', () => {
		const dims = adapter.getAllDimensions();
		expect(dims).toHaveLength(allDimensions.length);
		expect(dims).toEqual(allDimensions);
	});

	it('Test 2: fetchData() returns Map<string, number|null> with expected keys', async () => {
		const rows = adapter.getRowDimensions();
		const cols = adapter.getColDimensions();
		const data = await adapter.fetchData(rows, cols);
		expect(data).toBeInstanceOf(Map);
		expect(data.size).toBeGreaterThan(0);
		// Verify key format: rowPath::colPath
		const firstKey = data.keys().next().value as string;
		expect(firstKey).toContain('::');
	});

	it('Test 3: getRowDimensions() returns non-empty default row dimensions', () => {
		const rowDims = adapter.getRowDimensions();
		expect(Array.isArray(rowDims)).toBe(true);
		expect(rowDims.length).toBeGreaterThan(0);
		rowDims.forEach((d) => {
			expect(d).toHaveProperty('id');
			expect(d).toHaveProperty('type');
			expect(d).toHaveProperty('name');
			expect(d).toHaveProperty('values');
		});
	});

	it('Test 3b: getColDimensions() returns non-empty default col dimensions', () => {
		const colDims = adapter.getColDimensions();
		expect(Array.isArray(colDims)).toBe(true);
		expect(colDims.length).toBeGreaterThan(0);
	});

	it('setRowDimensions() updates getRowDimensions()', () => {
		const newDims: HeaderDimension[] = [allDimensions[0]!];
		adapter.setRowDimensions(newDims);
		expect(adapter.getRowDimensions()).toEqual(newDims);
	});

	it('setColDimensions() updates getColDimensions()', () => {
		const newDims: HeaderDimension[] = [allDimensions[3]!];
		adapter.setColDimensions(newDims);
		expect(adapter.getColDimensions()).toEqual(newDims);
	});

	it('fetchData() with custom dimensions returns Map with correct cross-product size', async () => {
		const rows: HeaderDimension[] = [allDimensions[0]!]; // folder: 3 values
		const cols: HeaderDimension[] = [allDimensions[3]!]; // year: 3 values
		const data = await adapter.fetchData(rows, cols);
		// 3 rows x 3 cols = 9 cells
		expect(data.size).toBe(9);
	});

	it('implements DataAdapter interface (structural check)', () => {
		const a: DataAdapter = adapter;
		expect(typeof a.getAllDimensions).toBe('function');
		expect(typeof a.getRowDimensions).toBe('function');
		expect(typeof a.getColDimensions).toBe('function');
		expect(typeof a.setRowDimensions).toBe('function');
		expect(typeof a.setColDimensions).toBe('function');
		expect(typeof a.fetchData).toBe('function');
	});
});

// ---------------------------------------------------------------------------
// BridgeDataAdapter tests
// ---------------------------------------------------------------------------

describe('BridgeDataAdapter', () => {
	let bridge: SuperGridBridgeLike;
	let provider: SuperGridProviderLike;
	let filter: SuperGridFilterLike;
	let density: SuperGridDensityLike;
	let coordinator: ReturnType<typeof makeMockCoordinator>;
	let adapter: BridgeDataAdapter;

	beforeEach(() => {
		bridge = makeMockBridge();
		provider = makeMockProvider(
			[makeAxisMapping('folder'), makeAxisMapping('status')],
			[makeAxisMapping('card_type'), makeAxisMapping('priority')],
		);
		filter = makeMockFilter();
		density = makeMockDensity();
		coordinator = makeMockCoordinator();
		adapter = new BridgeDataAdapter({ bridge, provider, filter, density, coordinator });
	});

	it('Test 4: constructor accepts SuperGridBridgeLike + provider + filter + density', () => {
		expect(adapter).toBeInstanceOf(BridgeDataAdapter);
	});

	it('Test 5: getAllDimensions() converts AxisMapping[] to HeaderDimension[]', () => {
		const dims = adapter.getAllDimensions();
		// rowAxes (2) + colAxes (2) = 4 total dimensions
		expect(dims).toHaveLength(4);
		dims.forEach((d) => {
			expect(d).toHaveProperty('id');
			expect(d).toHaveProperty('type');
			expect(d).toHaveProperty('name');
			expect(d).toHaveProperty('values');
		});
	});

	it('Test 6: fetchData() calls bridge.superGridQuery() and returns Map<string, number|null>', async () => {
		const testCells: CellDatum[] = [
			{ folder: 'Work', card_type: 'note', count: 5, card_ids: ['1', '2'], card_names: ['A', 'B'] },
			{ folder: 'Work', card_type: 'link', count: 3, card_ids: ['3'], card_names: ['C'] },
		];
		(bridge.superGridQuery as ReturnType<typeof vi.fn>).mockResolvedValue(testCells);

		const rowDims = adapter.getRowDimensions();
		const colDims = adapter.getColDimensions();
		const data = await adapter.fetchData(rowDims, colDims);

		expect(bridge.superGridQuery).toHaveBeenCalledOnce();
		expect(data).toBeInstanceOf(Map);
		expect(data.size).toBe(2);
	});

	it('Test 6b: fetchData() passes filter.compile() result to bridge.superGridQuery()', async () => {
		(filter.compile as ReturnType<typeof vi.fn>).mockReturnValue({
			where: 'status = ?',
			params: ['active'],
		});

		const rowDims = adapter.getRowDimensions();
		const colDims = adapter.getColDimensions();
		await adapter.fetchData(rowDims, colDims);

		const callArg = (bridge.superGridQuery as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
		expect(callArg).toHaveProperty('where', 'status = ?');
		expect(callArg).toHaveProperty('params', ['active']);
	});

	it('Test 7: getRowDimensions() reads from provider.getStackedGroupBySQL().rowAxes', () => {
		const rowDims = adapter.getRowDimensions();
		expect(rowDims).toHaveLength(2); // folder, status
		expect(rowDims[0]?.id).toBe('folder');
		expect(rowDims[1]?.id).toBe('status');
	});

	it('Test 7b: getColDimensions() reads from provider.getStackedGroupBySQL().colAxes', () => {
		const colDims = adapter.getColDimensions();
		expect(colDims).toHaveLength(2); // card_type, priority
		expect(colDims[0]?.id).toBe('card_type');
		expect(colDims[1]?.id).toBe('priority');
	});

	it('setRowDimensions() calls provider.setRowAxes()', () => {
		const newDims: HeaderDimension[] = [
			{ id: 'folder', type: 'folder', name: 'Folder', values: [] },
		];
		adapter.setRowDimensions(newDims);
		expect(provider.setRowAxes).toHaveBeenCalledWith([{ field: 'folder', direction: 'asc' }]);
	});

	it('setColDimensions() calls provider.setColAxes()', () => {
		const newDims: HeaderDimension[] = [
			{ id: 'card_type', type: 'folder', name: 'Card Type', values: [] },
		];
		adapter.setColDimensions(newDims);
		expect(provider.setColAxes).toHaveBeenCalledWith([{ field: 'card_type', direction: 'asc' }]);
	});

	it('subscribe() delegates to coordinator.subscribe()', () => {
		const cb = vi.fn();
		adapter.subscribe!(cb);
		expect(coordinator.subscribe).toHaveBeenCalledWith(cb);
	});

	it('getProviderContext() returns object with bridge, provider, filter, density', () => {
		const ctx = adapter.getProviderContext!();
		expect(ctx).toHaveProperty('bridge');
		expect(ctx).toHaveProperty('provider');
		expect(ctx).toHaveProperty('filter');
		expect(ctx).toHaveProperty('density');
	});

	it('implements DataAdapter interface (structural check)', () => {
		const a: DataAdapter = adapter;
		expect(typeof a.getAllDimensions).toBe('function');
		expect(typeof a.getRowDimensions).toBe('function');
		expect(typeof a.getColDimensions).toBe('function');
		expect(typeof a.setRowDimensions).toBe('function');
		expect(typeof a.setColDimensions).toBe('function');
		expect(typeof a.fetchData).toBe('function');
	});
});
