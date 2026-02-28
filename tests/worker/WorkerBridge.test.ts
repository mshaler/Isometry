// Isometry v5 — Phase 3 WorkerBridge Tests
// Unit tests for the main-thread WorkerBridge client.
//
// These tests mock the Worker to test WorkerBridge logic in isolation.
// Full integration tests with a real worker are in integration.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createReadyMessage,
  createInitErrorMessage,
  createSuccessResponse,
  createErrorResponse,
  createSampleCard,
  createMockWorker,
  wait,
} from './fixtures';
import type { WorkerRequest, WorkerResponse, Card } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Mock Worker for Testing
// ---------------------------------------------------------------------------

// We need to mock the Worker constructor since WorkerBridge creates a Worker
// using `new URL('./worker.ts', import.meta.url)` which won't work in Node

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  
  private messageHandler: ((data: WorkerRequest) => void) | null = null;

  constructor() {
    // Auto-send ready message after a tick
    setTimeout(() => {
      this.simulateMessage(createReadyMessage());
    }, 0);
  }

  postMessage(data: WorkerRequest): void {
    if (this.messageHandler) {
      this.messageHandler(data);
    }
  }

  terminate(): void {
    this.onmessage = null;
    this.onerror = null;
    this.messageHandler = null;
  }

  // Test helpers
  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  simulateError(message: string): void {
    if (this.onerror) {
      this.onerror(new ErrorEvent('error', { message }));
    }
  }

  setMessageHandler(handler: (data: WorkerRequest) => void): void {
    this.messageHandler = handler;
  }
}

// Mock the Worker constructor globally
vi.stubGlobal('Worker', MockWorker);

// Now import WorkerBridge (after mocking Worker)
// Using dynamic import to ensure mock is in place
const getWorkerBridgeModule = async () => {
  // Clear module cache to ensure fresh import with mock
  vi.resetModules();
  return import('../../src/worker/WorkerBridge');
};

describe('WorkerBridge', () => {
  let WorkerBridge: typeof import('../../src/worker/WorkerBridge').WorkerBridge;
  let createWorkerBridge: typeof import('../../src/worker/WorkerBridge').createWorkerBridge;

  beforeEach(async () => {
    const module = await getWorkerBridgeModule();
    WorkerBridge = module.WorkerBridge;
    createWorkerBridge = module.createWorkerBridge;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create a WorkerBridge instance', () => {
      const bridge = createWorkerBridge();
      expect(bridge).toBeInstanceOf(WorkerBridge);
      bridge.terminate();
    });

    it('should expose isReady promise', () => {
      const bridge = createWorkerBridge();
      expect(bridge.isReady).toBeInstanceOf(Promise);
      bridge.terminate();
    });

    it('should resolve isReady when worker signals ready', async () => {
      const bridge = createWorkerBridge();
      await expect(bridge.isReady).resolves.toBeUndefined();
      bridge.terminate();
    });

    it('should accept custom timeout config', () => {
      const bridge = createWorkerBridge({ timeout: 5000 });
      expect(bridge).toBeInstanceOf(WorkerBridge);
      bridge.terminate();
    });

    it('should accept debug config', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const bridge = createWorkerBridge({ debug: true });
      // Debug logging happens on ready
      bridge.terminate();
      consoleSpy.mockRestore();
    });
  });

  describe('Request/Response Correlation', () => {
    it('should generate unique correlation IDs', async () => {
      const bridge = createWorkerBridge();
      await bridge.isReady;

      const ids = new Set<string>();
      const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;

      // Capture request IDs
      mockWorker.setMessageHandler((request) => {
        ids.add(request.id);
        // Respond immediately
        mockWorker.simulateMessage(
          createSuccessResponse<'card:list'>(request.id, [])
        );
      });

      // Send multiple requests
      await Promise.all([
        bridge.listCards(),
        bridge.listCards(),
        bridge.listCards(),
      ]);

      expect(ids.size).toBe(3);
      bridge.terminate();
    });

    it('should match responses to correct pending requests', async () => {
      const bridge = createWorkerBridge();
      await bridge.isReady;

      const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;
      const responses: Card[] = [];

      // Respond with card containing the request ID in name
      mockWorker.setMessageHandler((request) => {
        const card = createSampleCard({ name: `Card for ${request.id}` });
        setTimeout(() => {
          mockWorker.simulateMessage(
            createSuccessResponse<'card:create'>(request.id, card)
          );
        }, Math.random() * 10); // Random delay to test ordering
      });

      // Send concurrent requests
      const promises = [
        bridge.createCard({ name: 'Card 1' }),
        bridge.createCard({ name: 'Card 2' }),
        bridge.createCard({ name: 'Card 3' }),
      ];

      const results = await Promise.all(promises);

      // Each result should be unique
      const names = results.map((r) => r.name);
      expect(new Set(names).size).toBe(3);

      bridge.terminate();
    });
  });

  describe('Error Handling', () => {
    it('should reject on worker error response', async () => {
      const bridge = createWorkerBridge();
      await bridge.isReady;

      const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;

      mockWorker.setMessageHandler((request) => {
        mockWorker.simulateMessage(
          createErrorResponse(request.id, {
            code: 'NOT_FOUND',
            message: 'Card not found',
          })
        );
      });

      await expect(bridge.getCard('non-existent')).rejects.toThrow('Card not found');

      bridge.terminate();
    });

    it('should include error code on rejected errors', async () => {
      const bridge = createWorkerBridge();
      await bridge.isReady;

      const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;

      mockWorker.setMessageHandler((request) => {
        mockWorker.simulateMessage(
          createErrorResponse(request.id, {
            code: 'CONSTRAINT_VIOLATION',
            message: 'FK constraint failed',
          })
        );
      });

      try {
        await bridge.createConnection({
          source_id: 'fake',
          target_id: 'fake',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error & { code: string }).code).toBe('CONSTRAINT_VIOLATION');
      }

      bridge.terminate();
    });

    it('should reject isReady on init error', async () => {
      // Create a custom mock that sends init error instead of ready
      const FailingWorker = class {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: ErrorEvent) => void) | null = null;

        constructor() {
          // Send init error only — no ready message
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage(new MessageEvent('message', {
                data: createInitErrorMessage({
                  code: 'NOT_INITIALIZED',
                  message: 'WASM failed to load',
                }),
              }));
            }
          }, 0);
        }

        postMessage(): void { /* no-op */ }
        terminate(): void { this.onmessage = null; }
      };

      vi.stubGlobal('Worker', FailingWorker);
      const module = await getWorkerBridgeModule();

      const bridge = new module.WorkerBridge();

      await expect(bridge.isReady).rejects.toThrow('WASM failed to load');

      bridge.terminate();

      // Restore normal mock
      vi.stubGlobal('Worker', MockWorker);
    });
  });

  describe('Timeout Handling', () => {
    it('should reject after timeout', async () => {
      const bridge = createWorkerBridge({ timeout: 50 }); // 50ms timeout
      await bridge.isReady;

      const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;

      // Don't respond to requests
      mockWorker.setMessageHandler(() => {
        // Intentionally do nothing - simulate hung worker
      });

      await expect(bridge.listCards()).rejects.toThrow(/timed out/);

      bridge.terminate();
    });

    it('should include TIMEOUT code on timeout errors', async () => {
      const bridge = createWorkerBridge({ timeout: 50 });
      await bridge.isReady;

      const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;
      mockWorker.setMessageHandler(() => {});

      try {
        await bridge.listCards();
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error & { code: string }).code).toBe('TIMEOUT');
      }

      bridge.terminate();
    });

    it('should not reject late responses after timeout', async () => {
      const bridge = createWorkerBridge({ timeout: 50 });
      await bridge.isReady;

      const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;
      let capturedId: string | null = null;

      mockWorker.setMessageHandler((request) => {
        capturedId = request.id;
        // Respond after timeout
        setTimeout(() => {
          mockWorker.simulateMessage(
            createSuccessResponse<'card:list'>(request.id, [])
          );
        }, 100);
      });

      // This should timeout
      await expect(bridge.listCards()).rejects.toThrow(/timed out/);

      // Wait for late response
      await wait(60);

      // Bridge should still be functional
      mockWorker.setMessageHandler((request) => {
        mockWorker.simulateMessage(
          createSuccessResponse<'card:list'>(request.id, [])
        );
      });

      // This should work
      const result = await bridge.listCards();
      expect(result).toEqual([]);

      bridge.terminate();
    });
  });

  describe('Lifecycle', () => {
    it('should terminate worker on terminate()', async () => {
      const bridge = createWorkerBridge();
      await bridge.isReady;

      const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;
      const terminateSpy = vi.spyOn(mockWorker, 'terminate');

      bridge.terminate();

      expect(terminateSpy).toHaveBeenCalled();
    });

    it('should reject pending requests on terminate()', async () => {
      const bridge = createWorkerBridge();
      await bridge.isReady;

      const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;
      mockWorker.setMessageHandler(() => {
        // Don't respond — simulate hung worker
      });

      // Start a request (it will await isReady which already resolved)
      const promise = bridge.listCards();

      // Let the send() microtask run so the request enters pending map
      await new Promise((r) => setTimeout(r, 10));

      // Now terminate — should reject the pending request
      bridge.terminate();

      await expect(promise).rejects.toThrow('terminated');
    });
  });

  describe('API Surface', () => {
    // These tests verify the public API exists and is callable

    it('should expose card methods', async () => {
      const bridge = createWorkerBridge();
      
      expect(typeof bridge.createCard).toBe('function');
      expect(typeof bridge.getCard).toBe('function');
      expect(typeof bridge.updateCard).toBe('function');
      expect(typeof bridge.deleteCard).toBe('function');
      expect(typeof bridge.undeleteCard).toBe('function');
      expect(typeof bridge.listCards).toBe('function');

      bridge.terminate();
    });

    it('should expose connection methods', async () => {
      const bridge = createWorkerBridge();
      
      expect(typeof bridge.createConnection).toBe('function');
      expect(typeof bridge.getConnections).toBe('function');
      expect(typeof bridge.deleteConnection).toBe('function');

      bridge.terminate();
    });

    it('should expose search methods', async () => {
      const bridge = createWorkerBridge();
      
      expect(typeof bridge.searchCards).toBe('function');

      bridge.terminate();
    });

    it('should expose graph methods', async () => {
      const bridge = createWorkerBridge();
      
      expect(typeof bridge.connectedCards).toBe('function');
      expect(typeof bridge.shortestPath).toBe('function');

      bridge.terminate();
    });

    it('should expose database methods', async () => {
      const bridge = createWorkerBridge();
      
      expect(typeof bridge.exportDatabase).toBe('function');

      bridge.terminate();
    });
  });
});

describe('getWorkerBridge singleton', () => {
  it('should return the same instance on multiple calls', async () => {
    const module = await getWorkerBridgeModule();
    
    const bridge1 = module.getWorkerBridge();
    const bridge2 = module.getWorkerBridge();

    expect(bridge1).toBe(bridge2);

    module.resetWorkerBridge();
  });

  it('should create new instance after reset', async () => {
    const module = await getWorkerBridgeModule();
    
    const bridge1 = module.getWorkerBridge();
    module.resetWorkerBridge();
    const bridge2 = module.getWorkerBridge();

    expect(bridge1).not.toBe(bridge2);

    module.resetWorkerBridge();
  });
});
