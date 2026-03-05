// Isometry v5 — Phase 22 Plan 02 SuperGridQuery Granularity Tests
// Tests for strftime GROUP BY rewrite via granularity field in SuperGridQueryConfig.
//
// Design:
//   - TDD: tests written first (RED phase), implementation follows (GREEN phase)
//   - Tests cover granularity=null (no regression), granularity set for time fields,
//     granularity ignored for non-time fields, and allowlist validation ordering.
//
// Requirements: DENS-01, DENS-05

import { describe, it, expect } from 'vitest';
import { buildSuperGridQuery } from '../../../src/views/supergrid/SuperGridQuery';

// ---------------------------------------------------------------------------
// Granularity tests (Phase 22 Plan 02)
// ---------------------------------------------------------------------------

describe('buildSuperGridQuery — granularity (DENS-01)', () => {

  // Test 1: granularity=null produces same SQL as before (no regression)
  it('granularity=null produces SELECT without strftime wrapping', () => {
    const result = buildSuperGridQuery({
      colAxes: [{ field: 'created_at', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
      granularity: null,
    });
    expect(result.sql).not.toContain('strftime');
    expect(result.sql).toContain('created_at');
    expect(result.sql).toContain('folder');
  });

  // Test 1b: undefined granularity also produces no strftime (backward compat)
  it('undefined granularity produces no strftime wrapping (backward compat)', () => {
    const result = buildSuperGridQuery({
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
    });
    expect(result.sql).not.toContain('strftime');
  });

  // Test 2: granularity='month' + time field produces strftime expression in SELECT and GROUP BY
  it("granularity='month' with created_at axis wraps in strftime('%Y-%m', created_at)", () => {
    const result = buildSuperGridQuery({
      colAxes: [{ field: 'created_at', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
      granularity: 'month',
    });
    expect(result.sql).toContain("strftime('%Y-%m', created_at)");
    expect(result.sql).toContain('GROUP BY');
    // The GROUP BY must contain the strftime expression (or the alias)
    const groupBySection = result.sql.slice(result.sql.indexOf('GROUP BY'));
    expect(groupBySection).toContain('strftime');
    // The SELECT must use the alias "created_at"
    expect(result.sql).toContain('AS created_at');
  });

  // Test 3: granularity='quarter' produces correct quarter strftime expression
  it("granularity='quarter' with created_at produces quarter strftime expression", () => {
    const result = buildSuperGridQuery({
      colAxes: [{ field: 'created_at', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
      granularity: 'quarter',
    });
    // Quarter pattern: strftime('%Y', field) || '-Q' || ((CAST(strftime('%m', field) AS INT) - 1) / 3 + 1)
    expect(result.sql).toContain("strftime('%Y', created_at)");
    expect(result.sql).toContain("'-Q'");
    expect(result.sql).toContain("CAST(strftime('%m', created_at) AS INT)");
  });

  // Test 4: granularity='month' with non-time axis (folder) does NOT wrap folder in strftime
  it("granularity='month' does NOT wrap non-time axis (folder) in strftime", () => {
    const result = buildSuperGridQuery({
      colAxes: [{ field: 'folder', direction: 'asc' }],
      rowAxes: [{ field: 'status', direction: 'asc' }],
      where: '',
      params: [],
      granularity: 'month',
    });
    expect(result.sql).not.toContain('strftime');
    expect(result.sql).toContain('folder');
    expect(result.sql).toContain('status');
  });

  // Test 5: granularity='year' + mixed axes wraps only created_at, not folder
  it("granularity='year' with mixed axes wraps only time fields (created_at)", () => {
    const result = buildSuperGridQuery({
      colAxes: [{ field: 'created_at', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
      granularity: 'year',
    });
    expect(result.sql).toContain("strftime('%Y', created_at)");
    // folder should appear without strftime
    expect(result.sql).toMatch(/(?<!strftime[^)]*)\bfolder\b/);
  });

  // Test 6: Allowlist validation happens on raw field name BEFORE strftime wrapping
  // (no "SQL safety violation" on valid time fields)
  it("allowlist validation succeeds for valid time field with granularity set", () => {
    expect(() => buildSuperGridQuery({
      colAxes: [{ field: 'modified_at', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
      granularity: 'week',
    })).not.toThrow();
  });

  it("allowlist validation succeeds for due_at with granularity set", () => {
    expect(() => buildSuperGridQuery({
      colAxes: [{ field: 'due_at', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
      granularity: 'day',
    })).not.toThrow();
  });

  // Test 7: Invalid field with granularity set still throws SQL safety violation
  it("invalid field with granularity set still throws SQL safety violation", () => {
    expect(() => buildSuperGridQuery({
      colAxes: [{ field: 'DROP TABLE cards;--' as 'folder', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
      granularity: 'month',
    })).toThrow(/SQL safety violation/);
  });

  // Additional: granularity='week' produces correct week strftime expression
  it("granularity='week' with created_at produces strftime('%Y-W%W', created_at)", () => {
    const result = buildSuperGridQuery({
      colAxes: [{ field: 'created_at', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
      granularity: 'week',
    });
    expect(result.sql).toContain("strftime('%Y-W%W', created_at)");
  });

  // Additional: granularity='day' produces correct day strftime expression
  it("granularity='day' with created_at produces strftime('%Y-%m-%d', created_at)", () => {
    const result = buildSuperGridQuery({
      colAxes: [{ field: 'created_at', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
      granularity: 'day',
    });
    expect(result.sql).toContain("strftime('%Y-%m-%d', created_at)");
  });

  // Additional: modified_at on row axis with granularity wraps correctly
  it("granularity wraps time field on row axis too", () => {
    const result = buildSuperGridQuery({
      colAxes: [{ field: 'folder', direction: 'asc' }],
      rowAxes: [{ field: 'modified_at', direction: 'asc' }],
      where: '',
      params: [],
      granularity: 'month',
    });
    expect(result.sql).toContain("strftime('%Y-%m', modified_at)");
    expect(result.sql).not.toContain("strftime('%Y-%m', folder)");
  });

  // Additional: ORDER BY still uses the compiled expression (not just raw field)
  it("ORDER BY uses the strftime expression when granularity set on time axis", () => {
    const result = buildSuperGridQuery({
      colAxes: [{ field: 'created_at', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
      granularity: 'month',
    });
    const orderBySection = result.sql.slice(result.sql.indexOf('ORDER BY'));
    expect(orderBySection).toContain('strftime');
  });

});
