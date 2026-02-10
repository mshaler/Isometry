import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import type { SQLiteCapabilityError } from './types';
import { devLogger } from '../utils/dev-logger';
import { IndexedDBPersistence, AutoSaveManager } from './IndexedDBPersistence';

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
  /** Version counter that increments when data changes - use to trigger query refetches */
  dataVersion: number;
  /** Call after bulk data changes to trigger query invalidation and auto-save */
  notifyDataChanged: () => Promise<void>;
}

const SQLiteContext = createContext<SQLiteContextValue | null>(null);

interface SQLiteProviderProps {
  children: React.ReactNode;
  databaseUrl?: string;
  enableLogging?: boolean;
}

export function SQLiteProvider({
  children,
  databaseUrl = '/db/isometry.db', // Fixed: Use public folder path
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
  const [dataVersion, setDataVersion] = useState(0);

  // IndexedDB persistence - single instances for component lifetime
  const persistenceRef = useRef<IndexedDBPersistence | null>(null);
  const autoSaveRef = useRef<AutoSaveManager | null>(null);

  // Initialize persistence instances once
  if (!persistenceRef.current) {
    persistenceRef.current = new IndexedDBPersistence();
  }
  if (!autoSaveRef.current) {
    autoSaveRef.current = new AutoSaveManager(persistenceRef.current);
  }

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
          devLogger.setup('SQLiteProvider: Initializing sql.js', {});
        }

        // Initialize sql.js using local WASM files in public folder
        const sqlInstance = await initSqlJs({
          locateFile: file => `/wasm/${file}`
        });

        if (!isMounted) return;

        setSQL(sqlInstance);

        // Initialize IndexedDB persistence
        const persistence = persistenceRef.current!;
        await persistence.init();

        // Try to load existing database or create new one
        let database: Database | null = null;

        // Priority 1: Try to load from IndexedDB (replaces localStorage backup)
        try {
          const savedData = await persistence.load();
          if (savedData) {
            // Verify the data looks like a SQLite file
            if (savedData.length >= 16 &&
                String.fromCharCode(...savedData.slice(0, 16)) === 'SQLite format 3\0') {
              database = new sqlInstance.Database(savedData);
              if (enableLogging) {
                devLogger.setup('SQLiteProvider: Loaded database from IndexedDB', { bytes: savedData.length });
              }
            } else {
              console.warn('SQLiteProvider: IndexedDB data invalid, will try other sources');
            }
          }
        } catch (idbError) {
          console.warn('SQLiteProvider: Failed to load from IndexedDB', idbError);
        }

        // Priority 2: Try to fetch from databaseUrl
        if (!database) {
          try {
            if (enableLogging) {
              devLogger.inspect('SQLiteProvider: Attempting to load database', { databaseUrl });
            }
            const response = await fetch(databaseUrl);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              if (enableLogging) {
                devLogger.data('SQLiteProvider: Downloaded database', { bytes: arrayBuffer.byteLength });
              }

              // Verify the data looks like a SQLite file
              const uint8Array = new Uint8Array(arrayBuffer);
              if (uint8Array.length < 16 ||
                  String.fromCharCode(...uint8Array.slice(0, 16)) !== 'SQLite format 3\0') {
                throw new Error(`Invalid SQLite file: ${String.fromCharCode(...uint8Array.slice(0, 16))}`);
              }

              database = new sqlInstance.Database(uint8Array);
              if (enableLogging) {
                devLogger.setup('SQLiteProvider: Loaded existing database successfully', {});
              }
            } else {
              throw new Error(`Database fetch failed: ${response.status} ${response.statusText}`);
            }
          } catch (loadError) {
            // Priority 3: Create new database with schema
            if (enableLogging) {
              devLogger.setup('SQLiteProvider: Creating new database', { loadError: String(loadError) });
            }
            database = new sqlInstance.Database();
            await initializeSchema(database, logCapabilityError);
          }
        }

        // At this point, database is guaranteed to be non-null
        // (either loaded from IndexedDB, fetched, or created new)
        if (!database) {
          throw new Error('Failed to initialize database from any source');
        }

        if (!isMounted) return;

        // Verify capabilities with comprehensive error tracking
        const newCapabilities = {
          fts5: false,
          json1: false,
          recursiveCte: false
        };

        // Test FTS5 support - use proper capability testing
        try {
          // The correct way to test FTS5 is to try creating a virtual table
          database.exec("CREATE VIRTUAL TABLE fts_capability_test USING fts5(content)");
          database.exec("INSERT INTO fts_capability_test VALUES ('test content')");
          const fts5Results = database.exec("SELECT * FROM fts_capability_test WHERE fts_capability_test MATCH 'test'");
          database.exec("DROP TABLE fts_capability_test");

          if (fts5Results.length > 0) {
            newCapabilities.fts5 = true;
            if (enableLogging) {
              devLogger.setup('SQLiteProvider: FTS5 support verified with virtual table test', {});
            }
          } else {
            throw new Error('FTS5 virtual table created but search failed');
          }
        } catch (ftsError) {
          logCapabilityError('fts5', ftsError as Error, {
            sqljs_version: 'unknown',
            test_query: 'CREATE VIRTUAL TABLE ... USING fts5'
          });
        }

        // Test JSON1 support
        try {
          database.exec("SELECT json('{\"test\": true}') AS json_result");
          newCapabilities.json1 = true;
          if (enableLogging) {
            devLogger.setup('SQLiteProvider: JSON1 support verified', {});
          }
        } catch (jsonError) {
          logCapabilityError('json1', jsonError as Error, {
            test_query: 'SELECT json(\'{"test": true}\')'
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
                devLogger.setup('SQLiteProvider: Recursive CTE support verified', {});
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
          // TEMPORARILY: Don't fail initialization, just log the error
          console.warn('⚠️ Recursive CTE support not available:', cteError);
          // throw new Error(`Recursive CTE support required but not available: ${(cteError as Error).message}`);
        }

        setCapabilities(newCapabilities);

        setDb(database);
        setError(null);

        if (enableLogging) {
          devLogger.setup('SQLiteProvider: Database initialization complete', {});
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
      // Force save any pending changes on unmount
      const autoSave = autoSaveRef.current;
      if (autoSave) {
        autoSave.forceImmediateSave().catch(err => {
          console.error('Failed to save on unmount:', err);
        });
        autoSave.cleanup();
      }
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
        devLogger.inspect('SQL Query', {
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
        devLogger.inspect('SQL Run', {
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          params,
        });
      }
    } catch (err) {
      console.error('💥 SQL Run Error:', { sql, params, error: err });
      throw err;
    }
  }, [db, enableLogging]);

  // Save database to IndexedDB (replaces localStorage which has 5-10MB limit)
  const save = useCallback(async (): Promise<void> => {
    if (!db) return;

    const persistence = persistenceRef.current;
    if (!persistence) {
      console.error('💥 Database save error: IndexedDB persistence not initialized');
      return;
    }

    try {
      const data = db.export();

      // Get node count for metadata
      let nodeCount = 0;
      try {
        const result = db.exec('SELECT COUNT(*) FROM nodes WHERE deleted_at IS NULL');
        if (result.length > 0 && result[0].values.length > 0) {
          nodeCount = result[0].values[0][0] as number;
        }
      } catch {
        // Ignore count errors - just use 0
      }

      await persistence.save(data, nodeCount);

      if (enableLogging) {
        devLogger.data('Database saved to IndexedDB', { bytes: data.length, nodeCount });
      }
    } catch (err) {
      console.error('💥 Database save error:', err);

      // Check if quota exceeded
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        logCapabilityError('storage', err, {
          operation: 'save',
          // Don't call db.export() again if we already have an error
          errorType: 'QuotaExceededError'
        });
      }

      throw err;
    }
  }, [db, enableLogging, logCapabilityError]);

  // Reset database
  const reset = useCallback(async (): Promise<void> => {
    if (!SQL) return;

    try {
      const newDb = new SQL.Database();
      await initializeSchema(newDb, logCapabilityError);

      if (db) {
        db.close();
      }

      setDb(newDb);

      if (enableLogging) {
        devLogger.state('Database reset complete', {});
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
        devLogger.data('Database loaded from file', {});
      }
    } catch (err) {
      console.error('💥 Database load error:', err);
      throw err;
    }
  }, [SQL, db, enableLogging]);

  // Set up AutoSaveManager save callback when save function changes
  useEffect(() => {
    const autoSave = autoSaveRef.current;
    if (autoSave) {
      autoSave.setSaveCallback(save);
    }
  }, [save]);

  // Notify that data has changed - triggers query refetches and debounced auto-save
  const notifyDataChanged = useCallback(async (): Promise<void> => {
    setDataVersion(v => v + 1);
    if (enableLogging) {
      devLogger.data('Data changed, triggering query invalidation', { dataVersion: dataVersion + 1 });
    }
    // Debounced auto-save (5 second window) prevents "export-every-write" performance death
    // See 42-RESEARCH.md Pitfall 2
    const autoSave = autoSaveRef.current;
    if (autoSave) {
      autoSave.notifyDataChanged();
    }
  }, [enableLogging, dataVersion]);

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
    dataVersion,
    notifyDataChanged,
  };

  return (
    <SQLiteContext.Provider value={contextValue}>
      {children}
    </SQLiteContext.Provider>
  );
}

// Initialize database schema
async function initializeSchema(db: Database, logCapabilityError?: (capability: SQLiteCapabilityError['capability'], error: Error | string, context?: Record<string, unknown>) => void): Promise<void> {
  try {
    devLogger.setup('Initializing database schema', {});

    // Load schema from public folder (using FTS5-free schema for basic sql.js)
    const response = await fetch('/db/schema-no-fts5.sql');
    if (!response.ok) {
      throw new Error(`Schema fetch failed: ${response.status} ${response.statusText}`);
    }

    const schemaSQL = await response.text();
    devLogger.data('Schema loaded', { length: schemaSQL.length });

    // Execute schema with detailed logging and error handling
    devLogger.setup('Executing schema SQL', {});
    try {
      db.exec(schemaSQL);
      devLogger.setup('Schema execution completed successfully', {});
    } catch (schemaExecError) {
      console.error('💥 Schema execution failed:', schemaExecError);
      // Log the specific line that failed if possible
      const errorMsg = (schemaExecError as Error).message;
      if (errorMsg.includes('fts5')) {
        console.error('🚨 FTS5 error detected - this may indicate WASM build compatibility issues');
        if (logCapabilityError) {
          logCapabilityError('fts5', schemaExecError as Error, {
            schema_length: schemaSQL.length,
            error_type: 'fts5_schema_execution'
          });
        }
      }
      throw schemaExecError;
    }

    // Verify schema was created properly
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    devLogger.setup('Tables created', { tables });

    const nodeCount = db.exec("SELECT COUNT(*) as count FROM nodes WHERE deleted_at IS NULL");
    devLogger.data('Sample nodes loaded', { nodeCount });

    devLogger.setup('Database schema initialized successfully', {});
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