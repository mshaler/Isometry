// Isometry v5 — Phase 101 Plan 01 BaseHeaders Plugin
// Lifecycle wrapper for single-level header rendering.
//
// Design (delegation pattern):
//   PivotGrid renders basic single-level headers as part of its Layer 1 table
//   and Layer 2 overlay. The superstack.spanning plugin takes over for multi-level
//   header spanning. This plugin exists so 'base.headers' has a real factory in
//   the PluginRegistry, enabling dependency resolution for downstream plugins
//   (superstack.spanning, supersort.header-click, superscroll.sticky-headers).
//
// Requirements: BASE-02

import type { PluginHook } from './PluginTypes';

/**
 * Factory for the base.headers plugin.
 *
 * Returns a PluginHook with an afterRender lifecycle stub.
 * Header rendering is delegated to PivotGrid which manages the overlay DOM.
 * The superstack.spanning plugin extends this with multi-level span behavior.
 */
export function createBaseHeadersPlugin(): PluginHook {
	return {
		afterRender(): void {
			// No-op: PivotGrid renders single-level headers in its Layer 1 table.
			// Multi-level spanning is handled by superstack.spanning (depends on base.headers).
		},
	};
}
