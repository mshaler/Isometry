// Isometry v5 — Phase 4 FilterProvider
// Filter state management and SQL compilation with runtime allowlist validation.
//
// Design:
//   - Internal state: filters array + searchQuery (never entity data)
//   - _axisFilters Map: per-axis selected values for Phase 24 filter dropdowns
//   - compile() is synchronous and pure — no side effects, no async
//   - Runtime allowlist validation in both addFilter() and compile()
//     (compile-time validation for typed callers, runtime for JSON-restored state)
//   - Subscriber notifications batched via queueMicrotask (CONTEXT.md locked decision)
//   - subscribe() returns unsubscribe function (PROV-11)
//   - Implements PersistableProvider (Tier 2 persistence)
//
// Requirements: PROV-01, PROV-02, PROV-11, FILT-03, FILT-05

import { validateFilterField, validateOperator } from './allowlist';
import type { CompiledFilter, Filter, FilterField, FilterOperator, MembershipFilter, PersistableProvider, RangeFilter } from './types';

// ---------------------------------------------------------------------------
// Internal state shape
// ---------------------------------------------------------------------------

interface FilterState {
	filters: Filter[];
	searchQuery: string | null;
	/** Phase 24 — axis filter values per field. Optional for backward compat. */
	axisFilters?: Record<string, string[]>;
	/** Phase 66 — range filter min/max pairs per field. Optional for backward compat. */
	rangeFilters?: Record<string, RangeFilter>;
	/** Phase 138 — multi-field OR-semantics membership filter. Optional for backward compat. */
	membershipFilter?: MembershipFilter | null;
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
	/** Phase 24 — per-axis selected values for filter dropdowns (FILT-03, FILT-05) */
	private _axisFilters: Map<string, string[]> = new Map();
	/** Phase 66 — range filter min/max pairs for histogram scrubbers (LTPB-01) */
	private _rangeFilters: Map<string, RangeFilter> = new Map();
	/** Phase 138 — multi-field OR-semantics membership filter (TFLT-03) */
	private _membershipFilter: MembershipFilter | null = null;

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
	 * Whether any filters, search query, or axis filters are currently active.
	 * Used by the command palette to gate contextual commands (e.g., "Clear Filters").
	 */
	hasActiveFilters(): boolean {
		return (
			this._filters.length > 0 ||
			this._searchQuery !== null ||
			this._axisFilters.size > 0 ||
			this._rangeFilters.size > 0 ||
			this._membershipFilter !== null
		);
	}

	/**
	 * Remove all filters and clear the search query.
	 * Phase 24: also clears all axis filters (FILT-03).
	 */
	clearFilters(): void {
		this._filters = [];
		this._searchQuery = null;
		this._axisFilters.clear();
		this._rangeFilters.clear();
		this._membershipFilter = null;
		this._scheduleNotify();
	}

	// ---------------------------------------------------------------------------
	// Phase 24 — Axis filter API (FILT-03, FILT-05)
	// ---------------------------------------------------------------------------

	/**
	 * Set selected values for a specific field axis filter.
	 * If values is empty, removes the axis filter entirely (FILT-05: empty = unfiltered,
	 * prevents invalid IN () SQL clause).
	 *
	 * @throws {Error} "SQL safety violation: ..." for unknown field
	 */
	setAxisFilter(field: string, values: string[]): void {
		validateFilterField(field);
		if (values.length === 0) {
			this._axisFilters.delete(field);
		} else {
			this._axisFilters.set(field, [...values]);
		}
		this._scheduleNotify();
	}

	/**
	 * Remove the axis filter for a single field.
	 *
	 * @throws {Error} "SQL safety violation: ..." for unknown field
	 */
	clearAxis(field: string): void {
		validateFilterField(field);
		this._axisFilters.delete(field);
		this._scheduleNotify();
	}

	/**
	 * Returns true when an axis filter is set with non-empty values for the given field.
	 */
	hasAxisFilter(field: string): boolean {
		return this._axisFilters.has(field) && (this._axisFilters.get(field)?.length ?? 0) > 0;
	}

	/**
	 * Returns a defensive copy of the axis filter values for the given field.
	 * Returns [] if no filter is set for that field.
	 */
	getAxisFilter(field: string): string[] {
		return [...(this._axisFilters.get(field) ?? [])];
	}

	/**
	 * Remove all axis filters at once.
	 * Regular filters and search query are unaffected.
	 */
	clearAllAxisFilters(): void {
		this._axisFilters.clear();
		this._scheduleNotify();
	}

	// ---------------------------------------------------------------------------
	// Phase 66 — Range filter API (LTPB-01)
	// ---------------------------------------------------------------------------

	/**
	 * Atomically set a range filter (min/max) for a field.
	 * Replaces any existing range for the same field (prevents compounding).
	 * If both min and max are null/undefined, removes the entry (equivalent to clear).
	 *
	 * @throws {Error} "SQL safety violation: ..." for unknown field
	 */
	setRangeFilter(field: string, min: unknown, max: unknown): void {
		validateFilterField(field);
		if ((min === null || min === undefined) && (max === null || max === undefined)) {
			this._rangeFilters.delete(field);
		} else {
			this._rangeFilters.set(field, { min: min ?? null, max: max ?? null });
		}
		this._scheduleNotify();
	}

	/**
	 * Remove the range filter for a single field.
	 *
	 * @throws {Error} "SQL safety violation: ..." for unknown field
	 */
	clearRangeFilter(field: string): void {
		validateFilterField(field);
		this._rangeFilters.delete(field);
		this._scheduleNotify();
	}

	/**
	 * Returns true when a range filter is set for the given field.
	 */
	hasRangeFilter(field: string): boolean {
		return this._rangeFilters.has(field);
	}

	// ---------------------------------------------------------------------------
	// Phase 138 — Membership filter API (TFLT-03)
	// ---------------------------------------------------------------------------

	/**
	 * Set a multi-field OR-semantics membership filter.
	 * Card passes if ANY of the specified fields falls within [min, max].
	 *
	 * If fields is empty OR both min and max are null/undefined, clears any existing filter.
	 *
	 * @throws {Error} "SQL safety violation: ..." for unknown field
	 */
	setMembershipFilter(fields: string[], min: unknown, max: unknown): void {
		const minVal = min ?? null;
		const maxVal = max ?? null;
		if (fields.length === 0 || (minVal === null && maxVal === null)) {
			this._membershipFilter = null;
			this._scheduleNotify();
			return;
		}
		for (const field of fields) {
			validateFilterField(field);
		}
		this._membershipFilter = { fields: [...fields], min: minVal, max: maxVal };
		this._scheduleNotify();
	}

	/**
	 * Remove the membership filter.
	 */
	clearMembershipFilter(): void {
		this._membershipFilter = null;
		this._scheduleNotify();
	}

	/**
	 * Returns true when a membership filter is active.
	 */
	hasMembershipFilter(): boolean {
		return this._membershipFilter !== null;
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

		// Phase 24 — axis filters: compile after regular filters, before FTS
		// Deterministic order: iterate insertion order of the Map
		for (const [field, values] of this._axisFilters.entries()) {
			if (values.length === 0) continue; // defensive: empty entries should not exist
			// Runtime validation — guards JSON-restored state
			validateFilterField(field);
			const placeholders = values.map(() => '?').join(', ');
			clauses.push(`${field} IN (${placeholders})`);
			params.push(...values);
		}

		// Phase 66 — range filters: compile after axis filters, before FTS
		for (const [field, range] of this._rangeFilters.entries()) {
			// Runtime validation — guards JSON-restored state
			validateFilterField(field);
			if (range.min !== null && range.min !== undefined) {
				clauses.push(`${field} >= ?`);
				params.push(range.min);
			}
			if (range.max !== null && range.max !== undefined) {
				clauses.push(`${field} <= ?`);
				params.push(range.max);
			}
		}

		// Phase 138 — membership filter: OR-semantics across multiple fields, compile after range filters
		if (this._membershipFilter !== null) {
			const orParts: string[] = [];
			const orParams: unknown[] = [];
			for (const field of this._membershipFilter.fields) {
				validateFilterField(field);
				const conditions: string[] = [];
				if (this._membershipFilter.min !== null && this._membershipFilter.min !== undefined) {
					conditions.push(`${field} >= ?`);
					orParams.push(this._membershipFilter.min);
				}
				if (this._membershipFilter.max !== null && this._membershipFilter.max !== undefined) {
					conditions.push(`${field} <= ?`);
					orParams.push(this._membershipFilter.max);
				}
				if (conditions.length > 0) {
					orParts.push(`(${conditions.join(' AND ')})`);
				}
			}
			if (orParts.length > 0) {
				clauses.push(`(${orParts.join(' OR ')})`);
				params.push(...orParams);
			}
		}

		// FTS search — uses rowid (not id) per D-004 and Pitfall 5
		if (this._searchQuery !== null && this._searchQuery !== '') {
			clauses.push('rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)');
			const ftsQuery = this._searchQuery
				.trim()
				.split(/\s+/)
				.map((t) => `"${t}"*`)
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
			this._subscribers.forEach((cb) => cb());
		});
	}

	// ---------------------------------------------------------------------------
	// PersistableProvider — Tier 2 serialization
	// ---------------------------------------------------------------------------

	/**
	 * Serialize current state to a JSON string for the ui_state table.
	 * Phase 24: includes axisFilters as Record<string, string[]>.
	 */
	toJSON(): string {
		const state: FilterState = {
			filters: [...this._filters],
			searchQuery: this._searchQuery,
			axisFilters: Object.fromEntries(this._axisFilters),
			rangeFilters: Object.fromEntries(this._rangeFilters),
			membershipFilter: this._membershipFilter,
		};
		return JSON.stringify(state);
	}

	/**
	 * Restore state from a plain object (parsed from ui_state JSON).
	 * Called by StateManager.restore(). Validates restored filters via allowlist.
	 *
	 * Phase 24: restores axisFilters if present; defaults to {} if missing (backward compat).
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

		// Phase 24: restore axis filters — default to empty Map if missing (backward compat)
		this._axisFilters.clear();
		if (state.axisFilters !== undefined) {
			for (const [field, values] of Object.entries(state.axisFilters)) {
				this._axisFilters.set(field, [...values]);
			}
		}

		// Phase 66: restore range filters — default to empty Map if missing (backward compat)
		this._rangeFilters.clear();
		if (state.rangeFilters !== undefined) {
			for (const [field, range] of Object.entries(state.rangeFilters)) {
				this._rangeFilters.set(field, { min: range.min, max: range.max });
			}
		}

		// Phase 138: restore membership filter — default to null if missing (backward compat)
		this._membershipFilter = state.membershipFilter ?? null;
		// Do NOT notify subscribers — per CONTEXT.md "skip animation on restore"
	}

	/**
	 * Reset to empty state (no filters, no search, no axis filters).
	 * Called by StateManager when JSON restoration fails.
	 */
	resetToDefaults(): void {
		this._filters = [];
		this._searchQuery = null;
		this._axisFilters.clear();
		this._rangeFilters.clear();
		this._membershipFilter = null;
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
	value: unknown,
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

	// Phase 24: validate optional axisFilters — if present, must be Record<string, string[]>
	if ('axisFilters' in obj && obj['axisFilters'] !== undefined) {
		const af = obj['axisFilters'];
		if (typeof af !== 'object' || af === null || Array.isArray(af)) return false;
		for (const values of Object.values(af as Record<string, unknown>)) {
			if (!Array.isArray(values)) return false;
			for (const v of values as unknown[]) {
				if (typeof v !== 'string') return false;
			}
		}
	}

	// Phase 66: validate optional rangeFilters — if present, must be Record<string, {min, max}>
	if ('rangeFilters' in obj && obj['rangeFilters'] !== undefined) {
		const rf = obj['rangeFilters'];
		if (typeof rf !== 'object' || rf === null || Array.isArray(rf)) return false;
		for (const entry of Object.values(rf as Record<string, unknown>)) {
			if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return false;
			const e = entry as Record<string, unknown>;
			if (!('min' in e) || !('max' in e)) return false;
		}
	}

	// Phase 138: validate optional membershipFilter — if present (and non-null), must have fields (string[]), min, max
	if ('membershipFilter' in obj && obj['membershipFilter'] !== undefined && obj['membershipFilter'] !== null) {
		const mf = obj['membershipFilter'];
		if (typeof mf !== 'object' || mf === null || Array.isArray(mf)) return false;
		const m = mf as Record<string, unknown>;
		if (!Array.isArray(m['fields'])) return false;
		for (const f of m['fields'] as unknown[]) {
			if (typeof f !== 'string') return false;
		}
		if (!('min' in m) || !('max' in m)) return false;
	}

	return true;
}
