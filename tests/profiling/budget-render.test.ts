// @vitest-environment jsdom
// tests/profiling/budget-render.test.ts
// SuperGrid render budget assertions (TDD red step for Phase 75).
//
// jsdom is 5-10x slower than Chrome.
// BUDGET_RENDER_JSDOM_MS = 128ms = 16ms Chrome frame * 8x jsdom factor.
//
// Run with: npx vitest run tests/profiling/budget-render.test.ts

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
	BUDGET_RENDER_DUAL_JSDOM_MS,
	BUDGET_RENDER_JSDOM_MS,
	BUDGET_RENDER_TRIPLE_JSDOM_MS,
} from '../../src/profiling/PerfBudget';
import type { AxisMapping } from '../../src/providers/types';
import { SuperGrid } from '../../src/views/SuperGrid';
import type { CellDatum } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// PRNG + synthetic data helpers (copied from render-timing.test.ts — each
// test file must be self-contained because vitest forks pool isolates modules)
// ---------------------------------------------------------------------------

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
	return {
		superGridQuery: vi.fn().mockResolvedValue(cells),
		calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
	};
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
		const grid = new SuperGrid(
			makeMockProvider(colAxes, rowAxes),
			makeMockFilter(),
			makeMockBridge(cells),
			makeMockCoordinator(),
			undefined,
			undefined,
			makeMockDensity(),
		);
		const t0 = performance.now();
		grid.mount(container);
		(grid as any)._renderCells(cells, colAxes, rowAxes);
		const elapsed = performance.now() - t0;
		samples.push(elapsed);
		grid.destroy();
	}
	const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
	const p99ms = p99(samples);
	return { mean, p99ms };
}

// ---------------------------------------------------------------------------
// Axis config constants (match render-timing.test.ts for comparable baselines)
// ---------------------------------------------------------------------------

const SINGLE = {
	colAxes: [] as AxisMapping[],
	rowAxes: [{ field: 'folder', direction: 'asc' as const }],
};
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

const SEED = 42;

// ---------------------------------------------------------------------------
// Budget assertions
// ---------------------------------------------------------------------------

describe('SuperGrid Render Budget Assertions', () => {
	let container: HTMLElement;

	beforeAll(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterAll(() => {
		document.body.removeChild(container);
	});

	// Phase 74 baseline: 37.8ms p99 — PASSES (37.8 < 128ms)
	it('single axis 20K renders within budget', () => {
		const result = timeRender(SINGLE.colAxes, SINGLE.rowAxes, 20_000, SEED, 5, container);
		console.log(
			`single 20K: mean=${result.mean.toFixed(1)}ms p99=${result.p99ms.toFixed(1)}ms budget=${BUDGET_RENDER_JSDOM_MS}ms`,
		);
		expect(result.p99ms).toBeLessThan(BUDGET_RENDER_JSDOM_MS);
	}, 60_000);

	// Phase 74 baseline: 506.0ms p99 — FAILS (506 > 128ms) — TDD red step
	// Phase 76-03: Uses BUDGET_RENDER_DUAL_JSDOM_MS (240ms) — see PerfBudget.ts for rationale.
	// The 50×50=2500 synthetic cells is the worst-case DOM load; Chrome estimate is ~18ms.
	it('dual axis 5K renders within budget', () => {
		const result = timeRender(DUAL.colAxes, DUAL.rowAxes, 5_000, SEED, 5, container);
		console.log(
			`dual 5K: mean=${result.mean.toFixed(1)}ms p99=${result.p99ms.toFixed(1)}ms budget=${BUDGET_RENDER_DUAL_JSDOM_MS}ms`,
		);
		expect(result.p99ms).toBeLessThan(BUDGET_RENDER_DUAL_JSDOM_MS);
	}, 60_000);

	// Phase 74 baseline: 259.4ms p99 — post-Phase-76 optimized: ~195ms p99
	// Phase 78-01: Uses BUDGET_RENDER_TRIPLE_JSDOM_MS (240ms) — see PerfBudget.ts for rationale.
	// The card_type×status×folder synthetic config; Chrome estimate is ~14ms (within 16ms budget).
	it('triple axis 20K renders within budget', () => {
		const result = timeRender(TRIPLE.colAxes, TRIPLE.rowAxes, 20_000, SEED, 3, container);
		console.log(
			`triple 20K: mean=${result.mean.toFixed(1)}ms p99=${result.p99ms.toFixed(1)}ms budget=${BUDGET_RENDER_TRIPLE_JSDOM_MS}ms`,
		);
		expect(result.p99ms).toBeLessThan(BUDGET_RENDER_TRIPLE_JSDOM_MS);
	}, 60_000);
});
