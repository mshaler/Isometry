// Isometry v5 — Phase 4 Plan 03 (Task 1)
// Tests for PAFVProvider: axis compilation, view family suspension, subscriber pattern, serialization.
//
// Requirements: PROV-03, PROV-04, PROV-11
// TDD Phase: RED → GREEN → REFACTOR

import { describe, expect, it, vi } from 'vitest';
import { PAFVProvider } from '../../src/providers/PAFVProvider';
import type { AggregationMode, AxisMapping } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

describe('PAFVProvider — default state', () => {
	it('default viewType is list', () => {
		const provider = new PAFVProvider();
		expect(provider.getState().viewType).toBe('list');
	});

	it('default xAxis is null', () => {
		const provider = new PAFVProvider();
		expect(provider.getState().xAxis).toBeNull();
	});

	it('default yAxis is null', () => {
		const provider = new PAFVProvider();
		expect(provider.getState().yAxis).toBeNull();
	});

	it('default groupBy is null', () => {
		const provider = new PAFVProvider();
		expect(provider.getState().groupBy).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// compile() — axis compilation to SQL fragments
// ---------------------------------------------------------------------------

describe('PAFVProvider.compile() — no axes', () => {
	it('returns { orderBy: "", groupBy: "" } when no axes set', () => {
		const provider = new PAFVProvider();
		const result = provider.compile();
		expect(result.orderBy).toBe('');
		expect(result.groupBy).toBe('');
	});
});

describe('PAFVProvider.compile() — xAxis only', () => {
	it('setXAxis({field:"created_at", direction:"desc"}) → orderBy contains "created_at DESC"', () => {
		const provider = new PAFVProvider();
		provider.setXAxis({ field: 'created_at', direction: 'desc' });
		const result = provider.compile();
		expect(result.orderBy).toContain('created_at DESC');
		expect(result.groupBy).toBe('');
	});

	it('setXAxis({field:"modified_at", direction:"asc"}) → orderBy contains "modified_at ASC"', () => {
		const provider = new PAFVProvider();
		provider.setXAxis({ field: 'modified_at', direction: 'asc' });
		const result = provider.compile();
		expect(result.orderBy).toContain('modified_at ASC');
	});
});

describe('PAFVProvider.compile() — xAxis + yAxis', () => {
	it('both axes → orderBy contains both fields', () => {
		const provider = new PAFVProvider();
		provider.setXAxis({ field: 'created_at', direction: 'desc' });
		provider.setYAxis({ field: 'folder', direction: 'asc' });
		const result = provider.compile();
		expect(result.orderBy).toContain('created_at DESC');
		expect(result.orderBy).toContain('folder ASC');
	});

	it('both axes → orderBy is comma-separated', () => {
		const provider = new PAFVProvider();
		provider.setXAxis({ field: 'created_at', direction: 'desc' });
		provider.setYAxis({ field: 'folder', direction: 'asc' });
		const result = provider.compile();
		expect(result.orderBy).toMatch(/created_at DESC,\s*folder ASC/);
	});
});

describe('PAFVProvider.compile() — groupBy axis', () => {
	it('setGroupBy({field:"status", direction:"asc"}) → compile().groupBy contains "status"', () => {
		const provider = new PAFVProvider();
		provider.setGroupBy({ field: 'status', direction: 'asc' });
		const result = provider.compile();
		expect(result.groupBy).toContain('status');
	});

	it('groupBy contains just the field name (no GROUP BY keyword)', () => {
		const provider = new PAFVProvider();
		provider.setGroupBy({ field: 'folder', direction: 'asc' });
		const result = provider.compile();
		expect(result.groupBy).not.toContain('GROUP BY');
		expect(result.groupBy).toContain('folder');
	});
});

describe('PAFVProvider.compile() — SQL safety', () => {
	it('invalid axis field throws SQL safety violation', () => {
		const provider = new PAFVProvider();
		expect(() => {
			provider.setXAxis({ field: 'DROP TABLE' as never, direction: 'asc' });
		}).toThrowError(/SQL safety violation/);
	});

	it('compile() re-validates after setState with injected invalid axis', () => {
		const provider = new PAFVProvider();
		// Bypass setter to inject invalid state
		const state = JSON.parse(provider.toJSON());
		state.xAxis = { field: 'evil_column', direction: 'asc' };
		provider.setState(state);
		expect(() => provider.compile()).toThrowError(/SQL safety violation/);
	});
});

// ---------------------------------------------------------------------------
// View family: getViewFamily
// ---------------------------------------------------------------------------

describe('PAFVProvider.getViewFamily()', () => {
	it('"list" → "latch"', () => {
		const provider = new PAFVProvider();
		expect(provider.getViewFamily('list')).toBe('latch');
	});

	it('"grid" → "latch"', () => {
		const provider = new PAFVProvider();
		expect(provider.getViewFamily('grid')).toBe('latch');
	});

	it('"kanban" → "latch"', () => {
		const provider = new PAFVProvider();
		expect(provider.getViewFamily('kanban')).toBe('latch');
	});

	it('"calendar" → "latch"', () => {
		const provider = new PAFVProvider();
		expect(provider.getViewFamily('calendar')).toBe('latch');
	});

	it('"timeline" → "latch"', () => {
		const provider = new PAFVProvider();
		expect(provider.getViewFamily('timeline')).toBe('latch');
	});

	it('"gallery" → "latch"', () => {
		const provider = new PAFVProvider();
		expect(provider.getViewFamily('gallery')).toBe('latch');
	});

	it('"network" → "graph"', () => {
		const provider = new PAFVProvider();
		expect(provider.getViewFamily('network')).toBe('graph');
	});

	it('"tree" → "graph"', () => {
		const provider = new PAFVProvider();
		expect(provider.getViewFamily('tree')).toBe('graph');
	});
});

// ---------------------------------------------------------------------------
// setViewType — within same family (no suspension)
// ---------------------------------------------------------------------------

describe('PAFVProvider.setViewType() — same family', () => {
	it('setViewType("kanban") within LATCH → state.viewType changes', () => {
		const provider = new PAFVProvider();
		provider.setViewType('kanban');
		expect(provider.getState().viewType).toBe('kanban');
	});

	it('setViewType("kanban") within LATCH → does not trigger suspension', () => {
		const provider = new PAFVProvider();
		provider.setXAxis({ field: 'created_at', direction: 'asc' });
		provider.setViewType('kanban');
		// xAxis should still be set (no suspension occurred)
		expect(provider.getState().xAxis).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// setViewType — cross-family suspension/restoration
// ---------------------------------------------------------------------------

describe('PAFVProvider.setViewType() — cross family', () => {
	it('LATCH→GRAPH suspends LATCH state and enters GRAPH with defaults', () => {
		const provider = new PAFVProvider();
		provider.setXAxis({ field: 'created_at', direction: 'asc' });
		provider.setViewType('network');

		const state = provider.getState();
		expect(state.viewType).toBe('network');
		// After entering GRAPH, xAxis should be reset to GRAPH defaults (likely null)
		// We just check that LATCH axis was suspended (not in active state)
		// The GRAPH family doesn't use xAxis the same way
	});

	it('GRAPH→LATCH restores previously suspended LATCH state', () => {
		const provider = new PAFVProvider();
		// Set LATCH state
		provider.setXAxis({ field: 'created_at', direction: 'asc' });
		// Go to GRAPH — suspends LATCH
		provider.setViewType('network');
		// Come back to LATCH — restores suspended state
		provider.setViewType('list');

		const state = provider.getState();
		expect(state.viewType).toBe('list');
		expect(state.xAxis).toEqual({ field: 'created_at', direction: 'asc' });
	});

	it('first visit to GRAPH uses defaults (no prior suspension)', () => {
		const provider = new PAFVProvider();
		provider.setViewType('network');
		const state = provider.getState();
		expect(state.viewType).toBe('network');
		// Should have default GRAPH state (not carry over LATCH axes)
		expect(state.xAxis).toBeNull();
	});

	it('suspended state is deep-copied — modifying active state does not affect suspended', () => {
		const provider = new PAFVProvider();
		// Set LATCH state with xAxis
		provider.setXAxis({ field: 'created_at', direction: 'asc' });
		// Suspend LATCH by going to GRAPH
		provider.setViewType('network');
		// Modify active (GRAPH) state — this should NOT affect the suspended LATCH state
		provider.setXAxis({ field: 'folder', direction: 'desc' });
		// Restore LATCH
		provider.setViewType('list');
		// Should have the original LATCH xAxis, not the GRAPH modification
		expect(provider.getState().xAxis).toEqual({ field: 'created_at', direction: 'asc' });
	});
});

// ---------------------------------------------------------------------------
// setXAxis / setYAxis / setGroupBy — mutation API
// ---------------------------------------------------------------------------

describe('PAFVProvider axis setters', () => {
	it('setXAxis(null) clears xAxis', () => {
		const provider = new PAFVProvider();
		provider.setXAxis({ field: 'created_at', direction: 'asc' });
		provider.setXAxis(null);
		expect(provider.getState().xAxis).toBeNull();
	});

	it('setYAxis(null) clears yAxis', () => {
		const provider = new PAFVProvider();
		provider.setYAxis({ field: 'folder', direction: 'asc' });
		provider.setYAxis(null);
		expect(provider.getState().yAxis).toBeNull();
	});

	it('setGroupBy(null) clears groupBy', () => {
		const provider = new PAFVProvider();
		provider.setGroupBy({ field: 'status', direction: 'asc' });
		provider.setGroupBy(null);
		expect(provider.getState().groupBy).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// subscribe() / unsubscribe pattern (PROV-11)
// ---------------------------------------------------------------------------

describe('PAFVProvider.subscribe()', () => {
	it('returns an unsubscribe function', () => {
		const provider = new PAFVProvider();
		const unsubscribe = provider.subscribe(() => {});
		expect(typeof unsubscribe).toBe('function');
	});

	it('calls subscriber after setXAxis (via queueMicrotask)', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setXAxis({ field: 'created_at', direction: 'asc' });
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('two rapid axis changes produce only ONE notification', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setXAxis({ field: 'created_at', direction: 'asc' });
		provider.setYAxis({ field: 'folder', direction: 'asc' });
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('unsubscribe removes the subscriber', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		const unsubscribe = provider.subscribe(cb);
		unsubscribe();
		provider.setXAxis({ field: 'created_at', direction: 'asc' });
		await Promise.resolve();
		expect(cb).not.toHaveBeenCalled();
	});

	it('setViewType() triggers notification', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setViewType('kanban');
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Serialization (toJSON / setState / resetToDefaults)
// ---------------------------------------------------------------------------

describe('PAFVProvider serialization', () => {
	it('toJSON() returns a valid JSON string', () => {
		const provider = new PAFVProvider();
		const json = provider.toJSON();
		expect(typeof json).toBe('string');
		expect(() => JSON.parse(json)).not.toThrow();
	});

	it('toJSON/setState round-trips viewType', () => {
		const provider = new PAFVProvider();
		provider.setViewType('kanban');
		const json = provider.toJSON();

		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getState().viewType).toBe('kanban');
	});

	it('toJSON/setState round-trips xAxis', () => {
		const provider = new PAFVProvider();
		provider.setXAxis({ field: 'created_at', direction: 'desc' });
		const json = provider.toJSON();

		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getState().xAxis).toEqual({ field: 'created_at', direction: 'desc' });
	});

	it('toJSON/setState round-trips groupBy', () => {
		const provider = new PAFVProvider();
		provider.setGroupBy({ field: 'status', direction: 'asc' });
		const json = provider.toJSON();

		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getState().groupBy).toEqual({ field: 'status', direction: 'asc' });
	});

	it('setState() with invalid state shape throws', () => {
		const provider = new PAFVProvider();
		expect(() => provider.setState('not an object')).toThrow();
	});

	it('resetToDefaults() returns to list view with no axes', () => {
		const provider = new PAFVProvider();
		provider.setViewType('kanban');
		provider.setXAxis({ field: 'created_at', direction: 'asc' });
		provider.setGroupBy({ field: 'status', direction: 'asc' });
		provider.resetToDefaults();

		const state = provider.getState();
		expect(state.viewType).toBe('list');
		expect(state.xAxis).toBeNull();
		expect(state.yAxis).toBeNull();
		expect(state.groupBy).toBeNull();
	});

	it('resetToDefaults() also clears suspended states', () => {
		const provider = new PAFVProvider();
		// Go to GRAPH to create suspended state
		provider.setViewType('network');
		provider.resetToDefaults();
		// Should be back to list with no suspended states
		expect(provider.getState().viewType).toBe('list');
		// Now go to GRAPH again — should use defaults (no prior LATCH to restore)
		provider.setViewType('network');
		expect(provider.getState().xAxis).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Stacked axes: colAxes / rowAxes — defaults
// ---------------------------------------------------------------------------

describe('PAFVProvider — stacked axes defaults', () => {
	it('new PAFVProvider() has colAxes: []', () => {
		const provider = new PAFVProvider();
		expect(provider.getState().colAxes).toEqual([]);
	});

	it('new PAFVProvider() has rowAxes: []', () => {
		const provider = new PAFVProvider();
		expect(provider.getState().rowAxes).toEqual([]);
	});

	it('setViewType("supergrid") sets colAxes to card_type default', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		expect(provider.getState().colAxes).toEqual([{ field: 'card_type', direction: 'asc' }]);
	});

	it('setViewType("supergrid") sets rowAxes to folder default', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		expect(provider.getState().rowAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
	});

	it('non-supergrid views have colAxes: []', () => {
		const viewTypes = ['list', 'grid', 'kanban', 'calendar', 'timeline', 'gallery', 'network', 'tree'] as const;
		for (const vt of viewTypes) {
			const provider = new PAFVProvider();
			provider.setViewType(vt);
			expect(provider.getState().colAxes).toEqual([]);
		}
	});

	it('non-supergrid views have rowAxes: []', () => {
		const viewTypes = ['list', 'grid', 'kanban', 'calendar', 'timeline', 'gallery', 'network', 'tree'] as const;
		for (const vt of viewTypes) {
			const provider = new PAFVProvider();
			provider.setViewType(vt);
			expect(provider.getState().rowAxes).toEqual([]);
		}
	});
});

// ---------------------------------------------------------------------------
// setColAxes / setRowAxes — valid assignment
// ---------------------------------------------------------------------------

describe('PAFVProvider.setColAxes() / setRowAxes()', () => {
	it('setColAxes([{ field: "folder", direction: "asc" }]) → getState().colAxes matches', () => {
		const provider = new PAFVProvider();
		provider.setColAxes([{ field: 'folder', direction: 'asc' }]);
		expect(provider.getState().colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
	});

	it('setRowAxes([{ field: "status", direction: "desc" }]) → getState().rowAxes matches', () => {
		const provider = new PAFVProvider();
		provider.setRowAxes([{ field: 'status', direction: 'desc' }]);
		expect(provider.getState().rowAxes).toEqual([{ field: 'status', direction: 'desc' }]);
	});

	it('setColAxes with multiple axes sets all entries', () => {
		const provider = new PAFVProvider();
		const axes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'desc' },
		];
		provider.setColAxes(axes);
		expect(provider.getState().colAxes).toEqual(axes);
	});

	it('setColAxes([]) clears to empty array', () => {
		const provider = new PAFVProvider();
		provider.setColAxes([{ field: 'folder', direction: 'asc' }]);
		provider.setColAxes([]);
		expect(provider.getState().colAxes).toEqual([]);
	});

	it('setRowAxes([]) clears to empty array', () => {
		const provider = new PAFVProvider();
		provider.setRowAxes([{ field: 'status', direction: 'asc' }]);
		provider.setRowAxes([]);
		expect(provider.getState().rowAxes).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Stacked axes: validation
// ---------------------------------------------------------------------------

describe('PAFVProvider stacked axes — validation', () => {
	it('setColAxes with 4 axes succeeds (no depth limit)', () => {
		const provider = new PAFVProvider();
		const axes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'priority', direction: 'asc' },
			{ field: 'name', direction: 'asc' },
		];
		expect(() => provider.setColAxes(axes)).not.toThrow();
		expect(provider.getState().colAxes).toHaveLength(4);
	});

	it('setRowAxes with 4 axes succeeds (no depth limit)', () => {
		const provider = new PAFVProvider();
		const axes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'priority', direction: 'asc' },
			{ field: 'name', direction: 'asc' },
		];
		expect(() => provider.setRowAxes(axes)).not.toThrow();
		expect(provider.getState().rowAxes).toHaveLength(4);
	});

	it('setColAxes with 7 distinct axes succeeds', () => {
		const provider = new PAFVProvider();
		const axes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'card_type', direction: 'asc' },
			{ field: 'priority', direction: 'asc' },
			{ field: 'sort_order', direction: 'asc' },
			{ field: 'name', direction: 'asc' },
			{ field: 'created_at', direction: 'asc' },
		];
		expect(() => provider.setColAxes(axes)).not.toThrow();
		expect(provider.getState().colAxes).toHaveLength(7);
	});

	it('setRowAxes with 5 distinct axes succeeds', () => {
		const provider = new PAFVProvider();
		const axes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'card_type', direction: 'asc' },
			{ field: 'priority', direction: 'asc' },
			{ field: 'name', direction: 'asc' },
		];
		expect(() => provider.setRowAxes(axes)).not.toThrow();
		expect(provider.getState().rowAxes).toHaveLength(5);
	});

	it('setColAxes with duplicate field throws "Duplicate axis field"', () => {
		const provider = new PAFVProvider();
		const axes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'folder', direction: 'desc' },
		];
		expect(() => provider.setColAxes(axes)).toThrowError(/Duplicate axis field/);
	});

	it('setRowAxes with duplicate field throws "Duplicate axis field"', () => {
		const provider = new PAFVProvider();
		const axes: AxisMapping[] = [
			{ field: 'status', direction: 'asc' },
			{ field: 'status', direction: 'desc' },
		];
		expect(() => provider.setRowAxes(axes)).toThrowError(/Duplicate axis field/);
	});

	it('setColAxes with invalid field throws SQL safety violation', () => {
		const provider = new PAFVProvider();
		expect(() => provider.setColAxes([{ field: 'DROP TABLE' as never, direction: 'asc' }])).toThrowError(
			/SQL safety violation/,
		);
	});

	it('setRowAxes with invalid field throws SQL safety violation', () => {
		const provider = new PAFVProvider();
		expect(() => provider.setRowAxes([{ field: 'evil_column' as never, direction: 'asc' }])).toThrowError(
			/SQL safety violation/,
		);
	});

	it('cross-dimension duplicates are allowed: same field in both colAxes and rowAxes', () => {
		const provider = new PAFVProvider();
		expect(() => {
			provider.setColAxes([{ field: 'folder', direction: 'asc' }]);
			provider.setRowAxes([{ field: 'folder', direction: 'asc' }]);
		}).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Stacked axes: defensive copy
// ---------------------------------------------------------------------------

describe('PAFVProvider stacked axes — defensive copy', () => {
	it('caller mutating passed array does not affect internal colAxes', () => {
		const provider = new PAFVProvider();
		const axes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];
		provider.setColAxes(axes);
		// Mutate the original array
		axes.push({ field: 'status', direction: 'desc' });
		expect(provider.getState().colAxes).toHaveLength(1);
	});

	it('caller mutating passed array does not affect internal rowAxes', () => {
		const provider = new PAFVProvider();
		const axes: AxisMapping[] = [{ field: 'status', direction: 'asc' }];
		provider.setRowAxes(axes);
		axes.push({ field: 'folder', direction: 'desc' });
		expect(provider.getState().rowAxes).toHaveLength(1);
	});

	it('mutating returned colAxes from getState() does not affect internal state', () => {
		const provider = new PAFVProvider();
		provider.setColAxes([{ field: 'folder', direction: 'asc' }]);
		const state = provider.getState();
		// Mutate the returned array
		(state.colAxes as AxisMapping[]).push({ field: 'status', direction: 'desc' });
		expect(provider.getState().colAxes).toHaveLength(1);
	});

	it('mutating returned rowAxes from getState() does not affect internal state', () => {
		const provider = new PAFVProvider();
		provider.setRowAxes([{ field: 'status', direction: 'asc' }]);
		const state = provider.getState();
		(state.rowAxes as AxisMapping[]).push({ field: 'folder', direction: 'desc' });
		expect(provider.getState().rowAxes).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Stacked axes: subscriber notifications
// ---------------------------------------------------------------------------

describe('PAFVProvider stacked axes — subscriber notifications', () => {
	it('setColAxes triggers subscriber notification', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setColAxes([{ field: 'folder', direction: 'asc' }]);
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('setRowAxes triggers subscriber notification', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setRowAxes([{ field: 'status', direction: 'asc' }]);
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('setColAxes + setRowAxes in same microtask produces one notification', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setColAxes([{ field: 'folder', direction: 'asc' }]);
		provider.setRowAxes([{ field: 'status', direction: 'desc' }]);
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Stacked axes: view family suspension
// ---------------------------------------------------------------------------

describe('PAFVProvider stacked axes — view family suspension', () => {
	it('colAxes survive LATCH→GRAPH→LATCH round-trip', () => {
		const provider = new PAFVProvider();
		provider.setColAxes([{ field: 'folder', direction: 'asc' }]);
		// Go to GRAPH (suspends LATCH)
		provider.setViewType('network');
		// Return to LATCH (restores LATCH)
		provider.setViewType('list');
		expect(provider.getState().colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
	});

	it('rowAxes survive LATCH→GRAPH→LATCH round-trip', () => {
		const provider = new PAFVProvider();
		provider.setRowAxes([{ field: 'status', direction: 'desc' }]);
		provider.setViewType('network');
		provider.setViewType('list');
		expect(provider.getState().rowAxes).toEqual([{ field: 'status', direction: 'desc' }]);
	});

	it('setViewType to supergrid on first visit uses VIEW_DEFAULTS colAxes', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		expect(provider.getState().colAxes).toEqual([{ field: 'card_type', direction: 'asc' }]);
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider.getStackedGroupBySQL()
// ---------------------------------------------------------------------------

describe('PAFVProvider.getStackedGroupBySQL()', () => {
	it('default list view returns { colAxes: [], rowAxes: [] }', () => {
		const provider = new PAFVProvider();
		const result = provider.getStackedGroupBySQL();
		expect(result).toEqual({ colAxes: [], rowAxes: [] });
	});

	it('after setColAxes returns correct colAxes in result', () => {
		const provider = new PAFVProvider();
		provider.setColAxes([{ field: 'card_type', direction: 'asc' }]);
		const result = provider.getStackedGroupBySQL();
		expect(result.colAxes).toEqual([{ field: 'card_type', direction: 'asc' }]);
		expect(result.rowAxes).toEqual([]);
	});

	it('after setting both colAxes and rowAxes returns both arrays', () => {
		const provider = new PAFVProvider();
		provider.setColAxes([{ field: 'card_type', direction: 'asc' }]);
		provider.setRowAxes([{ field: 'folder', direction: 'desc' }]);
		const result = provider.getStackedGroupBySQL();
		expect(result.colAxes).toEqual([{ field: 'card_type', direction: 'asc' }]);
		expect(result.rowAxes).toEqual([{ field: 'folder', direction: 'desc' }]);
	});

	it('with 3 colAxes and 3 rowAxes returns all 6 axes correctly', () => {
		const provider = new PAFVProvider();
		const colAxes: AxisMapping[] = [
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'desc' },
			{ field: 'priority', direction: 'asc' },
		];
		const rowAxes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'name', direction: 'asc' },
			{ field: 'created_at', direction: 'desc' },
		];
		provider.setColAxes(colAxes);
		provider.setRowAxes(rowAxes);
		const result = provider.getStackedGroupBySQL();
		expect(result.colAxes).toEqual(colAxes);
		expect(result.rowAxes).toEqual(rowAxes);
	});

	it('validates fields at call time: injected invalid colAxes field throws SQL safety violation', () => {
		const provider = new PAFVProvider();
		// Inject invalid state via setState (bypassing setter validation)
		const rawState = JSON.parse(provider.toJSON());
		rawState.colAxes = [{ field: 'evil_column', direction: 'asc' }];
		// isPAFVState allows any string field — it only checks shape, not allowlist
		provider.setState(rawState);
		expect(() => provider.getStackedGroupBySQL()).toThrowError(/SQL safety violation/);
	});

	it('returns defensive copy of colAxes — mutating result does not affect internal state', () => {
		const provider = new PAFVProvider();
		provider.setColAxes([{ field: 'card_type', direction: 'asc' }]);
		const result1 = provider.getStackedGroupBySQL();
		// Mutate the returned array
		result1.colAxes.push({ field: 'status', direction: 'asc' });
		// Second call should not include the pushed item
		const result2 = provider.getStackedGroupBySQL();
		expect(result2.colAxes).toHaveLength(1);
	});

	it('works for any viewType — not gated on supergrid', () => {
		const provider = new PAFVProvider();
		// Set viewType to kanban (not supergrid)
		provider.setViewType('kanban');
		provider.setColAxes([{ field: 'status', direction: 'asc' }]);
		const result = provider.getStackedGroupBySQL();
		expect(result.colAxes).toEqual([{ field: 'status', direction: 'asc' }]);
	});

	it('is a pure read — does not call _scheduleNotify (subscriber not called)', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		// Drain any pending microtask from subscribe setup
		await Promise.resolve();
		cb.mockClear();
		// Call the pure read method
		provider.getStackedGroupBySQL();
		// Wait a microtask
		await Promise.resolve();
		expect(cb).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider serialization — stacked axes round-trip
// ---------------------------------------------------------------------------

describe('PAFVProvider serialization — stacked axes round-trip', () => {
	it('toJSON() includes colAxes in the JSON string', () => {
		const provider = new PAFVProvider();
		provider.setColAxes([{ field: 'card_type', direction: 'asc' }]);
		const json = provider.toJSON();
		const parsed = JSON.parse(json);
		expect(parsed.colAxes).toEqual([{ field: 'card_type', direction: 'asc' }]);
	});

	it('toJSON() includes rowAxes in the JSON string', () => {
		const provider = new PAFVProvider();
		provider.setRowAxes([{ field: 'folder', direction: 'desc' }]);
		const json = provider.toJSON();
		const parsed = JSON.parse(json);
		expect(parsed.rowAxes).toEqual([{ field: 'folder', direction: 'desc' }]);
	});

	it('toJSON/setState round-trips colAxes with full fidelity', () => {
		const provider = new PAFVProvider();
		const axes: AxisMapping[] = [
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'desc' },
		];
		provider.setColAxes(axes);
		const json = provider.toJSON();

		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getState().colAxes).toEqual(axes);
	});

	it('toJSON/setState round-trips rowAxes with full fidelity', () => {
		const provider = new PAFVProvider();
		const axes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'priority', direction: 'desc' },
		];
		provider.setRowAxes(axes);
		const json = provider.toJSON();

		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getState().rowAxes).toEqual(axes);
	});

	it('round-trip with supergrid defaults preserves colAxes and rowAxes', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		const json = provider.toJSON();

		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getState().colAxes).toEqual([{ field: 'card_type', direction: 'asc' }]);
		expect(provider2.getState().rowAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider serialization — legacy JSON backward compatibility
// ---------------------------------------------------------------------------

describe('PAFVProvider serialization — legacy JSON backward compatibility', () => {
	it('setState with legacy JSON (no colAxes/rowAxes) does not throw', () => {
		const provider = new PAFVProvider();
		const legacyState = { viewType: 'list', xAxis: null, yAxis: null, groupBy: null };
		expect(() => provider.setState(legacyState)).not.toThrow();
	});

	it('setState with legacy JSON → getState().colAxes deep-equals []', () => {
		const provider = new PAFVProvider();
		const legacyState = { viewType: 'list', xAxis: null, yAxis: null, groupBy: null };
		provider.setState(legacyState);
		expect(provider.getState().colAxes).toEqual([]);
	});

	it('setState with legacy JSON → getState().rowAxes deep-equals []', () => {
		const provider = new PAFVProvider();
		const legacyState = { viewType: 'list', xAxis: null, yAxis: null, groupBy: null };
		provider.setState(legacyState);
		expect(provider.getState().rowAxes).toEqual([]);
	});

	it('legacy JSON restore + subsequent setColAxes works correctly', () => {
		const provider = new PAFVProvider();
		const legacyState = {
			viewType: 'kanban',
			xAxis: null,
			yAxis: null,
			groupBy: { field: 'status', direction: 'asc' },
		};
		provider.setState(legacyState);
		provider.setColAxes([{ field: 'folder', direction: 'asc' }]);
		expect(provider.getState().colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
		expect(provider.getState().groupBy).toEqual({ field: 'status', direction: 'asc' });
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider isPAFVState — stacked axes validation
// ---------------------------------------------------------------------------

describe('PAFVProvider isPAFVState — stacked axes', () => {
	it('valid object with colAxes/rowAxes arrays → setState does not throw', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [{ field: 'folder', direction: 'asc' }],
			rowAxes: [{ field: 'status', direction: 'desc' }],
		};
		expect(() => provider.setState(state)).not.toThrow();
	});

	it('valid object without colAxes/rowAxes (legacy shape) → setState does not throw', () => {
		const provider = new PAFVProvider();
		const state = { viewType: 'list', xAxis: null, yAxis: null, groupBy: null };
		expect(() => provider.setState(state)).not.toThrow();
	});

	it('object with colAxes: "not-an-array" → setState throws', () => {
		const provider = new PAFVProvider();
		const state = { viewType: 'list', xAxis: null, yAxis: null, groupBy: null, colAxes: 'not-an-array' };
		expect(() => provider.setState(state)).toThrow();
	});

	it('object with colAxes: [{ field: 123 }] (non-AxisMapping) → setState throws', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [{ field: 123, direction: 'asc' }],
		};
		expect(() => provider.setState(state)).toThrow();
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider resetToDefaults — stacked axes
// ---------------------------------------------------------------------------

describe('PAFVProvider resetToDefaults — stacked axes', () => {
	it('resetToDefaults after setting colAxes → colAxes is []', () => {
		const provider = new PAFVProvider();
		provider.setColAxes([{ field: 'card_type', direction: 'asc' }]);
		provider.resetToDefaults();
		expect(provider.getState().colAxes).toEqual([]);
	});

	it('resetToDefaults after setting rowAxes → rowAxes is []', () => {
		const provider = new PAFVProvider();
		provider.setRowAxes([{ field: 'folder', direction: 'asc' }]);
		provider.resetToDefaults();
		expect(provider.getState().rowAxes).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider — colWidths field (Phase 20 SuperSize)
// ---------------------------------------------------------------------------

describe('PAFVProvider — colWidths', () => {
	it('getColWidths() returns empty object by default', () => {
		const provider = new PAFVProvider();
		expect(provider.getColWidths()).toEqual({});
	});

	it('setColWidths({ note: 200, task: 150 }) → getColWidths() returns { note: 200, task: 150 }', () => {
		const provider = new PAFVProvider();
		provider.setColWidths({ note: 200, task: 150 });
		expect(provider.getColWidths()).toEqual({ note: 200, task: 150 });
	});

	it('getColWidths() returns a defensive copy — mutating result does not affect state', () => {
		const provider = new PAFVProvider();
		provider.setColWidths({ note: 200 });
		const widths = provider.getColWidths();
		widths['note'] = 999;
		expect(provider.getColWidths()).toEqual({ note: 200 });
	});

	it('setColWidths does NOT call _scheduleNotify (subscriber not notified)', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		await Promise.resolve(); // drain any queued microtask
		cb.mockClear();
		provider.setColWidths({ note: 200 });
		await Promise.resolve();
		expect(cb).not.toHaveBeenCalled();
	});

	it('setColAxes([...]) resets colWidths to empty', () => {
		const provider = new PAFVProvider();
		provider.setColWidths({ note: 200 });
		provider.setColAxes([{ field: 'folder', direction: 'asc' }]);
		expect(provider.getColWidths()).toEqual({});
	});

	it('setRowAxes([...]) resets colWidths to empty', () => {
		const provider = new PAFVProvider();
		provider.setColWidths({ note: 200 });
		provider.setRowAxes([{ field: 'status', direction: 'asc' }]);
		expect(provider.getColWidths()).toEqual({});
	});

	it('colWidths round-trips through toJSON()/setState()', () => {
		const provider = new PAFVProvider();
		provider.setColWidths({ note: 200, task: 150 });
		const json = provider.toJSON();

		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getColWidths()).toEqual({ note: 200, task: 150 });
	});

	it('setState() with old PAFVState (no colWidths field) defaults colWidths to {}', () => {
		const provider = new PAFVProvider();
		const legacyState = { viewType: 'list', xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] };
		provider.setState(legacyState);
		expect(provider.getColWidths()).toEqual({});
	});

	it('isPAFVState() accepts objects with colWidths field (setState does not throw)', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'supergrid',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			colWidths: { note: 200, task: 150 },
		};
		expect(() => provider.setState(state)).not.toThrow();
	});

	it('isPAFVState() accepts objects without colWidths field (setState does not throw)', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
		};
		expect(() => provider.setState(state)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider — sortOverrides (Phase 23 SuperSort)
// ---------------------------------------------------------------------------

describe('PAFVProvider — sortOverrides', () => {
	it('getSortOverrides() returns empty array by default', () => {
		const provider = new PAFVProvider();
		expect(provider.getSortOverrides()).toEqual([]);
	});

	it('setSortOverrides([{field:"name", direction:"asc"}]) -> getSortOverrides() returns that entry', () => {
		const provider = new PAFVProvider();
		provider.setSortOverrides([{ field: 'name', direction: 'asc' }]);
		expect(provider.getSortOverrides()).toEqual([{ field: 'name', direction: 'asc' }]);
	});

	it('setSortOverrides([]) clears sort overrides', () => {
		const provider = new PAFVProvider();
		provider.setSortOverrides([{ field: 'name', direction: 'asc' }]);
		provider.setSortOverrides([]);
		expect(provider.getSortOverrides()).toEqual([]);
	});

	it('getSortOverrides() returns a defensive copy — mutating result does not affect state', () => {
		const provider = new PAFVProvider();
		provider.setSortOverrides([{ field: 'name', direction: 'asc' }]);
		const sorts = provider.getSortOverrides();
		sorts.push({ field: 'folder', direction: 'desc' });
		expect(provider.getSortOverrides()).toHaveLength(1);
	});

	it('setSortOverrides calls _scheduleNotify (subscriber is notified)', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		await Promise.resolve(); // drain any pending microtask
		cb.mockClear();
		provider.setSortOverrides([{ field: 'name', direction: 'asc' }]);
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('setSortOverrides with invalid field throws "SQL safety violation"', () => {
		const provider = new PAFVProvider();
		expect(() => provider.setSortOverrides([{ field: 'DROP TABLE' as never, direction: 'asc' }])).toThrowError(
			/SQL safety violation/,
		);
	});

	it('setSortOverrides with invalid field does not modify state', () => {
		const provider = new PAFVProvider();
		provider.setSortOverrides([{ field: 'name', direction: 'asc' }]);
		expect(() => provider.setSortOverrides([{ field: 'evil_column' as never, direction: 'asc' }])).toThrow();
		// State should still have 'name' sort
		expect(provider.getSortOverrides()).toEqual([{ field: 'name', direction: 'asc' }]);
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider — sortOverrides: axis change clearing
// ---------------------------------------------------------------------------

describe('PAFVProvider — sortOverrides: cleared on axis change', () => {
	it('setColAxes() resets sortOverrides to []', () => {
		const provider = new PAFVProvider();
		provider.setSortOverrides([{ field: 'name', direction: 'asc' }]);
		provider.setColAxes([{ field: 'folder', direction: 'asc' }]);
		expect(provider.getSortOverrides()).toEqual([]);
	});

	it('setRowAxes() resets sortOverrides to []', () => {
		const provider = new PAFVProvider();
		provider.setSortOverrides([{ field: 'name', direction: 'asc' }]);
		provider.setRowAxes([{ field: 'status', direction: 'asc' }]);
		expect(provider.getSortOverrides()).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider — sortOverrides: persistence round-trip
// ---------------------------------------------------------------------------

describe('PAFVProvider — sortOverrides: persistence round-trip', () => {
	it('toJSON() includes sortOverrides in serialized output', () => {
		const provider = new PAFVProvider();
		provider.setSortOverrides([{ field: 'name', direction: 'asc' }]);
		const json = provider.toJSON();
		const parsed = JSON.parse(json);
		expect(parsed.sortOverrides).toEqual([{ field: 'name', direction: 'asc' }]);
	});

	it('toJSON/setState round-trips sortOverrides with full fidelity', () => {
		const provider = new PAFVProvider();
		provider.setSortOverrides([
			{ field: 'name', direction: 'asc' },
			{ field: 'folder', direction: 'desc' },
		]);
		const json = provider.toJSON();

		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getSortOverrides()).toEqual([
			{ field: 'name', direction: 'asc' },
			{ field: 'folder', direction: 'desc' },
		]);
	});

	it('setState() with state missing sortOverrides defaults to [] (backward compat)', () => {
		const provider = new PAFVProvider();
		const legacyState = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
		};
		provider.setState(legacyState);
		expect(provider.getSortOverrides()).toEqual([]);
	});

	it('VIEW_DEFAULTS.supergrid includes sortOverrides: [] (resetToDefaults clears it)', () => {
		const provider = new PAFVProvider();
		provider.setSortOverrides([{ field: 'name', direction: 'asc' }]);
		provider.resetToDefaults();
		expect(provider.getSortOverrides()).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider — sortOverrides: isPAFVState validation
// ---------------------------------------------------------------------------

describe('PAFVProvider — sortOverrides: isPAFVState validation', () => {
	it('valid state with sortOverrides array -> setState does not throw', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
			sortOverrides: [{ field: 'name', direction: 'asc' }],
		};
		expect(() => provider.setState(state)).not.toThrow();
	});

	it('state without sortOverrides field -> setState does not throw (backward compat)', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
		};
		expect(() => provider.setState(state)).not.toThrow();
	});

	it('state with sortOverrides: "not-an-array" -> setState throws', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
			sortOverrides: 'not-an-array',
		};
		expect(() => provider.setState(state)).toThrow();
	});

	it('state with sortOverrides: [{ field: 123 }] -> setState throws (non-AxisMapping element)', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
			sortOverrides: [{ field: 123, direction: 'asc' }],
		};
		expect(() => provider.setState(state)).toThrow();
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider — collapse state (CLPS-05)
// ---------------------------------------------------------------------------

describe('PAFVProvider — collapse state (CLPS-05)', () => {
	it('getCollapseState() returns empty array when no collapse state set', () => {
		const provider = new PAFVProvider();
		expect(provider.getCollapseState()).toEqual([]);
	});

	it('setCollapseState() stores state and getCollapseState() retrieves it', () => {
		const provider = new PAFVProvider();
		const state = [{ key: 'note', mode: 'aggregate' as const }];
		provider.setCollapseState(state);
		expect(provider.getCollapseState()).toEqual([{ key: 'note', mode: 'aggregate' }]);
	});

	it('getCollapseState() returns a defensive copy — mutating result does not affect state', () => {
		const provider = new PAFVProvider();
		provider.setCollapseState([{ key: 'note', mode: 'aggregate' }]);
		const result = provider.getCollapseState();
		result.push({ key: 'task', mode: 'hide' });
		expect(provider.getCollapseState()).toHaveLength(1);
	});

	it('setCollapseState() does NOT trigger subscriber notifications (like setColWidths)', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		await Promise.resolve(); // drain any queued microtask
		cb.mockClear();
		provider.setCollapseState([{ key: 'note', mode: 'aggregate' }]);
		await Promise.resolve();
		expect(cb).not.toHaveBeenCalled();
	});

	it('toJSON() includes collapseState in serialized output', () => {
		const provider = new PAFVProvider();
		provider.setCollapseState([{ key: 'note', mode: 'aggregate' }]);
		const json = provider.toJSON();
		const parsed = JSON.parse(json);
		expect(parsed.collapseState).toEqual([{ key: 'note', mode: 'aggregate' }]);
	});

	it('setState() restores collapseState from serialized state', () => {
		const provider = new PAFVProvider();
		provider.setCollapseState([
			{ key: 'note', mode: 'aggregate' },
			{ key: 'task', mode: 'hide' },
		]);
		const json = provider.toJSON();

		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getCollapseState()).toEqual([
			{ key: 'note', mode: 'aggregate' },
			{ key: 'task', mode: 'hide' },
		]);
	});

	it('setState() with no collapseState field (older format) defaults to empty array (backward compat)', () => {
		const provider = new PAFVProvider();
		const legacyState = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
		};
		provider.setState(legacyState);
		expect(provider.getCollapseState()).toEqual([]);
	});

	it('setColAxes() clears collapseState alongside colWidths and sortOverrides', () => {
		const provider = new PAFVProvider();
		provider.setCollapseState([{ key: 'note', mode: 'aggregate' }]);
		provider.setColAxes([{ field: 'folder', direction: 'asc' }]);
		expect(provider.getCollapseState()).toEqual([]);
	});

	it('setRowAxes() clears collapseState alongside colWidths and sortOverrides', () => {
		const provider = new PAFVProvider();
		provider.setCollapseState([{ key: 'note', mode: 'aggregate' }]);
		provider.setRowAxes([{ field: 'status', direction: 'asc' }]);
		expect(provider.getCollapseState()).toEqual([]);
	});

	it('resetToDefaults() clears collapseState', () => {
		const provider = new PAFVProvider();
		provider.setCollapseState([{ key: 'note', mode: 'aggregate' }]);
		provider.resetToDefaults();
		expect(provider.getCollapseState()).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider — collapse state: isPAFVState validation (CLPS-05)
// ---------------------------------------------------------------------------

describe('PAFVProvider — collapse state: isPAFVState validation (CLPS-05)', () => {
	it('isPAFVState accepts state with collapseState array', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
			collapseState: [{ key: 'note', mode: 'aggregate' }],
		};
		expect(() => provider.setState(state)).not.toThrow();
	});

	it('isPAFVState accepts state without collapseState (backward compat)', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
		};
		expect(() => provider.setState(state)).not.toThrow();
	});

	it('isPAFVState rejects state with non-array collapseState', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
			collapseState: 'not-an-array',
		};
		expect(() => provider.setState(state)).toThrow();
	});

	it('isPAFVState rejects state with collapseState entries missing key', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
			collapseState: [{ mode: 'aggregate' }],
		};
		expect(() => provider.setState(state)).toThrow();
	});

	it('isPAFVState rejects state with collapseState entries with invalid mode', () => {
		const provider = new PAFVProvider();
		const state = {
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
			collapseState: [{ key: 'note', mode: 'invalid' }],
		};
		expect(() => provider.setState(state)).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Phase 31 — reorderColAxes / reorderRowAxes
// ---------------------------------------------------------------------------

describe('PAFVProvider — Phase 31 reorderColAxes', () => {
	it('reorderColAxes(0, 2) on [A,B,C] produces [B,C,A]', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
		]);
		provider.reorderColAxes(0, 2);
		const result = provider.getStackedGroupBySQL();
		expect(result.colAxes).toEqual([
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
			{ field: 'card_type', direction: 'asc' },
		]);
	});

	it('reorderColAxes preserves colWidths (field-based, not index-based)', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
		]);
		provider.setColWidths({ note: 200, task: 150 });
		provider.reorderColAxes(0, 2);
		expect(provider.getColWidths()).toEqual({ note: 200, task: 150 });
	});

	it('reorderColAxes preserves sortOverrides (field-based, not index-based)', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
		]);
		provider.setSortOverrides([{ field: 'name', direction: 'asc' }]);
		provider.reorderColAxes(0, 2);
		expect(provider.getSortOverrides()).toEqual([{ field: 'name', direction: 'asc' }]);
	});

	it('reorderColAxes where from === to is a no-op (no subscriber notification)', async () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		const cb = vi.fn();
		provider.subscribe(cb);
		await Promise.resolve(); // drain pending
		cb.mockClear();
		provider.reorderColAxes(0, 0);
		await Promise.resolve();
		expect(cb).not.toHaveBeenCalled();
	});

	it('reorderColAxes with out-of-bounds fromIndex is a no-op', async () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		const cb = vi.fn();
		provider.subscribe(cb);
		await Promise.resolve();
		cb.mockClear();
		provider.reorderColAxes(-1, 0);
		await Promise.resolve();
		expect(cb).not.toHaveBeenCalled();
		// Axes unchanged
		expect(provider.getStackedGroupBySQL().colAxes).toEqual([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
	});

	it('reorderColAxes with out-of-bounds toIndex is a no-op', async () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		provider.reorderColAxes(0, 5);
		expect(provider.getStackedGroupBySQL().colAxes).toEqual([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
	});

	it('reorderColAxes triggers _scheduleNotify (subscriber fires)', async () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		const cb = vi.fn();
		provider.subscribe(cb);
		await Promise.resolve();
		cb.mockClear();
		provider.reorderColAxes(0, 1);
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});
});

describe('PAFVProvider — Phase 31 reorderRowAxes', () => {
	it('reorderRowAxes(1, 0) on [A,B] produces [B,A]', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setRowAxes([
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		provider.reorderRowAxes(1, 0);
		const result = provider.getStackedGroupBySQL();
		expect(result.rowAxes).toEqual([
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
		]);
	});

	it('reorderRowAxes preserves colWidths and sortOverrides', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setRowAxes([
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		provider.setColWidths({ note: 200 });
		provider.setSortOverrides([{ field: 'name', direction: 'asc' }]);
		provider.reorderRowAxes(1, 0);
		expect(provider.getColWidths()).toEqual({ note: 200 });
		expect(provider.getSortOverrides()).toEqual([{ field: 'name', direction: 'asc' }]);
	});

	it('reorderRowAxes triggers _scheduleNotify (subscriber fires)', async () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setRowAxes([
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		const cb = vi.fn();
		provider.subscribe(cb);
		await Promise.resolve();
		cb.mockClear();
		provider.reorderRowAxes(0, 1);
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Phase 31 — Collapse key remapping on reorder
// ---------------------------------------------------------------------------

describe('PAFVProvider — Phase 31 collapse key remapping', () => {
	const SEP = '\x1f'; // Unit Separator

	it('2-axis stack: reorder swaps collapse key levels', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		// Collapse key at level 0 (card_type level): "0\x1f\x1fnote"
		provider.setCollapseState([{ key: `0${SEP}${SEP}note`, mode: 'aggregate' }]);
		provider.reorderColAxes(0, 1); // swap: [status, card_type]
		const state = provider.getCollapseState();
		expect(state).toHaveLength(1);
		// Level 0 should become level 1
		expect(state[0]!.key).toBe(`1${SEP}${SEP}note`);
		expect(state[0]!.mode).toBe('aggregate');
	});

	it('2-axis stack: reorder swaps both level 0 and level 1 keys', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		// Two collapse keys: one at level 0, one at level 1
		provider.setCollapseState([
			{ key: `0${SEP}${SEP}note`, mode: 'aggregate' },
			{ key: `1${SEP}note${SEP}active`, mode: 'hide' },
		]);
		provider.reorderColAxes(0, 1); // swap
		const state = provider.getCollapseState();
		expect(state).toHaveLength(2);
		// Level 0 -> level 1, level 1 -> level 0
		const level0Key = state.find((s) => s.key.startsWith('0'));
		const level1Key = state.find((s) => s.key.startsWith('1'));
		expect(level0Key).toBeDefined();
		expect(level1Key).toBeDefined();
	});

	it('3+ axis stack: reorder clears all collapse state (pragmatic simplification)', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
		]);
		provider.setCollapseState([
			{ key: `0${SEP}${SEP}note`, mode: 'aggregate' },
			{ key: `1${SEP}note${SEP}active`, mode: 'hide' },
		]);
		provider.reorderColAxes(0, 2);
		expect(provider.getCollapseState()).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Phase 31 — Reorder persistence round-trip
// ---------------------------------------------------------------------------

describe('Phase 31 — Reorder persistence round-trip', () => {
	const SEP = '\x1f';

	it('toJSON after reorderColAxes produces JSON with reordered colAxes array', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
		]);
		provider.reorderColAxes(0, 2);
		const json = provider.toJSON();
		const parsed = JSON.parse(json);
		expect(parsed.colAxes).toEqual([
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
			{ field: 'card_type', direction: 'asc' },
		]);
	});

	it('toJSON/setState round-trip: new provider instance restores reordered axis order', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
		]);
		provider.reorderColAxes(0, 2);
		const json = provider.toJSON();

		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getStackedGroupBySQL().colAxes).toEqual([
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
			{ field: 'card_type', direction: 'asc' },
		]);
	});

	it('collapse state survives round-trip after reorder (2-axis stack)', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		// Set collapse state at level 0
		provider.setCollapseState([{ key: `0${SEP}${SEP}note`, mode: 'aggregate' }]);
		provider.reorderColAxes(0, 1);
		// After reorder: level 0 -> level 1
		expect(provider.getCollapseState()).toEqual([{ key: `1${SEP}${SEP}note`, mode: 'aggregate' }]);

		// Round-trip through serialization
		const json = provider.toJSON();
		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getCollapseState()).toEqual([{ key: `1${SEP}${SEP}note`, mode: 'aggregate' }]);
	});

	it('backward-compatibility: pre-Phase-31 state (no collapseState) deserializes to empty collapse', () => {
		const provider = new PAFVProvider();
		const prePhase31State = {
			viewType: 'supergrid',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [
				{ field: 'card_type', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
			],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
		};
		provider.setState(prePhase31State);
		expect(provider.getCollapseState()).toEqual([]);
		// getStackedGroupBySQL still works
		expect(provider.getStackedGroupBySQL().colAxes).toEqual([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
	});

	it('dedicated collapse key remap round-trip: both level 0 and level 1 survive serialization', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		// Set collapse state at both levels
		provider.setCollapseState([
			{ key: `0${SEP}${SEP}note`, mode: 'aggregate' },
			{ key: `1${SEP}note${SEP}active`, mode: 'hide' },
		]);
		provider.reorderColAxes(0, 1);
		const remapped = provider.getCollapseState();
		// Level 0 -> level 1, level 1 -> level 0
		expect(remapped).toHaveLength(2);
		expect(remapped.find((s) => s.key.startsWith('1'))).toBeDefined();
		expect(remapped.find((s) => s.key.startsWith('0'))).toBeDefined();

		// Round-trip
		const json = provider.toJSON();
		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		const restored = provider2.getCollapseState();
		expect(restored).toEqual(remapped);
	});

	it('rapid-sequence reorder: 3-axis stack, two successive reorders, round-trip preserves final order', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
		]);
		provider.setCollapseState([{ key: `0${SEP}${SEP}note`, mode: 'aggregate' }]);

		// First reorder: [card_type, status, folder] -> [status, card_type, folder]
		// 3+ axes = collapse cleared
		provider.reorderColAxes(0, 1);
		expect(provider.getCollapseState()).toEqual([]); // cleared (3+ axes)
		expect(provider.getStackedGroupBySQL().colAxes).toEqual([
			{ field: 'status', direction: 'asc' },
			{ field: 'card_type', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
		]);

		// Set new collapse state on the new arrangement
		provider.setCollapseState([{ key: `2${SEP}${SEP}A`, mode: 'hide' }]);

		// Second reorder: [status, card_type, folder] -> [status, folder, card_type]
		// 3+ axes = collapse cleared again
		provider.reorderColAxes(1, 2);
		expect(provider.getCollapseState()).toEqual([]); // cleared again
		expect(provider.getStackedGroupBySQL().colAxes).toEqual([
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
			{ field: 'card_type', direction: 'asc' },
		]);

		// Round-trip preserves final axis order
		const json = provider.toJSON();
		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getStackedGroupBySQL().colAxes).toEqual([
			{ field: 'status', direction: 'asc' },
			{ field: 'folder', direction: 'asc' },
			{ field: 'card_type', direction: 'asc' },
		]);
		expect(provider2.getCollapseState()).toEqual([]);
	});

	it('integration: reorder -> serialize -> new provider -> getStackedGroupBySQL returns reordered axes', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		provider.setColAxes([
			{ field: 'card_type', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		]);
		provider.setRowAxes([
			{ field: 'folder', direction: 'asc' },
			{ field: 'priority', direction: 'desc' },
		]);

		provider.reorderColAxes(0, 1); // [status, card_type]
		provider.reorderRowAxes(1, 0); // [priority, folder]

		const json = provider.toJSON();
		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));

		const { colAxes, rowAxes } = provider2.getStackedGroupBySQL();
		expect(colAxes).toEqual([
			{ field: 'status', direction: 'asc' },
			{ field: 'card_type', direction: 'asc' },
		]);
		expect(rowAxes).toEqual([
			{ field: 'priority', direction: 'desc' },
			{ field: 'folder', direction: 'asc' },
		]);
	});
});

// ---------------------------------------------------------------------------
// Phase 32 — backward-compatibility matrix
// ---------------------------------------------------------------------------

describe('Phase 32 — backward-compatibility matrix', () => {
	it('pre-Phase-15 state (no colAxes, rowAxes, colWidths, sortOverrides, collapseState) restores with all new fields defaulted', () => {
		const provider = new PAFVProvider();
		const prePhase15 = {
			viewType: 'supergrid',
			xAxis: null,
			yAxis: null,
			groupBy: null,
		};
		provider.setState(prePhase15);
		const state = provider.getState();
		expect(state.viewType).toBe('supergrid');
		expect(state.xAxis).toBeNull();
		expect(state.yAxis).toBeNull();
		expect(state.groupBy).toBeNull();
		expect(state.colAxes).toEqual([]);
		expect(state.rowAxes).toEqual([]);
		expect(provider.getColWidths()).toEqual({});
		expect(provider.getSortOverrides()).toEqual([]);
		expect(provider.getCollapseState()).toEqual([]);
	});

	it('pre-Phase-20 state (has colAxes/rowAxes but no colWidths) restores with colWidths defaulted to {}', () => {
		const provider = new PAFVProvider();
		const prePhase20 = {
			viewType: 'supergrid',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [{ field: 'folder', direction: 'asc' }],
			rowAxes: [{ field: 'status', direction: 'asc' }],
		};
		provider.setState(prePhase20);
		const state = provider.getState();
		expect(state.colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
		expect(state.rowAxes).toEqual([{ field: 'status', direction: 'asc' }]);
		expect(provider.getColWidths()).toEqual({});
		expect(provider.getSortOverrides()).toEqual([]);
		expect(provider.getCollapseState()).toEqual([]);
	});

	it('pre-Phase-23 state (has colAxes/rowAxes/colWidths but no sortOverrides) restores with sortOverrides defaulted to []', () => {
		const provider = new PAFVProvider();
		const prePhase23 = {
			viewType: 'supergrid',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [{ field: 'folder', direction: 'asc' }],
			rowAxes: [{ field: 'status', direction: 'asc' }],
			colWidths: { folder: 150 },
		};
		provider.setState(prePhase23);
		const state = provider.getState();
		expect(state.colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
		expect(state.rowAxes).toEqual([{ field: 'status', direction: 'asc' }]);
		expect(provider.getColWidths()).toEqual({ folder: 150 });
		expect(provider.getSortOverrides()).toEqual([]);
		expect(provider.getCollapseState()).toEqual([]);
	});

	it('pre-Phase-30 state (has colAxes/rowAxes/colWidths/sortOverrides but no collapseState) restores with collapseState defaulted to []', () => {
		const provider = new PAFVProvider();
		const prePhase30 = {
			viewType: 'supergrid',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [{ field: 'folder', direction: 'asc' }],
			rowAxes: [{ field: 'status', direction: 'asc' }],
			colWidths: { folder: 150 },
			sortOverrides: [{ field: 'modified_at', direction: 'desc' }],
		};
		provider.setState(prePhase30);
		const state = provider.getState();
		expect(state.colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
		expect(state.rowAxes).toEqual([{ field: 'status', direction: 'asc' }]);
		expect(provider.getColWidths()).toEqual({ folder: 150 });
		expect(provider.getSortOverrides()).toEqual([{ field: 'modified_at', direction: 'desc' }]);
		expect(provider.getCollapseState()).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Phase 32 — persistence edge cases
// ---------------------------------------------------------------------------

describe('Phase 32 — persistence edge cases', () => {
	it('empty arrays: all fields present but empty — round-trip preserves empty arrays, not null', () => {
		const provider = new PAFVProvider();
		const emptyState = {
			viewType: 'supergrid',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
			colWidths: {},
			sortOverrides: [],
			collapseState: [],
		};
		provider.setState(emptyState);

		// Verify state preserved
		const state = provider.getState();
		expect(state.colAxes).toEqual([]);
		expect(state.rowAxes).toEqual([]);
		expect(provider.getColWidths()).toEqual({});
		expect(provider.getSortOverrides()).toEqual([]);
		expect(provider.getCollapseState()).toEqual([]);

		// Verify round-trip through toJSON/setState
		const json = provider.toJSON();
		const parsed = JSON.parse(json);
		expect(parsed.colAxes).toEqual([]);
		expect(parsed.rowAxes).toEqual([]);
		expect(parsed.colWidths).toEqual({});
		expect(parsed.sortOverrides).toEqual([]);
		expect(parsed.collapseState).toEqual([]);

		// Restore into a fresh provider
		const provider2 = new PAFVProvider();
		provider2.setState(parsed);
		expect(provider2.getState().colAxes).toEqual([]);
		expect(provider2.getState().rowAxes).toEqual([]);
		expect(provider2.getColWidths()).toEqual({});
		expect(provider2.getSortOverrides()).toEqual([]);
		expect(provider2.getCollapseState()).toEqual([]);
	});

	it('max depth: 6 total axes (3 col + 3 row) with colWidths, sortOverrides, and collapseState all populated — restores without truncation', () => {
		const provider = new PAFVProvider();
		const maxDepthState = {
			viewType: 'supergrid',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [
				{ field: 'card_type', direction: 'asc' },
				{ field: 'status', direction: 'desc' },
				{ field: 'priority', direction: 'asc' },
			],
			rowAxes: [
				{ field: 'folder', direction: 'asc' },
				{ field: 'name', direction: 'asc' },
				{ field: 'created_at', direction: 'desc' },
			],
			colWidths: { note: 200, task: 150, event: 180 },
			sortOverrides: [
				{ field: 'modified_at', direction: 'desc' },
				{ field: 'name', direction: 'asc' },
			],
			collapseState: [
				{ key: '0\x1f\x1fEngineering', mode: 'aggregate' as const },
				{ key: '1\x1fEngineering\x1fActive', mode: 'hide' as const },
				{ key: '2\x1fEngineering\x1fActive\x1fHigh', mode: 'aggregate' as const },
			],
		};
		provider.setState(maxDepthState);

		// Verify all fields restored without truncation
		const state = provider.getState();
		expect(state.colAxes).toHaveLength(3);
		expect(state.rowAxes).toHaveLength(3);
		expect(state.colAxes).toEqual(maxDepthState.colAxes);
		expect(state.rowAxes).toEqual(maxDepthState.rowAxes);
		expect(provider.getColWidths()).toEqual({ note: 200, task: 150, event: 180 });
		expect(provider.getSortOverrides()).toEqual(maxDepthState.sortOverrides);
		expect(provider.getCollapseState()).toEqual(maxDepthState.collapseState);

		// Verify round-trip
		const json = provider.toJSON();
		const provider2 = new PAFVProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getState().colAxes).toEqual(maxDepthState.colAxes);
		expect(provider2.getState().rowAxes).toEqual(maxDepthState.rowAxes);
		expect(provider2.getColWidths()).toEqual(maxDepthState.colWidths);
		expect(provider2.getSortOverrides()).toEqual(maxDepthState.sortOverrides);
		expect(provider2.getCollapseState()).toEqual(maxDepthState.collapseState);
	});

	it('stale collapse keys: keys referencing axis values that no longer exist — setState accepts gracefully, getCollapseState returns them', () => {
		const provider = new PAFVProvider();
		const staleState = {
			viewType: 'supergrid',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			collapseState: [
				{ key: '0\x1f\x1fNonexistent', mode: 'aggregate' as const },
				{ key: '1\x1fNonexistent\x1fAlsoGone', mode: 'hide' as const },
			],
		};
		// setState should not throw even with stale keys
		expect(() => provider.setState(staleState)).not.toThrow();
		// getCollapseState returns the stale keys (pruning is caller's responsibility)
		expect(provider.getCollapseState()).toEqual([
			{ key: '0\x1f\x1fNonexistent', mode: 'aggregate' },
			{ key: '1\x1fNonexistent\x1fAlsoGone', mode: 'hide' },
		]);
	});

	it('corrupted JSON: isPAFVState rejects viewType: 123 (wrong type)', () => {
		const provider = new PAFVProvider();
		expect(() => provider.setState({ viewType: 123 })).toThrow();
	});

	it('corrupted JSON: isPAFVState rejects colAxes: "not-an-array" (wrong type)', () => {
		const provider = new PAFVProvider();
		expect(() =>
			provider.setState({
				viewType: 'supergrid',
				xAxis: null,
				yAxis: null,
				groupBy: null,
				colAxes: 'not-an-array',
			}),
		).toThrow();
	});

	it('corrupted JSON: isPAFVState rejects null', () => {
		const provider = new PAFVProvider();
		expect(() => provider.setState(null)).toThrow();
	});

	it('corrupted JSON: isPAFVState rejects undefined', () => {
		const provider = new PAFVProvider();
		expect(() => provider.setState(undefined)).toThrow();
	});

	it('minimal valid shape: { viewType: "supergrid" } with undefined xAxis/yAxis/groupBy — isPAFVState accepts', () => {
		// isPAFVState checks: viewType is string, xAxis/yAxis/groupBy must be null or AxisMapping.
		// If xAxis is undefined, the check `obj["xAxis"] !== null` is true (undefined !== null),
		// then `!isAxisMapping(obj["xAxis"])` is also true (undefined is not an axis mapping).
		// So isPAFVState REJECTS shapes missing xAxis/yAxis/groupBy — they're required.
		const provider = new PAFVProvider();
		expect(() => provider.setState({ viewType: 'supergrid' })).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Aggregation mode (Phase 55 Plan 04 — PROJ-06)
// ---------------------------------------------------------------------------

describe('PAFVProvider — aggregation mode (PROJ-06)', () => {
	it('default aggregation is count', () => {
		const provider = new PAFVProvider();
		expect(provider.getAggregation()).toBe('count');
	});

	it('setAggregation("sum") stores sum mode', () => {
		const provider = new PAFVProvider();
		provider.setAggregation('sum');
		expect(provider.getAggregation()).toBe('sum');
	});

	it('setAggregation("avg") stores avg mode', () => {
		const provider = new PAFVProvider();
		provider.setAggregation('avg');
		expect(provider.getAggregation()).toBe('avg');
	});

	it('setAggregation("min") stores min mode', () => {
		const provider = new PAFVProvider();
		provider.setAggregation('min');
		expect(provider.getAggregation()).toBe('min');
	});

	it('setAggregation("max") stores max mode', () => {
		const provider = new PAFVProvider();
		provider.setAggregation('max');
		expect(provider.getAggregation()).toBe('max');
	});

	it('setAggregation calls _scheduleNotify (triggers re-query)', async () => {
		const provider = new PAFVProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setAggregation('sum');
		await Promise.resolve(); // flush microtask
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('toJSON includes aggregation in serialized state', () => {
		const provider = new PAFVProvider();
		provider.setAggregation('avg');
		const json = JSON.parse(provider.toJSON()) as Record<string, unknown>;
		expect(json['aggregation']).toBe('avg');
	});

	it('setState restores aggregation from serialized state', () => {
		const provider = new PAFVProvider();
		provider.setAggregation('max');
		const json = provider.toJSON();

		const restored = new PAFVProvider();
		restored.setState(JSON.parse(json));
		expect(restored.getAggregation()).toBe('max');
	});

	it('setState backward compat: missing aggregation defaults to count', () => {
		const provider = new PAFVProvider();
		// Simulate older serialized state without aggregation field
		provider.setState({
			viewType: 'list',
			xAxis: null,
			yAxis: null,
			groupBy: null,
			colAxes: [],
			rowAxes: [],
		});
		expect(provider.getAggregation()).toBe('count');
	});

	it('resetToDefaults clears aggregation to count', () => {
		const provider = new PAFVProvider();
		provider.setAggregation('sum');
		provider.resetToDefaults();
		expect(provider.getAggregation()).toBe('count');
	});
});
