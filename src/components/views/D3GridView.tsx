import React, { useState, useCallback, useRef, useEffect } from 'react';
import { D3Canvas } from '../D3Canvas';
import { usePAFV } from '../../contexts/PAFVContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLiveData } from '../../hooks/useLiveData';
import type { Node } from '../../types/node';
import { performanceMonitor, type NativeRenderingMetrics } from '../../utils/d3Performance';
import { renderOptimizer } from '../../utils/d3-render-optimizer';
import * as d3 from 'd3';

interface D3GridViewProps {
  data: Node[];
  onNodeClick?: (node: Node) => void;
}

interface CellDetailOverlay {
  visible: boolean;
  nodes: Node[];
  position: { x: number; y: number };
  rowKey: string;
  colKey: string;
}

interface GridInteractionState {
  hoveredCell: string | null;
  selectedCells: Set<string>;
  zoomTransform: d3.ZoomTransform | null;
  isDragging: boolean;
  gestureSource: 'native' | 'react' | null;
  performanceMode: 'auto' | 'dom' | 'native';
}

interface GestureState {
  scale: number;
  translation: { x: number; y: number };
  velocity: { x: number; y: number };
  isActive: boolean;
  timestamp: number;
}

/**
 * Enhanced D3-powered Grid View component
 *
 * Features:
 * - Hierarchical header rendering with PAFV axes
 * - Cell hover effects and selection states
 * - Smooth transitions for axis changes
 * - Cell detail overlays with node information
 * - Pan/zoom functionality for large datasets
 * - Performance optimization with canvas rendering
 */
export function D3GridView({ data: staticData, onNodeClick }: D3GridViewProps) {
  const { wells } = usePAFV();
  const { theme } = useTheme();

  // Live data subscription for real-time updates
  const { data: liveData, isLoading, error } = useLiveData<Node[]>(
    'SELECT * FROM nodes ORDER BY modifiedAt DESC',
    [],
    {
      trackPerformance: true,
      throttleMs: 100,
      onPerformanceUpdate: (metrics) => {
        console.debug('D3GridView performance:', metrics);
      }
    }
  );

  // Use live data when available, fallback to static data
  const data = liveData || staticData;

  // Component state
  const [cellDetailOverlay, setCellDetailOverlay] = useState<CellDetailOverlay>({
    visible: false,
    nodes: [],
    position: { x: 0, y: 0 },
    rowKey: '',
    colKey: ''
  });

  const [interactionState, setInteractionState] = useState<GridInteractionState>({
    hoveredCell: null,
    selectedCells: new Set(),
    zoomTransform: null,
    isDragging: false,
    gestureSource: null,
    performanceMode: 'auto'
  });

  // Bridge state for gesture coordination
  const [nativeGestureState, setNativeGestureState] = useState<GestureState | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<{ native?: NativeRenderingMetrics; comparison?: any }>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const lastViewportRef = useRef<any>(null);
  const gestureDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Handle cell interactions
  const handleCellClick = useCallback((cellData: { nodes: Node[]; rowKey: string; colKey: string }) => {
    const cellKey = `${cellData.colKey}||${cellData.rowKey}`;

    // Update selection state
    setInteractionState(prev => {
      const newSelected = new Set(prev.selectedCells);
      if (newSelected.has(cellKey)) {
        newSelected.delete(cellKey);
      } else {
        newSelected.add(cellKey);
      }
      return { ...prev, selectedCells: newSelected };
    });

    // Show cell detail overlay if multiple nodes
    if (cellData.nodes.length > 1) {
      setCellDetailOverlay({
        visible: true,
        nodes: cellData.nodes,
        position: { x: 0, y: 0 }, // Will be updated by mouse position
        rowKey: cellData.rowKey,
        colKey: cellData.colKey
      });
    } else if (cellData.nodes.length === 1 && onNodeClick) {
      // Single node click
      onNodeClick(cellData.nodes[0]);
    }
  }, [onNodeClick]);


  const handleError = useCallback((error: string) => {
    console.error('D3GridView error:', error);
  }, []);

  // Bridge integration for gesture coordination
  const handleNativeGestureUpdate = useCallback((gestureState: GestureState) => {
    setNativeGestureState(gestureState);

    // Update D3 zoom transform to match native gesture
    if (containerRef.current && gestureState.isActive) {
      setInteractionState(prev => ({
        ...prev,
        gestureSource: 'native',
        zoomTransform: d3.zoomIdentity
          .translate(gestureState.translation.x, gestureState.translation.y)
          .scale(gestureState.scale)
      }));
    }
  }, []);

  // Bridge integration for native performance metrics
  const handleNativePerformanceUpdate = useCallback((metrics: NativeRenderingMetrics) => {
    performanceMonitor.updateNativeMetrics(metrics);

    // Get performance comparison
    const datasetSize = data.length;
    const complexity = calculateDatasetComplexity(data);
    const comparison = performanceMonitor.getPerformanceComparison(datasetSize, complexity);

    setPerformanceMetrics({ native: metrics, comparison });

    // Auto-adjust performance mode based on comparison
    if (interactionState.performanceMode === 'auto' && comparison) {
      setInteractionState(prev => ({
        ...prev,
        performanceMode: comparison.recommendation === 'dom' ? 'dom' : 'native'
      }));

      // Apply render optimizer settings
      if (comparison.recommendation === 'native') {
        renderOptimizer.updateSettings({
          enableViewportCulling: true,
          enableLOD: true,
          maxCommandsPerFrame: Math.min(500, datasetSize * 0.5)
        });
      }
    }
  }, [data, interactionState.performanceMode]);

  // Calculate dataset complexity for optimization decisions
  const calculateDatasetComplexity = useCallback((data: Node[]) => {
    // Simple complexity calculation based on data characteristics
    const baseComplexity = Math.min(data.length / 100, 5); // 0-5 based on size
    const contentComplexity = data.filter(node => node.content).length / data.length * 2; // 0-2 based on content
    const priorityComplexity = data.reduce((sum, node) => sum + node.priority, 0) / data.length / 10 * 3; // 0-3 based on priority

    return Math.min(baseComplexity + contentComplexity + priorityComplexity, 10);
  }, []);

  // Debounced gesture bridge update
  const sendGestureToBridge = useCallback((transform: d3.ZoomTransform) => {
    if (gestureDebounceRef.current) {
      clearTimeout(gestureDebounceRef.current);
    }

    gestureDebounceRef.current = setTimeout(() => {
      if (interactionState.gestureSource !== 'native') {
        // Send to native bridge (would be implemented via WebView bridge)
        // window._isometryBridge?.sendCanvasUpdate({
        //   viewport: {
        //     x: -transform.x / transform.k,
        //     y: -transform.y / transform.k,
        //     scale: transform.k
        //   }
        // });
      }
    }, 16); // ~60fps debouncing
  }, [interactionState.gestureSource]);

  // Close overlay when clicking outside
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setCellDetailOverlay(prev => ({ ...prev, visible: false }));
    }
  }, []);

  // Enhanced pan/zoom setup with gesture coordination
  useEffect(() => {
    if (!containerRef.current) return;

    const container = d3.select(containerRef.current);
    const zoom = d3.zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        const transform = event.transform;

        // Update state based on gesture source
        setInteractionState(prev => ({
          ...prev,
          zoomTransform: transform,
          gestureSource: prev.gestureSource === 'native' ? 'native' : 'react',
          isDragging: event.sourceEvent?.type === 'mousemove' || event.sourceEvent?.type === 'touchmove'
        }));

        // Apply viewport optimization if throttling is needed
        const viewport = {
          x: -transform.x / transform.k,
          y: -transform.y / transform.k,
          width: containerRef.current!.clientWidth / transform.k,
          height: containerRef.current!.clientHeight / transform.k,
          scale: transform.k
        };

        if (renderOptimizer.shouldThrottleRendering(viewport, lastViewportRef.current)) {
          // Skip expensive operations during rapid gestures
          return;
        }

        lastViewportRef.current = viewport;

        // Send gesture update to bridge for native coordination
        sendGestureToBridge(transform);
      });

    container.call(zoom);

    // Set up bridge listener for native gesture updates (conceptual)
    const bridgeListener = (event: CustomEvent) => {
      if (event.detail?.gestureState) {
        handleNativeGestureUpdate(event.detail.gestureState);
      }
      if (event.detail?.performanceMetrics) {
        handleNativePerformanceUpdate(event.detail.performanceMetrics);
      }
    };

    window.addEventListener('nativeGestureUpdate', bridgeListener as EventListener);

    return () => {
      container.on('.zoom', null);
      window.removeEventListener('nativeGestureUpdate', bridgeListener as EventListener);
    };
  }, [sendGestureToBridge, handleNativeGestureUpdate, handleNativePerformanceUpdate]);

  // Calculate axis summary for display
  const axisSummary = `${wells.rows.map(chip => chip.label).join(' × ')} vs ${wells.columns.map(chip => chip.label).join(' × ')}`;

  // Handle loading and error states
  if (isLoading && !data.length) {
    return (
      <div className="d3-grid-view w-full h-full relative flex items-center justify-center">
        <div className="text-gray-500">Loading grid data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="d3-grid-view w-full h-full relative flex items-center justify-center">
        <div className="text-red-500">Error loading grid data: {error}</div>
      </div>
    );
  }

  return (
    <div className="d3-grid-view w-full h-full relative">
      {/* Axis Configuration Summary */}
      <div className={`absolute top-2 left-2 z-10 px-2 py-1 text-xs rounded ${
        theme === 'NeXTSTEP'
          ? 'bg-[#e8e8e8] border border-[#c0c0c0] text-gray-700'
          : 'bg-white border border-gray-200 text-gray-600 shadow-sm'
      }`}>
        <span className="font-medium">Grid:</span> {axisSummary}
      </div>

      {/* Main D3 Canvas */}
      <div ref={containerRef} className="w-full h-full">
        <D3Canvas
          className="d3-grid-canvas"
          onCellClick={handleCellClick}
          onError={handleError}
          showPerformanceOverlay={process.env.NODE_ENV === 'development'}
        />
      </div>

      {/* Zoom Controls */}
      <div className={`absolute bottom-2 right-2 z-10 flex flex-col gap-1 ${
        theme === 'NeXTSTEP' ? 'bg-[#e8e8e8]' : 'bg-white shadow-lg'
      } border border-gray-300 rounded p-1`}>
        <button
          className={`px-2 py-1 text-xs ${
            theme === 'NeXTSTEP'
              ? 'bg-[#c0c0c0] hover:bg-[#b0b0b0] border border-[#808080]'
              : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
          }`}
          onClick={() => {
            if (containerRef.current) {
              const zoom = d3.zoom<HTMLDivElement, unknown>();
              d3.select(containerRef.current).transition().call(zoom.scaleBy, 1.5);
            }
          }}
          title="Zoom In"
        >
          +
        </button>
        <button
          className={`px-2 py-1 text-xs ${
            theme === 'NeXTSTEP'
              ? 'bg-[#c0c0c0] hover:bg-[#b0b0b0] border border-[#808080]'
              : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
          }`}
          onClick={() => {
            if (containerRef.current) {
              const zoom = d3.zoom<HTMLDivElement, unknown>();
              d3.select(containerRef.current).transition().call(zoom.scaleBy, 0.67);
            }
          }}
          title="Zoom Out"
        >
          −
        </button>
        <button
          className={`px-2 py-1 text-xs ${
            theme === 'NeXTSTEP'
              ? 'bg-[#c0c0c0] hover:bg-[#b0b0b0] border border-[#808080]'
              : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
          }`}
          onClick={() => {
            if (containerRef.current) {
              const zoom = d3.zoom<HTMLDivElement, unknown>();
              d3.select(containerRef.current).transition().call(zoom.transform, d3.zoomIdentity);
            }
          }}
          title="Reset Zoom"
        >
          ⌂
        </button>
      </div>

      {/* Cell Detail Overlay */}
      {cellDetailOverlay.visible && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
          onClick={handleOverlayClick}
        >
          <div
            className={`max-w-md w-full mx-4 p-4 rounded-lg ${
              theme === 'NeXTSTEP'
                ? 'bg-white border-2 border-[#808080]'
                : 'bg-white shadow-xl border border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">
                Cell Details
              </h3>
              <button
                onClick={() => setCellDetailOverlay(prev => ({ ...prev, visible: false }))}
                className={`px-2 py-1 text-sm ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#e8e8e8] hover:bg-[#d8d8d8]'
                    : 'bg-gray-100 hover:bg-gray-200'
                } rounded`}
              >
                ×
              </button>
            </div>

            {/* Cell Information */}
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="text-sm">
                <div><span className="font-medium">Row:</span> {cellDetailOverlay.rowKey.split('|').join(' • ')}</div>
                <div><span className="font-medium">Column:</span> {cellDetailOverlay.colKey.split('|').join(' • ')}</div>
                <div><span className="font-medium">Count:</span> {cellDetailOverlay.nodes.length} items</div>
              </div>
            </div>

            {/* Node List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {cellDetailOverlay.nodes.map((node) => (
                <div
                  key={node.id}
                  className={`p-2 rounded border cursor-pointer transition-colors ${
                    theme === 'NeXTSTEP'
                      ? 'border-[#c0c0c0] hover:bg-[#f5f5f5]'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    onNodeClick?.(node);
                    setCellDetailOverlay(prev => ({ ...prev, visible: false }));
                  }}
                >
                  <div className="font-medium text-sm">{node.name}</div>
                  {node.content && (
                    <div className="text-xs text-gray-600 truncate mt-1">
                      {node.content}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1 py-0.5 text-xs rounded ${
                      node.priority >= 7 ? 'bg-red-100 text-red-700' :
                      node.priority >= 4 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
{node.priority >= 7 ? 'High' : node.priority >= 4 ? 'Medium' : 'Low'}
                    </span>
                    <span className="text-xs text-gray-500">{node.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Development Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 z-10 bg-black bg-opacity-75 text-white text-xs p-2 rounded max-w-xs">
          <div>Selected: {interactionState.selectedCells.size}</div>
          <div>Hovered: {interactionState.hoveredCell || 'none'}</div>
          {interactionState.zoomTransform && (
            <div>Zoom: {interactionState.zoomTransform.k.toFixed(2)}x</div>
          )}
          <div>Gesture: {interactionState.gestureSource || 'none'}</div>
          <div>Mode: {interactionState.performanceMode}</div>
          {performanceMetrics.native && (
            <div className="mt-1 pt-1 border-t border-gray-600">
              <div>Native FPS: {performanceMetrics.native.frameRate.toFixed(1)}</div>
              <div>Render: {(performanceMetrics.native.renderTime * 1000).toFixed(1)}ms</div>
              <div>Commands: {performanceMetrics.native.commandCount}</div>
              <div>Cache: {(performanceMetrics.native.cacheHitRate * 100).toFixed(1)}%</div>
            </div>
          )}
          {performanceMetrics.comparison && (
            <div className="mt-1 pt-1 border-t border-gray-600">
              <div>Recommendation: {performanceMetrics.comparison.recommendation}</div>
              <div>Improvement: {performanceMetrics.comparison.expectedImprovement.toFixed(1)}%</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default D3GridView;