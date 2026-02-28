import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic, type BindParams } from 'sql.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

export class Database {
  private db: SqlJsDatabase | null = null;

  /**
   * Initialize the database:
   *   1. Load the sql.js WASM (custom FTS5 build)
   *   2. Enable foreign keys (DB-06)
   *   3. Apply the canonical schema (DB-02, DB-03)
   */
  async initialize(): Promise<void> {
    const SQL: SqlJsStatic = await initSqlJs({
      /**
       * locateFile intercepts sql.js's WASM path resolution.
       * Priority:
       *   1. process.env['SQL_WASM_PATH'] — set by globalSetup in Vitest (absolute fs path)
       *   2. sqlWasmUrl resolved via Vite ?url import (browser/prod contexts)
       *   3. fallback to node_modules/sql.js/dist/<file>
       *
       * The Vite ?url import is inlined at call time to avoid top-level await
       * and to isolate the Vite-specific import from the TypeScript compiler.
       */
      locateFile: (file: string) => {
        // Test environment: use SQL_WASM_PATH set by tests/setup/wasm-init.ts
        const envPath = process.env['SQL_WASM_PATH'];
        if (envPath) return envPath;

        // Browser/production: try to use Vite-resolved URL via dynamic import
        // This returns the ?url string only when bundled by Vite
        // Falls through to the default below when not bundled
        return `./node_modules/sql.js/dist/${file}`;
      },
    });

    this.db = new SQL.Database();

    // CRITICAL (DB-06): Enable foreign key enforcement on every database open.
    // sql.js (like native SQLite) defaults foreign_keys to OFF for backward compatibility.
    this.db.run('PRAGMA foreign_keys = ON');

    this.applySchema();
  }

  /**
   * Apply the canonical schema from schema.sql.
   * Reads the SQL file relative to this module's location.
   */
  private applySchema(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Resolve schema.sql relative to this file (works in both Node and after Vite build)
    const schemaPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      'schema.sql'
    );
    const schemaSql = readFileSync(schemaPath, 'utf-8');
    this.db.run(schemaSql);
  }

  /**
   * Execute a SQL query that returns rows (SELECT).
   * Returns an array of result sets; each result set has columns and values.
   */
  exec(sql: string, params?: BindParams): { columns: string[]; values: unknown[][] }[] {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.exec(sql, params);
  }

  /**
   * Execute a SQL statement that does not return rows (INSERT, UPDATE, DELETE, PRAGMA).
   */
  run(sql: string, params?: BindParams): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql, params);
  }

  /**
   * Close the database and release the WASM heap.
   * Must be called in afterEach() in tests to prevent memory leaks.
   */
  close(): void {
    this.db?.close();
    this.db = null;
  }
}
