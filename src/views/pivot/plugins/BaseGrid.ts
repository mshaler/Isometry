// Isometry v5 — Phase 101 Plan 01 BaseGrid Plugin
// Lifecycle wrapper for core D3 cell rendering.
//
// Design (delegation pattern):
//   PivotGrid.render() already drives the full D3 data join for cell rendering.
//   This plugin exists solely to give 'base.grid' a real factory (not NOOP_FACTORY)
//   in the PluginRegistry. The afterRender hook is intentionally a no-op because
//   the actual rendering happens in PivotGrid directly. The plugin's role is
//   lifecycle presence — it signals to the registry that base.grid is implemented
//   and enables dependency resolution for plugins that depend on it.
//
// Requirements: BASE-01

import type { PluginHook } from './PluginTypes';

/**
 * Factory for the base.grid plugin.
 *
 * Returns a PluginHook with afterRender and destroy lifecycle stubs.
 * Rendering is delegated to PivotGrid.render() which owns the D3 data join.
 */
export function createBaseGridPlugin(): PluginHook {
	return {
		afterRender(): void {
			// No-op: PivotGrid.render() handles the D3 data join cell rendering directly.
		},
		destroy(): void {
			// No cleanup required — PivotGrid manages its own DOM state.
		},
	};
}
