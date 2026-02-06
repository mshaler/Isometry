/**
 * Test script to verify sql.js capabilities for Isometry v4
 * Tests FTS5, JSON1, recursive CTEs, and synchronous query performance
 */
import initSqlJs from 'sql.js';

async function testSQLJSCapabilities() {
  console.log('🔧 Testing sql.js capabilities for Isometry v4...');

  try {
    // Initialize sql.js
    const SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`
    });

    const db = new SQL.Database();
    console.log('✅ sql.js initialized successfully');

    // Test 1: Basic SQLite functionality
    db.exec(`
      CREATE TABLE test_nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`INSERT INTO test_nodes (id, name, content) VALUES (?, ?, ?)`,
           ['test-1', 'Test Node', 'Test content']);

    const basicResults = db.exec('SELECT * FROM test_nodes');
    console.log('✅ Basic SQLite operations work:', basicResults[0].values.length, 'rows');

    // Test 2: JSON1 Extension
    try {
      const jsonTest = db.exec(`SELECT json('{"test": true}') as json_result`);
      console.log('✅ JSON1 extension available:', jsonTest[0].values[0][0]);
    } catch (jsonError) {
      console.warn('⚠️ JSON1 extension not available:', jsonError.message);
    }

    // Test 3: FTS5 Full-Text Search
    try {
      db.exec(`
        CREATE VIRTUAL TABLE test_fts USING fts5(name, content);
        INSERT INTO test_fts(name, content) VALUES ('Test', 'Sample content for search');
      `);

      const ftsResults = db.exec(`SELECT * FROM test_fts WHERE test_fts MATCH 'sample'`);
      console.log('✅ FTS5 full-text search available:', ftsResults[0].values.length, 'matches');
    } catch (ftsError) {
      console.warn('⚠️ FTS5 not available:', ftsError.message);
    }

    // Test 4: Recursive CTEs (Critical for GRAPH traversal)
    try {
      const cteResults = db.exec(`
        WITH RECURSIVE countdown(n) AS (
          SELECT 5
          UNION ALL
          SELECT n-1 FROM countdown WHERE n > 1
        )
        SELECT COUNT(*) as count FROM countdown
      `);
      console.log('✅ Recursive CTEs work:', cteResults[0].values[0][0], 'rows generated');
    } catch (cteError) {
      console.error('❌ Recursive CTEs failed (REQUIRED):', cteError.message);
      throw cteError;
    }

    // Test 5: Performance - Synchronous query execution
    const startTime = performance.now();

    // Insert test data
    const stmt = db.prepare('INSERT INTO test_nodes (id, name, content) VALUES (?, ?, ?)');
    for (let i = 0; i < 1000; i++) {
      stmt.run([`perf-${i}`, `Performance Test ${i}`, `Content ${i}`]);
    }
    stmt.free();

    // Query test data
    const perfResults = db.exec('SELECT COUNT(*) as total FROM test_nodes');
    const endTime = performance.now();

    console.log('✅ Performance test:', {
      totalRows: perfResults[0].values[0][0],
      duration: `${(endTime - startTime).toFixed(2)}ms`,
      synchronous: true
    });

    // Test 6: LATCH filtering patterns
    db.exec(`
      INSERT INTO test_nodes (id, name, content) VALUES
      ('latch-1', 'Work Task', '{"tags": ["work", "urgent"], "priority": 1}'),
      ('latch-2', 'Personal Note', '{"tags": ["personal"], "priority": 3}'),
      ('latch-3', 'Project Idea', '{"tags": ["work", "project"], "priority": 2}')
    `);

    const latchResults = db.exec(`
      SELECT name, content
      FROM test_nodes
      WHERE content LIKE '%work%'
      ORDER BY name
    `);
    console.log('✅ LATCH filtering patterns work:', latchResults[0].values.length, 'filtered rows');

    // Test 7: Graph traversal with edges table
    db.exec(`
      CREATE TABLE test_edges (
        id TEXT PRIMARY KEY,
        source_id TEXT,
        target_id TEXT,
        edge_type TEXT
      );

      INSERT INTO test_edges VALUES
      ('edge-1', 'latch-1', 'latch-2', 'LINK'),
      ('edge-2', 'latch-2', 'latch-3', 'SEQUENCE'),
      ('edge-3', 'latch-1', 'latch-3', 'NEST');
    `);

    const graphResults = db.exec(`
      WITH RECURSIVE graph_traversal(id, path, depth) AS (
        SELECT 'latch-1', 'latch-1', 0
        UNION ALL
        SELECT e.target_id, gt.path || ' -> ' || e.target_id, gt.depth + 1
        FROM graph_traversal gt
        JOIN test_edges e ON e.source_id = gt.id
        WHERE gt.depth < 3
      )
      SELECT COUNT(*) as reachable FROM graph_traversal
    `);
    console.log('✅ Graph traversal with recursive CTEs:', graphResults[0].values[0][0], 'reachable nodes');

    db.close();
    console.log('\n🚀 sql.js capabilities verification COMPLETE');
    console.log('✅ Ready for bridge elimination - all required features available');

    return true;

  } catch (error) {
    console.error('💥 sql.js capabilities test FAILED:', error);
    return false;
  }
}

// Run the test
if (typeof window !== 'undefined') {
  window.testSQLJSCapabilities = testSQLJSCapabilities;
  testSQLJSCapabilities();
} else {
  testSQLJSCapabilities();
}