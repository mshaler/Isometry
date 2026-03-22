// Isometry v5 — Phase 98 PluginTypes
// Composable plugin interfaces for SuperGrid feature registry.
//
// Design:
//   - PluginMeta: describes a feature (id, name, category, dependencies)
//   - PluginHook: lifecycle hooks a plugin can implement
//   - GridLayout: mutable sizing state plugins can transform
//   - RenderContext: read-only context passed through the pipeline
//   - DataProvider: interface for swappable data sources (mock → JSON → sql.js)
//
// Requirements: HAR-01, HAR-03

import type { HeaderDimension } from '../PivotTypes';

// ---------------------------------------------------------------------------
// Plugin metadata
// ---------------------------------------------------------------------------

/** Describes a registerable feature with dependency information. */
export interface PluginMeta {
	/** Dot-namespaced ID, e.g., 'superstack.collapse'. */
	id: string;
	/** Human-readable name, e.g., 'Collapse Groups'. */
	name: string;
	/** Category grouping, e.g., 'SuperStack'. */
	category: string;
	/** Short description for the harness tooltip. */
	description: string;
	/** IDs of plugins this depends on (auto-enabled). */
	dependencies: string[];
	/** Whether this plugin starts enabled. */
	defaultEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Grid layout (mutable — plugins transform this)
// ---------------------------------------------------------------------------

/** Mutable sizing state that plugins can modify before render. */
export interface GridLayout {
	headerWidth: number;
	headerHeight: number;
	cellWidth: number;
	cellHeight: number;
	/** Per-column width overrides (plugin: supersize.col-resize). */
	colWidths: Map<number, number>;
	/** Zoom multiplier (plugin: superzoom.scale). */
	zoom: number;
}

// ---------------------------------------------------------------------------
// Cell placement (data flowing through the pipeline)
// ---------------------------------------------------------------------------

/** A single cell in the render pipeline. */
export interface CellPlacement {
	key: string;
	rowIdx: number;
	colIdx: number;
	value: number | null;
	/** Plugins can attach arbitrary metadata. */
	meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Render context (read-only — passed to all hooks)
// ---------------------------------------------------------------------------

/** Read-only context available to all plugin hooks. */
export interface RenderContext {
	rowDimensions: HeaderDimension[];
	colDimensions: HeaderDimension[];
	visibleRows: string[][];
	/** All row combinations before hide-empty filtering. Used by SuperCalc scope: 'all'. */
	allRows: string[][];
	visibleCols: string[][];
	data: Map<string, number | null>;
	rootEl: HTMLElement;
	scrollLeft: number;
	scrollTop: number;
	/** Check if another plugin is currently enabled. */
	isPluginEnabled: (id: string) => boolean;
}

// ---------------------------------------------------------------------------
// Plugin hooks
// ---------------------------------------------------------------------------

/** Lifecycle hooks a plugin can implement. All are optional. */
export interface PluginHook {
	/** Transform cell placements before D3 join (e.g., virtual scroll filters rows). */
	transformData?(cells: CellPlacement[], ctx: RenderContext): CellPlacement[];
	/** Modify grid sizing before render (e.g., zoom scales dimensions). */
	transformLayout?(layout: GridLayout, ctx: RenderContext): GridLayout;
	/** Inject DOM after main render (e.g., calc footer, selection overlay). */
	afterRender?(root: HTMLElement, ctx: RenderContext): void;
	/** Handle pointer events. Return true to consume (stop propagation to next plugin). */
	onPointerEvent?(type: string, e: PointerEvent, ctx: RenderContext): boolean;
	/** Handle scroll position changes. */
	onScroll?(scrollLeft: number, scrollTop: number, ctx: RenderContext): void;
	/** Cleanup when plugin is disabled or grid is destroyed. */
	destroy?(): void;
}

/** Factory function that creates a fresh PluginHook instance. */
export type PluginFactory = () => PluginHook;

// ---------------------------------------------------------------------------
// Data provider (swappable data sources)
// ---------------------------------------------------------------------------

/** Interface for data sources: mock → alto-index JSON → sql.js. */
export interface DataProvider {
	/** Display name for the harness selector. */
	name: string;
	/** Unique ID. */
	id: string;
	/** Load data and return as cell map. */
	load(): Promise<Map<string, number | null>>;
	/** Return available dimensions for this data source. */
	getDimensions(): HeaderDimension[];
}

// ---------------------------------------------------------------------------
// Toggle state (persisted to localStorage)
// ---------------------------------------------------------------------------

/** Serializable toggle state for localStorage persistence. */
export interface ToggleState {
	enabled: string[];
	dataSource: string;
}
