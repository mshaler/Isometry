// Isometry v5 — StateCoordinator
// Cross-provider change batching for view notifications.
//
// Design decisions:
//   - Providers self-notify via queueMicrotask (individual changes)
//   - StateCoordinator batches cross-provider notifications via setTimeout(16)
//   - setTimeout fires AFTER all microtasks drain: all providers settle first,
//     then coordinator fires once — preventing redundant view queries
//   - Providers don't know about each other; StateCoordinator is the only class
//     that knows all registered providers (PROV-09)

/**
 * Minimal interface for any provider that supports subscription.
 * StateCoordinator only cares that it can subscribe to change notifications.
 */
interface SubscribableProvider {
	subscribe(cb: () => void): () => void;
}

/**
 * StateCoordinator subscribes to all registered providers and batches their
 * change notifications into a single coordinated notification for views.
 *
 * When multiple providers change in the same frame, views receive ONE update
 * notification (after ~16ms) rather than one per provider.
 */
export class StateCoordinator {
	private readonly providerUnsubs = new Map<string, () => void>();
	private readonly subscribers = new Set<() => void>();
	private pendingUpdate: ReturnType<typeof setTimeout> | null = null;

	// ---------------------------------------------------------------------------
	// Provider registration
	// ---------------------------------------------------------------------------

	/**
	 * Register a provider to monitor. StateCoordinator subscribes immediately
	 * and will include this provider's changes in its batched notifications.
	 *
	 * @param key - Unique name for this provider (e.g., 'filter', 'pafv')
	 * @param provider - Any object with a subscribe() method
	 */
	registerProvider(key: string, provider: SubscribableProvider): void {
		// Unregister first if re-registering same key
		this.unregisterProvider(key);

		const unsub = provider.subscribe(() => {
			this.scheduleUpdate();
		});
		this.providerUnsubs.set(key, unsub);
	}

	/**
	 * Unregister a provider and stop monitoring its changes.
	 */
	unregisterProvider(key: string): void {
		const unsub = this.providerUnsubs.get(key);
		if (unsub) {
			unsub();
			this.providerUnsubs.delete(key);
		}
	}

	// ---------------------------------------------------------------------------
	// View subscriptions
	// ---------------------------------------------------------------------------

	/**
	 * Subscribe to batched provider change notifications.
	 * Fires approximately 16ms after any registered provider changes
	 * (using setTimeout to ensure all microtasks have settled first).
	 *
	 * @returns An unsubscribe function — call it in view destroy() to prevent leaks.
	 */
	subscribe(cb: () => void): () => void {
		this.subscribers.add(cb);
		return () => this.subscribers.delete(cb);
	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Tear down the coordinator: cancel pending timers and unsubscribe from all
	 * registered providers. Call this when the coordinator goes out of scope.
	 */
	destroy(): void {
		if (this.pendingUpdate !== null) {
			clearTimeout(this.pendingUpdate);
			this.pendingUpdate = null;
		}
		for (const unsub of this.providerUnsubs.values()) {
			unsub();
		}
		this.providerUnsubs.clear();
	}

	// ---------------------------------------------------------------------------
	// Update scheduling
	// ---------------------------------------------------------------------------

	/**
	 * Schedule a batched notification.
	 * If already scheduled, this is a no-op — the existing timer fires once.
	 * setTimeout(16) fires AFTER all queueMicrotask callbacks have resolved,
	 * so all provider self-notifications settle before views are notified.
	 *
	 * Public so external code (e.g., sync-complete listener) can trigger
	 * a coordinated view refresh without being a registered provider.
	 */
	scheduleUpdate(): void {
		if (this.pendingUpdate !== null) return;
		this.pendingUpdate = setTimeout(() => {
			this.pendingUpdate = null;
			for (const cb of this.subscribers) {
				cb();
			}
		}, 16);
	}
}
