/**
 * WebView Database Client
 *
 * Provides identical interface to sql.js Database for seamless React component compatibility.
 * Routes all operations through WebView bridge to native GRDB/CloudKit backend.
 * Includes comprehensive performance monitoring for optimization insights.
 */

import { getWebViewBridge, postMessage, isWebViewEnvironment } from '../utils/webview-bridge';
import { dbLogger } from '../utils/logger';

export interface ConnectionStatus {
  isConnected: boolean;
  lastPing?: Date;
  pendingRequests: number;
  transport: 'webview' | 'fallback';
}

// Type definition for WebView bridge
interface WebViewBridge {
  postMessage: (namespace: string, _method: string, data: unknown) => Promise<unknown>;
  getHealthStatus: () => {
    isConnected: boolean;
    pendingRequests: number;
    environment: {
      isNative: boolean;
      platform: string;
      version: string;
      transport: string;
    };
  };
}

/**
 * WebView client for database operations through MessageHandler bridge
 * Maintains exact same interface as sql.js Database for drop-in compatibility
 */
export class WebViewClient {
  private connected: boolean = false;
  private timeout: number;
  private bridge: WebViewBridge | null = null;

  constructor(timeout: number = 10000) {
    this.timeout = timeout;
  }

  /**
   * Test WebView bridge availability and establish connection
   */
  async connect(): Promise<void> {
    if (!isWebViewEnvironment()) {
      throw new Error('WebView bridge not available - ensure running in native app');
    }

    try {
      // Test basic connectivity with a ping operation
      this.bridge = getWebViewBridge();
      await this.bridge.postMessage('database', 'ping', {});
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`WebView bridge connection failed: ${error}`);
    }
  }

  /**
   * Check if client is connected to WebView bridge
   */
  isConnected(): boolean {
    return this.connected && isWebViewEnvironment();
  }

  /**
   * Get current connection status for monitoring
   */
  getConnectionStatus(): ConnectionStatus {
    try {
      const bridge = this.bridge || getWebViewBridge();
      const healthInfo = bridge.getHealthStatus();

      return {
        isConnected: this.connected,
        lastPing: new Date(),
        pendingRequests: healthInfo.pendingRequests,
        transport: 'webview',
      };
    } catch {
      return {
        isConnected: false,
        pendingRequests: 0,
        transport: 'fallback',
      };
    }
  }

  /**
   * Get bridge health status for advanced monitoring
   */
  getBridgeHealth() {
    try {
      const bridge = this.bridge || getWebViewBridge();
      return bridge.getHealthStatus();
    } catch {
      return {
        isConnected: false,
        pendingRequests: 0,
        environment: {
          isNative: false,
          platform: 'browser',
          version: '1.0',
          transport: 'fallback'
        }
      };
    }
  }

  /**
   * Execute SQL query with exact same interface as sql.js
   * @param sql SQL query string
   * @param params Query parameters
   * @returns Array of result objects matching sql.js format
   */
  async execute<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    if (!this.connected) {
      throw new Error('WebView client not connected. Call connect() first.');
    }

    try {
      // Route through database MessageHandler with execute method
      const result = await postMessage<T[]>('database', 'execute', {
        sql,
        params: params || []
      });

      return result || [];
    } catch (error) {
      dbLogger.error('Database execution error', { sql, params }, error as Error);

      // Check if error indicates disconnection
      const errorMessage = (error as Error).message.toLowerCase();
      if (errorMessage.includes('timeout') || errorMessage.includes('bridge') || errorMessage.includes('webview')) {
        this.connected = false;
      }

      throw new Error(`SQL execution failed: ${error}`);
    }
  }


  /**
   * Save operation - no-op for compatibility (native handles persistence automatically)
   */
  async save(): Promise<void> {
    // Native backend handles persistence automatically
    // This method exists for sql.js compatibility only
    return Promise.resolve();
  }

  /**
   * Reset database - calls native reset through MessageHandler
   */
  async reset(): Promise<void> {
    if (!this.connected) {
      throw new Error('WebView client not connected. Call connect() first.');
    }

    try {
      await postMessage('database', 'reset', {});
      dbLogger.info('Database reset successfully');
    } catch (error) {
      dbLogger.error('Database reset error', undefined, error as Error);
      this.connected = false;
      throw new Error(`Database reset failed: ${error}`);
    }
  }

}

/**
 * Factory function to create and connect a WebView client
 * @param timeout Request timeout in milliseconds
 * @returns Connected WebViewClient instance
 */
export async function createWebViewClient(timeout?: number): Promise<WebViewClient> {
  const client = new WebViewClient(timeout);
  await client.connect();
  return client;
}

/**
 * Utility function to test if WebView bridge is available
 * @returns Promise resolving to true if bridge is available
 */
export async function isWebViewBridgeAvailable(): Promise<boolean> {
  try {
    if (!isWebViewEnvironment()) {
      return false;
    }
    const client = new WebViewClient(3000); // Shorter timeout for availability check
    await client.connect();
    return true;
  } catch {
    return false;
  }
}