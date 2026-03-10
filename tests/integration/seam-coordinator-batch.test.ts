/**
 * Isometry v5 — Seam 5: StateCoordinator Batching
 *
 * Tests that StateCoordinator correctly batches provider change notifications
 * into a single coordinated callback for views. Validates:
 *   - Single provider change fires exactly one coordinator callback
 *   - Multiple simultaneous provider changes fire exactly one coordinator callback
 *   - Coordinator unsubscribe prevents stale callbacks
 *   - Timer cancellation prevents orphaned timers (v4.2 stuck-spinner fix)
 *
 * No browser needed — pure Vitest with real providers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterProvider } from '../../src/providers/FilterProvider';
import { PAFVProvider } from '../../src/providers/PAFVProvider';
import { SelectionProvider } from '../../src/providers/SelectionProvider';
import { StateCoordinator } from '../../src/providers/StateCoordinator';

// ---------------------------------------------------------------------------
// Utility: flush microtasks + setTimeout(16) used by coordinator
// ---------------------------------------------------------------------------

/**
 * Flush microtasks (provider self-notify) then the coordinator's setTimeout(16).
 * The coordinator fires at setTimeout(16) AFTER all microtasks drain.
 */
async function flushCoordinatorCycle(): Promise<void> {
	// Flush microtasks (provider self-notify via queueMicrotask)
	await Promise.resolve();
	await Promise.resolve();

	// Advance timers past the coordinator's 16ms setTimeout
	vi.advanceTimersByTime(20);

	// Flush any remaining microtasks from the coordinator callback
	await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Seam 5: StateCoordinator batching → multi-view render', () => {
	let coordinator: StateCoordinator;
	let filter: FilterProvider;
	let pafv: PAFVProvider;
	let selection: SelectionProvider;

	beforeEach(() => {
		vi.useFakeTimers();
		coordinator = new StateCoordinator();
		filter = new FilterProvider();
		pafv = new PAFVProvider();
		selection = new SelectionProvider();

		coordinator.registerProvider('filter', filter);
		coordinator.registerProvider('pafv', pafv);
		coordinator.registerProvider('selection', selection);
	});

	afterEach(() => {
		coordinator.destroy();
		vi.useRealTimers();
	});

	// -----------------------------------------------------------------------
	// Single provider change → one coordinator callback
	// -----------------------------------------------------------------------

	it('fires exactly one coordinator callback for a single filter change', async () => {
		const viewCallback = vi.fn();
		coordinator.subscribe(viewCallback);

		// Trigger a single filter change
		filter.setAxisFilter('folder', ['Film']);

		// Before coordinator fires
		expect(viewCallback).not.toHaveBeenCalled();

		await flushCoordinatorCycle();

		expect(viewCallback).toHaveBeenCalledTimes(1);
	});

	// -----------------------------------------------------------------------
	// Multiple simultaneous provider changes → one coordinator callback
	// -----------------------------------------------------------------------

	it('batches multiple simultaneous provider changes into one callback', async () => {
		const viewCallback = vi.fn();
		coordinator.subscribe(viewCallback);

		// Trigger changes on ALL three providers in the same synchronous frame
		filter.setAxisFilter('folder', ['Film']);
		pafv.setColAxes([{ field: 'card_type', direction: 'asc' }]);
		selection.select('card-1');

		// All three providers self-notified via queueMicrotask,
		// but coordinator should batch into ONE setTimeout(16) callback
		await flushCoordinatorCycle();

		expect(viewCallback).toHaveBeenCalledTimes(1);
	});

	// -----------------------------------------------------------------------
	// Sequential changes separated by flush → separate callbacks
	// -----------------------------------------------------------------------

	it('fires separate callbacks for changes in different batching windows', async () => {
		const viewCallback = vi.fn();
		coordinator.subscribe(viewCallback);

		// First change
		filter.setAxisFilter('folder', ['Film']);
		await flushCoordinatorCycle();
		expect(viewCallback).toHaveBeenCalledTimes(1);

		// Second change (new batching window)
		filter.setAxisFilter('folder', ['Film', 'Award']);
		await flushCoordinatorCycle();
		expect(viewCallback).toHaveBeenCalledTimes(2);
	});

	// -----------------------------------------------------------------------
	// Unsubscribe prevents stale callbacks
	// -----------------------------------------------------------------------

	it('unsubscribing from coordinator prevents stale callbacks', async () => {
		const viewCallback = vi.fn();
		const unsub = coordinator.subscribe(viewCallback);

		// Unsubscribe immediately
		unsub();

		filter.setAxisFilter('folder', ['Film']);
		await flushCoordinatorCycle();

		// Should NOT have been called — unsubscribed before the change
		expect(viewCallback).not.toHaveBeenCalled();
	});

	// -----------------------------------------------------------------------
	// Provider unregistration prevents coordinator notification
	// -----------------------------------------------------------------------

	it('unregistering a provider stops its changes from triggering coordinator', async () => {
		const viewCallback = vi.fn();
		coordinator.subscribe(viewCallback);

		// Unregister filter provider
		coordinator.unregisterProvider('filter');

		// Only filter changes — coordinator should not be notified
		// (The filter still self-notifies its own subscribers, but coordinator
		//  no longer subscribes to filter changes after unregisterProvider)
		filter.setAxisFilter('folder', ['Film']);
		await flushCoordinatorCycle();

		// Filter's own subscriber was removed by unregisterProvider, so no scheduleUpdate
		expect(viewCallback).not.toHaveBeenCalled();
	});

	// -----------------------------------------------------------------------
	// Coordinator.destroy() cancels pending timer (v4.2 stuck-spinner fix)
	// -----------------------------------------------------------------------

	it('destroy cancels pending coordinator timer', async () => {
		const viewCallback = vi.fn();
		coordinator.subscribe(viewCallback);

		// Trigger a change to start the coordinator timer
		filter.setAxisFilter('folder', ['Film']);

		// Flush microtasks (provider self-notify fires, scheduleUpdate starts timer)
		await Promise.resolve();
		await Promise.resolve();

		// Destroy coordinator BEFORE the timer fires
		coordinator.destroy();

		// Advance past the 16ms window
		vi.advanceTimersByTime(20);
		await Promise.resolve();

		// Timer was cancelled by destroy — callback should NOT fire
		expect(viewCallback).not.toHaveBeenCalled();
	});

	// -----------------------------------------------------------------------
	// scheduleUpdate idempotency (no duplicate timers)
	// -----------------------------------------------------------------------

	it('multiple scheduleUpdate calls in same window produce one callback', async () => {
		const viewCallback = vi.fn();
		coordinator.subscribe(viewCallback);

		// Manually call scheduleUpdate multiple times (simulates concurrent triggers)
		coordinator.scheduleUpdate();
		coordinator.scheduleUpdate();
		coordinator.scheduleUpdate();

		await flushCoordinatorCycle();

		// Only one callback, despite three scheduleUpdate calls
		expect(viewCallback).toHaveBeenCalledTimes(1);
	});

	// -----------------------------------------------------------------------
	// Provider self-notify fires BEFORE coordinator
	// -----------------------------------------------------------------------

	it('provider subscribers fire (via microtask) before coordinator callback', async () => {
		const callOrder: string[] = [];

		// Provider-level subscriber fires first (queueMicrotask)
		filter.subscribe(() => callOrder.push('filter-subscriber'));

		// Coordinator-level subscriber fires second (setTimeout(16))
		coordinator.subscribe(() => callOrder.push('coordinator'));

		filter.setAxisFilter('folder', ['Film']);

		await flushCoordinatorCycle();

		expect(callOrder).toEqual(['filter-subscriber', 'coordinator']);
	});
});
