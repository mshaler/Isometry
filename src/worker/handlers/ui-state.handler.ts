// Isometry v5 — Phase 4 UI State Handler
// Handlers for ui_state CRUD operations and generic db:exec surface.
//
// These handlers provide:
//   - ui:get/set/delete/getAll — for StateManager (Plan 05) Tier 2 persistence
//   - db:exec — for MutationManager (Plan 06) inverse SQL (undo/redo)
//
// Pattern: Thin wrappers around Database methods, same as other Phase 3 handlers.

import type { Database } from '../../database/Database';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

// ---------------------------------------------------------------------------
// UI State CRUD
// ---------------------------------------------------------------------------

/**
 * Handle ui:get request.
 * Returns the row for the given key, or null values if not found.
 *
 * Uses db.prepare() instead of db.exec() because sql.js exec()/run() have
 * a known issue with bind params in Worker contexts (params silently ignored).
 */
export function handleUiGet(db: Database, payload: WorkerPayloads['ui:get']): WorkerResponses['ui:get'] {
	const stmt = db.prepare<{ key: string; value: string | null; updated_at: string | null }>(
		'SELECT key, value, updated_at FROM ui_state WHERE key = ?',
	);
	try {
		const rows = stmt.all(payload.key);
		if (rows.length === 0) {
			return { key: payload.key, value: null, updated_at: null };
		}
		const row = rows[0]!;
		return {
			key: row.key,
			value: row.value,
			updated_at: row.updated_at,
		};
	} finally {
		stmt.free();
	}
}

/**
 * Handle ui:set request.
 * Inserts or replaces a key-value pair. Updated_at is set by the schema default.
 *
 * Uses db.prepare() instead of db.run() because sql.js run() has a known issue
 * with bind params in Worker contexts (params silently ignored, inserting nulls).
 */
export function handleUiSet(db: Database, payload: WorkerPayloads['ui:set']): WorkerResponses['ui:set'] {
	const stmt = db.prepare(
		`INSERT OR REPLACE INTO ui_state (key, value, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`,
	);
	try {
		stmt.run(payload.key, payload.value);
	} finally {
		stmt.free();
	}
}

/**
 * Handle ui:delete request.
 * Removes the row for the given key. No-op if the key does not exist.
 *
 * Uses db.prepare() instead of db.run() — db.prepare() required for parameterized SQL
 * in Worker context (sql.js bind constraint).
 */
export function handleUiDelete(db: Database, payload: WorkerPayloads['ui:delete']): WorkerResponses['ui:delete'] {
	const stmt = db.prepare('DELETE FROM ui_state WHERE key = ?');
	try {
		stmt.run(payload.key);
	} finally {
		stmt.free();
	}
}

/**
 * Handle ui:getAll request.
 * Returns all key-value pairs from ui_state.
 */
export function handleUiGetAll(db: Database, _payload: WorkerPayloads['ui:getAll']): WorkerResponses['ui:getAll'] {
	const results = db.exec('SELECT key, value, updated_at FROM ui_state');

	if (results.length === 0) return [];

	return results[0]!.values.map((row) => ({
		key: row[0] as string,
		value: row[1] as string,
		updated_at: row[2] as string,
	}));
}

// ---------------------------------------------------------------------------
// Generic Exec (MutationManager surface)
// ---------------------------------------------------------------------------

/**
 * Handle db:exec request.
 * Executes parameterized SQL (for MutationManager undo/redo inverse SQL).
 * Returns the number of rows changed by the statement.
 *
 * SECURITY: This handler should only be called from MutationManager with
 * pre-validated inverse SQL. It must NOT be exposed as a general-purpose
 * SQL execution surface to untrusted input.
 */
export function handleDbExec(db: Database, payload: WorkerPayloads['db:exec']): WorkerResponses['db:exec'] {
	const stmt = db.prepare(payload.sql);
	try {
		stmt.run(...payload.params);
	} finally {
		stmt.free();
	}
	// sql.js tracks rows modified from the most recent run() call
	// We obtain the count via the underlying db.exec() call with CHANGES()
	// (CHANGES() has no bind params, so db.exec is safe here)
	const result = db.exec('SELECT changes()');
	const changes = result.length > 0 && result[0]!.values.length > 0 ? (result[0]!.values[0]![0] as number) : 0;
	return { changes };
}

// ---------------------------------------------------------------------------
// Generic Query (ViewManager surface — Phase 11)
// ---------------------------------------------------------------------------

/**
 * Handle db:query request.
 * Executes a parameterized SELECT query and returns rows as keyed objects.
 * Used by ViewManager's _fetchAndRender() with QueryBuilder-compiled SQL.
 *
 * Uses db.prepare() + step loop instead of db.exec() because the sql.js exec()
 * method has a known issue with bind params in WKWebView Worker contexts that
 * causes SQLITE_MISMATCH errors.
 *
 * @returns Object with columns array and rows as Record<string, unknown>[]
 */
export function handleDbQuery(db: Database, payload: WorkerPayloads['db:query']): WorkerResponses['db:query'] {
	const stmt = db.prepare<Record<string, unknown>>(payload.sql);
	try {
		const rows = stmt.all(...payload.params);

		if (rows.length === 0) {
			return { columns: [], rows: [] };
		}

		// Extract column names from the first row's keys
		const columns = Object.keys(rows[0]!);
		return { columns, rows };
	} finally {
		stmt.free();
	}
}
