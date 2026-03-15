// @vitest-environment jsdom
// tests/profiling/supergrid-render.bench.ts
// PROF-05: SuperGrid _renderCells() cycle time at varying axis configurations.
//
// Measures the D3 data join render cost across three axis configurations:
//   - single axis (folder) — 1 row axis, 0 col axes
//   - dual axis (folder x card_type) — 1 row axis, 1 col axis
//   - triple axis (folder x card_type x status) — 1 row axis, 2 col axes
//
// Each configuration tested with 1K, 5K, and 20K cells.
// jsdom overhead is ~5-10x vs Chrome — these are relative comparison points.
//
// p99 values from these runs populate BOTTLENECKS.md.
//
// Run with: npx vitest bench tests/profiling/supergrid-render.bench.ts --run

import { afterAll, beforeAll, bench, describe, vi } from 'vitest';
import type { AxisMapping } from '../../src/providers/types';
import { SuperGrid } from '../../src/views/SuperGrid';
import type {
	SuperGridBridgeLike,
	SuperGridDensityLike,
	SuperGridFilterLike,
	SuperGridProviderLike,
} from '../../src/views/types';
import type { CellDatum } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Helpers (shared with SuperGrid.bench.ts pattern)
// ---------------------------------------------------------------------------

// Fixed-seed PRNG for deterministic data generation
function mulberry32(seed: number): () => number {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function generateCombinations(fields: string[], valuesPerField: number): Record<string, string>[] {
	if (fields.length === 0) return [{}];
	const [first, ...rest] = fields;
	const subCombos = generateCombinations(rest, valuesPerField);
	const combos: Record<string, string>[] = [];
	for (let v = 0; v < valuesPerField; v++) {
		for (const sub of subCombos) {
			combos.push({ [first!]: `${first}_v${v}`, ...sub });
		}
	}
	return combos;
}

/**
 * Generate synthetic CellDatum array targeting approximately `targetCellCount` cells.
 * valuesPerAxis is computed so that colValues * rowValues ~= targetCellCount.
 */
function makeSyntheticCells(
	colAxes: AxisMapping[],
	rowAxes: AxisMapping[],
	targetCellCount: number,
	seed = 42,
): CellDatum[] {
	const rand = mulberry32(seed);
	const totalAxes = colAxes.length + rowAxes.length;

	// Compute values-per-axis so total combos ~= targetCellCount
	// totalCombos = valuesPerAxis ^ totalAxes => valuesPerAxis = targetCellCount ^ (1/totalAxes)
	const valuesPerAxis = totalAxes > 0 ? Math.max(1, Math.round(targetCellCount ** (1 / totalAxes))) : targetCellCount;

	const colCombos = generateCombinations(
		colAxes.map((a) => a.field),
		valuesPerAxis,
	);
	const rowCombos = generateCombinations(
		rowAxes.map((a) => a.field),
		valuesPerAxis,
	);

	const cells: CellDatum[] = [];
	for (const rowCombo of rowCombos) {
		for (const colCombo of colCombos) {
			const count = Math.floor(rand() * 5) + 1;
			const cell: Record<string, unknown> = {
				count,
				card_ids: Array.from({ length: count }, (_, i) => `card-${cells.length}-${i}`),
			};
			for (const [key, val] of Object.entries(rowCombo)) {
				cell[key] = val;
			}
			for (const [key, val] of Object.entries(colCombo)) {
				cell[key] = val;
			}
			cells.push(cell as unknown as CellDatum);
		}
	}
	return cells;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeMockBridge(cells: CellDatum[] = []): SuperGridBridgeLike {
	return {
		superGridQuery: vi.fn().mockResolvedValue(cells),
		calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
	};
}

function makeMockProvider(colAxes: AxisMapping[], rowAxes: AxisMapping[]): SuperGridProviderLike {
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
			getAggregation: vi.fn().mockReturnValue('count'),
	};
}

function makeMockFilter(): SuperGridFilterLike {
	return {
		compile: vi.fn().mockReturnValue({ where: '1=1', params: [] }),
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
			viewMode: 'matrix' as const,
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
// Axis configurations
// ---------------------------------------------------------------------------

const SINGLE_AXIS = {
	colAxes: [] as AxisMapping[],
	rowAxes: [{ field: 'folder', direction: 'asc' as const }],
};

const DUAL_AXIS = {
	colAxes: [{ field: 'card_type', direction: 'asc' as const }],
	rowAxes: [{ field: 'folder', direction: 'asc' as const }],
};

const TRIPLE_AXIS = {
	colAxes: [
		{ field: 'card_type', direction: 'asc' as const },
		{ field: 'status', direction: 'asc' as const },
	],
	rowAxes: [{ field: 'folder', direction: 'asc' as const }],
};

// ---------------------------------------------------------------------------
// single axis (folder)
// ---------------------------------------------------------------------------

describe('single axis (folder)', () => {
	let container: HTMLElement;

	beforeAll(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterAll(() => {
		document.body.removeChild(container);
	});

	const { colAxes, rowAxes } = SINGLE_AXIS;

	bench(
		'_renderCells 1K cells',
		() => {
			const cells = makeSyntheticCells(colAxes, rowAxes, 1_000, 11);
			const grid = new SuperGrid(
				makeMockProvider(colAxes, rowAxes),
				makeMockFilter(),
				makeMockBridge(cells),
				makeMockCoordinator(),
				undefined,
				undefined,
				makeMockDensity(),
			);
			grid.mount(container);
			(grid as any)._renderCells(cells, colAxes, rowAxes);
			grid.destroy();
		},
		{ iterations: 10, time: 5_000 },
	);

	bench(
		'_renderCells 5K cells',
		() => {
			const cells = makeSyntheticCells(colAxes, rowAxes, 5_000, 12);
			const grid = new SuperGrid(
				makeMockProvider(colAxes, rowAxes),
				makeMockFilter(),
				makeMockBridge(cells),
				makeMockCoordinator(),
				undefined,
				undefined,
				makeMockDensity(),
			);
			grid.mount(container);
			(grid as any)._renderCells(cells, colAxes, rowAxes);
			grid.destroy();
		},
		{ iterations: 10, time: 5_000 },
	);

	bench(
		'_renderCells 20K cells',
		() => {
			const cells = makeSyntheticCells(colAxes, rowAxes, 20_000, 13);
			const grid = new SuperGrid(
				makeMockProvider(colAxes, rowAxes),
				makeMockFilter(),
				makeMockBridge(cells),
				makeMockCoordinator(),
				undefined,
				undefined,
				makeMockDensity(),
			);
			grid.mount(container);
			(grid as any)._renderCells(cells, colAxes, rowAxes);
			grid.destroy();
		},
		{ iterations: 10, time: 5_000 },
	);
});

// ---------------------------------------------------------------------------
// dual axis (folder x card_type)
// ---------------------------------------------------------------------------

describe('dual axis (folder x card_type)', () => {
	let container: HTMLElement;

	beforeAll(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterAll(() => {
		document.body.removeChild(container);
	});

	const { colAxes, rowAxes } = DUAL_AXIS;

	bench(
		'_renderCells 1K cells',
		() => {
			const cells = makeSyntheticCells(colAxes, rowAxes, 1_000, 21);
			const grid = new SuperGrid(
				makeMockProvider(colAxes, rowAxes),
				makeMockFilter(),
				makeMockBridge(cells),
				makeMockCoordinator(),
				undefined,
				undefined,
				makeMockDensity(),
			);
			grid.mount(container);
			(grid as any)._renderCells(cells, colAxes, rowAxes);
			grid.destroy();
		},
		{ iterations: 10, time: 5_000 },
	);

	bench(
		'_renderCells 5K cells',
		() => {
			const cells = makeSyntheticCells(colAxes, rowAxes, 5_000, 22);
			const grid = new SuperGrid(
				makeMockProvider(colAxes, rowAxes),
				makeMockFilter(),
				makeMockBridge(cells),
				makeMockCoordinator(),
				undefined,
				undefined,
				makeMockDensity(),
			);
			grid.mount(container);
			(grid as any)._renderCells(cells, colAxes, rowAxes);
			grid.destroy();
		},
		{ iterations: 10, time: 5_000 },
	);

	bench(
		'_renderCells 20K cells',
		() => {
			const cells = makeSyntheticCells(colAxes, rowAxes, 20_000, 23);
			const grid = new SuperGrid(
				makeMockProvider(colAxes, rowAxes),
				makeMockFilter(),
				makeMockBridge(cells),
				makeMockCoordinator(),
				undefined,
				undefined,
				makeMockDensity(),
			);
			grid.mount(container);
			(grid as any)._renderCells(cells, colAxes, rowAxes);
			grid.destroy();
		},
		{ iterations: 10, time: 5_000 },
	);
});

// ---------------------------------------------------------------------------
// triple axis (folder x card_type x status)
// ---------------------------------------------------------------------------

describe('triple axis (folder x card_type x status)', () => {
	let container: HTMLElement;

	beforeAll(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterAll(() => {
		document.body.removeChild(container);
	});

	const { colAxes, rowAxes } = TRIPLE_AXIS;

	bench(
		'_renderCells 1K cells',
		() => {
			const cells = makeSyntheticCells(colAxes, rowAxes, 1_000, 31);
			const grid = new SuperGrid(
				makeMockProvider(colAxes, rowAxes),
				makeMockFilter(),
				makeMockBridge(cells),
				makeMockCoordinator(),
				undefined,
				undefined,
				makeMockDensity(),
			);
			grid.mount(container);
			(grid as any)._renderCells(cells, colAxes, rowAxes);
			grid.destroy();
		},
		{ iterations: 10, time: 5_000 },
	);

	bench(
		'_renderCells 5K cells',
		() => {
			const cells = makeSyntheticCells(colAxes, rowAxes, 5_000, 32);
			const grid = new SuperGrid(
				makeMockProvider(colAxes, rowAxes),
				makeMockFilter(),
				makeMockBridge(cells),
				makeMockCoordinator(),
				undefined,
				undefined,
				makeMockDensity(),
			);
			grid.mount(container);
			(grid as any)._renderCells(cells, colAxes, rowAxes);
			grid.destroy();
		},
		{ iterations: 10, time: 5_000 },
	);

	bench(
		'_renderCells 20K cells',
		() => {
			const cells = makeSyntheticCells(colAxes, rowAxes, 20_000, 33);
			const grid = new SuperGrid(
				makeMockProvider(colAxes, rowAxes),
				makeMockFilter(),
				makeMockBridge(cells),
				makeMockCoordinator(),
				undefined,
				undefined,
				makeMockDensity(),
			);
			grid.mount(container);
			(grid as any)._renderCells(cells, colAxes, rowAxes);
			grid.destroy();
		},
		{ iterations: 10, time: 5_000 },
	);
});
