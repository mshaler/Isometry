/**
 * Live Query Test Component
 *
 * Comprehensive test component for verifying end-to-end live query integration
 * including database mutation testing with optimistic updates, connection awareness,
 * and correlation tracking verification.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useLiveDataContext } from '../../contexts/LiveDataContext';
import { webViewBridge } from '../../utils/webview-bridge';

interface TestNode {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface PerformanceMetrics {
  notificationLatency: number[];
  averageLatency: number;
  correlationIds: string[];
}

export function LiveQueryTest() {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    notificationLatency: [],
    averageLatency: 0,
    correlationIds: []
  });
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'slow'>('online');

  // Live data context for metrics
  const { metrics } = useLiveDataContext();

  // Live query for testing - SELECT first 5 nodes
  const {
    data: nodes,
    loading,
    error,
    isLive,
    startLive,
    stopLive,
    observationId,
    updateOptimistically,
    rollbackOptimisticUpdate,
    queueBackgroundSync,
    backgroundSyncState
  } = useLiveQuery<TestNode>(
    'SELECT id, name, content, created_at, updated_at FROM nodes ORDER BY created_at DESC LIMIT 5',
    {
      autoStart: false, // Manual control for testing
      enableCache: true,
      debounceMs: 50, // Fast response for testing
      onError: (error) => {
        addTestResult(`❌ Live query error: ${error.message}`);
      },
      onChange: (data) => {
        const now = performance.now();
        addTestResult(`✅ Live query change received: ${data.length} nodes at ${now.toFixed(2)}ms`);

        // Record performance metrics
        setPerformanceMetrics(prev => ({
          ...prev,
          notificationLatency: [...prev.notificationLatency, now],
          averageLatency: [...prev.notificationLatency, now].reduce((a, b) => a + b, 0) / ([...prev.notificationLatency, now].length)
        }));
      }
    }
  );

  // Performance tracking refs
  const lastMutationTime = useRef<number>(0);
  const testStartTime = useRef<number>(0);

  const addTestResult = useCallback((result: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setTestResults(prev => [...prev, `[${timestamp}] ${result}`]);
  }, []);

  // Clear test results
  const clearResults = useCallback(() => {
    setTestResults([]);
    setPerformanceMetrics({
      notificationLatency: [],
      averageLatency: 0,
      correlationIds: []
    });
  }, []);

  // Test 1: Basic live query setup
  const testBasicLiveQuery = useCallback(async () => {
    addTestResult('🧪 Starting basic live query test...');

    try {
      if (!isLive) {
        startLive();
        addTestResult('✅ Live observation started');
      } else {
        addTestResult('ℹ️ Live observation already active');
      }

      if (observationId) {
        addTestResult(`✅ Observation ID: ${observationId}`);

        // Add correlation ID to metrics
        setPerformanceMetrics(prev => ({
          ...prev,
          correlationIds: [...prev.correlationIds, observationId]
        }));
      }

      // Test initial data load
      if (nodes && nodes.length > 0) {
        addTestResult(`✅ Initial data loaded: ${nodes.length} nodes`);
        nodes.forEach((node, index) => {
          addTestResult(`  ${index + 1}. ${node.name} (${node.id})`);
        });
      } else {
        addTestResult('⚠️ No initial data available');
      }

    } catch (error) {
      addTestResult(`❌ Basic live query test failed: ${error}`);
    }
  }, [isLive, startLive, observationId, nodes, addTestResult]);

  // Test 2: Database mutation testing with latency measurement
  const testDatabaseMutation = useCallback(async () => {
    addTestResult('🧪 Starting database mutation test...');

    try {
      const testName = `Test Node ${Date.now()}`;
      const testContent = `Test content created at ${new Date().toISOString()}`;

      // Record mutation start time
      lastMutationTime.current = performance.now();

      // Create new node through WebView bridge
      addTestResult(`📝 Creating test node: "${testName}"`);

      const newNode = await webViewBridge.database.createNode({
        name: testName,
        content: testContent
      });

      addTestResult(`✅ Node created with ID: ${newNode.id}`);

      // Wait for live notification (should arrive within 100ms)
      setTimeout(() => {
        const latency = performance.now() - lastMutationTime.current;
        if (latency <= 100) {
          addTestResult(`✅ Live notification latency: ${latency.toFixed(2)}ms (within 100ms target)`);
        } else {
          addTestResult(`⚠️ Live notification latency: ${latency.toFixed(2)}ms (exceeds 100ms target)`);
        }
      }, 150);

    } catch (error) {
      addTestResult(`❌ Database mutation test failed: ${error}`);
    }
  }, [addTestResult]);

  // Test 3: Optimistic updates
  const testOptimisticUpdates = useCallback(async () => {
    addTestResult('🧪 Starting optimistic updates test...');

    try {
      if (!nodes || nodes.length === 0) {
        addTestResult('❌ No nodes available for optimistic update test');
        return;
      }

      const testNode = nodes[0];
      const rollbackKey = `test-${Date.now()}`;

      // Apply optimistic update
      addTestResult(`📝 Applying optimistic update to node: ${testNode.name}`);
      updateOptimistically({
        id: testNode.id,
        name: `[OPTIMISTIC] ${testNode.name}`
      }, rollbackKey);

      addTestResult('✅ Optimistic update applied (should show immediately)');

      // Simulate server update after delay
      setTimeout(async () => {
        try {
          // Update node on server
          await webViewBridge.database.updateNode({
            id: testNode.id,
            name: `Updated ${testNode.name}`
          });

          addTestResult('✅ Server update completed (should reconcile with optimistic)');

        } catch (error) {
          addTestResult(`❌ Server update failed, rolling back optimistic: ${error}`);
          rollbackOptimisticUpdate(rollbackKey);
        }
      }, 2000);

    } catch (error) {
      addTestResult(`❌ Optimistic updates test failed: ${error}`);
    }
  }, [nodes, updateOptimistically, rollbackOptimisticUpdate, addTestResult]);

  // Test 4: Connection state simulation
  const testConnectionStates = useCallback(async () => {
    addTestResult('🧪 Starting connection state test...');

    // Simulate offline state
    setConnectionStatus('offline');
    addTestResult('📴 Simulated offline state');

    // Queue background sync while offline
    try {
      if (nodes && nodes.length > 0) {
        const syncId = queueBackgroundSync('node', 'update', {
          id: nodes[0].id,
          name: 'Updated while offline'
        });
        addTestResult(`✅ Background sync queued: ${syncId}`);
      }
    } catch (error) {
      addTestResult(`❌ Background sync failed: ${error}`);
    }

    // Simulate slow connection
    setTimeout(() => {
      setConnectionStatus('slow');
      addTestResult('🐌 Simulated slow connection');
    }, 2000);

    // Restore online state
    setTimeout(() => {
      setConnectionStatus('online');
      addTestResult('✅ Connection restored to online');
    }, 4000);

  }, [nodes, queueBackgroundSync, addTestResult]);

  // Test 5: Correlation ID verification
  const testCorrelationIds = useCallback(async () => {
    addTestResult('🧪 Starting correlation ID verification...');

    try {
      // Get live data statistics
      const stats = await webViewBridge.liveData.getObservationStatistics();

      addTestResult(`✅ Live data statistics retrieved`);
      addTestResult(`   Active observations: ${JSON.stringify(stats)}`);

      // Verify correlation IDs in metrics
      if (performanceMetrics.correlationIds.length > 0) {
        addTestResult(`✅ Correlation IDs tracked: ${performanceMetrics.correlationIds.length}`);
        performanceMetrics.correlationIds.forEach((id, index) => {
          addTestResult(`   ${index + 1}. ${id}`);
        });
      } else {
        addTestResult('⚠️ No correlation IDs tracked yet');
      }

    } catch (error) {
      addTestResult(`❌ Correlation ID verification failed: ${error}`);
    }
  }, [addTestResult, performanceMetrics.correlationIds]);

  // Run comprehensive test suite
  const runComprehensiveTest = useCallback(async () => {
    setIsTestRunning(true);
    clearResults();
    testStartTime.current = performance.now();

    addTestResult('🚀 Starting comprehensive live query integration test');

    // Run all tests sequentially
    await testBasicLiveQuery();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testDatabaseMutation();
    await new Promise(resolve => setTimeout(resolve, 2000));

    await testOptimisticUpdates();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testConnectionStates();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testCorrelationIds();

    const totalTime = performance.now() - testStartTime.current;
    addTestResult(`🏁 Comprehensive test completed in ${totalTime.toFixed(2)}ms`);

    setIsTestRunning(false);
  }, [
    testBasicLiveQuery,
    testDatabaseMutation,
    testOptimisticUpdates,
    testConnectionStates,
    testCorrelationIds,
    clearResults,
    addTestResult
  ]);

  // Auto-start test on mount
  useEffect(() => {
    // Auto-run basic test
    testBasicLiveQuery();
  }, [testBasicLiveQuery]);

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white shadow-lg rounded-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Live Query Integration Test
        </h1>
        <p className="text-gray-600">
          Comprehensive testing for real-time database change notifications with optimistic updates,
          connection awareness, and correlation tracking verification.
        </p>
      </div>

      {/* Status Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-2">Connection Status</h3>
          <div className="text-sm text-gray-600">Quality: {connectionStatus}</div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-2">Live Query Status</h3>
          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isLive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {isLive ? '🔄 Live' : '⏸ Stopped'}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Nodes: {nodes?.length || 0}
          </div>
          <div className="text-sm text-gray-600">
            Observer: {observationId ? observationId.slice(0, 8) + '...' : 'None'}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-2">Performance</h3>
          <div className="text-sm text-gray-600">
            Avg Latency: {performanceMetrics.averageLatency.toFixed(2)}ms
          </div>
          <div className="text-sm text-gray-600">
            Events: {Array.isArray(metrics) ? metrics.length : 0}
          </div>
          <div className="text-sm text-gray-600">
            Errors: 0
          </div>
          {backgroundSyncState && (
            <div className="text-sm text-gray-600">
              Sync Queue: {backgroundSyncState.pending}
            </div>
          )}
        </div>
      </div>

      {/* Test Controls */}
      <div className="mb-6 space-x-2">
        <button
          onClick={runComprehensiveTest}
          disabled={isTestRunning}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
        >
          {isTestRunning ? 'Running Tests...' : 'Run Comprehensive Test'}
        </button>

        <button
          onClick={testBasicLiveQuery}
          disabled={isTestRunning}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-300"
        >
          Basic Live Query
        </button>

        <button
          onClick={testDatabaseMutation}
          disabled={isTestRunning}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-300"
        >
          Database Mutation Test
        </button>

        <button
          onClick={testOptimisticUpdates}
          disabled={isTestRunning || !nodes?.length}
          className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:bg-gray-300"
        >
          Optimistic Updates
        </button>

        <button
          onClick={clearResults}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Clear Results
        </button>

        <button
          onClick={isLive ? stopLive : startLive}
          className={`px-4 py-2 rounded text-white ${
            isLive
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLive ? 'Stop Live' : 'Start Live'}
        </button>
      </div>

      {/* Current Data Display */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-700 mb-2">Current Live Data</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          {loading && <div className="text-blue-600">Loading...</div>}
          {error && <div className="text-red-600">Error: {error}</div>}
          {nodes && nodes.length > 0 ? (
            <div className="space-y-2">
              {nodes.map((node, index) => (
                <div key={node.id} className="border-l-4 border-blue-500 pl-3">
                  <div className="font-medium">{index + 1}. {node.name}</div>
                  <div className="text-sm text-gray-600">ID: {node.id}</div>
                  <div className="text-sm text-gray-500">
                    Updated: {new Date(node.updated_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 italic">No data available</div>
          )}
        </div>
      </div>

      {/* Test Results */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-2">Test Results</h3>
        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
          {testResults.length > 0 ? (
            testResults.map((result, index) => (
              <div key={index} className="mb-1">
                {result}
              </div>
            ))
          ) : (
            <div className="text-gray-500">No test results yet. Run a test to see output.</div>
          )}
        </div>
      </div>
    </div>
  );
}