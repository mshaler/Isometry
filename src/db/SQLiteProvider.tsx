import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import type { SQLiteCapabilityError } from './types';
import { devLogger } from '../utils/dev-logger';
import { useRenderLoopGuard } from '../hooks/debug/useRenderLoopGuard';
import { IndexedDBPersistence, AutoSaveManager } from './IndexedDBPersistence';
import { createDatabaseOperations } from './operations';
import { testDatabaseCapabilities, type DatabaseCapabilities } from './capabilities';
import { createPersistenceOperations } from './persistence';
import { SAMPLE_DATA_SQL } from './sample-data';

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
  // Render loop guard - warns if provider renders >10x/second (indicates infinite loop)
  useRenderLoopGuard({ componentName: 'SQLiteProvider' });

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

  // Create memoized database operations to prevent infinite re-renders
  // CRITICAL: Without useMemo, new function references are created on every render,
  // causing useSQLiteQuery consumers to re-fetch continuously (infinite loop)
  const { execute, run } = useMemo(
    () => createDatabaseOperations(db, setDataVersion),
    [db] // setDataVersion is stable from useState
  );

  // Create memoized persistence operations
  const { save, reset, loadFromFile } = useMemo(
    () => createPersistenceOperations(
      db,
      SQL,
      setDb,
      setDataVersion,
      persistenceRef,
      autoSaveRef,
      enableLogging
    ),
    [db, SQL, enableLogging] // setDb/setDataVersion stable from useState, refs stable
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

        // Initialize persistence (with fallback to memory-only if IndexedDB fails)
        // NOTE: IndexedDBPersistence uses hardcoded name 'isometry-db' (see IndexedDBPersistence.ts)
        let persistence: IndexedDBPersistence | null = null;
        try {
          persistenceRef.current = new IndexedDBPersistence();
          await persistenceRef.current.init();
          persistence = persistenceRef.current;
        } catch (persistenceInitError) {
          console.warn('[SQLiteProvider] IndexedDB init failed, using memory-only mode:', persistenceInitError);
          persistenceRef.current = null;
        }

        // Try to load existing database (if persistence available)
        let savedData: Uint8Array | null = null;
        if (persistence) {
          try {
            savedData = await persistence.load();
          } catch (loadError) {
            console.warn('[SQLiteProvider] Failed to load from IndexedDB:', loadError);
            savedData = null;
          }
        }

        let database: Database | null = null;

        if (savedData) {
          // Load from saved data
          try {
            database = new sqlInstance.Database(savedData);
            // Verify database is valid
            database.exec("SELECT 1");
          } catch (dbError) {
            // Corrupt database detected - clear and recreate
            console.error('[SQLiteProvider] Corrupt database detected, clearing IndexedDB');
            if (persistence) {
              try {
                await persistence.clear();
              } catch (clearError) {
                console.error('[SQLiteProvider] Failed to clear IndexedDB:', clearError);
              }
            }
            savedData = null;
            database = null;
          }
        }

        if (!database) {
          // No saved database, create fresh one or load from URL
          try {
            const response = await fetch(databaseUrl);
            const contentType = response.headers.get('content-type') || '';

            // Only try to load as database if it's actually a binary file, not HTML fallback
            if (response.ok && !contentType.includes('text/html')) {
              const arrayBuffer = await response.arrayBuffer();

              // Verify it's a valid SQLite file (starts with "SQLite format 3")
              const header = new Uint8Array(arrayBuffer.slice(0, 16));
              const headerStr = String.fromCharCode(...header);
              if (!headerStr.startsWith('SQLite format 3')) {
                throw new Error('Not a valid SQLite database file');
              }

              database = new sqlInstance.Database(new Uint8Array(arrayBuffer));
              if (persistence) {
                await persistence.save(new Uint8Array(arrayBuffer));
              }

              if (enableLogging) {
                devLogger.setup('Database loaded from URL and saved', {
                  url: databaseUrl,
                  sizeBytes: arrayBuffer.byteLength
                });
              }
            } else {
              throw new Error(`Invalid response: status=${response.status}, contentType=${contentType}`);
            }
          } catch (fetchError) {
            // Fall back to empty database with schema + sample data
            console.log('[SQLiteProvider] Creating fresh database with schema...');
            database = new sqlInstance.Database();
            try {
              const schemaResponse = await fetch('/schema.sql');
              if (schemaResponse.ok) {
                const schema = await schemaResponse.text();
                database.exec(schema);
                database.exec(SAMPLE_DATA_SQL);
                console.log('[SQLiteProvider] Schema and sample data loaded');
              }
            } catch (schemaError) {
              console.error('[SQLiteProvider] Schema load failed:', schemaError);
            }
          }
        }

        console.log('[SQLiteProvider] Database ready, setting state...');

        // Ensure facets table exists and is seeded (handles stale IndexedDB data)
        try {
          const facetCheck = database.exec("SELECT COUNT(*) as count FROM facets");
          const facetCount = facetCheck[0]?.values[0]?.[0] as number || 0;
          if (facetCount === 0) {
            console.log('[SQLiteProvider] Facets table empty, seeding...');
            const { FACETS_SEED_SQL } = await import('./sample-data');
            database.exec(FACETS_SEED_SQL);
            console.log('[SQLiteProvider] Facets seeded');
          }
        } catch (facetError) {
          console.warn('[SQLiteProvider] Facets check/seed failed:', facetError);
          // Table might not exist - try creating and seeding
          try {
            const { FACETS_SEED_SQL } = await import('./sample-data');
            database.exec(FACETS_SEED_SQL);
            console.log('[SQLiteProvider] Facets table created and seeded');
          } catch (createError) {
            console.error('[SQLiteProvider] Failed to create facets:', createError);
          }
        }

        setDb(database);

        // Test capabilities
        const { capabilities: dbCapabilities, telemetryErrors } = testDatabaseCapabilities(database);
        setCapabilities(dbCapabilities);
        setTelemetry(telemetryErrors);

        // Start auto-save (if persistence available)
        if (persistence) {
          autoSaveRef.current = new AutoSaveManager(persistence);
        }

        if (enableLogging && savedData) {
          devLogger.setup('Database loaded from IndexedDB', {
            sizeBytes: savedData.length,
            capabilities: dbCapabilities
          });
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

        console.log('[SQLiteProvider] ✅ Initialization complete');
        setLoading(false);
      } catch (error) {
        console.error('[SQLiteProvider] Initialization failed:', error);
        const errorObj = error instanceof Error ? error : new Error(String(error));
        setError(errorObj);
        setLoading(false);
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

  // Test FTS5 performance (memoized to prevent context churn)
  const testFTS5Performance = useCallback(async (): Promise<FTS5PerformanceResult> => {
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
  }, [db, capabilities.fts5, execute]);

  // Memoize context value to prevent unnecessary consumer re-renders
  const contextValue: SQLiteContextValue = useMemo(() => ({
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
  }), [
    db, loading, error, execute, run, save, reset, loadFromFile,
    capabilities, telemetry, dataVersion, storageQuota, testFTS5Performance
  ]);

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