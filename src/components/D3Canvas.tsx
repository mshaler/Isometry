import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useResizeObserver } from '../hooks/useD3';
import { useD3Canvas, type D3CanvasState, type Viewport } from '../hooks/useD3Canvas';
import { Node } from '../types';
import {
  performanceMonitor,
  spatialIndex,
  transitionManager,
  measurePerformance,
  debounce
} from '../utils/d3Performance';
import * as d3 from 'd3';

// ============================================================================
// Type Definitions
// ============================================================================

interface D3CanvasProps {
  className?: string;
  onCellClick?: (cellData: { nodes: Node[]; rowKey: string; colKey: string }) => void;
  onError?: (error: string) => void;
  showPerformanceOverlay?: boolean;
}

interface InteractionState {
  hoveredCell: string | null;
  selectedCells: Set<string>;
  isDragging: boolean;
  dragStart: { x: number; y: number } | null;
}

// ============================================================================
// Enhanced Performance Overlay Component
// ============================================================================

interface D3PerformanceStats {
  fps?: number;
  frameHistory?: number;
  [key: string]: {
    average: number;
    min: number;
    max: number;
    latest: number;
    samples: number;
  } | number | undefined;
}

const PerformanceOverlay: React.FC<{
  performance: D3PerformanceStats;
  frameRate: number;
  error: string | null;
}> = ({ performance, frameRate, error }) => {
  if (!performance || performance.totalPipeline === 0) return null;

  const renderStats = performanceMonitor.getMetricStats('canvas-render');
  const spatialStats = spatialIndex.getStats();
  const transitionStats = transitionManager.getStats();

  return (
    <div className="absolute top-2 right-2 bg-black bg-opacity-85 text-white text-xs p-3 rounded font-mono max-w-xs">
      <div className="mb-2 pb-2 border-b border-gray-600">
        <div className="text-yellow-300 font-bold mb-1">Performance Monitor</div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-3">
        <span>FPS:</span>
        <span className={frameRate >= 30 ? 'text-green-400' : 'text-red-400'}>
          {frameRate.toFixed(1)}
        </span>

        <span>Pipeline:</span>
        <span className={performance.totalPipeline <= 100 ? 'text-green-400' : 'text-yellow-400'}>
          {performance.totalPipeline.toFixed(1)}ms
        </span>

        <span>Render:</span>
        <span>{renderStats ? renderStats.latest.toFixed(1) : '0.0'}ms</span>

        <span>Memory:</span>
        <span className={performance.memoryUsage <= 50 ? 'text-green-400' : 'text-yellow-400'}>
          {performance.memoryUsage.toFixed(1)}MB
        </span>

        <span>Nodes:</span>
        <span>{performance.nodeCount}</span>

        <span>Cells:</span>
        <span>{performance.cellCount}</span>
      </div>

      <div className="mb-3 pb-2 border-b border-gray-600">
        <div className="text-blue-300 font-medium mb-1">Optimizations</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <span>Spatial:</span>
          <span className="text-cyan-300">{spatialStats.items} items</span>

          <span>Transitions:</span>
          <span className="text-purple-300">{transitionStats.active} active</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span>Transform:</span>
        <span>{performance.dataTransform.toFixed(1)}ms</span>

        <span>Scales:</span>
        <span>{performance.scaleGeneration.toFixed(1)}ms</span>

        <span>Layout:</span>
        <span>{performance.layoutCalculation.toFixed(1)}ms</span>

        <span>Prep:</span>
        <span>{performance.renderPrep.toFixed(1)}ms</span>
      </div>

      {error && (
        <div className="mt-3 pt-2 border-t border-red-400 text-red-300">
          <div className="font-medium mb-1">Error:</div>
          <div className="text-xs">{error}</div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Canvas Renderer
// ============================================================================

class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  clear(width: number, height: number): void {
    this.ctx.clearRect(0, 0, width, height);
  }

  drawCell(
    x: number,
    y: number,
    width: number,
    height: number,
    style: { fill: string; stroke: string; strokeWidth: number; opacity: number },
    nodeCount: number
  ): void {
    this.ctx.save();
    this.ctx.globalAlpha = style.opacity;

    // Draw cell background
    this.ctx.fillStyle = style.fill;
    this.ctx.fillRect(x, y, width, height);

    // Draw cell border
    this.ctx.strokeStyle = style.stroke;
    this.ctx.lineWidth = style.strokeWidth;
    this.ctx.strokeRect(x, y, width, height);

    // Draw node count if > 0
    if (nodeCount > 0) {
      this.ctx.fillStyle = '#333';
      this.ctx.font = '12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        String(nodeCount),
        x + width / 2,
        y + height / 2
      );
    }

    this.ctx.restore();
  }

  drawText(
    text: string,
    x: number,
    y: number,
    options: {
      font?: string;
      fill?: string;
      align?: CanvasTextAlign;
      baseline?: CanvasTextBaseline;
      maxWidth?: number;
    } = {}
  ): void {
    this.ctx.save();
    this.ctx.font = options.font || '12px sans-serif';
    this.ctx.fillStyle = options.fill || '#333';
    this.ctx.textAlign = options.align || 'left';
    this.ctx.textBaseline = options.baseline || 'top';

    if (options.maxWidth) {
      this.ctx.fillText(text, x, y, options.maxWidth);
    } else {
      this.ctx.fillText(text, x, y);
    }
    this.ctx.restore();
  }
}

// ============================================================================
// SVG Header Renderer
// ============================================================================

const renderSVGHeaders = (
  svg: SVGSVGElement,
  canvasState: D3CanvasState,
  _viewport: Viewport
): void => {
  const svgSelection = d3.select(svg);

  // Clear previous content
  svgSelection.selectAll('*').remove();

  // For now, create simple placeholder headers
  // TODO: Implement full hierarchical header rendering in next phase

  const { scaleSystem } = canvasState;

  // Column headers
  const colHeaderHeight = 50;
  const colHeaders = svgSelection
    .append('g')
    .attr('class', 'column-headers')
    .attr('transform', `translate(0, 0)`);

  scaleSystem.x.composite.domain().forEach((colKey, _index) => {
    const x = scaleSystem.x.composite(colKey) || 0;
    const width = scaleSystem.x.composite.bandwidth();

    const header = colHeaders
      .append('g')
      .attr('class', 'column-header')
      .attr('transform', `translate(${x}, 0)`);

    header
      .append('rect')
      .attr('width', width)
      .attr('height', colHeaderHeight)
      .attr('fill', '#f5f5f5')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1);

    header
      .append('text')
      .attr('x', width / 2)
      .attr('y', colHeaderHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .text(colKey.split('|').join(' • '));
  });

  // Row headers
  const rowHeaderWidth = 100;
  const rowHeaders = svgSelection
    .append('g')
    .attr('class', 'row-headers')
    .attr('transform', `translate(0, ${colHeaderHeight})`);

  scaleSystem.y.composite.domain().forEach((rowKey, _index) => {
    const y = scaleSystem.y.composite(rowKey) || 0;
    const height = scaleSystem.y.composite.bandwidth();

    const header = rowHeaders
      .append('g')
      .attr('class', 'row-header')
      .attr('transform', `translate(0, ${y})`);

    header
      .append('rect')
      .attr('width', rowHeaderWidth)
      .attr('height', height)
      .attr('fill', '#f5f5f5')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1);

    header
      .append('text')
      .attr('x', rowHeaderWidth / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .text(rowKey.split('|').join(' • '));
  });
};

// ============================================================================
// Main D3Canvas Component
// ============================================================================

export const D3Canvas: React.FC<D3CanvasProps> = ({
  className = '',
  onCellClick,
  onError,
  showPerformanceOverlay = process.env.NODE_ENV === 'development'
}) => {
  // Refs for the three layers
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // D3 Canvas state
  const { canvasState, performance, error, updateViewport } = useD3Canvas(containerRef);

  // Interaction state
  const [interactionState, setInteractionState] = useState<InteractionState>({
    hoveredCell: null,
    selectedCells: new Set(),
    isDragging: false,
    dragStart: null
  });

  // Performance tracking
  const [frameRate, setFrameRate] = useState(0);

  // Viewport state
  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    scale: 1
  });

  // Handle container resize
  const handleResize = useCallback((entry: ResizeObserverEntry) => {
    const { width, height } = entry.contentRect;
    const newViewport = {
      ...viewport,
      width,
      height
    };

    setViewport(newViewport);
    updateViewport(newViewport);

    // Update canvas size
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }

    // Update SVG size
    if (svgRef.current) {
      svgRef.current.setAttribute('width', String(width));
      svgRef.current.setAttribute('height', String(height));
    }
  }, [viewport, updateViewport]);

  // Use resize observer for responsive sizing
  useResizeObserver(containerRef, handleResize);

  // Optimized canvas rendering with performance monitoring
  const debouncedRender = useCallback(
    debounce(async () => {
      if (!canvasRef.current || !canvasState.renderCommands.cells.length) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await measurePerformance('canvas-render', async () => {
        const renderer = new CanvasRenderer(ctx);

        // Clear canvas
        renderer.clear(canvas.width, canvas.height);

        // Update spatial index for hit testing
        spatialIndex.clear();

        // Render cells with spatial indexing
        canvasState.renderCommands.cells.forEach(cellCommand => {
          const { bounds, style, nodes, rowKey, colKey } = cellCommand;

          renderer.drawCell(
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            style,
            nodes.length
          );

          // Add to spatial index for hit testing
          spatialIndex.insert({
            id: `${colKey}||${rowKey}`,
            bounds,
            data: { nodes, rowKey, colKey }
          });
        });

        // Update frame rate
        const fps = performanceMonitor.recordFrameTime();
        setFrameRate(fps);
      });
    }, 16), // 60fps debouncing
    [canvasState.renderCommands, spatialIndex]
  );

  // Render canvas content when state changes
  useEffect(() => {
    debouncedRender();
  }, [debouncedRender]);

  // Render SVG headers when state changes
  useEffect(() => {
    if (!svgRef.current || canvasState.error) return;

    renderSVGHeaders(svgRef.current, canvasState, viewport);
  }, [canvasState, viewport]);

  // Optimized mouse interactions with spatial indexing
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Optimized hit testing using spatial index
    const hitItem = spatialIndex.findAtPoint(x, y);
    const hoveredCell = hitItem?.id || null;

    if (hoveredCell !== interactionState.hoveredCell) {
      setInteractionState(prev => ({
        ...prev,
        hoveredCell
      }));

      // Update cursor
      if (canvas.style) {
        canvas.style.cursor = hoveredCell ? 'pointer' : 'default';
      }
    }
  }, [interactionState.hoveredCell]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Optimized click handling using spatial index
    const hitItem = spatialIndex.findAtPoint(x, y);
    if (hitItem && hitItem.data) {
      const { nodes, rowKey, colKey } = hitItem.data;

      // Call click handler
      onCellClick?.({
        nodes,
        rowKey,
        colKey
      });

      // Update selection with smooth transition
      const cellKey = hitItem.id;
      setInteractionState(prev => {
        const newSelected = new Set(prev.selectedCells);
        if (newSelected.has(cellKey)) {
          newSelected.delete(cellKey);
        } else {
          newSelected.add(cellKey);
        }
        return {
          ...prev,
          selectedCells: newSelected
        };
      });
    }
  }, [onCellClick]);

  // Report errors to parent
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Loading state
  if (canvasState.loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-gray-500">Loading D3 Canvas...</div>
      </div>
    );
  }

  // Error state
  if (canvasState.error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-red-500">
          D3 Canvas Error: {canvasState.error}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
    >
      {/* SVG Layer - Headers and interactive elements */}
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 2 }}
        width={viewport.width}
        height={viewport.height}
      />

      {/* Canvas Layer - High-performance data rendering */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ zIndex: 1 }}
        width={viewport.width}
        height={viewport.height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* DOM Overlay Layer - Accessibility and complex interactions */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 3 }}
      >
        {/* Enhanced performance overlay */}
        {showPerformanceOverlay && (
          <PerformanceOverlay
            performance={performance}
            frameRate={frameRate}
            error={error}
          />
        )}

        {/* Future: Tooltips, accessibility layer, complex controls */}
      </div>
    </div>
  );
};

export default D3Canvas;