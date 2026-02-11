import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import type { SQLiteCapabilityError } from './types';
import { devLogger } from '../utils/dev-logger';
import { IndexedDBPersistence, AutoSaveManager } from './IndexedDBPersistence';
import { createDatabaseOperations } from './operations';
import { testDatabaseCapabilities, type DatabaseCapabilities } from './capabilities';
import { createPersistenceOperations } from './persistence';

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

/** FTS5 performance test result */
export interface FTS5PerformanceResult {
  results: number;
  timeMs: number;
  usedFallback: boolean;
}

/** Storage quota information for UI display */
export interface StorageQuotaState {
  used: number;
  quota: number;
  percentUsed: number;
  warning: boolean;
}

export interface SQLiteContextValue {
  db: Database | null;
  loading: boolean;
  error: Error | null;
  execute: (sql: string, params?: unknown[]) => Record<string, unknown>[];
  run: (sql: string, params?: unknown[]) => void;
  save: () => Promise<void>;
  reset: () => Promise<void>;
  loadFromFile: (file: ArrayBuffer) => Promise<void>;
  capabilities: DatabaseCapabilities;
  telemetry: SQLiteCapabilityError[];
  /** Version counter that increments when data changes - use to trigger query refetches */
  dataVersion: number;
  /** Storage quota state for UI warnings */
  storageQuota: StorageQuotaState | null;
  /** Test FTS5 performance with realistic query */
  testFTS5Performance: () => Promise<FTS5PerformanceResult>;
}

const SQLiteContext = createContext<SQLiteContextValue | null>(null);

interface SQLiteProviderProps {
  children: React.ReactNode;
  databaseUrl?: string;
  enableLogging?: boolean;
}

export function SQLiteProvider({
  children,
  databaseUrl = '/isometry.db',
  enableLogging = true
}: SQLiteProviderProps) {
  const [SQL, setSQL] = useState<SqlJsStatic | null>(null);
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [capabilities, setCapabilities] = useState<DatabaseCapabilities>({
    fts5: false,
    json1: false,
    recursiveCte: false
  });
  const [telemetry, setTelemetry] = useState<SQLiteCapabilityError[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [storageQuota, setStorageQuota] = useState<StorageQuotaState | null>(null);

  // Persistence refs
  const persistenceRef = useRef<IndexedDBPersistence | null>(null);
  const autoSaveRef = useRef<AutoSaveManager | null>(null);

  // Create database operations
  const { execute, run } = createDatabaseOperations(db, setDataVersion);

  // Create persistence operations
  const { save, reset, loadFromFile } = createPersistenceOperations(
    db,
    SQL,
    setDb,
    setDataVersion,
    persistenceRef,
    autoSaveRef,
    enableLogging
  );

  // Initialize database
  useEffect(() => {
    const initDatabase = async () => {
      try {
        if (enableLogging) {
          devLogger.setup('SQLiteProvider: Starting initialization', {});
        }

        // Initialize sql.js
        const sqlInstance = await initSqlJs({
          locateFile: (file: string) => `/wasm/${file}`
        });
        setSQL(sqlInstance);

        // Initialize persistence
        // NOTE: IndexedDBPersistence uses hardcoded name 'isometry-db' (see IndexedDBPersistence.ts)
        persistenceRef.current = new IndexedDBPersistence();

        // Try to load existing database
        const persistence = persistenceRef.current!;
        try {
          const savedData = await persistence.load();
          if (savedData) {
            const database = new sqlInstance.Database(savedData);
            setDb(database);

            // Test capabilities
            const { capabilities: dbCapabilities, telemetryErrors } = testDatabaseCapabilities(database);
            setCapabilities(dbCapabilities);
            setTelemetry(telemetryErrors);

            // Start auto-save
            autoSaveRef.current = new AutoSaveManager(persistence);

            if (enableLogging) {
              devLogger.setup('Database loaded from IndexedDB', {
                sizeBytes: savedData.length,
                capabilities: dbCapabilities
              });
            }
          } else {
            // No saved database, create fresh one or load from URL
            let database: Database;
            try {
              const response = await fetch(databaseUrl);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                database = new sqlInstance.Database(new Uint8Array(arrayBuffer));
                await persistence.save(new Uint8Array(arrayBuffer));

                if (enableLogging) {
                  devLogger.setup('Database loaded from URL and saved', {
                    url: databaseUrl,
                    sizeBytes: arrayBuffer.byteLength
                  });
                }
              } else {
                throw new Error(`Failed to fetch database: ${response.status}`);
              }
            } catch (fetchError) {
              // Fall back to empty database
              database = new sqlInstance.Database();

              // Try to load schema
              try {
                const schemaResponse = await fetch('/schema.sql');
                if (schemaResponse.ok) {
                  const schema = await schemaResponse.text();
                  database.exec(schema);
                  if (enableLogging) {
                    devLogger.setup('Empty database created with schema', {});
                  }
                }
              } catch (schemaError) {
                if (enableLogging) {
                  devLogger.warn('Schema file not found, created empty database');
                }
              }
            }

            setDb(database);

            // Test capabilities
            const { capabilities: dbCapabilities, telemetryErrors } = testDatabaseCapabilities(database);
            setCapabilities(dbCapabilities);
            setTelemetry(telemetryErrors);

            // Start auto-save
            autoSaveRef.current = new AutoSaveManager(persistence);
          }
        } catch (persistenceError) {
          devLogger.error('Persistence error, falling back to memory-only database', persistenceError);
          const database = new sqlInstance.Database();

          // Load schema for memory-only database
          try {
            const schemaResponse = await fetch('/schema.sql');
            if (schemaResponse.ok) {
              const schema = await schemaResponse.text();
              database.exec(schema);
              if (enableLogging) {
                devLogger.setup('Schema loaded for memory-only database', {});
              }
            }
          } catch (schemaError) {
            if (enableLogging) {
              devLogger.warn('Schema file not found for memory-only database');
            }
          }

          setDb(database);

          const { capabilities: dbCapabilities, telemetryErrors } = testDatabaseCapabilities(database);
          setCapabilities(dbCapabilities);
          setTelemetry(telemetryErrors);
        }

        // Check storage quota
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          if (estimate.usage !== undefined && estimate.quota !== undefined) {
            const percentUsed = (estimate.usage / estimate.quota) * 100;
            setStorageQuota({
              used: estimate.usage,
              quota: estimate.quota,
              percentUsed,
              warning: percentUsed > 80
            });
          }
        }

        setLoading(false);

        if (enableLogging) {
          devLogger.setup('SQLiteProvider initialization complete', {});
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        setError(errorObj);
        setLoading(false);
        devLogger.error('SQLiteProvider initialization failed', errorObj);
      }
    };

    initDatabase();

    // Cleanup
    return () => {
      if (autoSaveRef.current) {
        autoSaveRef.current.cleanup();
      }
      if (db) {
        db.close();
      }
    };
  }, [databaseUrl, enableLogging]);

  // Test FTS5 performance
  const testFTS5Performance = async (): Promise<FTS5PerformanceResult> => {
    if (!db || !capabilities.fts5) {
      return { results: 0, timeMs: 0, usedFallback: true };
    }

    try {
      const start = performance.now();
      const results = execute("SELECT COUNT(*) as count FROM nodes_fts WHERE nodes_fts MATCH 'test'");
      const timeMs = performance.now() - start;

      return {
        results: results[0]?.count as number || 0,
        timeMs,
        usedFallback: false
      };
    } catch (error) {
      devLogger.warn('FTS5 performance test failed', error);
      return { results: 0, timeMs: 0, usedFallback: true };
    }
  };

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
    storageQuota,
    testFTS5Performance
  };

  return (
    <SQLiteContext.Provider value={contextValue}>
      {children}
    </SQLiteContext.Provider>
  );
}

export function useSQLite(): SQLiteContextValue {
  const context = useContext(SQLiteContext);
  if (!context) {
    throw new Error('useSQLite must be used within a SQLiteProvider');
  }
  return context;
}

export { SQLiteContext };