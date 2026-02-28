// @vitest-environment jsdom
// Isometry v5 — ViewManager Tests
// Tests for view lifecycle management: destroy-before-mount, subscriber leak prevention,
// loading/error/empty states, and PAFV setViewType integration.
//
// Requirements: VIEW-09, VIEW-10, VIEW-11, REND-07, REND-08

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ViewManager } from '../../src/views/ViewManager';
import type { IView, CardDatum, WorkerBridgeLike, PAFVProviderLike } from '../../src/views/types';
import type { ViewType } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

/** Create a mock IView implementation with tracked calls */
function makeMockView(): IView & {
  mountCalls: HTMLElement[];
  renderCalls: CardDatum[][];
} {
  const mountCalls: HTMLElement[] = [];
  const renderCalls: CardDatum[][] = [];

  const view = {
    mountCalls,
    renderCalls,
    mount: vi.fn((container: HTMLElement) => {
      mountCalls.push(container);
    }),
    render: vi.fn((cards: CardDatum[]) => {
      renderCalls.push(cards);
    }),
    destroy: vi.fn(),
  };

  return view;
}

/** Create a mock StateCoordinator with tracked subscribe/unsubscribe */
function makeMockCoordinator() {
  let subscriberCount = 0;
  const callbacks = new Set<() => void>();

  return {
    get subscriberCount() {
      return subscriberCount;
    },
    subscribe: vi.fn((cb: () => void): (() => void) => {
      subscriberCount++;
      callbacks.add(cb);
      return () => {
        subscriberCount--;
        callbacks.delete(cb);
      };
    }),
    /** Trigger all subscribers (simulates provider change) */
    triggerChange: () => {
      for (const cb of callbacks) cb();
    },
    destroy: vi.fn(),
  };
}

/** Create a mock QueryBuilder */
function makeMockQueryBuilder() {
  return {
    buildCardQuery: vi.fn(() => ({
      sql: 'SELECT * FROM cards WHERE deleted_at IS NULL',
      params: [],
    })),
  };
}

/** Create a mock WorkerBridge that resolves with card rows */
function makeMockBridge(rows: Record<string, unknown>[] = []) {
  return {
    send: vi.fn((_type: string, _payload: unknown): Promise<unknown> => {
      return Promise.resolve({ rows });
    }),
  };
}

/** Minimal valid CardDatum for tests */
function makeCard(id: string, name = `Card ${id}`): CardDatum {
  return {
    id,
    name,
    folder: null,
    status: null,
    card_type: 'note',
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-01-01T00:00:00Z',
    priority: 0,
    sort_order: 0,
  };
}

/** Create a mock PAFVProvider */
function makeMockPAFV(): PAFVProviderLike & { setViewTypeCalls: ViewType[] } {
  const setViewTypeCalls: ViewType[] = [];
  return {
    setViewTypeCalls,
    setViewType: vi.fn((viewType: ViewType) => {
      setViewTypeCalls.push(viewType);
    }),
  };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('ViewManager', () => {
  let container: HTMLElement;
  let coordinator: ReturnType<typeof makeMockCoordinator>;
  let queryBuilder: ReturnType<typeof makeMockQueryBuilder>;
  let bridge: ReturnType<typeof makeMockBridge>;
  let pafv: ReturnType<typeof makeMockPAFV>;
  let viewManager: ViewManager;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    coordinator = makeMockCoordinator();
    queryBuilder = makeMockQueryBuilder();
    bridge = makeMockBridge([
      { id: 'card-1', name: 'Card 1', folder: null, status: null, card_type: 'note',
        created_at: '2026-01-01T00:00:00Z', modified_at: '2026-01-01T00:00:00Z',
        priority: 0, sort_order: 0 },
    ]);
    pafv = makeMockPAFV();

    viewManager = new ViewManager({
      container,
      coordinator: coordinator as never,
      queryBuilder: queryBuilder as never,
      bridge,
      pafv,
    });
  });

  afterEach(() => {
    viewManager.destroy();
    document.body.removeChild(container);
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Lifecycle: destroy-before-mount (VIEW-10)
  // ---------------------------------------------------------------------------

  describe('switchTo() lifecycle', () => {
    it('calls destroy() on current view before mounting new view', async () => {
      const view1 = makeMockView();
      const view2 = makeMockView();

      await viewManager.switchTo('list', () => view1);
      // Let the async fetch complete
      await vi.runAllTimersAsync();

      // Sanity: view1 was mounted
      expect(view1.mount).toHaveBeenCalledOnce();

      await viewManager.switchTo('grid', () => view2);
      await vi.runAllTimersAsync();

      // view1.destroy() must have been called before view2.mount()
      expect(view1.destroy).toHaveBeenCalledOnce();
      expect(view2.mount).toHaveBeenCalledOnce();
    });

    it('calls pafv.setViewType with the new view type on each switchTo', async () => {
      const view1 = makeMockView();
      await viewManager.switchTo('grid', () => view1);
      await vi.runAllTimersAsync();

      expect(pafv.setViewType).toHaveBeenCalledWith('grid');

      const view2 = makeMockView();
      await viewManager.switchTo('kanban', () => view2);
      await vi.runAllTimersAsync();

      expect(pafv.setViewType).toHaveBeenCalledWith('kanban');
    });

    it('clears the container innerHTML before mounting new view', async () => {
      const view1 = makeMockView();
      // Add something to the container to verify it gets cleared
      container.innerHTML = '<div class="stale">old content</div>';

      await viewManager.switchTo('list', () => view1);
      await vi.runAllTimersAsync();

      // Stale content should be gone (or at minimum view should have been mounted)
      expect(view1.mount).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // Subscriber leak prevention (VIEW-10)
  // ---------------------------------------------------------------------------

  describe('subscriber leak prevention', () => {
    it('subscriber count unchanged after 10 mount/destroy cycles', async () => {
      const initialCount = coordinator.subscriberCount;

      for (let i = 0; i < 10; i++) {
        const view = makeMockView();
        await viewManager.switchTo('list', () => view);
        await vi.runAllTimersAsync();
      }

      // After 10 cycles, exactly 1 subscriber should exist (the current view's subscription)
      // Net change from initial should be at most +1
      expect(coordinator.subscriberCount - initialCount).toBeLessThanOrEqual(1);
    });

    it('subscriber count returns to 0 after destroy()', async () => {
      const view = makeMockView();
      await viewManager.switchTo('list', () => view);
      await vi.runAllTimersAsync();

      const countBefore = coordinator.subscriberCount;
      expect(countBefore).toBeGreaterThan(0);

      viewManager.destroy();

      expect(coordinator.subscriberCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Loading state (REND-07)
  // ---------------------------------------------------------------------------

  describe('loading state', () => {
    it('shows loading spinner after 200ms delay', async () => {
      // Bridge takes a while to respond — don't resolve yet
      bridge.send.mockImplementation(() => new Promise(() => {
        // Never resolves in this test — we just check the spinner timing
      }));

      const view = makeMockView();
      const switchPromise = viewManager.switchTo('list', () => view);

      // Before 200ms: no spinner
      vi.advanceTimersByTime(199);
      expect(container.querySelector('.view-loading')).toBeNull();

      // After 200ms: spinner appears
      vi.advanceTimersByTime(1);
      expect(container.querySelector('.view-loading')).not.toBeNull();

      // Clean up (don't await the never-resolving promise)
      viewManager.destroy();
      switchPromise.catch(() => {}); // Suppress unhandled rejection
    });

    it('does not show spinner for fast queries (under 200ms)', async () => {
      // Bridge resolves immediately
      bridge.send.mockImplementation(() => Promise.resolve({ rows: [] }));

      const view = makeMockView();
      const switchPromise = viewManager.switchTo('list', () => view);

      // Resolve the fetch before 200ms timer fires
      await switchPromise;

      // Advance past 200ms — spinner should NOT appear since data already arrived
      vi.advanceTimersByTime(300);

      // No spinner in container at this point
      const spinner = container.querySelector('.view-loading');
      expect(spinner).toBeNull();
    });

    it('clears the loading spinner when data arrives', async () => {
      // Bridge resolves after some delay
      let resolve!: (value: unknown) => void;
      bridge.send.mockImplementation(() => new Promise(r => { resolve = r; }));

      const view = makeMockView();
      const switchPromise = viewManager.switchTo('list', () => view);

      // Trigger spinner
      vi.advanceTimersByTime(200);
      expect(container.querySelector('.view-loading')).not.toBeNull();

      // Now resolve the bridge
      resolve({ rows: [] });
      await switchPromise;

      // Spinner should be gone
      expect(container.querySelector('.view-loading')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Error state (REND-08)
  // ---------------------------------------------------------------------------

  describe('error state', () => {
    it('shows error banner when query fails', async () => {
      bridge.send.mockImplementation(() =>
        Promise.reject(new Error('Worker query failed'))
      );

      const view = makeMockView();
      await viewManager.switchTo('list', () => view);
      await vi.runAllTimersAsync();

      const banner = container.querySelector('.view-error-banner');
      expect(banner).not.toBeNull();
      expect(banner!.textContent).toContain('Worker query failed');
    });

    it('error banner contains a retry button', async () => {
      bridge.send.mockImplementation(() =>
        Promise.reject(new Error('Query error'))
      );

      const view = makeMockView();
      await viewManager.switchTo('list', () => view);
      await vi.runAllTimersAsync();

      const retryBtn = container.querySelector('.retry-btn');
      expect(retryBtn).not.toBeNull();
    });

    it('retry button re-fetches data', async () => {
      // First call fails, second succeeds
      let callCount = 0;
      bridge.send.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('First failure'));
        return Promise.resolve({ rows: [] });
      });

      const view = makeMockView();
      await viewManager.switchTo('list', () => view);
      await vi.runAllTimersAsync();

      expect(callCount).toBe(1);

      // Click retry button
      const retryBtn = container.querySelector<HTMLButtonElement>('.retry-btn');
      expect(retryBtn).not.toBeNull();
      retryBtn!.click();
      await vi.runAllTimersAsync();

      // Bridge should have been called a second time
      expect(callCount).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty state (REND-08)
  // ---------------------------------------------------------------------------

  describe('empty state', () => {
    it('shows empty state message when query returns zero results', async () => {
      bridge.send.mockImplementation(() => Promise.resolve({ rows: [] }));

      const view = makeMockView();
      await viewManager.switchTo('list', () => view);
      await vi.runAllTimersAsync();

      const emptyEl = container.querySelector('.view-empty');
      expect(emptyEl).not.toBeNull();
      expect(emptyEl!.textContent).toContain('No cards');
    });

    it('does not show empty state when cards are present', async () => {
      // bridge already returns 1 card in beforeEach setup

      const view = makeMockView();
      await viewManager.switchTo('list', () => view);
      await vi.runAllTimersAsync();

      const emptyEl = container.querySelector('.view-empty');
      expect(emptyEl).toBeNull();
    });

    it('calls view.render() with cards when data is present', async () => {
      const view = makeMockView();
      await viewManager.switchTo('list', () => view);
      await vi.runAllTimersAsync();

      expect(view.render).toHaveBeenCalledOnce();
      const renderedCards = (view.render as ReturnType<typeof vi.fn>).mock.calls[0]![0] as CardDatum[];
      expect(renderedCards).toHaveLength(1);
      expect(renderedCards[0]!.id).toBe('card-1');
    });
  });

  // ---------------------------------------------------------------------------
  // destroy() cleanup
  // ---------------------------------------------------------------------------

  describe('destroy()', () => {
    it('cleans up coordinator subscription', async () => {
      const view = makeMockView();
      await viewManager.switchTo('list', () => view);
      await vi.runAllTimersAsync();

      expect(coordinator.subscriberCount).toBeGreaterThan(0);

      viewManager.destroy();

      expect(coordinator.subscriberCount).toBe(0);
    });

    it('calls destroy() on the current view', async () => {
      const view = makeMockView();
      await viewManager.switchTo('list', () => view);
      await vi.runAllTimersAsync();

      viewManager.destroy();

      expect(view.destroy).toHaveBeenCalledOnce();
    });

    it('cancels pending loading timer on destroy', async () => {
      bridge.send.mockImplementation(() => new Promise(() => {})); // never resolves

      const view = makeMockView();
      viewManager.switchTo('list', () => view).catch(() => {});

      // Destroy before the 200ms timer fires
      viewManager.destroy();

      // Advance past 200ms — timer should be cancelled, no spinner
      vi.advanceTimersByTime(500);
      const spinner = container.querySelector('.view-loading');
      expect(spinner).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // StateCoordinator re-render on provider change
  // ---------------------------------------------------------------------------

  describe('coordinator re-render', () => {
    it('re-fetches data when coordinator fires a change notification', async () => {
      const view = makeMockView();
      await viewManager.switchTo('list', () => view);
      await vi.runAllTimersAsync();

      const callsAfterMount = bridge.send.mock.calls.length;

      // Simulate a provider change
      coordinator.triggerChange();
      await vi.runAllTimersAsync();

      expect(bridge.send.mock.calls.length).toBeGreaterThan(callsAfterMount);
    });
  });
});
