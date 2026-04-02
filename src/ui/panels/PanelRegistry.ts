// Isometry — Phase 135.2 Plan 01
// PanelRegistry: lifecycle management for plugin-based explorer panels.
//
// Design:
//   - Panels are registered with metadata and a factory function
//   - Enable/disable with automatic dependency enforcement (D-02)
//   - broadcastUpdate() calls update() on all enabled panel instances (D-03)
//   - onChange listener for UI re-render on toggle
//   - getOrder/setOrder supports drag-to-reorder persistence

import type { PanelFactory, PanelHook, PanelMeta } from './PanelTypes';

// ---------------------------------------------------------------------------
// Internal entry
// ---------------------------------------------------------------------------

interface PanelEntry {
	meta: PanelMeta;
	factory: PanelFactory;
	instance: PanelHook | null; // null when disabled
}

// ---------------------------------------------------------------------------
// PanelRegistry
// ---------------------------------------------------------------------------

export class PanelRegistry {
	/** Insertion-ordered map preserving registration order. */
	private _panels: Map<string, PanelEntry> = new Map();
	private _enabled: Set<string> = new Set();
	/** Explicit panel order (supports drag-to-reorder). Defaults to insertion order. */
	private _order: string[] = [];
	private _listeners: Array<() => void> = [];

	// -----------------------------------------------------------------------
	// Registration
	// -----------------------------------------------------------------------

	/** Register a panel with its metadata and factory. Auto-enables if defaultEnabled. */
	register(meta: PanelMeta, factory: PanelFactory): void {
		this._panels.set(meta.id, { meta, factory, instance: null });
		this._order.push(meta.id);
		if (meta.defaultEnabled) {
			this._enableSingle(meta.id);
		}
	}

	// -----------------------------------------------------------------------
	// Enable / Disable
	// -----------------------------------------------------------------------

	/** Enable a panel, auto-enabling its dependencies (D-02). */
	enable(id: string): void {
		if (!this._panels.has(id)) return;
		this._enableWithDeps(id);
		this._notify();
	}

	/** Disable a panel, auto-disabling its dependents. */
	disable(id: string): void {
		if (!this._panels.has(id)) return;
		this._disableWithDependents(id);
		this._notify();
	}

	/** Check if a panel is currently enabled. */
	isEnabled(id: string): boolean {
		return this._enabled.has(id);
	}

	// -----------------------------------------------------------------------
	// Queries
	// -----------------------------------------------------------------------

	/** Return all registered panel metadata in current order. */
	getAll(): PanelMeta[] {
		return this._order
			.filter((id) => this._panels.has(id))
			.map((id) => this._panels.get(id)!.meta);
	}

	/** Return only enabled panel metadata in current order. */
	getEnabled(): PanelMeta[] {
		return this.getAll().filter((m) => this._enabled.has(m.id));
	}

	/** Return the active PanelHook instance for a panel, or null if disabled/not found. */
	getInstance(id: string): PanelHook | null {
		return this._panels.get(id)?.instance ?? null;
	}

	/** Return panel IDs in current display order. */
	getOrder(): string[] {
		return [...this._order];
	}

	// -----------------------------------------------------------------------
	// Order management
	// -----------------------------------------------------------------------

	/**
	 * Set explicit panel order (for drag-to-reorder persistence).
	 * IDs not present in the registry are silently ignored.
	 */
	setOrder(ids: string[]): void {
		const known = new Set(this._panels.keys());
		// Start with explicitly ordered IDs that exist in registry
		const ordered = ids.filter((id) => known.has(id));
		// Append any registered IDs not present in the supplied order
		for (const id of this._order) {
			if (!ordered.includes(id)) {
				ordered.push(id);
			}
		}
		this._order = ordered;
		this._notify();
	}

	// -----------------------------------------------------------------------
	// Update broadcast
	// -----------------------------------------------------------------------

	/** Call update() on all enabled panel instances that implement it (D-03). */
	broadcastUpdate(): void {
		for (const id of this._enabled) {
			const entry = this._panels.get(id);
			entry?.instance?.update?.();
		}
	}

	// -----------------------------------------------------------------------
	// Change notification
	// -----------------------------------------------------------------------

	/** Subscribe to registry changes. Returns unsubscribe function. */
	onChange(listener: () => void): () => void {
		this._listeners.push(listener);
		return () => {
			this._listeners = this._listeners.filter((l) => l !== listener);
		};
	}

	// -----------------------------------------------------------------------
	// Destroy
	// -----------------------------------------------------------------------

	/** Destroy all enabled panel instances and clear enabled set. */
	destroyAll(): void {
		for (const entry of this._panels.values()) {
			if (entry.instance) {
				entry.instance.destroy();
				entry.instance = null;
			}
		}
		this._enabled.clear();
	}

	// -----------------------------------------------------------------------
	// Private helpers
	// -----------------------------------------------------------------------

	/** Enable a single panel without dependency traversal. */
	private _enableSingle(id: string): void {
		const entry = this._panels.get(id);
		if (!entry || this._enabled.has(id)) return;
		this._enabled.add(id);
		entry.instance = entry.factory();
	}

	/** Enable a panel and all its transitive dependencies (depth-first). */
	private _enableWithDeps(id: string): void {
		const entry = this._panels.get(id);
		if (!entry) return;

		for (const depId of entry.meta.dependencies) {
			if (!this._enabled.has(depId)) {
				this._enableWithDeps(depId);
			}
		}

		this._enableSingle(id);
	}

	/** Disable a single panel, calling destroy(). */
	private _disableSingle(id: string): void {
		const entry = this._panels.get(id);
		if (!entry || !this._enabled.has(id)) return;

		entry.instance?.destroy();
		entry.instance = null;
		this._enabled.delete(id);
	}

	/** Disable a panel and all panels that transitively depend on it. */
	private _disableWithDependents(id: string): void {
		const dependents = this._findDependents(id);
		for (const depId of dependents) {
			this._disableSingle(depId);
		}
		this._disableSingle(id);
	}

	/** Find all enabled panels that transitively depend on the given ID. */
	private _findDependents(id: string): string[] {
		const result: string[] = [];
		for (const entry of this._panels.values()) {
			if (entry.meta.dependencies.includes(id) && this._enabled.has(entry.meta.id)) {
				result.push(...this._findDependents(entry.meta.id));
				result.push(entry.meta.id);
			}
		}
		return result;
	}

	private _notify(): void {
		for (const listener of this._listeners) {
			listener();
		}
	}
}
