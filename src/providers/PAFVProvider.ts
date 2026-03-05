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

import { validateAxisField } from './allowlist';
import type {
  AxisMapping,
  AxisField,
  CompiledAxis,
  ViewType,
  ViewFamily,
  PersistableProvider,
} from './types';
import type { SortEntry } from '../views/supergrid/SortState';

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
  list:     { viewType: 'list',     xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
  grid:     { viewType: 'grid',     xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
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
  gallery:  { viewType: 'gallery',  xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
  network:  { viewType: 'network',  xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
  tree:     { viewType: 'tree',     xAxis: null, yAxis: null, groupBy: null, colAxes: [], rowAxes: [] },
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
      orderParts.push(
        `${this._state.xAxis.field} ${this._state.xAxis.direction.toUpperCase()}`
      );
    }

    if (this._state.yAxis !== null) {
      validateAxisField(this._state.yAxis.field as string);
      orderParts.push(
        `${this._state.yAxis.field} ${this._state.yAxis.direction.toUpperCase()}`
      );
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
      this._subscribers.forEach(cb => cb());
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
      colWidths: (
        typeof restored.colWidths === 'object' &&
        restored.colWidths !== null &&
        !Array.isArray(restored.colWidths)
      ) ? { ...restored.colWidths as Record<string, number> } : {},
      // Backward compat: older serialized state may lack sortOverrides (Phase 23)
      sortOverrides: Array.isArray(restored.sortOverrides)
        ? [...restored.sortOverrides]
        : [],
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

  return true;
}
