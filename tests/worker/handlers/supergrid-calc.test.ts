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
import type { Database } from '../../../src/database/Database';
import { buildSuperGridCalcQuery } from '../../../src/views/supergrid/SuperGridQuery';
import { handleSuperGridCalc } from '../../../src/worker/handlers/supergrid.handler';
import type { WorkerPayloads } from '../../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Helper: Create mock Database
// ---------------------------------------------------------------------------

function createMockPrepareStmt(rows: Record<string, unknown>[]) {
	return {
		all: vi.fn().mockReturnValue(rows),
		free: vi.fn(),
	};
}

function createMockDb(prepareRows: Record<string, unknown>[] = []) {
	return {
		prepare: vi.fn().mockReturnValue(createMockPrepareStmt(prepareRows)),
		exec: vi.fn().mockReturnValue([]),
	} as unknown as Database;
}

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
		// Aggregate expressions use __agg__ prefix to avoid column name collision
		expect(result.sql).toContain('SUM(sort_order) AS "__agg__sort_order"');
		expect(result.sql).toContain('AVG(priority) AS "__agg__priority"');
		// COUNT uses COUNT(*) not COUNT(name)
		expect(result.sql).toContain('COUNT(*) AS "__agg__name"');
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
		expect(result.sql).toContain('SUM(sort_order) AS "__agg__sort_order"');
		expect(result.sql).toContain('COUNT(*) AS "__agg__priority"');
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

		expect(result.sql).toContain('SUM(sort_order) AS "__agg__sort_order"');
		expect(result.sql).toContain('COUNT(*) AS "__agg__name"');
		// priority should NOT appear as an aggregate
		expect(result.sql).not.toContain('AS "__agg__priority"');
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
		expect(result.sql).toContain('COUNT(*) AS "__agg__folder"');
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
		expect(result.sql).toContain('COUNT(*) AS "__agg__sort_order"');
		expect(result.sql).toContain('COUNT(*) AS "__agg__name"');
	});

	it('SUM/AVG/MIN/MAX operate on column directly (NULLs excluded by SQL standard)', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [],
			where: '',
			params: [],
			aggregates: { sort_order: 'sum', priority: 'avg' },
		});

		expect(result.sql).toContain('SUM(sort_order) AS "__agg__sort_order"');
		expect(result.sql).toContain('AVG(priority) AS "__agg__priority"');
	});

	it('MIN/MAX on numeric fields produce correct SQL', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [],
			where: '',
			params: [],
			aggregates: { sort_order: 'min', priority: 'max' },
		});

		expect(result.sql).toContain('MIN(sort_order) AS "__agg__sort_order"');
		expect(result.sql).toContain('MAX(priority) AS "__agg__priority"');
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

		expect(result.sql).toContain('COUNT(*) AS "__agg__status"');
		expect(result.sql).not.toContain('AVG(status)');
	});

	it('text column safety net: min/max on text column becomes COUNT', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [],
			where: '',
			params: [],
			aggregates: { card_type: 'min' },
		});

		expect(result.sql).toContain('COUNT(*) AS "__agg__card_type"');
		expect(result.sql).not.toContain('MIN(card_type)');
	});
});

// ---------------------------------------------------------------------------
// handleSuperGridCalc — handler integration tests
// ---------------------------------------------------------------------------

describe('handleSuperGridCalc', () => {
	it('separates row axis fields into groupKey and aggregate values into values', () => {
		// Mock DB returns columns with __agg__ prefix for aggregates (matching real SQL output)
		const db = createMockDb([
			{ folder: 'Inbox', __agg__sort_order: 42, __agg__priority: 3.5 },
			{ folder: 'Archive', __agg__sort_order: 10, __agg__priority: 1.0 },
		]);

		const payload: WorkerPayloads['supergrid:calc'] = {
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			aggregates: { sort_order: 'sum', priority: 'avg' },
		};

		const result = handleSuperGridCalc(db, payload);

		expect(result.rows).toHaveLength(2);
		// First row: folder='Inbox' is groupKey, sort_order/priority are values
		expect(result.rows[0]!.groupKey).toEqual({ folder: 'Inbox' });
		expect(result.rows[0]!.values).toEqual({ sort_order: 42, priority: 3.5 });
		// Second row
		expect(result.rows[1]!.groupKey).toEqual({ folder: 'Archive' });
		expect(result.rows[1]!.values).toEqual({ sort_order: 10, priority: 1.0 });
	});

	it('returns single row with empty groupKey when no row axes (grand total)', () => {
		const db = createMockDb([{ __agg__sort_order: 100 }]);

		const payload: WorkerPayloads['supergrid:calc'] = {
			rowAxes: [],
			where: '',
			params: [],
			aggregates: { sort_order: 'sum' },
		};

		const result = handleSuperGridCalc(db, payload);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]!.groupKey).toEqual({});
		expect(result.rows[0]!.values).toEqual({ sort_order: 100 });
	});

	it('handles NULL aggregate values (converts non-number to null)', () => {
		const db = createMockDb([{ folder: 'Empty', __agg__sort_order: null }]);

		const payload: WorkerPayloads['supergrid:calc'] = {
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			aggregates: { sort_order: 'sum' },
		};

		const result = handleSuperGridCalc(db, payload);

		expect(result.rows[0]!.values).toEqual({ sort_order: null });
	});

	it('returns empty rows array when db returns no results', () => {
		const db = createMockDb([]);

		const payload: WorkerPayloads['supergrid:calc'] = {
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
			aggregates: { sort_order: 'sum' },
		};

		const result = handleSuperGridCalc(db, payload);

		expect(result.rows).toEqual([]);
	});

	it('throws SQL safety violation for invalid axis field', () => {
		const db = createMockDb();

		const payload: WorkerPayloads['supergrid:calc'] = {
			rowAxes: [{ field: 'EVIL_SQL' as never, direction: 'asc' }],
			where: '',
			params: [],
			aggregates: { sort_order: 'sum' },
		};

		expect(() => handleSuperGridCalc(db, payload)).toThrow('SQL safety violation');
	});

	it('does not produce duplicate column names when field is both col axis and SUM aggregate (regression: pre-fix caused all footer cells to show —)', () => {
		// D-011: When priority is both a col axis (GROUP BY) and aggregated (SUM),
		// the SQL produces: SELECT card_type, priority, SUM(priority) AS "__agg__priority".
		// Without the __agg__ prefix, SQLite returns duplicate "priority" columns,
		// the handler puts the aggregate into groupKey instead of values,
		// and _renderFooterRow reads values[priority] as empty → every cell shows "—".
		const db = createMockDb([
			{ card_type: 'person', priority: 5, __agg__priority: 25 },
			{ card_type: 'resource', priority: 5, __agg__priority: 15 },
		]);

		const payload: WorkerPayloads['supergrid:calc'] = {
			rowAxes: [{ field: 'card_type', direction: 'asc' }],
			colAxes: [{ field: 'priority', direction: 'asc' }],
			where: '',
			params: [],
			aggregates: { priority: 'sum' },
		};

		const result = handleSuperGridCalc(db, payload);

		expect(result.rows).toHaveLength(2);
		// groupKey has both axis fields with raw values
		expect(result.rows[0]!.groupKey).toEqual({ card_type: 'person', priority: 5 });
		// values has the aggregate with the field name (prefix stripped)
		expect(result.rows[0]!.values).toEqual({ priority: 25 });
		expect(result.rows[1]!.groupKey).toEqual({ card_type: 'resource', priority: 5 });
		expect(result.rows[1]!.values).toEqual({ priority: 15 });
	});
});
