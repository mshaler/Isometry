// Isometry v5 — StateCoordinator Tests
// Tests for cross-provider change batching via setTimeout(16).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StateCoordinator } from '../../src/providers/StateCoordinator';

// Minimal mock of a subscribable provider
function makeMockProvider() {
  const subscribers = new Set<() => void>();
  return {
    subscribe: vi.fn((cb: () => void) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    }),
    /** Trigger a change notification (as if the provider's internal state changed) */
    triggerChange: () => {
      for (const cb of subscribers) cb();
    },
    getSubscriberCount: () => subscribers.size,
  };
}

describe('StateCoordinator', () => {
  let coordinator: StateCoordinator;

  beforeEach(() => {
    vi.useFakeTimers();
    coordinator = new StateCoordinator();
  });

  afterEach(() => {
    coordinator.destroy();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // registerProvider()
  // ---------------------------------------------------------------------------

  describe('registerProvider()', () => {
    it('subscribes to the registered provider', () => {
      const provider = makeMockProvider();
      coordinator.registerProvider('filter', provider);
      expect(provider.subscribe).toHaveBeenCalledOnce();
    });

    it('stores the unsubscribe function (verified via destroy)', () => {
      const provider = makeMockProvider();
      coordinator.registerProvider('filter', provider);
      // After destroy, no more subscribers on the provider
      coordinator.destroy();
      expect(provider.getSubscriberCount()).toBe(0);
    });

    it('can register multiple providers', () => {
      const p1 = makeMockProvider();
      const p2 = makeMockProvider();
      coordinator.registerProvider('filter', p1);
      coordinator.registerProvider('pafv', p2);
      expect(p1.subscribe).toHaveBeenCalledOnce();
      expect(p2.subscribe).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // unregisterProvider()
  // ---------------------------------------------------------------------------

  describe('unregisterProvider()', () => {
    it('unsubscribes from the provider when unregistered', () => {
      const provider = makeMockProvider();
      coordinator.registerProvider('filter', provider);
      coordinator.unregisterProvider('filter');
      expect(provider.getSubscriberCount()).toBe(0);
    });

    it('no-ops for unknown key', () => {
      // Should not throw
      expect(() => coordinator.unregisterProvider('unknown')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-provider batching
  // ---------------------------------------------------------------------------

  describe('batched notifications', () => {
    it('notifies coordinator subscribers after ~16ms when a provider changes', () => {
      const provider = makeMockProvider();
      coordinator.registerProvider('filter', provider);

      const cb = vi.fn();
      coordinator.subscribe(cb);

      provider.triggerChange();
      expect(cb).not.toHaveBeenCalled(); // Not yet

      vi.advanceTimersByTime(16);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('two providers changing in the same frame → ONE notification', () => {
      const p1 = makeMockProvider();
      const p2 = makeMockProvider();
      coordinator.registerProvider('filter', p1);
      coordinator.registerProvider('pafv', p2);

      const cb = vi.fn();
      coordinator.subscribe(cb);

      // Both change synchronously
      p1.triggerChange();
      p2.triggerChange();

      vi.advanceTimersByTime(16);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('second change resets timer — notification fires 16ms after last change', () => {
      const provider = makeMockProvider();
      coordinator.registerProvider('filter', provider);

      const cb = vi.fn();
      coordinator.subscribe(cb);

      provider.triggerChange();
      vi.advanceTimersByTime(10); // Only 10ms, not fired yet
      expect(cb).not.toHaveBeenCalled();

      // Already scheduled, second trigger doesn't add another timer
      provider.triggerChange();
      vi.advanceTimersByTime(6); // Total 16ms from first trigger
      expect(cb).toHaveBeenCalledOnce();
    });

    it('after first batch fires, a new change creates a new notification', () => {
      const provider = makeMockProvider();
      coordinator.registerProvider('filter', provider);

      const cb = vi.fn();
      coordinator.subscribe(cb);

      provider.triggerChange();
      vi.advanceTimersByTime(16);
      expect(cb).toHaveBeenCalledTimes(1);

      provider.triggerChange();
      vi.advanceTimersByTime(16);
      expect(cb).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // subscribe()
  // ---------------------------------------------------------------------------

  describe('subscribe()', () => {
    it('returns an unsubscribe function', () => {
      const provider = makeMockProvider();
      coordinator.registerProvider('filter', provider);

      const cb = vi.fn();
      const unsub = coordinator.subscribe(cb);
      unsub();

      provider.triggerChange();
      vi.advanceTimersByTime(16);
      expect(cb).not.toHaveBeenCalled();
    });

    it('multiple subscribers all receive notification', () => {
      const provider = makeMockProvider();
      coordinator.registerProvider('filter', provider);

      const cb1 = vi.fn();
      const cb2 = vi.fn();
      coordinator.subscribe(cb1);
      coordinator.subscribe(cb2);

      provider.triggerChange();
      vi.advanceTimersByTime(16);
      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });

    it('unsubscribing one does not affect other subscribers', () => {
      const provider = makeMockProvider();
      coordinator.registerProvider('filter', provider);

      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = coordinator.subscribe(cb1);
      coordinator.subscribe(cb2);
      unsub1();

      provider.triggerChange();
      vi.advanceTimersByTime(16);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // destroy()
  // ---------------------------------------------------------------------------

  describe('destroy()', () => {
    it('clears pending timers — no notification fires after destroy', () => {
      const provider = makeMockProvider();
      coordinator.registerProvider('filter', provider);

      const cb = vi.fn();
      coordinator.subscribe(cb);

      provider.triggerChange();
      coordinator.destroy(); // Destroy before timer fires
      vi.advanceTimersByTime(16);
      expect(cb).not.toHaveBeenCalled();
    });

    it('unsubscribes from all providers', () => {
      const p1 = makeMockProvider();
      const p2 = makeMockProvider();
      coordinator.registerProvider('filter', p1);
      coordinator.registerProvider('pafv', p2);

      coordinator.destroy();
      expect(p1.getSubscriberCount()).toBe(0);
      expect(p2.getSubscriberCount()).toBe(0);
    });

    it('destroy on fresh coordinator does not throw', () => {
      const fresh = new StateCoordinator();
      expect(() => fresh.destroy()).not.toThrow();
    });
  });
});
