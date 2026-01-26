/**
 * WebView Bridge for React-Native Communication
 *
 * Detects WebView environment and provides unified interface for database operations
 * Falls back to HTTP API when running in browser environment
 */

export interface WebKitMessageHandlers {
  database: {
    postMessage(message: any): void;
  };
  filesystem: {
    postMessage(message: any): void;
  };
}

export interface WebViewEnvironment {
  isNative: boolean;
  platform: 'iOS' | 'macOS' | 'browser';
  version: string;
  transport: 'webview-bridge' | 'http-api' | 'sql.js';
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

declare global {
  interface Window {
    webkit?: {
      messageHandlers: WebKitMessageHandlers;
    };
    _isometryBridge?: {
      database: any;
      filesystem: any;
      environment: WebViewEnvironment;
      sendMessage: (handler: string, method: string, params: any) => Promise<any>;
      handleResponse: (response: BridgeResponse) => void;
    };
    isometryDatabase?: any;
    isometryFilesystem?: any;
  }
}

/**
 * WebView Bridge Client
 *
 * Provides unified interface for React components to communicate with native app
 */
export class WebViewBridge {
  private requestId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    timestamp: number;
  }>();

  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor() {
    // Set up bridge response handler if not already set
    if (this.isWebViewEnvironment() && window._isometryBridge) {
      const originalHandler = window._isometryBridge.handleResponse;
      window._isometryBridge.handleResponse = (response: WebViewResponse) => {
        this.handleResponse(response);
        if (originalHandler) {
          originalHandler(response);
        }
      };
    }

    // Set up cleanup interval for timed out requests
    setInterval(() => this.cleanupTimedOutRequests(), 30000);
  }

  /**
   * Generate unique request ID with UUID format
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${random}-${++this.requestId}`;
  }

  /**
   * Register callback for request tracking
   */
  private registerCallback(
    id: string,
    resolve: (value: any) => void,
    reject: (error: Error) => void,
    timeout: number = this.DEFAULT_TIMEOUT
  ): void {
    const timeoutHandle = setTimeout(() => {
      this.pendingRequests.delete(id);
      reject(new Error(`WebView bridge request timeout after ${timeout}ms`));
    }, timeout);

    this.pendingRequests.set(id, {
      resolve,
      reject,
      timeout: timeoutHandle,
      timestamp: Date.now()
    });
  }

  /**
   * Post message to native handler with retry logic
   */
  public async postMessage<T = any>(
    handler: 'database' | 'filesystem',
    method: string,
    params: Record<string, unknown> = {},
    retries: number = 0
  ): Promise<T> {
    if (!this.isWebViewEnvironment()) {
      throw new Error('WebView bridge not available');
    }

    return new Promise<T>((resolve, reject) => {
      const requestId = this.generateRequestId();

      try {
        const message: WebViewMessage = {
          id: requestId,
          handler,
          method,
          params,
          timestamp: Date.now()
        };

        // Register callback before sending
        this.registerCallback(requestId, resolve, reject);

        // Send message to native
        if (!window.webkit?.messageHandlers?.[handler]) {
          throw new Error(`WebView handler '${handler}' not available`);
        }

        window.webkit.messageHandlers[handler].postMessage(message);

        // Debug logging
        if (process.env.NODE_ENV === 'development') {
          console.log(`[WebView Bridge] ${handler}.${method}`, params);
        }

      } catch (error) {
        this.pendingRequests.delete(requestId);

        // Retry logic for transient failures
        if (retries < this.MAX_RETRIES && this.isRetriableError(error)) {
          setTimeout(() => {
            this.postMessage(handler, method, params, retries + 1)
              .then(resolve)
              .catch(reject);
          }, this.RETRY_DELAY * (retries + 1));
          return;
        }

        reject(error instanceof Error ? error : new Error(`Failed to send message: ${error}`));
      }
    });
  }

  /**
   * Handle response from native bridge
   */
  private handleResponse(response: WebViewResponse): void {
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
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error || 'Unknown bridge error'));
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
  private isRetriableError(error: any): boolean {
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

    for (const [id, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > timeout) {
        clearTimeout(request.timeout);
        this.pendingRequests.delete(id);
        request.reject(new Error('Request expired during cleanup'));
      }
    }
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
   * Cleanup all pending requests
   */
  public cleanup(): void {
    for (const request of this.pendingRequests.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Bridge cleanup'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Detect if running in WebView environment
   */
  public isWebViewEnvironment(): boolean {
    return !!(
      typeof window !== 'undefined' &&
      window.webkit?.messageHandlers &&
      window._isometryBridge
    );
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
  public async sendMessage(handler: string, method: string, params: any = {}): Promise<any> {
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
    execute: async (sql: string, params?: any[]): Promise<any[]> => {
      return this.postMessage('database', 'execute', { sql, params });
    },

    getNodes: async (options: {
      limit?: number;
      offset?: number;
      filter?: string;
    } = {}): Promise<any[]> => {
      return this.postMessage('database', 'getNodes', options);
    },

    createNode: async (node: any): Promise<any> => {
      return this.postMessage('database', 'createNode', { node });
    },

    updateNode: async (node: any): Promise<any> => {
      return this.postMessage('database', 'updateNode', { node });
    },

    deleteNode: async (id: string): Promise<boolean> => {
      const result = await this.postMessage('database', 'deleteNode', { id });
      return result.success;
    },

    search: async (query: string, options: { limit?: number } = {}): Promise<any[]> => {
      return this.postMessage('database', 'search', { query, ...options });
    },

    getGraph: async (options: { nodeId?: string; depth?: number } = {}): Promise<any[]> => {
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

  /**
   * Handle response from native bridge
   */
  private handleResponse(response: BridgeResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.success) {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error || 'Unknown bridge error'));
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `bridge_req_${++this.requestId}_${Date.now()}`;
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
  getTransport: (): 'webview-bridge' | 'http-api' | 'sql.js' => {
    if (webViewBridge.isWebViewEnvironment()) {
      return 'webview-bridge';
    }

    // Check if native API is available
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return 'http-api';
    }

    return 'sql.js';
  }
};

/**
 * Standalone WebView environment detection
 * @returns true if running in WebView environment
 */
export function isWebViewEnvironment(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    window.webkit?.messageHandlers &&
    (window.webkit.messageHandlers.database || window.webkit.messageHandlers.filesystem)
  );
}

/**
 * Direct message posting to WebView handlers
 * @param handler - The handler name ('database' or 'filesystem')
 * @param method - The method to call
 * @param params - Parameters to send
 * @returns Promise that resolves with the response
 */
export async function postMessage<T = any>(
  handler: 'database' | 'filesystem',
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  return webViewBridge.postMessage<T>(handler, method, params);
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
      // @ts-ignore - debug property might not exist in types
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
      await webViewBridge.database.execute('SELECT 1 as test');
      return true;
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
      webkitReady: !!(window.webkit?.messageHandlers)
    };
  }
};