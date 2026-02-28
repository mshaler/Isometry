// Isometry v5 — Phase 4 StateManager Tests
// Tests for Tier 2 provider persistence via WorkerBridge.
//
// Design:
//   - Mock WorkerBridge — no real Worker needed
//   - Uses vi.useFakeTimers() for debounce testing
//   - Verifies persistence calls, restore logic, corruption isolation
//
// Requirements: PROV-10

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../../src/providers/StateManager';
import type { WorkerBridge } from '../../src/worker/WorkerBridge';
import type { PersistableProvider } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// Mock bridge factory
// ---------------------------------------------------------------------------

function makeBridgeMock(uiGetAllResult: Array<{ key: string; value: string; updated_at: string }> = []): {
  bridge: WorkerBridge;
  sendMock: ReturnType<typeof vi.fn>;
} {
  const sendMock = vi.fn().mockImplementation((type: string) => {
    if (type === 'ui:getAll') {
      return Promise.resolve(uiGetAllResult);
    }
    return Promise.resolve(undefined);
  });

  const bridge = { send: sendMock } as unknown as WorkerBridge;

  return { bridge, sendMock };
}

// ---------------------------------------------------------------------------
// Mock provider factory
// ---------------------------------------------------------------------------

function makeProviderMock(jsonValue: string = '{"state":"default"}'): {
  provider: PersistableProvider;
  toJSONMock: ReturnType<typeof vi.fn>;
  setStateMock: ReturnType<typeof vi.fn>;
  resetToDefaultsMock: ReturnType<typeof vi.fn>;
  subscribeMock: ReturnType<typeof vi.fn>;
} {
  const toJSONMock = vi.fn(() => jsonValue);
  const setStateMock = vi.fn();
  const resetToDefaultsMock = vi.fn();
  const subscribeMock = vi.fn(() => vi.fn()); // returns unsubscribe fn

  const provider: PersistableProvider & {
    subscribe: (cb: () => void) => () => void;
    toJSON: () => string;
    setState: (s: unknown) => void;
    resetToDefaults: () => void;
  } = {
    toJSON: toJSONMock,
    setState: setStateMock,
    resetToDefaults: resetToDefaultsMock,
    subscribe: subscribeMock,
  };

  return { provider, toJSONMock, setStateMock, resetToDefaultsMock, subscribeMock };
}

// ---------------------------------------------------------------------------
// registerProvider tests
// ---------------------------------------------------------------------------

describe('StateManager.registerProvider()', () => {
  it('registers a provider without side effects', () => {
    const { bridge, sendMock } = makeBridgeMock();
    const { provider } = makeProviderMock();
    const sm = new StateManager(bridge);

    sm.registerProvider('filter', provider);

    // No bridge calls on registration
    expect(sendMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// markDirty / debounce tests
// ---------------------------------------------------------------------------

describe('StateManager.markDirty() — debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call bridge.send immediately after markDirty', () => {
    const { bridge, sendMock } = makeBridgeMock();
    const { provider } = makeProviderMock();
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);

    sm.markDirty('filter');

    // No call yet — debounce pending
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('calls bridge.send after 500ms debounce fires', async () => {
    const { bridge, sendMock } = makeBridgeMock();
    const { provider } = makeProviderMock('{"filters":[]}');
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);

    sm.markDirty('filter');
    await vi.runAllTimersAsync();

    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledWith('ui:set', { key: 'filter', value: '{"filters":[]}' });
  });

  it('multiple markDirty calls within 500ms produce only one bridge.send', async () => {
    const { bridge, sendMock } = makeBridgeMock();
    const { provider } = makeProviderMock();
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);

    sm.markDirty('filter');
    sm.markDirty('filter');
    sm.markDirty('filter');
    await vi.runAllTimersAsync();

    // Only one write despite three dirty calls
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it('markDirty resets the timer on repeated calls', async () => {
    const { bridge, sendMock } = makeBridgeMock();
    const { provider } = makeProviderMock();
    const sm = new StateManager(bridge, 500);
    sm.registerProvider('filter', provider);

    sm.markDirty('filter');
    // Advance 400ms — not yet fired
    await vi.advanceTimersByTimeAsync(400);
    expect(sendMock).not.toHaveBeenCalled();

    // Call again — should reset timer
    sm.markDirty('filter');
    // Advance another 400ms — original would have fired but reset
    await vi.advanceTimersByTimeAsync(400);
    expect(sendMock).not.toHaveBeenCalled();

    // Advance remaining 100ms to complete 500ms since last call
    await vi.advanceTimersByTimeAsync(100);
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it('markDirty for unknown key does not throw or call bridge', async () => {
    const { bridge, sendMock } = makeBridgeMock();
    const sm = new StateManager(bridge);

    // markDirty for unregistered key — should be a no-op
    expect(() => sm.markDirty('nonexistent')).not.toThrow();
    await vi.runAllTimersAsync();
    expect(sendMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// persistAll tests
// ---------------------------------------------------------------------------

describe('StateManager.persistAll()', () => {
  it('persists all registered providers immediately', async () => {
    const { bridge, sendMock } = makeBridgeMock();
    const { provider: filterProvider } = makeProviderMock('{"filters":[]}');
    const { provider: axisProvider } = makeProviderMock('{"viewType":"list"}');
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', filterProvider);
    sm.registerProvider('axis', axisProvider);

    await sm.persistAll();

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock).toHaveBeenCalledWith('ui:set', { key: 'filter', value: '{"filters":[]}' });
    expect(sendMock).toHaveBeenCalledWith('ui:set', { key: 'axis', value: '{"viewType":"list"}' });
  });

  it('with no registered providers does nothing', async () => {
    const { bridge, sendMock } = makeBridgeMock();
    const sm = new StateManager(bridge);

    await sm.persistAll();

    expect(sendMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// restore tests
// ---------------------------------------------------------------------------

describe('StateManager.restore()', () => {
  it('calls bridge.send ui:getAll to fetch persisted state', async () => {
    const { bridge, sendMock } = makeBridgeMock([]);
    const sm = new StateManager(bridge);

    await sm.restore();

    expect(sendMock).toHaveBeenCalledWith('ui:getAll', {});
  });

  it('calls provider.setState with parsed JSON for matching key', async () => {
    const storedState = { filters: [], searchQuery: null };
    const { bridge } = makeBridgeMock([
      { key: 'filter', value: JSON.stringify(storedState), updated_at: '2026-01-01' },
    ]);
    const { provider, setStateMock } = makeProviderMock();
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);

    await sm.restore();

    expect(setStateMock).toHaveBeenCalledOnce();
    expect(setStateMock).toHaveBeenCalledWith(storedState);
  });

  it('does not call setState for unregistered key in response', async () => {
    const { bridge } = makeBridgeMock([
      { key: 'unregistered', value: '{}', updated_at: '2026-01-01' },
    ]);
    const { provider, setStateMock } = makeProviderMock();
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);

    await sm.restore();

    // 'unregistered' key has no provider — filter provider should not be called
    expect(setStateMock).not.toHaveBeenCalled();
  });

  it('does not call setState when key is missing from restored data', async () => {
    const { bridge } = makeBridgeMock([
      // No 'filter' key in stored data
      { key: 'axis', value: '{"viewType":"list"}', updated_at: '2026-01-01' },
    ]);
    const { provider, setStateMock } = makeProviderMock();
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);

    await sm.restore();

    // filter key not in data — setState should NOT be called; leave defaults
    expect(setStateMock).not.toHaveBeenCalled();
  });

  it('corrupt JSON for one provider: logs warning and calls resetToDefaults()', async () => {
    const { bridge } = makeBridgeMock([
      { key: 'filter', value: 'NOT_VALID_JSON{{{', updated_at: '2026-01-01' },
    ]);
    const { provider, setStateMock, resetToDefaultsMock } = makeProviderMock();
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sm.restore();
    warnSpy.mockRestore();

    expect(setStateMock).not.toHaveBeenCalled();
    expect(resetToDefaultsMock).toHaveBeenCalledOnce();
  });

  it('corrupt JSON resets only the affected provider — others unaffected', async () => {
    const { bridge } = makeBridgeMock([
      { key: 'filter', value: 'CORRUPT{{{', updated_at: '2026-01-01' },
      { key: 'axis', value: '{"viewType":"kanban"}', updated_at: '2026-01-01' },
    ]);
    const { provider: filterProvider, setStateMock: filterSetState, resetToDefaultsMock: filterReset } = makeProviderMock();
    const { provider: axisProvider, setStateMock: axisSetState, resetToDefaultsMock: axisReset } = makeProviderMock();
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', filterProvider);
    sm.registerProvider('axis', axisProvider);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sm.restore();
    warnSpy.mockRestore();

    // filter: corrupt → reset to defaults
    expect(filterSetState).not.toHaveBeenCalled();
    expect(filterReset).toHaveBeenCalledOnce();

    // axis: valid → setState called, no reset
    expect(axisSetState).toHaveBeenCalledWith({ viewType: 'kanban' });
    expect(axisReset).not.toHaveBeenCalled();
  });

  it('setState() throws: logs warning and calls resetToDefaults()', async () => {
    const { bridge } = makeBridgeMock([
      { key: 'filter', value: '{"validJSON":true}', updated_at: '2026-01-01' },
    ]);
    const { provider, setStateMock, resetToDefaultsMock } = makeProviderMock();
    setStateMock.mockImplementation(() => {
      throw new Error('Invalid state shape');
    });
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sm.restore();
    warnSpy.mockRestore();

    expect(resetToDefaultsMock).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// destroy tests
// ---------------------------------------------------------------------------

describe('StateManager.destroy()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears pending debounce timers on destroy()', async () => {
    const { bridge, sendMock } = makeBridgeMock();
    const { provider } = makeProviderMock();
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);

    sm.markDirty('filter');
    sm.destroy();

    // Advance past the debounce — timer should have been cleared
    await vi.runAllTimersAsync();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('after destroy(), markDirty does not throw', () => {
    const { bridge } = makeBridgeMock();
    const { provider } = makeProviderMock();
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);
    sm.destroy();

    expect(() => sm.markDirty('filter')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// enableAutoPersist / disableAutoPersist tests
// ---------------------------------------------------------------------------

describe('StateManager.enableAutoPersist()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribes to all registered providers', () => {
    const { bridge } = makeBridgeMock();
    const { provider: filterProvider, subscribeMock: filterSub } = makeProviderMock();
    const { provider: axisProvider, subscribeMock: axisSub } = makeProviderMock();
    const sm = new StateManager(bridge);
    sm.registerProvider('filter', filterProvider);
    sm.registerProvider('axis', axisProvider);

    sm.enableAutoPersist();

    expect(filterSub).toHaveBeenCalledOnce();
    expect(axisSub).toHaveBeenCalledOnce();
  });

  it('calling provider change callback triggers markDirty for that provider', async () => {
    const { bridge, sendMock } = makeBridgeMock();
    let changeCallback: (() => void) | undefined;
    const subscribeMock = vi.fn((cb: () => void) => {
      changeCallback = cb;
      return vi.fn(); // unsubscribe
    });
    const provider = {
      toJSON: vi.fn(() => '{"state":"updated"}'),
      setState: vi.fn(),
      resetToDefaults: vi.fn(),
      subscribe: subscribeMock,
    } as unknown as PersistableProvider;

    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);
    sm.enableAutoPersist();

    // Trigger provider change
    expect(changeCallback).toBeDefined();
    changeCallback!();
    await vi.runAllTimersAsync();

    expect(sendMock).toHaveBeenCalledWith('ui:set', { key: 'filter', value: '{"state":"updated"}' });
  });

  it('disableAutoPersist() calls unsubscribe functions', () => {
    const { bridge } = makeBridgeMock();
    const unsubscribeMock = vi.fn();
    const subscribeMock = vi.fn(() => unsubscribeMock);
    const provider = {
      toJSON: vi.fn(),
      setState: vi.fn(),
      resetToDefaults: vi.fn(),
      subscribe: subscribeMock,
    } as unknown as PersistableProvider;

    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);
    sm.enableAutoPersist();
    sm.disableAutoPersist();

    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });

  it('destroy() calls unsubscribe functions for autoPersist', () => {
    const { bridge } = makeBridgeMock();
    const unsubscribeMock = vi.fn();
    const subscribeMock = vi.fn(() => unsubscribeMock);
    const provider = {
      toJSON: vi.fn(),
      setState: vi.fn(),
      resetToDefaults: vi.fn(),
      subscribe: subscribeMock,
    } as unknown as PersistableProvider;

    const sm = new StateManager(bridge);
    sm.registerProvider('filter', provider);
    sm.enableAutoPersist();
    sm.destroy();

    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });
});
