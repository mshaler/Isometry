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

export interface BridgeMessage {
  id: string;
  method: string;
  params: Record<string, any>;
}

export interface BridgeResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
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
  }>();

  constructor() {
    // Set up bridge response handler if not already set
    if (this.isWebViewEnvironment() && window._isometryBridge) {
      const originalHandler = window._isometryBridge.handleResponse;
      window._isometryBridge.handleResponse = (response: BridgeResponse) => {
        this.handleResponse(response);
        if (originalHandler) {
          originalHandler(response);
        }
      };
    }
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
      return this.sendMessage('database', 'execute', { sql, params });
    },

    getNodes: async (options: {
      limit?: number;
      offset?: number;
      filter?: string;
    } = {}): Promise<any[]> => {
      return this.sendMessage('database', 'getNodes', options);
    },

    createNode: async (node: any): Promise<any> => {
      return this.sendMessage('database', 'createNode', { node });
    },

    updateNode: async (node: any): Promise<any> => {
      return this.sendMessage('database', 'updateNode', { node });
    },

    deleteNode: async (id: string): Promise<boolean> => {
      const result = await this.sendMessage('database', 'deleteNode', { id });
      return result.success;
    },

    search: async (query: string, options: { limit?: number } = {}): Promise<any[]> => {
      return this.sendMessage('database', 'search', { query, ...options });
    },

    getGraph: async (options: { nodeId?: string; depth?: number } = {}): Promise<any[]> => {
      return this.sendMessage('database', 'getGraph', options);
    },

    reset: async (): Promise<void> => {
      return this.sendMessage('database', 'reset', {});
    }
  };

  /**
   * File system operations through WebView bridge
   */
  public filesystem = {
    readFile: async (path: string): Promise<{ content: string; size: number; modified: number }> => {
      return this.sendMessage('filesystem', 'readFile', { path });
    },

    writeFile: async (path: string, content: string): Promise<boolean> => {
      const result = await this.sendMessage('filesystem', 'writeFile', { path, content });
      return result.success;
    },

    deleteFile: async (path: string): Promise<boolean> => {
      const result = await this.sendMessage('filesystem', 'deleteFile', { path });
      return result.success;
    },

    listFiles: async (path?: string): Promise<Array<{
      name: string;
      path: string;
      isDirectory: boolean;
      size: number;
      modified: number;
    }>> => {
      return this.sendMessage('filesystem', 'listFiles', { path });
    },

    fileExists: async (path: string): Promise<boolean> => {
      const result = await this.sendMessage('filesystem', 'fileExists', { path });
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