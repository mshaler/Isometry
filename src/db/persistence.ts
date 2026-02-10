/**
 * Database persistence utilities for SQLiteProvider
 */

import type { Database } from 'sql.js';
import { IndexedDBPersistence, AutoSaveManager } from './IndexedDBPersistence';
import { devLogger } from '../utils/dev-logger';

export interface PersistenceOperations {
  save: () => Promise<void>;
  reset: () => Promise<void>;
  loadFromFile: (file: ArrayBuffer) => Promise<void>;
}

/**
 * Create persistence operations
 */
export function createPersistenceOperations(
  db: Database | null,
  SQL: unknown,
  setDb: (db: Database) => void,
  setDataVersion: (version: number) => void,
  persistenceRef: React.MutableRefObject<IndexedDBPersistence | null>,
  autoSaveRef: React.MutableRefObject<AutoSaveManager | null>,
  enableLogging: boolean = true
): PersistenceOperations {

  // Save database to IndexedDB (replaces localStorage which has 5-10MB limit)
  const save = async (): Promise<void> => {
    if (!db) return;

    try {
      const data = db.export();
      const persistence = persistenceRef.current;

      if (persistence) {
        await persistence.save(data);
        if (enableLogging) {
          devLogger.data('Database saved to IndexedDB', { sizeBytes: data.length });
        }
      }
    } catch (error) {
      devLogger.error('Failed to save database', error);
      throw error;
    }
  };

  // Reset database
  const reset = async (): Promise<void> => {
    if (!SQL) return;

    try {
      // Close existing database
      if (db) {
        db.close();
      }

      // Clear persistence
      const persistence = persistenceRef.current;
      if (persistence) {
        await persistence.clear();
      }

      // Create fresh database
      const newDb = new SQL.Database();

      // Load initial schema if available
      try {
        const response = await fetch('/schema.sql');
        if (response.ok) {
          const schema = await response.text();
          newDb.exec(schema);
          if (enableLogging) {
            devLogger.setup('Fresh database created with schema');
          }
        }
      } catch (schemaError) {
        devLogger.warn('Schema file not found, created empty database', schemaError);
      }

      setDb(newDb);
      setDataVersion(0);

      if (enableLogging) {
        devLogger.lifecycle('Database reset completed');
      }
    } catch (error) {
      devLogger.error('Failed to reset database', error);
      throw error;
    }
  };

  // Load database from file
  const loadFromFile = async (file: ArrayBuffer): Promise<void> => {
    if (!SQL) return;

    try {
      // Close existing database
      if (db) {
        db.close();
      }

      // Create database from file
      const newDb = new SQL.Database(new Uint8Array(file));
      setDb(newDb);
      setDataVersion(0);

      // Save to persistence
      const persistence = persistenceRef.current;
      if (persistence) {
        await persistence.save(new Uint8Array(file));
      }

      // Restart auto-save
      const autoSave = autoSaveRef.current;
      if (autoSave) {
        autoSave.stop();
        const newAutoSave = new AutoSaveManager(newDb, persistence!, 30000);
        autoSaveRef.current = newAutoSave;
      }

      if (enableLogging) {
        devLogger.data('Database loaded from file', { sizeBytes: file.byteLength });
      }
    } catch (error) {
      devLogger.error('Failed to load database from file', error);
      throw error;
    }
  };

  return { save, reset, loadFromFile };
}