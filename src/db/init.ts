import type { Database, SqlJsStatic } from 'sql.js';
import SCHEMA_SQL from './schema.sql?raw';
import { SAMPLE_DATA_SQL } from './sample-data';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

// Declare the global initSqlJs that sql.js creates
declare global {
  interface Window {
    initSqlJs?: (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

// Load sql.js from CDN - most reliable approach for Vite
async function loadSqlJs(): Promise<SqlJsStatic> {
  // Check if already loaded
  if (window.initSqlJs) {
    console.log('sql.js already loaded, initializing...');
    return window.initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });
  }

  console.log('Loading sql.js from CDN...');

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://sql.js.org/dist/sql-wasm.js';
    script.async = true;

    script.onload = () => {
      console.log('sql.js script loaded, checking for initSqlJs...');
      if (window.initSqlJs) {
        console.log('initSqlJs found, initializing WASM...');
        window.initSqlJs({
          locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
        })
          .then((SQL) => {
            console.log('sql.js WASM initialized successfully');
            resolve(SQL);
          })
          .catch(reject);
      } else {
        reject(new Error('initSqlJs not found after script load'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load sql.js from CDN'));
    };

    document.head.appendChild(script);
  });
}

export async function initDatabase(loadSampleData = true): Promise<Database> {
  // Return existing promise if initialization in progress
  if (initPromise) return initPromise;

  // Return existing database if already initialized
  if (db) return db;

  initPromise = (async () => {
    console.log('Initializing database...');

    const SQL = await loadSqlJs();

    console.log('sql.js loaded, checking IndexedDB...');

    // Try to load from IndexedDB first
    const savedData = await loadFromIndexedDB();

    if (savedData) {
      console.log('Creating database from saved data...');
      db = new SQL.Database(savedData);
      console.log('Database loaded from IndexedDB');
    } else {
      console.log('Creating new database...');
      db = new SQL.Database();
      console.log('Empty database created');

      // Execute schema
      console.log('Executing schema SQL...');
      try {
        db.run(SCHEMA_SQL);
        console.log('Schema initialized');
      } catch (schemaErr) {
        console.error('Schema error:', schemaErr);
        throw schemaErr;
      }

      // Load sample data if requested
      if (loadSampleData) {
        console.log('Loading sample data...');
        try {
          db.run(SAMPLE_DATA_SQL);
          console.log('Sample data loaded');
        } catch (dataErr) {
          console.error('Sample data error:', dataErr);
          throw dataErr;
        }
      }

      // Save initial state
      console.log('Saving to IndexedDB...');
      await saveToIndexedDB(db);
      console.log('Saved to IndexedDB');
    }

    console.log('Database initialization complete');
    return db;
  })();

  return initPromise;
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export async function saveDatabase(): Promise<void> {
  if (!db) return;
  await saveToIndexedDB(db);
}

export async function resetDatabase(): Promise<Database> {
  await clearIndexedDB();
  db = null;
  initPromise = null;
  return initDatabase(true);
}

// IndexedDB helpers
const DB_NAME = 'isometry';
const STORE_NAME = 'sqlite';
const KEY = 'database';

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  console.log('loadFromIndexedDB: starting...');
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => {
      console.log('loadFromIndexedDB: open error', request.error);
      resolve(null);
    };

    request.onupgradeneeded = (event) => {
      console.log('loadFromIndexedDB: upgrade needed');
      const idb = (event.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      console.log('loadFromIndexedDB: open success');
      const idb = (event.target as IDBOpenDBRequest).result;
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(KEY);

      getRequest.onsuccess = () => {
        console.log('loadFromIndexedDB: get success, has data:', !!getRequest.result);
        resolve(getRequest.result || null);
      };
      getRequest.onerror = () => {
        console.log('loadFromIndexedDB: get error');
        resolve(null);
      };
    };
  });
}

async function saveToIndexedDB(database: Database): Promise<void> {
  const data = database.export();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(data, KEY);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function clearIndexedDB(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}
