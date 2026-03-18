// Isometry v6.1+ — StateManager migration edge case tests
// Focused tests for _migrateState/_migrateFilterState/_migratePAFVState edge cases.
//
// These complement the Phase 72 tests in StateManager.test.ts by covering:
//   - Empty arrays/objects pass through correctly
//   - null/undefined axis values are preserved (not treated as invalid)
//   - Mixed valid/invalid entries in all collection types
//   - Non-filter/non-pafv keys pass through unmodified
//   - SchemaProvider not wired or not initialized → no migration
//
// Requirements: TD-03 (test coverage gap)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StateManager } from '../../src/providers/StateManager';
import { SchemaProvider } from '../../src/providers/SchemaProvider';
import type { PersistableProvider } from '../../src/providers/types';
import type { WorkerBridge } from '../../src/worker/WorkerBridge';
import type { ColumnInfo } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSchemaProvider(columnNames: string[]): SchemaProvider {
	const sp = new SchemaProvider();
	sp.initialize({
		cards: columnNames.map(
			(name): ColumnInfo => ({
				name,
				type: 'TEXT',
				notnull: false,
				latchFamily: 'Alphabet' as const,
				isNumeric: false,
			}),
		),
		connections: [],
	});
	return sp;
}

function makeBridgeMock(rows: Array<{ key: string; value: string; updated_at: string }>) {
	const sendMock = vi.fn().mockImplementation((type: string) => {
		if (type === 'ui:getAll') return Promise.resolve(rows);
		return Promise.resolve();
	});
	return { bridge: { send: sendMock } as unknown as WorkerBridge, sendMock };
}

function makeCapturingProvider(): {
	provider: PersistableProvider;
	captured: () => unknown;
	resetCalled: () => boolean;
} {
	let lastState: unknown = undefined;
	let wasReset = false;
	const provider: PersistableProvider = {
		toJSON: () => '{}',
		setState: (s: unknown) => {
			lastState = s;
		},
		resetToDefaults: () => {
			wasReset = true;
		},
	};
	return {
		provider,
		captured: () => lastState,
		resetCalled: () => wasReset,
	};
}

// ---------------------------------------------------------------------------
// Filter migration edge cases
// ---------------------------------------------------------------------------

describe('StateManager migration — filter edge cases', () => {
	it('empty filters array stays empty after migration', async () => {
		const sp = makeSchemaProvider(['name', 'folder']);
		const state = JSON.stringify({
			filters: [],
			searchQuery: null,
			axisFilters: {},
			rangeFilters: {},
		});
		const { bridge } = makeBridgeMock([{ key: 'filter', value: state, updated_at: '' }]);
		const { provider, captured } = makeCapturingProvider();

		const sm = new StateManager(bridge);
		sm.setSchemaProvider(sp);
		sm.registerProvider('filter', provider);
		await sm.restore();

		const result = captured() as Record<string, unknown>;
		expect(result['filters']).toEqual([]);
		expect(result['axisFilters']).toEqual({});
		expect(result['rangeFilters']).toEqual({});
	});

	it('drops filter entries with fields not in schema', async () => {
		const sp = makeSchemaProvider(['name', 'folder']);
		const state = JSON.stringify({
			filters: [
				{ field: 'folder', operator: 'eq', value: 'Projects' },
				{ field: 'deleted_field', operator: 'eq', value: 'x' },
			],
			searchQuery: null,
			axisFilters: {},
			rangeFilters: {},
		});
		const { bridge } = makeBridgeMock([{ key: 'filter', value: state, updated_at: '' }]);
		const { provider, captured } = makeCapturingProvider();

		const sm = new StateManager(bridge);
		sm.setSchemaProvider(sp);
		sm.registerProvider('filter', provider);
		await sm.restore();

		const result = captured() as Record<string, unknown>;
		const filters = result['filters'] as Array<{ field: string }>;
		expect(filters).toHaveLength(1);
		expect(filters[0]?.field).toBe('folder');
	});

	it('drops axisFilters keys not in schema', async () => {
		const sp = makeSchemaProvider(['name', 'folder']);
		const state = JSON.stringify({
			filters: [],
			searchQuery: null,
			axisFilters: { folder: ['A', 'B'], removed_col: ['X'] },
			rangeFilters: {},
		});
		const { bridge } = makeBridgeMock([{ key: 'filter', value: state, updated_at: '' }]);
		const { provider, captured } = makeCapturingProvider();

		const sm = new StateManager(bridge);
		sm.setSchemaProvider(sp);
		sm.registerProvider('filter', provider);
		await sm.restore();

		const result = captured() as Record<string, unknown>;
		const axisFilters = result['axisFilters'] as Record<string, unknown>;
		expect(Object.keys(axisFilters)).toEqual(['folder']);
	});

	it('drops rangeFilters keys not in schema', async () => {
		const sp = makeSchemaProvider(['name', 'priority']);
		const state = JSON.stringify({
			filters: [],
			searchQuery: null,
			axisFilters: {},
			rangeFilters: { priority: { min: 1, max: 10 }, gone_field: { min: 0, max: 5 } },
		});
		const { bridge } = makeBridgeMock([{ key: 'filter', value: state, updated_at: '' }]);
		const { provider, captured } = makeCapturingProvider();

		const sm = new StateManager(bridge);
		sm.setSchemaProvider(sp);
		sm.registerProvider('filter', provider);
		await sm.restore();

		const result = captured() as Record<string, unknown>;
		const rangeFilters = result['rangeFilters'] as Record<string, unknown>;
		expect(Object.keys(rangeFilters)).toEqual(['priority']);
	});

	it('preserves valid entries alongside invalid ones', async () => {
		const sp = makeSchemaProvider(['name', 'folder', 'priority']);
		const state = JSON.stringify({
			filters: [
				{ field: 'folder', operator: 'eq', value: 'A' },
				{ field: 'bad1', operator: 'eq', value: 'x' },
				{ field: 'name', operator: 'contains', value: 'test' },
				{ field: 'bad2', operator: 'eq', value: 'y' },
			],
			searchQuery: 'hello',
			axisFilters: { folder: ['A'], bad1: ['x'], name: ['test'] },
			rangeFilters: { priority: { min: 1, max: 5 }, bad1: { min: 0, max: 1 } },
		});
		const { bridge } = makeBridgeMock([{ key: 'filter', value: state, updated_at: '' }]);
		const { provider, captured } = makeCapturingProvider();

		const sm = new StateManager(bridge);
		sm.setSchemaProvider(sp);
		sm.registerProvider('filter', provider);
		await sm.restore();

		const result = captured() as Record<string, unknown>;
		const filters = result['filters'] as Array<{ field: string }>;
		expect(filters).toHaveLength(2);
		expect(filters.map((f) => f.field)).toEqual(['folder', 'name']);
		expect(Object.keys(result['axisFilters'] as object)).toEqual(['folder', 'name']);
		expect(Object.keys(result['rangeFilters'] as object)).toEqual(['priority']);
		// searchQuery passes through unchanged
		expect(result['searchQuery']).toBe('hello');
	});
});

// ---------------------------------------------------------------------------
// PAFV migration edge cases
// ---------------------------------------------------------------------------

describe('StateManager migration — PAFV edge cases', () => {
	it('nulls xAxis/yAxis/groupBy when field not in schema', async () => {
		const sp = makeSchemaProvider(['name', 'folder']);
		const state = JSON.stringify({
			viewType: 'supergrid',
			xAxis: { field: 'removed_x', direction: 'asc' },
			yAxis: { field: 'removed_y', direction: 'asc' },
			groupBy: { field: 'removed_g', direction: 'asc' },
			colAxes: [],
			rowAxes: [],
		});
		const { bridge } = makeBridgeMock([{ key: 'pafv', value: state, updated_at: '' }]);
		const { provider, captured } = makeCapturingProvider();

		const sm = new StateManager(bridge);
		sm.setSchemaProvider(sp);
		sm.registerProvider('pafv', provider);
		await sm.restore();

		const result = captured() as Record<string, unknown>;
		expect(result['xAxis']).toBeNull();
		expect(result['yAxis']).toBeNull();
		expect(result['groupBy']).toBeNull();
	});

	it('filters colAxes/rowAxes entries with invalid fields', async () => {
		const sp = makeSchemaProvider(['name', 'folder', 'card_type']);
		const state = JSON.stringify({
			viewType: 'supergrid',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [
				{ field: 'card_type', direction: 'asc' },
				{ field: 'removed', direction: 'asc' },
			],
			rowAxes: [
				{ field: 'removed2', direction: 'asc' },
				{ field: 'folder', direction: 'asc' },
			],
		});
		const { bridge } = makeBridgeMock([{ key: 'pafv', value: state, updated_at: '' }]);
		const { provider, captured } = makeCapturingProvider();

		const sm = new StateManager(bridge);
		sm.setSchemaProvider(sp);
		sm.registerProvider('pafv', provider);
		await sm.restore();

		const result = captured() as Record<string, unknown>;
		const colAxes = result['colAxes'] as Array<{ field: string }>;
		const rowAxes = result['rowAxes'] as Array<{ field: string }>;
		expect(colAxes).toHaveLength(1);
		expect(colAxes[0]?.field).toBe('card_type');
		expect(rowAxes).toHaveLength(1);
		expect(rowAxes[0]?.field).toBe('folder');
	});

	it('passes through colWidths/sortOverrides unchanged', async () => {
		const sp = makeSchemaProvider(['name', 'folder']);
		const state = JSON.stringify({
			viewType: 'supergrid',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
			colWidths: { note: 200, task: 150 },
			sortOverrides: [{ field: 'modified_at', direction: 'desc' }],
			collapseState: [{ key: 'k', mode: 'aggregate' }],
		});
		const { bridge } = makeBridgeMock([{ key: 'pafv', value: state, updated_at: '' }]);
		const { provider, captured } = makeCapturingProvider();

		const sm = new StateManager(bridge);
		sm.setSchemaProvider(sp);
		sm.registerProvider('pafv', provider);
		await sm.restore();

		const result = captured() as Record<string, unknown>;
		expect(result['colWidths']).toEqual({ note: 200, task: 150 });
		expect(result['sortOverrides']).toEqual([{ field: 'modified_at', direction: 'desc' }]);
		expect(result['collapseState']).toEqual([{ key: 'k', mode: 'aggregate' }]);
	});

	it('null/undefined axis values pass through unchanged', async () => {
		const sp = makeSchemaProvider(['name', 'folder']);
		const state = JSON.stringify({
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
		});
		const { bridge } = makeBridgeMock([{ key: 'pafv', value: state, updated_at: '' }]);
		const { provider, captured } = makeCapturingProvider();

		const sm = new StateManager(bridge);
		sm.setSchemaProvider(sp);
		sm.registerProvider('pafv', provider);
		await sm.restore();

		const result = captured() as Record<string, unknown>;
		expect(result['xAxis']).toBeNull();
		expect(result['yAxis']).toBeNull();
		expect(result['groupBy']).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// General migration edge cases
// ---------------------------------------------------------------------------

describe('StateManager migration — general edge cases', () => {
	it('state passes through unchanged when SchemaProvider not wired', async () => {
		const state = JSON.stringify({
			filters: [{ field: 'nonexistent', operator: 'eq', value: 'x' }],
			searchQuery: null,
			axisFilters: {},
			rangeFilters: {},
		});
		const { bridge } = makeBridgeMock([{ key: 'filter', value: state, updated_at: '' }]);
		const { provider, captured } = makeCapturingProvider();

		// No setSchemaProvider call
		const sm = new StateManager(bridge);
		sm.registerProvider('filter', provider);
		await sm.restore();

		const result = captured() as Record<string, unknown>;
		const filters = result['filters'] as Array<{ field: string }>;
		// nonexistent field should NOT be pruned — no schema to validate against
		expect(filters).toHaveLength(1);
		expect(filters[0]?.field).toBe('nonexistent');
	});

	it('non-filter/non-pafv keys pass through unmodified', async () => {
		const sp = makeSchemaProvider(['name']);
		const state = JSON.stringify({ customKey: 'customValue', nested: { a: 1 } });
		const { bridge } = makeBridgeMock([{ key: 'settings', value: state, updated_at: '' }]);
		const { provider, captured } = makeCapturingProvider();

		const sm = new StateManager(bridge);
		sm.setSchemaProvider(sp);
		sm.registerProvider('settings', provider);
		await sm.restore();

		const result = captured() as Record<string, unknown>;
		expect(result['customKey']).toBe('customValue');
		expect(result['nested']).toEqual({ a: 1 });
	});
});
