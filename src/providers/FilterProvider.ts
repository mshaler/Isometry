// Isometry v5 — Phase 4 FilterProvider
// Filter state management and SQL compilation with runtime allowlist validation.
//
// Design:
//   - Internal state: filters array + searchQuery (never entity data)
//   - compile() is synchronous and pure — no side effects, no async
//   - Runtime allowlist validation in both addFilter() and compile()
//     (compile-time validation for typed callers, runtime for JSON-restored state)
//   - Subscriber notifications batched via queueMicrotask (CONTEXT.md locked decision)
//   - subscribe() returns unsubscribe function (PROV-11)
//   - Implements PersistableProvider (Tier 2 persistence)
//
// Requirements: PROV-01, PROV-02, PROV-11

import { validateFilterField, validateOperator } from './allowlist';
import type {
  Filter,
  FilterField,
  FilterOperator,
  CompiledFilter,
  PersistableProvider,
} from './types';

// ---------------------------------------------------------------------------
// Internal state shape
// ---------------------------------------------------------------------------

interface FilterState {
  filters: Filter[];
  searchQuery: string | null;
}

// ---------------------------------------------------------------------------
// FilterProvider
// ---------------------------------------------------------------------------

/**
 * Manages user-specified filter conditions and compiles them to safe
 * parameterized SQL WHERE fragments.
 *
 * Always includes `deleted_at IS NULL` as the base clause.
 * FTS search uses rowid joins (never id) per D-004.
 */
export class FilterProvider implements PersistableProvider {
  // Internal state — do NOT access from tests; use getFilters() / compile()
  _filters: Filter[] = [];
  private _searchQuery: string | null = null;

  private readonly _subscribers = new Set<() => void>();
  private _pendingNotify = false;

  // ---------------------------------------------------------------------------
  // Mutation methods
  // ---------------------------------------------------------------------------

  /**
   * Add a filter condition. Validates field and operator against the allowlist
   * before storing (fail-fast, prevents invalid state from accumulating).
   *
   * @throws {Error} "SQL safety violation: ..." for unknown field or operator
   */
  addFilter(filter: Filter): void {
    // Validate at add time so invalid state never enters the array
    validateFilterField(filter.field as string);
    validateOperator(filter.operator as string);
    this._filters.push(filter);
    this._scheduleNotify();
  }

  /**
   * Remove the filter at the given index (0-based).
   * No-op for out-of-range indices.
   */
  removeFilter(index: number): void {
    this._filters.splice(index, 1);
    this._scheduleNotify();
  }

  /**
   * Remove all filters and clear the search query.
   */
  clearFilters(): void {
    this._filters = [];
    this._searchQuery = null;
    this._scheduleNotify();
  }

  /**
   * Set or clear the full-text search query.
   *
   * @param query - Search terms string, or null to clear FTS filter
   */
  setSearchQuery(query: string | null): void {
    this._searchQuery = query;
    this._scheduleNotify();
  }

  // ---------------------------------------------------------------------------
  // Query methods
  // ---------------------------------------------------------------------------

  /**
   * Returns a readonly copy of the current filters array.
   * Mutations to the returned array do not affect internal state.
   */
  getFilters(): readonly Filter[] {
    return [...this._filters];
  }

  /**
   * Compile current filter state to a SQL WHERE fragment.
   *
   * Returns `{ where, params }` where:
   *   - `where` always starts with `deleted_at IS NULL`
   *   - All user values are in `params` (never interpolated into `where`)
   *   - Field names are interpolated only after allowlist validation
   *
   * Also validates field/operator at compile time — handles the case where
   * state was restored from JSON and may contain values that bypassed addFilter().
   *
   * @throws {Error} "SQL safety violation: ..." for any invalid field or operator
   */
  compile(): CompiledFilter {
    const clauses: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    for (const filter of this._filters) {
      // Runtime validation — handles JSON-restored or otherwise untrusted state
      validateFilterField(filter.field as string);
      validateOperator(filter.operator as string);

      const { clause, filterParams } = compileOperator(filter.field, filter.operator, filter.value);
      clauses.push(clause);
      params.push(...filterParams);
    }

    // FTS search — uses rowid (not id) per D-004 and Pitfall 5
    if (this._searchQuery !== null && this._searchQuery !== '') {
      clauses.push('rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)');
      const ftsQuery = this._searchQuery
        .trim()
        .split(/\s+/)
        .map(t => `"${t}"*`)
        .join(' ');
      params.push(ftsQuery);
    }

    return { where: clauses.join(' AND '), params };
  }

  // ---------------------------------------------------------------------------
  // Subscribe / notify pattern (PROV-11)
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to filter changes. Called once (via queueMicrotask) per
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
    const state: FilterState = {
      filters: [...this._filters],
      searchQuery: this._searchQuery,
    };
    return JSON.stringify(state);
  }

  /**
   * Restore state from a plain object (parsed from ui_state JSON).
   * Called by StateManager.restore(). Validates restored filters via allowlist.
   *
   * @throws {Error} if the state shape is corrupt or contains invalid fields/operators
   */
  setState(state: unknown): void {
    if (!isFilterState(state)) {
      throw new Error('[FilterProvider] setState: invalid state shape');
    }

    // Validate all restored filters before applying (no partial state)
    for (const f of state.filters) {
      validateFilterField(f.field as string);
      validateOperator(f.operator as string);
    }

    this._filters = [...state.filters];
    this._searchQuery = state.searchQuery;
    // Do NOT notify subscribers — per CONTEXT.md "skip animation on restore"
  }

  /**
   * Reset to empty state (no filters, no search).
   * Called by StateManager when JSON restoration fails.
   */
  resetToDefaults(): void {
    this._filters = [];
    this._searchQuery = null;
  }

  // ---------------------------------------------------------------------------
  // Static factory
  // ---------------------------------------------------------------------------

  /**
   * Create a FilterProvider from a serialized JSON string.
   *
   * @throws {Error} if `json` is not valid JSON or contains an invalid state shape
   */
  static fromJSON(json: string): FilterProvider {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error(`[FilterProvider] fromJSON: invalid JSON — ${json.slice(0, 50)}`);
    }

    const provider = new FilterProvider();
    provider.setState(parsed);
    return provider;
  }
}

// ---------------------------------------------------------------------------
// Pure SQL compilation helpers
// ---------------------------------------------------------------------------

/**
 * Compile a single filter condition to a SQL clause + params pair.
 * Field has already been validated by addFilter() and compile().
 */
function compileOperator(
  field: FilterField,
  operator: FilterOperator,
  value: unknown
): { clause: string; filterParams: unknown[] } {
  switch (operator) {
    case 'eq':
      return { clause: `${field} = ?`, filterParams: [value] };

    case 'neq':
      return { clause: `${field} != ?`, filterParams: [value] };

    case 'gt':
      return { clause: `${field} > ?`, filterParams: [value] };

    case 'gte':
      return { clause: `${field} >= ?`, filterParams: [value] };

    case 'lt':
      return { clause: `${field} < ?`, filterParams: [value] };

    case 'lte':
      return { clause: `${field} <= ?`, filterParams: [value] };

    case 'contains':
      return { clause: `${field} LIKE ?`, filterParams: [`%${value as string}%`] };

    case 'startsWith':
      return { clause: `${field} LIKE ?`, filterParams: [`${value as string}%`] };

    case 'in': {
      const values = value as unknown[];
      const placeholders = values.map(() => '?').join(', ');
      return { clause: `${field} IN (${placeholders})`, filterParams: values };
    }

    case 'isNull':
      return { clause: `${field} IS NULL`, filterParams: [] };

    case 'isNotNull':
      return { clause: `${field} IS NOT NULL`, filterParams: [] };

    default: {
      // TypeScript should make this unreachable after validateOperator
      const _exhaustive: never = operator;
      throw new Error(`SQL safety violation: unhandled operator "${_exhaustive as string}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Type guard for state restoration
// ---------------------------------------------------------------------------

function isFilterState(value: unknown): value is FilterState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj['filters'])) return false;
  if (obj['searchQuery'] !== null && typeof obj['searchQuery'] !== 'string') return false;

  for (const item of obj['filters'] as unknown[]) {
    if (typeof item !== 'object' || item === null) return false;
    const f = item as Record<string, unknown>;
    if (typeof f['field'] !== 'string') return false;
    if (typeof f['operator'] !== 'string') return false;
    if (!('value' in f)) return false;
  }

  return true;
}
