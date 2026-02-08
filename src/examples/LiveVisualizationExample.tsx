/**
 * Live Visualization Example
 *
 * Comprehensive example showcasing live D3 integration with performance monitoring
 * and real-time filtering capabilities.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import { NetworkView } from '../components/views/NetworkView';
import { D3GridView } from '../components/views/D3GridView';
import { D3ListView } from '../components/views/D3ListView';
import DataFlowMonitor from '../components/DataFlowMonitor';
import { useLiveData } from '../hooks/database/useLiveData';
import { useD3PerformanceWithMonitor } from '@/hooks';
import { useTheme } from '../contexts/ThemeContext';
import type { Node } from '../types/node';

interface StressTestOptions {
  dataSize: number;
  updateFrequency: number; // updates per second
  enabled: boolean;
}

const TABS = [
  { name: 'Network', component: NetworkView },
  { name: 'Grid', component: D3GridView },
  { name: 'List', component: D3ListView }
] as const;

export function LiveVisualizationExample() {
  const { theme } = useTheme();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showPerformanceOverlay, setShowPerformanceOverlay] = useState(true);
  const [stressTest, setStressTest] = useState<StressTestOptions>({
    dataSize: 1000,
    updateFrequency: 5,
    enabled: false
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const visualizationRef = useRef<HTMLDivElement>(null);

  // Live data subscription for nodes
  const { data: nodes = [], isLoading, error, latency } = useLiveData<Node[]>(
    'SELECT * FROM nodes ORDER BY modifiedAt DESC LIMIT ?',
    [stressTest.enabled ? stressTest.dataSize : 10000],
    {
      trackPerformance: true,
      throttleMs: stressTest.enabled ? Math.floor(1000 / stressTest.updateFrequency) : 100,
      enablePolling: stressTest.enabled,
      pollingIntervalMs: stressTest.enabled ? Math.floor(1000 / stressTest.updateFrequency) : 5000,
      onPerformanceUpdate: (metrics) => {
        console.debug('LiveVisualizationExample performance:', metrics);
      }
    }
  );

  // Performance monitoring for current visualization
  const performanceMetrics = useD3PerformanceWithMonitor(
    visualizationRef.current?.querySelector('svg') || undefined,
    `live-viz-${TABS[selectedTabIndex].name.toLowerCase()}`
  );

  // Handle node selection
  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node);
  }, []);

  // Stress test controls
  const startStressTest = useCallback(() => {
    setStressTest(prev => ({ ...prev, enabled: true }));
  }, []);

  const stopStressTest = useCallback(() => {
    setStressTest(prev => ({ ...prev, enabled: false }));
  }, []);

  const updateStressTestOption = useCallback((key: keyof StressTestOptions, value: any) => {
    setStressTest(prev => ({ ...prev, [key]: value }));
  }, []);

  // Report performance metrics to monitor
  useEffect(() => {
    if (performanceMetrics.reportToMonitor) {
      performanceMetrics.reportToMonitor({
        tabIndex: selectedTabIndex,
        tabName: TABS[selectedTabIndex].name,
        nodeCount: (nodes || []).length,
        latency,
        stressTestActive: stressTest.enabled
      });
    }
  }, [performanceMetrics, selectedTabIndex, (nodes || []).length, latency, stressTest.enabled]);

  // Performance status indicator
  const getPerformanceStatus = () => {
    if (performanceMetrics.isPerformant) {
      return { color: 'green', label: 'Good' };
    } else if (performanceMetrics.currentFps > 20) {
      return { color: 'yellow', label: 'Fair' };
    } else {
      return { color: 'red', label: 'Poor' };
    }
  };

  const status = getPerformanceStatus();

  return (
    <div ref={containerRef} className="live-visualization-example w-full h-full flex flex-col">
      {/* Header with controls */}
      <div className={`flex-shrink-0 border-b ${
        theme === 'NeXTSTEP' ? 'border-[#c0c0c0] bg-[#f0f0f0]' : 'border-gray-200 bg-white'
      }`}>
        {/* Tab Navigation */}
        <Tab.Group selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
          <div className="flex items-center justify-between px-4 py-2">
            <Tab.List className={`flex space-x-1 rounded-lg p-1 ${
              theme === 'NeXTSTEP' ? 'bg-[#e8e8e8]' : 'bg-gray-100'
            }`}>
              {TABS.map((tab, _index) => (
                <Tab
                  key={tab.name}
                  className={({ selected }) =>
                    `w-full rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-colors ${
                      selected
                        ? theme === 'NeXTSTEP'
                          ? 'bg-white text-black shadow border border-[#c0c0c0]'
                          : 'bg-white text-blue-700 shadow'
                        : theme === 'NeXTSTEP'
                          ? 'text-gray-700 hover:bg-[#d8d8d8]'
                          : 'text-gray-500 hover:bg-white/[0.12] hover:text-gray-700'
                    }`
                  }
                >
                  {tab.name}
                </Tab>
              ))}
            </Tab.List>

            {/* Performance Status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full bg-${status.color}-500`} />
                <span>{status.label}</span>
                <span className="text-gray-500">
                  {performanceMetrics.currentFps.toFixed(0)} FPS
                </span>
              </div>

              <button
                onClick={() => setShowPerformanceOverlay(!showPerformanceOverlay)}
                className={`px-3 py-1 text-xs rounded ${
                  showPerformanceOverlay
                    ? theme === 'NeXTSTEP'
                      ? 'bg-[#0066cc] text-white'
                      : 'bg-blue-600 text-white'
                    : theme === 'NeXTSTEP'
                      ? 'bg-[#e8e8e8] text-gray-700 hover:bg-[#d8d8d8]'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {showPerformanceOverlay ? 'Hide' : 'Show'} Performance
              </button>
            </div>
          </div>
        </Tab.Group>

        {/* Stress Test Controls */}
        <div className={`px-4 py-2 border-t ${
          theme === 'NeXTSTEP' ? 'border-[#c0c0c0] bg-[#f8f8f8]' : 'border-gray-100 bg-gray-50'
        }`}>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Stress Test:</label>

            <div className="flex items-center gap-2">
              <label className="text-xs">Data Size:</label>
              <input
                type="number"
                value={stressTest.dataSize}
                onChange={(e) => updateStressTestOption('dataSize', parseInt(e.target.value))}
                className="w-20 px-2 py-1 text-xs border rounded"
                min="100"
                max="10000"
                step="100"
                disabled={stressTest.enabled}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs">Updates/sec:</label>
              <input
                type="number"
                value={stressTest.updateFrequency}
                onChange={(e) => updateStressTestOption('updateFrequency', parseInt(e.target.value))}
                className="w-20 px-2 py-1 text-xs border rounded"
                min="1"
                max="30"
                step="1"
                disabled={stressTest.enabled}
              />
            </div>

            <div className="flex items-center gap-2">
              {stressTest.enabled ? (
                <button
                  onClick={stopStressTest}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Stop Test
                </button>
              ) : (
                <button
                  onClick={startStressTest}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Start Test
                </button>
              )}
            </div>

            <div className="text-xs text-gray-500">
              Nodes: {(nodes || []).length} • Latency: {latency.toFixed(0)}ms
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex relative">
        {/* Visualization area */}
        <div ref={visualizationRef} className="flex-1">
          <Tab.Panels className="h-full">
            {TABS.map((tab, _index) => (
              <Tab.Panel key={tab.name} className="h-full">
                {isLoading && (nodes || []).length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-gray-500">Loading visualization data...</div>
                  </div>
                ) : error ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-red-500">Error: {error}</div>
                  </div>
                ) : (
                  <tab.component data={nodes || []} onNodeClick={handleNodeClick} />
                )}
              </Tab.Panel>
            ))}
          </Tab.Panels>
        </div>

        {/* Performance Monitor Overlay */}
        {showPerformanceOverlay && (
          <div className="absolute top-4 right-4 w-80">
            <DataFlowMonitor
              position="floating"
              className="bg-white/95 backdrop-blur-sm shadow-lg"
            />
          </div>
        )}

        {/* Selected node panel */}
        {selectedNode && (
          <div className={`w-80 border-l ${
            theme === 'NeXTSTEP' ? 'border-[#c0c0c0] bg-[#f8f8f8]' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Node Details</h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Name</label>
                  <div className="text-sm">{selectedNode.name}</div>
                </div>

                {selectedNode.content && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Content</label>
                    <div className="text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {selectedNode.content}
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Priority</label>
                    <div className="text-sm">{selectedNode.priority}</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Status</label>
                    <div className="text-sm">{selectedNode.status}</div>
                  </div>
                </div>

                {selectedNode.folder && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Folder</label>
                    <div className="text-sm">{selectedNode.folder}</div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-500">Modified</label>
                  <div className="text-sm">
                    {new Date(selectedNode.modifiedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveVisualizationExample;