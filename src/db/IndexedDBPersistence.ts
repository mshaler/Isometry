/**
 * IndexedDB Persistence Layer for sql.js Database
 *
 * Replaces localStorage backup (5-10MB limit) with IndexedDB (50MB+ capacity).
 * Uses Jake Archibald's idb wrapper for promise-based API and transaction handling.
 *
 * Features:
 * - Type-safe object stores for database and metadata
 * - Storage quota monitoring via navigator.storage.estimate()
 * - Debounced auto-save with beforeunload protection
 *
 * @see 42-RESEARCH.md for architecture decisions and pitfall avoidance
 */

import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { devLogger } from '../utils/dev-logger';

// Constants
const DB_NAME = 'isometry-db';
const DB_VERSION = 1;
const DATABASE_STORE = 'database';
const METADATA_STORE = 'metadata';
const DEBOUNCE_MS = 5000;

/**
 * Metadata about the persisted database for diagnostics
 */
export interface DatabaseMetadata {
  version: number;
  lastSaved: string;
  nodeCount: number;
  sizeBytes: number;
}

/**
 * Storage quota information from navigator.storage.estimate()
 */
export interface StorageQuotaInfo {
  available: number | null;
  used: number | null;
  quota: number | null;
  percentUsed: number | null;
}

/**
 * IndexedDB schema definition for type-safe store access
 */
interface IsometryDBSchema extends DBSchema {
  [DATABASE_STORE]: {
    key: string;
    value: Uint8Array;
  };
  [METADATA_STORE]: {
    key: string;
    value: DatabaseMetadata;
  };
}

/**
 * IndexedDB persistence service for sql.js database exports.
 *
 * Handles:
 * - Database initialization with object store creation
 * - Save/load of sql.js exports as Uint8Array
 * - Metadata tracking for diagnostics
 * - Storage quota monitoring
 */
export class IndexedDBPersistence {
  private db: IDBPDatabase<IsometryDBSchema> | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB connection.
   * Creates object stores on first run (upgrade handler).
   * Safe to call multiple times - will return existing connection.
   */
  async init(): Promise<void> {
    // Prevent multiple simultaneous init calls
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.db) {
      return;
    }

    this.initPromise = this.doInit();
    await this.initPromise;
    this.initPromise = null;
  }

  private async doInit(): Promise<void> {
    try {
      this.db = await openDB<IsometryDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Create stores if they don't exist
          if (!db.objectStoreNames.contains(DATABASE_STORE)) {
            db.createObjectStore(DATABASE_STORE);
          }
          if (!db.objectStoreNames.contains(METADATA_STORE)) {
            db.createObjectStore(METADATA_STORE);
          }
        },
      });

      devLogger.setup('IndexedDB initialized', { name: DB_NAME, version: DB_VERSION });
    } catch (err) {
      console.error('IndexedDB initialization failed:', err);
      throw err;
    }
  }

  /**
   * Save sql.js database export to IndexedDB.
   *
   * @param data - Uint8Array from db.export()
   * @param nodeCount - Optional node count for metadata (extracted from database)
   * @throws Error if IndexedDB not initialized or quota exceeded
   */
  async save(data: Uint8Array, nodeCount?: number): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized. Call init() first.');
    }

    try {
      // Store the database export
      await this.db.put(DATABASE_STORE, data, 'main');

      // Store metadata for diagnostics
      const metadata: DatabaseMetadata = {
        version: 1,
        lastSaved: new Date().toISOString(),
        nodeCount: nodeCount ?? 0,
        sizeBytes: data.length,
      };
      await this.db.put(METADATA_STORE, metadata, 'main');

      devLogger.data('Database saved to IndexedDB', {
        bytes: data.length,
        nodeCount: metadata.nodeCount,
      });
    } catch (err) {
      // Check for quota exceeded
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        console.error('IndexedDB quota exceeded:', err);
      }
      throw err;
    }
  }

  /**
   * Load sql.js database export from IndexedDB.
   *
   * @returns Uint8Array for sql.js Database constructor, or null if not found
   */
  async load(): Promise<Uint8Array | null> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized. Call init() first.');
    }

    try {
      const data = await this.db.get(DATABASE_STORE, 'main');
      if (data) {
        devLogger.data('Database loaded from IndexedDB', { bytes: data.length });
        return data;
      }
      return null;
    } catch (err) {
      console.error('IndexedDB load failed:', err);
      throw err;
    }
  }

  /**
   * Get metadata about the persisted database.
   *
   * @returns DatabaseMetadata or null if no database stored
   */
  async getMetadata(): Promise<DatabaseMetadata | null> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized. Call init() first.');
    }

    try {
      return await this.db.get(METADATA_STORE, 'main') ?? null;
    } catch (err) {
      console.error('IndexedDB metadata read failed:', err);
      return null;
    }
  }

  /**
   * Clear all stored data.
   * Use for reset functionality or storage cleanup.
   */
  async clear(): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized. Call init() first.');
    }

    try {
      await this.db.clear(DATABASE_STORE);
      await this.db.clear(METADATA_STORE);
      devLogger.data('IndexedDB cleared', {});
    } catch (err) {
      console.error('IndexedDB clear failed:', err);
      throw err;
    }
  }

  /**
   * Check storage quota using Storage API.
   * Useful for warning users before large saves.
   *
   * @returns StorageQuotaInfo with available/used/quota bytes
   */
  async getStorageQuota(): Promise<StorageQuotaInfo> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return {
        available: null,
        used: null,
        quota: null,
        percentUsed: null,
      };
    }

    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota ?? 0;
      const usage = estimate.usage ?? 0;
      const available = quota - usage;
      const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

      return {
        available,
        used: usage,
        quota,
        percentUsed,
      };
    } catch (err) {
      console.error('Storage quota check failed:', err);
      return {
        available: null,
        used: null,
        quota: null,
        percentUsed: null,
      };
    }
  }

  /**
   * Check if there's enough storage space for a given data size.
   *
   * @param sizeNeeded - Size in bytes to write
   * @returns true if space available, false otherwise
   */
  async hasSpaceFor(sizeNeeded: number): Promise<boolean> {
    const quota = await this.getStorageQuota();
    if (quota.available === null) {
      // Can't determine, assume okay
      return true;
    }
    return quota.available > sizeNeeded;
  }
}

/**
 * Auto-save manager with debouncing and beforeunload protection.
 *
 * Prevents "export-every-write" performance death by debouncing saves.
 * Warns user on page close if there are pending changes.
 */
export class AutoSaveManager {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private hasPendingChanges = false;
  private saveCallback: (() => Promise<void>) | null = null;
  private beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  /**
   * @param _persistence - IndexedDBPersistence instance (kept for API compatibility and future use)
   */
  constructor(_persistence: IndexedDBPersistence) {
    this.setupBeforeUnload();
  }

  /**
   * Set the save callback function that exports and saves the database.
   * Must be set before notifyDataChanged() is called.
   */
  setSaveCallback(callback: () => Promise<void>): void {
    this.saveCallback = callback;
  }

  /**
   * Notify that data has changed. Schedules a debounced save.
   * Call this after INSERT/UPDATE/DELETE operations.
   */
  notifyDataChanged(): void {
    this.hasPendingChanges = true;

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.executeSave();
    }, DEBOUNCE_MS);
  }

  /**
   * Force immediate save, canceling any pending debounce timer.
   * Call on unmount or before navigation.
   */
  async forceImmediateSave(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.executeSave();
  }

  /**
   * Check if there are unsaved changes.
   */
  hasPending(): boolean {
    return this.hasPendingChanges;
  }

  /**
   * Clean up event listeners.
   * Call on component unmount.
   */
  cleanup(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }

  private async executeSave(): Promise<void> {
    if (!this.hasPendingChanges) return;

    try {
      if (this.saveCallback) {
        await this.saveCallback();
      } else {
        console.warn('AutoSaveManager: No save callback set, skipping save');
      }
      this.hasPendingChanges = false;
      devLogger.data('Auto-save completed', {});
    } catch (err) {
      console.error('Auto-save failed:', err);
      // Keep hasPendingChanges true so we retry
    }
  }

  private setupBeforeUnload(): void {
    this.beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (this.hasPendingChanges) {
        // Modern browsers ignore custom messages, but setting returnValue triggers the dialog
        e.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        e.returnValue = '';

        // Attempt immediate save (may not complete before page closes)
        this.executeSave().catch(err => {
          console.error('Save on unload failed:', err);
        });
      }
    };

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }
}

// Singleton instances for easy import
let persistenceInstance: IndexedDBPersistence | null = null;
let autoSaveInstance: AutoSaveManager | null = null;

/**
 * Get singleton IndexedDBPersistence instance.
 * Creates new instance on first call.
 */
export function getPersistence(): IndexedDBPersistence {
  if (!persistenceInstance) {
    persistenceInstance = new IndexedDBPersistence();
  }
  return persistenceInstance;
}

/**
 * Get singleton AutoSaveManager instance.
 * Creates new instance on first call.
 */
export function getAutoSaveManager(): AutoSaveManager {
  if (!autoSaveInstance) {
    autoSaveInstance = new AutoSaveManager(getPersistence());
  }
  return autoSaveInstance;
}
