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

// ---------------------------------------------------------------------------
// Internal state shape
// ---------------------------------------------------------------------------

interface PAFVState {
  viewType: ViewType;
  xAxis: AxisMapping | null;
  yAxis: AxisMapping | null;
  groupBy: AxisMapping | null;
}

// ---------------------------------------------------------------------------
// Default state constants
// ---------------------------------------------------------------------------

/**
 * Default states per view type.
 * Kanban defaults to groupBy status; all others default to no axes.
 */
const VIEW_DEFAULTS: Record<ViewType, PAFVState> = {
  list: { viewType: 'list', xAxis: null, yAxis: null, groupBy: null },
  grid: { viewType: 'grid', xAxis: null, yAxis: null, groupBy: null },
  kanban: {
    viewType: 'kanban',
    xAxis: null,
    yAxis: null,
    groupBy: { field: 'status', direction: 'asc' },
  },
  calendar: { viewType: 'calendar', xAxis: null, yAxis: null, groupBy: null },
  timeline: { viewType: 'timeline', xAxis: null, yAxis: null, groupBy: null },
  gallery: { viewType: 'gallery', xAxis: null, yAxis: null, groupBy: null },
  network: { viewType: 'network', xAxis: null, yAxis: null, groupBy: null },
  tree: { viewType: 'tree', xAxis: null, yAxis: null, groupBy: null },
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
   * Returns a shallow copy of the current PAFV state.
   * Axis objects within are the same references — do not mutate them.
   */
  getState(): Readonly<PAFVState> {
    return { ...this._state };
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
      // Same family: just update the view type
      this._state.viewType = viewType;
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
    this._state = { ...state };
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

  return true;
}
