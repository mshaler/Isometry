// Isometry v13.3 — Phase 177 Plan 01 StateManager.restoreKey Tests
// Tests for per-key delayed restore without touching other providers.
//
// Requirements: PRST-04

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StateManager } from '../../src/providers/StateManager';
import type { PersistableProvider } from '../../src/providers/types';
import type { WorkerBridge } from '../../src/worker/WorkerBridge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBridgeMock(
  uiGetAllResult: Array<{ key: string; value: string; updated_at: string }> = [],
): {
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

function makeProviderMock(jsonValue = '{"state":"default"}') {
  const toJSONMock = vi.fn(() => jsonValue);
  const setStateMock = vi.fn();
  const resetToDefaultsMock = vi.fn();
  const subscribeMock = vi.fn(() => vi.fn());

  const provider: PersistableProvider & { subscribe: () => () => void } = {
    toJSON: toJSONMock,
    setState: setStateMock,
    resetToDefaults: resetToDefaultsMock,
    subscribe: subscribeMock,
  };
  return { provider, toJSONMock, setStateMock, resetToDefaultsMock, subscribeMock };
}

// ---------------------------------------------------------------------------
// StateManager.restoreKey
// ---------------------------------------------------------------------------

describe('StateManager.restoreKey', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('restores only the named provider from ui_state', async () => {
    const stored = JSON.stringify({ tabs: [], activeTabSlotId: 'tab-1' });
    const { bridge } = makeBridgeMock([
      { key: 'my-tabs', value: stored, updated_at: '' },
    ]);
    const sm = new StateManager(bridge);
    const { provider, setStateMock } = makeProviderMock();
    sm.registerProvider('my-tabs', provider);

    await sm.restoreKey('my-tabs');

    expect(setStateMock).toHaveBeenCalledOnce();
    expect(setStateMock).toHaveBeenCalledWith(JSON.parse(stored));
  });

  it('does not affect other registered providers', async () => {
    const stored = JSON.stringify({ x: 1 });
    const { bridge } = makeBridgeMock([
      { key: 'target', value: stored, updated_at: '' },
      { key: 'other', value: JSON.stringify({ y: 2 }), updated_at: '' },
    ]);
    const sm = new StateManager(bridge);
    const { provider: targetProvider, setStateMock: targetSet } = makeProviderMock();
    const { provider: otherProvider, setStateMock: otherSet } = makeProviderMock();
    sm.registerProvider('target', targetProvider);
    sm.registerProvider('other', otherProvider);

    await sm.restoreKey('target');

    expect(targetSet).toHaveBeenCalledOnce();
    expect(otherSet).not.toHaveBeenCalled();
  });

  it('is a no-op when the key has no stored value', async () => {
    const { bridge } = makeBridgeMock([]); // no rows
    const sm = new StateManager(bridge);
    const { provider, setStateMock, resetToDefaultsMock } = makeProviderMock();
    sm.registerProvider('my-tabs', provider);

    await sm.restoreKey('my-tabs');

    expect(setStateMock).not.toHaveBeenCalled();
    expect(resetToDefaultsMock).not.toHaveBeenCalled();
  });

  it('resets provider to defaults on corrupt JSON', async () => {
    const { bridge } = makeBridgeMock([
      { key: 'my-tabs', value: '{ INVALID JSON', updated_at: '' },
    ]);
    const sm = new StateManager(bridge);
    const { provider, setStateMock, resetToDefaultsMock } = makeProviderMock();
    sm.registerProvider('my-tabs', provider);

    await sm.restoreKey('my-tabs');

    expect(setStateMock).not.toHaveBeenCalled();
    expect(resetToDefaultsMock).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[StateManager]'));
  });

  it('resets provider to defaults when setState() throws', async () => {
    const stored = JSON.stringify({ valid: 'shape' });
    const { bridge } = makeBridgeMock([
      { key: 'my-tabs', value: stored, updated_at: '' },
    ]);
    const sm = new StateManager(bridge);
    const { provider, setStateMock, resetToDefaultsMock } = makeProviderMock();
    setStateMock.mockImplementation(() => {
      throw new Error('invalid state shape');
    });
    sm.registerProvider('my-tabs', provider);

    await sm.restoreKey('my-tabs');

    expect(resetToDefaultsMock).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not throw when key is not registered', async () => {
    const { bridge } = makeBridgeMock([]);
    const sm = new StateManager(bridge);

    await expect(sm.restoreKey('nonexistent')).resolves.toBeUndefined();
  });

  it('leaves other providers untouched when corrupt JSON resets one', async () => {
    const { bridge } = makeBridgeMock([
      { key: 'tabs', value: '{ BAD', updated_at: '' },
      { key: 'filter', value: JSON.stringify({ filters: [] }), updated_at: '' },
    ]);
    const sm = new StateManager(bridge);
    const { provider: tabsProvider, resetToDefaultsMock: tabsReset } = makeProviderMock();
    const { provider: filterProvider, setStateMock: filterSet } = makeProviderMock();
    sm.registerProvider('tabs', tabsProvider);
    sm.registerProvider('filter', filterProvider);

    await sm.restoreKey('tabs');

    expect(tabsReset).toHaveBeenCalledOnce();
    // filter provider is NOT touched by restoreKey('tabs')
    expect(filterSet).not.toHaveBeenCalled();
  });
});
