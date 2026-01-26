import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { NativeAPIClient, createClient } from './NativeAPIClient';

/**
 * Native Database Context interface matching existing DatabaseContext exactly
 * Provides identical interface for seamless component compatibility
 */
export interface NativeDatabaseContextValue {
  db: NativeAPIClient | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  save: () => Promise<void>;
  reset: () => Promise<void>;
}

const NativeDatabaseContext = createContext<NativeDatabaseContextValue | null>(null);

export interface NativeDatabaseProviderProps {
  children: React.ReactNode;
  baseURL?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Native Database Provider using HTTP API instead of sql.js
 * Maintains identical interface and state management patterns as DatabaseProvider
 */
export function NativeDatabaseProvider({
  children,
  baseURL = 'http://localhost:8080',
  timeout = 5000,
  retryAttempts = 3,
  retryDelay = 1000,
}: NativeDatabaseProviderProps) {
  const [db, setDb] = useState<NativeAPIClient | null>(null);
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
        console.log(`Connecting to native API server at ${baseURL} (attempt ${attempt}/${retryAttempts})`);
        const client = await createClient(baseURL, timeout);

        if (!isCancelled) {
          setDb(client);
          console.log('Native API client connected successfully');
        }
      } catch (err) {
        console.error(`Native API connection attempt ${attempt} failed:`, err);

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
  }, [baseURL, timeout, retryAttempts, retryDelay]);

  /**
   * Execute SQL query - identical interface to sql.js DatabaseContext
   */
  const execute = useCallback(async <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> => {
    if (!db) {
      throw new Error('Native database client not initialized');
    }

    try {
      return await db.execute<T>(sql, params);
    } catch (err) {
      console.error('Native database execution error:', sql, params, err);

      // Check if error indicates disconnection
      const errorMessage = (err as Error).message.toLowerCase();
      if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('not connected')) {
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
      throw new Error('Native database client not initialized');
    }

    await db.save();
  }, [db]);

  /**
   * Reset database - calls native reset endpoint and reinitializes client
   */
  const reset = useCallback(async () => {
    if (!db) {
      throw new Error('Native database client not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      await db.reset();
      // Client should still be connected after reset, no need to recreate
      console.log('Native database reset successfully');
    } catch (err) {
      console.error('Native database reset error:', err);
      setError(err as Error);

      // Try to reconnect after failed reset
      try {
        const newClient = await createClient(baseURL, timeout);
        setDb(newClient);
        console.log('Reconnected to native API after reset failure');
      } catch (reconnectErr) {
        console.error('Failed to reconnect after reset failure:', reconnectErr);
        setError(reconnectErr as Error);
      }
    } finally {
      setLoading(false);
    }
  }, [db, baseURL, timeout]);

  return (
    <NativeDatabaseContext.Provider value={{ db, loading, error, execute, save, reset }}>
      {children}
    </NativeDatabaseContext.Provider>
  );
}

/**
 * Hook to access native database context
 * Identical interface to useDatabase() for drop-in replacement
 */
export function useNativeDatabase(): NativeDatabaseContextValue {
  const context = useContext(NativeDatabaseContext);
  if (!context) {
    throw new Error('useNativeDatabase must be used within NativeDatabaseProvider');
  }
  return context;
}

/**
 * Hook that provides the same interface as useDatabase() from DatabaseContext
 * Allows components to use either sql.js or native database transparently
 */
export function useDatabaseCompat(): {
  db: NativeAPIClient | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => T[] | Promise<T[]>;
  save: () => Promise<void>;
  reset: () => Promise<void>;
} {
  const { db, loading, error, execute, save, reset } = useNativeDatabase();

  // Wrapper to maintain interface compatibility - some components might expect sync execute
  const executeCompat = useCallback(<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> => {
    return execute<T>(sql, params);
  }, [execute]);

  return {
    db,
    loading,
    error,
    execute: executeCompat,
    save,
    reset,
  };
}

/**
 * Utility component to display connection status for debugging
 */
export function NativeDatabaseStatus() {
  const { db, loading, error } = useNativeDatabase();

  if (loading) {
    return <div className="text-sm text-gray-500">Connecting to native API...</div>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        Native API Error: {error.message}
      </div>
    );
  }

  if (db?.isConnected()) {
    return <div className="text-sm text-green-500">Native API Connected</div>;
  }

  return <div className="text-sm text-yellow-500">Native API Status Unknown</div>;
}