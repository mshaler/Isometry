import initSqlJs, { Database } from 'sql.js';
import SCHEMA_SQL from './schema.sql?raw';
import { SAMPLE_DATA_SQL } from './sample-data';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

export async function initDatabase(loadSampleData = true): Promise<Database> {
  // Return existing promise if initialization in progress
  if (initPromise) return initPromise;
  
  // Return existing database if already initialized
  if (db) return db;
  
  initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
    });
    
    // Try to load from IndexedDB first
    const savedData = await loadFromIndexedDB();
    
    if (savedData) {
      db = new SQL.Database(savedData);
      console.log('Database loaded from IndexedDB');
    } else {
      db = new SQL.Database();
      
      // Execute schema
      db.run(SCHEMA_SQL);
      console.log('Schema initialized');
      
      // Load sample data if requested
      if (loadSampleData) {
        db.run(SAMPLE_DATA_SQL);
        console.log('Sample data loaded');
      }
      
      // Save initial state
      await saveToIndexedDB(db);
    }
    
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
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => resolve(null);
    
    request.onupgradeneeded = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };
    
    request.onsuccess = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(KEY);
      
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => resolve(null);
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
