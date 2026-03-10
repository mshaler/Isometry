// Isometry v5 -- Phase 65 Chart Handler Tests
// Unit tests for handleChartQuery SQL generation and response shaping.
//
// Pattern: Mock Database that captures SQL and params (same as supergrid.handler.test.ts)
// Tests all 4 chart types, limit handling, filter passthrough, and field validation.

import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../../database/Database';
import type { WorkerPayloads } from '../protocol';
import { handleChartQuery } from './chart.handler';

// ---------------------------------------------------------------------------
// Mock Database
// ---------------------------------------------------------------------------

function createMockDb(rows: Record<string, unknown>[] = []) {
	const captured: { sql: string; params: unknown[] } = { sql: '', params: [] };
	const rowsCopy = [...rows];
	return {
		db: {
			prepare: vi.fn((sql: string) => {
				captured.sql = sql;
				return {
					all: vi.fn((...params: unknown[]) => {
						captured.params = params;
						return rowsCopy;
					}),
					free: vi.fn(),
				};
			}),
		} as unknown as Database,
		get captured() {
			return captured;
		},
	};
}

// ---------------------------------------------------------------------------
// Bar Chart
// ---------------------------------------------------------------------------

describe('handleChartQuery — bar chart', () => {
	it('generates COUNT(*) query when yField is null (count mode)', () => {
		const mock = createMockDb([{ label: 'Inbox', value: 5 }]);
		const payload: WorkerPayloads['chart:query'] = {
			chartType: 'bar',
			xField: 'folder',
			yField: null,
			where: 'deleted_at IS NULL',
			params: [],
		};

		const result = handleChartQuery(mock.db, payload);

		expect(mock.captured.sql).toContain('COUNT(*)');
		expect(mock.captured.sql).toContain('folder AS label');
		expect(mock.captured.sql).toContain('GROUP BY folder');
		expect(mock.captured.sql).toContain('ORDER BY value DESC');
		expect(mock.captured.sql).toContain('folder IS NOT NULL');
		expect(result).toEqual({ type: 'labeled', rows: [{ label: 'Inbox', value: 5 }] });
	});

	it('generates SUM query when yField is a numeric field', () => {
		const mock = createMockDb([{ label: 'Inbox', value: 42 }]);
		const payload: WorkerPayloads['chart:query'] = {
			chartType: 'bar',
			xField: 'folder',
			yField: 'priority',
			where: 'deleted_at IS NULL',
			params: [],
		};

		const result = handleChartQuery(mock.db, payload);

		expect(mock.captured.sql).toContain('SUM(priority)');
		expect(mock.captured.sql).toContain('folder AS label');
		expect(mock.captured.sql).toContain('GROUP BY folder');
		expect(mock.captured.sql).toContain('ORDER BY folder ASC');
		expect(result.type).toBe('labeled');
	});
});

// ---------------------------------------------------------------------------
// Pie Chart
// ---------------------------------------------------------------------------

describe('handleChartQuery — pie chart', () => {
	it('generates COUNT query (always count for pie)', () => {
		const mock = createMockDb([{ label: 'note', value: 10 }]);
		const payload: WorkerPayloads['chart:query'] = {
			chartType: 'pie',
			xField: 'card_type',
			yField: null,
			where: 'deleted_at IS NULL',
			params: [],
		};

		const result = handleChartQuery(mock.db, payload);

		expect(mock.captured.sql).toContain('COUNT(*)');
		expect(mock.captured.sql).toContain('card_type AS label');
		expect(mock.captured.sql).toContain('GROUP BY card_type');
		expect(mock.captured.sql).toContain('ORDER BY value DESC');
		expect(result).toEqual({ type: 'labeled', rows: [{ label: 'note', value: 10 }] });
	});
});

// ---------------------------------------------------------------------------
// Line Chart
// ---------------------------------------------------------------------------

describe('handleChartQuery — line chart', () => {
	it('generates COUNT query ordered by x ASC for trends', () => {
		const mock = createMockDb([{ label: '2026-01', value: 3 }]);
		const payload: WorkerPayloads['chart:query'] = {
			chartType: 'line',
			xField: 'created_at',
			yField: null,
			where: 'deleted_at IS NULL',
			params: [],
		};

		const result = handleChartQuery(mock.db, payload);

		expect(mock.captured.sql).toContain('COUNT(*)');
		expect(mock.captured.sql).toContain('created_at AS label');
		expect(mock.captured.sql).toContain('GROUP BY created_at');
		expect(mock.captured.sql).toContain('ORDER BY created_at ASC');
		expect(result).toEqual({ type: 'labeled', rows: [{ label: '2026-01', value: 3 }] });
	});
});

// ---------------------------------------------------------------------------
// Scatter Chart
// ---------------------------------------------------------------------------

describe('handleChartQuery — scatter chart', () => {
	it('generates raw x/y SELECT without GROUP BY', () => {
		const mock = createMockDb([{ x: 3, y: 7 }]);
		const payload: WorkerPayloads['chart:query'] = {
			chartType: 'scatter',
			xField: 'priority',
			yField: 'sort_order',
			where: 'deleted_at IS NULL',
			params: [],
		};

		const result = handleChartQuery(mock.db, payload);

		expect(mock.captured.sql).toContain('priority AS x');
		expect(mock.captured.sql).toContain('sort_order AS y');
		expect(mock.captured.sql).not.toContain('GROUP BY');
		expect(mock.captured.sql).toContain('priority IS NOT NULL');
		expect(mock.captured.sql).toContain('sort_order IS NOT NULL');
		expect(result).toEqual({ type: 'xy', rows: [{ x: 3, y: 7 }] });
	});
});

// ---------------------------------------------------------------------------
// LIMIT Support
// ---------------------------------------------------------------------------

describe('handleChartQuery — limit', () => {
	it('appends LIMIT clause when limit is provided', () => {
		const mock = createMockDb([]);
		const payload: WorkerPayloads['chart:query'] = {
			chartType: 'bar',
			xField: 'folder',
			yField: null,
			where: 'deleted_at IS NULL',
			params: [],
			limit: 5,
		};

		handleChartQuery(mock.db, payload);

		expect(mock.captured.sql).toContain('LIMIT ?');
		expect(mock.captured.params).toContain(5);
	});

	it('does not include LIMIT when limit is undefined', () => {
		const mock = createMockDb([]);
		const payload: WorkerPayloads['chart:query'] = {
			chartType: 'bar',
			xField: 'folder',
			yField: null,
			where: 'deleted_at IS NULL',
			params: [],
		};

		handleChartQuery(mock.db, payload);

		expect(mock.captured.sql).not.toContain('LIMIT');
	});
});

// ---------------------------------------------------------------------------
// WHERE Clause / Filter Passthrough
// ---------------------------------------------------------------------------

describe('handleChartQuery — WHERE clause', () => {
	it('uses provided where clause directly', () => {
		const mock = createMockDb([]);
		const payload: WorkerPayloads['chart:query'] = {
			chartType: 'bar',
			xField: 'folder',
			yField: null,
			where: "deleted_at IS NULL AND card_type = ?",
			params: ['note'],
		};

		handleChartQuery(mock.db, payload);

		expect(mock.captured.sql).toContain("deleted_at IS NULL AND card_type = ?");
		expect(mock.captured.params).toContain('note');
	});

	it('uses deleted_at IS NULL as default when where is empty', () => {
		const mock = createMockDb([]);
		const payload: WorkerPayloads['chart:query'] = {
			chartType: 'bar',
			xField: 'folder',
			yField: null,
			where: '',
			params: [],
		};

		handleChartQuery(mock.db, payload);

		expect(mock.captured.sql).toContain('deleted_at IS NULL');
	});
});

// ---------------------------------------------------------------------------
// SQL Safety Validation
// ---------------------------------------------------------------------------

describe('handleChartQuery — field validation', () => {
	it('throws SQL safety violation for invalid xField', () => {
		const mock = createMockDb([]);
		const payload: WorkerPayloads['chart:query'] = {
			chartType: 'bar',
			xField: 'DROP TABLE cards;--',
			yField: null,
			where: 'deleted_at IS NULL',
			params: [],
		};

		expect(() => handleChartQuery(mock.db, payload)).toThrow('SQL safety violation');
	});

	it('throws SQL safety violation for invalid yField', () => {
		const mock = createMockDb([]);
		const payload: WorkerPayloads['chart:query'] = {
			chartType: 'bar',
			xField: 'folder',
			yField: 'EVIL_SQL',
			where: 'deleted_at IS NULL',
			params: [],
		};

		expect(() => handleChartQuery(mock.db, payload)).toThrow('SQL safety violation');
	});
});
