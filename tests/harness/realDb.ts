// Isometry v6.1 — Phase 79 Test Infrastructure
// realDb(): in-memory sql.js Database factory with production schema.
//
// Design:
//   - Zero-arg async factory — WASM path resolved by SQL_WASM_PATH env (set by globalSetup)
//   - Returns bare schema with no seed data (INFR-01)
//   - Caller must call db.close() in afterEach() to release WASM heap
//
// Usage:
//   let db: Database;
//   beforeEach(async () => { db = await realDb(); });
//   afterEach(() => { db.close(); });

import { Database } from '../../src/database/Database';

/**
 * Create a fresh in-memory sql.js database with the production schema applied.
 *
 * WASM path resolution is handled automatically by Database.initialize() via the
 * SQL_WASM_PATH environment variable set by tests/setup/wasm-init.ts globalSetup.
 *
 * @returns A fully initialized Database instance with production schema, no seed data.
 */
export async function realDb(): Promise<Database> {
	const db = new Database();
	await db.initialize();
	return db;
}
