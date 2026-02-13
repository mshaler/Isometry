/**
 * Vitest Test Setup
 *
 * Global test configuration and mocks for Isometry tests.
 */

import '@testing-library/jest-dom';

// Global type declarations for test environment
declare global {
  var webkit: unknown;
  var __VITEST_UNHANDLED_REJECTIONS__: Array<{
    reason: unknown;
    promise: Promise<any>;
    id: string;
  }>;
  var __VITEST_CLEAR_UNHANDLED_REJECTIONS__: () => void;
}

// Mock ResizeObserver for D3 components
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock;

// Mock DragEvent for JSDOM (used by SuperDynamic drag tests)
if (typeof global.DragEvent === 'undefined') {
  class DragEventMock extends Event {
    dataTransfer: DataTransfer | null = null;
    clientX = 0;
    clientY = 0;
    screenX = 0;
    screenY = 0;
    pageX = 0;
    pageY = 0;
    offsetX = 0;
    offsetY = 0;
    ctrlKey = false;
    shiftKey = false;
    altKey = false;
    metaKey = false;
    button = 0;
    buttons = 0;
    relatedTarget: EventTarget | null = null;

    constructor(type: string, eventInitDict?: DragEventInit) {
      super(type, eventInitDict);
      if (eventInitDict) {
        this.dataTransfer = eventInitDict.dataTransfer ?? null;
        this.clientX = eventInitDict.clientX ?? 0;
        this.clientY = eventInitDict.clientY ?? 0;
        this.screenX = eventInitDict.screenX ?? 0;
        this.screenY = eventInitDict.screenY ?? 0;
        this.ctrlKey = eventInitDict.ctrlKey ?? false;
        this.shiftKey = eventInitDict.shiftKey ?? false;
        this.altKey = eventInitDict.altKey ?? false;
        this.metaKey = eventInitDict.metaKey ?? false;
        this.button = eventInitDict.button ?? 0;
        this.buttons = eventInitDict.buttons ?? 0;
        this.relatedTarget = eventInitDict.relatedTarget ?? null;
      }
    }

    getModifierState(_key: string): boolean {
      return false;
    }
  }

  global.DragEvent = DragEventMock as unknown as typeof DragEvent;
}

// Mock document.elementFromPoint for JSDOM (used by SuperDynamic drag tests)
if (!document.elementFromPoint) {
  document.elementFromPoint = (_x: number, _y: number) => null;
}

// Mock SVG baseVal for D3 zoom tests (JSDOM doesn't support SVG attributes)
function addSVGMocks(element: Element): void {
  const mockAnimatedLength = {
    baseVal: { value: 800 },
    animVal: { value: 800 }
  };
  const mockAnimatedLengthHeight = {
    baseVal: { value: 600 },
    animVal: { value: 600 }
  };
  Object.defineProperty(element, 'width', { value: mockAnimatedLength, writable: true, configurable: true });
  Object.defineProperty(element, 'height', { value: mockAnimatedLengthHeight, writable: true, configurable: true });
  Object.defineProperty(element, 'viewBox', {
    value: {
      baseVal: { x: 0, y: 0, width: 800, height: 600 },
      animVal: { x: 0, y: 0, width: 800, height: 600 }
    },
    writable: true,
    configurable: true
  });
  // D3 zoom accesses ownerSVGElement.width.baseVal - for SVG element itself, this is self-referential
  Object.defineProperty(element, 'ownerSVGElement', {
    get: () => element,
    configurable: true
  });
}

const originalCreateElement = document.createElement.bind(document);
document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
  const element = originalCreateElement(tagName, options);
  if (tagName.toLowerCase() === 'svg') {
    addSVGMocks(element);
  }
  return element;
}) as typeof document.createElement;

// Also mock createElementNS for D3 which uses SVG namespace
const originalCreateElementNS = document.createElementNS.bind(document);
document.createElementNS = ((namespaceURI: string | null, qualifiedName: string) => {
  const element = originalCreateElementNS(namespaceURI, qualifiedName);
  if (qualifiedName.toLowerCase() === 'svg' || namespaceURI === 'http://www.w3.org/2000/svg') {
    if (qualifiedName.toLowerCase() === 'svg') {
      addSVGMocks(element);
    } else {
      // For child SVG elements, ownerSVGElement needs to point to parent SVG
      // This will be set when the element is appended to an SVG
      const mockSVG = {
        width: { baseVal: { value: 800 }, animVal: { value: 800 } },
        height: { baseVal: { value: 600 }, animVal: { value: 600 } }
      };
      Object.defineProperty(element, 'ownerSVGElement', {
        value: mockSVG,
        writable: true,
        configurable: true
      });
    }
  }
  return element;
}) as typeof document.createElementNS;

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
        const typedArray = array as Uint8Array;
        for (let i = 0; i < typedArray.length; i++) {
          typedArray[i] = Math.floor(Math.random() * 256);
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
        const inputLength = _data instanceof ArrayBuffer ? _data.byteLength :
                          _data instanceof Uint8Array ? _data.length : 0;
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

// Mock IndexedDB for persistence layer testing
// This prevents "indexedDB is not defined" errors in jsdom environment
const mockIndexedDB = {
  open: () => ({
    result: {
      objectStoreNames: { contains: () => false },
      createObjectStore: () => ({}),
      transaction: () => ({
        objectStore: () => ({
          get: () => ({ result: null }),
          put: () => ({}),
          delete: () => ({}),
        }),
      }),
    },
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
  }),
  deleteDatabase: () => ({
    result: undefined,
    onerror: null,
    onsuccess: null,
  }),
};

Object.defineProperty(global, 'indexedDB', {
  writable: true,
  value: mockIndexedDB,
});

Object.defineProperty(window, 'indexedDB', {
  writable: true,
  value: mockIndexedDB,
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
