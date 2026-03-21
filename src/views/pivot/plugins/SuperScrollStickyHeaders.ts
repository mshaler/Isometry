// Isometry v5 — Phase 100 Plan 02 SuperScrollStickyHeaders Plugin
// Apply CSS position:sticky to pivot column header elements in the overlay.
//
// Design:
//   - afterRender: finds all .pv-col-span elements in the root (overlay)
//     Applies position:sticky with z-index 20
//     Level 0 headers use top:0; deeper levels use top = level * headerHeight
//   - destroy: no-op (CSS is ephemeral — headers are re-rendered each time)
//
// Note: The overlay uses absolute positioning for scroll tracking (translateX).
// This plugin adds sticky positioning within the scroll container context.
// In practice, sticky headers are most effective when the overlay is restructured
// to sit within the scroll container. This plugin provides the CSS enhancement.
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
 * Applies position:sticky with z-index to column header spans in the overlay.
 */
export function createSuperScrollStickyHeadersPlugin(): PluginHook {
	return {
		/**
		 * Apply sticky positioning to all .pv-col-span header elements.
		 * Uses the data-level attribute to compute stacked top offsets for multi-level headers.
		 */
		afterRender(root: HTMLElement, ctx: RenderContext): void {
			const headers = root.querySelectorAll<HTMLElement>('.pv-col-span');
			if (headers.length === 0) return;

			// Get header height from layout context (if available)
			const layout = (ctx as unknown as { layout?: { headerHeight?: number } }).layout;
			const headerHeight = layout?.headerHeight ?? 36;

			for (const header of headers) {
				const level = parseInt(header.getAttribute('data-level') ?? '0', 10);
				const topOffset = level * headerHeight;

				header.style.position = 'sticky';
				header.style.top = `${topOffset}px`;
				header.style.zIndex = String(STICKY_Z_INDEX);
			}
		},

		/**
		 * No cleanup needed — CSS is applied inline and headers are fully re-rendered
		 * on each PivotGrid.render() call.
		 */
		destroy(): void {
			// No-op
		},
	};
}
