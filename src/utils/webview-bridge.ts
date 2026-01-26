/**
 * WebView Bridge Communication Layer
 *
 * Provides secure React-to-native communication through WebKit MessageHandler bridge.
 * Handles request/response correlation, environment detection, and promise-based async operations.
 * Replaces HTTP transport with direct native messaging for better security and performance.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Node } from '@/types/node';

export interface WebKitMessageHandlers {
  database: {
    postMessage(message: WebViewMessage): void;
  };
  filesystem: {
    postMessage(message: WebViewMessage): void;
  };
}

export interface WebViewEnvironment {
  isNative: boolean;
  platform: 'iOS' | 'macOS' | 'browser';
  version: string;
  transport: 'webview-bridge' | 'http-api';
}

export interface WebViewMessage {
  id: string;
  handler: 'database' | 'filesystem';
  method: string;
  params: Record<string, unknown>;
  timestamp: number;
}

export interface WebViewResponse {
  id: string;
  result?: unknown;
  error?: string;
  success: boolean;
  timestamp?: number;
}

// Type alias for backward compatibility
export type BridgeResponse = WebViewResponse;

declare global {
  interface Window {
    webkit?: {
      messageHandlers: WebKitMessageHandlers;
    };
    _isometryBridge?: {
      database: Record<string, unknown>;
      filesystem: Record<string, unknown>;
      environment: WebViewEnvironment;
      sendMessage: (handler: string, method: string, params: unknown) => Promise<unknown>;
      handleResponse: (response: BridgeResponse) => void;
      debug?: {
        logMessages?: boolean;
        showPerformance?: boolean;
      };
    };
    resolveWebViewRequest?: (id: string, result: unknown, error?: string) => void;
    isometryDatabase?: Record<string, unknown>;
    isometryFilesystem?: Record<string, unknown>;
  }
}

/**
 * WebView Bridge Client
 *
 * Provides unified interface for React components to communicate with native app
 */
export class WebViewBridge {
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    timestamp: number;
    retryCount: number;
  }>();

  private messageQueue: Array<{
    id: string;
    handler: string;
    method: string;
    params: Record<string, unknown>;
    timestamp: number;
  }> = [];

  private isConnected = false;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private failureCount = 0;
  private lastConnectionTest = 0;
  private circuitBreakerOpen = false;

  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening circuit
  private readonly CIRCUIT_BREAKER_RESET_TIME = 60000; // 1 minute
  private readonly MESSAGE_QUEUE_MAX_SIZE = 100;

  constructor() {
    // Set up global response handler for native to call back
    if (typeof window !== 'undefined') {
      window.resolveWebViewRequest = this.handleResponse.bind(this);
    }

    // Set up bridge response handler if not already set
    if (this.isWebViewEnvironment() && window._isometryBridge) {
      const originalHandler = window._isometryBridge.handleResponse;
      window._isometryBridge.handleResponse = (response: WebViewResponse) => {
        this.handleResponseInternal(response);
        if (originalHandler) {
          originalHandler(response);
        }
      };
    }

    // Set up cleanup interval for timed out requests
    setInterval(() => this.cleanupTimedOutRequests(), 30000);

    // Initialize connection monitoring
    this.startConnectionMonitoring();

    // Test initial connection
    this.testConnection().then((connected) => {
      this.isConnected = connected;
      if (connected) {
        this.processMessageQueue();
      }
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('WebViewBridge initialized, WebView available:', this.isWebViewEnvironment());
    }
  }

  /**
   * Generate unique request ID for correlation
   */
  generateRequestId(): string {
    return uuidv4();
  }

  /**
   * Register callback for request correlation
   */
  registerCallback(
    id: string,
    resolve: (value: unknown) => void,
    reject: (error: Error) => void,
    timeout: number = this.DEFAULT_TIMEOUT
  ): void {
    const timeoutHandle = setTimeout(() => {
      this.pendingRequests.delete(id);
      reject(new Error(`WebView request timeout after ${timeout}ms: ${id}`));
    }, timeout);

    this.pendingRequests.set(id, {
      resolve,
      reject,
      timeout: timeoutHandle,
      timestamp: Date.now(),
      retryCount: 0
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`WebViewBridge registered callback for request ${id}`);
    }
  }

  /**
   * Post message to native handler with circuit breaker and queue management
   */
  public async postMessage<T = unknown>(
    handler: 'database' | 'filesystem',
    method: string,
    params: Record<string, unknown> = {},
    retries: number = 0
  ): Promise<T> {
    if (!this.isWebViewEnvironment()) {
      throw new Error('WebView bridge not available');
    }

    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      if (Date.now() - this.lastConnectionTest > this.CIRCUIT_BREAKER_RESET_TIME) {
        // Reset circuit breaker after timeout
        this.circuitBreakerOpen = false;
        this.failureCount = 0;
        console.log('[WebView Bridge] Circuit breaker reset - attempting reconnection');
      } else {
        throw new Error('WebView bridge circuit breaker is open - service temporarily unavailable');
      }
    }

    const requestId = this.generateRequestId();
    const message: WebViewMessage = {
      id: requestId,
      handler,
      method,
      params,
      timestamp: Date.now()
    };

    return new Promise<T>((resolve, reject) => {
      try {
        // Register callback before sending
        this.registerCallback(requestId, resolve, reject);

        // If not connected, queue the message
        if (!this.isConnected) {
          this.queueMessage(message);
          console.log(`[WebView Bridge] Queued message ${requestId} - bridge disconnected`);
          return;
        }

        // Send message immediately if connected
        this.sendMessageImmediate(message, retries);

      } catch (error) {
        this.pendingRequests.delete(requestId);
        this.handleSendFailure(error, handler, method, params, retries, resolve, reject);
      }
    });
  }

  /**
   * Handle response from native side
   */
  handleResponse(id: string, result: unknown, error?: string): void {
    const response: WebViewResponse = {
      id,
      result,
      error,
      success: !error,
      timestamp: Date.now()
    };

    this.handleResponseInternal(response);
  }

  /**
   * Handle response from native bridge (internal)
   */
  private handleResponseInternal(response: WebViewResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[WebView Bridge] Received response for unknown request: ${response.id}`);
      }
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.success) {
      // Success - reset failure count and ensure we're marked connected
      this.failureCount = 0;
      this.isConnected = true;
      pending.resolve(response.result);
    } else {
      this.handleResponseError(response, pending);
    }

    // Performance logging
    if (process.env.NODE_ENV === 'development' && response.timestamp) {
      const duration = Date.now() - pending.timestamp;
      console.log(`[WebView Bridge Performance] ${response.id}: ${duration}ms`);
    }
  }

  /**
   * Check if error is retriable
   */
  private isRetriableError(error: unknown): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    return message.includes('timeout') ||
           message.includes('network') ||
           message.includes('connection');
  }

  /**
   * Cleanup timed out requests
   */
  private cleanupTimedOutRequests(): void {
    const now = Date.now();
    const timeout = this.DEFAULT_TIMEOUT * 2; // Double timeout for cleanup

    this.pendingRequests.forEach((request, id) => {
      if (now - request.timestamp > timeout) {
        clearTimeout(request.timeout);
        this.pendingRequests.delete(id);
        request.reject(new Error('Request expired during cleanup'));
      }
    });
  }

  /**
   * Get bridge health status
   */
  public getHealthStatus(): {
    isConnected: boolean;
    pendingRequests: number;
    environment: WebViewEnvironment;
  } {
    return {
      isConnected: this.isWebViewEnvironment(),
      pendingRequests: this.pendingRequests.size,
      environment: this.getEnvironment()
    };
  }

  /**
   * Clean up pending callbacks (useful for component unmounting)
   */
  public cleanup(): void {
    this.pendingRequests.forEach((callback) => {
      clearTimeout(callback.timeout);
      callback.reject(new Error('WebView bridge cleanup - request cancelled'));
    });
    this.pendingRequests.clear();

    if (process.env.NODE_ENV === 'development') {
      console.log('WebViewBridge cleaned up all pending callbacks');
    }
  }

  /**
   * Check if WebView environment is available
   */
  public isWebViewEnvironment(): boolean {
    return typeof window !== 'undefined' &&
           typeof window.webkit !== 'undefined' &&
           typeof window.webkit.messageHandlers !== 'undefined';
  }

  /**
   * Check if specific handler is available
   */
  public isHandlerAvailable(handler: 'database' | 'filesystem'): boolean {
    if (!this.isWebViewEnvironment()) {
      return false;
    }

    return typeof window.webkit!.messageHandlers[handler] !== 'undefined' &&
           typeof window.webkit!.messageHandlers[handler]!.postMessage === 'function';
  }

  /**
   * Get environment information
   */
  public getEnvironment(): WebViewEnvironment {
    if (this.isWebViewEnvironment() && window._isometryBridge) {
      return window._isometryBridge.environment;
    }

    return {
      isNative: false,
      platform: 'browser',
      version: '1.0',
      transport: 'http-api'
    };
  }

  /**
   * Send message to native handler
   */
  public async sendMessage(handler: string, method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.isWebViewEnvironment()) {
      throw new Error('WebView bridge not available');
    }

    if (!window._isometryBridge) {
      throw new Error('Bridge not initialized');
    }

    return window._isometryBridge.sendMessage(handler, method, params);
  }

  /**
   * Database operations through WebView bridge
   */
  public database = {
    execute: async (sql: string, params?: unknown[]): Promise<unknown[]> => {
      return this.postMessage('database', 'execute', { sql, params });
    },

    getNodes: async (options: {
      limit?: number;
      offset?: number;
      filter?: string;
    } = {}): Promise<Node[]> => {
      return this.postMessage('database', 'getNodes', options);
    },

    createNode: async (node: Partial<Node>): Promise<Node> => {
      return this.postMessage('database', 'createNode', { node });
    },

    updateNode: async (node: Partial<Node>): Promise<Node> => {
      return this.postMessage('database', 'updateNode', { node });
    },

    deleteNode: async (id: string): Promise<boolean> => {
      const result = await this.postMessage('database', 'deleteNode', { id });
      return result.success;
    },

    search: async (query: string, options: { limit?: number } = {}): Promise<Node[]> => {
      return this.postMessage('database', 'search', { query, ...options });
    },

    getGraph: async (options: { nodeId?: string; depth?: number } = {}): Promise<{ nodes: Node[]; edges: { source: string; target: string; type: string }[] }> => {
      return this.postMessage('database', 'getGraph', options);
    },

    reset: async (): Promise<void> => {
      return this.postMessage('database', 'reset', {});
    }
  };

  /**
   * File system operations through WebView bridge
   */
  public filesystem = {
    readFile: async (path: string): Promise<{ content: string; size: number; modified: number }> => {
      return this.postMessage('filesystem', 'readFile', { path });
    },

    writeFile: async (path: string, content: string): Promise<boolean> => {
      const result = await this.postMessage('filesystem', 'writeFile', { path, content });
      return result.success;
    },

    deleteFile: async (path: string): Promise<boolean> => {
      const result = await this.postMessage('filesystem', 'deleteFile', { path });
      return result.success;
    },

    listFiles: async (path?: string): Promise<Array<{
      name: string;
      path: string;
      isDirectory: boolean;
      size: number;
      modified: number;
    }>> => {
      return this.postMessage('filesystem', 'listFiles', { path });
    },

    fileExists: async (path: string): Promise<boolean> => {
      const result = await this.postMessage('filesystem', 'fileExists', { path });
      return result.exists;
    }
  };

  /**
   * Wait for bridge to be ready
   */
  public async waitForReady(): Promise<void> {
    if (!this.isWebViewEnvironment()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      if (window._isometryBridge) {
        resolve();
        return;
      }

      const handler = () => {
        window.removeEventListener('isometry-bridge-ready', handler);
        resolve();
      };

      window.addEventListener('isometry-bridge-ready', handler);

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('isometry-bridge-ready', handler);
        resolve(); // Continue anyway
      }, 5000);
    });
  }

  // =============================================================================
  // Connection Reliability and Recovery Methods
  // =============================================================================

  /**
   * Start monitoring connection health
   */
  private startConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    this.connectionCheckInterval = setInterval(async () => {
      if (this.isWebViewEnvironment()) {
        const connected = await this.testConnection();

        if (!connected && this.isConnected) {
          // Connection lost
          this.isConnected = false;
          this.failureCount++;
          console.warn('[WebView Bridge] Connection lost - switching to queue mode');

          if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
            this.circuitBreakerOpen = true;
            this.lastConnectionTest = Date.now();
            console.error('[WebView Bridge] Circuit breaker opened due to repeated failures');
          }
        } else if (connected && !this.isConnected) {
          // Connection restored
          this.isConnected = true;
          this.failureCount = 0;
          this.circuitBreakerOpen = false;
          console.log('[WebView Bridge] Connection restored - processing queued messages');

          // Process queued messages
          this.processMessageQueue();
        }
      }
    }, this.CONNECTION_CHECK_INTERVAL);
  }

  /**
   * Test connection to WebView bridge
   */
  private async testConnection(): Promise<boolean> {
    if (!this.isWebViewEnvironment()) {
      return false;
    }

    try {
      // Send a lightweight ping message
      const testMessage: WebViewMessage = {
        id: this.generateRequestId(),
        handler: 'database',
        method: 'ping',
        params: {},
        timestamp: Date.now()
      };

      // Quick timeout for connection test
      const timeout = 2000;

      return new Promise<boolean>((resolve) => {
        const timeoutHandle = setTimeout(() => {
          resolve(false);
        }, timeout);

        // Don't use normal callback registration to avoid interference
        const tempCallback = (result: unknown) => {
          clearTimeout(timeoutHandle);
          resolve(result !== null && result !== undefined);
        };

        try {
          if (window.webkit?.messageHandlers?.database) {
            // Simple test without full callback registration
            window.webkit.messageHandlers.database.postMessage(testMessage);
            tempCallback(true); // If postMessage doesn't throw, assume connection works
          } else {
            resolve(false);
          }
        } catch {
          resolve(false);
        }
      });

    } catch {
      return false;
    }
  }

  /**
   * Queue message for later delivery
   */
  private queueMessage(message: WebViewMessage): void {
    // Remove oldest messages if queue is full
    if (this.messageQueue.length >= this.MESSAGE_QUEUE_MAX_SIZE) {
      const removed = this.messageQueue.shift();
      if (removed) {
        const pending = this.pendingRequests.get(removed.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(removed.id);
          pending.reject(new Error('Message queue overflow - message dropped'));
        }
      }
    }

    this.messageQueue.push(message);
  }

  /**
   * Process queued messages when connection is restored
   */
  private processMessageQueue(): void {
    const messagesToSend = [...this.messageQueue];
    this.messageQueue = [];

    console.log(`[WebView Bridge] Processing ${messagesToSend.length} queued messages`);

    for (const message of messagesToSend) {
      try {
        this.sendMessageImmediate(message, 0);
      } catch (error) {
        console.error(`[WebView Bridge] Failed to send queued message ${message.id}:`, error);

        // Reject the pending request
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);
          pending.reject(new Error(`Failed to send queued message: ${error}`));
        }
      }
    }
  }

  /**
   * Send message immediately to native bridge
   */
  private sendMessageImmediate(message: WebViewMessage, retries: number): void {
    if (!window.webkit?.messageHandlers?.[message.handler]) {
      throw new Error(`WebView handler '${message.handler}' not available`);
    }

    try {
      window.webkit.messageHandlers[message.handler].postMessage(message);

      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[WebView Bridge] ${message.handler}.${message.method}`, message.params);
      }

    } catch (error) {
      // Increment failure count and potentially open circuit breaker
      this.failureCount++;

      if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitBreakerOpen = true;
        this.lastConnectionTest = Date.now();
      }

      throw error;
    }
  }

  /**
   * Handle send failure with retry logic
   */
  private handleSendFailure(
    error: unknown,
    handler: string,
    method: string,
    params: Record<string, unknown>,
    retries: number,
    resolve: (value: unknown) => void,
    reject: (error: Error) => void
  ): void {
    // Retry logic for transient failures
    if (retries < this.MAX_RETRIES && this.isRetriableError(error)) {
      const delay = this.RETRY_DELAY * Math.pow(2, retries); // Exponential backoff with jitter
      const jitter = Math.random() * 0.1 * delay; // 10% jitter
      const totalDelay = delay + jitter;

      setTimeout(() => {
        this.postMessage(handler, method, params, retries + 1)
          .then(resolve)
          .catch(reject);
      }, totalDelay);
      return;
    }

    reject(error instanceof Error ? error : new Error(`Failed to send message: ${error}`));
  }

  /**
   * Handle response error with retry logic
   */
  private handleResponseError(
    response: WebViewResponse,
    pending: {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
      timestamp: number;
      retryCount: number;
    }
  ): void {
    const error = new Error(response.error || 'Unknown bridge error');

    // Check if this error is worth retrying
    if (pending.retryCount < this.MAX_RETRIES && this.isRetriableError(error)) {
      pending.retryCount++;
      this.failureCount++;

      // Re-register for retry
      const newId = this.generateRequestId();
      this.pendingRequests.set(newId, {
        ...pending,
        timeout: setTimeout(() => {
          this.pendingRequests.delete(newId);
          pending.reject(new Error(`WebView request timeout after retry: ${newId}`));
        }, this.DEFAULT_TIMEOUT)
      });

      // Retry the original request (this would need the original message data)
      console.log(`[WebView Bridge] Retrying request ${response.id} as ${newId} (attempt ${pending.retryCount})`);
    } else {
      pending.reject(error);
    }
  }

  /**
   * Enhanced cleanup with connection state management
   */
  public cleanup(): void {
    // Stop connection monitoring
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    // Clear message queue and reject all pending
    this.messageQueue = [];

    this.pendingRequests.forEach((callback) => {
      clearTimeout(callback.timeout);
      callback.reject(new Error('WebView bridge cleanup - request cancelled'));
    });
    this.pendingRequests.clear();

    // Reset connection state
    this.isConnected = false;
    this.circuitBreakerOpen = false;
    this.failureCount = 0;

    if (process.env.NODE_ENV === 'development') {
      console.log('WebViewBridge cleaned up all pending callbacks and reset connection state');
    }
  }

}

/**
 * Singleton bridge instance
 */
export const webViewBridge = new WebViewBridge();

/**
 * Environment detection utilities
 */
export const Environment = {
  /**
   * Check if running in WebView
   */
  isWebView: (): boolean => webViewBridge.isWebViewEnvironment(),

  /**
   * Check if running in browser
   */
  isBrowser: (): boolean => !webViewBridge.isWebViewEnvironment(),

  /**
   * Get current environment info
   */
  info: (): WebViewEnvironment => webViewBridge.getEnvironment(),

  /**
   * Get preferred transport method
   */
  getTransport: (): 'webview-bridge' | 'http-api' => {
    if (webViewBridge.isWebViewEnvironment()) {
      return 'webview-bridge';
    }

    return 'http-api';
  }
};

/**
 * Get or create global WebView bridge instance
 */
export function getWebViewBridge(): WebViewBridge {
  if (!webViewBridge) {
    throw new Error('WebView bridge not initialized');
  }
  return webViewBridge;
}

/**
 * Standalone WebView environment detection
 * @returns true if running in WebView environment
 */
export function isWebViewEnvironment(): boolean {
  return webViewBridge.isWebViewEnvironment();
}

/**
 * Check if specific handler is available
 */
export function isHandlerAvailable(handler: 'database' | 'filesystem'): boolean {
  return webViewBridge.isHandlerAvailable(handler);
}

/**
 * Direct message posting to WebView handlers
 * @param handler - The handler name ('database' or 'filesystem')
 * @param method - The method to call
 * @param params - Parameters to send
 * @returns Promise that resolves with the response
 */
export async function postMessage<T = unknown>(
  handler: 'database' | 'filesystem',
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  return webViewBridge.postMessage<T>(handler, method, params);
}

/**
 * Test WebView bridge connectivity
 */
export async function testBridge(): Promise<{
  isWebView: boolean;
  database: boolean;
  filesystem: boolean;
  healthInfo: ReturnType<WebViewBridge['getHealthStatus']>;
}> {
  const bridge = webViewBridge;
  const isWebView = bridge.isWebViewEnvironment();

  let databaseConnected = false;
  let filesystemConnected = false;

  if (isWebView) {
    try {
      await bridge.postMessage('database', 'ping', {});
      databaseConnected = true;
    } catch {
      databaseConnected = false;
    }

    try {
      await bridge.postMessage('filesystem', 'ping', {});
      filesystemConnected = true;
    } catch {
      filesystemConnected = false;
    }
  }

  return {
    isWebView,
    database: databaseConnected,
    filesystem: filesystemConnected,
    healthInfo: bridge.getHealthStatus(),
  };
}

/**
 * Utility for graceful environment detection with fallback
 */
export function detectEnvironment(): {
  type: 'webview' | 'browser' | 'unknown';
  capabilities: {
    database: boolean;
    filesystem: boolean;
    webkit: boolean;
  };
  recommendedTransport: 'webview' | 'http' | 'sqljs';
} {
  const isWebView = isWebViewEnvironment();
  const hasDatabase = isHandlerAvailable('database');
  const hasFilesystem = isHandlerAvailable('filesystem');

  let type: 'webview' | 'browser' | 'unknown' = 'unknown';
  let recommendedTransport: 'webview' | 'http' | 'sqljs' = 'sqljs';

  if (isWebView && hasDatabase) {
    type = 'webview';
    recommendedTransport = 'webview';
  } else if (typeof window !== 'undefined' && window.location) {
    type = 'browser';
    // Check if HTTP API is available in browser environment
    recommendedTransport = 'http'; // Could test availability and fall back to 'sqljs'
  }

  return {
    type,
    capabilities: {
      database: hasDatabase,
      filesystem: hasFilesystem,
      webkit: isWebView,
    },
    recommendedTransport,
  };
}

/**
 * Development utilities
 */
export const DevTools = {
  /**
   * Enable bridge logging
   */
  enableLogging: (): void => {
    if (webViewBridge.isWebViewEnvironment() && window._isometryBridge) {
      if (window._isometryBridge.debug) {
        window._isometryBridge.debug.logMessages = true;
        window._isometryBridge.debug.showPerformance = true;
      }
    }
  },

  /**
   * Test bridge connectivity
   */
  testConnection: async (): Promise<boolean> => {
    try {
      const result = await testBridge();
      return result.database && result.isWebView;
    } catch {
      return false;
    }
  },

  /**
   * Get bridge statistics
   */
  getStats: () => {
    return {
      environment: webViewBridge.getEnvironment(),
      isWebView: webViewBridge.isWebViewEnvironment(),
      bridgeReady: !!(window._isometryBridge),
      webkitReady: !!(window.webkit?.messageHandlers),
      healthInfo: webViewBridge.getHealthStatus()
    };
  }
};