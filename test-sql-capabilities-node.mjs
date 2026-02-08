/**
 * Node.js test for sql.js capabilities verification
 * Tests FTS5 and recursive CTEs without browser WASM loading complexities
 */

import initSqlJs from 'sql.js-fts5';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testSQLJSCapabilities() {
  console.log('🔧 Testing sql.js capabilities for Isometry v4...');

  try {
    // Initialize sql.js-fts5 with local WASM files
    const wasmPath = path.join(__dirname, 'node_modules', 'sql.js-fts5', 'dist', 'sql-wasm.wasm');
    const wasmBuffer = fs.readFileSync(wasmPath);

    const SQL = await initSqlJs({
      wasmBinary: wasmBuffer
    });

    const db = new SQL.Database();
    console.log('✅ sql.js-fts5 initialized successfully');

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
    console.log(`✅ Basic SQLite operations work: ${basicResults[0].values.length} rows`);

    // Test 2: JSON1 Extension
    try {
      const jsonTest = db.exec(`SELECT json('{"test": true}') as json_result`);
      console.log(`✅ JSON1 extension available: ${jsonTest[0].values[0][0]}`);
    } catch (jsonError) {
      console.warn(`⚠️ JSON1 extension not available: ${jsonError.message}`);
    }

    // Test 3: FTS5 Full-Text Search (CRITICAL)
    let fts5Available = false;
    try {
      db.exec(`
        CREATE VIRTUAL TABLE test_fts USING fts5(name, content);
        INSERT INTO test_fts(name, content) VALUES
          ('Test Node', 'Sample content for search'),
          ('Another Node', 'Different text here'),
          ('Search Test', 'Sample keywords and content');
      `);

      const ftsResults = db.exec(`SELECT * FROM test_fts WHERE test_fts MATCH 'sample'`);
      console.log(`✅ FTS5 full-text search available: ${ftsResults[0].values.length} matches`);

      // Test phrase search
      const phraseResults = db.exec(`SELECT * FROM test_fts WHERE test_fts MATCH '"sample content"'`);
      console.log(`✅ FTS5 phrase search works: ${phraseResults[0].values.length} phrase matches`);

      fts5Available = true;
    } catch (ftsError) {
      console.error(`❌ FTS5 not available (GATE BLOCKER): ${ftsError.message}`);
    }

    // Test 4: Recursive CTEs (CRITICAL for GRAPH traversal)
    let recursiveCTEAvailable = false;
    try {
      const cteResults = db.exec(`
        WITH RECURSIVE countdown(n) AS (
          SELECT 5
          UNION ALL
          SELECT n-1 FROM countdown WHERE n > 1
        )
        SELECT COUNT(*) as count FROM countdown
      `);
      console.log(`✅ Recursive CTEs work: ${cteResults[0].values[0][0]} rows generated`);
      recursiveCTEAvailable = true;
    } catch (cteError) {
      console.error(`❌ Recursive CTEs failed (GATE BLOCKER): ${cteError.message}`);
    }

    // Test 5: Graph traversal simulation (Isometry pattern)
    if (recursiveCTEAvailable) {
      db.exec(`
        CREATE TABLE test_edges (
          id TEXT PRIMARY KEY,
          source_id TEXT,
          target_id TEXT,
          edge_type TEXT
        );

        INSERT INTO test_edges VALUES
        ('edge-1', 'test-1', 'node-2', 'LINK'),
        ('edge-2', 'node-2', 'node-3', 'SEQUENCE'),
        ('edge-3', 'test-1', 'node-4', 'NEST'),
        ('edge-4', 'node-3', 'node-5', 'AFFINITY');
      `);

      const graphResults = db.exec(`
        WITH RECURSIVE graph_traversal(id, path, depth, edge_type) AS (
          SELECT 'test-1', 'test-1', 0, 'ROOT'
          UNION ALL
          SELECT e.target_id,
                 gt.path || ' -[' || e.edge_type || ']-> ' || e.target_id,
                 gt.depth + 1,
                 e.edge_type
          FROM graph_traversal gt
          JOIN test_edges e ON e.source_id = gt.id
          WHERE gt.depth < 3
        )
        SELECT COUNT(*) as reachable,
               MAX(depth) as max_depth,
               GROUP_CONCAT(DISTINCT edge_type) as edge_types
        FROM graph_traversal
      `);

      const [count, maxDepth, edgeTypes] = graphResults[0].values[0];
      console.log(`✅ Graph traversal: ${count} reachable nodes, depth ${maxDepth}, types: ${edgeTypes}`);
    }

    // Test 6: Performance - Synchronous query execution
    const startTime = performance.now();

    const stmt = db.prepare('INSERT INTO test_nodes (id, name, content) VALUES (?, ?, ?)');
    for (let i = 0; i < 1000; i++) {
      stmt.run([`perf-${i}`, `Performance Test ${i}`, `Content ${i}`]);
    }
    stmt.free();

    const perfResults = db.exec('SELECT COUNT(*) as total FROM test_nodes');
    const endTime = performance.now();

    console.log(`✅ Performance: ${perfResults[0].values[0][0]} rows in ${(endTime - startTime).toFixed(2)}ms (synchronous)`);

    db.close();

    // Final assessment
    console.log('\n🔍 GATE VERIFICATION RESULTS:');
    console.log(`FTS5 Support: ${fts5Available ? '✅ AVAILABLE' : '❌ MISSING'}`);
    console.log(`Recursive CTEs: ${recursiveCTEAvailable ? '✅ AVAILABLE' : '❌ MISSING'}`);

    const gateStatus = fts5Available && recursiveCTEAvailable;
    console.log(`\n🚪 Phase 2 Gate Status: ${gateStatus ? '✅ OPEN - Ready for SuperGrid' : '❌ BLOCKED'}`);

    if (!gateStatus) {
      console.log('\n🚨 GATE REQUIREMENTS NOT MET:');
      if (!fts5Available) console.log('- FTS5 full-text search required for nodes_fts virtual tables');
      if (!recursiveCTEAvailable) console.log('- Recursive CTEs required for GRAPH traversal queries');
      console.log('\nPhase 2 SuperGrid implementation cannot begin until these are resolved.');
    }

    return gateStatus;

  } catch (error) {
    console.error(`💥 sql.js capabilities test FAILED: ${error.message}`);
    return false;
  }
}

// Run the test
testSQLJSCapabilities()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });