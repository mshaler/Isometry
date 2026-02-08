/**
 * sql.js Test Setup
 *
 * Configures sql.js WASM loading and provides global test database utilities
 * for the comprehensive testing infrastructure.
 */

import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';

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
      console.warn('[Test] Error closing database:', error);
    }
  }
  global.__TEST_DB_INSTANCES__.clear();
};

// WASM file loading for test environment - use real FTS5-enabled WASM
function wasmLoader() {
  return {
    locateFile: (file: string) => {
      // Use our custom FTS5-enabled WASM files
      if (file.endsWith('.wasm')) {
        return `/wasm/${file}`;
      }
      return file;
    },
  };
}

// Initialize sql.js for testing
async function initializeTestSqlJs(): Promise<SqlJsStatic> {
  if (global.__TEST_SQL__) {
    return global.__TEST_SQL__;
  }

  try {
    // Initialize sql.js with custom FTS5-enabled build
    global.__TEST_SQL__ = await initSqlJs(wasmLoader());
    console.log('[Test] sql.js initialized successfully (FTS5 enabled)');
    return global.__TEST_SQL__;
  } catch (error) {
    console.error('[Test] Failed to initialize sql.js:', error);
    throw new Error('Could not initialize sql.js for testing');
  }
}

// Mock WASM file content for test environment
// Future utility for mocking WASM modules in tests
// @ts-ignore - Future utility, currently unused
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
    console.warn('[Test] sql.js initialization deferred:', error.message);
  });
} catch (error) {
  console.warn('[Test] sql.js setup skipped:', error);
}

// Export initialization function for tests to use
export { initializeTestSqlJs };