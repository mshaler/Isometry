/**
 * SQL.js Database Initialization with FTS5 Support
 *
 * Bridge elimination architecture - sql.js provides direct SQLite access
 * in the same JavaScript runtime as D3.js. Zero serialization overhead.
 */

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

let dbInstance: Database | null = null;
let isInitialized = false;

/**
 * Initialize sql.js database with FTS5 support
 * Uses custom FTS5-compiled WASM built with Emscripten
 */
export async function initDatabase(): Promise<Database> {
  if (dbInstance && isInitialized) {
    return dbInstance;
  }

  try {
    // Load sql.js with FTS5-enabled WASM
    const SQL = await initSqlJs({
      locateFile: (file: string) => `/wasm/${file}`
    });

    // Create in-memory database
    dbInstance = new SQL.Database();

    // Load schema with FTS5 virtual tables
    const schemaResponse = await fetch('/src/db/schema.sql');
    const schemaSQL = await schemaResponse.text();

    // Execute schema creation
    dbInstance.exec(schemaSQL);

    // Verify FTS5 is working
    await verifyFTS5Support(dbInstance);

    isInitialized = true;
    console.log('✅ sql.js database initialized with FTS5 support');

    return dbInstance;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Get the current database instance
 * Throws error if not initialized
 */
export function getDatabase(): Database {
  if (!dbInstance || !isInitialized) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

/**
 * Verify FTS5 extension is available and working
 * FTS5 is required - no fallback needed since we compiled with FTS5 support
 */
async function verifyFTS5Support(db: Database): Promise<void> {
  try {
    // Test FTS5 functionality - first check if table exists
    const result = db.exec(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='nodes_fts'
    `);

    if (result.length > 0 && result[0].values.length > 0) {
      // Table exists, test FTS5 query functionality
      db.exec(`
        SELECT * FROM nodes_fts WHERE nodes_fts MATCH 'test' LIMIT 1
      `);
      console.log('✅ FTS5 verification successful - query executed');
    } else {
      console.log('✅ FTS5 available - nodes_fts table will be created by schema');
    }

    // Verify FTS5 extension is actually available
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fts5_test USING fts5(content)
    `);
    db.exec('DROP TABLE IF EXISTS fts5_test');
    console.log('✅ FTS5 extension confirmed available');

  } catch (error) {
    console.error('❌ FTS5 verification failed:', error);
    throw new Error('FTS5 is required but not available in this sql.js build');
  }
}

/**
 * Verify recursive CTE support for graph queries
 */
export async function verifyRecursiveCTE(db: Database): Promise<void> {
  try {
    // Test recursive CTE with graph traversal
    const result = db.exec(`
      WITH RECURSIVE reachable(id, depth) AS (
        SELECT 'card-1', 0
        UNION ALL
        SELECT e.target_id, r.depth + 1
        FROM reachable r
        JOIN edges e ON e.source_id = r.id
        WHERE r.depth < 3
      )
      SELECT COUNT(*) as reachable_count FROM reachable
    `);

    console.log('✅ Recursive CTE verification successful:', result);
  } catch (error) {
    console.warn('⚠️ Recursive CTE verification failed:', error);
    throw error;
  }
}

/**
 * Save database to localStorage as base64
 * Debounced saves prevent excessive writes
 */
let saveTimeout: NodeJS.Timeout | null = null;
export async function saveDatabase(): Promise<void> {
  if (!dbInstance) return;

  // Debounce saves
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    try {
      const data = dbInstance!.export();
      const base64 = Buffer.from(data).toString('base64');
      localStorage.setItem('isometry-db', base64);
      console.log('💾 Database saved to localStorage');
    } catch (error) {
      console.error('❌ Database save failed:', error);
    }
  }, 1000);
}

/**
 * Load database from localStorage
 */
export async function loadDatabase(): Promise<void> {
  try {
    const base64 = localStorage.getItem('isometry-db');
    if (!base64) {
      console.log('📄 No saved database found, using schema defaults');
      return;
    }

    const data = Buffer.from(base64, 'base64');

    if (dbInstance) {
      dbInstance.close();
    }

    const SQL = await initSqlJs({
      locateFile: (file: string) => `/wasm/${file}`
    });

    dbInstance = new SQL.Database(data);
    console.log('📂 Database loaded from localStorage');
  } catch (error) {
    console.error('❌ Database load failed:', error);
    // Fall back to fresh database
    await initDatabase();
  }
}

/**
 * Reset database to schema defaults
 */
export async function resetDatabase(): Promise<Database> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    isInitialized = false;
  }

  localStorage.removeItem('isometry-db');
  return await initDatabase();
}

/**
 * Close database and cleanup
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    isInitialized = false;
  }
}