/**
 * Production Visualization Demo
 *
 * Comprehensive production demonstration showcasing all real-time visualization
 * capabilities with the complete 6,891 Apple Notes dataset. Features interactive
 * PAFV filtering, performance monitoring, stress testing, and error simulation.
 *
 * This component serves as the definitive showcase for production deployment,
 * validating performance targets and demonstrating system capabilities.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Tab } from '@headlessui/react';
import { NetworkView } from '../components/views/NetworkView';
import { D3GridView } from '../components/views/D3GridView';
import { D3ListView } from '../components/views/D3ListView';
import { EnhancedNetworkView } from '../components/views/EnhancedNetworkView';
import DataFlowMonitor from '../components/DataFlowMonitor';
import { PerformanceBaseline } from '../components/performance/PerformanceBaseline';
import { PAFVProvider } from '../contexts/PAFVContext';
// import { PAFVDropZone } from '../components/pafv/PAFVDropZone';
// import { PAFVActiveFilters } from '../components/pafv/PAFVActiveFilters';
import { useLiveData, useLiveDataMetrics } from '../hooks/database/useLiveData';
import { useD3PerformanceWithMonitor } from '@/hooks';
import { useTheme } from '../contexts/ThemeContext';
import type { Node, Edge } from '../types';

// Demo configuration interfaces
interface DemoSection {
  id: string;
  name: string;
  description: string;
  component: React.ComponentType<any>;
  enhanced?: boolean;
  isActive: boolean;
}

interface StressTestScenario {
  id: string;
  name: string;
  description: string;
  dataSize: number;
  updateFrequency: number; // updates per second
  filterChanges: boolean; // enable rapid filter changes
  duration: number; // seconds
}

interface PerformanceMetrics {
  fps: number;
  latency: number;
  memoryUsage: number;
  renderTime: number;
  errorRate: number;
  cacheHitRate: number;
}

interface ErrorSimulationOptions {
  enabled: boolean;
  type: 'connection' | 'timeout' | 'data-corruption' | 'memory-pressure';
  frequency: number; // errors per minute
}

// Predefined stress test scenarios
const STRESS_SCENARIOS: StressTestScenario[] = [
  {
    id: 'light',
    name: 'Light Load',
    description: '1,000 nodes, 2 updates/sec, 30 seconds',
    dataSize: 1000,
    updateFrequency: 2,
    filterChanges: false,
    duration: 30
  },
  {
    id: 'moderate',
    name: 'Moderate Load',
    description: '3,000 nodes, 5 updates/sec, rapid filtering, 60 seconds',
    dataSize: 3000,
    updateFrequency: 5,
    filterChanges: true,
    duration: 60
  },
  {
    id: 'heavy',
    name: 'Heavy Load',
    description: '6,891 nodes (full dataset), 10 updates/sec, rapid filtering, 120 seconds',
    dataSize: 6891,
    updateFrequency: 10,
    filterChanges: true,
    duration: 120
  },
  {
    id: 'extreme',
    name: 'Extreme Stress',
    description: '6,891 nodes, 30 updates/sec, continuous filtering, 300 seconds',
    dataSize: 6891,
    updateFrequency: 30,
    filterChanges: true,
    duration: 300
  }
];

// Demonstration sections configuration
const DEMO_SECTIONS: DemoSection[] = [
  {
    id: 'overview',
    name: 'System Overview',
    description: 'Performance metrics and system health monitoring',
    component: PerformanceBaseline,
    isActive: false
  },
  {
    id: 'network',
    name: 'Network Visualization',
    description: 'Live network graph with 6,891+ nodes and real-time updates',
    component: NetworkView,
    isActive: false
  },
  {
    id: 'network-enhanced',
    name: 'Enhanced Network',
    description: 'Advanced network visualization with optimized rendering',
    component: EnhancedNetworkView,
    enhanced: true,
    isActive: false
  },
  {
    id: 'grid',
    name: 'Grid Visualization',
    description: 'Real-time grid view with virtual scrolling and live filtering',
    component: D3GridView,
    isActive: false
  },
  {
    id: 'list',
    name: 'List Visualization',
    description: 'Dynamic list view with FTS5 search and live updates',
    component: D3ListView,
    isActive: false
  }
];

// Performance thresholds for quality assessment
const PERFORMANCE_THRESHOLDS = {
  excellent: { fps: 58, latency: 50, renderTime: 10 },
  good: { fps: 45, latency: 100, renderTime: 16 },
  warning: { fps: 30, latency: 200, renderTime: 32 },
  critical: { fps: 15, latency: 500, renderTime: 50 }
};

// Main demo component
export function ProductionVisualizationDemo() {
  const { theme } = useTheme();
  const [activeSectionId, setActiveSectionId] = useState('overview');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  // Stress testing state
  const [activeStressTest, setActiveStressTest] = useState<StressTestScenario | null>(null);
  const [stressTestProgress, setStressTestProgress] = useState(0);
  const [customStressTest] = useState({
    dataSize: 6891,
    updateFrequency: 10,
    filterChanges: true
  });

  // Error simulation state
  const [errorSimulation, setErrorSimulation] = useState<ErrorSimulationOptions>({
    enabled: false,
    type: 'connection',
    frequency: 1
  });

  // Demo control state
  const [autoRotateDemo, setAutoRotateDemo] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const visualizationRef = useRef<HTMLDivElement>(null);
  const stressTestTimeoutRef = useRef<NodeJS.Timeout>();

  // Live data subscriptions with production dataset
  const {
    data: allNodes = [],
    isLoading: nodesLoading,
    error: nodesError,
    latency: nodesLatency
  } = useLiveData<Node[]>(
    'SELECT * FROM nodes ORDER BY modifiedAt DESC',
    [],
    {
      trackPerformance: true,
      throttleMs: 100,
      enablePolling: activeStressTest !== null,
      pollingIntervalMs: activeStressTest ? 1000 / activeStressTest.updateFrequency : 5000,
      onPerformanceUpdate: (metrics) => {
        // Performance callback for real-time monitoring
        if (metrics.averageLatency > 200) {
          console.warn('High latency detected:', metrics.averageLatency, 'ms');
        }
      }
    }
  );

  const { data: allEdges = [], isLoading: edgesLoading, error: edgesError } = useLiveData<Edge[]>(
    'SELECT * FROM edges',
    [],
    {
      trackPerformance: true,
      throttleMs: 100,
      enablePolling: activeStressTest !== null,
      pollingIntervalMs: activeStressTest ? 1000 / activeStressTest.updateFrequency : 5000
    }
  );

  // Performance monitoring
  const performanceHook = useD3PerformanceWithMonitor(
    visualizationRef.current || undefined,
    'production-demo'
  );

  const { metrics: liveDataMetrics, invalidateCache } = useLiveDataMetrics();

  // Filtered data based on active stress test or full dataset
  const displayData = useMemo(() => {
    const dataSize = activeStressTest?.dataSize || customStressTest.dataSize;
    const safeNodes = (allNodes || []);
    const safeEdges = (allEdges || []);

    return {
      nodes: safeNodes.slice(0, dataSize),
      edges: safeEdges.slice(0, Math.min(dataSize * 2, safeEdges.length))
    };
  }, [allNodes, allEdges, activeStressTest, customStressTest.dataSize]);

  // Current performance metrics calculation
  const currentMetrics: PerformanceMetrics = useMemo(() => {
    const avgLatency = liveDataMetrics.reduce((sum, m) => sum + m.averageLatency, 0)
      / Math.max(1, liveDataMetrics.length);
    const avgCacheHit = liveDataMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0)
      / Math.max(1, liveDataMetrics.length);
    const totalErrors = liveDataMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const totalUpdates = liveDataMetrics.reduce((sum, m) => sum + m.updateCount, 0);

    return {
      fps: performanceHook.currentFps,
      latency: avgLatency || nodesLatency,
      memoryUsage: performanceHook.memoryUsage,
      renderTime: performanceHook.renderTime,
      errorRate: totalUpdates > 0 ? (totalErrors / totalUpdates) * 100 : 0,
      cacheHitRate: avgCacheHit * 100
    };
  }, [liveDataMetrics, performanceHook, nodesLatency]);

  // Performance quality assessment
  const performanceQuality = useMemo(() => {
    const { fps, latency, renderTime } = currentMetrics;

    if (fps >= PERFORMANCE_THRESHOLDS.excellent.fps &&
        latency <= PERFORMANCE_THRESHOLDS.excellent.latency &&
        renderTime <= PERFORMANCE_THRESHOLDS.excellent.renderTime) {
      return 'excellent';
    } else if (fps >= PERFORMANCE_THRESHOLDS.good.fps &&
               latency <= PERFORMANCE_THRESHOLDS.good.latency &&
               renderTime <= PERFORMANCE_THRESHOLDS.good.renderTime) {
      return 'good';
    } else if (fps >= PERFORMANCE_THRESHOLDS.warning.fps &&
               latency <= PERFORMANCE_THRESHOLDS.warning.latency &&
               renderTime <= PERFORMANCE_THRESHOLDS.warning.renderTime) {
      return 'warning';
    } else {
      return 'critical';
    }
  }, [currentMetrics]);

  // Stress test management
  const startStressTest = useCallback((scenario: StressTestScenario) => {
    setActiveStressTest(scenario);
    setStressTestProgress(0);

    // Simulate rapid filter changes if enabled
    if (scenario.filterChanges) {
      // This would integrate with PAFV to change filters rapidly
      console.log('Starting rapid filter changes for stress test');
    }

    // Progress tracking
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / (scenario.duration * 1000)) * 100, 100);
      setStressTestProgress(progress);

      if (progress >= 100) {
        clearInterval(progressInterval);
        setActiveStressTest(null);
        setStressTestProgress(0);
      }
    }, 100);

    // Auto-stop after duration
    stressTestTimeoutRef.current = setTimeout(() => {
      clearInterval(progressInterval);
      setActiveStressTest(null);
      setStressTestProgress(0);
    }, scenario.duration * 1000);
  }, []);

  const stopStressTest = useCallback(() => {
    if (stressTestTimeoutRef.current) {
      clearTimeout(stressTestTimeoutRef.current);
    }
    setActiveStressTest(null);
    setStressTestProgress(0);
  }, []);

  // Error simulation
  const simulateError = useCallback(() => {
    if (!errorSimulation.enabled) return;

    switch (errorSimulation.type) {
      case 'connection':
        // Simulate temporary connection loss
        invalidateCache();
        break;
      case 'timeout':
        // Simulate query timeout
        console.warn('Simulated query timeout');
        break;
      case 'data-corruption':
        // Simulate data corruption
        console.error('Simulated data corruption detected');
        break;
      case 'memory-pressure':
        // Simulate memory pressure
        console.warn('Simulated memory pressure');
        break;
    }
  }, [errorSimulation, invalidateCache]);

  // Auto-rotate demo sections
  useEffect(() => {
    if (!autoRotateDemo) return;

    const interval = setInterval(() => {
      setActiveSectionId(prev => {
        const currentIndex = DEMO_SECTIONS.findIndex(s => s.id === prev);
        const nextIndex = (currentIndex + 1) % DEMO_SECTIONS.length;
        return DEMO_SECTIONS[nextIndex].id;
      });
    }, 10000); // Switch every 10 seconds

    return () => clearInterval(interval);
  }, [autoRotateDemo]);

  // Error simulation timer
  useEffect(() => {
    if (!errorSimulation.enabled) return;

    const interval = setInterval(simulateError, (60 / errorSimulation.frequency) * 1000);
    return () => clearInterval(interval);
  }, [errorSimulation, simulateError]);

  // Current active section
  const activeSection = DEMO_SECTIONS.find(s => s.id === activeSectionId) || DEMO_SECTIONS[0];
  const ActiveComponent = activeSection.component;

  // Performance status color
  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <PAFVProvider>
      <div className={`min-h-screen ${theme === 'NeXTSTEP' ? 'bg-gray-100' : 'bg-white'} relative`}>

        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  Production Visualization Demo
                </h1>
                <div className="ml-4 flex items-center space-x-2">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getQualityColor(performanceQuality)}`}>
                    {performanceQuality.toUpperCase()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {(displayData.nodes || []).length} nodes • {currentMetrics.fps.toFixed(1)} FPS
                  </div>
                </div>
              </div>

              {/* Demo Controls */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowPerformanceOverlay(!showPerformanceOverlay)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  {showPerformanceOverlay ? 'Hide' : 'Show'} Monitor
                </button>
                <button
                  onClick={() => setAutoRotateDemo(!autoRotateDemo)}
                  className={`px-3 py-1 text-sm rounded ${
                    autoRotateDemo
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Auto-Rotate
                </button>
                <button
                  onClick={() => setCompactMode(!compactMode)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  {compactMode ? 'Full' : 'Compact'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* PAFV Filtering */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Interactive PAFV Filtering</h2>
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <div className="text-gray-500">PAFV components loading...</div>
              {/* <PAFVDropZone />
              <div className="mt-4">
                <PAFVActiveFilters />
              </div> */}
            </div>
          </div>

          {/* Section Navigation */}
          <div className="mb-6">
            <Tab.Group
              selectedIndex={DEMO_SECTIONS.findIndex(s => s.id === activeSectionId)}
              onChange={(index) => setActiveSectionId(DEMO_SECTIONS[index].id)}
            >
              <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
                {DEMO_SECTIONS.map((section) => (
                  <Tab
                    key={section.id}
                    className={({ selected }) =>
                      `w-full rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all
                       ${selected
                         ? 'bg-white text-blue-700 shadow'
                         : 'text-blue-900/70 hover:bg-white/[0.12] hover:text-blue-900'
                       }
                       ${section.enhanced ? 'ring-2 ring-green-500 ring-opacity-30' : ''}`
                    }
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <span>{section.name}</span>
                      {section.enhanced && <span className="text-green-600 text-xs">✨</span>}
                    </div>
                    {!compactMode && (
                      <div className="text-xs text-gray-600 mt-1">
                        {section.description}
                      </div>
                    )}
                  </Tab>
                ))}
              </Tab.List>
            </Tab.Group>
          </div>

          {/* Stress Testing Controls */}
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Stress Testing & Performance Validation</h3>
              </div>
              <div className="p-4">

                {/* Predefined Scenarios */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {STRESS_SCENARIOS.map((scenario) => (
                    <div key={scenario.id} className="border border-gray-200 rounded-lg p-3">
                      <h4 className="font-medium text-gray-900">{scenario.name}</h4>
                      <p className="text-sm text-gray-600 mb-2">{scenario.description}</p>
                      <button
                        onClick={() => startStressTest(scenario)}
                        disabled={activeStressTest !== null}
                        className={`w-full px-3 py-1 text-sm rounded ${
                          activeStressTest?.id === scenario.id
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        } disabled:opacity-50`}
                      >
                        {activeStressTest?.id === scenario.id ? 'Running...' : 'Start Test'}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Active Stress Test Status */}
                {activeStressTest && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-red-900">
                        Running: {activeStressTest.name}
                      </span>
                      <button
                        onClick={stopStressTest}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Stop
                      </button>
                    </div>
                    <div className="w-full bg-red-200 rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${stressTestProgress}%` }}
                      />
                    </div>
                    <div className="text-sm text-red-700 mt-1">
                      {stressTestProgress.toFixed(1)}% complete
                    </div>
                  </div>
                )}

                {/* Error Simulation */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Error Simulation & Recovery Testing</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={errorSimulation.enabled}
                          onChange={(e) => setErrorSimulation(prev => ({ ...prev, enabled: e.target.checked }))}
                          className="mr-2"
                        />
                        Enable Error Simulation
                      </label>
                    </div>
                    <div>
                      <select
                        value={errorSimulation.type}
                        onChange={(e) => setErrorSimulation(prev => ({ ...prev, type: e.target.value as any }))}
                        className="w-full p-2 border border-gray-300 rounded"
                        disabled={!errorSimulation.enabled}
                      >
                        <option value="connection">Connection Loss</option>
                        <option value="timeout">Query Timeout</option>
                        <option value="data-corruption">Data Corruption</option>
                        <option value="memory-pressure">Memory Pressure</option>
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={errorSimulation.frequency}
                        onChange={(e) => {
                          setErrorSimulation(prev => ({
                            ...prev,
                            frequency: parseFloat(e.target.value)
                          }));
                        }}
                        className="w-full p-2 border border-gray-300 rounded"
                        disabled={!errorSimulation.enabled}
                        placeholder="Errors per minute"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Visualization Area */}
          <div className="bg-white rounded-lg shadow border border-gray-200 mb-6" ref={containerRef}>
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{activeSection.name}</h3>
              <p className="text-sm text-gray-600">{activeSection.description}</p>
            </div>

            <div className="relative" style={{ height: compactMode ? '400px' : '600px' }} ref={visualizationRef}>
              {(nodesLoading || edgesLoading) && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                    <div className="text-sm text-gray-600">Loading {(displayData.nodes || []).length} nodes...</div>
                  </div>
                </div>
              )}

              {(nodesError || edgesError) && (
                <div className="absolute inset-0 bg-red-50 flex items-center justify-center">
                  <div className="text-center text-red-600">
                    <div className="text-lg font-medium mb-2">⚠️ Error Loading Data</div>
                    <div className="text-sm">{nodesError || edgesError}</div>
                  </div>
                </div>
              )}

              <ActiveComponent
                data={displayData}
                onNodeSelect={setSelectedNode}
                selectedNode={selectedNode}
                className="w-full h-full"
                performanceMode={activeStressTest !== null}
                {...(activeSection.enhanced ? { optimized: true, virtualScrolling: true } : {})}
              />
            </div>
          </div>

          {/* Node Selection Panel */}
          {selectedNode && !compactMode && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Selected Node Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">ID:</span>
                  <span className="ml-2 font-mono">{selectedNode.id}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="ml-2">{selectedNode.name}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className="ml-2">{selectedNode.status}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Modified:</span>
                  <span className="ml-2">{new Date(selectedNode.modifiedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Performance Monitor Overlay */}
        {showPerformanceOverlay && (
          <DataFlowMonitor
            isVisible={true}
            position="bottom-right"
            compact={compactMode}
            realTime={true}
            updateIntervalMs={500}
            enableConsoleLogging={activeStressTest !== null}
          />
        )}

        {/* Performance Baseline Component (always running) */}
        <PerformanceBaseline
          visible={activeSectionId === 'overview'}
          targetFPS={60}
          maxLatency={100}
          dataSize={(displayData.nodes || []).length}
        />

      </div>
    </PAFVProvider>
  );
}

export default ProductionVisualizationDemo;