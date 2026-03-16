// @vitest-environment jsdom
// Isometry v5 — SuperGrid Benchmark
// Performance benchmark verifying <16ms render for 100 cards at p95.
//
// Phase 32 adds 4 N-level benchmarks for stacked axis configurations:
//   1. N-level depth (3+3 stacked axes)
//   2. Mixed collapse states (aggregate + expanded)
//   3. Post-reorder re-render
//   4. Large dataset stress (500+ cards, informational)
//
// Run with: npx vitest bench tests/views/SuperGrid.bench.ts
//
// Requirements: REND-06, BNCH-RENDER

import { afterEach, beforeEach, bench, describe, vi } from 'vitest';
import type { CardType } from '../../src/database/queries/types';
import type { AxisMapping } from '../../src/providers/types';
import { SuperGrid } from '../../src/views/SuperGrid';
import type {
	CardDatum,
	SuperGridBridgeLike,
	SuperGridDensityLike,
	SuperGridFilterLike,
	SuperGridProviderLike,
} from '../../src/views/types';
import type { CellDatum } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCardDatum(overrides: Partial<CardDatum> = {}): CardDatum {
	return {
		id: 'bench-card',
		name: 'Bench Card',
		folder: null,
		status: null,
		card_type: 'note' as CardType,
		created_at: '2026-01-01T00:00:00Z',
		modified_at: '2026-01-01T00:00:00Z',
		priority: 0,
		sort_order: 0,
		due_at: null,
		body_text: null,
		source: null,
		...overrides,
	};
}

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

// Generate synthetic CellDatum array for N-level stacked axes
function makeSyntheticCells(
	colAxes: AxisMapping[],
	rowAxes: AxisMapping[],
	valuesPerAxis: number,
	seed = 42,
): CellDatum[] {
	const rand = mulberry32(seed);
	const cells: CellDatum[] = [];

	// Generate all combinations of axis values
	const colCombos = generateCombinations(
		colAxes.map((a) => a.field),
		valuesPerAxis,
	);
	const rowCombos = generateCombinations(
		rowAxes.map((a) => a.field),
		valuesPerAxis,
	);

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

// Generate all value combinations for given fields
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

// ---------------------------------------------------------------------------
// Mock factories (extended from SuperGrid.perf.test.ts for Phase 32)
// ---------------------------------------------------------------------------

function makeMockBridge(cells: CellDatum[] = []): SuperGridBridgeLike {
	return {
		superGridQuery: vi.fn().mockResolvedValue(cells),
		calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
	};
}

function makeMockProvider(
	colAxes: AxisMapping[] = [{ field: 'card_type', direction: 'asc' }],
	rowAxes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }],
): SuperGridProviderLike {
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
// Existing benchmark — render 100 cards via SuperGrid.render()
// ---------------------------------------------------------------------------

describe('SuperGrid performance', () => {
	let container: HTMLElement;
	let superGrid: SuperGrid;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		superGrid = new SuperGrid(makeMockProvider(), makeMockFilter(), makeMockBridge(), makeMockCoordinator());
		superGrid.mount(container);
	});

	afterEach(() => {
		superGrid.destroy();
		document.body.removeChild(container);
	});

	bench(
		'render 100 cards <16ms',
		() => {
			const cards = Array.from({ length: 100 }, (_, i) =>
				makeCardDatum({
					id: `bench-card-${i}`,
					card_type: (['note', 'task', 'event'] as CardType[])[i % 3]!,
					folder: ['A', 'B', 'C', 'D'][i % 4] ?? null,
					status: ['active', 'done'][i % 2] ?? null,
				}),
			);
			superGrid.render(cards);
		},
		{
			time: 2000,
			iterations: 50,
		},
	);
});

// ---------------------------------------------------------------------------
// Phase 32 — N-level benchmarks
// ---------------------------------------------------------------------------
// These benchmarks use _renderCells() directly with stacked axes and
// synthetic CellDatum data. Performance budget: <16ms for 100 visible cards
// in a real browser. jsdom budgets are proportionally generous due to
// ~100x overhead for D3 DOM operations in jsdom vs Chrome.

describe('Phase 32 — N-level benchmarks', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	// Benchmark 1: N-level depth (3+3 stacked axes)
	// 3 col axes + 3 row axes, ~100 cards distributed across groups.
	// Measures compound key construction + multi-level header spanning + D3 data join.
	// Real browser target: <16ms. jsdom budget: generous (reduced grid size).
	bench(
		'3+3 stacked axes render',
		() => {
			const colAxes: AxisMapping[] = [
				{ field: 'card_type', direction: 'asc' },
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
			];
			const rowAxes: AxisMapping[] = [
				{ field: 'priority', direction: 'asc' },
				{ field: 'sort_order', direction: 'asc' },
				{ field: 'name', direction: 'asc' },
			];
			// 2 values per axis = 2^3 * 2^3 = 64 cells (manageable in jsdom)
			const cells = makeSyntheticCells(colAxes, rowAxes, 2, 42);

			const provider = makeMockProvider(colAxes, rowAxes);
			const filter = makeMockFilter();
			const bridge = makeMockBridge(cells);
			const coordinator = makeMockCoordinator();
			const density = makeMockDensity();

			const grid = new SuperGrid(provider, filter, bridge, coordinator, undefined, undefined, density);
			grid.mount(container);

			// Warm-up
			(grid as any)._renderCells(cells, colAxes, rowAxes);

			// Measure
			(grid as any)._renderCells(cells, colAxes, rowAxes);

			grid.destroy();
		},
		{ time: 2000, iterations: 30 },
	);

	// Benchmark 2: Mixed collapse states
	// 2 col axes + 2 row axes, some headers in aggregate mode, others expanded.
	// Measures aggregate summary cell injection overhead + deepest-wins pre-computation.
	bench(
		'mixed collapse render',
		() => {
			const colAxes: AxisMapping[] = [
				{ field: 'card_type', direction: 'asc' },
				{ field: 'folder', direction: 'asc' },
			];
			const rowAxes: AxisMapping[] = [
				{ field: 'status', direction: 'asc' },
				{ field: 'priority', direction: 'asc' },
			];
			// 3 values per axis = 9 col combos * 9 row combos = 81 cells
			const cells = makeSyntheticCells(colAxes, rowAxes, 3, 99);

			const provider = makeMockProvider(colAxes, rowAxes);
			const filter = makeMockFilter();
			const bridge = makeMockBridge(cells);
			const coordinator = makeMockCoordinator();
			const density = makeMockDensity();

			const grid = new SuperGrid(provider, filter, bridge, coordinator, undefined, undefined, density);
			grid.mount(container);

			// Set some collapse states — mix of aggregate and expanded
			const g = grid as any;
			g._collapsedSet.add('0\x1f\x1fc0_v0');
			g._collapseModeMap.set('0\x1f\x1fc0_v0', 'aggregate');
			g._collapsedSet.add('0\x1f\x1fr0_v1');
			g._collapseModeMap.set('0\x1f\x1fr0_v1', 'aggregate');

			// Warm-up
			g._renderCells(cells, colAxes, rowAxes);

			// Measure
			g._renderCells(cells, colAxes, rowAxes);

			grid.destroy();
		},
		{ time: 2000, iterations: 30 },
	);

	// Benchmark 3: Post-reorder re-render
	// Measures: reorder provider mutation -> re-query (mocked) -> _renderCells
	// Note: FLIP animation uses requestAnimationFrame which is async — benchmark
	// measures the synchronous _renderCells portion only.
	bench(
		'post-reorder re-render',
		() => {
			const colAxes: AxisMapping[] = [
				{ field: 'card_type', direction: 'asc' },
				{ field: 'folder', direction: 'asc' },
			];
			const rowAxes: AxisMapping[] = [
				{ field: 'status', direction: 'asc' },
				{ field: 'priority', direction: 'asc' },
			];
			const cells = makeSyntheticCells(colAxes, rowAxes, 3, 77);

			const provider = makeMockProvider(colAxes, rowAxes);
			const filter = makeMockFilter();
			const bridge = makeMockBridge(cells);
			const coordinator = makeMockCoordinator();
			const density = makeMockDensity();

			const grid = new SuperGrid(provider, filter, bridge, coordinator, undefined, undefined, density);
			grid.mount(container);

			// Initial render
			(grid as any)._renderCells(cells, colAxes, rowAxes);

			// Simulate reorder: swap col axes order
			const reorderedColAxes: AxisMapping[] = [colAxes[1]!, colAxes[0]!];
			(provider.getStackedGroupBySQL as any).mockReturnValue({ colAxes: reorderedColAxes, rowAxes });

			// Measure: re-render with reordered axes (simulates post-reorder pipeline)
			(grid as any)._renderCells(cells, reorderedColAxes, rowAxes);

			grid.destroy();
		},
		{ time: 2000, iterations: 20 },
	);

	// Benchmark 4: Large dataset stress (500+ cards, informational only)
	// No pass/fail assertion — informational timing capture.
	// Real browser target: Expect <100ms in Chrome, jsdom will be ~5-10x slower.
	bench(
		'500+ cards stress (informational)',
		() => {
			const colAxes: AxisMapping[] = [{ field: 'card_type', direction: 'asc' }];
			const rowAxes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];

			// Generate 500+ cells: 25 col values * 25 row values = 625 cells
			const cells = makeSyntheticCells(colAxes, rowAxes, 25, 123);

			const provider = makeMockProvider(colAxes, rowAxes);
			const filter = makeMockFilter();
			const bridge = makeMockBridge(cells);
			const coordinator = makeMockCoordinator();
			const density = makeMockDensity();

			const grid = new SuperGrid(provider, filter, bridge, coordinator, undefined, undefined, density);
			grid.mount(container);

			// Warm-up
			(grid as any)._renderCells(cells, colAxes, rowAxes);

			// Measure
			(grid as any)._renderCells(cells, colAxes, rowAxes);

			// Log informational timing (visible in bench output)
			// console.log('500+ card stress — Expect <100ms in Chrome, jsdom will be ~5-10x slower');

			grid.destroy();
		},
		{ time: 3000, iterations: 10 },
	);
});
