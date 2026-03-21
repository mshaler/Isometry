// Isometry v5 — Phase 98 PluginRegistry
// Composable plugin registry for SuperGrid features.
//
// Design:
//   - Plugins are registered with metadata (id, deps) and a factory function
//   - Enable/disable with automatic dependency enforcement
//   - Pipeline hooks: transformData → transformLayout → render → afterRender
//   - Factory creates fresh instances on enable; destroy() called on disable
//   - onChange listener for UI re-render on toggle
//
// Requirements: HAR-01, HAR-02, HAR-03, HAR-09

import type {
	CellPlacement,
	GridLayout,
	PluginFactory,
	PluginHook,
	PluginMeta,
	RenderContext,
	ToggleState,
} from './PluginTypes';

// ---------------------------------------------------------------------------
// Internal entry
// ---------------------------------------------------------------------------

interface PluginEntry {
	meta: PluginMeta;
	factory: PluginFactory;
	instance: PluginHook | null; // null when disabled
}

// ---------------------------------------------------------------------------
// PluginRegistry
// ---------------------------------------------------------------------------

export class PluginRegistry {
	/** Insertion-ordered map preserving registration order for pipeline execution. */
	private _plugins: Map<string, PluginEntry> = new Map();
	private _enabled: Set<string> = new Set();
	private _listeners: Array<() => void> = [];

	// -----------------------------------------------------------------------
	// Registration
	// -----------------------------------------------------------------------

	/** Register a plugin with its metadata and factory. */
	register(meta: PluginMeta, factory: PluginFactory): void {
		this._plugins.set(meta.id, { meta, factory, instance: null });
		if (meta.defaultEnabled) {
			this._enableSingle(meta.id);
		}
	}

	// -----------------------------------------------------------------------
	// Enable / Disable
	// -----------------------------------------------------------------------

	/** Enable a plugin, auto-enabling its dependencies. */
	enable(id: string): void {
		if (!this._plugins.has(id)) return;
		this._enableWithDeps(id);
		this._notify();
	}

	/** Disable a plugin, auto-disabling its dependents. */
	disable(id: string): void {
		if (!this._plugins.has(id)) return;
		this._disableWithDependents(id);
		this._notify();
	}

	/** Check if a plugin is currently enabled. */
	isEnabled(id: string): boolean {
		return this._enabled.has(id);
	}

	// -----------------------------------------------------------------------
	// Queries
	// -----------------------------------------------------------------------

	/** Return all registered plugin metadata (in registration order). */
	getAll(): PluginMeta[] {
		return [...this._plugins.values()].map((e) => e.meta);
	}

	/** Return plugin IDs in registration order (Map insertion-order guarantee). */
	getRegistrationOrder(): string[] {
		return [...this._plugins.keys()];
	}

	/** Return IDs of plugins whose factory is still a noop stub. */
	getStubIds(): string[] {
		return [...this._plugins.entries()]
			.filter(([, e]) => '__isNoopStub' in e.factory)
			.map(([id]) => id);
	}

	/** Return only enabled plugin metadata. */
	getEnabled(): PluginMeta[] {
		return this.getAll().filter((m) => this._enabled.has(m.id));
	}

	/** Group all plugins by category. */
	getByCategory(): Map<string, PluginMeta[]> {
		const grouped = new Map<string, PluginMeta[]>();
		for (const entry of this._plugins.values()) {
			const cat = entry.meta.category;
			if (!grouped.has(cat)) grouped.set(cat, []);
			grouped.get(cat)!.push(entry.meta);
		}
		return grouped;
	}

	// -----------------------------------------------------------------------
	// Pipeline execution
	// -----------------------------------------------------------------------

	/** Run transformData hooks on all enabled plugins (in registration order). */
	runTransformData(cells: CellPlacement[], ctx: RenderContext): CellPlacement[] {
		let result = cells;
		for (const entry of this._plugins.values()) {
			if (!this._enabled.has(entry.meta.id) || !entry.instance?.transformData) continue;
			result = entry.instance.transformData(result, ctx);
		}
		return result;
	}

	/** Run transformLayout hooks on all enabled plugins. */
	runTransformLayout(layout: GridLayout, ctx: RenderContext): GridLayout {
		let result = layout;
		for (const entry of this._plugins.values()) {
			if (!this._enabled.has(entry.meta.id) || !entry.instance?.transformLayout) continue;
			result = entry.instance.transformLayout(result, ctx);
		}
		return result;
	}

	/** Run afterRender hooks on all enabled plugins. */
	runAfterRender(root: HTMLElement, ctx: RenderContext): void {
		for (const entry of this._plugins.values()) {
			if (!this._enabled.has(entry.meta.id) || !entry.instance?.afterRender) continue;
			entry.instance.afterRender(root, ctx);
		}
	}

	/** Run onScroll hooks on all enabled plugins. */
	runOnScroll(scrollLeft: number, scrollTop: number, ctx: RenderContext): void {
		for (const entry of this._plugins.values()) {
			if (!this._enabled.has(entry.meta.id) || !entry.instance?.onScroll) continue;
			entry.instance.onScroll(scrollLeft, scrollTop, ctx);
		}
	}

	/** Run onPointerEvent hooks. Returns true if any plugin consumed the event. */
	runOnPointerEvent(type: string, e: PointerEvent, ctx: RenderContext): boolean {
		for (const entry of this._plugins.values()) {
			if (!this._enabled.has(entry.meta.id) || !entry.instance?.onPointerEvent) continue;
			if (entry.instance.onPointerEvent(type, e, ctx)) return true;
		}
		return false;
	}

	// -----------------------------------------------------------------------
	// State persistence
	// -----------------------------------------------------------------------

	/** Export current toggle state for localStorage. */
	saveState(): ToggleState {
		return {
			enabled: [...this._enabled],
			dataSource: 'mock',
		};
	}

	/** Restore toggle state. Silently skips unknown IDs. */
	restoreState(state: ToggleState): void {
		// Disable all first
		for (const id of [...this._enabled]) {
			this._disableSingle(id);
		}
		// Enable saved set
		for (const id of state.enabled) {
			if (this._plugins.has(id)) {
				this._enableSingle(id);
			}
		}
	}

	// -----------------------------------------------------------------------
	// Change notification
	// -----------------------------------------------------------------------

	/** Subscribe to toggle changes. Returns unsubscribe function. */
	onChange(listener: () => void): () => void {
		this._listeners.push(listener);
		return () => {
			this._listeners = this._listeners.filter((l) => l !== listener);
		};
	}

	// -----------------------------------------------------------------------
	// Factory replacement
	// -----------------------------------------------------------------------

	/**
	 * Replace the factory for an already-registered plugin.
	 *
	 * If the plugin is currently enabled, the old instance is destroyed and
	 * a new instance is created from the new factory immediately.
	 * Silently ignores unknown plugin IDs.
	 */
	setFactory(id: string, factory: PluginFactory): void {
		const entry = this._plugins.get(id);
		if (!entry) return;
		// If currently enabled, destroy old instance and create new one from new factory
		if (this._enabled.has(id) && entry.instance) {
			entry.instance.destroy?.();
			entry.instance = factory();
		}
		entry.factory = factory;
	}

	// -----------------------------------------------------------------------
	// Destroy all
	// -----------------------------------------------------------------------

	/** Destroy all enabled plugin instances. */
	destroyAll(): void {
		for (const entry of this._plugins.values()) {
			if (entry.instance?.destroy) {
				entry.instance.destroy();
			}
			entry.instance = null;
		}
		this._enabled.clear();
	}

	// -----------------------------------------------------------------------
	// Internal helpers
	// -----------------------------------------------------------------------

	/** Enable a single plugin without dependency traversal. */
	private _enableSingle(id: string): void {
		const entry = this._plugins.get(id);
		if (!entry) return;
		if (this._enabled.has(id)) return;
		this._enabled.add(id);
		entry.instance = entry.factory();
	}

	/** Enable a plugin and all its transitive dependencies (depth-first). */
	private _enableWithDeps(id: string): void {
		const entry = this._plugins.get(id);
		if (!entry) return;

		// Enable dependencies first (transitive)
		for (const depId of entry.meta.dependencies) {
			if (!this._enabled.has(depId)) {
				this._enableWithDeps(depId);
			}
		}

		this._enableSingle(id);
	}

	/** Disable a single plugin, calling destroy(). */
	private _disableSingle(id: string): void {
		const entry = this._plugins.get(id);
		if (!entry) return;
		if (!this._enabled.has(id)) return;

		if (entry.instance?.destroy) {
			entry.instance.destroy();
		}
		entry.instance = null;
		this._enabled.delete(id);
	}

	/** Disable a plugin and all plugins that transitively depend on it. */
	private _disableWithDependents(id: string): void {
		// First, find all transitive dependents
		const dependents = this._findDependents(id);

		// Disable dependents first (leaf-to-root order)
		for (const depId of dependents) {
			this._disableSingle(depId);
		}

		// Then disable the target
		this._disableSingle(id);
	}

	/** Find all plugins that transitively depend on the given ID. */
	private _findDependents(id: string): string[] {
		const result: string[] = [];
		for (const entry of this._plugins.values()) {
			if (entry.meta.dependencies.includes(id) && this._enabled.has(entry.meta.id)) {
				// This plugin depends on id — collect it and its dependents
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
