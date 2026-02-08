import { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppState } from '../contexts/AppStateContext';
import { useCanvasPerformance } from '../hooks/performance/useCanvasPerformance';
import DataFlowMonitor from './DataFlowMonitor';
import { FilterBar } from './FilterBar';
import { useLiveQuery } from '../hooks/database/useLiveQuery';
import { IsometryViewEngine } from '../engine/IsometryViewEngine';
import { DEFAULT_VIEW_CONFIG } from '../engine/contracts/ViewConfig';
import type { ViewConfig, ViewType } from '../engine/contracts/ViewConfig';
import type { Node } from '@/types/node';

export function Canvas() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const tabs = ['Tab 1', 'Tab 2', 'Tab 3'];
  const { theme } = useTheme();
  const { activeView } = useAppState();

  // ViewEngine refs and state
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<IsometryViewEngine | null>(null);

  // Base SQL query for database access
  const baseNodeSql = "SELECT * FROM nodes WHERE deleted_at IS NULL";

  // Fetch data using live query for components that need data props
  const {
    data: nodes
  } = useLiveQuery<Node>(baseNodeSql, {
    autoStart: true,
    enableCache: true,
    debounceMs: 100,
    onError: (err) => {
      console.error('[Canvas] Live query error:', err);
    }
  });

  // Performance monitoring (unified for all rendering)
  const {
    metrics,
    startMonitoring,
    stopMonitoring,
    recordRender
  } = useCanvasPerformance({
    targetFps: 60,
    enableAutoOptimize: true,
    onPerformanceWarning: (issue, severity) => {
      console.warn(`[Canvas Performance] ${severity.toUpperCase()}: ${issue}`);
      // Performance adjustments can be handled here if needed
    }
  });

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node);
    console.log('Node clicked:', node);
  }, []);

  // Map activeView to ViewType
  const mapActiveViewToViewType = useCallback((view: string): ViewType => {
    switch (view) {
      case 'List': return 'list';
      case 'Kanban': return 'kanban';
      case 'Grid':
      case 'Gallery':
      case 'SuperGrid':
      default: return 'grid';
    }
  }, []);

  // Create ViewConfig from current state
  const createViewConfig = useCallback((viewType: ViewType, _data: Node[]): ViewConfig => {
    return {
      ...DEFAULT_VIEW_CONFIG,
      viewType,
      eventHandlers: {
        onNodeClick: handleNodeClick,
        onNodeHover: (node, position) => {
          // Handle hover events if needed
          console.log('Node hover:', node?.name, position);
        }
      },
      performance: {
        maxNodes: 10000,
        enableVirtualization: true,
        targetFps: 60
      },
      styling: {
        ...DEFAULT_VIEW_CONFIG.styling,
        colorScheme: theme === 'NeXTSTEP' ? 'light' : 'light' // Could add dark mode support
      }
    };
  }, [handleNodeClick, theme]);

  // Initialize ViewEngine on mount
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new IsometryViewEngine();
      startMonitoring(); // Start monitoring for unified rendering
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring]);

  // Render when data or activeView changes
  useEffect(() => {
    if (!containerRef.current || !engineRef.current || !nodes || nodes.length === 0) {
      return;
    }

    const renderStartTime = performance.now();
    const viewType = mapActiveViewToViewType(activeView);
    const config = createViewConfig(viewType, nodes);

    // Execute ViewEngine render
    engineRef.current.render(containerRef.current, nodes, config)
      .then(() => {
        const renderTime = performance.now() - renderStartTime;
        recordRender(renderTime, nodes.length);
        console.log(`[Canvas] Rendered ${viewType} view with ${nodes.length} nodes in ${renderTime.toFixed(2)}ms`);
      })
      .catch((error) => {
        console.error('[Canvas] ViewEngine render failed:', error);
      });

  }, [nodes, activeView, mapActiveViewToViewType, createViewConfig, recordRender]);

  // Simple container for ViewEngine rendering
  const renderView = () => {
    return (
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ minHeight: '400px' }}
      />
    );
  };

  return (
    <div className={`flex-1 flex flex-col m-3 overflow-hidden ${
      theme === 'NeXTSTEP'
        ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
        : 'bg-white rounded-lg shadow-lg border border-gray-200'
    }`}>
      {/* Filter Bar with Performance Controls */}
      <div className="flex items-center">
        <div className="flex-1">
          <FilterBar />
        </div>

        {/* Performance Controls (unified for all rendering) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Performance Monitor Toggle */}
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

            {/* Performance Summary */}
            {metrics && (
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

            {/* View Type Indicator */}
            <div className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
              {mapActiveViewToViewType(activeView).toUpperCase()} View
            </div>
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
      {showPerformanceMonitor && (
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
