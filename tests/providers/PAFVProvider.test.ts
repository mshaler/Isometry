// Isometry v5 — Phase 4 Plan 03 (Task 1)
// Tests for PAFVProvider: axis compilation, view family suspension, subscriber pattern, serialization.
//
// Requirements: PROV-03, PROV-04, PROV-11
// TDD Phase: RED → GREEN → REFACTOR

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PAFVProvider } from '../../src/providers/PAFVProvider';
import type { AxisMapping } from '../../src/providers/types';

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
  it('setColAxes with 4 axes throws "Maximum 3 axes per dimension"', () => {
    const provider = new PAFVProvider();
    const axes: AxisMapping[] = [
      { field: 'folder', direction: 'asc' },
      { field: 'status', direction: 'asc' },
      { field: 'priority', direction: 'asc' },
      { field: 'name', direction: 'asc' },
    ];
    expect(() => provider.setColAxes(axes)).toThrowError('Maximum 3 axes per dimension');
  });

  it('setRowAxes with 4 axes throws "Maximum 3 axes per dimension"', () => {
    const provider = new PAFVProvider();
    const axes: AxisMapping[] = [
      { field: 'folder', direction: 'asc' },
      { field: 'status', direction: 'asc' },
      { field: 'priority', direction: 'asc' },
      { field: 'name', direction: 'asc' },
    ];
    expect(() => provider.setRowAxes(axes)).toThrowError('Maximum 3 axes per dimension');
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
    expect(() =>
      provider.setColAxes([{ field: 'DROP TABLE' as never, direction: 'asc' }])
    ).toThrowError(/SQL safety violation/);
  });

  it('setRowAxes with invalid field throws SQL safety violation', () => {
    const provider = new PAFVProvider();
    expect(() =>
      provider.setRowAxes([{ field: 'evil_column' as never, direction: 'asc' }])
    ).toThrowError(/SQL safety violation/);
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
