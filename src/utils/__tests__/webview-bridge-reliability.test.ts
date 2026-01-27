/**
 * WebView Bridge Reliability Test Suite
 *
 * Comprehensive testing for WebView bridge connection reliability,
 * circuit breaker patterns, message queuing, and failure recovery.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebViewBridge } from '../webview-bridge';

// Mock WebKit interface with proper typing
interface MockMessageHandler {
  postMessage: any; // Mock function
}

interface MockWebKitInterface {
  messageHandlers: {
    database?: MockMessageHandler;
    filesystem?: MockMessageHandler;
  };
}

interface MockWindowInterface {
  webkit: MockWebKitInterface;
  resolveWebViewRequest: any; // Mock function
  addEventListener: any; // Mock function
  removeEventListener: any; // Mock function
}

interface WebViewResponse {
  success?: boolean;
  data?: unknown;
  error?: string;
}

const mockWebKit: MockWebKitInterface = {
  messageHandlers: {
    database: {
      postMessage: vi.fn()
    },
    filesystem: {
      postMessage: vi.fn()
    }
  }
};

// Mock window object
const mockWindow: MockWindowInterface = {
  webkit: mockWebKit,
  resolveWebViewRequest: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Mock performance object
const mockPerformance = {
  now: vi.fn(() => Date.now())
};

describe('WebView Bridge Reliability', () => {
  let bridge: WebViewBridge;
  let originalWindow: typeof window;
  let originalPerformance: typeof performance;

  beforeEach(() => {
    // Store originals
    originalWindow = global.window as typeof window;
    originalPerformance = global.performance as typeof performance;

    // Setup mocks
    global.window = mockWindow as unknown as typeof window;
    global.performance = mockPerformance as unknown as typeof performance;

    // Reset all mocks
    vi.clearAllMocks();

    // Restore all handlers to working state
    mockWebKit.messageHandlers.database = { postMessage: vi.fn() };
    mockWebKit.messageHandlers.filesystem = { postMessage: vi.fn() };

    // Create fresh bridge instance
    bridge = new WebViewBridge();
  });

  afterEach(() => {
    bridge.cleanup();

    // Restore originals
    global.window = originalWindow;
    global.performance = originalPerformance;
  });

  describe('Connection Health Monitoring', () => {
    it('should detect WebView environment correctly', () => {
      expect(bridge.isWebViewEnvironment()).toBe(true);
    });

    it('should detect specific handlers availability', () => {
      expect(bridge.isHandlerAvailable('database')).toBe(true);
      expect(bridge.isHandlerAvailable('filesystem')).toBe(true);
    });

    it('should provide health status information', () => {
      const health = bridge.getHealthStatus();

      expect(health).toHaveProperty('isConnected');
      expect(health).toHaveProperty('pendingRequests');
      expect(health).toHaveProperty('environment');
      expect(typeof health.isConnected).toBe('boolean');
      expect(typeof health.pendingRequests).toBe('number');
      expect(typeof health.environment).toBe('object');
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit breaker after repeated failures', async () => {
      // Mock repeated failures
      mockWebKit.messageHandlers.database!.postMessage.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      // Attempt multiple requests to trigger circuit breaker
      const requests = [];
      for (let i = 0; i < 6; i++) { // Exceed threshold
        requests.push(
          bridge.postMessage('database', 'test', {}).catch(err => err)
        );
      }

      const results = await Promise.all(requests);

      // Later requests should fail with circuit breaker error
      const circuitBreakerErrors = results.filter(result =>
        result instanceof Error &&
        result.message.includes('circuit breaker')
      );

      expect(circuitBreakerErrors.length).toBeGreaterThan(0);
    });

    it('should reset circuit breaker after timeout', async () => {
      // First, trigger circuit breaker
      mockWebKit.messageHandlers.database!.postMessage.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      // Attempt multiple requests to open circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          await bridge.postMessage('database', 'test', {});
        } catch {
          // Expected to fail - circuit breaker should open
        }
      }

      // Mock successful response after reset timeout
      mockWebKit.messageHandlers.database!.postMessage.mockImplementation((message: any) => {
        setTimeout(() => {
          bridge.handleResponse(message.id, { success: true }, undefined);
        }, 10);
      });

      // Fast-forward time to trigger circuit breaker reset
      vi.advanceTimersByTime(60000); // 1 minute

      // Request should now succeed
      const result = await bridge.postMessage('database', 'test', {});
      expect(result).toEqual({ success: true });
    });
  });

  describe('Message Queuing and Ordering', () => {
    it('should queue messages when connection is lost', async () => {
      // Simulate connection loss by making handler unavailable
      const originalHandler = mockWindow.webkit.messageHandlers.database;
      mockWindow.webkit.messageHandlers.database = undefined;

      const messagePromise = bridge.postMessage('database', 'test', { data: 'queued' });

      // Message should be queued, not failed immediately
      // We'll verify this by checking that the promise doesn't resolve/reject immediately
      let resolved = false;
      messagePromise.then(() => { resolved = true; }).catch(() => { resolved = true; });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(resolved).toBe(false);

      // Restore handler to process queue
      mockWindow.webkit.messageHandlers.database = originalHandler;

      // Simulate connection restoration and queue processing
      // This would normally happen via the connection monitoring interval
    });

    it('should process queued messages in order when connection is restored', async () => {
      const results: string[] = [];

      // Mock handler to track message order
      mockWebKit.messageHandlers.database!.postMessage.mockImplementation((message: any) => {
        results.push(message.method);
        setTimeout(() => {
          bridge.handleResponse(message.id, { success: true, data: message.method }, undefined);
        }, 10);
      });

      // First, simulate connection loss
      const originalHandler = mockWindow.webkit.messageHandlers.database;
      mockWindow.webkit.messageHandlers.database = undefined;

      // Queue several messages
      const promises = [
        bridge.postMessage('database', 'first', {}),
        bridge.postMessage('database', 'second', {}),
        bridge.postMessage('database', 'third', {})
      ];

      // Restore connection
      mockWindow.webkit.messageHandlers.database = originalHandler;

      // Process messages (simulate queue processing)
      await Promise.all(promises);

      // Verify order is maintained
      expect(results).toEqual(['first', 'second', 'third']);
    });

    it('should drop oldest messages when queue is full', async () => {
      // Simulate connection loss
      mockWindow.webkit.messageHandlers.database = undefined;

      const promises = [];
      const messagePromises = [];

      // Fill queue beyond max size (100)
      for (let i = 0; i < 105; i++) {
        const promise = bridge.postMessage('database', 'test', { index: i })
          .catch(error => error);
        promises.push(promise);
        messagePromises.push(promise);
      }

      // Wait for queue overflow
      const results = await Promise.all(promises);

      // First messages should be dropped with overflow error
      const overflowErrors = results.filter(result =>
        result instanceof Error &&
        result.message.includes('queue overflow')
      );

      expect(overflowErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Exponential Backoff and Retry Logic', () => {
    it('should retry with exponential backoff on retriable errors', async () => {
      const retryDelays: number[] = [];
      let attemptCount = 0;

      // Mock timer functions to capture delays
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback, delay) => {
        if (delay && delay > 0) {
          retryDelays.push(delay);
        }
        return originalSetTimeout(callback, 10); // Execute quickly for test
      }) as unknown as typeof setTimeout;

      mockWebKit.messageHandlers.database!.postMessage.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('timeout'); // Retriable error
        }
        // Succeed on third attempt
        setTimeout(() => {
          bridge.handleResponse('test-id', { success: true });
        }, 10);
      });

      try {
        await bridge.postMessage('database', 'test', {});

        // Should have retried with increasing delays
        expect(retryDelays.length).toBeGreaterThan(0);

        // Verify exponential backoff pattern
        for (let i = 1; i < retryDelays.length; i++) {
          expect(retryDelays[i]).toBeGreaterThan(retryDelays[i - 1]);
        }
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should include jitter in retry delays', async () => {
      const retryDelays: number[] = [];
      let attemptCount = 0;

      // Mock Math.random for consistent jitter testing
      const originalRandom = Math.random;
      const originalSetTimeout = global.setTimeout;
      Math.random = vi.fn(() => 0.5); // Fixed random value

      global.setTimeout = vi.fn((callback, delay) => {
        if (delay && delay > 0) {
          retryDelays.push(delay);
        }
        return originalSetTimeout(callback, 10);
      }) as unknown as typeof setTimeout;

      mockWebKit.messageHandlers.database!.postMessage.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 3) {
          throw new Error('network'); // Retriable error
        }
      });

      try {
        await bridge.postMessage('database', 'test', {}).catch(() => {});

        // Verify jitter is added (delays should not be exact powers of 2)
        if (retryDelays.length > 1) {
          const baseDelay = 1000; // RETRY_DELAY
          const expectedDelayWithoutJitter = baseDelay * Math.pow(2, 1);
          const actualDelay = retryDelays[1];

          // Should be different due to jitter
          expect(actualDelay).not.toBe(expectedDelayWithoutJitter);
        }
      } finally {
        Math.random = originalRandom;
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should not retry non-retriable errors', async () => {
      let attemptCount = 0;

      mockWebKit.messageHandlers.database!.postMessage.mockImplementation(() => {
        attemptCount++;
        throw new Error('permission denied'); // Non-retriable error
      });

      await expect(bridge.postMessage('database', 'test', {}))
        .rejects.toThrow('permission denied');

      // Should not have retried
      expect(attemptCount).toBe(1);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout requests after specified duration', async () => {
      const startTime = Date.now();

      // Mock request that never responds
      mockWebKit.messageHandlers.database!.postMessage.mockImplementation(() => {
        // Don't call handleResponse - simulate no response
      });

      try {
        await bridge.postMessage('database', 'test', {});
        expect.fail('Should have timed out');
      } catch (error) {
        const duration = Date.now() - startTime;

        expect((error as Error).message).toMatch(/timeout/i);
        // Should timeout around the default timeout (considering test timing tolerance)
        expect(duration).toBeLessThan(15000); // Some tolerance for test environment
      }
    });

    it('should clean up timed out requests', async () => {
      // Start a request that will timeout
      const timeoutPromise = bridge.postMessage('database', 'test', {})
        .catch(error => error);

      // Fast-forward time to trigger cleanup
      vi.advanceTimersByTime(35000); // Cleanup runs every 30 seconds

      const error = await timeoutPromise;
      expect((error as Error).message).toMatch(/timeout/i);

      // Verify request was cleaned up
      const health = bridge.getHealthStatus();
      expect(health.pendingRequests).toBe(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle response errors gracefully', () => {
      const errorPromise = new Promise((resolve, reject) => {
        bridge['registerCallback']('test-id', resolve, reject);

        // Simulate error response
        bridge.handleResponse('test-id', null, 'Database connection failed');
      });

      return expect(errorPromise).rejects.toThrow('Database connection failed');
    });

    it('should handle malformed responses', () => {
      const errorPromise = new Promise((resolve, reject) => {
        bridge['registerCallback']('test-id', resolve, reject);

        // Simulate malformed response
        bridge['handleResponseInternal']({
          id: 'test-id',
          success: false,
          error: undefined // Malformed - no error message
        });
      });

      return expect(errorPromise).rejects.toThrow('Unknown bridge error');
    });

    it('should handle unknown request responses', () => {
      // Should not throw when receiving response for unknown request
      expect(() => {
        bridge.handleResponse('unknown-id', { data: 'test' }, undefined);
      }).not.toThrow();
    });
  });

  describe('Connection State Management', () => {
    it('should track connection state correctly', async () => {
      // Initially should be connected (mocked environment)
      const initialHealth = bridge.getHealthStatus();
      expect(initialHealth.isConnected).toBe(true);

      // Simulate connection loss
      mockWindow.webkit.messageHandlers.database = undefined;

      // Health status should reflect disconnection
      const disconnectedHealth = bridge.getHealthStatus();
      expect(disconnectedHealth.isConnected).toBe(false);
    });

    it('should automatically reconnect when connection is restored', async () => {
      // Simulate connection loss
      const originalHandler = mockWindow.webkit.messageHandlers.database;
      mockWindow.webkit.messageHandlers.database = undefined;

      // Queue a message while disconnected
      const messagePromise = bridge.postMessage('database', 'test', {});

      // Restore connection
      mockWindow.webkit.messageHandlers.database = originalHandler;
      mockWebKit.messageHandlers.database!.postMessage.mockImplementation((message: any) => {
        setTimeout(() => {
          bridge.handleResponse(message.id, { success: true }, undefined);
        }, 10);
      });

      // Simulate connection monitoring detecting restoration
      // (In real implementation, this happens via setInterval)

      const result = await messagePromise;
      expect(result).toEqual({ success: true });
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should clean up all resources on cleanup', () => {
      // Start some pending requests
      const promise1 = bridge.postMessage('database', 'test1', {}).catch(e => e);
      const promise2 = bridge.postMessage('database', 'test2', {}).catch(e => e);

      // Verify requests are pending
      const healthBefore = bridge.getHealthStatus();
      expect(healthBefore.pendingRequests).toBeGreaterThan(0);

      // Cleanup
      bridge.cleanup();

      // Verify cleanup
      const healthAfter = bridge.getHealthStatus();
      expect(healthAfter.pendingRequests).toBe(0);

      // Pending promises should be rejected
      return Promise.all([promise1, promise2]).then(results => {
        results.forEach(result => {
          expect(result).toBeInstanceOf(Error);
          expect((result as Error).message).toMatch(/cleanup|cancelled/i);
        });
      });
    });

    it('should stop connection monitoring on cleanup', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      bridge.cleanup();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should reset connection state on cleanup', () => {
      bridge.cleanup();

      const health = bridge.getHealthStatus();
      expect(health.pendingRequests).toBe(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should log performance metrics in development mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockWebKit.messageHandlers.database!.postMessage.mockImplementation((message: any) => {
        setTimeout(() => {
          bridge.handleResponse(String(message.id), { success: true }, undefined);
        }, 10);
      });

      try {
        await bridge.postMessage('database', 'test', {});

        // Should have logged performance metrics
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\[WebView Bridge Performance\]/)
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
        consoleSpy.mockRestore();
      }
    });

    it('should track request correlation correctly', async () => {
      const requestIds: string[] = [];

      mockWebKit.messageHandlers.database!.postMessage.mockImplementation((message: any) => {
        requestIds.push(message.id);
        setTimeout(() => {
          bridge.handleResponse(message.id, { success: true, data: message.id });
        }, 10);
      });

      const results = await Promise.all([
        bridge.postMessage('database', 'test1', {}),
        bridge.postMessage('database', 'test2', {}),
        bridge.postMessage('database', 'test3', {})
      ]);

      // All requests should have unique IDs
      expect(new Set(requestIds).size).toBe(3);

      // Responses should correlate correctly
      results.forEach((result, index) => {
        expect((result as WebViewResponse).data).toBe(requestIds[index]);
      });
    });
  });
});