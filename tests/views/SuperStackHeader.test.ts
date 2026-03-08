// Isometry v5 — SuperStackHeader Tests
// Unit tests for the nested header spanning algorithm.
//
// Design:
//   - buildHeaderCells computes CSS grid-column spanning for stacked PAFV axes
//   - HeaderCell carries value, level, colStart (1-based), colSpan, isCollapsed
//   - Collapsed headers: parent colSpan=1, child cells omitted from output
//   - Cardinality guard: MAX_LEAF_COLUMNS=50, excess values collapsed to 'Other'
//   - buildGridTemplateColumns uses fixed-width CSS Custom Property columns
//     (var(--sg-col-width, 120px)) for zoom scaling — not minmax(60px, 1fr)
//
// Requirements: REND-02, REND-05, ZOOM-01

import { describe, expect, it } from 'vitest';
import {
	buildGridTemplateColumns,
	buildHeaderCells,
	type HeaderCell,
} from '../../src/views/supergrid/SuperStackHeader';

// ---------------------------------------------------------------------------
// Test: Single-level axis
// ---------------------------------------------------------------------------

describe('buildHeaderCells — single level', () => {
	it('returns one header row with a cell per value', () => {
		const axisValues = [['A'], ['B'], ['C']];
		const { headers, leafCount } = buildHeaderCells(axisValues, new Set());

		expect(headers.length).toBe(1); // one level
		expect(leafCount).toBe(3);

		const row = headers[0]!;
		expect(row.length).toBe(3);
		expect(row[0]).toMatchObject<Partial<HeaderCell>>({
			value: 'A',
			level: 0,
			colStart: 1,
			colSpan: 1,
			isCollapsed: false,
		});
		expect(row[1]).toMatchObject<Partial<HeaderCell>>({
			value: 'B',
			level: 0,
			colStart: 2,
			colSpan: 1,
			isCollapsed: false,
		});
		expect(row[2]).toMatchObject<Partial<HeaderCell>>({
			value: 'C',
			level: 0,
			colStart: 3,
			colSpan: 1,
			isCollapsed: false,
		});
	});

	it('handles duplicate values at level 0 as separate leaf columns', () => {
		// Same value repeated = separate leaf columns (axis values array has already been deduplicated)
		const axisValues = [['X'], ['X'], ['Y']];
		const { headers, leafCount } = buildHeaderCells(axisValues, new Set());
		expect(leafCount).toBe(3);
		// Level 0 — X appears twice so it should generate two cells (run-length detection)
		// This tests that consecutive identical values are merged into one spanning cell
		expect(headers[0]!.length).toBe(2); // X(span 2), Y(span 1)
		expect(headers[0]![0]).toMatchObject({ value: 'X', colSpan: 2, colStart: 1 });
		expect(headers[0]![1]).toMatchObject({ value: 'Y', colSpan: 1, colStart: 3 });
	});

	it('returns empty headers and leafCount 0 for empty input', () => {
		const { headers, leafCount } = buildHeaderCells([], new Set());
		expect(headers.length).toBe(0);
		expect(leafCount).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Test: Two-level axis
// ---------------------------------------------------------------------------

describe('buildHeaderCells — two levels', () => {
	it('parent spans child columns correctly', () => {
		// X has children a, b — Y has child c
		const axisValues = [
			['X', 'a'],
			['X', 'b'],
			['Y', 'c'],
		];
		const { headers, leafCount } = buildHeaderCells(axisValues, new Set());

		expect(leafCount).toBe(3);
		expect(headers.length).toBe(2);

		// Level 0: X(span 2, start 1), Y(span 1, start 3)
		const level0 = headers[0]!;
		expect(level0.length).toBe(2);
		expect(level0[0]).toMatchObject({ value: 'X', level: 0, colStart: 1, colSpan: 2 });
		expect(level0[1]).toMatchObject({ value: 'Y', level: 0, colStart: 3, colSpan: 1 });

		// Level 1: a(1, start 1), b(1, start 2), c(1, start 3)
		const level1 = headers[1]!;
		expect(level1.length).toBe(3);
		expect(level1[0]).toMatchObject({ value: 'a', level: 1, colStart: 1, colSpan: 1 });
		expect(level1[1]).toMatchObject({ value: 'b', level: 1, colStart: 2, colSpan: 1 });
		expect(level1[2]).toMatchObject({ value: 'c', level: 1, colStart: 3, colSpan: 1 });
	});

	it('all cells in a two-level axis are not collapsed by default', () => {
		const axisValues = [
			['P', 'q'],
			['P', 'r'],
		];
		const { headers } = buildHeaderCells(axisValues, new Set());
		for (const row of headers) {
			for (const cell of row) {
				expect(cell.isCollapsed).toBe(false);
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Test: Three-level axis
// ---------------------------------------------------------------------------

describe('buildHeaderCells — three levels', () => {
	it('grandparent spans total leaf count of all children', () => {
		// X → a → [1, 2], X → b → [1], Y → c → [1]
		const axisValues = [
			['X', 'a', '1'],
			['X', 'a', '2'],
			['X', 'b', '1'],
			['Y', 'c', '1'],
		];
		const { headers, leafCount } = buildHeaderCells(axisValues, new Set());

		expect(leafCount).toBe(4);
		expect(headers.length).toBe(3);

		// Level 0: X(span 3), Y(span 1)
		const level0 = headers[0]!;
		expect(level0.length).toBe(2);
		expect(level0[0]).toMatchObject({ value: 'X', level: 0, colStart: 1, colSpan: 3 });
		expect(level0[1]).toMatchObject({ value: 'Y', level: 0, colStart: 4, colSpan: 1 });

		// Level 1: a(span 2, start 1), b(span 1, start 3), c(span 1, start 4)
		const level1 = headers[1]!;
		expect(level1.length).toBe(3);
		expect(level1[0]).toMatchObject({ value: 'a', level: 1, colStart: 1, colSpan: 2 });
		expect(level1[1]).toMatchObject({ value: 'b', level: 1, colStart: 3, colSpan: 1 });
		expect(level1[2]).toMatchObject({ value: 'c', level: 1, colStart: 4, colSpan: 1 });

		// Level 2: 1(start 1), 2(start 2), 1(start 3), 1(start 4) — all span 1
		const level2 = headers[2]!;
		expect(level2.length).toBe(4);
		expect(level2[0]).toMatchObject({ value: '1', level: 2, colStart: 1, colSpan: 1 });
		expect(level2[1]).toMatchObject({ value: '2', level: 2, colStart: 2, colSpan: 1 });
		expect(level2[2]).toMatchObject({ value: '1', level: 2, colStart: 3, colSpan: 1 });
		expect(level2[3]).toMatchObject({ value: '1', level: 2, colStart: 4, colSpan: 1 });
	});
});

// ---------------------------------------------------------------------------
// Test: Collapsed headers
// ---------------------------------------------------------------------------

describe('buildHeaderCells — collapsed headers', () => {
	it('collapsed parent has colSpan=1 and isCollapsed=true', () => {
		const axisValues = [
			['X', 'a'],
			['X', 'b'],
			['Y', 'c'],
		];
		// New collapse key format: level\x1fparentPath\x1fvalue (parentPath empty for level 0)
		const collapsedSet = new Set(['0\x1f\x1fX']); // collapse X at level 0
		const { headers, leafCount } = buildHeaderCells(axisValues, collapsedSet);

		// X collapsed → 1 leaf; Y → 1 leaf → total 2
		expect(leafCount).toBe(2);

		const level0 = headers[0]!;
		expect(level0.length).toBe(2); // X and Y still present
		const xCell = level0.find((c) => c.value === 'X');
		expect(xCell).toMatchObject({ value: 'X', colSpan: 1, isCollapsed: true });
	});

	it('collapsed parent hides child cells (children omitted from output)', () => {
		const axisValues = [
			['X', 'a'],
			['X', 'b'],
			['Y', 'c'],
		];
		const collapsedSet = new Set(['0\x1f\x1fX']);
		const { headers } = buildHeaderCells(axisValues, collapsedSet);

		const level1 = headers[1]!;
		// Only Y's child 'c' should be present — X's children a, b are hidden
		expect(level1.length).toBe(1);
		expect(level1[0]).toMatchObject({ value: 'c' });
	});

	it('collapsing all parents leaves only collapsed parent cells', () => {
		const axisValues = [
			['X', 'a'],
			['Y', 'b'],
		];
		const collapsedSet = new Set(['0\x1f\x1fX', '0\x1f\x1fY']);
		const { headers, leafCount } = buildHeaderCells(axisValues, collapsedSet);

		expect(leafCount).toBe(2); // both collapsed → 1 each
		const level1 = headers[1]!;
		expect(level1.length).toBe(0); // no child cells
	});

	// Regression: Fix 4 — same value at same level under different parents collapses independently
	it('same value at level 1 under different parents collapses independently', () => {
		// Two parents X and Y, both have child 'a' at level 1
		const axisValues = [
			['X', 'a'],
			['X', 'b'],
			['Y', 'a'],
			['Y', 'c'],
		];
		// Collapse 'a' under parent X only (parentPath = 'X' at level 1)
		const collapsedSet = new Set(['1\x1fX\x1fa']);
		const { headers } = buildHeaderCells(axisValues, collapsedSet);

		const level1 = headers[1]!;
		// X's children: 'a' (collapsed=true), 'b' (collapsed=false)
		// Y's children: 'a' (collapsed=false), 'c' (collapsed=false)
		const xChildA = level1.find((c) => c.value === 'a' && c.parentPath === 'X');
		const yChildA = level1.find((c) => c.value === 'a' && c.parentPath === 'Y');

		expect(xChildA?.isCollapsed).toBe(true);
		expect(yChildA?.isCollapsed).toBe(false);
	});

	it('HeaderCell includes parentPath field', () => {
		const axisValues = [
			['X', 'a'],
			['Y', 'b'],
		];
		const { headers } = buildHeaderCells(axisValues, new Set());

		// Level 0 cells should have empty parentPath
		expect(headers[0]![0]!.parentPath).toBe('');
		// Level 1 cells should have their parent value as parentPath
		const level1 = headers[1]!;
		expect(level1[0]!.parentPath).toBe('X');
		expect(level1[1]!.parentPath).toBe('Y');
	});
});

// ---------------------------------------------------------------------------
// Test: Cardinality guard
// ---------------------------------------------------------------------------

describe('cardinality guard', () => {
	it('collapses excess leaf values to Other when > 50', () => {
		// Build 55 unique single-level values
		const axisValues = Array.from({ length: 55 }, (_, i) => [`v${i}`]);
		const { headers, leafCount } = buildHeaderCells(axisValues, new Set());

		// Should be capped at 50
		expect(leafCount).toBe(50);
		const level0 = headers[0]!;
		expect(level0.length).toBe(50);
		// Last value should be 'Other'
		expect(level0[level0.length - 1]!.value).toBe('Other');
		// First 49 should remain
		expect(level0[0]!.value).toBe('v0');
		expect(level0[48]!.value).toBe('v48');
	});

	it('does not apply guard when exactly 50 leaf values', () => {
		const axisValues = Array.from({ length: 50 }, (_, i) => [`v${i}`]);
		const { headers, leafCount } = buildHeaderCells(axisValues, new Set());
		expect(leafCount).toBe(50);
		const lastValue = headers[0]![49]!.value;
		expect(lastValue).toBe('v49');
		expect(lastValue).not.toBe('Other');
	});

	it('does not apply guard when fewer than 50 leaf values', () => {
		const axisValues = Array.from({ length: 10 }, (_, i) => [`v${i}`]);
		const { leafCount } = buildHeaderCells(axisValues, new Set());
		expect(leafCount).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// Test: buildGridTemplateColumns (Phase 20 — per-column widths + zoom)
// Phase 29 — rowHeaderDepth replaces rowHeaderWidth (N * 80px columns)
// ---------------------------------------------------------------------------

describe('buildGridTemplateColumns', () => {
	it('returns default BASE_COL_WIDTH per column with empty colWidths map (depth=1 → one 80px header)', () => {
		const result = buildGridTemplateColumns(['note', 'task'], new Map(), 1.0);
		expect(result).toBe('80px 120px 120px');
	});

	it('applies custom width for a known column key', () => {
		const result = buildGridTemplateColumns(['note', 'task'], new Map([['note', 200]]), 1.0);
		expect(result).toBe('80px 200px 120px');
	});

	it('scales all widths by zoom level', () => {
		const result = buildGridTemplateColumns(['note', 'task'], new Map([['note', 200]]), 2.0);
		expect(result).toBe('80px 400px 240px');
	});

	it('returns only row header columns for 0 leaf columns (depth=1)', () => {
		const result = buildGridTemplateColumns([], new Map(), 1.0);
		expect(result).toBe('80px');
	});

	it('depth=2 produces two 80px header columns', () => {
		const result = buildGridTemplateColumns(['note', 'task'], new Map(), 1.0, 2);
		expect(result).toBe('80px 80px 120px 120px');
	});

	it('depth=3 produces three 80px header columns', () => {
		const result = buildGridTemplateColumns(['note', 'task'], new Map(), 1.0, 3);
		expect(result).toBe('80px 80px 80px 120px 120px');
	});

	it('depth=2 with zero leaf columns produces two header columns only', () => {
		const result = buildGridTemplateColumns([], new Map(), 1.0, 2);
		expect(result).toBe('80px 80px');
	});

	it('rounds zoomed pixel values to integers', () => {
		// 120 * 1.333 = 159.96 → 160
		const result = buildGridTemplateColumns(['c1'], new Map(), 1.333);
		expect(result).toBe('80px 160px');
	});

	it('uses BASE_COL_WIDTH (120px) as default for unknown column keys', () => {
		const result = buildGridTemplateColumns(['unknown'], new Map(), 1.0);
		expect(result).toBe('80px 120px');
	});

	it('does not use repeat() or var(--sg-col-width) in output', () => {
		const result = buildGridTemplateColumns(['a', 'b', 'c'], new Map(), 1.0);
		expect(result).not.toContain('repeat');
		expect(result).not.toContain('var(--sg-col-width');
		expect(result).not.toContain('minmax');
		expect(result).not.toContain('1fr');
	});

	// ---------------------------------------------------------------------------
	// Phase 60 — Row index gutter (RGUT-01..05)
	// ---------------------------------------------------------------------------

	it('showRowIndex=true prepends 28px gutter track', () => {
		const result = buildGridTemplateColumns(['note', 'task'], new Map(), 1.0, 1, 80, true);
		expect(result).toBe('28px 80px 120px 120px');
	});

	it('showRowIndex=true with no leaf cols prepends 28px before row header', () => {
		const result = buildGridTemplateColumns([], new Map(), 1.0, 1, 80, true);
		expect(result).toBe('28px 80px');
	});

	it('showRowIndex=false (default) matches existing behavior', () => {
		const result = buildGridTemplateColumns(['note', 'task'], new Map(), 1.0, 1, 80, false);
		expect(result).toBe('80px 120px 120px');
	});
});
