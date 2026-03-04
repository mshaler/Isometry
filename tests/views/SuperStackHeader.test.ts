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

import { describe, it, expect } from 'vitest';
import {
  buildHeaderCells,
  buildGridTemplateColumns,
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
    expect(row[0]).toMatchObject<Partial<HeaderCell>>({ value: 'A', level: 0, colStart: 1, colSpan: 1, isCollapsed: false });
    expect(row[1]).toMatchObject<Partial<HeaderCell>>({ value: 'B', level: 0, colStart: 2, colSpan: 1, isCollapsed: false });
    expect(row[2]).toMatchObject<Partial<HeaderCell>>({ value: 'C', level: 0, colStart: 3, colSpan: 1, isCollapsed: false });
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
    const axisValues = [['X', 'a'], ['X', 'b'], ['Y', 'c']];
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
    const axisValues = [['P', 'q'], ['P', 'r']];
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
    const axisValues = [['X', 'a'], ['X', 'b'], ['Y', 'c']];
    const collapsedSet = new Set(['0:X']); // collapse X at level 0
    const { headers, leafCount } = buildHeaderCells(axisValues, collapsedSet);

    // X collapsed → 1 leaf; Y → 1 leaf → total 2
    expect(leafCount).toBe(2);

    const level0 = headers[0]!;
    expect(level0.length).toBe(2); // X and Y still present
    const xCell = level0.find(c => c.value === 'X');
    expect(xCell).toMatchObject({ value: 'X', colSpan: 1, isCollapsed: true });
  });

  it('collapsed parent hides child cells (children omitted from output)', () => {
    const axisValues = [['X', 'a'], ['X', 'b'], ['Y', 'c']];
    const collapsedSet = new Set(['0:X']);
    const { headers } = buildHeaderCells(axisValues, collapsedSet);

    const level1 = headers[1]!;
    // Only Y's child 'c' should be present — X's children a, b are hidden
    expect(level1.length).toBe(1);
    expect(level1[0]).toMatchObject({ value: 'c' });
  });

  it('collapsing all parents leaves only collapsed parent cells', () => {
    const axisValues = [['X', 'a'], ['Y', 'b']];
    const collapsedSet = new Set(['0:X', '0:Y']);
    const { headers, leafCount } = buildHeaderCells(axisValues, collapsedSet);

    expect(leafCount).toBe(2); // both collapsed → 1 each
    const level1 = headers[1]!;
    expect(level1.length).toBe(0); // no child cells
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
// Test: buildGridTemplateColumns
// ---------------------------------------------------------------------------

describe('buildGridTemplateColumns', () => {
  it('returns fixed CSS var columns for 5 leaf columns', () => {
    const result = buildGridTemplateColumns(5);
    expect(result).toBe('160px repeat(5, var(--sg-col-width, 120px))');
  });

  it('returns fixed CSS var columns for 1 leaf column', () => {
    const result = buildGridTemplateColumns(1);
    expect(result).toBe('160px repeat(1, var(--sg-col-width, 120px))');
  });

  it('returns only row header width for 0 leaf columns (no repeat)', () => {
    const result = buildGridTemplateColumns(0);
    expect(result).toBe('160px');
  });

  it('respects custom rowHeaderWidth', () => {
    const result = buildGridTemplateColumns(3, 200);
    expect(result).toBe('200px repeat(3, var(--sg-col-width, 120px))');
  });

  it('uses var(--sg-col-width, 120px) fallback for zoom scaling', () => {
    // Ensures fixed-width CSS var is used, not minmax which prevents zoom
    const result = buildGridTemplateColumns(3);
    expect(result).toContain('var(--sg-col-width, 120px)');
    expect(result).not.toContain('minmax');
    expect(result).not.toContain('1fr');
  });
});
