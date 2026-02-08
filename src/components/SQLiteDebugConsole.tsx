import { useEffect, useState } from 'react';
import { useSQLite } from '../db/SQLiteProvider';
import { contextLogger } from '../utils/dev-logger';

/**
 * Debug console to diagnose SQLite issues
 */
export function SQLiteDebugConsole() {
  const { db, loading, error, execute, capabilities, telemetry } = useSQLite();
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    if (!db || loading) return;

    const runDebugQueries = async () => {
      try {
        contextLogger.setup('SQLiteDebugConsole: Running diagnostic queries', {});

        // Test basic query
        const countResult = execute('SELECT COUNT(*) as count FROM nodes WHERE deleted_at IS NULL');
        contextLogger.data('SQLiteDebugConsole: Node count query result', countResult);

        // Get sample nodes
        const sampleNodes = execute('SELECT id, name, folder, status, grid_x, grid_y FROM nodes WHERE deleted_at IS NULL LIMIT 5');
        contextLogger.data('SQLiteDebugConsole: Sample nodes', sampleNodes);

        // Check table info
        const tables = execute("SELECT name FROM sqlite_master WHERE type='table'");
        contextLogger.data('SQLiteDebugConsole: Available tables', tables);

        setDebugInfo({
          nodeCount: countResult,
          sampleNodes,
          tables,
          capabilities,
          telemetry,
          hasDatabase: !!db,
          loading,
          error: error?.message
        });

      } catch (err) {
        contextLogger.state('SQLiteDebugConsole: Debug query failed', { error: err });
        setDebugInfo({
          error: err instanceof Error ? err.message : String(err),
          capabilities,
          telemetry,
          hasDatabase: !!db,
          loading
        });
      }
    };

    runDebugQueries();
  }, [db, loading, error, execute, capabilities, telemetry]);

  if (loading) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-300 rounded">
        <h3 className="font-bold">SQLite Debug Console</h3>
        <p>Loading SQLite database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 rounded">
        <h3 className="font-bold text-red-800">SQLite Error</h3>
        <p className="text-red-600">{error.message}</p>
        <details className="mt-2">
          <summary className="cursor-pointer">Telemetry</summary>
          <pre className="text-xs bg-red-50 p-2 mt-1 overflow-auto">
            {JSON.stringify(telemetry, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  if (!debugInfo) {
    return (
      <div className="p-4 bg-gray-100 border border-gray-300 rounded">
        <h3 className="font-bold">SQLite Debug Console</h3>
        <p>Running diagnostic queries...</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-100 border border-blue-300 rounded">
      <h3 className="font-bold text-blue-800">SQLite Debug Console</h3>

      <div className="mt-3 space-y-2">
        <div>
          <strong>Status:</strong> {debugInfo.hasDatabase ? '✅ Connected' : '❌ No Database'}
        </div>

        {debugInfo.nodeCount && (
          <div>
            <strong>Node Count:</strong> {JSON.stringify(debugInfo.nodeCount)}
          </div>
        )}

        {debugInfo.tables && (
          <div>
            <strong>Tables:</strong> {debugInfo.tables.map((t: any) => t.name).join(', ')}
          </div>
        )}

        <div>
          <strong>Capabilities:</strong>
          <ul className="list-disc list-inside ml-4">
            <li>FTS5: {capabilities.fts5 ? '✅' : '❌'}</li>
            <li>JSON1: {capabilities.json1 ? '✅' : '❌'}</li>
            <li>Recursive CTE: {capabilities.recursiveCte ? '✅' : '❌'}</li>
          </ul>
        </div>

        {debugInfo.sampleNodes && debugInfo.sampleNodes.length > 0 && (
          <details>
            <summary className="cursor-pointer font-semibold">Sample Nodes ({debugInfo.sampleNodes.length})</summary>
            <pre className="text-xs bg-blue-50 p-2 mt-1 overflow-auto max-h-40">
              {JSON.stringify(debugInfo.sampleNodes, null, 2)}
            </pre>
          </details>
        )}

        {telemetry.length > 0 && (
          <details>
            <summary className="cursor-pointer font-semibold">Telemetry ({telemetry.length} items)</summary>
            <pre className="text-xs bg-blue-50 p-2 mt-1 overflow-auto max-h-40">
              {JSON.stringify(telemetry, null, 2)}
            </pre>
          </details>
        )}

        {debugInfo.error && (
          <div className="text-red-600">
            <strong>Error:</strong> {debugInfo.error}
          </div>
        )}
      </div>
    </div>
  );
}