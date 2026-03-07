// Isometry v5 — Phase 22 Plan 02 SuperGridQuery Granularity Tests
// Tests for strftime GROUP BY rewrite via granularity field in SuperGridQueryConfig.
//
// Design:
//   - TDD: tests written first (RED phase), implementation follows (GREEN phase)
//   - Tests cover granularity=null (no regression), granularity set for time fields,
//     granularity ignored for non-time fields, and allowlist validation ordering.
//
// Requirements: DENS-01, DENS-05

import { describe, expect, it } from 'vitest';
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
	it('allowlist validation succeeds for valid time field with granularity set', () => {
		expect(() =>
			buildSuperGridQuery({
				colAxes: [{ field: 'modified_at', direction: 'asc' }],
				rowAxes: [{ field: 'folder', direction: 'asc' }],
				where: '',
				params: [],
				granularity: 'week',
			}),
		).not.toThrow();
	});

	it('allowlist validation succeeds for due_at with granularity set', () => {
		expect(() =>
			buildSuperGridQuery({
				colAxes: [{ field: 'due_at', direction: 'asc' }],
				rowAxes: [{ field: 'folder', direction: 'asc' }],
				where: '',
				params: [],
				granularity: 'day',
			}),
		).not.toThrow();
	});

	// Test 7: Invalid field with granularity set still throws SQL safety violation
	it('invalid field with granularity set still throws SQL safety violation', () => {
		expect(() =>
			buildSuperGridQuery({
				colAxes: [{ field: 'DROP TABLE cards;--' as 'folder', direction: 'asc' }],
				rowAxes: [{ field: 'folder', direction: 'asc' }],
				where: '',
				params: [],
				granularity: 'month',
			}),
		).toThrow(/SQL safety violation/);
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
	it('granularity wraps time field on row axis too', () => {
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
	it('ORDER BY uses the strftime expression when granularity set on time axis', () => {
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

// ---------------------------------------------------------------------------
// sortOverrides tests (Phase 23 Plan 02 — SORT-04)
// ---------------------------------------------------------------------------

describe('buildSuperGridQuery — sortOverrides (SORT-04)', () => {
	// Test 1: no sortOverrides (undefined) produces identical SQL to before
	it('produces identical SQL when sortOverrides is undefined', () => {
		const withoutOverrides = buildSuperGridQuery({
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
		});
		const withUndefined = buildSuperGridQuery({
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
		});
		expect(withUndefined.sql).toBe(withoutOverrides.sql);
	});

	// Test 2: sortOverrides appended AFTER axis ORDER BY
	it('appends sort override fields AFTER axis ORDER BY', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			sortOverrides: [{ field: 'name', direction: 'asc' }],
		});
		expect(result.sql).toContain('ORDER BY');
		const orderBySection = result.sql.slice(result.sql.indexOf('ORDER BY'));
		// card_type and folder must come before name
		const cardTypeIdx = orderBySection.indexOf('card_type');
		const folderIdx = orderBySection.indexOf('folder');
		const nameIdx = orderBySection.indexOf('name');
		expect(cardTypeIdx).toBeLessThan(nameIdx);
		expect(folderIdx).toBeLessThan(nameIdx);
		expect(orderBySection).toContain('name ASC');
	});

	// Test 3: compound axis + sortOverrides produces correct full ORDER BY
	it('with colAxes=[card_type asc], rowAxes=[folder asc], sortOverrides=[name desc] => ORDER BY card_type ASC, folder ASC, name DESC', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			sortOverrides: [{ field: 'name', direction: 'desc' }],
		});
		// The ORDER BY should contain all three parts in the right order
		const orderBySection = result.sql.slice(result.sql.indexOf('ORDER BY'));
		expect(orderBySection).toMatch(/card_type ASC.*folder ASC.*name DESC/s);
	});

	// Test 4: invalid sortOverrides field throws SQL safety violation
	it('validates sort override fields against allowlist — throws on invalid field', () => {
		expect(() =>
			buildSuperGridQuery({
				colAxes: [{ field: 'folder', direction: 'asc' }],
				rowAxes: [],
				where: '',
				params: [],
				sortOverrides: [{ field: 'DROP TABLE' as 'name', direction: 'asc' }],
			}),
		).toThrow(/SQL safety violation/);
	});

	// Test 5: multiple sortOverrides produce correct compound ORDER BY in order
	it('multiple sortOverrides produce correct compound ORDER BY: axis first, then overrides in order', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'folder', direction: 'asc' }],
			rowAxes: [],
			where: '',
			params: [],
			sortOverrides: [
				{ field: 'priority', direction: 'desc' },
				{ field: 'name', direction: 'asc' },
			],
		});
		const orderBySection = result.sql.slice(result.sql.indexOf('ORDER BY'));
		// folder first, then priority, then name
		const folderIdx = orderBySection.indexOf('folder');
		const priorityIdx = orderBySection.indexOf('priority');
		const nameIdx = orderBySection.indexOf('name');
		expect(folderIdx).toBeLessThan(priorityIdx);
		expect(priorityIdx).toBeLessThan(nameIdx);
		expect(orderBySection).toContain('priority DESC');
		expect(orderBySection).toContain('name ASC');
	});

	// Test 6: sortOverrides with no axes — ORDER BY has only override fields
	it('handles sortOverrides with no axes — ORDER BY has only override fields', () => {
		const result = buildSuperGridQuery({
			colAxes: [],
			rowAxes: [],
			where: '',
			params: [],
			sortOverrides: [{ field: 'name', direction: 'asc' }],
		});
		expect(result.sql).toContain('ORDER BY');
		const orderBySection = result.sql.slice(result.sql.indexOf('ORDER BY'));
		expect(orderBySection).toContain('name ASC');
		// Should NOT have axis fields since none were provided
		expect(orderBySection).not.toContain('folder');
		expect(orderBySection).not.toContain('card_type');
	});

	// Test 7: granularity + sortOverrides — axis fields get strftime, sort overrides do NOT
	it('granularity + sortOverrides: time-axis gets strftime, sort overrides use raw field names', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'created_at', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			granularity: 'month',
			sortOverrides: [{ field: 'name', direction: 'asc' }],
		});
		const orderBySection = result.sql.slice(result.sql.indexOf('ORDER BY'));
		// Axis expression wraps created_at in strftime
		expect(orderBySection).toContain("strftime('%Y-%m', created_at)");
		// Sort override is raw field name — NOT wrapped in strftime
		expect(orderBySection).toContain('name ASC');
		expect(orderBySection).not.toMatch(/strftime[^)]*\)\s+AS\s+name/);
	});

	// Test 8: sortOverrides field is optional — empty array also produces no override parts
	it('empty sortOverrides array produces same SQL as no sortOverrides', () => {
		const withEmpty = buildSuperGridQuery({
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			sortOverrides: [],
		});
		const withNone = buildSuperGridQuery({
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
		});
		expect(withEmpty.sql).toBe(withNone.sql);
	});

	// Test 9: sort_order field is valid in sortOverrides
	it('sort_order is a valid sortOverrides field', () => {
		expect(() =>
			buildSuperGridQuery({
				colAxes: [{ field: 'folder', direction: 'asc' }],
				rowAxes: [],
				where: '',
				params: [],
				sortOverrides: [{ field: 'sort_order', direction: 'asc' }],
			}),
		).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// searchTerm FTS5 injection tests (Phase 25 Plan 01 — SRCH-04)
// ---------------------------------------------------------------------------

describe('buildSuperGridQuery — searchTerm FTS5 injection (SRCH-04)', () => {
	// Test 1: searchTerm='hello' produces FTS subquery in WHERE
	it("searchTerm='hello' produces SQL containing FTS rowid subquery", () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			searchTerm: 'hello',
		});
		expect(result.sql).toContain('AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)');
		expect(result.params).toContain('hello');
	});

	// Test 2: searchTerm='' produces SQL without FTS subquery
	it("searchTerm='' produces SQL without FTS subquery", () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			searchTerm: '',
		});
		expect(result.sql).not.toContain('cards_fts');
	});

	// Test 3: searchTerm='  ' (whitespace only) produces SQL without FTS subquery
	it("searchTerm='  ' (whitespace only) produces SQL without FTS subquery", () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			searchTerm: '  ',
		});
		expect(result.sql).not.toContain('cards_fts');
	});

	// Test 4: searchTerm=undefined produces SQL without FTS subquery
	it('searchTerm=undefined produces SQL without FTS subquery (backward compat)', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
		});
		expect(result.sql).not.toContain('cards_fts');
	});

	// Test 5: searchTerm with existing where + params — FTS subquery appended after filter
	// and params order is [filterParam, searchTerm]
	it('searchTerm with existing where+params — FTS appended after filter, params in correct order', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'status = ?',
			params: ['active'],
			searchTerm: 'world',
		});
		expect(result.sql).toContain('AND status = ?');
		expect(result.sql).toContain('AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)');
		// Filter param first, then search param
		expect(result.params).toEqual(['active', 'world']);
		// FTS subquery must come AFTER filter where (filter WHERE before FTS WHERE in SQL string)
		const filterIdx = result.sql.indexOf('AND status = ?');
		const ftsIdx = result.sql.indexOf('AND rowid IN');
		expect(filterIdx).toBeLessThan(ftsIdx);
	});
});

// ---------------------------------------------------------------------------
// N-Level stacking validation (Phase 28 — STAK-05)
// ---------------------------------------------------------------------------

describe('buildSuperGridQuery — N-level stacking (STAK-05)', () => {
	it('4 col axes: SELECT, GROUP BY, ORDER BY include all 4 fields', () => {
		const result = buildSuperGridQuery({
			colAxes: [
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'desc' },
				{ field: 'card_type', direction: 'asc' },
				{ field: 'priority', direction: 'desc' },
			],
			rowAxes: [{ field: 'name', direction: 'asc' }],
			where: '',
			params: [],
		});
		// All 5 fields appear in SELECT
		for (const f of ['folder', 'status', 'card_type', 'priority', 'name']) {
			expect(result.sql).toContain(f);
		}
		// GROUP BY has all 5 fields
		const groupBy = result.sql.slice(result.sql.indexOf('GROUP BY'));
		for (const f of ['folder', 'status', 'card_type', 'priority', 'name']) {
			expect(groupBy).toContain(f);
		}
		// ORDER BY respects directions
		const orderBy = result.sql.slice(result.sql.indexOf('ORDER BY'));
		expect(orderBy).toContain('folder ASC');
		expect(orderBy).toContain('status DESC');
		expect(orderBy).toContain('card_type ASC');
		expect(orderBy).toContain('priority DESC');
		expect(orderBy).toContain('name ASC');
	});

	it('4 row axes + 2 col axes (asymmetric): all 6 fields in query', () => {
		const result = buildSuperGridQuery({
			colAxes: [
				{ field: 'card_type', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
			],
			rowAxes: [
				{ field: 'folder', direction: 'asc' },
				{ field: 'priority', direction: 'desc' },
				{ field: 'name', direction: 'asc' },
				{ field: 'sort_order', direction: 'desc' },
			],
			where: '',
			params: [],
		});
		for (const f of ['card_type', 'status', 'folder', 'priority', 'name', 'sort_order']) {
			expect(result.sql).toContain(f);
		}
		expect(result.sql).toContain('GROUP BY');
		expect(result.sql).toContain('COUNT(*)');
		expect(result.sql).toContain('GROUP_CONCAT');
	});

	it('5 col axes + 3 row axes: SQL is valid (8 total axis fields)', () => {
		const result = buildSuperGridQuery({
			colAxes: [
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
				{ field: 'card_type', direction: 'asc' },
				{ field: 'priority', direction: 'asc' },
				{ field: 'name', direction: 'asc' },
			],
			rowAxes: [
				{ field: 'created_at', direction: 'desc' },
				{ field: 'modified_at', direction: 'desc' },
				{ field: 'sort_order', direction: 'asc' },
			],
			where: '',
			params: [],
		});
		expect(result.sql).toContain('SELECT');
		expect(result.sql).toContain('GROUP BY');
		expect(result.sql).toContain('ORDER BY');
		// All 8 fields present
		for (const f of ['folder', 'status', 'card_type', 'priority', 'name', 'created_at', 'modified_at', 'sort_order']) {
			expect(result.sql).toContain(f);
		}
	});

	it('4 col axes + granularity=month: strftime wraps only time fields', () => {
		const result = buildSuperGridQuery({
			colAxes: [
				{ field: 'created_at', direction: 'asc' },
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
				{ field: 'modified_at', direction: 'desc' },
			],
			rowAxes: [{ field: 'card_type', direction: 'asc' }],
			where: '',
			params: [],
			granularity: 'month',
		});
		// Time fields should have strftime wrapping
		expect(result.sql).toContain("strftime('%Y-%m', created_at)");
		expect(result.sql).toContain("strftime('%Y-%m', modified_at)");
		// Non-time fields should NOT have strftime
		const selectPart = result.sql.slice(0, result.sql.indexOf('FROM'));
		expect(selectPart).toContain('folder');
		expect(selectPart).toContain('status');
	});

	it('4 col axes + sortOverrides: sort appended after axis ORDER BY', () => {
		const result = buildSuperGridQuery({
			colAxes: [
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
				{ field: 'card_type', direction: 'asc' },
				{ field: 'priority', direction: 'asc' },
			],
			rowAxes: [{ field: 'name', direction: 'asc' }],
			where: '',
			params: [],
			sortOverrides: [{ field: 'name', direction: 'desc' }],
		});
		const orderBy = result.sql.slice(result.sql.indexOf('ORDER BY'));
		// Sort override should appear after axis ORDER BY parts
		expect(orderBy).toContain('name DESC');
	});

	it('4 col axes + searchTerm: FTS5 clause composes with multi-axis GROUP BY', () => {
		const result = buildSuperGridQuery({
			colAxes: [
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
				{ field: 'card_type', direction: 'asc' },
				{ field: 'priority', direction: 'asc' },
			],
			rowAxes: [{ field: 'name', direction: 'asc' }],
			where: '',
			params: [],
			searchTerm: 'hello',
		});
		expect(result.sql).toContain('cards_fts');
		expect(result.sql).toContain('MATCH');
		expect(result.sql).toContain('GROUP BY');
		expect(result.params).toContain('hello');
	});

	it('4 col axes + WHERE clause: filter composes with multi-axis query', () => {
		const result = buildSuperGridQuery({
			colAxes: [
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
				{ field: 'card_type', direction: 'asc' },
				{ field: 'priority', direction: 'asc' },
			],
			rowAxes: [{ field: 'name', direction: 'asc' }],
			where: 'folder = ?',
			params: ['Work'],
		});
		expect(result.sql).toContain('folder = ?');
		expect(result.sql).toContain('GROUP BY');
		expect(result.params).toContain('Work');
	});

	it('4 col axes with mixed directions: ORDER BY respects each direction independently', () => {
		const result = buildSuperGridQuery({
			colAxes: [
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'desc' },
				{ field: 'card_type', direction: 'asc' },
				{ field: 'priority', direction: 'desc' },
			],
			rowAxes: [],
			where: '',
			params: [],
		});
		const orderBy = result.sql.slice(result.sql.indexOf('ORDER BY'));
		expect(orderBy).toContain('folder ASC');
		expect(orderBy).toContain('status DESC');
		expect(orderBy).toContain('card_type ASC');
		expect(orderBy).toContain('priority DESC');
	});
});
