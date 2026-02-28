import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic, type BindParams } from 'sql.js';

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
       *   2. './assets/sql-wasm-fts5.wasm' — production path after viteStaticCopy
       *
       * In Vite production builds, sql.js is excluded from optimizeDeps (not bundled
       * by esbuild). viteStaticCopy copies src/assets/sql-wasm-fts5.wasm to
       * dist/assets/sql-wasm-fts5.wasm. locateFile must return a path that resolves
       * relative to where sql.js itself is served.
       */
      locateFile: (file: string) => {
        // Test environment: use SQL_WASM_PATH set by tests/setup/wasm-init.ts
        const envPath = process.env['SQL_WASM_PATH'];
        if (envPath) return envPath;

        // Production: WASM is in assets/ alongside the JS bundle.
        // Replace the default sql.js WASM name with our custom FTS5 build name.
        return `./assets/${file.replace('sql-wasm.wasm', 'sql-wasm-fts5.wasm')}`;
      },
    });

    this.db = new SQL.Database();

    // CRITICAL (DB-06): Enable foreign key enforcement on every database open.
    // sql.js (like native SQLite) defaults foreign_keys to OFF for backward compatibility.
    this.db.run('PRAGMA foreign_keys = ON');

    await this.applySchema();
  }

  /**
   * Apply the canonical schema from schema.sql.
   *
   * In Vitest (Node environment): reads schema.sql from disk using fs/path/url.
   * In Vite production builds: Node built-ins are externalized; schema.sql is
   * loaded via dynamic import (works in Worker context where fs is available via
   * the native shell, or via Vite's ?raw inlining at build time).
   *
   * Note: readFileSync/resolve/fileURLToPath are externalized from the browser build
   * via rollupOptions.external. They are only called when SQL_WASM_PATH is set
   * (i.e., in the Vitest Node environment).
   */
  private async applySchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    let schemaSql: string;

    // Detect Node/test context: SQL_WASM_PATH is set exclusively by wasm-init.ts globalSetup.
    // In production (browser/Worker), this env var is not set.
    if (process.env['SQL_WASM_PATH']) {
      // Node/test context: read schema.sql from disk
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { resolve, dirname } = await import('node:path');
      const schemaPath = resolve(
        dirname(fileURLToPath(import.meta.url)),
        'schema.sql'
      );
      schemaSql = readFileSync(schemaPath, 'utf-8');
    } else {
      // Production/browser context: schema is inlined via Vite ?raw import.
      // Dynamic import allows tree-shaking the ?raw module in non-Vite contexts.
      const schemaModule = await import('./schema.sql?raw');
      schemaSql = schemaModule.default as string;
    }

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
