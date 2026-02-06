// Quick test of sql.js-fts5 capabilities
import initSqlJs from 'sql.js-fts5';

async function testSQLiteCapabilities() {
  console.log('🔧 Testing sql.js-fts5 capabilities...');

  try {
    const SQL = await initSqlJs({
      locateFile: file => `/wasm/${file}`
    });

    const db = new SQL.Database();

    console.log('✅ sql.js-fts5 loaded successfully');

    // Test FTS5
    try {
      const result = db.exec("SELECT fts5_version() AS version");
      console.log('✅ FTS5 support verified:', result[0].values[0][0]);
    } catch (err) {
      console.error('❌ FTS5 not available:', err.message);
    }

    // Test JSON1
    try {
      const result = db.exec("SELECT json('{\"test\": true}') AS json_result");
      console.log('✅ JSON1 support verified:', result[0].values[0][0]);
    } catch (err) {
      console.error('❌ JSON1 not available:', err.message);
    }

    // Test recursive CTE
    try {
      const result = db.exec(`
        WITH RECURSIVE test_cte(n) AS (
          SELECT 1
          UNION ALL
          SELECT n+1 FROM test_cte WHERE n < 3
        )
        SELECT COUNT(*) as count FROM test_cte
      `);
      console.log('✅ Recursive CTE support verified, count:', result[0].values[0][0]);
    } catch (err) {
      console.error('❌ Recursive CTE not available:', err.message);
    }

    db.close();
  } catch (err) {
    console.error('💥 sql.js-fts5 initialization failed:', err);
  }
}

// Add to window for browser console testing
if (typeof window !== 'undefined') {
  window.testSQLiteCapabilities = testSQLiteCapabilities;
}

export default testSQLiteCapabilities;