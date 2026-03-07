// Isometry v5 — Phase 4 StateManager
// Tier 2 persistence coordinator — persist/restore provider state via WorkerBridge.
//
// Design:
//   - Manages a registry of PersistableProvider instances keyed by string
//   - markDirty() triggers debounced writes at 500ms (configurable)
//   - restore() fetches all ui_state rows via bridge.send('ui:getAll')
//   - Corrupt JSON for one provider resets ONLY that provider (isolation guarantee)
//   - enableAutoPersist() subscribes to all providers via their subscribe() method
//   - destroy() clears all timers and unsubscribes from all providers
//
// Requirements: PROV-10

import type { WorkerBridge } from '../worker/WorkerBridge';
import type { PersistableProvider } from './types';

// ---------------------------------------------------------------------------
// Provider interface extension for subscription support
// ---------------------------------------------------------------------------

/**
 * Providers that support auto-persist must expose a subscribe() method.
 * FilterProvider, PAFVProvider, and DensityProvider all implement this.
 */
interface SubscribableProvider extends PersistableProvider {
	subscribe(callback: () => void): () => void;
}

function isSubscribable(provider: PersistableProvider): provider is SubscribableProvider {
	return typeof (provider as SubscribableProvider).subscribe === 'function';
}

// ---------------------------------------------------------------------------
// StateManager
// ---------------------------------------------------------------------------

/**
 * Coordinates persistence of Tier 2 provider state to the ui_state table
 * via WorkerBridge. Tier 3 providers (SelectionProvider) are not registered.
 *
 * Usage:
 * ```typescript
 * const sm = new StateManager(bridge);
 * sm.registerProvider('filter', filterProvider);
 * sm.registerProvider('axis', axisProvider);
 * sm.registerProvider('density', densityProvider);
 *
 * // On app start:
 * await sm.restore();
 * sm.enableAutoPersist();
 *
 * // On app exit:
 * sm.destroy();
 * ```
 */
export class StateManager {
	/** Registry of persistable providers keyed by ui_state key */
	private readonly _providers = new Map<string, PersistableProvider>();

	/** Active debounce timers keyed by provider key */
	private readonly _debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

	/** Unsubscribe functions from enableAutoPersist(), keyed by provider key */
	private readonly _autoPersistUnsubs = new Map<string, () => void>();

	constructor(
		private readonly bridge: WorkerBridge,
		private readonly debounceMs: number = 500,
	) {}

	// ---------------------------------------------------------------------------
	// Registration
	// ---------------------------------------------------------------------------

	/**
	 * Register a Tier 2 provider for persistence management.
	 * The key is used as the ui_state table key.
	 *
	 * @param key - Storage key (e.g. 'filter', 'axis', 'density')
	 * @param provider - Provider implementing PersistableProvider
	 */
	registerProvider(key: string, provider: PersistableProvider): void {
		this._providers.set(key, provider);
	}

	// ---------------------------------------------------------------------------
	// Dirty marking and debounced persistence
	// ---------------------------------------------------------------------------

	/**
	 * Mark a provider as dirty, scheduling a debounced write.
	 * If already dirty, the timer is reset (leading edge suppression).
	 * Multiple rapid changes produce exactly one write after debounceMs.
	 *
	 * No-op if the key is not registered.
	 *
	 * @param key - Registered provider key
	 */
	markDirty(key: string): void {
		const provider = this._providers.get(key);
		if (provider === undefined) return;

		// Clear existing timer to reset debounce window
		const existing = this._debounceTimers.get(key);
		if (existing !== undefined) {
			clearTimeout(existing);
		}

		// Set new timer — fires after debounceMs of inactivity
		const timerId = setTimeout(() => {
			this._debounceTimers.delete(key);
			// Fire and forget — errors logged in persist()
			void this._persist(key, provider);
		}, this.debounceMs);

		this._debounceTimers.set(key, timerId);
	}

	// ---------------------------------------------------------------------------
	// Direct persistence
	// ---------------------------------------------------------------------------

	/**
	 * Immediately persist a single provider (bypasses debounce).
	 *
	 * @param key - Registered provider key
	 */
	async persist(key: string): Promise<void> {
		const provider = this._providers.get(key);
		if (provider === undefined) return;
		await this._persist(key, provider);
	}

	/**
	 * Immediately persist all registered providers (bypasses debounce).
	 * Clears any pending debounce timers for persisted providers.
	 */
	async persistAll(): Promise<void> {
		const persists: Promise<void>[] = [];
		for (const [key, provider] of this._providers) {
			// Clear pending debounce — we're writing now
			const existing = this._debounceTimers.get(key);
			if (existing !== undefined) {
				clearTimeout(existing);
				this._debounceTimers.delete(key);
			}
			persists.push(this._persist(key, provider));
		}
		await Promise.all(persists);
	}

	// ---------------------------------------------------------------------------
	// Restore
	// ---------------------------------------------------------------------------

	/**
	 * Restore all registered providers from ui_state via WorkerBridge.
	 *
	 * For each stored row:
	 *   - If a registered provider matches the key, parse JSON and call setState()
	 *   - If JSON is corrupt or setState() throws: log warning, call resetToDefaults()
	 *   - If no registered provider for a key: skip (no-op)
	 *
	 * Providers with no stored key are left at their default state.
	 *
	 * Explicit call required — app startup controls timing.
	 */
	async restore(): Promise<void> {
		const rows = await this.bridge.send('ui:getAll', {});

		for (const row of rows) {
			const provider = this._providers.get(row.key);
			if (provider === undefined) continue;

			try {
				const parsed: unknown = JSON.parse(row.value);
				provider.setState(parsed);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.warn(`[StateManager] Failed to restore provider "${row.key}": ${message}. Resetting to defaults.`);
				provider.resetToDefaults();
			}
		}
	}

	// ---------------------------------------------------------------------------
	// Auto-persist subscription management
	// ---------------------------------------------------------------------------

	/**
	 * Subscribe to all registered providers and call markDirty() when they change.
	 * Providers must expose a subscribe() method (all Tier 2 providers do).
	 *
	 * Calling this multiple times is safe — existing subscriptions are replaced.
	 */
	enableAutoPersist(): void {
		// Clear existing subscriptions before re-subscribing
		this._clearAutoPersistSubs();

		for (const [key, provider] of this._providers) {
			if (!isSubscribable(provider)) continue;

			const unsubscribe = provider.subscribe(() => {
				this.markDirty(key);
			});

			this._autoPersistUnsubs.set(key, unsubscribe);
		}
	}

	/**
	 * Unsubscribe from all provider change events.
	 * After calling this, state changes will not automatically trigger persistence.
	 */
	disableAutoPersist(): void {
		this._clearAutoPersistSubs();
	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Clean up all pending timers and auto-persist subscriptions.
	 * Safe to call multiple times. After destroy(), the instance should not be used.
	 */
	destroy(): void {
		// Clear all debounce timers
		for (const timerId of this._debounceTimers.values()) {
			clearTimeout(timerId);
		}
		this._debounceTimers.clear();

		// Unsubscribe from all providers
		this._clearAutoPersistSubs();
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/**
	 * Persist a single provider to the bridge (internal, no debounce).
	 */
	private async _persist(key: string, provider: PersistableProvider): Promise<void> {
		const value = provider.toJSON();
		await this.bridge.send('ui:set', { key, value });
	}

	/**
	 * Call all auto-persist unsubscribe functions and clear the map.
	 */
	private _clearAutoPersistSubs(): void {
		for (const unsub of this._autoPersistUnsubs.values()) {
			unsub();
		}
		this._autoPersistUnsubs.clear();
	}
}
