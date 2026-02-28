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
 */
export function handleUiGet(
  db: Database,
  payload: WorkerPayloads['ui:get']
): WorkerResponses['ui:get'] {
  const results = db.exec(
    'SELECT key, value, updated_at FROM ui_state WHERE key = ?',
    [payload.key]
  );

  if (results.length === 0 || results[0]!.values.length === 0) {
    return { key: payload.key, value: null, updated_at: null };
  }

  const row = results[0]!.values[0]!;
  return {
    key: row[0] as string,
    value: row[1] as string | null,
    updated_at: row[2] as string | null,
  };
}

/**
 * Handle ui:set request.
 * Inserts or replaces a key-value pair. Updated_at is set by the schema default.
 */
export function handleUiSet(
  db: Database,
  payload: WorkerPayloads['ui:set']
): WorkerResponses['ui:set'] {
  db.run(
    `INSERT OR REPLACE INTO ui_state (key, value, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`,
    [payload.key, payload.value]
  );
}

/**
 * Handle ui:delete request.
 * Removes the row for the given key. No-op if the key does not exist.
 */
export function handleUiDelete(
  db: Database,
  payload: WorkerPayloads['ui:delete']
): WorkerResponses['ui:delete'] {
  db.run('DELETE FROM ui_state WHERE key = ?', [payload.key]);
}

/**
 * Handle ui:getAll request.
 * Returns all key-value pairs from ui_state.
 */
export function handleUiGetAll(
  db: Database,
  _payload: WorkerPayloads['ui:getAll']
): WorkerResponses['ui:getAll'] {
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
export function handleDbExec(
  db: Database,
  payload: WorkerPayloads['db:exec']
): WorkerResponses['db:exec'] {
  db.run(payload.sql, payload.params as import('sql.js').BindParams);
  // sql.js tracks rows modified from the most recent run() call
  // We obtain the count via the underlying db.exec() call with CHANGES()
  const result = db.exec('SELECT changes()');
  const changes =
    result.length > 0 && result[0]!.values.length > 0
      ? (result[0]!.values[0]![0] as number)
      : 0;
  return { changes };
}
