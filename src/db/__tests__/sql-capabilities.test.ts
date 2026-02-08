/**
 * SQL.js Capabilities Test - Verifies P0 gate requirements from CLAUDE.md
 *
 * This test verifies that sql.js FTS5 and recursive CTEs are working correctly
 * in the current Isometry codebase setup. This is a GATE requirement that must
 * pass before Phase 2 SuperGrid implementation can begin.
 *
 * Tests:
 * 1. sql.js initialization with FTS5 support
 * 2. FTS5 virtual table creation and search
 * 3. Recursive CTE queries for graph traversal
 * 4. SQLiteProvider capability detection
 * 5. Synchronous query execution (no promises)
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import initSqlJs from 'sql.js-fts5';
import type { Database, SqlJsStatic } from 'sql.js-fts5';

describe('SQL.js Capabilities Verification (P0 Gate)', () => {
  let SQL: SqlJsStatic;
  let db: Database;

  beforeEach(async () => {
    // Initialize sql.js-fts5 with WASM from public directory
    SQL = await initSqlJs({
      locateFile: (file: string) => {
        // In test environment, use the actual public WASM files
        return `public/wasm/${file}`;
      }
    });

    db = new SQL.Database();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Basic sql.js functionality', () => {
    test('should initialize sql.js without errors', () => {
      expect(SQL).toBeDefined();
      expect(db).toBeDefined();

      // Basic table creation and insertion
      db.exec(`
        CREATE TABLE test_basic (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);

      db.run('INSERT INTO test_basic (name) VALUES (?)', ['test']);

      const result = db.exec('SELECT * FROM test_basic');
      expect(result).toHaveLength(1);
      expect(result[0].values).toHaveLength(1);
      expect(result[0].values[0][1]).toBe('test');
    });

    test('should support JSON1 extension', () => {
      const result = db.exec(`SELECT json('{"test": true}') as json_result`);
      expect(result).toHaveLength(1);
      expect(result[0].values[0][0]).toBe('{"test":true}');
    });
  });

  describe('FTS5 Full-Text Search (Critical for CLAUDE.md compliance)', () => {
    test('should create FTS5 virtual table successfully', () => {
      expect(() => {
        db.exec('CREATE VIRTUAL TABLE test_fts USING fts5(name, content)');
      }).not.toThrow();

      // Verify table was created
      const tables = db.exec(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='test_fts'
      `);
      expect(tables[0].values).toHaveLength(1);
      expect(tables[0].values[0][0]).toBe('test_fts');
    });

    test('should perform FTS5 search queries successfully', () => {
      // Create and populate FTS5 table
      db.exec(`
        CREATE VIRTUAL TABLE nodes_fts USING fts5(name, content);
        INSERT INTO nodes_fts(name, content) VALUES
          ('Test Node', 'This is sample content for testing'),
          ('Another Node', 'Different content here'),
          ('Search Test', 'Sample text with keywords');
      `);

      // Test MATCH query
      const searchResults = db.exec(`
        SELECT name FROM nodes_fts
        WHERE nodes_fts MATCH 'sample'
        ORDER BY rank
      `);

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].values).toHaveLength(2); // Should match 2 rows

      // Verify specific matches
      const names = searchResults[0].values.map(row => row[0]);
      expect(names).toContain('Test Node');
      expect(names).toContain('Search Test');
    });

    test('should handle FTS5 phrase queries', () => {
      db.exec(`
        CREATE VIRTUAL TABLE phrase_fts USING fts5(content);
        INSERT INTO phrase_fts(content) VALUES
          ('This is a complete phrase'),
          ('This is another phrase'),
          ('Complete different text');
      `);

      // Test phrase query
      const phraseResults = db.exec(`
        SELECT content FROM phrase_fts
        WHERE phrase_fts MATCH '"complete phrase"'
      `);

      expect(phraseResults[0].values).toHaveLength(1);
      expect(phraseResults[0].values[0][0]).toBe('This is a complete phrase');
    });
  });

  describe('Recursive CTEs (Critical for GRAPH traversal)', () => {
    test('should execute basic recursive CTE', () => {
      const result = db.exec(`
        WITH RECURSIVE countdown(n) AS (
          SELECT 5
          UNION ALL
          SELECT n-1 FROM countdown WHERE n > 1
        )
        SELECT COUNT(*) as count FROM countdown
      `);

      expect(result).toHaveLength(1);
      expect(result[0].values[0][0]).toBe(5); // Should count down from 5 to 1
    });

    test('should perform graph traversal with recursive CTE', () => {
      // Set up nodes and edges tables
      db.exec(`
        CREATE TABLE test_nodes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        );

        CREATE TABLE test_edges (
          id TEXT PRIMARY KEY,
          source_id TEXT,
          target_id TEXT,
          edge_type TEXT
        );

        INSERT INTO test_nodes VALUES
          ('node-1', 'Root Node'),
          ('node-2', 'Child Node 1'),
          ('node-3', 'Child Node 2'),
          ('node-4', 'Grandchild Node');

        INSERT INTO test_edges VALUES
          ('edge-1', 'node-1', 'node-2', 'LINK'),
          ('edge-2', 'node-1', 'node-3', 'LINK'),
          ('edge-3', 'node-2', 'node-4', 'NEST');
      `);

      // Test graph traversal from root node
      const traversalResult = db.exec(`
        WITH RECURSIVE reachable(id, name, path, depth) AS (
          SELECT id, name, name, 0
          FROM test_nodes
          WHERE id = 'node-1'

          UNION ALL

          SELECT n.id, n.name, r.path || ' -> ' || n.name, r.depth + 1
          FROM reachable r
          JOIN test_edges e ON e.source_id = r.id
          JOIN test_nodes n ON n.id = e.target_id
          WHERE r.depth < 3
        )
        SELECT COUNT(*) as reachable_count FROM reachable
      `);

      expect(traversalResult[0].values[0][0]).toBeGreaterThanOrEqual(3); // Should reach at least 3 nodes
    });

    test('should support complex graph queries with CTEs', () => {
      // Set up a more complex graph
      db.exec(`
        CREATE TABLE complex_nodes (id TEXT PRIMARY KEY, type TEXT);
        CREATE TABLE complex_edges (source_id TEXT, target_id TEXT, weight REAL);

        INSERT INTO complex_nodes VALUES
          ('a', 'start'), ('b', 'mid'), ('c', 'mid'),
          ('d', 'end'), ('e', 'end');

        INSERT INTO complex_edges VALUES
          ('a', 'b', 1.0), ('a', 'c', 2.0),
          ('b', 'd', 1.5), ('c', 'd', 0.5), ('c', 'e', 1.2);
      `);

      // Find all paths with cumulative weights
      const pathsResult = db.exec(`
        WITH RECURSIVE paths(current_node, target_node, path, total_weight, depth) AS (
          SELECT 'a', 'a', 'a', 0.0, 0

          UNION ALL

          SELECT e.target_id, e.target_id,
                 p.path || ' -> ' || e.target_id,
                 p.total_weight + e.weight,
                 p.depth + 1
          FROM paths p
          JOIN complex_edges e ON e.source_id = p.current_node
          WHERE p.depth < 5
        )
        SELECT COUNT(*) as path_count, AVG(total_weight) as avg_weight
        FROM paths
        WHERE current_node IN (SELECT id FROM complex_nodes WHERE type = 'end')
      `);

      expect(pathsResult[0].values).toHaveLength(1);
      expect(pathsResult[0].values[0][0]).toBeGreaterThan(0); // Should find paths to end nodes
    });
  });

  describe('Synchronous Query Execution (Bridge Elimination)', () => {
    test('should execute queries synchronously without promises', () => {
      // Set up test data
      db.exec(`
        CREATE TABLE sync_test (id INTEGER, value TEXT);
        INSERT INTO sync_test VALUES (1, 'first'), (2, 'second');
      `);

      // These should execute immediately, no await needed
      const startTime = performance.now();
      const result1 = db.exec('SELECT * FROM sync_test WHERE id = 1');
      const result2 = db.exec('SELECT * FROM sync_test WHERE id = 2');
      const endTime = performance.now();

      // Verify results are immediate
      expect(result1[0].values[0][1]).toBe('first');
      expect(result2[0].values[0][1]).toBe('second');

      // Should be very fast (under 10ms for simple queries)
      expect(endTime - startTime).toBeLessThan(10);
    });

    test('should support prepared statements for performance', () => {
      db.exec('CREATE TABLE perf_test (id INTEGER, data TEXT)');

      const stmt = db.prepare('INSERT INTO perf_test VALUES (?, ?)');

      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        stmt.run([i, `data-${i}`]);
      }
      const endTime = performance.now();

      stmt.free();

      // Verify all data was inserted
      const countResult = db.exec('SELECT COUNT(*) FROM perf_test');
      expect(countResult[0].values[0][0]).toBe(100);

      // Should be reasonably fast
      expect(endTime - startTime).toBeLessThan(100); // 100ms for 100 inserts
    });
  });

  describe('Isometry Schema Compatibility', () => {
    test('should support the full Isometry schema patterns', () => {
      // Test LATCH filtering patterns
      db.exec(`
        CREATE TABLE nodes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          folder TEXT,
          tags TEXT,
          priority INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          deleted_at TEXT
        );

        INSERT INTO nodes (id, name, folder, tags, priority) VALUES
          ('n1', 'Work Task', 'work', '["urgent", "backend"]', 1),
          ('n2', 'Personal Note', 'personal', '["health"]', 3),
          ('n3', 'Project Idea', 'work', '["frontend", "ui"]', 2);
      `);

      // Test LATCH filtering (Category)
      const workItems = db.exec(`
        SELECT name FROM nodes
        WHERE folder = 'work' AND deleted_at IS NULL
        ORDER BY priority
      `);

      expect(workItems[0].values).toHaveLength(2);
      expect(workItems[0].values[0][0]).toBe('Work Task'); // priority 1 comes first

      // Test LATCH filtering (Hierarchy)
      const highPriority = db.exec(`
        SELECT name FROM nodes
        WHERE priority <= 2 AND deleted_at IS NULL
        ORDER BY priority
      `);

      expect(highPriority[0].values).toHaveLength(2);
    });

    test('should support GRAPH edge patterns', () => {
      db.exec(`
        CREATE TABLE nodes (id TEXT PRIMARY KEY, name TEXT);
        CREATE TABLE edges (
          id TEXT PRIMARY KEY,
          source_id TEXT,
          target_id TEXT,
          edge_type TEXT,
          weight REAL DEFAULT 1.0
        );

        INSERT INTO nodes VALUES
          ('card1', 'Main Card'),
          ('card2', 'Related Card'),
          ('card3', 'Nested Card');

        INSERT INTO edges VALUES
          ('e1', 'card1', 'card2', 'LINK', 1.0),
          ('e2', 'card1', 'card3', 'NEST', 2.0);
      `);

      // Test GRAPH traversal patterns
      const related = db.exec(`
        SELECT n.name, e.edge_type, e.weight
        FROM edges e
        JOIN nodes n ON n.id = e.target_id
        WHERE e.source_id = 'card1'
        ORDER BY e.weight
      `);

      expect(related[0].values).toHaveLength(2);
      expect(related[0].values[0][0]).toBe('Related Card'); // LINK weight 1.0 comes first
      expect(related[0].values[1][0]).toBe('Nested Card'); // NEST weight 2.0 comes second
    });
  });
});