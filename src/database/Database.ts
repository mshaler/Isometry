import initSqlJs, { type BindParams, type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { endTrace, startTrace } from '../profiling/PerfTrace';

/**
 * Wrapped Statement interface for type-safe prepared statements.
 * The generic T represents the expected row type when calling all().
 */
export interface Statement<T = unknown> {
	run(...params: unknown[]): void;
	all(...params: unknown[]): T[];
	free(): void;
}

export class Database {
	private db: SqlJsDatabase | null = null;
	private _initialized = false;

	/**
	 * Initialize the database:
	 *   1. Load the sql.js WASM (custom FTS5 build)
	 *   2. Enable foreign keys (DB-06)
	 *   3. Load existing db bytes (checkpoint hydration) OR apply fresh schema
	 *
	 * @param wasmBinary - Optional pre-loaded WASM ArrayBuffer.
	 *   When provided, sql.js uses it directly instead of fetching.
	 *   Required for WKWebView native shell where Worker fetch()
	 *   doesn't route through WKURLSchemeHandler.
	 * @param dbData - Optional existing database bytes (Phase 12 checkpoint hydration).
	 *   When provided, sql.js loads the existing database instead of creating a fresh one.
	 *   Schema is NOT re-applied — the existing database already contains the schema.
	 *   On first launch (no checkpoint file), this is undefined — Worker creates empty db.
	 * @throws Error if initialize() is called while already initialized (call close() first)
	 */
	async initialize(wasmBinary?: ArrayBuffer, dbData?: ArrayBuffer): Promise<void> {
		if (this._initialized) {
			throw new Error('Database already initialized — call close() first');
		}
		const sqlOptions: Parameters<typeof initSqlJs>[0] = wasmBinary
			? { wasmBinary }
			: {
					/**
					 * locateFile intercepts sql.js's WASM path resolution.
					 * Priority:
					 *   1. process.env['SQL_WASM_PATH'] — set by globalSetup in Vitest (absolute fs path)
					 *   2. './assets/sql-wasm-fts5.wasm' — production path after viteStaticCopy
					 */
					locateFile: (_file: string) => {
						// Test environment: use SQL_WASM_PATH set by tests/setup/wasm-init.ts
						// Guard: process is undefined in browser Worker contexts (Vite dev/prod)
						const envPath = typeof process !== 'undefined' ? process.env['SQL_WASM_PATH'] : undefined;
						if (envPath) return envPath;

						// Production/dev: always return our custom FTS5 WASM path.
						// Vite pre-bundles sql.js as "sql-wasm-browser.wasm" (not "sql-wasm.wasm"),
						// so we ignore the filename and return the known path directly.
						// Absolute path ensures Workers (blob:/module URLs) resolve correctly.
						return '/assets/sql-wasm-fts5.wasm';
					},
				};

		// Stage 1: WASM initialization (sql.js compile + instantiate)
		startTrace('db:wasm:init');
		const SQL: SqlJsStatic = await initSqlJs(sqlOptions);
		endTrace('db:wasm:init');

		if (dbData) {
			// Checkpoint hydration: load existing database bytes from native shell.
			// Stage 2: DB instance creation from existing bytes
			startTrace('db:instance:create');
			// The existing database already has the schema — do NOT re-apply it.
			this.db = new SQL.Database(new Uint8Array(dbData));
			endTrace('db:instance:create');
		} else {
			// Fresh start: create empty database and apply schema.
			// Stage 2: DB instance creation (empty)
			startTrace('db:instance:create');
			this.db = new SQL.Database();
			endTrace('db:instance:create');

			// Stage 3: Schema application (PRAGMA + DDL)
			startTrace('db:schema:apply');
			// CRITICAL (DB-06): Enable foreign key enforcement on every database open.
			// sql.js (like native SQLite) defaults foreign_keys to OFF for backward compatibility.
			this.db.run('PRAGMA foreign_keys = ON');
			await this.applySchema();
			endTrace('db:schema:apply');
			this._initialized = true;
			return;
		}

		// CRITICAL (DB-06): Enable foreign key enforcement on every database open.
		// sql.js (like native SQLite) defaults foreign_keys to OFF for backward compatibility.
		// Must be applied even on hydrated databases.
		this.db.run('PRAGMA foreign_keys = ON');

		this._initialized = true;
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

		// Test environment detection: SQL_WASM_PATH is set exclusively by Vitest globalSetup.
		// In production (browser/Worker), process is undefined — use ?raw import path.
		const isTestEnv = typeof process !== 'undefined' && !!process.env['SQL_WASM_PATH'];
		if (isTestEnv) {
			// Node/test context: read schema.sql from disk
			const { readFileSync } = await import('node:fs');
			const { fileURLToPath } = await import('node:url');
			const { resolve, dirname } = await import('node:path');
			const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), 'schema.sql');
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
	 * Prepare a SQL statement for repeated execution with parameterized queries.
	 * CRITICAL: Always use prepare() with bound parameters (never string interpolation).
	 *
	 * @param sql SQL statement with placeholders (?, :name, @name, $name)
	 * @returns Wrapped Statement object with type-safe methods
	 */
	prepare<T = unknown>(sql: string): Statement<T> {
		if (!this.db) throw new Error('Database not initialized');
		const stmt = this.db.prepare(sql);

		return {
			run: (...params: unknown[]) => {
				stmt.run(params.length > 0 ? (params as BindParams) : undefined);
			},
			all: (...params: unknown[]): T[] => {
				if (params.length > 0) {
					stmt.bind(params as BindParams);
				}
				const results: T[] = [];
				while (stmt.step()) {
					results.push(stmt.getAsObject() as T);
				}
				stmt.reset();
				return results;
			},
			free: () => {
				stmt.free();
			},
		};
	}

	/**
	 * Execute a function within a transaction.
	 * Returns a wrapper function that executes fn inside BEGIN/COMMIT.
	 *
	 * Usage:
	 *   const insertBatch = db.transaction(() => {
	 *     for (const item of items) {
	 *       stmt.run(item);
	 *     }
	 *   });
	 *   insertBatch(); // Executes inside transaction
	 *
	 * @param fn Function to execute inside transaction
	 * @returns Wrapper function that executes fn inside transaction
	 */
	transaction<T>(fn: () => T): () => T {
		if (!this.db) throw new Error('Database not initialized');
		return () => {
			this.run('BEGIN');
			try {
				const result = fn();
				this.run('COMMIT');
				return result;
			} catch (err) {
				this.run('ROLLBACK');
				throw err;
			}
		};
	}

	/**
	 * Export the database as a binary Uint8Array.
	 * Used by WorkerBridge for native shell persistence.
	 *
	 * @returns SQLite database file as Uint8Array
	 */
	export(): Uint8Array {
		if (!this.db) throw new Error('Database not initialized');
		return this.db.export();
	}

	/**
	 * Close the database and release the WASM heap.
	 * Must be called in afterEach() in tests to prevent memory leaks.
	 */
	close(): void {
		this.db?.close();
		this.db = null;
		this._initialized = false;
	}
}

// Re-export sql.js types for use in ETL module
export type { BindParams } from 'sql.js';
