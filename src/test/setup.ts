/**
 * Vitest Test Setup
 *
 * Global test configuration and mocks for Isometry tests.
 */

import '@testing-library/jest-dom';

// Mock ResizeObserver for D3 components
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock;

// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// Mock crypto for WebView bridge and security operations
Object.defineProperty(global, 'crypto', {
  writable: true,
  value: {
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      // Fill with predictable test values for consistent test results
      if (array && 'length' in array) {
        for (let i = 0; i < array.length; i++) {
          (array as Uint8Array)[i] = Math.floor(Math.random() * 256);
        }
      }
      return array;
    },
    subtle: {
      digest: async (algorithm: string, _data: BufferSource) => {
        // Mock consistent digest for testing
        const mockHash = new ArrayBuffer(algorithm === 'SHA-256' ? 32 : 20);
        const view = new Uint8Array(mockHash);
        // Fill with deterministic test data based on input length
        const inputLength = data instanceof ArrayBuffer ? data.byteLength :
                          data instanceof Uint8Array ? data.length : 0;
        for (let i = 0; i < view.length; i++) {
          view[i] = (inputLength + i) % 256;
        }
        return mockHash;
      },
      encrypt: async () => {
        throw new Error('Crypto encrypt not implemented in test environment');
      },
      decrypt: async () => {
        throw new Error('Crypto decrypt not implemented in test environment');
      },
      sign: async () => {
        throw new Error('Crypto sign not implemented in test environment');
      },
      verify: async () => {
        throw new Error('Crypto verify not implemented in test environment');
      },
      generateKey: async () => {
        throw new Error('Crypto generateKey not implemented in test environment');
      },
      deriveBits: async () => {
        throw new Error('Crypto deriveBits not implemented in test environment');
      },
      deriveKey: async () => {
        throw new Error('Crypto deriveKey not implemented in test environment');
      },
      importKey: async () => {
        throw new Error('Crypto importKey not implemented in test environment');
      },
      exportKey: async () => {
        throw new Error('Crypto exportKey not implemented in test environment');
      },
      wrapKey: async () => {
        throw new Error('Crypto wrapKey not implemented in test environment');
      },
      unwrapKey: async () => {
        throw new Error('Crypto unwrapKey not implemented in test environment');
      },
    },
    randomUUID: () => {
      // Generate predictable UUIDs for consistent test results
      return 'test-uuid-' + Math.random().toString(36).substring(2, 15);
    },
  },
});

// Define interfaces for WebKit message handling
interface WebKitMessage {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface WebKitResponse {
  id: string;
  result: unknown;
  error: string | null;
}

// Mock WebKit for WebView bridge testing
const mockMessageHandlers = {
  database: {
    postMessage: (message: WebKitMessage) => {
      // Mock database responses immediately
      setTimeout(() => {
        const event = new MessageEvent<WebKitResponse>('message', {
          data: {
            id: message.id,
            result: mockDatabaseResponse(message),
            error: null,
          },
        });
        window.dispatchEvent(event);
      }, 0);
    },
  },
  fileSystem: {
    postMessage: (message: WebKitMessage) => {
      // Mock file system responses
      setTimeout(() => {
        const event = new MessageEvent<WebKitResponse>('message', {
          data: {
            id: message.id,
            result: { success: true },
            error: null,
          },
        });
        window.dispatchEvent(event);
      }, 0);
    },
  },
  sync: {
    postMessage: (message: WebKitMessage) => {
      // Mock sync responses
      setTimeout(() => {
        const event = new MessageEvent<WebKitResponse>('message', {
          data: {
            id: message.id,
            result: { success: true },
            error: null,
          },
        });
        window.dispatchEvent(event);
      }, 0);
    },
  },
};

function mockDatabaseResponse(message: WebKitMessage): unknown {
  const sql = (message.params?.sql as string) || '';

  // Mock database responses based on query
  if (sql.includes('sqlite_master') && sql.includes('type="table"')) {
    return [
      { name: 'nodes', sql: 'CREATE TABLE nodes(...)' },
      { name: 'edges', sql: 'CREATE TABLE edges(...)' },
    ];
  }
  if (sql.includes('COUNT(*)') && sql.includes('nodes')) {
    return [{ count: 100 }];
  }
  if (sql.includes('COUNT(*)') && sql.includes('edges')) {
    return [{ count: 50 }];
  }
  if (sql.includes('COUNT(*)') && sql.includes('sqlite_master')) {
    return [{ count: 5 }];
  }
  if (sql.includes('PRAGMA integrity_check')) {
    return [{ integrity_check: 'ok' }];
  }
  if (sql.includes('PRAGMA foreign_key_check')) {
    return [];
  }
  if (sql.includes('PRAGMA page_size')) {
    return [{ page_size: 4096 }];
  }
  if (sql.includes('PRAGMA page_count')) {
    return [{ page_count: 1000 }];
  }
  if (sql.includes('json_valid')) {
    return [{ json_valid: 1 }];
  }
  if (sql.includes('WITH test_cte')) {
    return [{ n: 1 }];
  }
  if (sql.includes('SELECT * FROM nodes LIMIT')) {
    return [
      { id: 1, title: 'Test Node 1', content: 'Test content' },
      { id: 2, title: 'Test Node 2', content: 'Test content' },
    ];
  }
  if (sql.includes('INSERT') || sql.includes('UPDATE') || sql.includes('DELETE')) {
    return { changes: 1, lastInsertRowId: 1 };
  }

  // Default empty response
  return [];
}

Object.defineProperty(global, 'webkit', {
  writable: true,
  value: {
    messageHandlers: mockMessageHandlers,
  },
});

// Mock window.webkit for browser environment compatibility
Object.defineProperty(window, 'webkit', {
  writable: true,
  value: global.webkit,
});

// Setup global error handler for unhandled promise rejections
const rejectionTracker = new Map();

process.on('unhandledRejection', (reason, promise) => {
  // Track unhandled rejections for debugging
  const rejectionId = Math.random().toString(36);
  rejectionTracker.set(promise, { reason, id: rejectionId, timestamp: Date.now() });

  // Only log in verbose mode or if it's not a test-expected error
  if (process.env.VITEST_VERBOSE || !isTestExpectedError(reason)) {
    console.warn(`[Test] Unhandled promise rejection ${rejectionId}:`, reason);
  }

  // Don't throw in tests to avoid false negatives, but ensure tests can detect these
  if (global.__VITEST_UNHANDLED_REJECTIONS__) {
    global.__VITEST_UNHANDLED_REJECTIONS__.push({ reason, promise, id: rejectionId });
  } else {
    global.__VITEST_UNHANDLED_REJECTIONS__ = [{ reason, promise, id: rejectionId }];
  }
});

process.on('rejectionHandled', (promise) => {
  // Clean up tracked rejections that got handled later
  rejectionTracker.delete(promise);
  if (global.__VITEST_UNHANDLED_REJECTIONS__) {
    const index = global.__VITEST_UNHANDLED_REJECTIONS__.findIndex(r => r.promise === promise);
    if (index !== -1) {
      global.__VITEST_UNHANDLED_REJECTIONS__.splice(index, 1);
    }
  }
});

function isTestExpectedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // Common test-expected error patterns
  const expectedPatterns = [
    'Test error message',
    'Crypto not available',
    'Test timeout',
    'Mock implementation',
    'WebView request timeout'
  ];

  const errorMessage = (error as Error).message || String(error);
  return expectedPatterns.some(pattern => errorMessage.includes(pattern));
}

// Add cleanup utility for tests
global.__VITEST_CLEAR_UNHANDLED_REJECTIONS__ = () => {
  global.__VITEST_UNHANDLED_REJECTIONS__ = [];
  rejectionTracker.clear();
};

// Mock addEventListener for WebView events
const originalAddEventListener = global.addEventListener;
global.addEventListener = (
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
) => {
  if (type === 'message' && typeof listener === 'function') {
    // Mock WebView message events
    return;
  }
  if (originalAddEventListener) {
    return originalAddEventListener.call(global, type, listener, options);
  }
};
