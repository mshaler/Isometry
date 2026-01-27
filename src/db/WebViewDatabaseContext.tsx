/**
 * WebView Database Context
 *
 * Mirror exact interface of existing DatabaseContext but uses WebViewClient instead of sql.js.
 * Provides same loading/error state management and hook interfaces for seamless compatibility.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { WebViewClient, createWebViewClient } from './WebViewClient';
import { isWebViewEnvironment } from '../utils/webview-bridge';

/**
 * WebView Database Context interface matching existing DatabaseContext exactly
 * Provides identical interface for seamless component compatibility
 */
export interface WebViewDatabaseContextValue {
  db: WebViewClient | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  save: () => Promise<void>;
  reset: () => Promise<void>;
  isConnected: () => boolean;
  getConnectionStatus: () => { isConnected: boolean; transport: string; };
  getBridgeHealth: () => {
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

const WebViewDatabaseContext = createContext<WebViewDatabaseContextValue | null>(null);

export interface WebViewDatabaseProviderProps {
  children: React.ReactNode;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * WebView Database Provider using WebView bridge instead of sql.js
 * Maintains identical interface and state management patterns as DatabaseProvider
 */
export function WebViewDatabaseProvider({
  children,
  timeout = 10000,
  retryAttempts = 3,
  retryDelay = 1000,
}: WebViewDatabaseProviderProps) {
  const [db, setDb] = useState<WebViewClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize client with retry logic
  useEffect(() => {
    let isCancelled = false;

    const initializeClient = async (attempt: number = 1) => {
      if (isCancelled) return;

      setLoading(true);
      setError(null);

      try {
        console.log(`Connecting to WebView bridge (attempt ${attempt}/${retryAttempts})`);

        if (!isWebViewEnvironment()) {
          throw new Error('WebView environment not available - ensure running in native app');
        }

        const client = await createWebViewClient(timeout);

        if (!isCancelled) {
          setDb(client);
          console.log('WebView client connected successfully');
        }
      } catch (err) {
        console.error(`WebView connection attempt ${attempt} failed:`, err);

        if (!isCancelled) {
          if (attempt < retryAttempts) {
            // Retry after delay
            setTimeout(() => {
              if (!isCancelled) {
                initializeClient(attempt + 1);
              }
            }, retryDelay * attempt); // Exponential backoff
            return; // Don't set loading to false yet
          } else {
            // All retry attempts failed
            setError(err as Error);
          }
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    initializeClient();

    return () => {
      isCancelled = true;
    };
  }, [timeout, retryAttempts, retryDelay]);

  /**
   * Execute SQL query - identical interface to sql.js DatabaseContext
   */
  const execute = useCallback(async <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> => {
    if (!db) {
      throw new Error('WebView database client not initialized');
    }

    try {
      return await db.execute<T>(sql, params);
    } catch (err) {
      console.error('WebView database execution error:', sql, params, err);

      // Check if error indicates disconnection
      const errorMessage = (err as Error).message.toLowerCase();
      if (errorMessage.includes('timeout') || errorMessage.includes('bridge') || errorMessage.includes('webview')) {
        setError(err as Error);
      }

      throw err;
    }
  }, [db]);

  /**
   * Save operation - no-op for compatibility (native handles persistence)
   */
  const save = useCallback(async () => {
    if (!db) {
      throw new Error('WebView database client not initialized');
    }

    await db.save();
  }, [db]);

  /**
   * Reset database - calls WebView reset and reinitializes client
   */
  const reset = useCallback(async () => {
    if (!db) {
      throw new Error('WebView database client not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      await db.reset();
      console.log('WebView database reset successfully');
    } catch (err) {
      console.error('WebView database reset error:', err);
      setError(err as Error);

      // Try to reconnect after failed reset
      try {
        const newClient = await createWebViewClient(timeout);
        setDb(newClient);
        console.log('Reconnected to WebView bridge after reset failure');
      } catch (reconnectErr) {
        console.error('Failed to reconnect after reset failure:', reconnectErr);
        setError(reconnectErr as Error);
      }
    } finally {
      setLoading(false);
    }
  }, [db, timeout]);

  /**
   * Check if database client is connected
   */
  const isConnected = useCallback(() => {
    return db ? db.isConnected() : false;
  }, [db]);

  /**
   * Get connection status for monitoring
   */
  const getConnectionStatus = useCallback(() => {
    return db ? db.getConnectionStatus() : { isConnected: false, transport: 'none' };
  }, [db]);

  /**
   * Get bridge health information
   */
  const getBridgeHealth = useCallback(() => {
    if (!db) {
      return {
        isConnected: false,
        pendingRequests: 0,
        environment: { isNative: false, platform: 'browser', version: '1.0', transport: 'http-api' }
      };
    }

    // Access the bridge health through the client's getBridgeHealth method
    const webViewClient = db as unknown as { getBridgeHealth?: () => unknown };
    if (webViewClient.getBridgeHealth) {
      return webViewClient.getBridgeHealth() as {
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

    // Fallback to basic connection status
    const connectionStatus = db.getConnectionStatus();
    return {
      isConnected: connectionStatus.isConnected,
      pendingRequests: connectionStatus.pendingRequests || 0,
      environment: {
        isNative: connectionStatus.transport === 'webview',
        platform: 'unknown',
        version: '1.0',
        transport: connectionStatus.transport
      }
    };
  }, [db]);

  const contextValue: WebViewDatabaseContextValue = {
    db,
    loading,
    error,
    execute,
    save,
    reset,
    isConnected,
    getConnectionStatus,
    getBridgeHealth,
  };

  return (
    <WebViewDatabaseContext.Provider value={contextValue}>
      {children}
    </WebViewDatabaseContext.Provider>
  );
}

/**
 * Hook to access WebView database context
 * Identical interface to useDatabase() for drop-in replacement
 */
export function useWebViewDatabase(): WebViewDatabaseContextValue {
  const context = useContext(WebViewDatabaseContext);
  if (!context) {
    throw new Error('useWebViewDatabase must be used within WebViewDatabaseProvider');
  }
  return context;
}

/**
 * Hook that provides the same interface as useDatabase() from DatabaseContext
 * Allows components to use WebView database transparently
 */
export function useDatabaseCompat(): {
  db: WebViewClient | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  save: () => Promise<void>;
  reset: () => Promise<void>;
} {
  const { db, loading, error, execute, save, reset } = useWebViewDatabase();

  return {
    db,
    loading,
    error,
    execute,
    save,
    reset,
  };
}

/**
 * Utility component to display connection status for debugging
 */
export function WebViewDatabaseStatus() {
  const { loading, error, getBridgeHealth } = useWebViewDatabase();

  if (loading) {
    return <div className="text-sm text-gray-500">Connecting to WebView bridge...</div>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        WebView Bridge Error: {error.message}
      </div>
    );
  }

  const health = getBridgeHealth();

  if (health.isConnected) {
    return (
      <div className="text-sm text-green-500">
        WebView Bridge Connected
        {health.pendingRequests > 0 && (
          <span className="ml-2 text-gray-400">({health.pendingRequests} pending)</span>
        )}
      </div>
    );
  }

  return (
    <div className="text-sm text-yellow-500">
      WebView Bridge Disconnected
      {health.pendingRequests > 0 && (
        <span className="ml-2 text-gray-400">({health.pendingRequests} queued)</span>
      )}
    </div>
  );
}

/**
 * Advanced bridge status component for debugging and monitoring
 */
export function WebViewBridgeHealthStatus() {
  const { getBridgeHealth } = useWebViewDatabase();
  const health = getBridgeHealth();

  return (
    <div className="text-xs text-gray-600 space-y-1">
      <div className="flex justify-between">
        <span>Status:</span>
        <span className={health.isConnected ? 'text-green-600' : 'text-red-600'}>
          {health.isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div className="flex justify-between">
        <span>Transport:</span>
        <span>{health.environment.transport}</span>
      </div>
      <div className="flex justify-between">
        <span>Platform:</span>
        <span>{health.environment.platform}</span>
      </div>
      <div className="flex justify-between">
        <span>Pending Requests:</span>
        <span>{health.pendingRequests}</span>
      </div>
      <div className="flex justify-between">
        <span>Version:</span>
        <span>{health.environment.version}</span>
      </div>
    </div>
  );
}