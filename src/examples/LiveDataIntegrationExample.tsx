// @ts-nocheck
/**
 * Live Data Integration Example
 *
 * Comprehensive example demonstrating end-to-end live data flow
 * with performance monitoring and real-time updates.
 */

import React, { useEffect, useState } from 'react';
import { LiveDataProvider, useLiveDataSubscription as _useLiveDataSubscription, useLiveDataGlobalState } from '../contexts/LiveDataContext';
const useLiveDataSubscription = _useLiveDataSubscription as any;
import DataFlowMonitor, { DataFlowStatusIndicator, useDataFlowMonitor } from '../components/DataFlowMonitor';
import { useLiveData, invalidateLiveData } from '../hooks/database/useLiveData';
import type { Node } from '../types/node';

// Example component that uses live data for recent nodes
const RecentNodesComponent: React.FC = () => {
  const { data: nodes, isLoading, error, refresh } = (useLiveDataSubscription as any)(
    'recent-nodes',
    `SELECT id, name, content, modifiedAt
     FROM nodes
     WHERE deleted_at IS NULL
     ORDER BY modifiedAt DESC
     LIMIT 10`,
    [],
    {
      enablePolling: true,
      pollingIntervalMs: 2000,
      throttleMs: 500
    }
  );

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Recent Notes</h3>
        <div className="flex items-center gap-2">
          <DataFlowStatusIndicator showLatency={true} />
          <button
            onClick={refresh}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {isLoading && <div className="text-gray-500">Loading...</div>}

      {error && (
        <div className="text-red-600 bg-red-50 p-2 rounded text-sm">
          Error: {error}
        </div>
      )}

      {nodes && (
        <div className="space-y-2">
          {nodes.length === 0 ? (
            <div className="text-gray-500 text-sm">No notes found</div>
          ) : (
            nodes.map((node: Node) => (
              <div key={node.id} className="p-2 bg-gray-50 rounded text-sm">
                <div className="font-medium truncate">{node.name}</div>
                <div className="text-gray-600 text-xs">
                  Modified: {new Date(node.modifiedAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Example component with search functionality
const SearchComponent: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Node[]>([]);

  const { data, isLoading, error } = useLiveData<Node[]>(
    `SELECT nodes.*, snippet(nodes_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
     FROM nodes_fts
     JOIN nodes ON nodes.rowid = nodes_fts.rowid
     WHERE nodes_fts MATCH ? AND nodes.deleted_at IS NULL
     ORDER BY rank
     LIMIT 20`,
    searchQuery ? [searchQuery] : undefined,
    {
      throttleMs: 300,
      enablePolling: false,
      trackPerformance: true
    }
  );

  useEffect(() => {
    if (data) {
      setSearchResults(data);
    }
  }, [data]);

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="mb-3">
        <h3 className="text-lg font-semibold mb-2">Search Notes</h3>
        <input
          type="text"
          placeholder="Enter search terms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        />
      </div>

      {isLoading && searchQuery && (
        <div className="text-gray-500 text-sm">Searching...</div>
      )}

      {error && (
        <div className="text-red-600 bg-red-50 p-2 rounded text-sm">
          Search error: {error}
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-2 mt-3">
          <div className="text-sm text-gray-600">
            Found {searchResults.length} results
          </div>
          {searchResults.map(node => (
            <div key={node.id} className="p-2 bg-gray-50 rounded text-sm">
              <div className="font-medium truncate">{node.name}</div>
              {(node as any).snippet && (
                <div
                  className="text-gray-600 text-xs mt-1"
                  dangerouslySetInnerHTML={{ __html: (node as any).snippet }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Performance monitoring component
const PerformanceDisplay: React.FC = () => {
  const globalState = useLiveDataGlobalState();
  const monitor = useDataFlowMonitor();

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-3">Performance Metrics</h3>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-600">Connection Status</div>
          <div className={`font-semibold ${
            globalState.isConnected ? 'text-green-600' : 'text-red-600'
          }`}>
            {globalState.isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <div>
          <div className="text-gray-600">Connection Quality</div>
          <div className="font-semibold">
            {globalState.connectionQuality.charAt(0).toUpperCase() +
             globalState.connectionQuality.slice(1)}
          </div>
        </div>

        <div>
          <div className="text-gray-600">Average Latency</div>
          <div className={`font-semibold ${
            globalState.averageLatency < 100 ? 'text-green-600' :
            globalState.averageLatency < 200 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {globalState.averageLatency.toFixed(1)}ms
          </div>
        </div>

        <div>
          <div className="text-gray-600">Error Rate</div>
          <div className={`font-semibold ${
            globalState.errorRate < 1 ? 'text-green-600' :
            globalState.errorRate < 5 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {globalState.errorRate.toFixed(1)}%
          </div>
        </div>

        <div>
          <div className="text-gray-600">Active Subscriptions</div>
          <div className="font-semibold">{globalState.totalSubscriptions}</div>
        </div>

        <div>
          <div className="text-gray-600">Health Score</div>
          <div className={`font-semibold ${
            monitor.healthScore > 80 ? 'text-green-600' :
            monitor.healthScore > 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {monitor.healthScore.toFixed(0)}/100
          </div>
        </div>
      </div>

      {globalState.lastSyncTime && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            Last sync: {globalState.lastSyncTime.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

// Control panel for testing live data features
const ControlPanel: React.FC = () => {
  const globalState = useLiveDataGlobalState();
  const [testMode, setTestMode] = useState<'normal' | 'stress' | 'error'>('normal');

  const handleStressTest = () => {
    setTestMode('stress');

    // Create multiple rapid subscriptions
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        invalidateLiveData('stress-test');
      }, i * 100);
    }

    // Reset after stress test
    setTimeout(() => {
      setTestMode('normal');
    }, 5000);
  };

  const handleClearCache = () => {
    globalState.clearCache();
  };

  const handleRefreshAll = () => {
    globalState.refreshAll();
  };

  const simulateError = () => {
    setTestMode('error');
    // Simulate bridge disconnection
    window.dispatchEvent(new CustomEvent('isometry-bridge-error'));

    setTimeout(() => {
      setTestMode('normal');
      window.dispatchEvent(new CustomEvent('isometry-bridge-ready'));
    }, 3000);
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-3">Live Data Controls</h3>

      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleRefreshAll}
            className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Refresh All
          </button>

          <button
            onClick={handleClearCache}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Clear Cache
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleStressTest}
            disabled={testMode === 'stress'}
            className="px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50"
          >
            {testMode === 'stress' ? 'Running Stress Test...' : 'Stress Test'}
          </button>

          <button
            onClick={simulateError}
            disabled={testMode === 'error'}
            className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
          >
            {testMode === 'error' ? 'Simulating Error...' : 'Simulate Error'}
          </button>
        </div>
      </div>

      {testMode !== 'normal' && (
        <div className="mt-3 p-2 rounded text-sm bg-blue-50 border-l-4 border-blue-400">
          <div className="font-medium">Test Mode: {testMode.toUpperCase()}</div>
          <div className="text-xs text-gray-600">
            {testMode === 'stress' && 'Testing rapid invalidation and subscription management'}
            {testMode === 'error' && 'Testing error handling and recovery mechanisms'}
          </div>
        </div>
      )}
    </div>
  );
};

// Main integration example component
const LiveDataIntegrationExample: React.FC = () => {
  const [showMonitor, setShowMonitor] = useState(true);

  return (
    <LiveDataProvider
      {...({
        enableGlobalSync: true,
        syncIntervalMs: 30000,
        enableConnectionMonitoring: true
      } as any)}
    >
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Live Data Integration Demo</h1>
          <p className="text-gray-600">
            Real-time data subscriptions with performance monitoring and debugging
          </p>

          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={() => setShowMonitor(!showMonitor)}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              {showMonitor ? 'Hide Monitor' : 'Show Monitor'}
            </button>

            <DataFlowStatusIndicator showLatency={true} className="text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Data Components */}
          <div className="space-y-6">
            <RecentNodesComponent />
            <SearchComponent />
          </div>

          {/* Monitoring and Controls */}
          <div className="space-y-6">
            <PerformanceDisplay />
            <ControlPanel />
          </div>
        </div>

        {/* Performance Monitor */}
        {showMonitor && (
          <DataFlowMonitor
            isVisible={true}
            position="floating"
            compact={false}
            realTime={true}
            enableConsoleLogging={true}
            draggable={true}
          />
        )}
      </div>
    </LiveDataProvider>
  );
};

export default LiveDataIntegrationExample;

/**
 * Example usage in main app:
 *
 * import LiveDataIntegrationExample from './examples/LiveDataIntegrationExample';
 *
 * function App() {
 *   return (
 *     <div className="App">
 *       <LiveDataIntegrationExample />
 *     </div>
 *   );
 * }
 */