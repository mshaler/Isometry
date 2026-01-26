import React, { useState, useCallback, useRef, useEffect } from 'react';
import { D3Canvas } from '../D3Canvas';
import { usePAFV } from '../../contexts/PAFVContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { Node } from '../../types/node';
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
export function D3GridView({ data, onNodeClick }: D3GridViewProps) {
  const { wells } = usePAFV();
  const { theme } = useTheme();

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
    isDragging: false
  });

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Handle cell hover for preview
  const handleCellHover = useCallback((cellData: { nodes: Node[]; rowKey: string; colKey: string } | null, mousePosition?: { x: number; y: number }) => {
    if (cellData && cellData.nodes.length > 0) {
      const cellKey = `${cellData.colKey}||${cellData.rowKey}`;

      setInteractionState(prev => ({
        ...prev,
        hoveredCell: cellKey
      }));

      // Show preview for cells with multiple nodes
      if (cellData.nodes.length > 1 && mousePosition) {
        setCellDetailOverlay({
          visible: true,
          nodes: cellData.nodes,
          position: mousePosition,
          rowKey: cellData.rowKey,
          colKey: cellData.colKey
        });
      }
    } else {
      setInteractionState(prev => ({
        ...prev,
        hoveredCell: null
      }));
      setCellDetailOverlay(prev => ({ ...prev, visible: false }));
    }
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('D3GridView error:', error);
  }, []);

  // Close overlay when clicking outside
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setCellDetailOverlay(prev => ({ ...prev, visible: false }));
    }
  }, []);

  // Pan/zoom setup
  useEffect(() => {
    if (!containerRef.current) return;

    const container = d3.select(containerRef.current);
    const zoom = d3.zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        setInteractionState(prev => ({
          ...prev,
          zoomTransform: event.transform
        }));
      });

    container.call(zoom);

    return () => {
      container.on('.zoom', null);
    };
  }, []);

  // Calculate axis summary for display
  const axisSummary = `${wells.rows.map(chip => chip.label).join(' × ')} vs ${wells.columns.map(chip => chip.label).join(' × ')}`;

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
              {cellDetailOverlay.nodes.map((node, index) => (
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
                      node.priority === 'high' ? 'bg-red-100 text-red-700' :
                      node.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {node.priority}
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
        <div className="absolute top-2 right-2 z-10 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
          <div>Selected: {interactionState.selectedCells.size}</div>
          <div>Hovered: {interactionState.hoveredCell || 'none'}</div>
          {interactionState.zoomTransform && (
            <div>Zoom: {interactionState.zoomTransform.k.toFixed(2)}x</div>
          )}
        </div>
      )}
    </div>
  );
}

export default D3GridView;