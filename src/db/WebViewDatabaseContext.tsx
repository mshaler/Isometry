/**
 * WebView Database Context
 *
 * Provides the same React context interface as DatabaseContext but uses WebView bridge
 * Enables seamless component compatibility between browser and WebView environments
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { WebViewClient, webViewClient } from './WebViewClient';
import { webViewBridge, Environment } from '../utils/webview-bridge';
import type { DatabaseClient, Node, Edge, SearchResult } from './types';

interface WebViewDatabaseContextType {
  db: WebViewClient | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  save: () => Promise<void>;
  reset: () => Promise<void>;
}

const WebViewDatabaseContext = createContext<WebViewDatabaseContextType | null>(null);

export interface WebViewDatabaseProviderProps {
  children: ReactNode;
  fallbackComponent?: React.ComponentType<{ error: string }>;
  loadingComponent?: React.ComponentType;
}

/**
 * WebView Database Provider
 *
 * Initializes WebView bridge and provides database context to child components
 */
export function WebViewDatabaseProvider({
  children,
  fallbackComponent: FallbackComponent,
  loadingComponent: LoadingComponent
}: WebViewDatabaseProviderProps) {
  const [db, setDb] = useState<WebViewClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeWebViewDatabase = async () => {
      try {
        setLoading(true);
        setError(null);

        // Verify WebView environment
        if (!Environment.isWebView()) {
          throw new Error('WebView environment not detected');
        }

        // Wait for bridge to be ready
        await webViewBridge.waitForReady();

        // Initialize database client
        await webViewClient.initialize();

        if (!mounted) return;

        setDb(webViewClient);
        setLoading(false);

      } catch (err) {
        if (!mounted) return;

        const error = err instanceof Error ? err : new Error('WebView initialization failed');
        setError(error);
        setLoading(false);
        console.error('WebView database initialization failed:', err);
      }
    };

    initializeWebViewDatabase();

    return () => {
      mounted = false;
    };
  }, []);

  // Execute method matching DatabaseContext interface
  const execute = React.useCallback(async <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> => {
    if (!db) {
      throw new Error('WebView database not initialized');
    }

    const result = await db.execute(sql, params);
    return result as T[];
  }, [db]);

  // Save method (no-op for WebView)
  const save = React.useCallback(async () => {
    // WebView automatically persists through native bridge
    return Promise.resolve();
  }, []);

  // Reset method
  const reset = React.useCallback(async () => {
    if (!db) {
      throw new Error('WebView database not initialized');
    }

    setLoading(true);
    try {
      await db.reset();
      // Re-initialize after reset
      await db.initialize();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Reset failed'));
    } finally {
      setLoading(false);
    }
  }, [db]);

  // Context value matching exact interface
  const contextValue: WebViewDatabaseContextType = {
    db,
    loading,
    error,
    execute,
    save,
    reset
  };

  // Show loading component while initializing
  if (loading && LoadingComponent) {
    return <LoadingComponent />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600">Initializing WebView Database...</p>
        </div>
      </div>
    );
  }

  // Show error component if initialization failed
  if (error) {
    if (FallbackComponent) {
      return <FallbackComponent error={error} />;
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 p-6 border border-red-300 rounded-lg bg-red-50">
          <div className="text-red-600">
            <svg className="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-semibold">WebView Database Error</h3>
          </div>
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <WebViewDatabaseContext.Provider value={contextValue}>
      {children}
    </WebViewDatabaseContext.Provider>
  );
}

/**
 * Hook to use WebView database context
 */
export function useWebViewDatabase(): WebViewDatabaseContextType {
  const context = useContext(WebViewDatabaseContext);

  if (!context) {
    throw new Error('useWebViewDatabase must be used within WebViewDatabaseProvider');
  }

  return context;
}

/**
 * Hook that mimics useSQLiteQuery for compatibility
 */
export function useWebViewQuery(sql: string, params: any[] = [], dependencies: any[] = []) {
  const { execute } = useWebViewDatabase();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const runQuery = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const result = await execute(sql, params);

        if (mounted) {
          setData(result);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Query failed';
          setError(errorMessage);
          setIsLoading(false);
        }
      }
    };

    runQuery();

    return () => {
      mounted = false;
    };
  }, [sql, JSON.stringify(params), ...dependencies]);

  return { data, isLoading, error };
}

/**
 * Environment detection hook
 */
export function useWebViewEnvironment() {
  const [environment, setEnvironment] = useState(() => Environment.info());

  useEffect(() => {
    // Update environment info when bridge becomes ready
    const handleBridgeReady = () => {
      setEnvironment(Environment.info());
    };

    window.addEventListener('isometry-bridge-ready', handleBridgeReady);

    return () => {
      window.removeEventListener('isometry-bridge-ready', handleBridgeReady);
    };
  }, []);

  return environment;
}

/**
 * Component for displaying environment information
 */
export function WebViewEnvironmentInfo() {
  const environment = useWebViewEnvironment();

  return (
    <div className="text-xs text-gray-500 font-mono">
      {environment.transport} on {environment.platform} v{environment.version}
    </div>
  );
}