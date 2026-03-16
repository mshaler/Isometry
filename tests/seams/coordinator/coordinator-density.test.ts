/**
 * Isometry v6.1 — Phase 81 Seam: Coordinator-to-Bridge + Density
 *
 * Tests that filter and density changes propagate through a real StateCoordinator
 * to a bridge spy with correct parameters. The spy replaces ViewManager entirely —
 * no DOM, no Worker, no SuperGrid. The spy captures provider state snapshots
 * (filter.compile() + density.getState()) inside the coordinator callback,
 * proving the seam delivers correct data to the bridge boundary.
 *
 * Requirements: CORD-01, CORD-02, CORD-03, DENS-01, DENS-02
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../../src/database/Database';
import { makeProviders, type ProviderStack } from '../../harness/makeProviders';
import { realDb } from '../../harness/realDb';

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

describe('Phase 81 Coordinator-to-Bridge Seam', () => {
	let db: Database;
	let providers: ProviderStack;

	beforeEach(async () => {
		vi.useFakeTimers();
		db = await realDb();
		providers = makeProviders(db);
	});

	afterEach(() => {
		providers.coordinator.destroy();
		db.close();
		vi.useRealTimers();
	});

	// -------------------------------------------------------------------------
	// CORD-01: Filter change propagates to bridge params
	// -------------------------------------------------------------------------

	describe('CORD-01: filter change propagates to bridge params', () => {
		it('single filter change fires bridge spy once with correct filter params', async () => {
			const { coordinator, filter } = providers;
			const bridgeSpy = vi.fn();

			coordinator.subscribe(() => {
				const compiled = filter.compile();
				const densityState = providers.density.getState();
				bridgeSpy({ ...compiled, densityState });
			});

			filter.setAxisFilter('folder', ['Work']);
			await flushCoordinatorCycle();

			expect(bridgeSpy).toHaveBeenCalledTimes(1);

			const call = bridgeSpy.mock.calls[0]?.[0] as ReturnType<typeof filter.compile> & {
				densityState: ReturnType<typeof providers.density.getState>;
			};
			expect(call.where).toContain('folder');
			expect(call.params).toContain('Work');
		});

		it('different filter type also propagates correct params', async () => {
			const { coordinator, filter } = providers;
			const bridgeSpy = vi.fn();

			coordinator.subscribe(() => {
				const compiled = filter.compile();
				const densityState = providers.density.getState();
				bridgeSpy({ ...compiled, densityState });
			});

			filter.setAxisFilter('status', ['active']);
			await flushCoordinatorCycle();

			expect(bridgeSpy).toHaveBeenCalledTimes(1);

			const call = bridgeSpy.mock.calls[0]?.[0] as ReturnType<typeof filter.compile> & {
				densityState: ReturnType<typeof providers.density.getState>;
			};
			expect(call.where).toContain('status');
			expect(call.params).toContain('active');
		});
	});

	// -------------------------------------------------------------------------
	// CORD-02: Rapid filter changes batch into one re-query
	// -------------------------------------------------------------------------

	describe('CORD-02: rapid filter changes batch into one re-query', () => {
		it('3 distinct synchronous filter mutations produce exactly 1 spy call with final state', async () => {
			const { coordinator, filter } = providers;
			const bridgeSpy = vi.fn();

			coordinator.subscribe(() => {
				const compiled = filter.compile();
				const densityState = providers.density.getState();
				bridgeSpy({ ...compiled, densityState });
			});

			// 3 rapid synchronous mutations — each replaces the previous axis filter
			filter.setAxisFilter('folder', ['Film']);
			filter.setAxisFilter('folder', ['Film', 'Award']);
			filter.setAxisFilter('folder', ['Film', 'Award', 'Doc']);

			await flushCoordinatorCycle();

			// Must batch into exactly ONE bridge call
			expect(bridgeSpy).toHaveBeenCalledTimes(1);

			// The single call must contain the FINAL filter state
			const call = bridgeSpy.mock.calls[0]?.[0] as ReturnType<typeof filter.compile> & {
				densityState: ReturnType<typeof providers.density.getState>;
			};
			expect(call.params).toContain('Film');
			expect(call.params).toContain('Award');
			expect(call.params).toContain('Doc');
		});
	});

	// -------------------------------------------------------------------------
	// CORD-03: Destroy prevents stale re-queries
	// -------------------------------------------------------------------------

	describe('CORD-03: destroy prevents stale re-queries', () => {
		it('after destroy, filter and density mutations do not trigger bridge spy', async () => {
			const { coordinator, filter, density } = providers;
			const bridgeSpy = vi.fn();

			coordinator.subscribe(() => {
				const compiled = filter.compile();
				const densityState = density.getState();
				bridgeSpy({ ...compiled, densityState });
			});

			// Destroy coordinator before any mutations
			coordinator.destroy();

			// Trigger both filter and density mutations post-destroy
			filter.setAxisFilter('folder', ['Work']);
			density.setHideEmpty(true);

			vi.advanceTimersByTime(100);
			await Promise.resolve();
			await Promise.resolve();

			expect(bridgeSpy).not.toHaveBeenCalled();
		});

		it('destroy mid-batch cancels pending coordinator callback', async () => {
			const { coordinator, filter } = providers;
			const bridgeSpy = vi.fn();

			coordinator.subscribe(() => {
				const compiled = filter.compile();
				const densityState = providers.density.getState();
				bridgeSpy({ ...compiled, densityState });
			});

			// Trigger filter change to start the coordinator timer
			filter.setAxisFilter('folder', ['Film']);

			// Flush microtasks only — provider self-notify fires, coordinator timer is pending
			await Promise.resolve();
			await Promise.resolve();

			// Destroy coordinator BEFORE the timer fires
			coordinator.destroy();

			// Advance past the 16ms window
			vi.advanceTimersByTime(20);
			await Promise.resolve();

			// Timer was cancelled by destroy — callback should NOT fire
			expect(bridgeSpy).not.toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------------
	// DENS-01: hideEmpty and viewMode propagate to bridge params
	// -------------------------------------------------------------------------

	describe('DENS-01: hideEmpty and viewMode propagate to bridge params', () => {
		it('hideEmpty change propagates to bridge spy with hideEmpty: true', async () => {
			const { coordinator, filter, density } = providers;
			const bridgeSpy = vi.fn();

			coordinator.subscribe(() => {
				const compiled = filter.compile();
				const densityState = density.getState();
				bridgeSpy({ ...compiled, densityState });
			});

			density.setHideEmpty(true);
			await flushCoordinatorCycle();

			expect(bridgeSpy).toHaveBeenCalledTimes(1);

			const call = bridgeSpy.mock.calls[0]?.[0] as ReturnType<typeof filter.compile> & {
				densityState: ReturnType<typeof density.getState>;
			};
			expect(call.densityState.hideEmpty).toBe(true);
		});

		it('viewMode change propagates to bridge spy with correct viewMode', async () => {
			const { coordinator, filter, density } = providers;
			const bridgeSpy = vi.fn();

			coordinator.subscribe(() => {
				const compiled = filter.compile();
				const densityState = density.getState();
				bridgeSpy({ ...compiled, densityState });
			});

			density.setViewMode('matrix');
			await flushCoordinatorCycle();

			expect(bridgeSpy).toHaveBeenCalledTimes(1);

			const call = bridgeSpy.mock.calls[0]?.[0] as ReturnType<typeof filter.compile> & {
				densityState: ReturnType<typeof density.getState>;
			};
			expect(call.densityState.viewMode).toBe('matrix');
		});
	});

	// -------------------------------------------------------------------------
	// DENS-02: Density provider changes trigger coordinator (regression guard)
	// -------------------------------------------------------------------------

	describe('DENS-02: density provider changes trigger coordinator (regression guard)', () => {
		it('density mutation fires coordinator callback — registration is intact', async () => {
			const { coordinator, filter, density } = providers;
			const bridgeSpy = vi.fn();

			coordinator.subscribe(() => {
				const compiled = filter.compile();
				const densityState = density.getState();
				bridgeSpy({ ...compiled, densityState });
			});

			density.setHideEmpty(true);
			await flushCoordinatorCycle();

			// If this fails, the coordinator-density registration is broken
			expect(bridgeSpy).toHaveBeenCalled();
		});
	});
});
