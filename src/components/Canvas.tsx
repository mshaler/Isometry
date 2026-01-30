import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
// import { useFilteredNodes } from '../hooks/useFilteredNodes';
import { useMockData } from '../hooks/useMockData';
import { useCanvasPerformance } from '../hooks/useCanvasPerformance';
import { RealTimeRenderer } from './performance/RealTimeRenderer';
import DataFlowMonitor from './DataFlowMonitor';
import {
  ListView,
  GridView,
  KanbanView,
  TimelineView,
  CalendarView,
  ChartsView,
  NetworkView,
  TreeView,
} from './views';
import { D3GridView } from './views/D3GridView';
import { D3ListView } from './views/D3ListView';
import { FilterBar } from './FilterBar';
import type { Node } from '@/types/node';

export function Canvas() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [useD3Mode, setUseD3Mode] = useState(false); // Toggle for D3 vs CSS rendering
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [performanceQualityMode, setPerformanceQualityMode] = useState<'high' | 'medium' | 'low'>('high');
  const tabs = ['Tab 1', 'Tab 2', 'Tab 3'];
  const { theme } = useTheme();
  const { activeView } = useAppState();

  // Use mock data for MVP demonstration (bypasses database complexity)
  const { data: nodes, loading, error } = useMockData();

  // Performance monitoring
  const {
    metrics,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    recordRender,
    getOptimizationRecommendations,
    getPerformanceSummary
  } = useCanvasPerformance({
    targetFps: 60,
    enableAutoOptimize: true,
    onPerformanceWarning: (issue, severity) => {
      console.warn(`[Canvas Performance] ${severity.toUpperCase()}: ${issue}`);

      // Auto-adjust quality mode based on performance
      if (severity === 'critical' && performanceQualityMode === 'high') {
        setPerformanceQualityMode('medium');
        console.log('[Canvas] Automatically reduced quality to medium');
      } else if (severity === 'critical' && performanceQualityMode === 'medium') {
        setPerformanceQualityMode('low');
        console.log('[Canvas] Automatically reduced quality to low');
      }
    }
  });

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node);
    console.log('Node clicked:', node);
  }, []);

  // Start/stop performance monitoring based on D3 mode
  useEffect(() => {
    if (useD3Mode && nodes && nodes.length > 0) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [useD3Mode, nodes, startMonitoring, stopMonitoring]);

  // Record render performance when nodes change
  useEffect(() => {
    if (useD3Mode && nodes) {
      const renderStartTime = performance.now();

      // Simulate render completion in next tick
      requestAnimationFrame(() => {
        const renderTime = performance.now() - renderStartTime;
        recordRender(renderTime, nodes.length);
      });
    }
  }, [useD3Mode, nodes, recordRender]);

  // Render the appropriate view based on activeView
  const renderView = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          Loading notes...
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-red-500">
          Error: {error.message}
        </div>
      );
    }

    if (!nodes || nodes.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          No notes found
        </div>
      );
    }

    // D3 Mode - Use D3 Canvas rendering with performance optimization
    if (useD3Mode) {
      const d3View = (() => {
        switch (activeView) {
          case 'List':
            return <D3ListView data={nodes} onNodeClick={handleNodeClick} />;

          case 'Gallery':
          case 'Grid':
          default:
            return <D3GridView data={nodes} onNodeClick={handleNodeClick} />;
        }
      })();

      return (
        <RealTimeRenderer
          maxNodes={performanceQualityMode === 'high' ? 10000 : performanceQualityMode === 'medium' ? 5000 : 2500}
          targetFps={60}
          enableLOD={true}
          enableProgressiveRendering={true}
          onPerformanceChange={(perfMetrics) => {
            // Update performance monitoring from RealTimeRenderer
            if (isMonitoring) {
              recordRender(perfMetrics.renderTime, perfMetrics.nodeCount);
            }
          }}
          debug={process.env.NODE_ENV === 'development'}
          className="h-full"
        >
          {d3View}
        </RealTimeRenderer>
      );
    }

    // CSS Mode - Use existing CSS-based components
    switch (activeView) {
      case 'List':
        return <ListView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Gallery':
      case 'Grid':
        return <GridView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Kanban':
        return <KanbanView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Timeline':
        return <TimelineView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Calendar':
        return <CalendarView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Charts':
        return <ChartsView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Graphs':
        return <NetworkView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Tree':
        return <TreeView data={nodes} onNodeClick={handleNodeClick} />;

      default:
        // Default to Grid view for MVP
        return <GridView data={nodes} onNodeClick={handleNodeClick} />;
    }
  };

  return (
    <div className={`flex-1 flex flex-col m-3 overflow-hidden ${
      theme === 'NeXTSTEP'
        ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
        : 'bg-white rounded-lg shadow-lg border border-gray-200'
    }`}>
      {/* Filter Bar with D3 Mode Toggle */}
      <div className="flex items-center">
        <div className="flex-1">
          <FilterBar />
        </div>

        {/* Performance and Mode Controls */}
        {process.env.NODE_ENV === 'development' && (
          <div className="flex items-center gap-2 px-3 py-2">
            {/* D3 Mode Toggle */}
            <button
              onClick={() => setUseD3Mode(!useD3Mode)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                useD3Mode
                  ? theme === 'NeXTSTEP'
                    ? 'bg-[#0066cc] text-white'
                    : 'bg-blue-600 text-white'
                  : theme === 'NeXTSTEP'
                    ? 'bg-[#e8e8e8] text-gray-700 hover:bg-[#d8d8d8]'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={useD3Mode ? 'Switch to CSS rendering' : 'Switch to D3 rendering'}
            >
              {useD3Mode ? 'D3' : 'CSS'}
            </button>

            {/* Performance Quality Mode */}
            {useD3Mode && (
              <select
                value={performanceQualityMode}
                onChange={(e) => setPerformanceQualityMode(e.target.value as 'high' | 'medium' | 'low')}
                className={`px-2 py-1 text-xs rounded border ${
                  theme === 'NeXTSTEP'
                    ? 'bg-white border-[#808080]'
                    : 'bg-white border-gray-300'
                }`}
                title="Performance quality mode"
              >
                <option value="high">High Quality</option>
                <option value="medium">Medium Quality</option>
                <option value="low">Low Quality</option>
              </select>
            )}

            {/* Performance Monitor Toggle */}
            {useD3Mode && (
              <button
                onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
                className={`px-2 py-1 text-xs rounded ${
                  showPerformanceMonitor
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
                title="Toggle performance monitor"
              >
                📊 {metrics?.fps ? Math.round(metrics.fps) + ' FPS' : 'Monitor'}
              </button>
            )}

            {/* Performance Summary */}
            {useD3Mode && metrics && (
              <div className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                metrics.qualityLevel === 'high' ? 'bg-green-100 text-green-700' :
                metrics.qualityLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                metrics.qualityLevel === 'low' ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  metrics.qualityLevel === 'high' ? 'bg-green-500' :
                  metrics.qualityLevel === 'medium' ? 'bg-yellow-500' :
                  metrics.qualityLevel === 'low' ? 'bg-orange-500' :
                  'bg-red-500'
                }`} />
                <span>{Math.round(metrics.performanceScore)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>

      {/* Selected Node Info (optional mini-display) */}
      {selectedNode && (
        <div className={`h-8 flex items-center px-3 text-xs ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-t border-[#808080]'
            : 'bg-gray-50 border-t border-gray-200'
        }`}>
          <span className="font-medium mr-2">Selected:</span>
          <span className="truncate">{selectedNode.name}</span>
          <button
            onClick={() => setSelectedNode(null)}
            className={`ml-auto px-2 ${
              theme === 'NeXTSTEP' ? 'hover:bg-[#c0c0c0]' : 'hover:bg-gray-200 rounded'
            }`}
          >
            ×
          </button>
        </div>
      )}

      {/* Sheet Tabs */}
      <div className={theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-t-2 border-[#808080] flex items-end gap-0.5 px-2 pb-1 pt-2'
        : 'bg-gray-50 border-t border-gray-200 flex items-end gap-1 px-2 pb-1 pt-2'
      }>
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={theme === 'NeXTSTEP'
              ? `px-4 py-1.5 text-sm rounded-t ${
                  activeTab === index
                    ? 'bg-white border-t-2 border-l-2 border-r-2 border-[#808080]'
                    : 'bg-[#b0b0b0] border-t-2 border-l-2 border-r-2 border-[#707070] hover:bg-[#b8b8b8]'
                }`
              : `px-4 py-1.5 text-sm rounded-t-lg ${
                  activeTab === index
                    ? 'bg-white text-gray-900 border-t border-l border-r border-gray-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Performance Monitor Overlay */}
      {useD3Mode && showPerformanceMonitor && (
        <DataFlowMonitor
          isVisible={showPerformanceMonitor}
          position="bottom-right"
          compact={false}
          realTime={true}
          enableConsoleLogging={false}
        />
      )}
    </div>
  );
}
