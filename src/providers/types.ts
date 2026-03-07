// Isometry v5 — Phase 4 Provider Types
// Shared type system for all providers: compile-time union types and interfaces.
//
// Design:
//   - Union types give compile-time safety (TypeScript catches wrong literals)
//   - Runtime allowlist.ts gives safety for dynamic values (JSON-restored state)
//   - Both layers required: types prevent typos, allowlist prevents injection

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

/**
 * Allowlisted columns that can appear in WHERE clauses.
 * Must be kept in sync with allowlist.ts ALLOWED_FILTER_FIELDS.
 */
export type FilterField =
	| 'card_type'
	| 'name'
	| 'folder'
	| 'status'
	| 'source'
	| 'created_at'
	| 'modified_at'
	| 'due_at'
	| 'completed_at'
	| 'event_start'
	| 'event_end'
	| 'latitude'
	| 'longitude'
	| 'location_name'
	| 'priority'
	| 'sort_order';

/**
 * Allowlisted comparison operators in their symbolic names.
 * Translated to SQL by FilterProvider.compile().
 * Must be kept in sync with allowlist.ts ALLOWED_OPERATORS.
 */
export type FilterOperator =
	| 'eq'
	| 'neq'
	| 'gt'
	| 'gte'
	| 'lt'
	| 'lte'
	| 'contains'
	| 'startsWith'
	| 'in'
	| 'isNull'
	| 'isNotNull';

// ---------------------------------------------------------------------------
// Axis / sort types
// ---------------------------------------------------------------------------

/**
 * Allowlisted columns for ORDER BY and GROUP BY.
 * Must be kept in sync with allowlist.ts ALLOWED_AXIS_FIELDS.
 */
export type AxisField =
	| 'created_at'
	| 'modified_at'
	| 'due_at'
	| 'folder'
	| 'status'
	| 'card_type'
	| 'priority'
	| 'sort_order'
	| 'name';

/** Sort direction for axis mappings. */
export type SortDirection = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// View / density types
// ---------------------------------------------------------------------------

/** Temporal grouping granularity for time-axis views (DensityProvider). */
export type TimeGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * View density mode for SuperGrid (Phase 22 DENS-03).
 * - 'spreadsheet': cells show card pills (name + type icon)
 * - 'matrix': cells show counts only with heat-map color intensity
 */
export type ViewMode = 'spreadsheet' | 'matrix';

/**
 * State shape for SuperDensityProvider (Phase 22).
 * Manages all four density control levels for SuperGrid.
 *
 * DENS-01/DENS-05: axisGranularity — time hierarchy collapse (null = no time axis active)
 * DENS-02: hideEmpty — remove entire rows/columns where every cell has count=0
 * DENS-03: viewMode — spreadsheet (card pills) vs matrix (heat-map counts)
 * DENS-04: regionConfig — stub only, no UI in v3.0
 */
export interface SuperDensityState {
	/** Time hierarchy collapse granularity; null = no time axis active or no granularity override */
	axisGranularity: TimeGranularity | null;
	/** If true, rows and columns with count=0 in every cell are removed from the grid */
	hideEmpty: boolean;
	/** Visual mode: card pills (spreadsheet) or count heat-map (matrix) */
	viewMode: ViewMode;
	/** DENS-04 stub — Region density configuration; no UI in v3.0 */
	regionConfig: null;
}

/** All supported view types (canonical from D-006). Phase 7 adds 'supergrid'. */
export type ViewType =
	| 'list'
	| 'grid'
	| 'kanban'
	| 'calendar'
	| 'timeline'
	| 'gallery'
	| 'network'
	| 'tree'
	| 'supergrid';

/** Top-level view family: LATCH-based or GRAPH-based. */
export type ViewFamily = 'latch' | 'graph';

// ---------------------------------------------------------------------------
// Provider data structures
// ---------------------------------------------------------------------------

/**
 * A single filter condition added to FilterProvider.
 * Field and operator are validated against allowlists at runtime.
 */
export interface Filter {
	field: FilterField;
	operator: FilterOperator;
	value: unknown;
}

/**
 * Compiled output of FilterProvider — a SQL WHERE fragment + parameter array.
 * Always starts with `deleted_at IS NULL`.
 */
export interface CompiledFilter {
	where: string;
	params: unknown[];
}

/**
 * Compiled output of PAFVProvider's axis state.
 */
export interface CompiledAxis {
	orderBy: string;
	groupBy: string;
}

/**
 * Compiled output of DensityProvider — a strftime() GROUP BY expression.
 */
export interface CompiledDensity {
	groupExpr: string;
}

/**
 * A single axis mapping: which field to sort/group by, and in which direction.
 */
export interface AxisMapping {
	field: AxisField;
	direction: SortDirection;
}

// ---------------------------------------------------------------------------
// Persistence interface
// ---------------------------------------------------------------------------

/**
 * Implemented by Tier 2 providers (FilterProvider, PAFVProvider, DensityProvider).
 * SelectionProvider is Tier 3 — it does NOT implement this interface.
 */
export interface PersistableProvider {
	/** Serialize current state to a JSON string for ui_state table. */
	toJSON(): string;
	/** Restore state from a previously-serialized plain object. Throws on corrupt data. */
	setState(state: unknown): void;
	/** Reset provider to its default/empty state. */
	resetToDefaults(): void;
}
