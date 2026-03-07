// Isometry v5 — Phase 4 PAFVProvider
// PAFV axis mapping, view family suspension/restoration, and SQL fragment compilation.
//
// Design:
//   - Internal state: viewType + xAxis/yAxis/groupBy (never entity data)
//   - compile() is synchronous and pure — no side effects, no async
//   - Runtime allowlist validation on all axis fields via validateAxisField()
//     (compile-time validation for typed callers, runtime for JSON-restored state)
//   - View family suspension uses structuredClone for deep copy isolation
//   - Subscriber notifications batched via queueMicrotask (CONTEXT.md locked decision)
//   - subscribe() returns unsubscribe function (PROV-11)
//   - Implements PersistableProvider (Tier 2 persistence)
//
// Requirements: PROV-03, PROV-04, PROV-11

import type { SortEntry } from '../views/supergrid/SortState';
import { validateAxisField } from './allowlist';
import type { AxisMapping, CompiledAxis, PersistableProvider, ViewFamily, ViewType } from './types';

// ---------------------------------------------------------------------------
// Internal state shape
// ---------------------------------------------------------------------------

interface PAFVState {
	viewType: ViewType;
	xAxis: AxisMapping | null;
	yAxis: AxisMapping | null;
	groupBy: AxisMapping | null;
	colAxes: AxisMapping[];
	rowAxes: AxisMapping[];
	/** Phase 20 — base pixel widths per colKey (pre-zoom). Optional for backward compat. */
	colWidths?: Record<string, number>;
	/** Phase 23 — sort overrides for SuperGrid within-cell ordering. Optional for backward compat. */
	sortOverrides?: SortEntry[];
	/** Phase 30 — collapse state per header key. Optional for backward compat. */
	collapseState?: Array<{ key: string; mode: 'aggregate' | 'hide' }>;
}

// ---------------------------------------------------------------------------
// Default state constants
// ---------------------------------------------------------------------------

/**
 * Default states per view type.
 * Kanban defaults to groupBy status; SuperGrid defaults to card_type/folder axes.
 * All others default to no axes.
 */
const VIEW_DEFAULTS: Record<ViewType, PAFVState> = {
	list: { viewType: 'list', xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
	grid: { viewType: 'grid', xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
	kanban: {
		viewType: 'kanban',
		xAxis: null,
		yAxis: null,
		groupBy: { field: 'status', direction: 'asc' },
		colAxes: [],
		rowAxes: [],
	},
	calendar: { viewType: 'calendar', xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
	timeline: { viewType: 'timeline', xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
	gallery: { viewType: 'gallery', xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
	network: { viewType: 'network', xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
	tree: { viewType: 'tree', xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
	// Phase 15 — SuperGrid stacked axes: colAxes default to card_type, rowAxes to folder
	// Phase 23 — sortOverrides defaults to [] for SuperGrid
	supergrid: {
		viewType: 'supergrid',
		xAxis: null,
		yAxis: null,
		groupBy: null,
		colAxes: [{ field: 'card_type', direction: 'asc' }],
		rowAxes: [{ field: 'folder', direction: 'asc' }],
		sortOverrides: [],
	},
};

const DEFAULT_VIEW_TYPE: ViewType = 'list';

// ---------------------------------------------------------------------------
// PAFVProvider
// ---------------------------------------------------------------------------

/**
 * Manages PAFV axis state (xAxis, yAxis, groupBy, viewType) and compiles
 * them to safe SQL ORDER BY/GROUP BY fragments.
 *
 * Implements view family suspension: switching between LATCH and GRAPH
 * families suspends/restores the state for each family independently.
 * Suspended state is deep-copied via structuredClone to prevent aliasing.
 */
export class PAFVProvider implements PersistableProvider {
	private _state: PAFVState = structuredClone(VIEW_DEFAULTS[DEFAULT_VIEW_TYPE]);

	/** Suspended state keyed by view family — populated when crossing family boundary */
	private _suspendedStates: Map<ViewFamily, PAFVState> = new Map();

	private readonly _subscribers = new Set<() => void>();
	private _pendingNotify = false;

	// ---------------------------------------------------------------------------
	// View family helper
	// ---------------------------------------------------------------------------

	/**
	 * Classify a ViewType into its ViewFamily.
	 * 'network' and 'tree' are GRAPH; everything else is LATCH.
	 */
	getViewFamily(viewType: ViewType): ViewFamily {
		return viewType === 'network' || viewType === 'tree' ? 'graph' : 'latch';
	}

	// ---------------------------------------------------------------------------
	// State accessors
	// ---------------------------------------------------------------------------

	/**
	 * Returns a copy of the current PAFV state.
	 * colAxes and rowAxes are defensive copies — callers may not mutate internal state.
	 */
	getState(): Readonly<PAFVState> {
		return {
			...this._state,
			colAxes: [...this._state.colAxes],
			rowAxes: [...this._state.rowAxes],
		};
	}

	// ---------------------------------------------------------------------------
	// Mutation methods
	// ---------------------------------------------------------------------------

	/**
	 * Set the x-axis mapping (sort primary field and direction).
	 * Pass null to clear the x-axis.
	 *
	 * @throws {Error} "SQL safety violation: ..." if field is not allowlisted
	 */
	setXAxis(axis: AxisMapping | null): void {
		if (axis !== null) {
			validateAxisField(axis.field as string);
		}
		this._state.xAxis = axis;
		this._scheduleNotify();
	}

	/**
	 * Set the y-axis mapping (sort secondary field and direction).
	 * Pass null to clear the y-axis.
	 *
	 * @throws {Error} "SQL safety violation: ..." if field is not allowlisted
	 */
	setYAxis(axis: AxisMapping | null): void {
		if (axis !== null) {
			validateAxisField(axis.field as string);
		}
		this._state.yAxis = axis;
		this._scheduleNotify();
	}

	/**
	 * Set the group-by axis mapping (field to GROUP BY in SQL).
	 * Pass null to clear the group-by axis.
	 *
	 * @throws {Error} "SQL safety violation: ..." if field is not allowlisted
	 */
	setGroupBy(axis: AxisMapping | null): void {
		if (axis !== null) {
			validateAxisField(axis.field as string);
		}
		this._state.groupBy = axis;
		this._scheduleNotify();
	}

	/**
	 * Set the column stacked axes for SuperGrid dimensional projection.
	 * Pass [] to clear all column axes. Any number of axes is accepted.
	 *
	 * @throws {Error} "Duplicate axis field: ..." if the same field appears more than once
	 * @throws {Error} "SQL safety violation: ..." if any field is not allowlisted
	 */
	setColAxes(axes: AxisMapping[]): void {
		this._validateStackedAxes(axes);
		this._state.colAxes = [...axes];
		// Reset colWidths: different axes = different columns, old widths are meaningless
		this._state.colWidths = {};
		// Reset sortOverrides: stale sorts meaningless after axis change (Phase 23)
		this._state.sortOverrides = [];
		// Reset collapseState: stale collapse keys meaningless after axis change (Phase 30)
		this._state.collapseState = [];
		this._scheduleNotify();
	}

	/**
	 * Set the row stacked axes for SuperGrid dimensional projection.
	 * Pass [] to clear all row axes. Any number of axes is accepted.
	 *
	 * @throws {Error} "Duplicate axis field: ..." if the same field appears more than once
	 * @throws {Error} "SQL safety violation: ..." if any field is not allowlisted
	 */
	setRowAxes(axes: AxisMapping[]): void {
		this._validateStackedAxes(axes);
		this._state.rowAxes = [...axes];
		// Reset colWidths: different axes = different columns, old widths are meaningless
		this._state.colWidths = {};
		// Reset sortOverrides: stale sorts meaningless after axis change (Phase 23)
		this._state.sortOverrides = [];
		// Reset collapseState: stale collapse keys meaningless after axis change (Phase 30)
		this._state.collapseState = [];
		this._scheduleNotify();
	}

	/**
	 * Shared validation for setColAxes and setRowAxes.
	 * Checks duplicate fields and allowlist membership.
	 */
	private _validateStackedAxes(axes: AxisMapping[]): void {
		const seen = new Set<string>();
		for (const axis of axes) {
			if (seen.has(axis.field)) {
				throw new Error(`Duplicate axis field: "${axis.field}"`);
			}
			seen.add(axis.field);
			validateAxisField(axis.field as string);
		}
	}

	/**
	 * Set the active view type. When crossing a view family boundary
	 * (LATCH ↔ GRAPH), suspends the current family state via structuredClone
	 * and restores (or initializes with defaults) the new family state.
	 */
	setViewType(viewType: ViewType): void {
		const currentFamily = this.getViewFamily(this._state.viewType);
		const newFamily = this.getViewFamily(viewType);

		if (currentFamily !== newFamily) {
			// Crossing family boundary: suspend current, restore (or default) new
			this._suspendedStates.set(currentFamily, structuredClone(this._state));
			const restored = this._suspendedStates.get(newFamily);
			this._state = restored
				? { ...structuredClone(restored), viewType }
				: { ...structuredClone(VIEW_DEFAULTS[viewType]), viewType };
		} else {
			// Same family: update view type and apply new view's stacked axis defaults
			this._state.viewType = viewType;
			const defaults = VIEW_DEFAULTS[viewType];
			this._state.colAxes = [...defaults.colAxes];
			this._state.rowAxes = [...defaults.rowAxes];
		}

		this._scheduleNotify();
	}

	// ---------------------------------------------------------------------------
	// compile() — SQL fragment generation
	// ---------------------------------------------------------------------------

	/**
	 * Compile current axis state to SQL ORDER BY and GROUP BY fragments.
	 *
	 * Returns `{ orderBy, groupBy }` where:
	 *   - `orderBy` is "field ASC/DESC" (comma-separated if both xAxis and yAxis set)
	 *   - `groupBy` is just the field name
	 *   - Empty strings when no axes are set
	 *   - All field names are validated against the allowlist before interpolation
	 *
	 * @throws {Error} "SQL safety violation: ..." for any invalid field (handles JSON-restored state)
	 */
	compile(): CompiledAxis {
		const orderParts: string[] = [];

		if (this._state.xAxis !== null) {
			validateAxisField(this._state.xAxis.field as string);
			orderParts.push(`${this._state.xAxis.field} ${this._state.xAxis.direction.toUpperCase()}`);
		}

		if (this._state.yAxis !== null) {
			validateAxisField(this._state.yAxis.field as string);
			orderParts.push(`${this._state.yAxis.field} ${this._state.yAxis.direction.toUpperCase()}`);
		}

		let groupBy = '';
		if (this._state.groupBy !== null) {
			validateAxisField(this._state.groupBy.field as string);
			groupBy = this._state.groupBy.field;
		}

		return {
			orderBy: orderParts.join(', '),
			groupBy,
		};
	}

	// ---------------------------------------------------------------------------
	// getStackedGroupBySQL() — stacked axis configuration for SuperGrid
	// ---------------------------------------------------------------------------

	/**
	 * Return the stacked axis configuration for SuperGrid query building.
	 * Validates all axis fields at call time (catches corrupt JSON-restored state).
	 * Returns defensive copies — callers cannot mutate internal state through the return value.
	 *
	 * The return type matches the colAxes/rowAxes subset of SuperGridQueryConfig.
	 * Works for any viewType — the caller decides what to do with empty arrays.
	 *
	 * @throws {Error} "SQL safety violation: ..." if any axis field is invalid
	 */
	getStackedGroupBySQL(): { colAxes: AxisMapping[]; rowAxes: AxisMapping[] } {
		for (const axis of [...this._state.colAxes, ...this._state.rowAxes]) {
			validateAxisField(axis.field as string);
		}
		return {
			colAxes: [...this._state.colAxes],
			rowAxes: [...this._state.rowAxes],
		};
	}

	// ---------------------------------------------------------------------------
	// colWidths accessors (Phase 20 SuperSize — SIZE-04)
	// ---------------------------------------------------------------------------

	/**
	 * Return a defensive copy of the current column widths.
	 * Keys are colKey values (e.g., 'note', 'task'); values are base pixel widths (pre-zoom).
	 * Returns empty object when no custom widths have been set.
	 */
	getColWidths(): Record<string, number> {
		return { ...(this._state.colWidths ?? {}) };
	}

	/**
	 * Store column widths. Does NOT call _scheduleNotify() — width changes are CSS-only
	 * and do not require a Worker re-query. Width persistence happens at the next Tier 2
	 * checkpoint when toJSON() is called (colWidths rides the existing checkpoint).
	 *
	 * @param widths - Map of colKey → base pixel width (pre-zoom)
	 */
	setColWidths(widths: Record<string, number>): void {
		this._state.colWidths = { ...widths };
		// Do NOT call _scheduleNotify — width changes don't trigger re-query
	}

	// ---------------------------------------------------------------------------
	// sortOverrides accessors (Phase 23 SuperSort — SORT-01/SORT-02/SORT-04)
	// ---------------------------------------------------------------------------

	/**
	 * Return a defensive copy of the current sort overrides.
	 * Returns empty array when no sort overrides have been set.
	 */
	getSortOverrides(): SortEntry[] {
		return [...(this._state.sortOverrides ?? [])];
	}

	/**
	 * Store sort overrides. Validates each field against the allowlist and calls
	 * _scheduleNotify() — sort changes trigger a Worker re-query (ORDER BY change).
	 *
	 * @param sorts - Array of SortEntry to store
	 * @throws {Error} "SQL safety violation: ..." if any field is not allowlisted
	 */
	setSortOverrides(sorts: SortEntry[]): void {
		// Validate ALL fields before modifying state — atomic: either all succeed or none
		for (const s of sorts) {
			validateAxisField(s.field as string);
		}
		this._state.sortOverrides = [...sorts];
		this._scheduleNotify();
	}

	// ---------------------------------------------------------------------------
	// reorderColAxes / reorderRowAxes (Phase 31 Drag Reorder)
	// ---------------------------------------------------------------------------

	/**
	 * Reorder column axes in-place by moving the axis at fromIndex to toIndex.
	 * Preserves colWidths and sortOverrides (field-based, not index-based).
	 * Remaps collapse key level indices for 2-level stacks; clears collapse state
	 * for 3+ level stacks (pragmatic simplification — parentPath encoding makes
	 * surgical remap error-prone at 3+ levels).
	 *
	 * No-op (no subscriber notification) when fromIndex === toIndex or out of bounds.
	 */
	reorderColAxes(fromIndex: number, toIndex: number): void {
		this._reorderAxes('colAxes', fromIndex, toIndex);
	}

	/**
	 * Reorder row axes in-place by moving the axis at fromIndex to toIndex.
	 * Same preservation and remap semantics as reorderColAxes.
	 */
	reorderRowAxes(fromIndex: number, toIndex: number): void {
		this._reorderAxes('rowAxes', fromIndex, toIndex);
	}

	/**
	 * Shared implementation for reorderColAxes/reorderRowAxes.
	 * Splices the axes array, remaps collapse keys, and notifies subscribers.
	 */
	private _reorderAxes(dimension: 'colAxes' | 'rowAxes', fromIndex: number, toIndex: number): void {
		const axes = this._state[dimension];
		if (fromIndex === toIndex) return;
		if (fromIndex < 0 || fromIndex >= axes.length) return;
		if (toIndex < 0 || toIndex >= axes.length) return;

		const newAxes = [...axes];
		const [moved] = newAxes.splice(fromIndex, 1);
		if (!moved) return;
		newAxes.splice(toIndex, 0, moved);
		this._state[dimension] = newAxes;

		// colWidths: preserve — same columns, just reordered (field-based keys)
		// sortOverrides: preserve — field-based, not index-based
		// collapseState: remap level indices
		this._state.collapseState = this._remapCollapseKeys(
			this._state.collapseState ?? [],
			fromIndex,
			toIndex,
			newAxes.length,
		);

		this._scheduleNotify();
	}

	/**
	 * Remap collapse key level indices after an axis reorder.
	 *
	 * For 2-level stacks: swap level indices (level 0 <-> level 1). At 2 levels,
	 * parentPath is either empty (level 0) or a single value (level 1), so swapping
	 * is safe without parentPath rebuilding.
	 *
	 * For 3+ level stacks: clear all collapse state. Pragmatic simplification —
	 * parentPath encoding makes surgical remap error-prone at 3+ levels. User's
	 * collapsed headers reset on 3+ level reorder.
	 */
	private _remapCollapseKeys(
		state: Array<{ key: string; mode: 'aggregate' | 'hide' }>,
		fromIndex: number,
		toIndex: number,
		axisCount: number,
	): Array<{ key: string; mode: 'aggregate' | 'hide' }> {
		if (state.length === 0) return [];

		// For 3+ level stacks: clear all collapse state
		if (axisCount >= 3) return [];

		// For 2-level stacks: build index mapping and swap levels
		const SEP = '\x1f';
		const indices = Array.from({ length: axisCount }, (_, i) => i);
		const [moved] = indices.splice(fromIndex, 1);
		indices.splice(toIndex, 0, moved!);
		// indices[newIdx] = oldIdx. We need oldIdx -> newIdx
		const indexMap = new Map<number, number>();
		for (let newIdx = 0; newIdx < indices.length; newIdx++) {
			indexMap.set(indices[newIdx]!, newIdx);
		}

		return state.map(({ key, mode }) => {
			const parts = key.split(SEP);
			const oldLevel = parseInt(parts[0]!, 10);
			const newLevel = indexMap.get(oldLevel);
			if (newLevel !== undefined && newLevel !== oldLevel) {
				parts[0] = String(newLevel);
				// For 2-level stacks:
				// - Key moving from level 0 to level 1: parentPath was empty, stays empty
				//   (the value itself is correct; parentPath would need the other level's
				//   value but we keep it simple — both work at 2 levels since parentPath
				//   is only used for deeper nesting disambiguation)
				// - Key moving from level 1 to level 0: parentPath had the old level-0
				//   value, which is now at level 1. Clear parentPath since level 0 keys
				//   have no parent.
				// Pragmatic: just update the level index. parentPath content remains as-is.
				// At 2 levels this is safe because parentPath is only meaningful for
				// keys at level >= 1, and the actual ancestor values haven't changed.
			}
			return { key: parts.join(SEP), mode };
		});
	}

	// ---------------------------------------------------------------------------
	// collapseState accessors (Phase 30 Collapse System — CLPS-05)
	// ---------------------------------------------------------------------------

	/**
	 * Return a defensive copy of the current collapse state.
	 * Keys are header collapse keys; mode is 'aggregate' or 'hide'.
	 * Returns empty array when no headers are collapsed.
	 */
	getCollapseState(): Array<{ key: string; mode: 'aggregate' | 'hide' }> {
		return [...(this._state.collapseState ?? [])];
	}

	/**
	 * Store collapse state. Does NOT call _scheduleNotify() — collapse state is
	 * layout-only (like colWidths) and does not require a Worker re-query.
	 * Collapse persistence happens at the next Tier 2 checkpoint when toJSON() is called.
	 *
	 * @param state - Array of { key, mode } entries for collapsed headers
	 */
	setCollapseState(state: Array<{ key: string; mode: 'aggregate' | 'hide' }>): void {
		this._state.collapseState = [...state];
		// Do NOT call _scheduleNotify — collapse state is layout-only (like colWidths)
	}

	// ---------------------------------------------------------------------------
	// Subscribe / notify pattern (PROV-11)
	// ---------------------------------------------------------------------------

	/**
	 * Subscribe to state changes. Called once (via queueMicrotask) per
	 * synchronous batch of mutations — multiple rapid changes produce ONE call.
	 *
	 * @returns Unsubscribe function — call it to remove this subscriber
	 */
	subscribe(callback: () => void): () => void {
		this._subscribers.add(callback);
		return () => this._subscribers.delete(callback);
	}

	/**
	 * Schedule a subscriber notification via queueMicrotask.
	 * Multiple synchronous mutations produce one notification (pendingNotify guard).
	 */
	private _scheduleNotify(): void {
		if (this._pendingNotify) return;
		this._pendingNotify = true;
		queueMicrotask(() => {
			this._pendingNotify = false;
			this._subscribers.forEach((cb) => cb());
		});
	}

	// ---------------------------------------------------------------------------
	// PersistableProvider — Tier 2 serialization
	// ---------------------------------------------------------------------------

	/**
	 * Serialize current state to a JSON string for the ui_state table.
	 * Suspended states are NOT included — only the active state is persisted.
	 */
	toJSON(): string {
		return JSON.stringify(this._state);
	}

	/**
	 * Restore state from a plain object (parsed from ui_state JSON).
	 * Clears suspended states. Does NOT notify subscribers (snap to state per CONTEXT.md).
	 * Backward-compatible: older serialized state without colAxes/rowAxes defaults to [].
	 *
	 * @throws {Error} if the state shape is corrupt or contains invalid axis fields
	 */
	setState(state: unknown): void {
		if (!isPAFVState(state)) {
			throw new Error('[PAFVProvider] setState: invalid state shape');
		}

		// State is structurally valid but axis fields may still be invalid (JSON-restored)
		// We allow invalid fields here; compile() will catch them at query time
		// (This matches FilterProvider's approach — validate at compile(), not setState())
		const restored = state as PAFVState;
		this._state = {
			...restored,
			// Backward compat: older serialized state may lack colAxes/rowAxes
			colAxes: Array.isArray(restored.colAxes) ? [...restored.colAxes] : [],
			rowAxes: Array.isArray(restored.rowAxes) ? [...restored.rowAxes] : [],
			// Backward compat: older serialized state may lack colWidths (Phase 20)
			colWidths:
				typeof restored.colWidths === 'object' && restored.colWidths !== null && !Array.isArray(restored.colWidths)
					? { ...(restored.colWidths as Record<string, number>) }
					: {},
			// Backward compat: older serialized state may lack sortOverrides (Phase 23)
			sortOverrides: Array.isArray(restored.sortOverrides) ? [...restored.sortOverrides] : [],
			// Backward compat: older serialized state may lack collapseState (Phase 30)
			collapseState: Array.isArray(restored.collapseState) ? [...restored.collapseState] : [],
		};
		// Clear suspended states — restoration starts fresh
		this._suspendedStates.clear();
		// Do NOT notify subscribers — per CONTEXT.md "skip animation on restore"
	}

	/**
	 * Reset to default state (list view, no axes, no suspended states).
	 * Called by StateManager when JSON restoration fails.
	 */
	resetToDefaults(): void {
		this._state = structuredClone(VIEW_DEFAULTS[DEFAULT_VIEW_TYPE]);
		this._suspendedStates.clear();
	}
}

// ---------------------------------------------------------------------------
// Type guard for state restoration
// ---------------------------------------------------------------------------

function isAxisMapping(value: unknown): value is AxisMapping {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value as Record<string, unknown>;
	return typeof obj['field'] === 'string' && typeof obj['direction'] === 'string';
}

function isPAFVState(value: unknown): value is PAFVState {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value as Record<string, unknown>;

	if (typeof obj['viewType'] !== 'string') return false;

	// xAxis, yAxis, groupBy must be null or a valid AxisMapping shape
	if (obj['xAxis'] !== null && !isAxisMapping(obj['xAxis'])) return false;
	if (obj['yAxis'] !== null && !isAxisMapping(obj['yAxis'])) return false;
	if (obj['groupBy'] !== null && !isAxisMapping(obj['groupBy'])) return false;

	// colAxes and rowAxes — accept missing (older serialized state) or valid arrays
	if (obj['colAxes'] !== undefined) {
		if (!Array.isArray(obj['colAxes'])) return false;
		if (!(obj['colAxes'] as unknown[]).every(isAxisMapping)) return false;
	}
	if (obj['rowAxes'] !== undefined) {
		if (!Array.isArray(obj['rowAxes'])) return false;
		if (!(obj['rowAxes'] as unknown[]).every(isAxisMapping)) return false;
	}

	// colWidths — accept missing (older serialized state) or valid object
	// colWidths is optional; if present must be a non-null, non-array object
	if (obj['colWidths'] !== undefined) {
		if (typeof obj['colWidths'] !== 'object' || obj['colWidths'] === null || Array.isArray(obj['colWidths'])) {
			return false;
		}
	}

	// sortOverrides — accept missing (older serialized state) or valid array
	// SortEntry has same shape as AxisMapping: { field: string, direction: string }
	if (obj['sortOverrides'] !== undefined) {
		if (!Array.isArray(obj['sortOverrides'])) return false;
		if (!(obj['sortOverrides'] as unknown[]).every(isAxisMapping)) return false;
	}

	// collapseState — accept missing (older serialized state) or valid array (Phase 30)
	if (obj['collapseState'] !== undefined) {
		if (!Array.isArray(obj['collapseState'])) return false;
		for (const entry of obj['collapseState'] as unknown[]) {
			if (typeof entry !== 'object' || entry === null) return false;
			const e = entry as Record<string, unknown>;
			if (typeof e['key'] !== 'string') return false;
			if (e['mode'] !== 'aggregate' && e['mode'] !== 'hide') return false;
		}
	}

	return true;
}
