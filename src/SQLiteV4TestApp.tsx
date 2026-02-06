import { SQLiteProvider, useSQLite } from './db/SQLiteProvider';

/**
 * Simple test component to verify sql.js integration
 */
function SQLiteTestComponent() {
  const { db, loading, error } = useSQLite();

  if (loading) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold mb-4">SQLite v4 Integration Test</h2>
        <p>Loading sql.js database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold mb-4">SQLite v4 Integration Test</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error.message}
        </div>
      </div>
    );
  }

  if (!db) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold mb-4">SQLite v4 Integration Test</h2>
        <p>No database available</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">SQLite v4 Integration Test</h2>
      <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
        <strong>Success!</strong> sql.js database initialized successfully.
        <br />
        Bridge elimination architecture is working.
      </div>
    </div>
  );
}

export function SQLiteV4TestApp() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SQLiteProvider enableLogging={true}>
        <SQLiteTestComponent />
      </SQLiteProvider>
    </div>
  );
}

export default SQLiteV4TestApp;