import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { NativeDatabaseProvider, useNativeDatabase, NativeDatabaseContextValue } from './NativeDatabaseContext';
import { WebViewDatabaseProvider, useWebViewDatabase } from './WebViewDatabaseContext';
import { performanceMonitor, logPerformanceReport } from './PerformanceMonitor';
import { DatabaseMode, useEnvironment } from '../contexts/EnvironmentContext';
import { nativeAPI } from './NativeAPIClient';

// Legacy interface for backward compatibility during migration
interface LegacyDatabase {
  exec(sql: string, params?: unknown[]): Array<{ columns: string[]; values: unknown[][] }>;
}

interface DatabaseContextValue {
  db: LegacyDatabase | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => T[];
  save: () => Promise<void>;
  reset: () => Promise<void>;
}

// Union type for unified database context (currently unused but may be needed for future type checking)
// type UnifiedDatabaseContextValue = DatabaseContextValue | NativeDatabaseContextValue;

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// DEPRECATED: SQL.js Database Provider (removed - migration to native completed)
// This provider has been replaced by native database providers

// Legacy compatibility provider - redirects to native API
function LegacyCompatibilityProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<LegacyDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        // Connect to native API
        const isNativeAvailable = await nativeAPI.checkAvailability();

        if (isNativeAvailable) {
          console.log('✅ Connected to native API server');
          const nativeDb = nativeAPI.createCompatibleDatabase();
          setDb(nativeDb);
        } else {
          throw new Error('Native API not available and sql.js fallback removed');
        }
      } catch (err) {
        console.error('Database initialization failed:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    initializeDatabase();
  }, []);

  const execute = useCallback(<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): T[] => {
    if (!db) throw new Error('Database not initialized');

    const startTime = performance.now();
    const provider = 'native-api';

    try {
      const result = db.exec(sql, params);
      if (result.length === 0) {
        const duration = performance.now() - startTime;
        performanceMonitor.logQueryPerformance(sql, duration, provider, {
          rowCount: 0,
          success: true
        });
        return [];
      }

      const { columns, values } = result[0];
      const resultData = values.map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj as T;
      });

      const duration = performance.now() - startTime;
      performanceMonitor.logQueryPerformance(sql, duration, provider, {
        rowCount: resultData.length,
        success: true,
        nativeAPI: true
      });

      return resultData;
    } catch (err) {
      const duration = performance.now() - startTime;
      performanceMonitor.logQueryPerformance(sql, duration, provider, {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        nativeAPI: true
      });
      console.error('SQL Error:', sql, params, err);
      throw err;
    }
  }, [db]);

  const save = useCallback(async () => {
    // Native API handles persistence automatically
    console.log('Native API: Auto-saved');
  }, []);

  const reset = useCallback(async () => {
    setLoading(true);
    try {
      // Database reset must be done through native provider
      throw new Error('Database reset not supported in legacy compatibility mode');
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <DatabaseContext.Provider value={{
      db,
      loading,
      error,
      execute,
      save,
      reset
    }}>
      {children}
    </DatabaseContext.Provider>
  );
}

// Legacy database hook for compatibility mode
function useLegacyDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useLegacyDatabase must be used within LegacyCompatibilityProvider');
  }
  return context;
}

/**
 * Smart Database Provider that uses EnvironmentContext for provider selection
 */
function SmartDatabaseProvider({ children }: { children: React.ReactNode }) {
  const { environment, isLoading } = useEnvironment();

  // Set up development performance reporting
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Log performance reports every 30 seconds
      const interval = setInterval(() => {
        logPerformanceReport();
      }, 30000);

      // Clean up on unmount
      return () => clearInterval(interval);
    }
  }, []);

  // Show loading state while environment is being detected
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600">Detecting database environment...</p>
        </div>
      </div>
    );
  }

  switch (environment.mode) {
    case DatabaseMode.WEBVIEW_BRIDGE:
      console.log('Using WebView Database Bridge (auto-detected)');
      return (
        <WebViewDatabaseProvider>
          {children}
        </WebViewDatabaseProvider>
      );

    case DatabaseMode.HTTP_API:
      console.log('Using Native Database API (auto-detected)');
      return (
        <NativeDatabaseProvider>
          {children}
        </NativeDatabaseProvider>
      );

    case DatabaseMode.SQLJS:
    default:
      // Legacy compatibility mode - native API only (sql.js removed)
      console.log('Using Legacy Compatibility Provider (native API only)');
      return (
        <LegacyCompatibilityProvider>
          {children}
        </LegacyCompatibilityProvider>
      );
  }
}

/**
 * Unified Database Provider with automatic environment detection
 * Now uses EnvironmentContext for intelligent provider selection
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <SmartDatabaseProvider>
      {children}
    </SmartDatabaseProvider>
  );
}

/**
 * Unified database hook that works with all database contexts
 * Uses EnvironmentContext to determine the appropriate provider
 */
export function useDatabase(): DatabaseContextValue | NativeDatabaseContextValue {
  const { environment } = useEnvironment();

  switch (environment.mode) {
    case DatabaseMode.WEBVIEW_BRIDGE:
      return useWebViewDatabase();

    case DatabaseMode.HTTP_API:
      return useNativeDatabase();

    case DatabaseMode.SQLJS:
    default:
      return useLegacyDatabase();
  }
}
