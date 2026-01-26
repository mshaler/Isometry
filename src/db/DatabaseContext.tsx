import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Database } from 'sql.js';
import { initDatabase, saveDatabase, resetDatabase } from './init';
import { NativeDatabaseProvider, useNativeDatabase, NativeDatabaseContextValue } from './NativeDatabaseContext';
import { performanceMonitor, logPerformanceReport } from './PerformanceMonitor';

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
 * Environment variable detection for API selection
 * REACT_APP_USE_NATIVE_API=true enables native API mode
 * REACT_APP_USE_NATIVE_API=false or undefined uses sql.js mode
 */
const USE_NATIVE_API = process.env.REACT_APP_USE_NATIVE_API === 'true';

/**
 * Unified Database Provider that conditionally renders sql.js or native provider
 * Based on REACT_APP_USE_NATIVE_API environment variable
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
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

  if (USE_NATIVE_API) {
    console.log('Using Native Database API (REACT_APP_USE_NATIVE_API=true)');
    return (
      <NativeDatabaseProvider>
        {children}
      </NativeDatabaseProvider>
    );
  } else {
    console.log('Using SQL.js Database (REACT_APP_USE_NATIVE_API=false or undefined)');
    return (
      <SQLJSDatabaseProvider>
        {children}
      </SQLJSDatabaseProvider>
    );
  }
}

/**
 * Unified database hook that works with both sql.js and native contexts
 * Automatically detects current provider and returns appropriate interface
 */
export function useDatabase(): DatabaseContextValue | NativeDatabaseContextValue {
  if (USE_NATIVE_API) {
    // When using native API, return the native context
    return useNativeDatabase();
  } else {
    // When using sql.js, return the sql.js context
    return useSQLJSDatabase();
  }
}
