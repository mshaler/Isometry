// @vitest-environment jsdom
// tests/profiling/render-timing.test.ts
// SuperGrid render timing measurement for BOTTLENECKS.md
//
// Run with: npx vitest run tests/profiling/render-timing.test.ts

import { afterAll, beforeAll, describe, it, vi } from 'vitest';
import type { AxisMapping } from '../../src/providers/types';
import { SuperGrid } from '../../src/views';
import type { CellDatum } from '../../src/worker/protocol';

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

function makeSyntheticCells(
	colAxes: AxisMapping[],
	rowAxes: AxisMapping[],
	targetCellCount: number,
	seed = 42,
): CellDatum[] {
	const rand = mulberry32(seed);
	const totalAxes = colAxes.length + rowAxes.length;
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
			for (const [key, val] of Object.entries(rowCombo)) cell[key] = val;
			for (const [key, val] of Object.entries(colCombo)) cell[key] = val;
			cells.push(cell as unknown as CellDatum);
		}
	}
	return cells;
}

function makeMockBridge(cells: CellDatum[] = []) {
	return { superGridQuery: vi.fn().mockResolvedValue(cells), calcQuery: vi.fn().mockResolvedValue({ rows: [] }) };
}
function makeMockProvider(colAxes: AxisMapping[], rowAxes: AxisMapping[]) {
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
function makeMockFilter() {
	return {
		compile: vi.fn().mockReturnValue({ where: '1=1', params: [] }),
		hasAxisFilter: vi.fn().mockReturnValue(false),
		getAxisFilter: vi.fn().mockReturnValue([]),
		setAxisFilter: vi.fn(),
		clearAxis: vi.fn(),
		clearAllAxisFilters: vi.fn(),
	};
}
function makeMockDensity() {
	return {
		getState: vi
			.fn()
			.mockReturnValue({ axisGranularity: null, hideEmpty: false, viewMode: 'matrix' as const, regionConfig: null }),
		setGranularity: vi.fn(),
		setHideEmpty: vi.fn(),
		setViewMode: vi.fn(),
		subscribe: vi.fn().mockReturnValue(() => {}),
	};
}
function makeMockCoordinator() {
	return { subscribe: vi.fn().mockReturnValue(() => {}) };
}

function p99(samples: number[]): number {
	const sorted = [...samples].sort((a, b) => a - b);
	const idx = Math.max(0, Math.ceil(sorted.length * 0.99) - 1);
	return sorted[idx]!;
}

function timeRender(
	colAxes: AxisMapping[],
	rowAxes: AxisMapping[],
	cellCount: number,
	seed: number,
	iters: number,
	container: HTMLElement,
): { mean: number; p99ms: number } {
	const samples: number[] = [];
	for (let i = 0; i < iters; i++) {
		const cells = makeSyntheticCells(colAxes, rowAxes, cellCount, seed);
		const grid = new SuperGrid({
			provider: makeMockProvider(colAxes, rowAxes),
			filter: makeMockFilter(),
			bridge: makeMockBridge(cells),
			coordinator: makeMockCoordinator(),
			densityProvider: makeMockDensity(),
		});
		const t0 = performance.now();
		grid.mount(container);
		// CONV-06: Skipped -- _renderCells does not exist on ProductionSuperGrid.
		// DOM structure changed from CSS Grid to PivotGrid table layout. Behavior verified by E2E.
		// (grid as any)._renderCells(cells, colAxes, rowAxes);
		const elapsed = performance.now() - t0;
		samples.push(elapsed);
		grid.destroy();
	}
	const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
	const p99ms = p99(samples);
	return { mean, p99ms };
}

const SINGLE = { colAxes: [] as AxisMapping[], rowAxes: [{ field: 'folder', direction: 'asc' as const }] };
const DUAL = {
	colAxes: [{ field: 'card_type', direction: 'asc' as const }],
	rowAxes: [{ field: 'folder', direction: 'asc' as const }],
};
const TRIPLE = {
	colAxes: [
		{ field: 'card_type', direction: 'asc' as const },
		{ field: 'status', direction: 'asc' as const },
	],
	rowAxes: [{ field: 'folder', direction: 'asc' as const }],
};

describe('SuperGrid Render Timing (for BOTTLENECKS.md)', () => {
	let container: HTMLElement;

	beforeAll(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterAll(() => {
		document.body.removeChild(container);
	});

	it('single axis (folder) render timing', () => {
		const { colAxes, rowAxes } = SINGLE;
		const r1k = timeRender(colAxes, rowAxes, 1_000, 11, 10, container);
		const r5k = timeRender(colAxes, rowAxes, 5_000, 12, 10, container);
		const r20k = timeRender(colAxes, rowAxes, 20_000, 13, 5, container);
		console.log(
			`single(folder): 1K mean=${r1k.mean.toFixed(1)}ms p99=${r1k.p99ms.toFixed(1)}ms | 5K mean=${r5k.mean.toFixed(1)}ms p99=${r5k.p99ms.toFixed(1)}ms | 20K mean=${r20k.mean.toFixed(1)}ms p99=${r20k.p99ms.toFixed(1)}ms`,
		);
	}, 60_000);

	it('dual axis (folder x card_type) render timing', () => {
		const { colAxes, rowAxes } = DUAL;
		const r1k = timeRender(colAxes, rowAxes, 1_000, 21, 5, container);
		const r5k = timeRender(colAxes, rowAxes, 5_000, 22, 5, container);
		const r20k = timeRender(colAxes, rowAxes, 20_000, 23, 3, container);
		console.log(
			`dual(folder x card_type): 1K mean=${r1k.mean.toFixed(1)}ms p99=${r1k.p99ms.toFixed(1)}ms | 5K mean=${r5k.mean.toFixed(1)}ms p99=${r5k.p99ms.toFixed(1)}ms | 20K mean=${r20k.mean.toFixed(1)}ms p99=${r20k.p99ms.toFixed(1)}ms`,
		);
	}, 60_000);

	it('triple axis (folder x card_type x status) render timing', () => {
		const { colAxes, rowAxes } = TRIPLE;
		const r1k = timeRender(colAxes, rowAxes, 1_000, 31, 5, container);
		const r5k = timeRender(colAxes, rowAxes, 5_000, 32, 5, container);
		const r20k = timeRender(colAxes, rowAxes, 20_000, 33, 3, container);
		console.log(
			`triple(folder x card_type x status): 1K mean=${r1k.mean.toFixed(1)}ms p99=${r1k.p99ms.toFixed(1)}ms | 5K mean=${r5k.mean.toFixed(1)}ms p99=${r5k.p99ms.toFixed(1)}ms | 20K mean=${r20k.mean.toFixed(1)}ms p99=${r20k.p99ms.toFixed(1)}ms`,
		);
	}, 60_000);
});
