// Isometry v5 — Phase 3 Export Handler
// Exports the database as a binary blob for native shell persistence.

import type { Database } from '../../database/Database';
import type { WorkerResponses } from '../protocol';

/**
 * Handle db:export request.
 * Returns the SQLite database as a Uint8Array.
 * Used by native shell for file system persistence.
 */
export function handleDbExport(
  db: Database
): WorkerResponses['db:export'] {
  return db.export();
}
