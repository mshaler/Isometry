/**
 * Database Test Utilities
 *
 * Comprehensive utilities for sql.js database testing with proper initialization,
 * cleanup, and LPG data management. Supports the TDD workflow for Phase 2 SuperGrid
 * implementation.
 */

import type { Database, SqlJsStatic } from 'sql.js-fts5';
import { initializeTestSqlJs } from './sqljs-setup';

// Import database schema types (simple interfaces for testing)
// Note: These interfaces are kept for future extensibility but not currently used

/**
 * Test Database Manager
 *
 * Provides consistent database initialization, cleanup, and utilities for tests
 */
export class TestDatabaseManager {
  private static instance: TestDatabaseManager | null = null;
  private sql: SqlJsStatic | null = null;
  private activeConnections = new Set<Database>();

  private constructor() {}

  static async getInstance(): Promise<TestDatabaseManager> {
    if (!TestDatabaseManager.instance) {
      TestDatabaseManager.instance = new TestDatabaseManager();
      await TestDatabaseManager.instance.initialize();
    }
    return TestDatabaseManager.instance;
  }

  private async initialize(): Promise<void> {
    this.sql = await initializeTestSqlJs();
  }

  /**
   * Create a fresh test database with schema loaded
   */
  async createTestDatabase(options: {
    loadSampleData?: boolean;
    enableFTS5?: boolean;
    enableCTEs?: boolean;
  } = {}): Promise<Database> {
    if (!this.sql) {
      throw new Error('sql.js not initialized');
    }

    const db = new this.sql.Database();
    this.activeConnections.add(db);

    try {
      // Load the full schema
      await this.loadSchema(db, options);

      // Load sample data if requested
      if (options.loadSampleData !== false) {
        await this.loadSampleData(db);
      }

      return db;
    } catch (error) {
      this.closeDatabase(db);
      throw error;
    }
  }

  /**
   * Load the Isometry schema into a database
   */
  private async loadSchema(db: Database, _options: {
    enableFTS5?: boolean;
    enableCTEs?: boolean;
  }): Promise<void> {
    // Load base schema
    const baseSchema = this.getBaseSchemaSQL();

    try {
      db.exec(baseSchema);
    } catch (error) {
      console.warn('[Test] Schema loading with full features failed, trying simplified version');

      // Fallback to simplified schema if FTS5/CTEs not available
      const simplifiedSchema = this.getSimplifiedSchemaSQL();
      db.exec(simplifiedSchema);
    }
  }

  /**
   * Get the base schema SQL (from schema.sql or fallback)
   */
  private getBaseSchemaSQL(): string {
    // This is a simplified version of the schema for testing
    return `
      -- Nodes: Primary data table (cards)
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        node_type TEXT NOT NULL DEFAULT 'note',
        name TEXT NOT NULL,
        content TEXT,
        summary TEXT,

        -- LATCH: Location
        latitude REAL,
        longitude REAL,
        location_name TEXT,
        location_address TEXT,

        -- LATCH: Time
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        modified_at TEXT NOT NULL DEFAULT (datetime('now')),
        due_at TEXT,
        completed_at TEXT,
        event_start TEXT,
        event_end TEXT,

        -- LATCH: Category
        folder TEXT,
        tags TEXT,  -- JSON array
        status TEXT,

        -- LATCH: Hierarchy
        priority INTEGER DEFAULT 0,
        importance INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,

        -- Grid positioning for SuperGrid
        grid_x REAL DEFAULT 0,
        grid_y REAL DEFAULT 0,

        -- Metadata
        source TEXT,
        source_id TEXT,
        source_url TEXT,
        deleted_at TEXT,
        version INTEGER DEFAULT 1
      );

      -- Indexes for LATCH filtering
      CREATE INDEX IF NOT EXISTS idx_nodes_folder ON nodes(folder);
      CREATE INDEX IF NOT EXISTS idx_nodes_created ON nodes(created_at);
      CREATE INDEX IF NOT EXISTS idx_nodes_modified ON nodes(modified_at);
      CREATE INDEX IF NOT EXISTS idx_nodes_priority ON nodes(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);
      CREATE INDEX IF NOT EXISTS idx_nodes_active ON nodes(deleted_at) WHERE deleted_at IS NULL;

      -- Edges: Relationships (GRAPH)
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        edge_type TEXT NOT NULL,  -- LINK, NEST, SEQUENCE, AFFINITY
        source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        label TEXT,
        weight REAL DEFAULT 1.0,
        directed INTEGER DEFAULT 1,
        sequence_order INTEGER,
        channel TEXT,
        timestamp TEXT,
        subject TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(source_id, target_id, edge_type)
      );

      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id, edge_type);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id, edge_type);

      -- Facets: Available filtering dimensions
      CREATE TABLE IF NOT EXISTS facets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        facet_type TEXT NOT NULL,
        axis TEXT NOT NULL,  -- L, A, T, C, H
        source_column TEXT NOT NULL,
        options TEXT,
        icon TEXT,
        color TEXT,
        enabled INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      );

      -- Notebook Cards: Extended functionality for notebook sidecar
      CREATE TABLE IF NOT EXISTS notebook_cards (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        markdown_content TEXT,
        rendered_content TEXT,
        properties TEXT,  -- JSON object for custom properties panel
        template_id TEXT,
        card_type TEXT NOT NULL DEFAULT 'capture' CHECK (card_type IN ('capture', 'shell', 'preview')),
        layout_position TEXT,  -- JSON object for component positioning
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        modified_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(node_id)  -- One notebook card per node
      );

      CREATE INDEX IF NOT EXISTS idx_notebook_cards_node_id ON notebook_cards(node_id);
      CREATE INDEX IF NOT EXISTS idx_notebook_cards_type ON notebook_cards(card_type);
      CREATE INDEX IF NOT EXISTS idx_notebook_cards_modified ON notebook_cards(modified_at);

      -- Node Properties: Dynamic key-value storage for arbitrary YAML frontmatter
      CREATE TABLE IF NOT EXISTS node_properties (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT,  -- Legacy JSON/text fallback
        value_type TEXT NOT NULL DEFAULT 'string',  -- string, number, boolean, array, object, null
        value_string TEXT,
        value_number REAL,
        value_boolean INTEGER,
        value_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(node_id, key)  -- One value per key per node
      );

      CREATE INDEX IF NOT EXISTS idx_node_properties_node_id ON node_properties(node_id);
      CREATE INDEX IF NOT EXISTS idx_node_properties_key ON node_properties(key);
      CREATE INDEX IF NOT EXISTS idx_node_properties_lookup ON node_properties(node_id, key);
      CREATE INDEX IF NOT EXISTS idx_node_properties_value_number ON node_properties(key, value_number);
      CREATE INDEX IF NOT EXISTS idx_node_properties_value_string ON node_properties(key, value_string);

      CREATE TABLE IF NOT EXISTS etl_import_runs (
        run_id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        total_files INTEGER NOT NULL DEFAULT 0,
        imported_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        options_json TEXT,
        reconciliation_json TEXT
      );

      CREATE TABLE IF NOT EXISTS etl_import_run_types (
        run_id TEXT NOT NULL REFERENCES etl_import_runs(run_id) ON DELETE CASCADE,
        node_type TEXT NOT NULL,
        imported_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (run_id, node_type)
      );

      -- Settings: User preferences
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `;
  }

  /**
   * Simplified schema for environments without FTS5/CTEs
   */
  private getSimplifiedSchemaSQL(): string {
    return this.getBaseSchemaSQL(); // For now, base schema is simplified
  }

  /**
   * Load sample data for testing
   */
  private async loadSampleData(db: Database): Promise<void> {
    // Insert facets
    db.exec(`
      INSERT OR IGNORE INTO facets (id, name, facet_type, axis, source_column) VALUES
        ('folder', 'Folder', 'select', 'C', 'folder'),
        ('tags', 'Tags', 'multi_select', 'C', 'tags'),
        ('status', 'Status', 'select', 'C', 'status'),
        ('priority', 'Priority', 'number', 'H', 'priority'),
        ('created', 'Created', 'date', 'T', 'created_at'),
        ('modified', 'Modified', 'date', 'T', 'modified_at'),
        ('due', 'Due Date', 'date', 'T', 'due_at'),
        ('name', 'Name', 'text', 'A', 'name'),
        ('location', 'Location', 'location', 'L', 'location_name');
    `);

    // Insert sample nodes for testing
    db.exec(`
      INSERT OR IGNORE INTO nodes (id, name, content, summary, folder, status, priority, importance, grid_x, grid_y, created_at) VALUES
        ('test-card-1', 'Test Card 1', 'This is test content for card 1', 'Test summary 1', 'work', 'active', 3, 3, 100, 100, '2024-01-15 10:00:00'),
        ('test-card-2', 'Test Card 2', 'This is test content for card 2', 'Test summary 2',
         'personal', 'completed', 5, 4, 200, 100, '2024-01-16 11:00:00'),
        ('test-card-3', 'Test Card 3', 'This is test content for card 3', 'Test summary 3',
         'work', 'in_progress', 1, 2, 100, 200, '2024-01-17 12:00:00'),
        ('test-card-4', 'Test Card 4', 'This is test content for card 4', 'Test summary 4',
         'projects', 'blocked', 4, 5, 200, 200, '2024-01-18 13:00:00');
    `);

    // Insert sample edges
    db.exec(`
      INSERT OR IGNORE INTO edges (id, edge_type, source_id, target_id, label, weight, directed) VALUES
        ('test-edge-1', 'LINK', 'test-card-1', 'test-card-2', 'related', 0.8, 1),
        ('test-edge-2', 'SEQUENCE', 'test-card-1', 'test-card-3', 'precedes', 1.0, 1),
        ('test-edge-3', 'NEST', 'test-card-2', 'test-card-4', 'contains', 1.0, 1);
    `);

    // Insert sample notebook cards
    db.exec(`
      INSERT OR IGNORE INTO notebook_cards (id, node_id, card_type, markdown_content, properties) VALUES
        ('test-nb-1', 'test-card-1', 'capture', '# Test Notebook Card 1', '{"color": "blue"}'),
        ('test-nb-2', 'test-card-2', 'preview', '## Test Notebook Card 2', '{"pinned": true}'),
        ('test-nb-3', 'test-card-3', 'shell', 'console.warn("test");', '{"language": "javascript"}');
    `);

    // Insert settings
    db.exec(`
      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('theme', 'NeXTSTEP'),
        ('test_mode', 'true');
    `);
  }

  /**
   * Close a database and remove it from tracking
   */
  closeDatabase(db: Database): void {
    try {
      db.close();
    } catch (error) {
      console.warn('[Test] Error closing database:', error);
    } finally {
      this.activeConnections.delete(db);
    }
  }

  /**
   * Clean up all active database connections
   */
  cleanup(): void {
    for (const db of this.activeConnections) {
      this.closeDatabase(db);
    }
    this.activeConnections.clear();
  }

  /**
   * Get database statistics for testing
   */
  getDatabaseStats(db: Database): {
    nodeCount: number;
    edgeCount: number;
    facetCount: number;
    notebookCardCount: number;
  } {
    const nodeCount = db.exec('SELECT COUNT(*) as count FROM nodes')[0]?.values[0]?.[0] as number || 0;
    const edgeCount = db.exec('SELECT COUNT(*) as count FROM edges')[0]?.values[0]?.[0] as number || 0;
    const facetCount = db.exec('SELECT COUNT(*) as count FROM facets')[0]?.values[0]?.[0] as number || 0;
    const notebookCardCount = db.exec('SELECT COUNT(*) as count FROM notebook_cards')[0]?.values[0]?.[0] as number || 0;

    return {
      nodeCount,
      edgeCount,
      facetCount,
      notebookCardCount,
    };
  }

  /**
   * Test sql.js capabilities
   */
  testCapabilities(db: Database): {
    hasJSON: boolean;
    hasCTEs: boolean;
    hasFTS5: boolean;
  } {
    let hasJSON = false;
    let hasCTEs = false;
    let hasFTS5 = false;

    // Test JSON support
    try {
      db.exec(`SELECT json('{"test": true}')`);
      hasJSON = true;
    } catch (error) {
      // JSON not available
    }

    // Test recursive CTEs
    try {
      db.exec(`
        WITH RECURSIVE test_cte(n) AS (
          SELECT 1
          UNION ALL
          SELECT n+1 FROM test_cte WHERE n < 3
        )
        SELECT COUNT(*) FROM test_cte
      `);
      hasCTEs = true;
    } catch (error) {
      // CTEs not available
    }

    // Test FTS5
    try {
      db.exec('CREATE VIRTUAL TABLE test_fts USING fts5(content)');
      db.exec('DROP TABLE test_fts');
      hasFTS5 = true;
    } catch (error) {
      // FTS5 not available
    }

    return { hasJSON, hasCTEs, hasFTS5 };
  }
}

/**
 * Convenience functions for common test patterns
 */

/**
 * Create a test database with standard setup
 */
export async function createTestDB(options?: {
  loadSampleData?: boolean;
  enableFTS5?: boolean;
  enableCTEs?: boolean;
}): Promise<Database> {
  const manager = await TestDatabaseManager.getInstance();
  return manager.createTestDatabase(options);
}

/**
 * Create a minimal test database (no sample data)
 */
export async function createMinimalTestDB(): Promise<Database> {
  return createTestDB({ loadSampleData: false });
}

/**
 * Clean up test database
 */
export async function cleanupTestDB(db: Database): Promise<void> {
  const manager = await TestDatabaseManager.getInstance();
  manager.closeDatabase(db);
}

/**
 * Execute a test query and return results in a more convenient format
 */
export function execTestQuery(db: Database, sql: string, params?: unknown[]): unknown[] {
  const results = params ? db.exec(sql, params as (string | number | Uint8Array | null)[]) : db.exec(sql);

  if (results.length === 0) {
    return [];
  }

  const { columns, values } = results[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

/**
 * Insert test data and return the affected row count
 */
export function insertTestData(db: Database, sql: string, params?: unknown[]): number {
  const stmt = params ? db.prepare(sql) : null;

  if (stmt && params) {
    stmt.run(params as (string | number | Uint8Array | null)[]);
    stmt.free();
    return 1; // Return 1 for successful insert
  } else {
    db.exec(sql);
    return 1; // Return 1 for successful operation
  }
}

/**
 * Global cleanup for all test databases
 */
export async function globalTestCleanup(): Promise<void> {
  try {
    const manager = await TestDatabaseManager.getInstance();
    manager.cleanup();
  } catch (error) {
    console.warn('[Test] Global cleanup failed:', error);
  }

  // Also clean up global tracking
  if (global.__CLEANUP_TEST_DBS__) {
    global.__CLEANUP_TEST_DBS__();
  }
}
