// Isometry v5 — Phase 22 SuperDensityProvider
// Density control state management for SuperGrid (all 4 levels: Value, Extent, View, Region).
//
// Design:
//   - Internal state: axisGranularity + hideEmpty + viewMode + regionConfig (stub)
//   - Implements PersistableProvider (Tier 2 persistence — same as DensityProvider pattern)
//   - Subscriber notifications batched via queueMicrotask (CONTEXT.md locked decision)
//   - subscribe() returns unsubscribe function (consistent with all other providers)
//   - getState() returns defensive copy (mutating returned object does not affect provider)
//   - setState() validates shape with isSuperDensityState() guard, throws on invalid
//   - resetToDefaults() restores DEFAULT_STATE
//
// Requirements: DENS-04 (region stub), DENS-06 (foundation for density rendering pipeline)

import { ALLOWED_AXIS_FIELDS } from './allowlist';
import type { SchemaProvider } from './SchemaProvider';
import type { AxisField, PersistableProvider, SuperDensityState, TimeGranularity, ViewMode } from './types';

// ---------------------------------------------------------------------------
// Valid granularity set (for setState() validation)
// ---------------------------------------------------------------------------

const ALLOWED_GRANULARITIES: ReadonlySet<TimeGranularity> = Object.freeze(
	new Set<TimeGranularity>(['day', 'week', 'month', 'quarter', 'year']),
);

const ALLOWED_VIEW_MODES: ReadonlySet<ViewMode> = Object.freeze(new Set<ViewMode>(['spreadsheet', 'matrix']));

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_STATE: SuperDensityState = Object.freeze({
	axisGranularity: null,
	hideEmpty: false,
	viewMode: 'spreadsheet' as ViewMode,
	regionConfig: null,
	displayField: 'name' as AxisField,
});

// ---------------------------------------------------------------------------
// SuperDensityProvider
// ---------------------------------------------------------------------------

/**
 * Manages density control state for SuperGrid.
 *
 * Four density levels:
 *   - Level 1 Value (DENS-01): axisGranularity — time hierarchy collapse via strftime GROUP BY
 *   - Level 2 Extent (DENS-02): hideEmpty — filter out rows/columns where all cells have count=0
 *   - Level 3 View (DENS-03): viewMode — spreadsheet (card pills) vs matrix (count heat-map)
 *   - Level 4 Region (DENS-04): regionConfig — stubbed at null; no UI in v3.0
 *
 * Hybrid query strategy (from CONTEXT.md locked decisions):
 *   - Granularity changes → trigger Worker re-query (SQL GROUP BY expression changes)
 *   - hideEmpty + viewMode changes → client-side re-render from cached cells (no re-query)
 *
 * StateCoordinator integration: this provider IS registered with StateCoordinator
 * (unlike SuperPositionProvider which is NOT). Granularity changes flow through the
 * coordinator batch and trigger _fetchAndRender() in SuperGrid.
 */
export class SuperDensityProvider implements PersistableProvider {
	private _state: SuperDensityState = { ...DEFAULT_STATE };

	private readonly _subscribers = new Set<() => void>();
	private _pendingNotify = false;

	/** Phase 71-02: Optional SchemaProvider for schema-based displayField validation (DYNM-12). */
	private _schema: SchemaProvider | null = null;

	/**
	 * Wire SchemaProvider for dynamic displayField validation.
	 * When wired, setDisplayField() and setState() use SchemaProvider.isValidColumn()
	 * instead of the static ALLOWED_AXIS_FIELDS frozen set.
	 * Pass null to reset (used in tests for cleanup).
	 */
	setSchemaProvider(sp: SchemaProvider | null): void {
		this._schema = sp;
	}

	/**
	 * Returns true if the given field name is a valid display field.
	 * Delegates to SchemaProvider when wired (dynamic schema validation).
	 * Falls back to ALLOWED_AXIS_FIELDS frozen set when not wired.
	 */
	private _isValidDisplayField(field: string): boolean {
		if (this._schema?.initialized) {
			return this._schema.isValidColumn(field, 'cards');
		}
		return (ALLOWED_AXIS_FIELDS as Set<string>).has(field);
	}

	// ---------------------------------------------------------------------------
	// State accessor
	// ---------------------------------------------------------------------------

	/**
	 * Returns a defensive copy of the current density state.
	 * Mutating the returned object does not affect provider state.
	 */
	getState(): Readonly<SuperDensityState> {
		return { ...this._state };
	}

	// ---------------------------------------------------------------------------
	// Mutation methods
	// ---------------------------------------------------------------------------

	/**
	 * Set the time hierarchy granularity for SuperGrid axes.
	 * Pass null to disable granularity override (raw column values used instead).
	 * Only applies to time-field axes (created_at, modified_at, due_at).
	 *
	 * Triggers Worker re-query when SuperGrid subscribes to coordinator.
	 */
	setGranularity(granularity: TimeGranularity | null): void {
		this._state = { ...this._state, axisGranularity: granularity };
		this._scheduleNotify();
	}

	/**
	 * Toggle hiding of empty intersections (rows/columns where all cells have count=0).
	 * Client-side filter on cached cells — no Worker re-query.
	 */
	setHideEmpty(hide: boolean): void {
		this._state = { ...this._state, hideEmpty: hide };
		this._scheduleNotify();
	}

	/**
	 * Switch SuperGrid view mode.
	 * Client-side re-render from cached cells — no Worker re-query.
	 *
	 * 'spreadsheet': card pills showing name + type icon per cell
	 * 'matrix': count numbers with heat-map color intensity
	 */
	setViewMode(mode: ViewMode): void {
		this._state = { ...this._state, viewMode: mode };
		this._scheduleNotify();
	}

	/**
	 * Set the display field for Z-plane cell rendering (Phase 55 PROJ-05).
	 * Validates against ALLOWED_AXIS_FIELDS. Triggers subscriber notification.
	 *
	 * @param field - An AxisField value (e.g., 'name', 'folder', 'priority')
	 * @throws {Error} if field is not a valid AxisField
	 */
	setDisplayField(field: AxisField): void {
		// Phase 71-02: Delegate to SchemaProvider when wired (DYNM-12), fallback to frozen set
		if (!this._isValidDisplayField(field)) {
			throw new Error(
				`[SuperDensityProvider] setDisplayField: invalid field "${field}". ` +
					`Allowed: ${[...ALLOWED_AXIS_FIELDS].join(', ')}`,
			);
		}
		this._state = { ...this._state, displayField: field };
		this._scheduleNotify();
	}

	// ---------------------------------------------------------------------------
	// Subscribe / notify pattern
	// ---------------------------------------------------------------------------

	/**
	 * Subscribe to state changes. Callback is invoked once (via queueMicrotask)
	 * per synchronous batch of mutations — multiple rapid changes produce ONE call.
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
	 */
	toJSON(): string {
		return JSON.stringify(this._state);
	}

	/**
	 * Restore state from a plain object (parsed from ui_state JSON).
	 * Validates shape, granularity value, and viewMode value before applying.
	 * Does NOT notify subscribers (snap to state, no animation on restore).
	 *
	 * @throws {Error} if the state shape is invalid or contains unrecognized values
	 */
	setState(state: unknown): void {
		if (!isSuperDensityState(state)) {
			throw new Error('[SuperDensityProvider] setState: invalid state shape');
		}

		// Validate granularity value (if non-null)
		if (state.axisGranularity !== null && !(ALLOWED_GRANULARITIES as Set<string>).has(state.axisGranularity)) {
			throw new Error(
				`[SuperDensityProvider] setState: invalid axisGranularity "${state.axisGranularity}". ` +
					`Allowed: ${[...ALLOWED_GRANULARITIES].join(', ')} or null`,
			);
		}

		// Validate viewMode value
		if (!(ALLOWED_VIEW_MODES as Set<string>).has(state.viewMode)) {
			throw new Error(
				`[SuperDensityProvider] setState: invalid viewMode "${state.viewMode}". ` +
					`Allowed: ${[...ALLOWED_VIEW_MODES].join(', ')}`,
			);
		}

		// Backward compat: older serialized state may lack displayField (Phase 55)
		// Phase 71-02: Delegate to SchemaProvider when wired (DYNM-12), fallback to frozen set
		this._state = {
			...state,
			displayField: this._isValidDisplayField(state.displayField as string)
				? (state.displayField as AxisField)
				: ('name' as AxisField),
		};
		// Do NOT notify subscribers — per pattern "skip animation on restore"
	}

	/**
	 * Reset to default state (no granularity, show empty cells, spreadsheet mode).
	 * Called by StateManager when JSON restoration fails.
	 */
	resetToDefaults(): void {
		this._state = { ...DEFAULT_STATE };
	}
}

// ---------------------------------------------------------------------------
// Type guard for state restoration
// ---------------------------------------------------------------------------

function isSuperDensityState(value: unknown): value is SuperDensityState {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value as Record<string, unknown>;

	// axisGranularity: must be null or a string
	if (obj['axisGranularity'] !== null && typeof obj['axisGranularity'] !== 'string') return false;

	// hideEmpty: must be boolean
	if (typeof obj['hideEmpty'] !== 'boolean') return false;

	// viewMode: must be a string
	if (typeof obj['viewMode'] !== 'string') return false;

	// regionConfig: must be null (DENS-04 stub)
	if (obj['regionConfig'] !== null) return false;

	// displayField: optional — accept missing or valid string (Phase 55)
	if (obj['displayField'] !== undefined && typeof obj['displayField'] !== 'string') return false;

	return true;
}
