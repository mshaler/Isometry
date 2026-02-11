/**
 * sql.js Test Setup
 *
 * Configures sql.js WASM loading and provides global test database utilities
 * for the comprehensive testing infrastructure.
 */

import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { devLogger } from '../utils/logging';

// Global sql.js instance and utilities for tests
declare global {
  var __TEST_SQL__: SqlJsStatic | null;
  var __TEST_DB_INSTANCES__: Set<Database>;
  var __CLEANUP_TEST_DBS__: () => void;
}

// Initialize global test database tracking
global.__TEST_DB_INSTANCES__ = new Set();

// Global cleanup function
global.__CLEANUP_TEST_DBS__ = () => {
  for (const db of global.__TEST_DB_INSTANCES__) {
    try {
      db.close();
    } catch (error) {
      devLogger.warn('Test database close error', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  global.__TEST_DB_INSTANCES__.clear();
};

// WASM file loading for test environment - use real FTS5-enabled WASM
function wasmLoader() {
  // Load WASM binary directly for Node.js/Vitest environment
  const wasmPath = join(process.cwd(), 'public/wasm/sql-wasm.wasm');
  try {
    const wasmBinary = readFileSync(wasmPath);
    return { wasmBinary };
  } catch {
    // Fallback to locateFile if direct read fails
    return {
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) {
          return join(process.cwd(), 'public/wasm', file);
        }
        return file;
      },
    };
  }
}

// Initialize sql.js for testing
async function initializeTestSqlJs(): Promise<SqlJsStatic> {
  if (global.__TEST_SQL__) {
    return global.__TEST_SQL__;
  }

  try {
    // Initialize sql.js with custom FTS5-enabled build
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.__TEST_SQL__ = await initSqlJs(wasmLoader() as any);
    devLogger.info('sql.js initialized for testing', {
      fts5Enabled: true
    });
    return global.__TEST_SQL__;
  } catch (error) {
    devLogger.error('Failed to initialize sql.js for testing', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error('Could not initialize sql.js for testing');
  }
}

// Mock WASM file content for test environment
// Future utility for mocking WASM modules in tests
// @ts-expect-error - Future utility, currently unused
function createMockWasmModule() {
  // Create a minimal mock that satisfies sql.js initialization
  const mockWasm = new Uint8Array([
    0x00, 0x61, 0x73, 0x6D, // WASM magic number
    0x01, 0x00, 0x00, 0x00, // WASM version
  ]);

  // Mock the WASM module interface
  return {
    buffer: mockWasm.buffer,
    HEAPU8: mockWasm,
    _malloc: () => 1024,
    _free: () => {},
    _sqlite3_open: () => 0,
    _sqlite3_close: () => 0,
    _sqlite3_exec: () => 0,
    _sqlite3_prepare_v2: () => 0,
    _sqlite3_step: () => 0,
    _sqlite3_finalize: () => 0,
    // Mock FTS5 functions
    _fts5_init: () => 0,
    _fts5_create: () => 0,
    // Add more as needed
  };
}

// Note: Using real WASM files instead of mocked ones for FTS5 testing
// Mock fetch would prevent loading our custom FTS5-enabled WASM
// const originalFetch = global.fetch; // Keep original fetch available

// Initialize sql.js on module load
try {
  // Don't await here - let individual tests handle initialization
  initializeTestSqlJs().catch(error => {
    devLogger.warn('sql.js initialization deferred', {
      reason: error.message
    });
  });
} catch (error) {
  devLogger.warn('sql.js setup skipped', {
    error: error instanceof Error ? error.message : String(error)
  });
}

// Export initialization function for tests to use
export { initializeTestSqlJs };