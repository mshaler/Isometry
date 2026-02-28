// Isometry v5 — SelectionProvider Tests
// Tests for Tier 3 ephemeral selection state.
// SelectionProvider MUST NOT implement PersistableProvider.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SelectionProvider } from '../../src/providers/SelectionProvider';

describe('SelectionProvider', () => {
  let provider: SelectionProvider;

  beforeEach(() => {
    provider = new SelectionProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('returns empty array from getSelectedIds()', () => {
      expect(provider.getSelectedIds()).toEqual([]);
    });

    it('returns 0 from getSelectionCount()', () => {
      expect(provider.getSelectionCount()).toBe(0);
    });

    it('isSelected returns false for any id', () => {
      expect(provider.isSelected('a')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // select() — single selection
  // ---------------------------------------------------------------------------

  describe('select()', () => {
    it('selects a single id', () => {
      provider.select('a');
      expect(provider.isSelected('a')).toBe(true);
    });

    it('returns array with single id from getSelectedIds()', () => {
      provider.select('a');
      expect(provider.getSelectedIds()).toEqual(['a']);
    });

    it('replaces existing selection', () => {
      provider.select('a');
      provider.select('b');
      expect(provider.isSelected('a')).toBe(false);
      expect(provider.isSelected('b')).toBe(true);
      expect(provider.getSelectedIds()).toEqual(['b']);
    });

    it('updates getSelectionCount()', () => {
      provider.select('a');
      expect(provider.getSelectionCount()).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // toggle()
  // ---------------------------------------------------------------------------

  describe('toggle()', () => {
    it('adds id when not selected', () => {
      provider.toggle('a');
      expect(provider.isSelected('a')).toBe(true);
    });

    it('removes id when already selected', () => {
      provider.toggle('a');
      provider.toggle('a');
      expect(provider.isSelected('a')).toBe(false);
    });

    it('adds second id without removing first', () => {
      provider.select('a');
      provider.toggle('b');
      expect(provider.isSelected('a')).toBe(true);
      expect(provider.isSelected('b')).toBe(true);
    });

    it('removes one without affecting others', () => {
      provider.select('a');
      provider.toggle('b');
      provider.toggle('a');
      expect(provider.isSelected('a')).toBe(false);
      expect(provider.isSelected('b')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // range()
  // ---------------------------------------------------------------------------

  describe('range()', () => {
    const allIds = ['a', 'b', 'c', 'd', 'e'];

    it('selects inclusive range from lastSelected to target (forward)', () => {
      provider.select('b');
      provider.range('d', allIds);
      // b, c, d should be selected
      expect(provider.isSelected('b')).toBe(true);
      expect(provider.isSelected('c')).toBe(true);
      expect(provider.isSelected('d')).toBe(true);
      expect(provider.isSelected('a')).toBe(false);
      expect(provider.isSelected('e')).toBe(false);
    });

    it('selects inclusive range backward (target before lastSelected)', () => {
      provider.select('c');
      provider.range('a', allIds);
      // a, b, c should be selected
      expect(provider.isSelected('a')).toBe(true);
      expect(provider.isSelected('b')).toBe(true);
      expect(provider.isSelected('c')).toBe(true);
      expect(provider.isSelected('d')).toBe(false);
    });

    it('falls back to select(id) when lastSelectedId not in allIds', () => {
      // No prior selection, so lastSelectedId is null / not in list
      provider.range('c', allIds);
      expect(provider.isSelected('c')).toBe(true);
      expect(provider.getSelectionCount()).toBe(1);
    });

    it('selects single item when range target equals lastSelected', () => {
      provider.select('b');
      provider.range('b', allIds);
      expect(provider.isSelected('b')).toBe(true);
      expect(provider.getSelectionCount()).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // selectAll()
  // ---------------------------------------------------------------------------

  describe('selectAll()', () => {
    it('selects all provided ids', () => {
      provider.selectAll(['a', 'b', 'c']);
      expect(provider.isSelected('a')).toBe(true);
      expect(provider.isSelected('b')).toBe(true);
      expect(provider.isSelected('c')).toBe(true);
    });

    it('replaces previous selection', () => {
      provider.select('x');
      provider.selectAll(['a', 'b']);
      expect(provider.isSelected('x')).toBe(false);
      expect(provider.getSelectionCount()).toBe(2);
    });

    it('accepts empty array — clears selection', () => {
      provider.select('a');
      provider.selectAll([]);
      expect(provider.getSelectionCount()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // clear()
  // ---------------------------------------------------------------------------

  describe('clear()', () => {
    it('clears all selections', () => {
      provider.selectAll(['a', 'b', 'c']);
      provider.clear();
      expect(provider.getSelectionCount()).toBe(0);
      expect(provider.getSelectedIds()).toEqual([]);
    });

    it('clear after clear is idempotent', () => {
      provider.clear();
      provider.clear();
      expect(provider.getSelectionCount()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // subscribe() and notifications
  // ---------------------------------------------------------------------------

  describe('subscribe()', () => {
    it('calls subscriber after select via queueMicrotask', async () => {
      const cb = vi.fn();
      provider.subscribe(cb);
      provider.select('a');
      expect(cb).not.toHaveBeenCalled(); // Not synchronous
      await Promise.resolve(); // Flush microtasks
      expect(cb).toHaveBeenCalledOnce();
    });

    it('calls subscriber after toggle', async () => {
      const cb = vi.fn();
      provider.subscribe(cb);
      provider.toggle('a');
      await Promise.resolve();
      expect(cb).toHaveBeenCalledOnce();
    });

    it('calls subscriber after range', async () => {
      const cb = vi.fn();
      provider.subscribe(cb);
      provider.select('a');
      await Promise.resolve(); // flush first notification
      cb.mockClear();
      provider.range('c', ['a', 'b', 'c']);
      await Promise.resolve();
      expect(cb).toHaveBeenCalledOnce();
    });

    it('calls subscriber after selectAll', async () => {
      const cb = vi.fn();
      provider.subscribe(cb);
      provider.selectAll(['a', 'b']);
      await Promise.resolve();
      expect(cb).toHaveBeenCalledOnce();
    });

    it('calls subscriber after clear', async () => {
      const cb = vi.fn();
      provider.subscribe(cb);
      provider.clear();
      await Promise.resolve();
      expect(cb).toHaveBeenCalledOnce();
    });

    it('two rapid changes produce one notification', async () => {
      const cb = vi.fn();
      provider.subscribe(cb);
      provider.select('a');
      provider.toggle('b'); // second change in same synchronous frame
      await Promise.resolve(); // flush all microtasks
      expect(cb).toHaveBeenCalledOnce();
    });

    it('returns unsubscribe function that removes subscriber', async () => {
      const cb = vi.fn();
      const unsub = provider.subscribe(cb);
      unsub();
      provider.select('a');
      await Promise.resolve();
      expect(cb).not.toHaveBeenCalled();
    });

    it('unsubscribing one does not affect other subscribers', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = provider.subscribe(cb1);
      provider.subscribe(cb2);
      unsub1();
      provider.select('a');
      await Promise.resolve();
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // No persistence methods (D-005 enforcement)
  // ---------------------------------------------------------------------------

  describe('no persistence methods (Tier 3)', () => {
    it('does NOT have toJSON method', () => {
      expect((provider as unknown as Record<string, unknown>)['toJSON']).toBeUndefined();
    });

    it('does NOT have setState method', () => {
      expect((provider as unknown as Record<string, unknown>)['setState']).toBeUndefined();
    });

    it('does NOT have resetToDefaults method', () => {
      expect((provider as unknown as Record<string, unknown>)['resetToDefaults']).toBeUndefined();
    });
  });
});
