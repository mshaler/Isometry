import { useState } from 'react';
import { SQLiteProvider, useSQLite } from '../db/SQLiteProvider';
import { contextLogger } from '../utils/logging/dev-logger';
import { useNodesV4, useFTS5SearchV4, useGraphTraversalV4 } from '../hooks/database/useSQLiteQuery.v4';
import type { Node } from '../types/node';

/**
 * SQLiteV4Demo - Demonstrates the bridge elimination architecture
 *
 * Shows:
 * - Direct sql.js database access
 * - Synchronous queries (no promises)
 * - FTS5 full-text search
 * - Recursive CTE graph traversal
 * - LATCH filtering capabilities
 */

function SQLiteControls() {
  const { db, loading, error, execute, run } = useSQLite();
  const [queryText, setQueryText] = useState('SELECT COUNT(*) as count FROM nodes');
  const [queryResult, setQueryResult] = useState<any[]>([]);

  const executeCustomQuery = () => {
    if (!db) return;

    try {
      const results = execute(queryText);
      setQueryResult(results);
    } catch (err) {
      console.error('Query failed:', err);
      setQueryResult([{ error: (err as Error).message }]);
    }
  };

  const addSampleData = () => {
    if (!db) return;

    try {
      // Insert sample nodes using sql.js directly
      run(`
        INSERT OR REPLACE INTO nodes (id, name, content, folder, status, priority)
        VALUES
          ('demo-1', 'SQL.js Test Node 1', 'This is a test node for sql.js integration', 'demo', 'active', 1),
          ('demo-2', 'SQL.js Test Node 2', 'Another test node with different content', 'demo', 'completed', 2),
          ('demo-3', 'Search Test Node', 'This node tests FTS5 full-text search capabilities', 'search', 'active', 3)
      `);

      // Insert sample edges
      run(`
        INSERT OR REPLACE INTO edges (id, edge_type, source_id, target_id, label)
        VALUES
          ('edge-1', 'LINK', 'demo-1', 'demo-2', 'related_to'),
          ('edge-2', 'SEQUENCE', 'demo-2', 'demo-3', 'leads_to')
      `);

      contextLogger.metrics('Sample data inserted', {});
    } catch (err) {
      contextLogger.state('Failed to insert sample data', { error: err });
    }
  };

  if (loading) return <div className="p-4">Loading SQLite...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error.message}</div>;
  if (!db) return <div className="p-4">No database available</div>;

  return (
    <div className="p-4 bg-white border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold">SQL.js Direct Access</h3>

      <div className="space-y-2">
        <button
          onClick={addSampleData}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Sample Data
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Custom Query:</label>
        <textarea
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          className="w-full p-2 border rounded font-mono text-sm"
          rows={3}
        />
        <button
          onClick={executeCustomQuery}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Execute Query
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Results:</label>
        <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
          {JSON.stringify(queryResult, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function NodeQueryDemo() {
  const { data: nodes, loading, error, duration } = useNodesV4();

  return (
    <div className="p-4 bg-white border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold">Node Query Hook</h3>

      <div className="text-sm text-gray-600">
        Query duration: {duration?.toFixed(2)}ms
      </div>

      {loading && <div>Loading nodes...</div>}
      {error && <div className="text-red-600">Error: {error.message}</div>}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Nodes ({nodes?.length || 0}):</label>
        <div className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
          {nodes?.map((node: Node) => (
            <div key={node.id} className="border-b py-1">
              <strong>{node.name}</strong> - {node.folder} ({node.status})
            </div>
          )) || 'No nodes found'}
        </div>
      </div>
    </div>
  );
}

function FTS5SearchDemo() {
  const [searchQuery, setSearchQuery] = useState('test');
  const { data: searchResults, loading, error, duration } = useFTS5SearchV4(searchQuery);

  return (
    <div className="p-4 bg-white border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold">FTS5 Full-Text Search</h3>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Search:</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Enter search query..."
        />
      </div>

      <div className="text-sm text-gray-600">
        Query duration: {duration?.toFixed(2)}ms
      </div>

      {loading && <div>Searching...</div>}
      {error && <div className="text-red-600">Error: {error.message}</div>}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Results ({searchResults?.length || 0}):</label>
        <div className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
          {searchResults?.map((node: Node) => (
            <div key={node.id} className="border-b py-1">
              <strong>{node.name}</strong> - {node.content?.substring(0, 100)}...
            </div>
          )) || 'No results found'}
        </div>
      </div>
    </div>
  );
}

function GraphTraversalDemo() {
  const [startNodeId, setStartNodeId] = useState('demo-1');
  const { data: connectedNodes, loading, error, duration } = useGraphTraversalV4(startNodeId);

  return (
    <div className="p-4 bg-white border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold">Recursive CTE Graph Traversal</h3>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Start Node ID:</label>
        <input
          type="text"
          value={startNodeId}
          onChange={(e) => setStartNodeId(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Enter node ID..."
        />
      </div>

      <div className="text-sm text-gray-600">
        Query duration: {duration?.toFixed(2)}ms
      </div>

      {loading && <div>Traversing graph...</div>}
      {error && <div className="text-red-600">Error: {error.message}</div>}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Connected Nodes ({connectedNodes?.length || 0}):</label>
        <div className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
          {connectedNodes?.map(node => (
            <div key={node.id} className="border-b py-1">
              <strong>{node.name}</strong> - {node.id}
            </div>
          )) || 'No connected nodes found'}
        </div>
      </div>
    </div>
  );
}

function SQLiteV4DemoContent() {
  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold mb-2">SQLite v4 Bridge Elimination Demo</h1>
        <p className="text-gray-600">
          Demonstrates direct sql.js access with FTS5, JSON1, and recursive CTEs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SQLiteControls />
        <NodeQueryDemo />
        <FTS5SearchDemo />
        <GraphTraversalDemo />
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">Architecture Notes:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Direct sql.js access eliminates 40KB MessageBridge</li>
          <li>• Synchronous queries in same memory space as D3.js</li>
          <li>• FTS5 full-text search with virtual tables</li>
          <li>• Recursive CTEs for graph traversal</li>
          <li>• Zero serialization overhead</li>
        </ul>
      </div>
    </div>
  );
}

export function SQLiteV4Demo() {
  return (
    <SQLiteProvider enableLogging={true}>
      <SQLiteV4DemoContent />
    </SQLiteProvider>
  );
}

export default SQLiteV4Demo;