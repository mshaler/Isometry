// Isometry — Phase 135.2 Plan 01
// PanelTypes: interfaces for the plugin-based panel architecture.
//
// Design:
//   - PanelMeta: describes a registerable explorer panel
//   - PanelHook: lifecycle hooks a panel plugin implements
//   - PanelFactory: creates a fresh PanelHook instance

// ---------------------------------------------------------------------------
// Panel metadata
// ---------------------------------------------------------------------------

/** Describes a registerable explorer panel with icon and dependency information. */
export interface PanelMeta {
	/** Unique panel ID, e.g., 'properties', 'projection', 'latch', 'calc', 'algorithm', 'notebook'. */
	id: string;
	/** Human-readable name, e.g., 'Properties'. */
	name: string;
	/** Icon name from icons.ts, e.g., 'sliders'. */
	icon: string;
	/** Short description for tooltip/aria-label, e.g., 'Properties'. */
	description: string;
	/** IDs of panels this depends on (auto-enabled per D-02). */
	dependencies: string[];
	/** Whether this panel starts enabled. */
	defaultEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Panel hooks
// ---------------------------------------------------------------------------

/** Lifecycle hooks a panel plugin implements. */
export interface PanelHook {
	/** Mount panel content into the provided container element. */
	mount(container: HTMLElement): void;
	/** Remove panel content without full destroy (optional). */
	unmount?(): void;
	/** Called when drawer width changes (optional). */
	resize?(): void;
	/** Called by PanelRegistry.broadcastUpdate() on demand (D-03). */
	update?(): void;
	/** Full cleanup — remove DOM, event listeners, subscriptions. */
	destroy(): void;
}

// ---------------------------------------------------------------------------
// Panel factory
// ---------------------------------------------------------------------------

/** Factory function that creates a fresh PanelHook instance. */
export type PanelFactory = () => PanelHook;
