// Isometry v13.3 — Phase 177 Plan 01 SuperWidgetStateProvider Tests
// Tests for PersistableProvider for tab state serialization and restoration.
//
// Requirements: PRST-01, PRST-02, PRST-04

import { describe, expect, it, vi } from 'vitest';
import { SuperWidgetStateProvider } from '../../src/superwidget/SuperWidgetStateProvider';
import { makeTabSlot } from '../../src/superwidget/TabSlot';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush queueMicrotask callbacks */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}

// ---------------------------------------------------------------------------
// toJSON
// ---------------------------------------------------------------------------

describe('SuperWidgetStateProvider.toJSON', () => {
  it('returns JSON string with tabs array and activeTabSlotId', () => {
    const provider = new SuperWidgetStateProvider();
    const json = provider.toJSON();
    const parsed = JSON.parse(json) as unknown;

    expect(typeof json).toBe('string');
    expect(parsed).toBeDefined();
    expect(typeof parsed).toBe('object');
    const obj = parsed as Record<string, unknown>;
    expect(Array.isArray(obj['tabs'])).toBe(true);
    expect(typeof obj['activeTabSlotId']).toBe('string');
  });

  it('initial state contains exactly one tab matching makeTabSlot() shape', () => {
    const provider = new SuperWidgetStateProvider();
    const obj = JSON.parse(provider.toJSON()) as Record<string, unknown>;
    const tabs = obj['tabs'] as unknown[];
    expect(tabs).toHaveLength(1);
    const tab = tabs[0] as Record<string, unknown>;
    expect(typeof tab['tabId']).toBe('string');
    expect(typeof tab['label']).toBe('string');
    expect(tab['projection']).toBeDefined();
  });

  it('activeTabSlotId matches the first tab tabId', () => {
    const provider = new SuperWidgetStateProvider();
    const obj = JSON.parse(provider.toJSON()) as Record<string, unknown>;
    const tabs = obj['tabs'] as Array<Record<string, unknown>>;
    expect(obj['activeTabSlotId']).toBe(tabs[0]?.['tabId']);
  });

  it('reflects updated state after setTabs()', () => {
    const provider = new SuperWidgetStateProvider();
    const tab1 = makeTabSlot({ label: 'Alpha' });
    const tab2 = makeTabSlot({ label: 'Beta' });
    provider.setTabs([tab1, tab2], tab2.tabId);

    const obj = JSON.parse(provider.toJSON()) as Record<string, unknown>;
    const tabs = obj['tabs'] as Array<Record<string, unknown>>;
    expect(tabs).toHaveLength(2);
    expect(obj['activeTabSlotId']).toBe(tab2.tabId);
  });
});

// ---------------------------------------------------------------------------
// setState
// ---------------------------------------------------------------------------

describe('SuperWidgetStateProvider.setState', () => {
  it('restores tabs and activeTabSlotId from valid JSON shape', () => {
    const provider = new SuperWidgetStateProvider();
    const tab1 = makeTabSlot({ label: 'Restored' });
    const serialized = JSON.parse(provider.toJSON()) as Record<string, unknown>;
    const customState = {
      tabs: [tab1],
      activeTabSlotId: tab1.tabId,
    };

    provider.setState(customState);

    expect(provider.getTabs()).toHaveLength(1);
    expect(provider.getTabs()[0]?.label).toBe('Restored');
    expect(provider.getActiveTabSlotId()).toBe(tab1.tabId);
    void serialized;
  });

  it('does not notify subscribers on setState (snap-to-state restore)', async () => {
    const provider = new SuperWidgetStateProvider();
    const callback = vi.fn();
    provider.subscribe(callback);

    const tab = makeTabSlot();
    provider.setState({ tabs: [tab], activeTabSlotId: tab.tabId });
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });

  it('throws on state missing tabs array', () => {
    const provider = new SuperWidgetStateProvider();
    expect(() => provider.setState({ activeTabSlotId: 'x' })).toThrow();
  });

  it('throws on state with empty tabs array', () => {
    const provider = new SuperWidgetStateProvider();
    expect(() => provider.setState({ tabs: [], activeTabSlotId: 'x' })).toThrow();
  });

  it('throws on state missing activeTabSlotId', () => {
    const provider = new SuperWidgetStateProvider();
    const tab = makeTabSlot();
    expect(() => provider.setState({ tabs: [tab] })).toThrow();
  });

  it('throws on non-object state', () => {
    const provider = new SuperWidgetStateProvider();
    expect(() => provider.setState('bad')).toThrow();
    expect(() => provider.setState(null)).toThrow();
    expect(() => provider.setState(42)).toThrow();
  });

  it('throws when tabs entries are missing tabId', () => {
    const provider = new SuperWidgetStateProvider();
    expect(() =>
      provider.setState({
        tabs: [{ label: 'No ID', projection: {} }],
        activeTabSlotId: 'x',
      }),
    ).toThrow();
  });

  it('throws when tabs entries are missing projection', () => {
    const provider = new SuperWidgetStateProvider();
    expect(() =>
      provider.setState({
        tabs: [{ tabId: 'x', label: 'Missing proj' }],
        activeTabSlotId: 'x',
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// resetToDefaults
// ---------------------------------------------------------------------------

describe('SuperWidgetStateProvider.resetToDefaults', () => {
  it('resets to exactly one tab matching makeTabSlot() shape', () => {
    const provider = new SuperWidgetStateProvider();
    // Set up state with 2 tabs
    provider.setTabs([makeTabSlot(), makeTabSlot()], makeTabSlot().tabId);
    provider.resetToDefaults();

    expect(provider.getTabs()).toHaveLength(1);
    const tab = provider.getTabs()[0]!;
    expect(typeof tab.tabId).toBe('string');
    expect(typeof tab.label).toBe('string');
    expect(tab.projection).toBeDefined();
  });

  it('sets activeTabSlotId to the new default tab tabId', () => {
    const provider = new SuperWidgetStateProvider();
    provider.resetToDefaults();
    const tab = provider.getTabs()[0]!;
    expect(provider.getActiveTabSlotId()).toBe(tab.tabId);
  });

  it('does not notify subscribers on resetToDefaults (consistent with setState)', async () => {
    const provider = new SuperWidgetStateProvider();
    const callback = vi.fn();
    provider.subscribe(callback);

    provider.resetToDefaults();
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// subscribe / notify
// ---------------------------------------------------------------------------

describe('SuperWidgetStateProvider.subscribe', () => {
  it('returns an unsubscribe function', () => {
    const provider = new SuperWidgetStateProvider();
    const unsub = provider.subscribe(() => {});
    expect(typeof unsub).toBe('function');
  });

  it('fires subscriber once per synchronous batch on setTabs()', async () => {
    const provider = new SuperWidgetStateProvider();
    const callback = vi.fn();
    provider.subscribe(callback);

    const tab = makeTabSlot();
    provider.setTabs([tab], tab.tabId);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('batches multiple setTabs() calls in the same microtask tick', async () => {
    const provider = new SuperWidgetStateProvider();
    const callback = vi.fn();
    provider.subscribe(callback);

    const tab1 = makeTabSlot();
    const tab2 = makeTabSlot();
    provider.setTabs([tab1], tab1.tabId);
    provider.setTabs([tab1, tab2], tab2.tabId);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe prevents future notifications', async () => {
    const provider = new SuperWidgetStateProvider();
    const callback = vi.fn();
    const unsub = provider.subscribe(callback);

    unsub();
    const tab = makeTabSlot();
    provider.setTabs([tab], tab.tabId);
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setTabs / getTabs / getActiveTabSlotId
// ---------------------------------------------------------------------------

describe('SuperWidgetStateProvider getters and setTabs', () => {
  it('getTabs() returns current tabs array', () => {
    const provider = new SuperWidgetStateProvider();
    const tab1 = makeTabSlot({ label: 'One' });
    const tab2 = makeTabSlot({ label: 'Two' });
    provider.setTabs([tab1, tab2], tab1.tabId);

    expect(provider.getTabs()).toHaveLength(2);
    expect(provider.getTabs()[0]?.label).toBe('One');
  });

  it('getActiveTabSlotId() returns current active ID', () => {
    const provider = new SuperWidgetStateProvider();
    const tab1 = makeTabSlot();
    const tab2 = makeTabSlot();
    provider.setTabs([tab1, tab2], tab2.tabId);

    expect(provider.getActiveTabSlotId()).toBe(tab2.tabId);
  });
});

// ---------------------------------------------------------------------------
// round-trip
// ---------------------------------------------------------------------------

describe('SuperWidgetStateProvider round-trip', () => {
  it('toJSON / setState round-trips tabs and activeTabSlotId', () => {
    const provider = new SuperWidgetStateProvider();
    const tab1 = makeTabSlot({ label: 'First' });
    const tab2 = makeTabSlot({ label: 'Second' });
    provider.setTabs([tab1, tab2], tab2.tabId);

    const json = provider.toJSON();

    const provider2 = new SuperWidgetStateProvider();
    provider2.setState(JSON.parse(json) as unknown);

    expect(provider2.getTabs()).toHaveLength(2);
    expect(provider2.getTabs()[1]?.label).toBe('Second');
    expect(provider2.getActiveTabSlotId()).toBe(tab2.tabId);
  });
});
