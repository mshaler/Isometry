// Isometry v5 — Phase 4 Plan 07 (Task 2)
// Full Tier 2 persistence integration test.
//
// Purpose: Verify the complete ui_state round-trip:
//   1. Providers generate JSON state
//   2. StateManager persists to WorkerBridge (ui:set)
//   3. StateManager restores from WorkerBridge (ui:getAll)
//   4. Provider state is correctly reconstructed
//
// Uses real FilterProvider, PAFVProvider, DensityProvider instances
// and a mock WorkerBridge — no real Worker needed.
//
// Requirements: PROV-10

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FilterProvider } from '../../src/providers/FilterProvider';
import { PAFVProvider } from '../../src/providers/PAFVProvider';
import { DensityProvider } from '../../src/providers/DensityProvider';
import { StateManager } from '../../src/providers/StateManager';
import type { WorkerBridge } from '../../src/worker/WorkerBridge';

// ---------------------------------------------------------------------------
// Mock WorkerBridge factory
// ---------------------------------------------------------------------------

interface MockBridgeStore {
  [key: string]: { key: string; value: string; updated_at: string };
}

function createMockBridge(initialStore: MockBridgeStore = {}): {
  bridge: WorkerBridge;
  store: MockBridgeStore;
  sendCalls: Array<{ type: string; payload: unknown }>;
} {
  const store: MockBridgeStore = { ...initialStore };
  const sendCalls: Array<{ type: string; payload: unknown }> = [];

  const bridge = {
    send: vi.fn((type: string, payload: unknown) => {
      sendCalls.push({ type, payload });

      if (type === 'ui:getAll') {
        return Promise.resolve(Object.values(store));
      }

      if (type === 'ui:set') {
        const p = payload as { key: string; value: string };
        store[p.key] = {
          key: p.key,
          value: p.value,
          updated_at: new Date().toISOString(),
        };
        return Promise.resolve(undefined);
      }

      return Promise.resolve(undefined);
    }),
  } as unknown as WorkerBridge;

  return { bridge, store, sendCalls };
}

// ---------------------------------------------------------------------------
// Test suite: FilterProvider round-trip
// ---------------------------------------------------------------------------

describe('Persistence round-trip — FilterProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists filters and restores them correctly', async () => {
    const { bridge, sendCalls } = createMockBridge();
    const filterProvider = new FilterProvider();
    const sm = new StateManager(bridge);

    sm.registerProvider('filter', filterProvider);

    // Add a filter
    filterProvider.addFilter({ field: 'folder', operator: 'eq', value: 'Projects' });

    // Manually trigger persistence
    sm.markDirty('filter');
    // Advance debounce timer
    vi.runAllTimers();
    // Wait for async persistence
    await vi.waitFor(() => {
      return sendCalls.some(c => c.type === 'ui:set');
    });

    // Verify a ui:set call was made
    const setCall = sendCalls.find(c => c.type === 'ui:set');
    expect(setCall).toBeDefined();
    expect((setCall!.payload as { key: string }).key).toBe('filter');

    // Now restore into a fresh provider
    const freshFilter = new FilterProvider();
    const sm2 = new StateManager(bridge);
    sm2.registerProvider('filter', freshFilter);

    await sm2.restore();

    const filters = freshFilter.getFilters();
    expect(filters).toHaveLength(1);
    expect(filters[0]).toMatchObject({ field: 'folder', operator: 'eq', value: 'Projects' });
  });

  it('restores empty state correctly when no stored data exists', async () => {
    const { bridge } = createMockBridge({}); // empty store
    const filterProvider = new FilterProvider();
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', filterProvider);

    // Add a filter to verify it gets cleared / stays at defaults
    filterProvider.addFilter({ field: 'status', operator: 'eq', value: 'active' });

    // Restore from empty store — provider is not in store, so stays at defaults
    // But wait, we added a filter above THEN called restore()
    // restore() skips providers with no stored key — leaves at defaults
    // Since we called addFilter() BEFORE restore(), the filter stays

    // Actually per the DECISION: "restore() skips providers with no stored key"
    // So provider keeps its current state when key is not in store.
    const freshFilter = new FilterProvider();
    const sm2 = new StateManager(bridge); // empty bridge
    sm2.registerProvider('filter', freshFilter);

    await sm2.restore();

    // No stored key → filter stays at defaults (empty)
    expect(freshFilter.getFilters()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test suite: PAFVProvider round-trip
// ---------------------------------------------------------------------------

describe('Persistence round-trip — PAFVProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists axis state and restores it correctly', async () => {
    const { bridge, sendCalls } = createMockBridge();
    const axisProvider = new PAFVProvider();
    const sm = new StateManager(bridge);

    sm.registerProvider('axis', axisProvider);

    // Set an axis
    axisProvider.setXAxis({ field: 'created_at', direction: 'desc' });
    axisProvider.setViewType('kanban');

    sm.markDirty('axis');
    vi.runAllTimers();
    await vi.waitFor(() => sendCalls.some(c => c.type === 'ui:set'));

    // Restore into fresh provider
    const freshAxis = new PAFVProvider();
    const sm2 = new StateManager(bridge);
    sm2.registerProvider('axis', freshAxis);

    await sm2.restore();

    const state = freshAxis.getState();
    expect(state.viewType).toBe('kanban');
    expect(state.xAxis).toMatchObject({ field: 'created_at', direction: 'desc' });
  });
});

// ---------------------------------------------------------------------------
// Test suite: DensityProvider round-trip
// ---------------------------------------------------------------------------

describe('Persistence round-trip — DensityProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists time granularity and restores it correctly', async () => {
    const { bridge, sendCalls } = createMockBridge();
    const densityProvider = new DensityProvider();
    const sm = new StateManager(bridge);

    sm.registerProvider('density', densityProvider);

    densityProvider.setState({ timeField: 'due_at', granularity: 'week' });

    sm.markDirty('density');
    vi.runAllTimers();
    await vi.waitFor(() => sendCalls.some(c => c.type === 'ui:set'));

    // Restore into fresh provider
    const freshDensity = new DensityProvider();
    const sm2 = new StateManager(bridge);
    sm2.registerProvider('density', freshDensity);

    await sm2.restore();

    const { groupExpr } = freshDensity.compile();
    // Should have restored due_at + week granularity
    expect(groupExpr).toContain('due_at');
    expect(groupExpr).toContain('W%W');
  });
});

// ---------------------------------------------------------------------------
// Test suite: multi-provider round-trip
// ---------------------------------------------------------------------------

describe('Persistence round-trip — multi-provider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists and restores multiple providers independently', async () => {
    const { bridge, sendCalls } = createMockBridge();
    const filterProvider = new FilterProvider();
    const axisProvider = new PAFVProvider();
    const densityProvider = new DensityProvider();
    const sm = new StateManager(bridge);

    sm.registerProvider('filter', filterProvider);
    sm.registerProvider('axis', axisProvider);
    sm.registerProvider('density', densityProvider);

    // Set state on all providers
    filterProvider.addFilter({ field: 'status', operator: 'neq', value: 'archived' });
    axisProvider.setXAxis({ field: 'priority', direction: 'desc' });
    densityProvider.setState({ timeField: 'modified_at', granularity: 'year' });

    // Persist all three
    sm.markDirty('filter');
    sm.markDirty('axis');
    sm.markDirty('density');
    vi.runAllTimers();
    await vi.waitFor(() => sendCalls.filter(c => c.type === 'ui:set').length >= 3);

    // Restore into fresh providers
    const freshFilter = new FilterProvider();
    const freshAxis = new PAFVProvider();
    const freshDensity = new DensityProvider();
    const sm2 = new StateManager(bridge);

    sm2.registerProvider('filter', freshFilter);
    sm2.registerProvider('axis', freshAxis);
    sm2.registerProvider('density', freshDensity);

    await sm2.restore();

    // Verify all three were restored
    expect(freshFilter.getFilters()).toHaveLength(1);
    expect(freshFilter.getFilters()[0]).toMatchObject({
      field: 'status',
      operator: 'neq',
      value: 'archived',
    });

    expect(freshAxis.getState().xAxis).toMatchObject({
      field: 'priority',
      direction: 'desc',
    });

    expect(freshDensity.compile().groupExpr).toContain('modified_at');
    expect(freshDensity.compile().groupExpr).toContain('%Y');
  });

  it('corruption of one provider does not affect others', async () => {
    // Pre-populate store with one corrupt entry and two valid ones
    const filterProvider = new FilterProvider();
    const axisProvider = new PAFVProvider();

    const validAxisJson = axisProvider.toJSON();
    axisProvider.setXAxis({ field: 'name', direction: 'asc' });
    const updatedAxisJson = axisProvider.toJSON();

    const { bridge } = createMockBridge({
      filter: {
        key: 'filter',
        value: 'NOT VALID JSON {{{',
        updated_at: '2026-01-01T00:00:00Z',
      },
      axis: {
        key: 'axis',
        value: updatedAxisJson,
        updated_at: '2026-01-01T00:00:00Z',
      },
    });

    const freshFilter = new FilterProvider();
    const freshAxis = new PAFVProvider();
    const sm = new StateManager(bridge);

    sm.registerProvider('filter', freshFilter);
    sm.registerProvider('axis', freshAxis);

    await sm.restore();

    // filter was corrupt → reset to defaults (empty)
    expect(freshFilter.getFilters()).toHaveLength(0);

    // axis was valid → restored correctly
    expect(freshAxis.getState().xAxis).toMatchObject({ field: 'name', direction: 'asc' });

    // Suppress unused variable warning
    void validAxisJson;
    void filterProvider;
  });
});
