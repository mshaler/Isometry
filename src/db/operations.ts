/**
 * Database operations for SQLiteProvider
 */

import type { Database, BindParams } from 'sql.js';
import { devLogger } from '../utils/dev-logger';

export interface DatabaseOperations {
  execute: (sql: string, params?: unknown[]) => Record<string, unknown>[];
  run: (sql: string, params?: unknown[]) => void;
}

/**
 * React state setter type for dataVersion
 * Accepts either a direct number or a functional update
 */
type DataVersionSetter = React.Dispatch<React.SetStateAction<number>>;

/**
 * Create database operation functions
 *
 * SYNC-01: These operations support live data synchronization.
 * When run() modifies data, it increments dataVersion which triggers
 * useSQLiteQuery refetches across all components using the hook.
 */
export function createDatabaseOperations(
  db: Database | null,
  setDataVersion: DataVersionSetter
): DatabaseOperations {

  // Synchronous execute function - core CLAUDE.md requirement
  // NOTE: Logging removed to prevent console flooding. Use browser DevTools for SQL debugging.
  const execute = (sql: string, params: unknown[] = []): Record<string, unknown>[] => {
    if (!db) {
      throw new Error('Database not initialized');
    }

    // MEMORY GUARD: Prevent unbounded result sets from causing OOM
    const MAX_ROWS = 50000; // ~25MB at 500 bytes/row
    let rowCount = 0;

    try {
      const stmt = db.prepare(sql);

      // Bind parameters before stepping through results (prevents SQL injection)
      if (params.length > 0) {
        stmt.bind(params as BindParams);
      }

      const results: Record<string, unknown>[] = [];

      while (stmt.step()) {
        rowCount++;

        // OOM prevention: stop if we hit the row limit
        if (rowCount > MAX_ROWS) {
          stmt.free();
          console.error(`[SQLiteProvider.execute()] OOM prevention: Query returned >${MAX_ROWS} rows. Add LIMIT to your query.`);
          console.error('[SQLiteProvider.execute()] Truncated SQL:', sql.slice(0, 200));
          // Return what we have instead of throwing
          return results;
        }

        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row: Record<string, unknown> = {};

        columns.forEach((col, index) => {
          row[col] = values[index];
        });
        results.push(row);
      }

      stmt.free();
      return results;
    } catch (error) {
      // Check if this is an OOM-related error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('memory') || errorMessage.includes('allocation') || errorMessage.includes('heap')) {
        console.error('[SQLiteProvider.execute()] MEMORY ERROR:', {
          error: errorMessage,
          rowsProcessed: rowCount,
          sqlPreview: sql.slice(0, 200),
        });
      }
      devLogger.error('SQLiteProvider.execute() failed', error);
      throw error;
    }
  };

  // Synchronous run function for INSERT/UPDATE/DELETE
  // NOTE: Logging removed to prevent console flooding. Use browser DevTools for SQL debugging.
  const run = (sql: string, params: unknown[] = []): void => {
    if (!db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = db.prepare(sql);
      stmt.run(params as BindParams);
      stmt.free();

      // Increment data version for query invalidation
      setDataVersion(prev => prev + 1);
    } catch (error) {
      devLogger.error('SQLiteProvider.run() failed', error);
      throw error;
    }
  };

  return { execute, run };
}