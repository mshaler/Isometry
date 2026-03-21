// Isometry v5 — Phase 102 Plan 04 SuperAuditSource Plugin
// Source provenance color-coded left border for pivot grid cells.
//
// Design:
//   - createSuperAuditSourcePlugin: factory that sets data-source attribute and .audit-source class
//     - afterRender: sets data-source on cells whose key is in AuditPluginState.sources Map
//     - CSS handles the actual coloring via .audit-source[data-source="..."] selectors in pivot.css
//     - destroy: removes .audit-source class and data-source attribute from all cells
//   - AuditPluginState is created once in registerCatalog() and shared with SuperAuditOverlay
//
// Requirements: AUDT-02

import type { PluginHook, RenderContext } from './PluginTypes';
import type { AuditPluginState } from './SuperAuditOverlay';

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Create the superaudit.source plugin.
 *
 * @param auditState - Shared AuditPluginState created in registerCatalog().
 *   Must be the same object passed to createSuperAuditOverlayPlugin.
 */
export function createSuperAuditSourcePlugin(auditState: AuditPluginState): PluginHook {
	return {
		/**
		 * afterRender: iterate all .pv-data-cell elements and apply/remove
		 * data-source attribute and .audit-source class based on AuditPluginState.sources Map.
		 *
		 * CSS handles coloring via:
		 *   .audit-source[data-source="csv"]         { border-left: 3px solid var(--source-csv); }
		 *   .audit-source[data-source="apple_notes"] { border-left: 3px solid var(--source-apple-notes); }
		 *   etc.
		 */
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			const cells = root.querySelectorAll<HTMLElement>('.pv-data-cell');
			for (const cell of cells) {
				const key = cell.getAttribute('data-key');
				if (!key) continue;

				const source = auditState.sources.get(key);
				if (source !== undefined) {
					cell.setAttribute('data-source', source);
					cell.classList.add('audit-source');
				} else {
					cell.removeAttribute('data-source');
					cell.classList.remove('audit-source');
				}
			}
		},

		/**
		 * destroy: remove .audit-source class and data-source attribute from every
		 * .pv-data-cell in the document. Called when the plugin is disabled or grid is destroyed.
		 */
		destroy(): void {
			const cells = document.querySelectorAll<HTMLElement>('.pv-data-cell');
			for (const cell of cells) {
				cell.classList.remove('audit-source');
				cell.removeAttribute('data-source');
			}
		},
	};
}
