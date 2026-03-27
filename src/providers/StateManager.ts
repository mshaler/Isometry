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
import type { SchemaProvider } from './SchemaProvider';
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

	/** Phase 72 — SchemaProvider for state migration on restore */
	private _schema: SchemaProvider | null = null;

	/** Phase 130 — keys registered as scoped (namespaced per dataset) */
	private readonly _scopedKeys = new Set<string>();

	/** Phase 130 — currently active dataset ID (null = no dataset active) */
	private _activeDatasetId: string | null = null;

	constructor(
		private readonly bridge: WorkerBridge,
		private readonly debounceMs: number = 500,
	) {}

	// ---------------------------------------------------------------------------
	// Schema migration
	// ---------------------------------------------------------------------------

	/**
	 * Wire a SchemaProvider for schema-aware state migration during restore().
	 * Must be called before restore() for migration to take effect.
	 *
	 * @param sp - Initialized SchemaProvider, or null to disable migration
	 */
	setSchemaProvider(sp: SchemaProvider | null): void {
		this._schema = sp;
	}

	// ---------------------------------------------------------------------------
	// Registration
	// ---------------------------------------------------------------------------

	/**
	 * Register a Tier 2 provider for persistence management.
	 * The key is used as the ui_state table key.
	 *
	 * @param key - Storage key (e.g. 'filter', 'axis', 'density')
	 * @param provider - Provider implementing PersistableProvider
	 * @param options - Optional registration options
	 * @param options.scoped - If true, the key is namespaced per active dataset ID
	 */
	registerProvider(key: string, provider: PersistableProvider, options?: { scoped?: boolean }): void {
		if (key.startsWith('preset:')) {
			throw new Error(
				`StateManager: "preset:" prefix is reserved — cannot register provider with key "${key}"`,
			);
		}
		if (options?.scoped) {
			this._scopedKeys.add(key);
		}
		this._providers.set(key, provider);
	}

	// ---------------------------------------------------------------------------
	// Active dataset management (Phase 130)
	// ---------------------------------------------------------------------------

	/**
	 * Set active dataset ID without triggering persist/restore.
	 * Use at boot before restore() to initialize the dataset context.
	 *
	 * @param datasetId - Active dataset ID, or null if no dataset
	 */
	initActiveDataset(datasetId: string | null): void {
		this._activeDatasetId = datasetId;
	}

	/**
	 * Switch the active dataset. Persists current scoped provider state,
	 * resets all scoped providers to defaults, then restores the new dataset's state.
	 *
	 * @param datasetId - New active dataset ID, or null to clear
	 */
	async setActiveDataset(datasetId: string | null): Promise<void> {
		// Persist current scoped state if switching away from an existing dataset
		if (this._activeDatasetId !== null && this._activeDatasetId !== datasetId) {
			const persists: Promise<void>[] = [];
			for (const [key, provider] of this._providers) {
				if (this._scopedKeys.has(key)) {
					// Clear any pending debounce timer — writing now
					const existing = this._debounceTimers.get(key);
					if (existing !== undefined) {
						clearTimeout(existing);
						this._debounceTimers.delete(key);
					}
					persists.push(this._persist(key, provider));
				}
			}
			await Promise.all(persists);
		}

		this._activeDatasetId = datasetId;

		if (datasetId !== null) {
			// Reset all scoped providers to defaults before restoring new dataset state
			for (const [key, provider] of this._providers) {
				if (this._scopedKeys.has(key)) {
					provider.resetToDefaults();
				}
			}
			// Restore scoped providers for new dataset
			await this._restoreScoped();
		}
	}

	/**
	 * Compute the storage key for a provider.
	 * Scoped providers: `{key}:{activeDatasetId}`. Global providers: `{key}`.
	 *
	 * @param providerKey - Registered provider key
	 * @returns Storage key for ui_state table
	 */
	private _storageKey(providerKey: string): string {
		if (this._scopedKeys.has(providerKey) && this._activeDatasetId !== null) {
			return `${providerKey}:${this._activeDatasetId}`;
		}
		return providerKey;
	}

	/**
	 * Restore only scoped providers for the current active dataset.
	 * Used during setActiveDataset() to reload dataset-specific state.
	 */
	private async _restoreScoped(): Promise<void> {
		const rows = await this.bridge.send('ui:getAll', {});
		const rowMap = new Map<string, string>(rows.map((r) => [r.key, r.value]));

		for (const [key, provider] of this._providers) {
			if (!this._scopedKeys.has(key)) continue;
			if (this._activeDatasetId === null) continue;

			const namespacedKey = `${key}:${this._activeDatasetId}`;
			let value: string | undefined = rowMap.get(namespacedKey);

			if (value === undefined) {
				// Check for flat legacy key (migration)
				const flatValue = rowMap.get(key);
				if (flatValue !== undefined) {
					await this.bridge.send('ui:set', { key: namespacedKey, value: flatValue });
					await this.bridge.send('ui:delete', { key });
					value = flatValue;
				}
			}

			if (value === undefined) continue;

			try {
				const parsed: unknown = JSON.parse(value);
				const migrated = this._migrateState(key, parsed);
				provider.setState(migrated);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.warn(
					`[StateManager] Failed to restore scoped provider "${key}": ${message}. Resetting to defaults.`,
				);
				provider.resetToDefaults();
			}
		}
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
		const rowMap = new Map<string, string>(rows.map((r) => [r.key, r.value]));

		for (const [key, provider] of this._providers) {
			let value: string | undefined;

			if (this._scopedKeys.has(key)) {
				// Scoped provider — match namespaced key for active dataset
				if (this._activeDatasetId === null) continue;
				const namespacedKey = `${key}:${this._activeDatasetId}`;
				value = rowMap.get(namespacedKey);

				if (value === undefined) {
					// Migration: flat legacy key found
					const flatValue = rowMap.get(key);
					if (flatValue !== undefined) {
						await this.bridge.send('ui:set', { key: namespacedKey, value: flatValue });
						await this.bridge.send('ui:delete', { key });
						value = flatValue;
					}
				}
			} else {
				// Global provider — match flat key only
				value = rowMap.get(key);
			}

			if (value === undefined) continue;

			try {
				const parsed: unknown = JSON.parse(value);
				const migrated = this._migrateState(key, parsed);
				provider.setState(migrated);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.warn(`[StateManager] Failed to restore provider "${key}": ${message}. Resetting to defaults.`);
				provider.resetToDefaults();
			}
		}
	}

	// ---------------------------------------------------------------------------
	// Private migration helpers
	// ---------------------------------------------------------------------------

	/**
	 * Migrate persisted state to match the current schema.
	 * Routes to provider-specific migration based on key.
	 * Pass-through when SchemaProvider is not wired or not initialized.
	 */
	private _migrateState(key: string, state: unknown): unknown {
		if (!this._schema?.initialized) return state;
		if (typeof state !== 'object' || state === null) return state;

		if (key === 'filter') return this._migrateFilterState(state);
		if (key === 'pafv') return this._migratePAFVState(state);
		return state;
	}

	/**
	 * Prune FilterProvider state entries referencing columns not in the current schema.
	 * - filters[]: entries with unknown field are dropped
	 * - axisFilters{}: keys referencing unknown columns are dropped
	 * - rangeFilters{}: keys referencing unknown columns are dropped
	 */
	private _migrateFilterState(state: unknown): unknown {
		const s = state as Record<string, unknown>;
		const isValid = (f: string) => this._schema!.isValidColumn(f, 'cards');

		const rawFilters = Array.isArray(s['filters']) ? s['filters'] : [];
		const filters = rawFilters.filter(
			(entry: unknown) =>
				typeof entry === 'object' &&
				entry !== null &&
				typeof (entry as Record<string, unknown>)['field'] === 'string' &&
				isValid((entry as Record<string, unknown>)['field'] as string),
		);

		const rawAxisFilters =
			typeof s['axisFilters'] === 'object' && s['axisFilters'] !== null
				? (s['axisFilters'] as Record<string, unknown>)
				: {};
		const axisFilters = Object.fromEntries(Object.entries(rawAxisFilters).filter(([k]) => isValid(k)));

		const rawRangeFilters =
			typeof s['rangeFilters'] === 'object' && s['rangeFilters'] !== null
				? (s['rangeFilters'] as Record<string, unknown>)
				: {};
		const rangeFilters = Object.fromEntries(Object.entries(rawRangeFilters).filter(([k]) => isValid(k)));

		return { ...s, filters, axisFilters, rangeFilters };
	}

	/**
	 * Migrate PAFVProvider state against the current schema.
	 * - xAxis/yAxis/groupBy: null if field is no longer valid
	 * - colAxes/rowAxes: filter entries with invalid fields
	 * - colWidths/sortOverrides/collapseState/viewType/aggregation: pass through unchanged
	 */
	private _migratePAFVState(state: unknown): unknown {
		const s = state as Record<string, unknown>;
		const isValid = (f: string) => this._schema!.isValidColumn(f, 'cards');

		const nullIfInvalid = (axis: unknown): unknown => {
			if (axis === null || axis === undefined) return axis;
			if (typeof axis === 'object' && typeof (axis as Record<string, unknown>)['field'] === 'string') {
				return isValid((axis as Record<string, unknown>)['field'] as string) ? axis : null;
			}
			return axis;
		};

		const filterAxes = (axes: unknown): unknown => {
			if (!Array.isArray(axes)) return axes;
			return axes.filter(
				(axis: unknown) =>
					typeof axis === 'object' &&
					axis !== null &&
					typeof (axis as Record<string, unknown>)['field'] === 'string' &&
					isValid((axis as Record<string, unknown>)['field'] as string),
			);
		};

		return {
			...s,
			xAxis: nullIfInvalid(s['xAxis']),
			yAxis: nullIfInvalid(s['yAxis']),
			groupBy: nullIfInvalid(s['groupBy']),
			colAxes: filterAxes(s['colAxes']),
			rowAxes: filterAxes(s['rowAxes']),
		};
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
	 * Uses _storageKey() to compute the namespaced key for scoped providers.
	 */
	private async _persist(key: string, provider: PersistableProvider): Promise<void> {
		const storageKey = this._storageKey(key);
		const value = provider.toJSON();
		await this.bridge.send('ui:set', { key: storageKey, value });
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
