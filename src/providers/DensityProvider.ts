// Isometry v5 — Phase 4 DensityProvider
// Time granularity state management and strftime() SQL expression compilation.
//
// Design:
//   - Internal state: timeField + granularity (never entity data)
//   - compile() is synchronous and pure — no side effects, no async
//   - Only 3 valid timeFields: 'created_at' | 'modified_at' | 'due_at'
//   - STRFTIME_PATTERNS map: TimeGranularity → (field: string) => string
//   - Quarter pattern uses integer division: CAST + (m-1)/3+1 formula
//   - Subscriber notifications batched via queueMicrotask (CONTEXT.md locked decision)
//   - subscribe() returns unsubscribe function (PROV-11)
//   - Implements PersistableProvider (Tier 2 persistence)
//
// Requirements: PROV-07, PROV-08, PROV-11

import type { TimeGranularity, CompiledDensity, PersistableProvider } from './types';

// ---------------------------------------------------------------------------
// Valid time field type
// ---------------------------------------------------------------------------

type TimeField = 'created_at' | 'modified_at' | 'due_at';

const ALLOWED_TIME_FIELDS: ReadonlySet<TimeField> = Object.freeze(
  new Set<TimeField>(['created_at', 'modified_at', 'due_at'])
);

const ALLOWED_GRANULARITIES: ReadonlySet<TimeGranularity> = Object.freeze(
  new Set<TimeGranularity>(['day', 'week', 'month', 'quarter', 'year'])
);

// ---------------------------------------------------------------------------
// Internal state shape
// ---------------------------------------------------------------------------

interface DensityState {
  timeField: TimeField;
  granularity: TimeGranularity;
}

// ---------------------------------------------------------------------------
// strftime() pattern map
// ---------------------------------------------------------------------------

/**
 * SQL strftime() expression builders for each time granularity.
 * Quarter uses integer division: (month - 1) / 3 + 1 (SQLite integer division).
 */
const STRFTIME_PATTERNS: Record<TimeGranularity, (field: string) => string> = {
  day: field => `strftime('%Y-%m-%d', ${field})`,
  week: field => `strftime('%Y-W%W', ${field})`,
  month: field => `strftime('%Y-%m', ${field})`,
  quarter: field =>
    `strftime('%Y', ${field}) || '-Q' || ((CAST(strftime('%m', ${field}) AS INT) - 1) / 3 + 1)`,
  year: field => `strftime('%Y', ${field})`,
};

// ---------------------------------------------------------------------------
// DensityProvider
// ---------------------------------------------------------------------------

/**
 * Manages time granularity state and compiles strftime() SQL expressions
 * for GROUP BY clauses in time-axis views (Calendar, Timeline, Gallery).
 *
 * Produces a `{ groupExpr }` value where groupExpr is a raw SQL expression
 * (no GROUP BY keyword — QueryBuilder adds that).
 */
export class DensityProvider implements PersistableProvider {
  private _state: DensityState = {
    timeField: 'created_at',
    granularity: 'month',
  };

  private readonly _subscribers = new Set<() => void>();
  private _pendingNotify = false;

  // ---------------------------------------------------------------------------
  // State accessor
  // ---------------------------------------------------------------------------

  /**
   * Returns a copy of the current density state.
   */
  getState(): Readonly<DensityState> {
    return { ...this._state };
  }

  // ---------------------------------------------------------------------------
  // Mutation methods
  // ---------------------------------------------------------------------------

  /**
   * Set the time field used in strftime() expressions.
   * Only 'created_at', 'modified_at', and 'due_at' are valid.
   *
   * @throws {Error} if field is not one of the valid time fields
   */
  setTimeField(field: TimeField): void {
    if (!(ALLOWED_TIME_FIELDS as Set<string>).has(field)) {
      throw new Error(
        `[DensityProvider] setTimeField: invalid time field "${String(field)}". ` +
          `Allowed: ${[...ALLOWED_TIME_FIELDS].join(', ')}`
      );
    }
    this._state.timeField = field;
    this._scheduleNotify();
  }

  /**
   * Set the time granularity for grouping.
   * Valid values: 'day' | 'week' | 'month' | 'quarter' | 'year'.
   */
  setGranularity(granularity: TimeGranularity): void {
    this._state.granularity = granularity;
    this._scheduleNotify();
  }

  // ---------------------------------------------------------------------------
  // compile() — SQL expression generation
  // ---------------------------------------------------------------------------

  /**
   * Compile current density state to a strftime() SQL GROUP BY expression.
   *
   * Returns `{ groupExpr }` where groupExpr is a raw SQL expression
   * using strftime() with the active time field and granularity.
   * No GROUP BY keyword is included — QueryBuilder (Plan 05) adds that.
   */
  compile(): CompiledDensity {
    const pattern = STRFTIME_PATTERNS[this._state.granularity];
    return { groupExpr: pattern(this._state.timeField) };
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
   */
  toJSON(): string {
    return JSON.stringify(this._state);
  }

  /**
   * Restore state from a plain object (parsed from ui_state JSON).
   * Validates timeField and granularity before applying.
   * Does NOT notify subscribers (snap to state per CONTEXT.md).
   *
   * @throws {Error} if the state shape is corrupt, timeField invalid, or granularity invalid
   */
  setState(state: unknown): void {
    if (!isDensityState(state)) {
      throw new Error('[DensityProvider] setState: invalid state shape');
    }

    if (!(ALLOWED_TIME_FIELDS as Set<string>).has(state.timeField)) {
      throw new Error(
        `[DensityProvider] setState: invalid time field "${state.timeField}". ` +
          `Allowed: ${[...ALLOWED_TIME_FIELDS].join(', ')}`
      );
    }

    if (!(ALLOWED_GRANULARITIES as Set<string>).has(state.granularity)) {
      throw new Error(
        `[DensityProvider] setState: invalid granularity "${state.granularity}". ` +
          `Allowed: ${[...ALLOWED_GRANULARITIES].join(', ')}`
      );
    }

    this._state = { ...state };
    // Do NOT notify subscribers — per CONTEXT.md "skip animation on restore"
  }

  /**
   * Reset to default state (created_at field, month granularity).
   * Called by StateManager when JSON restoration fails.
   */
  resetToDefaults(): void {
    this._state = {
      timeField: 'created_at',
      granularity: 'month',
    };
  }
}

// ---------------------------------------------------------------------------
// Type guard for state restoration
// ---------------------------------------------------------------------------

function isDensityState(value: unknown): value is DensityState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['timeField'] === 'string' && typeof obj['granularity'] === 'string';
}
