import React, { useState, useCallback, useEffect } from 'react';
import { useMockData } from '../hooks/useMockData';
import { PAFVViewSwitcher } from './views/PAFVViewSwitcher';
import { usePAFV } from '../hooks/usePAFV';
import { performanceTracker } from './views/PerformanceMonitor';
import type { Node } from '@/types/node';
import type { ViewType } from '@/types/view';

/**
 * ViewRendererTest - Comprehensive testing component for ViewRenderer system
 *
 * Features:
 * - Performance benchmarking with large datasets
 * - Edge case testing (empty data, error states)
 * - Memory usage monitoring during stress tests
 * - Automated transition testing
 * - View switching performance validation
 */

interface TestScenario {
  name: string;
  description: string;
  dataSize: number;
  transitions: number;
  autoRun?: boolean;
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Empty Data',
    description: 'Test behavior with no data',
    dataSize: 0,
    transitions: 5,
    autoRun: true
  },
  {
    name: 'Small Dataset',
    description: 'Normal usage with small dataset',
    dataSize: 50,
    transitions: 10,
    autoRun: true
  },
  {
    name: 'Medium Dataset',
    description: 'Typical usage with medium dataset',
    dataSize: 500,
    transitions: 10,
    autoRun: false
  },
  {
    name: 'Large Dataset',
    description: 'Stress test with large dataset',
    dataSize: 2000,
    transitions: 10,
    autoRun: false
  },
  {
    name: 'Extreme Dataset',
    description: 'Maximum stress test',
    dataSize: 10000,
    transitions: 5,
    autoRun: false
  }
];

interface TestResult {
  scenario: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration: number;
  averageTransitionTime: number;
  memoryUsage?: number;
  frameRate: number;
  details?: string;
}

export function ViewRendererTest() {
  const [selectedScenario, setSelectedScenario] = useState<TestScenario>(TEST_SCENARIOS[0]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testData, setTestData] = useState<Node[]>([]);
  const [currentTransition, setCurrentTransition] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const { data: mockData } = useMockData();
  const { setViewMode } = usePAFV();
  // Removed unused testIntervalRef - performance testing now uses different timing mechanism

  // Generate test data based on scenario
  const generateTestData = useCallback((size: number): Node[] => {
    if (size === 0) return [];
    if (!mockData || mockData.length === 0) return [];

    const data: Node[] = [];
    for (let i = 0; i < size; i++) {
      const templateNode = mockData[i % mockData.length];
      data.push({
        ...templateNode,
        id: `test-node-${i}`,
        name: `Test Node ${i + 1}`,
        content: `Generated test content for node ${i + 1}`,
        summary: `Test summary for performance testing`,
        createdAt: new Date(Date.now() - (i * 60000)).toISOString()
      });
    }
    return data;
  }, [mockData]);

  // Run automated test scenario
  const runTestScenario = useCallback(async (scenario: TestScenario) => {
    if (isRunningTest) return;

    setIsRunningTest(true);
    setCurrentTransition(0);

    const startTime = performance.now();
    const startMemory = 'memory' in performance && performance.memory
      ? (performance.memory as MemoryInfo).usedJSHeapSize / 1024 / 1024
      : 0;

    // Generate test data
    const data = generateTestData(scenario.dataSize);
    setTestData(data);

    // Reset performance tracker
    performanceTracker.clearMetrics();

    try {
      // Perform automated view transitions
      const viewTypes: ViewType[] = ['grid', 'list'];

      for (let i = 0; i < scenario.transitions; i++) {
        const viewType = viewTypes[i % 2];
        setCurrentTransition(i + 1);

        // Switch view and wait for transition
        setViewMode(viewType);
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      // Calculate results
      const endTime = performance.now();
      const endMemory = 'memory' in performance && performance.memory
        ? (performance.memory as MemoryInfo).usedJSHeapSize / 1024 / 1024
        : 0;
      const stats = performanceTracker.getStats();

      const result: TestResult = {
        scenario: scenario.name,
        status: 'completed',
        duration: Math.round(endTime - startTime),
        averageTransitionTime: stats.averageTransitionTime,
        memoryUsage: endMemory - (startMemory || 0),
        frameRate: stats.frameRate || 60,
        details: `${scenario.dataSize} items, ${scenario.transitions} transitions`
      };

      setTestResults(prev => [...prev.filter(r => r.scenario !== scenario.name), result]);

    } catch (error) {
      const result: TestResult = {
        scenario: scenario.name,
        status: 'failed',
        duration: 0,
        averageTransitionTime: 0,
        frameRate: 0,
        details: `Error: ${(error as Error).message}`
      };

      setTestResults(prev => [...prev.filter(r => r.scenario !== scenario.name), result]);
    } finally {
      setIsRunningTest(false);
      setCurrentTransition(0);
    }
  }, [isRunningTest, generateTestData, setViewMode]);

  // Run all auto-run scenarios
  const runAutoTests = useCallback(async () => {
    for (const scenario of TEST_SCENARIOS.filter(s => s.autoRun)) {
      await runTestScenario(scenario);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between tests
    }
  }, [runTestScenario]);

  // Auto-run tests when component mounts
  useEffect(() => {
    if (mockData && mockData.length > 0 && testResults.length === 0) {
      runAutoTests();
    }
  }, [mockData, testResults.length, runAutoTests]);

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node);
  }, []);

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'running': return 'text-blue-600';
      case 'pending': return 'text-gray-500';
    }
  };

  const getPerformanceRating = (transitionTime: number) => {
    if (transitionTime < 100) return { rating: 'Excellent', color: 'text-green-600' };
    if (transitionTime < 200) return { rating: 'Good', color: 'text-blue-600' };
    if (transitionTime < 300) return { rating: 'Fair', color: 'text-yellow-600' };
    return { rating: 'Poor', color: 'text-red-600' };
  };

  return (
    <div className="view-renderer-test p-6 space-y-6">
      {/* Test Header */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">ViewRenderer Performance Testing</h2>
        <div className="text-sm text-gray-600 mb-4">
          Comprehensive testing suite for view transitions, performance, and edge cases
        </div>

        {/* Test Scenarios */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEST_SCENARIOS.map(scenario => {
            const result = testResults.find(r => r.scenario === scenario.name);
            const isSelected = selectedScenario.name === scenario.name;
            const isRunning = isRunningTest && isSelected;

            return (
              <div
                key={scenario.name}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                } ${isRunning ? 'opacity-75' : ''}`}
                onClick={() => !isRunningTest && setSelectedScenario(scenario)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{scenario.name}</h3>
                  {result && (
                    <div className={`text-xs font-medium ${getStatusColor(result.status)}`}>
                      {result.status}
                    </div>
                  )}
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  {scenario.description}
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <div>Items: {scenario.dataSize.toLocaleString()}</div>
                  <div>Transitions: {scenario.transitions}</div>
                  {result && result.status === 'completed' && (
                    <>
                      <div>Duration: {result.duration}ms</div>
                      <div className={getPerformanceRating(result.averageTransitionTime).color}>
                        Avg Transition: {result.averageTransitionTime}ms
                      </div>
                    </>
                  )}
                </div>

                {isRunning && (
                  <div className="mt-2 text-xs text-blue-600">
                    Running... ({currentTransition}/{scenario.transitions})
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Test Controls */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => runTestScenario(selectedScenario)}
            disabled={isRunningTest}
            className={`px-4 py-2 rounded font-medium ${
              isRunningTest
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRunningTest ? 'Running...' : `Run ${selectedScenario.name}`}
          </button>

          <button
            onClick={() => {
              const data = generateTestData(selectedScenario.dataSize);
              setTestData(data);
            }}
            disabled={isRunningTest}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            Generate Data Only
          </button>

          <button
            onClick={() => setTestResults([])}
            disabled={isRunningTest}
            className="px-4 py-2 bg-red-100 text-red-700 rounded font-medium hover:bg-red-200 disabled:opacity-50"
          >
            Clear Results
          </button>
        </div>
      </div>

      {/* Test Results Summary */}
      {testResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h3 className="font-medium mb-4">Test Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Scenario</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Duration</th>
                  <th className="text-right py-2">Avg Transition</th>
                  <th className="text-right py-2">Memory</th>
                  <th className="text-right py-2">FPS</th>
                  <th className="text-left py-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {testResults.map(result => {
                  const rating = getPerformanceRating(result.averageTransitionTime);
                  return (
                    <tr key={result.scenario} className="border-b">
                      <td className="py-2 font-medium">{result.scenario}</td>
                      <td className={`py-2 ${getStatusColor(result.status)}`}>
                        {result.status}
                      </td>
                      <td className="py-2 text-right">{result.duration}ms</td>
                      <td className="py-2 text-right">{result.averageTransitionTime}ms</td>
                      <td className="py-2 text-right">
                        {result.memoryUsage ? `+${result.memoryUsage.toFixed(1)}MB` : '-'}
                      </td>
                      <td className="py-2 text-right">{result.frameRate}</td>
                      <td className={`py-2 ${rating.color}`}>{rating.rating}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Live Test Area */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Live Test Area</h3>
              <div className="text-sm text-gray-600">
                {testData.length.toLocaleString()} items loaded
                {isRunningTest && (
                  <span className="ml-2 text-blue-600">
                    (Testing in progress: {currentTransition}/{selectedScenario.transitions})
                  </span>
                )}
              </div>
            </div>
            {selectedNode && (
              <div className="text-sm text-gray-600">
                Selected: {selectedNode.name}
              </div>
            )}
          </div>
        </div>

        <div className="h-full">
          {testData.length > 0 ? (
            <PAFVViewSwitcher
              data={testData}
              onNodeClick={handleNodeClick}
              transitionConfig={{
                duration: 300,
                easing: 'ease-out'
              }}
              showPerformanceMonitor={true}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a test scenario and click "Generate Data Only" to load test data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ViewRendererTest;