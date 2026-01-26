import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Database } from 'sql.js';
import { initDatabase, saveDatabase, resetDatabase } from './init';
import { NativeDatabaseProvider, useNativeDatabase, NativeDatabaseContextValue } from './NativeDatabaseContext';
import { WebViewDatabaseProvider, useWebViewDatabase } from './WebViewDatabaseContext';
import { performanceMonitor, logPerformanceReport } from './PerformanceMonitor';
import { DatabaseMode, useEnvironment } from '../contexts/EnvironmentContext';

interface DatabaseContextValue {
  db: Database | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => T[];
  save: () => Promise<void>;
  reset: () => Promise<void>;
}

// Union type for unified database context (currently unused but may be needed for future type checking)
// type UnifiedDatabaseContextValue = DatabaseContextValue | NativeDatabaseContextValue;

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// SQL.js Database Provider (original implementation)
function SQLJSDatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    initDatabase()
      .then(setDb)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  
  const execute = useCallback(<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): T[] => {
    if (!db) throw new Error('Database not initialized');

    const startTime = performance.now();

    try {
      const result = db.exec(sql, params);
      if (result.length === 0) {
        const duration = performance.now() - startTime;
        performanceMonitor.logQueryPerformance(sql, duration, 'sql.js', {
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
      performanceMonitor.logQueryPerformance(sql, duration, 'sql.js', {
        rowCount: resultData.length,
        success: true
      });

      return resultData;
    } catch (err) {
      const duration = performance.now() - startTime;
      performanceMonitor.logQueryPerformance(sql, duration, 'sql.js', {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      });
      console.error('SQL Error:', sql, params, err);
      throw err;
    }
  }, [db]);
  
  const save = useCallback(async () => {
    await saveDatabase();
  }, []);
  
  const reset = useCallback(async () => {
    setLoading(true);
    try {
      const newDb = await resetDatabase();
      setDb(newDb);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  return (
    <DatabaseContext.Provider value={{ db, loading, error, execute, save, reset }}>
      {children}
    </DatabaseContext.Provider>
  );
}

// Original sql.js useDatabase hook for internal use
function useSQLJSDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useSQLJSDatabase must be used within SQLJSDatabaseProvider');
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
      console.log('Using SQL.js Database (fallback)');
      return (
        <SQLJSDatabaseProvider>
          {children}
        </SQLJSDatabaseProvider>
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
      return useSQLJSDatabase();
  }
}
