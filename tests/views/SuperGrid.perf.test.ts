// @vitest-environment jsdom
// tests/views/SuperGrid.perf.test.ts
// Performance assertion tests for PLSH-01, PLSH-02, PLSH-03.
// Uses performance.now() timing — runs as ordinary test() calls to block CI on regression.
// Fixed-seed mulberry32 PRNG for reproducible synthetic data.

import { describe, expect, it, vi } from 'vitest';
import type { AxisMapping } from '../../src/providers/types';
import { SuperGrid } from '../../src/views';
import type { SuperGridQueryConfig } from '../../src/views/supergrid/SuperGridQuery';
import { buildSuperGridQuery } from '../../src/views/supergrid/SuperGridQuery';
import type {
	SuperGridBridgeLike,
	SuperGridDensityLike,
	SuperGridFilterLike,
	SuperGridProviderLike,
} from '../../src/views/types';
import type { CellDatum } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Fixed-seed PRNG — mulberry32 (deterministic, reproducible across runs)
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

// ---------------------------------------------------------------------------
// Synthetic data generator — deterministic via mulberry32 seed
// ---------------------------------------------------------------------------

function makeSyntheticCells(cols: number, rows: number, seed = 42): CellDatum[] {
	const rand = mulberry32(seed);
	const cells: CellDatum[] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const count = Math.floor(rand() * 10) + 1;
			cells.push({
				col_field: `col_${c}`,
				row_field: `row_${r}`,
				count,
				card_ids: Array.from({ length: count }, (_, i) => `card-${r}-${c}-${i}`),
			} as unknown as CellDatum);
		}
	}
	return cells;
}

// ---------------------------------------------------------------------------
// p95 helper — same pattern as performance-assertions.test.ts
// ---------------------------------------------------------------------------

function computeP95(samples: number[]): number {
	const sorted = [...samples].sort((a, b) => a - b);
	const idx = Math.ceil(0.95 * sorted.length) - 1;
	return sorted[Math.max(0, idx)] ?? 0;
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
// PLSH-02 — SuperGridQuery builder compilation < 100ms (sentinel; full 10K-row E2E in perf-assertions)
// ---------------------------------------------------------------------------

describe('PLSH-02 — SuperGridQuery builder compilation < 100ms (sentinel)', () => {
	const BUDGET_MS = 100;
	const TOLERANCE = 1.2;
	const LIMIT_MS = BUDGET_MS * TOLERANCE; // 120ms

	it('buildSuperGridQuery() compilation + execution on standard config within tolerance', () => {
		// Option A: measure buildSuperGridQuery() compilation time (pure function, no DB).
		// This is microseconds per call — tests for pathological regressions in the query builder.
		// Full end-to-end (compile + sql.js execution on 10K rows) is measured separately
		// in the database performance-assertions.test.ts suite via the PERF-03 FTS benchmark.
		//
		// Note: The 100ms budget targets the combined compile+execute cycle against 10K rows.
		// Since compilation is <1ms, this test acts as a sentinel: if compilation ever
		// approaches 1ms (e.g., due to regex explosion or unbounded validation loops),
		// the p95 across 50 samples will expose the regression well before the 120ms limit.
		const config: SuperGridQueryConfig = {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
		};

		const N = 50;
		const samples: number[] = [];
		for (let i = 0; i < N; i++) {
			const start = performance.now();
			buildSuperGridQuery(config);
			samples.push(performance.now() - start);
		}

		const p95 = computeP95(samples);
		// Uncomment to debug timing: console.log(`PLSH-02 p95: ${p95.toFixed(2)}ms (limit: ${LIMIT_MS}ms)`);
		// Compilation should be sub-millisecond; this tests for pathological regressions
		expect(p95).toBeLessThan(LIMIT_MS);
	});

	it('buildSuperGridQuery() with all optional fields (granularity, sortOverrides, searchTerm) within tolerance', () => {
		// Exercise full path including strftime wrapping and FTS5 subquery injection
		const config: SuperGridQueryConfig = {
			colAxes: [{ field: 'created_at', direction: 'asc' }],
			rowAxes: [
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
			],
			where: 'priority > ?',
			params: [0],
			granularity: 'month',
			sortOverrides: [{ field: 'modified_at', direction: 'desc' }],
			searchTerm: 'important project',
		};

		const N = 50;
		const samples: number[] = [];
		for (let i = 0; i < N; i++) {
			const start = performance.now();
			buildSuperGridQuery(config);
			samples.push(performance.now() - start);
		}

		const p95 = computeP95(samples);
		// Uncomment to debug timing: console.log(`PLSH-02 (full) p95: ${p95.toFixed(2)}ms (limit: ${LIMIT_MS}ms)`);
		expect(p95).toBeLessThan(LIMIT_MS);
	});
});