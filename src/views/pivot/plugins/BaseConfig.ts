// Isometry v5 — Phase 101 Plan 01 BaseConfig Plugin
// Lifecycle wrapper for the config panel.
//
// Design (delegation pattern):
//   PivotTable already mounts PivotConfigPanel and manages its lifecycle.
//   This plugin wraps that lifecycle into the plugin system so 'base.config'
//   has a real factory in the PluginRegistry. The afterRender and destroy hooks
//   are intentionally no-ops because PivotTable owns the PivotConfigPanel
//   mount/unmount cycle directly.
//
// Requirements: BASE-03

import type { PluginHook } from './PluginTypes';

/**
 * Factory for the base.config plugin.
 *
 * Returns a PluginHook with afterRender and destroy lifecycle stubs.
 * Config panel mounting is delegated to PivotTable which owns PivotConfigPanel.
 */
export function createBaseConfigPlugin(): PluginHook {
	return {
		afterRender(): void {
			// No-op: PivotTable mounts and manages PivotConfigPanel directly.
		},
		destroy(): void {
			// No cleanup required — PivotTable manages PivotConfigPanel teardown.
		},
	};
}
