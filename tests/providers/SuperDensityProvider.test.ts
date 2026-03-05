// Isometry v5 — Phase 22 SuperDensityProvider Tests
// TDD: RED phase — these tests define the expected behavior.
//
// Tests cover:
//   - Default state shape (axisGranularity: null, hideEmpty: false, viewMode: 'spreadsheet', regionConfig: null)
//   - Mutation methods (setGranularity, setHideEmpty, setViewMode)
//   - queueMicrotask batching (multiple mutations = one notification)
//   - PersistableProvider interface (toJSON, setState, resetToDefaults)
//   - Defensive copy (mutating returned state does not affect provider)
//
// Requirements: DENS-04, DENS-06

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuperDensityProvider } from '../../src/providers/SuperDensityProvider';
import type { SuperDensityState } from '../../src/providers/types';

describe('SuperDensityProvider', () => {
  let provider: SuperDensityProvider;

  beforeEach(() => {
    provider = new SuperDensityProvider();
  });

  // -------------------------------------------------------------------------
  // Test 1: Default state
  // -------------------------------------------------------------------------

  it('getState() returns default state', () => {
    const state = provider.getState();
    expect(state).toEqual({
      axisGranularity: null,
      hideEmpty: false,
      viewMode: 'spreadsheet',
      regionConfig: null,
    } satisfies SuperDensityState);
  });

  // -------------------------------------------------------------------------
  // Test 2: setGranularity
  // -------------------------------------------------------------------------

  it('setGranularity("month") updates axisGranularity', () => {
    provider.setGranularity('month');
    expect(provider.getState().axisGranularity).toBe('month');
  });

  // -------------------------------------------------------------------------
  // Test 3: setHideEmpty
  // -------------------------------------------------------------------------

  it('setHideEmpty(true) updates hideEmpty', () => {
    provider.setHideEmpty(true);
    expect(provider.getState().hideEmpty).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 4: setViewMode
  // -------------------------------------------------------------------------

  it('setViewMode("matrix") updates viewMode', () => {
    provider.setViewMode('matrix');
    expect(provider.getState().viewMode).toBe('matrix');
  });

  // -------------------------------------------------------------------------
  // Test 5: subscribe fires callback after state change
  // -------------------------------------------------------------------------

  it('subscribe() fires callback after state change via queueMicrotask', async () => {
    const cb = vi.fn();
    provider.subscribe(cb);
    provider.setGranularity('week');
    expect(cb).not.toHaveBeenCalled(); // sync: not yet
    await Promise.resolve(); // flush microtask queue
    expect(cb).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Test 6: Multiple mutations in same tick produce exactly one notification
  // -------------------------------------------------------------------------

  it('multiple mutations in same tick produce exactly one subscriber notification', async () => {
    const cb = vi.fn();
    provider.subscribe(cb);
    provider.setGranularity('year');
    provider.setHideEmpty(true);
    provider.setViewMode('matrix');
    expect(cb).not.toHaveBeenCalled(); // sync: not yet
    await Promise.resolve(); // flush microtask queue
    expect(cb).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Test 7: toJSON / setState round-trip fidelity
  // -------------------------------------------------------------------------

  it('toJSON() serializes state and setState() restores it with round-trip fidelity', () => {
    provider.setGranularity('quarter');
    provider.setHideEmpty(true);
    provider.setViewMode('matrix');

    const json = provider.toJSON();
    const parsed = JSON.parse(json) as unknown;

    const restored = new SuperDensityProvider();
    restored.setState(parsed);

    expect(restored.getState()).toEqual({
      axisGranularity: 'quarter',
      hideEmpty: true,
      viewMode: 'matrix',
      regionConfig: null,
    });
  });

  // -------------------------------------------------------------------------
  // Test 8: setState throws on invalid state shape
  // -------------------------------------------------------------------------

  it('setState() throws on invalid state shape', () => {
    expect(() => provider.setState(null)).toThrow();
    expect(() => provider.setState({ axisGranularity: 123 })).toThrow();
    expect(() => provider.setState('not an object')).toThrow();
  });

  // -------------------------------------------------------------------------
  // Test 9: resetToDefaults
  // -------------------------------------------------------------------------

  it('resetToDefaults() restores default state', () => {
    provider.setGranularity('day');
    provider.setHideEmpty(true);
    provider.setViewMode('matrix');

    provider.resetToDefaults();

    expect(provider.getState()).toEqual({
      axisGranularity: null,
      hideEmpty: false,
      viewMode: 'spreadsheet',
      regionConfig: null,
    });
  });

  // -------------------------------------------------------------------------
  // Test 10: getState() returns defensive copy
  // -------------------------------------------------------------------------

  it('getState() returns defensive copy (mutating returned object does not affect provider)', () => {
    const state = provider.getState() as Record<string, unknown>;
    // Mutate the returned object
    state['axisGranularity'] = 'year';
    state['hideEmpty'] = true;

    // Provider state should remain unchanged
    const fresh = provider.getState();
    expect(fresh.axisGranularity).toBe(null);
    expect(fresh.hideEmpty).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Test 11: subscribe returns unsubscribe function that stops notifications
  // -------------------------------------------------------------------------

  it('unsubscribe function stops future notifications', async () => {
    const cb = vi.fn();
    const unsub = provider.subscribe(cb);
    provider.setGranularity('week');
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);

    unsub(); // remove subscription
    provider.setHideEmpty(true);
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1); // not called again
  });
});
