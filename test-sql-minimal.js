// Minimal sql.js test to verify WASM loading
import initSqlJs from 'sql.js-fts5';

async function testSqlJs() {
  try {
    console.log('Initializing sql.js...');
    const SQL = await initSqlJs({
      locateFile: (file) => {
        console.log('Looking for:', file);
        const absolutePath = new URL(`./node_modules/sql.js-fts5/dist/${file}`, import.meta.url);
        console.log('File path:', absolutePath.pathname);
        return absolutePath.pathname;
      }
    });

    console.log('Creating database...');
    const db = new SQL.Database();

    console.log('Testing basic query...');
    db.run("CREATE TABLE test (id INTEGER, name TEXT);");
    db.run("INSERT INTO test VALUES (1, 'hello');");

    const result = db.exec("SELECT * FROM test;");
    console.log('Query result:', result);

    db.close();
    console.log('✅ sql.js basic functionality works!');

  } catch (error) {
    console.error('❌ sql.js test failed:', error);
  }
}

testSqlJs();