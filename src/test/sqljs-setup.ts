/**
 * sql.js Test Setup
 *
 * Configures sql.js WASM loading and provides global test database utilities
 * for the comprehensive testing infrastructure.
 */

import initSqlJs from 'sql.js-fts5';
import type { Database, SqlJsStatic } from 'sql.js-fts5';

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

// Mock WASM file loading for test environment
function mockWasmLoader() {
  return {
    locateFile: (file: string) => {
      // In test environment, provide a mock path
      if (file.endsWith('.wasm')) {
        // Return a path that won't be used in mocked environment
        return `/test-wasm/${file}`;
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
    // Try to initialize with FTS5 support
    global.__TEST_SQL__ = await initSqlJs(mockWasmLoader());
    console.log('[Test] sql.js-fts5 initialized successfully');
    return global.__TEST_SQL__;
  } catch (error) {
    console.warn('[Test] Failed to initialize sql.js-fts5:', error);

    // Fallback to standard sql.js for basic functionality
    try {
      const standardSqlJs = await import('sql.js');
      global.__TEST_SQL__ = await standardSqlJs.default(mockWasmLoader());
      console.log('[Test] Fallback to standard sql.js');
      return global.__TEST_SQL__;
    } catch (fallbackError) {
      console.error('[Test] Failed to initialize any sql.js variant:', fallbackError);
      throw new Error('Could not initialize sql.js for testing');
    }
  }
}

// Mock WASM file content for test environment
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

// Mock fetch for WASM loading in test environment
const originalFetch = global.fetch;
global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();

  if (url.endsWith('.wasm') || url.includes('wasm')) {
    // Return mock WASM content for sql.js
    const mockWasmBuffer = createMockWasmModule().buffer;
    return new Response(mockWasmBuffer, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/wasm',
        'Content-Length': mockWasmBuffer.byteLength.toString(),
      },
    });
  }

  // Use original fetch for other requests
  if (originalFetch) {
    return originalFetch(input, init);
  }

  throw new Error(`Fetch not available for: ${url}`);
};

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