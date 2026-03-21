// Isometry v5 — Phase 102 Plan 04 SuperAuditOverlay Plugin
// Change tracking CSS overlay for pivot grid cells.
//
// Design:
//   - AuditPluginState: shared state object with inserted/updated/deleted Sets and sources Map
//   - createSuperAuditOverlayPlugin: factory that applies CSS classes to cells based on Sets
//     - afterRender: adds .audit-new, .audit-modified, .audit-deleted classes by data-key lookup
//     - destroy: removes all audit overlay classes from .pv-data-cell elements
//   - AuditPluginState is created once in registerCatalog() and shared with SuperAuditSource
//
// Requirements: AUDT-01

import type { PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Shared state type
// ---------------------------------------------------------------------------

/**
 * Shared state object passed to both SuperAuditOverlay and SuperAuditSource plugins.
 * Populated externally (e.g., from StateManager audit events or AuditState session tracking).
 */
export interface AuditPluginState {
	/** Cell keys of newly inserted cards. */
	inserted: Set<string>;
	/** Cell keys of modified cards. */
	updated: Set<string>;
	/** Cell keys of deleted cards. */
	deleted: Set<string>;
	/** Cell key → source type (e.g., "csv", "apple_notes"). Used by SuperAuditSource. */
	sources: Map<string, string>;
}

/**
 * Create a fresh, empty AuditPluginState.
 * Shared between createSuperAuditOverlayPlugin and createSuperAuditSourcePlugin.
 */
export function createAuditPluginState(): AuditPluginState {
	return {
		inserted: new Set(),
		updated: new Set(),
		deleted: new Set(),
		sources: new Map(),
	};
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

const OVERLAY_CLASSES = ['audit-new', 'audit-modified', 'audit-deleted'] as const;

/**
 * Create the superaudit.overlay plugin.
 *
 * @param auditState - Shared AuditPluginState created in registerCatalog().
 *   Must be the same object passed to createSuperAuditSourcePlugin.
 */
export function createSuperAuditOverlayPlugin(auditState: AuditPluginState): PluginHook {
	return {
		/**
		 * afterRender: iterate all .pv-data-cell elements and apply/remove
		 * audit CSS classes based on the shared AuditPluginState Sets.
		 *
		 * Class mapping:
		 *   inserted Set → .audit-new
		 *   updated Set  → .audit-modified
		 *   deleted Set  → .audit-deleted
		 *
		 * Cells not in any Set have all 3 classes removed (stale state cleanup).
		 */
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			const cells = root.querySelectorAll<HTMLElement>('.pv-data-cell');
			for (const cell of cells) {
				const key = cell.getAttribute('data-key');
				if (!key) continue;

				if (auditState.inserted.has(key)) {
					cell.classList.add('audit-new');
					cell.classList.remove('audit-modified', 'audit-deleted');
				} else if (auditState.updated.has(key)) {
					cell.classList.add('audit-modified');
					cell.classList.remove('audit-new', 'audit-deleted');
				} else if (auditState.deleted.has(key)) {
					cell.classList.add('audit-deleted');
					cell.classList.remove('audit-new', 'audit-modified');
				} else {
					// Not in any audit set — remove all overlay classes
					cell.classList.remove('audit-new', 'audit-modified', 'audit-deleted');
				}
			}
		},

		/**
		 * destroy: remove all audit overlay classes from every .pv-data-cell in the document.
		 * Called when the plugin is disabled or the grid is destroyed.
		 */
		destroy(): void {
			const cells = document.querySelectorAll<HTMLElement>('.pv-data-cell');
			for (const cell of cells) {
				cell.classList.remove(...OVERLAY_CLASSES);
			}
		},
	};
}
