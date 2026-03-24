// Isometry v5 — Phase 70 Plan 01
// SchemaProvider: Runtime schema metadata from PRAGMA table_info().
//
// Design:
//   - NOT a PersistableProvider — schema is derived from PRAGMA, not user state.
//   - Subscriber notifications batched via queueMicrotask (same pattern as AliasProvider).
//   - initialize() is idempotent — second call replaces state and re-notifies.
//   - WorkerBridge onSchema callback calls initialize() before isReady resolves,
//     ensuring schema is available synchronously after `await bridge.isReady`.
//
// Requirements: SCHM-03, SCHM-04, SCHM-05, SCHM-07

import type { ColumnInfo, LatchFamily } from '../worker/protocol';

/**
 * SchemaProvider manages runtime database schema metadata.
 *
 * Schema is derived from PRAGMA table_info() in the Worker at initialization time
 * and forwarded via WorkerReadyMessage.schema. SchemaProvider stores this metadata
 * and exposes typed accessors for column introspection.
 *
 * Usage in main.ts:
 *   const schemaProvider = new SchemaProvider();
 *   createWorkerBridge({ onSchema: (schema) => schemaProvider.initialize(schema) });
 *   await bridge.isReady; // schema is now populated
 *   setSchemaProvider(schemaProvider); // wire allowlist delegation
 */
export class SchemaProvider {
	private _cards: ColumnInfo[] = [];
	private _connections: ColumnInfo[] = [];
	private _validCardColumns: Set<string> = new Set();
	private _validConnectionColumns: Set<string> = new Set();
	private _initialized = false;
	private _subscribers: Set<() => void> = new Set();
	private _pendingNotify = false;

	// Phase 73: User-configurable LATCH override layer
	private _latchOverrides: Map<string, LatchFamily> = new Map();
	private _disabledFields: Set<string> = new Set();

	// Phase 116: Graph metric columns (dynamically injected after graph:compute)
	private _graphMetricColumns: ColumnInfo[] = [];

	// -----------------------------------------------------------------------
	// Initialization
	// -----------------------------------------------------------------------

	/**
	 * Initialize (or re-initialize) schema metadata from PRAGMA results.
	 * Idempotent — second call replaces state and re-notifies subscribers.
	 *
	 * Called by WorkerBridge onSchema callback, which fires BEFORE isReady resolves.
	 */
	initialize(schema: { cards: ColumnInfo[]; connections: ColumnInfo[] }): void {
		this._cards = [...schema.cards];
		this._connections = [...schema.connections];
		this._validCardColumns = new Set(this._cards.map((c) => c.name));
		this._validConnectionColumns = new Set(this._connections.map((c) => c.name));
		this._initialized = true;
		this._scheduleNotify();
	}

	// -----------------------------------------------------------------------
	// Read-only accessor
	// -----------------------------------------------------------------------

	/** True after initialize() has been called at least once. */
	get initialized(): boolean {
		return this._initialized;
	}

	/**
	 * Re-notify all subscribers without changing schema state.
	 * Used after dataset eviction — DDL is constant across datasets,
	 * so column metadata is unchanged, but subscribers (PropertiesExplorer,
	 * ProjectionExplorer, LatchExplorers) need to refresh with reset provider state.
	 *
	 * Per user decision: "SchemaProvider must re-introspect after new data loads."
	 * Since DDL is identical across all datasets (same cards/connections table structure),
	 * re-notification achieves the same effect as full PRAGMA re-introspection.
	 */
	refresh(): void {
		this._scheduleNotify();
	}

	// -----------------------------------------------------------------------
	// LATCH override layer (Phase 73 — user-configurable mappings)
	// -----------------------------------------------------------------------

	/**
	 * Replace the LATCH family override map. User overrides always win
	 * over heuristic classification (PRAGMA-derived latchFamily).
	 */
	setOverrides(overrides: Map<string, LatchFamily>): void {
		this._latchOverrides = new Map(overrides);
		this._scheduleNotify();
	}

	/**
	 * Replace the set of disabled fields. Disabled fields are excluded
	 * from axis, filter, numeric, and family accessors but remain valid
	 * columns (getColumns/isValidColumn are unaffected).
	 */
	setDisabled(disabled: Set<string>): void {
		this._disabledFields = new Set(disabled);
		this._scheduleNotify();
	}

	/**
	 * Returns the original PRAGMA-derived latchFamily for a field,
	 * ignoring any user override.
	 */
	getHeuristicFamily(field: string): LatchFamily | undefined {
		return this._cards.find((c) => c.name === field)?.latchFamily;
	}

	/**
	 * Returns the user override for a field, or undefined if none set.
	 */
	getLatchOverride(field: string): LatchFamily | undefined {
		return this._latchOverrides.get(field);
	}

	/** True if any LATCH family overrides are configured. */
	hasAnyOverride(): boolean {
		return this._latchOverrides.size > 0;
	}

	/** True if any fields are disabled. */
	hasAnyDisabled(): boolean {
		return this._disabledFields.size > 0;
	}

	/** Returns the set of disabled field names (readonly). */
	getDisabledFields(): ReadonlySet<string> {
		return this._disabledFields;
	}

	/** Returns the override map (readonly). Needed for persistence serialization. */
	getOverrides(): ReadonlyMap<string, LatchFamily> {
		return this._latchOverrides;
	}

	// -----------------------------------------------------------------------
	// Graph metric column injection (Phase 116)
	// -----------------------------------------------------------------------

	/**
	 * Inject 6 graph metric columns into SchemaProvider.
	 * Called after graph:compute succeeds. Idempotent — second call is a no-op.
	 *
	 * Columns: community_id, pagerank, centrality, clustering_coeff, sp_depth, in_spanning_tree.
	 * All are classified as LATCH 'Hierarchy'. community_id is categorical (isNumeric=false);
	 * the rest are numeric (isNumeric=true).
	 */
	addGraphMetricColumns(): void {
		if (this._graphMetricColumns.length > 0) return; // idempotent

		this._graphMetricColumns = [
			{ name: 'community_id', type: 'INTEGER', notnull: false, latchFamily: 'Hierarchy', isNumeric: false },
			{ name: 'pagerank', type: 'REAL', notnull: false, latchFamily: 'Hierarchy', isNumeric: true },
			{ name: 'centrality', type: 'REAL', notnull: false, latchFamily: 'Hierarchy', isNumeric: true },
			{ name: 'clustering_coeff', type: 'REAL', notnull: false, latchFamily: 'Hierarchy', isNumeric: true },
			{ name: 'sp_depth', type: 'INTEGER', notnull: false, latchFamily: 'Hierarchy', isNumeric: true },
			{ name: 'in_spanning_tree', type: 'INTEGER', notnull: false, latchFamily: 'Hierarchy', isNumeric: true },
		];

		for (const col of this._graphMetricColumns) {
			this._validCardColumns.add(col.name);
		}

		this._scheduleNotify();
	}

	/**
	 * Remove all graph metric columns from SchemaProvider.
	 * Called when metrics are cleared or dataset changes.
	 */
	removeGraphMetricColumns(): void {
		for (const col of this._graphMetricColumns) {
			this._validCardColumns.delete(col.name);
		}
		this._graphMetricColumns = [];
		this._scheduleNotify();
	}

	/** True if graph metric columns are currently injected. */
	hasGraphMetrics(): boolean {
		return this._graphMetricColumns.length > 0;
	}

	// -----------------------------------------------------------------------
	// Column accessors
	// -----------------------------------------------------------------------

	/**
	 * Returns the full ColumnInfo array for the specified table.
	 * Returns a readonly copy — callers cannot mutate internal state.
	 */
	getColumns(table: 'cards' | 'connections'): readonly ColumnInfo[] {
		return table === 'cards' ? [...this._cards] : [...this._connections];
	}

	/**
	 * Returns true if the column name exists in the specified table's schema.
	 * Defaults to 'cards' when table is not specified.
	 *
	 * @param name - Column name to check
	 * @param table - Which table to check ('cards' or 'connections'). Defaults to 'cards'.
	 */
	isValidColumn(name: string, table: 'cards' | 'connections' = 'cards'): boolean {
		const set = table === 'cards' ? this._validCardColumns : this._validConnectionColumns;
		return set.has(name);
	}

	/**
	 * Returns all card columns as filterable columns.
	 * Per user decision (SCHM-04): all PRAGMA-derived columns are filterable.
	 */
	getFilterableColumns(): readonly ColumnInfo[] {
		const base = this._cards.filter((c) => !this._disabledFields.has(c.name));
		const metrics = this._graphMetricColumns.filter((c) => !this._disabledFields.has(c.name));
		return [...base, ...metrics];
	}

	/**
	 * Returns all card columns as axis-eligible columns.
	 * Per user decision (SCHM-05): all PRAGMA-derived columns are axis-eligible.
	 */
	getAxisColumns(): readonly ColumnInfo[] {
		const base = this._cards
			.filter((c) => !this._disabledFields.has(c.name))
			.map((c) => ({
				...c,
				latchFamily: this._latchOverrides.get(c.name) ?? c.latchFamily,
			}));
		const metrics = this._graphMetricColumns
			.filter((c) => !this._disabledFields.has(c.name))
			.map((c) => ({
				...c,
				latchFamily: this._latchOverrides.get(c.name) ?? c.latchFamily,
			}));
		return [...base, ...metrics];
	}

	/**
	 * Returns ALL columns (including disabled) with override-applied latchFamily.
	 * Needed by PropertiesExplorer to show disabled fields greyed-out in place.
	 */
	getAllAxisColumns(): readonly ColumnInfo[] {
		const base = this._cards.map((c) => ({
			...c,
			latchFamily: this._latchOverrides.get(c.name) ?? c.latchFamily,
		}));
		const metrics = this._graphMetricColumns.map((c) => ({
			...c,
			latchFamily: this._latchOverrides.get(c.name) ?? c.latchFamily,
		}));
		return [...base, ...metrics];
	}

	/**
	 * Returns only columns with isNumeric === true (INTEGER or REAL type).
	 * Useful for aggregate operations (SUM, AVG, etc.) in CalcExplorer.
	 */
	getNumericColumns(): readonly ColumnInfo[] {
		const base = this._cards.filter((c) => c.isNumeric && !this._disabledFields.has(c.name));
		const metrics = this._graphMetricColumns.filter((c) => c.isNumeric && !this._disabledFields.has(c.name));
		return [...base, ...metrics];
	}

	/**
	 * Returns all card columns belonging to the specified LATCH family.
	 */
	getFieldsByFamily(family: LatchFamily): readonly ColumnInfo[] {
		const allCols = [...this._cards, ...this._graphMetricColumns];
		return allCols.filter((c) => {
			if (this._disabledFields.has(c.name)) return false;
			const effective = this._latchOverrides.get(c.name) ?? c.latchFamily;
			return effective === family;
		});
	}

	/**
	 * Returns a Map of LATCH family -> column names for all card columns.
	 * Useful for grouping columns in UI explorers.
	 */
	getLatchFamilies(): Map<LatchFamily, string[]> {
		const result = new Map<LatchFamily, string[]>();
		const allCols = [...this._cards, ...this._graphMetricColumns];
		for (const col of allCols) {
			if (this._disabledFields.has(col.name)) continue;
			const effective = this._latchOverrides.get(col.name) ?? col.latchFamily;
			const existing = result.get(effective);
			if (existing) {
				existing.push(col.name);
			} else {
				result.set(effective, [col.name]);
			}
		}
		return result;
	}

	// -----------------------------------------------------------------------
	// Subscriber pattern (queueMicrotask batching — same as AliasProvider)
	// -----------------------------------------------------------------------

	/**
	 * Subscribe to schema changes. Returns an unsubscribe function.
	 * Notifications are batched via queueMicrotask.
	 */
	subscribe(callback: () => void): () => void {
		this._subscribers.add(callback);
		return () => {
			this._subscribers.delete(callback);
		};
	}

	// -----------------------------------------------------------------------
	// Private
	// -----------------------------------------------------------------------

	/**
	 * Schedule subscriber notification via queueMicrotask.
	 * Multiple mutations within the same microtask are batched into one notification.
	 */
	private _scheduleNotify(): void {
		if (this._pendingNotify) return;
		this._pendingNotify = true;
		queueMicrotask(() => {
			this._pendingNotify = false;
			for (const cb of this._subscribers) {
				cb();
			}
		});
	}
}
