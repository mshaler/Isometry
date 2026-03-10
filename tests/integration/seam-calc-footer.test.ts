/**
 * Isometry v5 — Seam 1: Filter → SuperGrid Calc Query → Footer Renderer
 *
 * Tests that the calc query correctly includes BOTH rowAxes AND colAxes in its
 * GROUP BY, and that filter changes propagate through compile() into the calc
 * query's WHERE clause. This is the seam that broke in UAT Bug #2 (footer
 * showed same grand total in every column because colAxes were missing from
 * the GROUP BY).
 *
 * Wires: Real FilterProvider + real buildSuperGridCalcQuery() + assertion on SQL output.
 * No browser, no DOM — pure query builder verification.
 */

import { describe, expect, it } from 'vitest';
import { FilterProvider } from '../../src/providers/FilterProvider';
import type { AxisMapping } from '../../src/providers/types';
import { buildSuperGridCalcQuery } from '../../src/views/supergrid/SuperGridQuery';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ROW_AXES: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];
const COL_AXES: AxisMapping[] = [{ field: 'card_type', direction: 'asc' }];
const MULTI_COL_AXES: AxisMapping[] = [
	{ field: 'card_type', direction: 'asc' },
	{ field: 'status', direction: 'asc' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Seam 1: Filter → SuperGrid calc query → footer renderer', () => {
	// -----------------------------------------------------------------------
	// BUG #2 REGRESSION: colAxes must appear in GROUP BY
	// -----------------------------------------------------------------------

	it('includes both rowAxes and colAxes in GROUP BY (Bug #2 regression)', () => {
		const filter = new FilterProvider();
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: COL_AXES,
			where,
			params,
			aggregates: { priority: 'sum' },
		});

		// GROUP BY must contain BOTH folder AND card_type
		expect(result.sql).toContain('GROUP BY');
		expect(result.sql).toMatch(/GROUP BY.*folder/);
		expect(result.sql).toMatch(/GROUP BY.*card_type/);

		// SELECT must contain both axis fields
		expect(result.sql).toMatch(/SELECT.*folder/);
		expect(result.sql).toMatch(/SELECT.*card_type/);
	});

	it('includes multi-level colAxes in GROUP BY', () => {
		const filter = new FilterProvider();
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: MULTI_COL_AXES,
			where,
			params,
			aggregates: { priority: 'count' },
		});

		// All three axes must appear in GROUP BY
		expect(result.sql).toMatch(/GROUP BY.*folder/);
		expect(result.sql).toMatch(/GROUP BY.*card_type/);
		expect(result.sql).toMatch(/GROUP BY.*status/);
	});

	// -----------------------------------------------------------------------
	// Filter propagation: axis filter → WHERE clause
	// -----------------------------------------------------------------------

	it('axis filter compiles into calc query WHERE clause', () => {
		const filter = new FilterProvider();

		// Apply a category chip filter (folder = Film)
		filter.setAxisFilter('folder', ['Film']);
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: COL_AXES,
			where,
			params,
			aggregates: { priority: 'sum' },
		});

		// WHERE must contain the axis filter
		expect(result.sql).toContain('folder IN (?)');
		expect(result.params).toContain('Film');
	});

	// -----------------------------------------------------------------------
	// Filter propagation: range filter → WHERE clause
	// -----------------------------------------------------------------------

	it('range filter compiles into calc query WHERE clause', () => {
		const filter = new FilterProvider();

		// Apply a histogram brush range filter
		filter.setRangeFilter('priority', 2, 4);
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: COL_AXES,
			where,
			params,
			aggregates: { priority: 'avg' },
		});

		// WHERE must contain both range bounds
		expect(result.sql).toContain('priority >= ?');
		expect(result.sql).toContain('priority <= ?');
		expect(result.params).toContain(2);
		expect(result.params).toContain(4);
	});

	// -----------------------------------------------------------------------
	// Compound filter: multiple filter types compose in WHERE
	// -----------------------------------------------------------------------

	it('compound filter (axis + range + search) compiles into calc query WHERE', () => {
		const filter = new FilterProvider();

		filter.setAxisFilter('folder', ['Film']);
		filter.setRangeFilter('priority', 1, 3);
		filter.setSearchQuery('Meryl');
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: COL_AXES,
			where,
			params,
			aggregates: { priority: 'sum' },
		});

		// All three filter types must appear in WHERE
		expect(result.sql).toContain('folder IN (?)');
		expect(result.sql).toContain('priority >= ?');
		expect(result.sql).toContain('priority <= ?');
		expect(result.sql).toContain('cards_fts MATCH ?');
	});

	// -----------------------------------------------------------------------
	// Aggregation mode: SUM vs AVG vs COUNT vs OFF
	// -----------------------------------------------------------------------

	it('SUM aggregation produces SUM() in SELECT', () => {
		const filter = new FilterProvider();
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: COL_AXES,
			where,
			params,
			aggregates: { priority: 'sum' },
		});

		expect(result.sql).toContain('SUM(priority)');
	});

	it('AVG aggregation produces AVG() in SELECT', () => {
		const filter = new FilterProvider();
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: COL_AXES,
			where,
			params,
			aggregates: { priority: 'avg' },
		});

		expect(result.sql).toContain('AVG(priority)');
	});

	it('COUNT aggregation produces COUNT(*) in SELECT', () => {
		const filter = new FilterProvider();
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: COL_AXES,
			where,
			params,
			aggregates: { priority: 'count' },
		});

		expect(result.sql).toContain('COUNT(*)');
	});

	it('OFF aggregation excludes field from SELECT entirely', () => {
		const filter = new FilterProvider();
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: COL_AXES,
			where,
			params,
			aggregates: { priority: 'off' },
		});

		// Priority should NOT appear as an aggregate column
		// (but it still appears if it's an axis field)
		expect(result.sql).not.toContain('SUM(priority)');
		expect(result.sql).not.toContain('AVG(priority)');
		// COUNT(*) should not appear with "__agg__priority" alias when off
		expect(result.sql).not.toMatch(/AS "__agg__priority"/);
	});

	// -----------------------------------------------------------------------
	// Non-numeric field safety net: text fields forced to COUNT
	// -----------------------------------------------------------------------

	it('non-numeric field requested as SUM falls back to COUNT', () => {
		const filter = new FilterProvider();
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: COL_AXES,
			where,
			params,
			aggregates: { name: 'sum' },
		});

		// name is a text field — SUM should be safety-netted to COUNT
		expect(result.sql).toContain('COUNT(*)');
		expect(result.sql).not.toContain('SUM(name)');
	});

	// -----------------------------------------------------------------------
	// Empty colAxes: calc query should still work (row-only footer)
	// -----------------------------------------------------------------------

	it('works with empty colAxes (row-only aggregation)', () => {
		const filter = new FilterProvider();
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: [],
			where,
			params,
			aggregates: { priority: 'sum' },
		});

		// GROUP BY should contain only row axes
		expect(result.sql).toMatch(/GROUP BY.*folder/);
		expect(result.sql).not.toContain('card_type');
	});

	// -----------------------------------------------------------------------
	// Filter clear: cleared filters produce base WHERE only
	// -----------------------------------------------------------------------

	it('clearing all filters produces base WHERE clause only', () => {
		const filter = new FilterProvider();

		// Apply then clear
		filter.setAxisFilter('folder', ['Film']);
		filter.setRangeFilter('priority', 2, 4);
		filter.clearFilters();
		const { where, params } = filter.compile();

		const result = buildSuperGridCalcQuery({
			rowAxes: ROW_AXES,
			colAxes: COL_AXES,
			where,
			params,
			aggregates: { priority: 'sum' },
		});

		// Only the base clause should remain
		expect(result.sql).toContain('deleted_at IS NULL');
		expect(result.sql).not.toContain('folder IN');
		expect(result.sql).not.toContain('priority >= ?');
		expect(result.params).toEqual([]);
	});
});
