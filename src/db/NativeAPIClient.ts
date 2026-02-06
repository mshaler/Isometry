/**
 * DEPRECATED: NativeAPIClient (Bridge Elimination v4)
 *
 * This file is deprecated as of Isometry v4 Bridge Elimination architecture.
 *
 * ELIMINATED COMPONENTS:
 * - MessageBridge.swift (25 KB) -> sql.js direct access
 * - BridgeExtensions.swift (13 KB) -> No bridge needed
 * - SQLite.swift integration -> sql.js WASM replaces it
 * - Promise/callback tracking -> Synchronous queries
 *
 * MIGRATION PATH:
 * - Replace NativeAPIClient with DatabaseService from './DatabaseService'
 * - Remove all bridge.* method calls
 * - Use direct db.query() and db.run() synchronous methods
 * - No more await on database operations (same memory space)
 *
 * PERFORMANCE IMPACT:
 * - 6 serialization boundaries -> 0 serialization boundaries
 * - ~40KB bridge code -> ~0KB (eliminated)
 * - Promise overhead -> Direct memory access
 *
 * See: docs/specs/v4 specs/BRIDGE-ELIMINATION-ARCHITECTURE.md
 */

export class NativeAPIClient {
  constructor() {
    throw new Error(
      'NativeAPIClient is DEPRECATED in Isometry v4. Bridge eliminated by sql.js architecture. ' +
      'Use DatabaseService for direct SQLite access in same memory space. ' +
      'Migration guide: docs/specs/v4 specs/BRIDGE-ELIMINATION-ARCHITECTURE.md'
    );
  }
}

// Legacy type definitions for backward compatibility during migration
interface QueryExecResult {
  columns: string[]
  values: unknown[][]
}

interface Statement {
  run: (params?: unknown[]) => { changes: number }
  get: (params?: unknown[]) => unknown
  all: (params?: unknown[]) => unknown[]
}

interface _Database {
  exec: (sql: string) => QueryExecResult[]
  prepare: (sql: string) => Statement
  save?: () => Promise<void>
  close?: () => void
}

/**
 * @deprecated Use useSQLite() from SQLiteProvider instead
 */
export const nativeAPI = {
  get isConnected() {
    console.warn('nativeAPI is DEPRECATED. Use SQLiteProvider with sql.js for direct database access.');
    return false;
  },
  async checkAvailability() {
    throw new Error('nativeAPI.checkAvailability is DEPRECATED. Use SQLiteProvider instead.');
  },
  async executeSQL() {
    throw new Error('nativeAPI.executeSQL is DEPRECATED. Use useSQLite().execute() instead.');
  },
  async execute() {
    throw new Error('nativeAPI.execute is DEPRECATED. Use useSQLite().execute() instead.');
  }
};