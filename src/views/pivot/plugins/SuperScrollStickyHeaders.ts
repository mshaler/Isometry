// Isometry v5 — Phase 100 Plan 02 SuperScrollStickyHeaders Plugin
// Ensure column/row header z-index in the overlay for scroll visibility.
//
// Design:
//   - The overlay layer (Layer 2) already provides frozen/sticky headers:
//     column headers use position:absolute with translateX for horizontal scroll
//     tracking, while their vertical position is fixed (overlay is overflow:hidden).
//   - This plugin ensures proper z-index layering so headers remain visible
//     above data cells during scrolling.
//   - IMPORTANT: Do NOT change position from absolute to sticky — the overlay's
//     absolute-positioned coordinate system is load-bearing for header alignment.
//
// Requirements: SCRL-02

import type { PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STICKY_Z_INDEX = 20;

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the superscroll.sticky-headers plugin.
 * Ensures proper z-index layering on header elements in the overlay.
 *
 * Note: The overlay architecture already provides frozen/sticky behavior —
 * headers are position:absolute in a non-scrolling overlay layer. This plugin
 * reinforces z-index so headers render above any scroll-container content that
 * might bleed through.
 */
export function createSuperScrollStickyHeadersPlugin(): PluginHook {
	return {
		/**
		 * Reinforce z-index on header elements without changing their position.
		 * The overlay's absolute positioning already keeps headers frozen.
		 */
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			const colHeaders = root.querySelectorAll<HTMLElement>('.pv-col-span');
			for (const header of colHeaders) {
				header.style.zIndex = String(STICKY_Z_INDEX);
			}

			const rowHeaders = root.querySelectorAll<HTMLElement>('.pv-row-span');
			for (const header of rowHeaders) {
				header.style.zIndex = String(STICKY_Z_INDEX);
			}
		},

		destroy(): void {
			// No-op — CSS is applied inline and headers are fully re-rendered each cycle.
		},
	};
}
