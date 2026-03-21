// Isometry v5 — Phase 98 FeatureCatalog
// Full taxonomy of SuperGrid features registered as plugins.
//
// Design:
//   - Each Super* family is a category with sub-feature plugins
//   - Plugins are registered as metadata + noop factories (implementations added later)
//   - Dependencies model the real dependency graph between features
//   - Base features (grid, headers, config) are defaultEnabled: true
//
// Requirements: HAR-04

import type { PluginMeta } from './PluginTypes';
import { PluginRegistry } from './PluginRegistry';
import { createSuperStackSpansPlugin } from './SuperStackSpans';

// ---------------------------------------------------------------------------
// Catalog entries
// ---------------------------------------------------------------------------

/** Full feature taxonomy — 10 categories, 27 sub-features. */
export const FEATURE_CATALOG: PluginMeta[] = [
	// ---- Base (always on) ----
	{
		id: 'base.grid',
		name: 'Data Grid',
		category: 'Base',
		description: 'D3 data join cell rendering with CSS table layout',
		dependencies: [],
		defaultEnabled: true,
	},
	{
		id: 'base.headers',
		name: 'Grouped Headers',
		category: 'Base',
		description: 'Two-layer header spanning with run-length encoding',
		dependencies: ['base.grid'],
		defaultEnabled: true,
	},
	{
		id: 'base.config',
		name: 'Config Panel',
		category: 'Base',
		description: 'DnD axis assignment with pointer events',
		dependencies: ['base.grid'],
		defaultEnabled: true,
	},

	// ---- SuperStack ----
	{
		id: 'superstack.spanning',
		name: 'Multi-Level Spans',
		category: 'SuperStack',
		description: 'N-level run-length header spanning with parent-boundary awareness',
		dependencies: ['base.headers'],
		defaultEnabled: false,
	},
	{
		id: 'superstack.collapse',
		name: 'Collapse Groups',
		category: 'SuperStack',
		description: 'Click header to collapse/expand group',
		dependencies: ['superstack.spanning'],
		defaultEnabled: false,
	},
	{
		id: 'superstack.aggregate',
		name: 'Aggregate on Collapse',
		category: 'SuperStack',
		description: 'Show SUM/COUNT summary when group is collapsed',
		dependencies: ['superstack.collapse'],
		defaultEnabled: false,
	},

	// ---- SuperZoom ----
	{
		id: 'superzoom.slider',
		name: 'Zoom Slider',
		category: 'SuperZoom',
		description: 'Zoom control UI (0.5x–2x)',
		dependencies: ['base.grid'],
		defaultEnabled: false,
	},
	{
		id: 'superzoom.scale',
		name: 'Cell Scaling',
		category: 'SuperZoom',
		description: 'CSS transform scaling of all cell dimensions',
		dependencies: ['superzoom.slider'],
		defaultEnabled: false,
	},

	// ---- SuperSize ----
	{
		id: 'supersize.col-resize',
		name: 'Column Resize',
		category: 'SuperSize',
		description: 'Per-column drag-to-resize handles',
		dependencies: ['base.grid'],
		defaultEnabled: false,
	},
	{
		id: 'supersize.header-resize',
		name: 'Header Resize',
		category: 'SuperSize',
		description: 'Header width/height resize via corner handles',
		dependencies: ['base.grid'],
		defaultEnabled: false,
	},
	{
		id: 'supersize.uniform-resize',
		name: 'Uniform Cell Resize',
		category: 'SuperSize',
		description: 'Resize all data cells uniformly via bottom-right handle',
		dependencies: ['base.grid'],
		defaultEnabled: false,
	},

	// ---- SuperDensity ----
	{
		id: 'superdensity.mode-switch',
		name: 'Density Mode Switcher',
		category: 'SuperDensity',
		description: '1x/2x/5x toggle UI for dimension rendering modes',
		dependencies: ['base.grid'],
		defaultEnabled: false,
	},
	{
		id: 'superdensity.mini-cards',
		name: 'Mini Cards (5x)',
		category: 'SuperDensity',
		description: 'Icon + title mini-cards in 5x mode (up to 3 per cell)',
		dependencies: ['superdensity.mode-switch'],
		defaultEnabled: false,
	},
	{
		id: 'superdensity.count-badge',
		name: 'Count Badge (1x)',
		category: 'SuperDensity',
		description: 'Count-only badge in 1x mode (pivot table aesthetic)',
		dependencies: ['superdensity.mode-switch'],
		defaultEnabled: false,
	},

	// ---- SuperCalc ----
	{
		id: 'supercalc.footer',
		name: 'Aggregate Footer',
		category: 'SuperCalc',
		description: 'Sticky footer row with aggregate values (SUM/AVG/COUNT/MIN/MAX)',
		dependencies: ['base.grid'],
		defaultEnabled: false,
	},
	{
		id: 'supercalc.config',
		name: 'Aggregate Config',
		category: 'SuperCalc',
		description: 'Per-column aggregate function selector dropdown',
		dependencies: ['supercalc.footer'],
		defaultEnabled: false,
	},

	// ---- SuperScroll ----
	{
		id: 'superscroll.virtual',
		name: 'Virtual Scrolling',
		category: 'SuperScroll',
		description: 'Data windowing for 10K+ rows (only visible rows in DOM)',
		dependencies: ['base.grid'],
		defaultEnabled: false,
	},
	{
		id: 'superscroll.sticky-headers',
		name: 'Sticky Headers',
		category: 'SuperScroll',
		description: 'Row/column headers remain visible during scroll',
		dependencies: ['base.headers'],
		defaultEnabled: false,
	},

	// ---- SuperSearch ----
	{
		id: 'supersearch.input',
		name: 'Search Input',
		category: 'SuperSearch',
		description: 'Search input field with FTS5 query',
		dependencies: ['base.grid'],
		defaultEnabled: false,
	},
	{
		id: 'supersearch.highlight',
		name: 'Cell Highlighting',
		category: 'SuperSearch',
		description: 'Highlight matching text in data cells',
		dependencies: ['supersearch.input'],
		defaultEnabled: false,
	},

	// ---- SuperSelect ----
	{
		id: 'superselect.click',
		name: 'Click Select',
		category: 'SuperSelect',
		description: 'Click to select a single cell',
		dependencies: ['base.grid'],
		defaultEnabled: false,
	},
	{
		id: 'superselect.lasso',
		name: 'Lasso Select',
		category: 'SuperSelect',
		description: 'SVG lasso for multi-cell selection',
		dependencies: ['superselect.click'],
		defaultEnabled: false,
	},
	{
		id: 'superselect.keyboard',
		name: 'Keyboard Modifiers',
		category: 'SuperSelect',
		description: 'Shift/Cmd for range/additive selection',
		dependencies: ['superselect.click'],
		defaultEnabled: false,
	},

	// ---- SuperAudit ----
	{
		id: 'superaudit.overlay',
		name: 'Change Overlay',
		category: 'SuperAudit',
		description: 'Visual overlay showing added/modified/deleted cells',
		dependencies: ['base.grid'],
		defaultEnabled: false,
	},
	{
		id: 'superaudit.source',
		name: 'Source Badges',
		category: 'SuperAudit',
		description: 'Source provenance badges on cells',
		dependencies: ['superaudit.overlay'],
		defaultEnabled: false,
	},

	// ---- SuperSort ----
	{
		id: 'supersort.header-click',
		name: 'Header Sort',
		category: 'SuperSort',
		description: 'Click column header to sort by that dimension',
		dependencies: ['base.headers'],
		defaultEnabled: false,
	},
	{
		id: 'supersort.chain',
		name: 'Sort Chain',
		category: 'SuperSort',
		description: 'Multi-column sort with priority ordering',
		dependencies: ['supersort.header-click'],
		defaultEnabled: false,
	},
];

// ---------------------------------------------------------------------------
// Registration helper
// ---------------------------------------------------------------------------

/**
 * Register the full feature catalog into a PluginRegistry.
 *
 * All plugins get noop factories by default. Call registry.setFactory(id, factory)
 * to replace with real implementations as features are built.
 */
export function registerCatalog(registry: PluginRegistry): void {
	for (const meta of FEATURE_CATALOG) {
		registry.register(meta, () => ({}));
	}

	// Replace noop factories with real implementations for completed plugins
	registry.setFactory('superstack.spanning', createSuperStackSpansPlugin);
}
