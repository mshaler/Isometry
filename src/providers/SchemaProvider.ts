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
		return [...this._cards];
	}

	/**
	 * Returns all card columns as axis-eligible columns.
	 * Per user decision (SCHM-05): all PRAGMA-derived columns are axis-eligible.
	 */
	getAxisColumns(): readonly ColumnInfo[] {
		return [...this._cards];
	}

	/**
	 * Returns only columns with isNumeric === true (INTEGER or REAL type).
	 * Useful for aggregate operations (SUM, AVG, etc.) in CalcExplorer.
	 */
	getNumericColumns(): readonly ColumnInfo[] {
		return this._cards.filter((c) => c.isNumeric);
	}

	/**
	 * Returns all card columns belonging to the specified LATCH family.
	 */
	getFieldsByFamily(family: LatchFamily): readonly ColumnInfo[] {
		return this._cards.filter((c) => c.latchFamily === family);
	}

	/**
	 * Returns a Map of LATCH family -> column names for all card columns.
	 * Useful for grouping columns in UI explorers.
	 */
	getLatchFamilies(): Map<LatchFamily, string[]> {
		const result = new Map<LatchFamily, string[]>();
		for (const col of this._cards) {
			const existing = result.get(col.latchFamily);
			if (existing) {
				existing.push(col.name);
			} else {
				result.set(col.latchFamily, [col.name]);
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
