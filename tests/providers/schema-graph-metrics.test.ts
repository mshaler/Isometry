// Isometry v9.0 — Phase 116 Plan 01
// TDD tests for SchemaProvider graph metric column injection.
//
// Tests cover:
//   - addGraphMetricColumns() injects 6 ColumnInfo entries
//   - removeGraphMetricColumns() clears them
//   - Idempotency: calling addGraphMetricColumns twice does not duplicate
//   - isValidColumn('community_id', 'cards') returns true after add
//   - getAxisColumns() includes all 6 metric columns after add
//   - getNumericColumns() includes 5 numeric metrics (not community_id)
//   - hasGraphMetrics() returns correct state
//   - Subscriber notification fires on add/remove
//   - LATCH families: community_id is Hierarchy+non-numeric; rest are Hierarchy+numeric

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchemaProvider } from '../../src/providers/SchemaProvider';
import type { ColumnInfo } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CARD_COLUMNS: ColumnInfo[] = [
	{ name: 'name', type: 'TEXT', notnull: true, latchFamily: 'Alphabet', isNumeric: false },
	{ name: 'card_type', type: 'TEXT', notnull: true, latchFamily: 'Category', isNumeric: false },
	{ name: 'priority', type: 'INTEGER', notnull: true, latchFamily: 'Hierarchy', isNumeric: true },
];

const CONN_COLUMNS: ColumnInfo[] = [
	{ name: 'source_id', type: 'TEXT', notnull: true, latchFamily: 'Alphabet', isNumeric: false },
];

const METRIC_COLUMN_NAMES = [
	'community_id',
	'pagerank',
	'centrality',
	'clustering_coeff',
	'sp_depth',
	'in_spanning_tree',
];

// ---------------------------------------------------------------------------
// Helper to flush microtasks
// ---------------------------------------------------------------------------
async function flushMicrotasks(): Promise<void> {
	await new Promise<void>((resolve) => queueMicrotask(resolve));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SchemaProvider graph metric columns', () => {
	let sp: SchemaProvider;

	beforeEach(() => {
		sp = new SchemaProvider();
		sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
	});

	// -----------------------------------------------------------------------
	// addGraphMetricColumns
	// -----------------------------------------------------------------------

	it('getAxisColumns includes 6 metric columns after addGraphMetricColumns', () => {
		sp.addGraphMetricColumns();
		const axes = sp.getAxisColumns();
		const names = axes.map((c) => c.name);
		for (const metric of METRIC_COLUMN_NAMES) {
			expect(names).toContain(metric);
		}
		// 3 base + 6 metric = 9
		expect(axes.length).toBe(9);
	});

	it('isValidColumn recognizes metric columns after add', () => {
		sp.addGraphMetricColumns();
		expect(sp.isValidColumn('community_id', 'cards')).toBe(true);
		expect(sp.isValidColumn('pagerank', 'cards')).toBe(true);
		expect(sp.isValidColumn('centrality', 'cards')).toBe(true);
		expect(sp.isValidColumn('clustering_coeff', 'cards')).toBe(true);
		expect(sp.isValidColumn('sp_depth', 'cards')).toBe(true);
		expect(sp.isValidColumn('in_spanning_tree', 'cards')).toBe(true);
	});

	it('community_id has latchFamily Hierarchy and isNumeric false', () => {
		sp.addGraphMetricColumns();
		const axes = sp.getAxisColumns();
		const community = axes.find((c) => c.name === 'community_id');
		expect(community).toBeDefined();
		expect(community!.latchFamily).toBe('Hierarchy');
		expect(community!.isNumeric).toBe(false);
	});

	it('pagerank, centrality, clustering_coeff are Hierarchy + numeric', () => {
		sp.addGraphMetricColumns();
		const axes = sp.getAxisColumns();
		for (const name of ['pagerank', 'centrality', 'clustering_coeff']) {
			const col = axes.find((c) => c.name === name);
			expect(col).toBeDefined();
			expect(col!.latchFamily).toBe('Hierarchy');
			expect(col!.isNumeric).toBe(true);
		}
	});

	it('sp_depth and in_spanning_tree are Hierarchy + numeric', () => {
		sp.addGraphMetricColumns();
		const axes = sp.getAxisColumns();
		for (const name of ['sp_depth', 'in_spanning_tree']) {
			const col = axes.find((c) => c.name === name);
			expect(col).toBeDefined();
			expect(col!.latchFamily).toBe('Hierarchy');
			expect(col!.isNumeric).toBe(true);
		}
	});

	// -----------------------------------------------------------------------
	// removeGraphMetricColumns
	// -----------------------------------------------------------------------

	it('removeGraphMetricColumns removes all metric columns from getAxisColumns', () => {
		sp.addGraphMetricColumns();
		sp.removeGraphMetricColumns();
		const axes = sp.getAxisColumns();
		const names = axes.map((c) => c.name);
		for (const metric of METRIC_COLUMN_NAMES) {
			expect(names).not.toContain(metric);
		}
		expect(axes.length).toBe(3); // back to base
	});

	it('isValidColumn returns false for metric columns after remove', () => {
		sp.addGraphMetricColumns();
		sp.removeGraphMetricColumns();
		expect(sp.isValidColumn('community_id', 'cards')).toBe(false);
		expect(sp.isValidColumn('pagerank', 'cards')).toBe(false);
	});

	// -----------------------------------------------------------------------
	// Idempotency
	// -----------------------------------------------------------------------

	it('calling addGraphMetricColumns twice does not duplicate columns', () => {
		sp.addGraphMetricColumns();
		sp.addGraphMetricColumns();
		const axes = sp.getAxisColumns();
		const metricNames = axes.filter((c) => METRIC_COLUMN_NAMES.includes(c.name));
		expect(metricNames.length).toBe(6);
	});

	// -----------------------------------------------------------------------
	// hasGraphMetrics
	// -----------------------------------------------------------------------

	it('hasGraphMetrics returns false before add', () => {
		expect(sp.hasGraphMetrics()).toBe(false);
	});

	it('hasGraphMetrics returns true after add', () => {
		sp.addGraphMetricColumns();
		expect(sp.hasGraphMetrics()).toBe(true);
	});

	it('hasGraphMetrics returns false after add then remove', () => {
		sp.addGraphMetricColumns();
		sp.removeGraphMetricColumns();
		expect(sp.hasGraphMetrics()).toBe(false);
	});

	// -----------------------------------------------------------------------
	// Subscriber notification
	// -----------------------------------------------------------------------

	it('addGraphMetricColumns triggers subscriber notification', async () => {
		const callback = vi.fn();
		sp.subscribe(callback);
		// Flush initial notify from initialize()
		await flushMicrotasks();
		callback.mockClear();

		sp.addGraphMetricColumns();
		await flushMicrotasks();
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('removeGraphMetricColumns triggers subscriber notification', async () => {
		sp.addGraphMetricColumns();
		await flushMicrotasks();

		const callback = vi.fn();
		sp.subscribe(callback);
		sp.removeGraphMetricColumns();
		await flushMicrotasks();
		expect(callback).toHaveBeenCalledTimes(1);
	});

	// -----------------------------------------------------------------------
	// getNumericColumns includes metrics
	// -----------------------------------------------------------------------

	it('getNumericColumns includes 5 numeric metric columns (excludes community_id)', () => {
		sp.addGraphMetricColumns();
		const numCols = sp.getNumericColumns();
		const names = numCols.map((c) => c.name);
		expect(names).toContain('pagerank');
		expect(names).toContain('centrality');
		expect(names).toContain('clustering_coeff');
		expect(names).toContain('sp_depth');
		expect(names).toContain('in_spanning_tree');
		expect(names).not.toContain('community_id');
	});

	// -----------------------------------------------------------------------
	// getAllAxisColumns includes metrics
	// -----------------------------------------------------------------------

	it('getAllAxisColumns includes metric columns', () => {
		sp.addGraphMetricColumns();
		const all = sp.getAllAxisColumns();
		const names = all.map((c) => c.name);
		for (const metric of METRIC_COLUMN_NAMES) {
			expect(names).toContain(metric);
		}
	});

	// -----------------------------------------------------------------------
	// getFieldsByFamily includes metrics
	// -----------------------------------------------------------------------

	it('getFieldsByFamily Hierarchy includes metric columns', () => {
		sp.addGraphMetricColumns();
		const hierarchyCols = sp.getFieldsByFamily('Hierarchy');
		const names = hierarchyCols.map((c) => c.name);
		// Base: priority. Graph metrics: all 6
		expect(names).toContain('priority');
		for (const metric of METRIC_COLUMN_NAMES) {
			expect(names).toContain(metric);
		}
	});

	// -----------------------------------------------------------------------
	// getLatchFamilies includes metrics
	// -----------------------------------------------------------------------

	it('getLatchFamilies includes metric columns under Hierarchy', () => {
		sp.addGraphMetricColumns();
		const families = sp.getLatchFamilies();
		const hierarchy = families.get('Hierarchy') ?? [];
		for (const metric of METRIC_COLUMN_NAMES) {
			expect(hierarchy).toContain(metric);
		}
	});

	// -----------------------------------------------------------------------
	// getFilterableColumns includes metrics
	// -----------------------------------------------------------------------

	it('getFilterableColumns includes metric columns after add', () => {
		sp.addGraphMetricColumns();
		const filterable = sp.getFilterableColumns();
		const names = filterable.map((c) => c.name);
		for (const metric of METRIC_COLUMN_NAMES) {
			expect(names).toContain(metric);
		}
	});
});
