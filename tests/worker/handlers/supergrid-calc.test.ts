// Isometry v5 -- Phase 62 Plan 01 SuperGrid Calc Query Tests
// Tests for buildSuperGridCalcQuery and handleSuperGridCalc.
//
// Design:
//   - TDD RED: Failing tests for SQL aggregation query builder
//   - Tests cover: single group, multi-group, search, granularity, 'off' columns,
//     text column safety, COUNT(*) vs column-specific aggregates, NULL handling
//
// Requirements: CALC-03, CALC-04

import { describe, expect, it, vi } from 'vitest';
import { buildSuperGridCalcQuery } from '../../../src/views/supergrid/SuperGridQuery';
import type { WorkerPayloads } from '../../../src/worker/protocol';

// ---------------------------------------------------------------------------
// buildSuperGridCalcQuery — SQL output tests
// ---------------------------------------------------------------------------

describe('buildSuperGridCalcQuery', () => {
	it('with row axes [folder] and aggregates {sort_order:"sum", priority:"avg", name:"count"} produces correct SQL', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			aggregates: { sort_order: 'sum', priority: 'avg', name: 'count' },
		});

		// GROUP BY folder
		expect(result.sql).toContain('GROUP BY folder');
		// SELECT should include folder as group key
		expect(result.sql).toContain('folder');
		// Aggregate expressions
		expect(result.sql).toContain('SUM(sort_order) AS "sort_order"');
		expect(result.sql).toContain('AVG(priority) AS "priority"');
		// COUNT uses COUNT(*) not COUNT(name)
		expect(result.sql).toContain('COUNT(*) AS "name"');
		// ORDER BY folder ASC
		expect(result.sql).toContain('ORDER BY folder ASC');
		// Base WHERE clause
		expect(result.sql).toContain('deleted_at IS NULL');
	});

	it('with no row axes (single group) produces SQL with no GROUP BY (grand total)', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [],
			where: '',
			params: [],
			aggregates: { sort_order: 'sum', priority: 'count' },
		});

		expect(result.sql).not.toContain('GROUP BY');
		expect(result.sql).not.toContain('ORDER BY');
		expect(result.sql).toContain('SUM(sort_order) AS "sort_order"');
		expect(result.sql).toContain('COUNT(*) AS "priority"');
		expect(result.sql).toContain('deleted_at IS NULL');
	});

	it('with WHERE clause and searchTerm includes them in the SQL', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'status = ?',
			params: ['active'],
			searchTerm: 'hello',
			aggregates: { sort_order: 'sum' },
		});

		expect(result.sql).toContain('AND status = ?');
		expect(result.sql).toContain('AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)');
		// Filter param first, then search param
		expect(result.params).toEqual(['active', 'hello']);
	});

	it('with granularity wraps time fields in strftime', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [{ field: 'created_at', direction: 'asc' }],
			where: '',
			params: [],
			granularity: 'month',
			aggregates: { sort_order: 'sum' },
		});

		expect(result.sql).toContain("strftime('%Y-%m', created_at)");
		expect(result.sql).toContain('AS created_at');
		const groupBy = result.sql.slice(result.sql.indexOf('GROUP BY'));
		expect(groupBy).toContain('strftime');
	});

	it('columns set to "off" are excluded from SELECT', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			aggregates: { sort_order: 'sum', priority: 'off', name: 'count' },
		});

		expect(result.sql).toContain('SUM(sort_order) AS "sort_order"');
		expect(result.sql).toContain('COUNT(*) AS "name"');
		// priority should NOT appear as an aggregate
		expect(result.sql).not.toContain('AS "priority"');
	});

	it('text columns with "sum" passed still produce COUNT (safety net)', () => {
		// Text columns (folder, status, card_type, name, created_at, modified_at, due_at)
		// should only accept count or off. If sum is passed, use COUNT as safety net.
		const result = buildSuperGridCalcQuery({
			rowAxes: [],
			where: '',
			params: [],
			aggregates: { folder: 'sum' },
		});

		// Should be COUNT(*) not SUM(folder)
		expect(result.sql).toContain('COUNT(*) AS "folder"');
		expect(result.sql).not.toContain('SUM(folder)');
	});

	it('COUNT uses COUNT(*) for all fields (counts all rows including NULLs)', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [],
			where: '',
			params: [],
			aggregates: { sort_order: 'count', name: 'count' },
		});

		// Both should use COUNT(*) not COUNT(field)
		expect(result.sql).toContain('COUNT(*) AS "sort_order"');
		expect(result.sql).toContain('COUNT(*) AS "name"');
	});

	it('SUM/AVG/MIN/MAX operate on column directly (NULLs excluded by SQL standard)', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [],
			where: '',
			params: [],
			aggregates: { sort_order: 'sum', priority: 'avg' },
		});

		expect(result.sql).toContain('SUM(sort_order) AS "sort_order"');
		expect(result.sql).toContain('AVG(priority) AS "priority"');
	});

	it('MIN/MAX on numeric fields produce correct SQL', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [],
			where: '',
			params: [],
			aggregates: { sort_order: 'min', priority: 'max' },
		});

		expect(result.sql).toContain('MIN(sort_order) AS "sort_order"');
		expect(result.sql).toContain('MAX(priority) AS "priority"');
	});

	it('validates row axes fields against allowlist', () => {
		expect(() =>
			buildSuperGridCalcQuery({
				rowAxes: [{ field: 'EVIL_SQL' as never, direction: 'asc' }],
				where: '',
				params: [],
				aggregates: { sort_order: 'sum' },
			}),
		).toThrow('SQL safety violation');
	});

	it('validates aggregate field names against allowlist', () => {
		expect(() =>
			buildSuperGridCalcQuery({
				rowAxes: [],
				where: '',
				params: [],
				aggregates: { 'DROP TABLE cards;--': 'sum' },
			}),
		).toThrow('SQL safety violation');
	});

	it('empty aggregates (all off or no entries) produces query with only group key columns', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			aggregates: {},
		});

		// Should have folder in SELECT but no aggregate functions
		expect(result.sql).toContain('SELECT folder');
		expect(result.sql).not.toContain('SUM');
		expect(result.sql).not.toContain('AVG');
		expect(result.sql).not.toContain('COUNT');
		expect(result.sql).not.toContain('MIN(');
		expect(result.sql).not.toContain('MAX(');
	});

	it('multiple row axes produce correct compound GROUP BY', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'desc' },
			],
			where: '',
			params: [],
			aggregates: { sort_order: 'sum' },
		});

		expect(result.sql).toContain('GROUP BY folder, status');
		expect(result.sql).toContain('ORDER BY folder ASC, status DESC');
	});

	it('text column safety net: avg on text column becomes COUNT', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [],
			where: '',
			params: [],
			aggregates: { status: 'avg' },
		});

		expect(result.sql).toContain('COUNT(*) AS "status"');
		expect(result.sql).not.toContain('AVG(status)');
	});

	it('text column safety net: min/max on text column becomes COUNT', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [],
			where: '',
			params: [],
			aggregates: { card_type: 'min' },
		});

		expect(result.sql).toContain('COUNT(*) AS "card_type"');
		expect(result.sql).not.toContain('MIN(card_type)');
	});
});
