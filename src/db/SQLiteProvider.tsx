import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import type { SQLiteCapabilityError } from './types';

/**
 * SQLiteProvider - Direct sql.js access for Isometry v4
 *
 * This replaces the 40KB MessageBridge with direct SQLite access in the browser.
 * Features:
 * - FTS5 full-text search
 * - JSON1 extension for JSON operations
 * - Recursive CTEs for graph traversal
 * - Synchronous queries (no promises, no callbacks)
 * - Direct D3.js data binding
 */

export interface SQLiteContextValue {
  db: Database | null;
  loading: boolean;
  error: Error | null;
  execute: (sql: string, params?: unknown[]) => Record<string, unknown>[];
  run: (sql: string, params?: unknown[]) => void;
  save: () => Promise<void>;
  reset: () => Promise<void>;
  loadFromFile: (file: ArrayBuffer) => Promise<void>;
  capabilities: {
    fts5: boolean;
    json1: boolean;
    recursiveCte: boolean;
  };
  telemetry: SQLiteCapabilityError[];
}

const SQLiteContext = createContext<SQLiteContextValue | null>(null);

interface SQLiteProviderProps {
  children: React.ReactNode;
  databaseUrl?: string;
  enableLogging?: boolean;
}

export function SQLiteProvider({
  children,
  databaseUrl = '/src/db/isometry.db',
  enableLogging = import.meta.env.DEV
}: SQLiteProviderProps) {
  const [SQL, setSQL] = useState<SqlJsStatic | null>(null);
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [capabilities, setCapabilities] = useState({
    fts5: false,
    json1: false,
    recursiveCte: false
  });
  const [telemetry, setTelemetry] = useState<SQLiteCapabilityError[]>([]);

  // Telemetry logging helper
  const logCapabilityError = useCallback((
    capability: SQLiteCapabilityError['capability'],
    error: Error | string,
    context: Record<string, unknown> = {}
  ) => {
    const telemetryError: SQLiteCapabilityError = {
      capability,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      context,
      stackTrace: error instanceof Error ? error.stack : undefined,
      browserInfo: {
        userAgent: navigator.userAgent,
        vendor: navigator.vendor,
        platform: navigator.platform
      }
    };

    setTelemetry(prev => [...prev, telemetryError]);
    console.error(`🚨 SQLite Capability Error [${capability}]:`, telemetryError);
  }, []);

  // Initialize sql.js
  useEffect(() => {
    let isMounted = true;

    const initDatabase = async () => {
      try {
        if (enableLogging) {
          console.log('🔧 SQLiteProvider: Initializing sql.js...');
        }

        // Initialize sql.js with WASM
        const sqlInstance = await initSqlJs({
          // Use CDN for sql.js WASM file with FTS5 support
          locateFile: (file: string) => `https://sql.js.org/dist/${file}`
        });

        if (!isMounted) return;

        setSQL(sqlInstance);

        // Try to load existing database or create new one
        let database: Database;

        try {
          // Try to load existing database file
          const response = await fetch(databaseUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            database = new sqlInstance.Database(new Uint8Array(arrayBuffer));
            if (enableLogging) {
              console.log('✅ SQLiteProvider: Loaded existing database');
            }
          } else {
            throw new Error('No existing database found');
          }
        } catch (loadError) {
          // Create new database with schema
          if (enableLogging) {
            console.log('📝 SQLiteProvider: Creating new database with schema');
          }
          database = new sqlInstance.Database();
          await initializeSchema(database);
        }

        if (!isMounted) return;

        // Verify capabilities with comprehensive error tracking
        const newCapabilities = {
          fts5: false,
          json1: false,
          recursiveCte: false
        };

        // Test FTS5 support
        try {
          database.exec("SELECT fts5_version() AS version");
          newCapabilities.fts5 = true;
          if (enableLogging) {
            console.log('✅ SQLiteProvider: FTS5 support verified');
          }
        } catch (ftsError) {
          logCapabilityError('fts5', ftsError as Error, {
            sqljs_version: 'unknown',
            test_query: 'SELECT fts5_version()'
          });
        }

        // Test JSON1 support
        try {
          database.exec("SELECT json('{\"test\": true}') AS json_result");
          newCapabilities.json1 = true;
          if (enableLogging) {
            console.log('✅ SQLiteProvider: JSON1 support verified');
          }
        } catch (jsonError) {
          logCapabilityError('json1', jsonError as Error, {
            test_query: 'SELECT json(\'{\"test\": true}\')'
          });
        }

        // Test recursive CTE support (required for graph traversal)
        try {
          const result = database.exec(`
            WITH RECURSIVE test_cte(n) AS (
              SELECT 1
              UNION ALL
              SELECT n+1 FROM test_cte WHERE n < 3
            )
            SELECT COUNT(*) as count FROM test_cte
          `);

          if (result.length > 0 && result[0].values.length > 0) {
            const count = result[0].values[0][0] as number;
            if (count === 3) {
              newCapabilities.recursiveCte = true;
              if (enableLogging) {
                console.log('✅ SQLiteProvider: Recursive CTE support verified');
              }
            } else {
              throw new Error(`CTE returned incorrect result: ${count}, expected 3`);
            }
          } else {
            throw new Error('CTE test returned empty result');
          }
        } catch (cteError) {
          logCapabilityError('recursive_cte', cteError as Error, {
            test_query: 'WITH RECURSIVE test_cte... SELECT COUNT(*)',
            critical: true
          });
          throw new Error(`Recursive CTE support required but not available: ${(cteError as Error).message}`);
        }

        setCapabilities(newCapabilities);

        setDb(database);
        setError(null);

        if (enableLogging) {
          console.log('🚀 SQLiteProvider: Database initialization complete');
        }

      } catch (err) {
        console.error('💥 SQLiteProvider: Initialization failed:', err);
        if (isMounted) {
          setError(err as Error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initDatabase();

    return () => {
      isMounted = false;
    };
  }, [databaseUrl, enableLogging]);

  // Synchronous execute function - core CLAUDE.md requirement
  const execute = useCallback((sql: string, params: unknown[] = []): Record<string, unknown>[] => {
    if (!db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = db.prepare(sql);
      const results: Record<string, unknown>[] = [];

      if (params.length > 0) {
        // Type assertion with validation for sql.js compatibility
        const sqlParams = params.map(p => {
          if (p === null || p === undefined) return null;
          if (typeof p === 'string' || typeof p === 'number' || typeof p === 'boolean') return p;
          if (p instanceof Uint8Array || p instanceof ArrayBuffer) return p;
          // Convert complex types to string for SQLite compatibility
          return String(p);
        });
        stmt.bind(sqlParams as any);
      }

      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(row);
      }

      stmt.free();

      if (enableLogging && import.meta.env.DEV) {
        console.log('🔍 SQL Query:', {
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          params,
          resultCount: results.length,
        });
      }

      return results;
    } catch (err) {
      console.error('💥 SQL Execution Error:', { sql, params, error: err });
      throw err;
    }
  }, [db, enableLogging]);

  // Synchronous run function for INSERT/UPDATE/DELETE
  const run = useCallback((sql: string, params: unknown[] = []): void => {
    if (!db) {
      throw new Error('Database not initialized');
    }

    try {
      if (params.length > 0) {
        // Type assertion with validation for sql.js compatibility
        const sqlParams = params.map(p => {
          if (p === null || p === undefined) return null;
          if (typeof p === 'string' || typeof p === 'number' || typeof p === 'boolean') return p;
          if (p instanceof Uint8Array || p instanceof ArrayBuffer) return p;
          // Convert complex types to string for SQLite compatibility
          return String(p);
        });
        db.run(sql, sqlParams as any);
      } else {
        db.exec(sql);
      }

      if (enableLogging && import.meta.env.DEV) {
        console.log('🔧 SQL Run:', {
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          params,
        });
      }
    } catch (err) {
      console.error('💥 SQL Run Error:', { sql, params, error: err });
      throw err;
    }
  }, [db, enableLogging]);

  // Save database to file (debounced in production)
  const save = useCallback(async (): Promise<void> => {
    if (!db) return;

    try {
      const data = db.export();
      // Type assertion for ArrayBuffer compatibility with Blob constructor
      const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });

      // In a real app, this would save to the file system
      // For now, we'll store in localStorage as backup
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          localStorage.setItem('isometry-db-backup', reader.result);
          if (enableLogging) {
            console.log('💾 Database saved to localStorage backup');
          }
        }
      };
      reader.readAsDataURL(blob);

    } catch (err) {
      console.error('💥 Database save error:', err);
      throw err;
    }
  }, [db, enableLogging]);

  // Reset database
  const reset = useCallback(async (): Promise<void> => {
    if (!SQL) return;

    try {
      const newDb = new SQL.Database();
      await initializeSchema(newDb);

      if (db) {
        db.close();
      }

      setDb(newDb);

      if (enableLogging) {
        console.log('🔄 Database reset complete');
      }
    } catch (err) {
      console.error('💥 Database reset error:', err);
      throw err;
    }
  }, [SQL, db, enableLogging]);

  // Load database from file
  const loadFromFile = useCallback(async (file: ArrayBuffer): Promise<void> => {
    if (!SQL) {
      throw new Error('SQL.js not initialized');
    }

    try {
      const newDb = new SQL.Database(new Uint8Array(file));

      if (db) {
        db.close();
      }

      setDb(newDb);

      if (enableLogging) {
        console.log('📂 Database loaded from file');
      }
    } catch (err) {
      console.error('💥 Database load error:', err);
      throw err;
    }
  }, [SQL, db, enableLogging]);

  const contextValue: SQLiteContextValue = {
    db,
    loading,
    error,
    execute,
    run,
    save,
    reset,
    loadFromFile,
    capabilities,
    telemetry,
  };

  return (
    <SQLiteContext.Provider value={contextValue}>
      {children}
    </SQLiteContext.Provider>
  );
}

// Initialize database schema
async function initializeSchema(db: Database): Promise<void> {
  try {
    // Load schema from public folder
    const response = await fetch('/db/schema.sql');
    const schemaSQL = await response.text();

    db.exec(schemaSQL);

    console.log('✅ Database schema initialized');
  } catch (err) {
    console.error('💥 Schema initialization failed:', err);
    throw err;
  }
}

// Hook to access SQLite context
export function useSQLite(): SQLiteContextValue {
  const context = useContext(SQLiteContext);

  if (!context) {
    throw new Error('useSQLite must be used within a SQLiteProvider');
  }

  return context;
}

// Convenience hooks matching CLAUDE.md patterns
export function useSQLiteQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): { data: T[]; loading: boolean; error: Error | null } {
  const { execute, loading, error } = useSQLite();
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    if (loading || error) return;

    try {
      const results = execute(sql, params) as T[];
      setData(results);
    } catch (err) {
      console.error('Query error:', err);
      setData([]);
    }
  }, [execute, sql, JSON.stringify(params), loading, error]);

  return { data, loading, error };
}

export default SQLiteProvider;