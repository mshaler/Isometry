/**
 * Database operations for SQLiteProvider
 */

import type { Database } from 'sql.js';
import { devLogger } from '../utils/dev-logger';

export interface DatabaseOperations {
  execute: (sql: string, params?: unknown[]) => Record<string, unknown>[];
  run: (sql: string, params?: unknown[]) => void;
}

/**
 * Create database operation functions
 */
export function createDatabaseOperations(
  db: Database | null,
  setDataVersion: (version: number) => void
): DatabaseOperations {

  // Synchronous execute function - core CLAUDE.md requirement
  const execute = (sql: string, params: unknown[] = []): Record<string, unknown>[] => {
    if (!db) {
      throw new Error('Database not initialized');
    }

    try {
      devLogger.data('SQLiteProvider.execute()', { sql, paramCount: params.length });

      const stmt = db.prepare(sql);
      const results: Record<string, unknown>[] = [];

      while (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row: Record<string, unknown> = {};

        columns.forEach((col, index) => {
          row[col] = values[index];
        });
        results.push(row);
      }

      stmt.free();

      devLogger.data('SQLiteProvider.execute() completed', {
        sql: sql.substring(0, 50) + (sql.length > 50 ? '...' : ''),
        resultCount: results.length
      });

      return results;
    } catch (error) {
      devLogger.error('SQLiteProvider.execute() failed', error);
      throw error;
    }
  };

  // Synchronous run function for INSERT/UPDATE/DELETE
  const run = (sql: string, params: unknown[] = []): void => {
    if (!db) {
      throw new Error('Database not initialized');
    }

    try {
      devLogger.data('SQLiteProvider.run()', { sql, paramCount: params.length });

      const stmt = db.prepare(sql);
      stmt.run(params);
      stmt.free();

      // Increment data version for query invalidation
      setDataVersion(prev => prev + 1);

      devLogger.data('SQLiteProvider.run() completed', {
        sql: sql.substring(0, 50) + (sql.length > 50 ? '...' : ''),
        changes: db.getRowsModified()
      });
    } catch (error) {
      devLogger.error('SQLiteProvider.run() failed', error);
      throw error;
    }
  };

  return { execute, run };
}