import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useResizeObserver } from '../hooks/useD3';
import { useD3Canvas, type D3CanvasState, type Viewport } from '../hooks/useD3Canvas';
import * as d3 from 'd3';

// ============================================================================
// Type Definitions
// ============================================================================

interface D3CanvasProps {
  className?: string;
  onCellClick?: (cellData: { nodes: any[]; rowKey: string; colKey: string }) => void;
  onError?: (error: string) => void;
  showPerformanceOverlay?: boolean;
}

interface LayerRefs {
  container: HTMLDivElement | null;
  svg: SVGSVGElement | null;
  canvas: HTMLCanvasElement | null;
  overlay: HTMLDivElement | null;
}

interface InteractionState {
  hoveredCell: string | null;
  selectedCells: Set<string>;
  isDragging: boolean;
  dragStart: { x: number; y: number } | null;
}

// ============================================================================
// Performance Overlay Component
// ============================================================================

const PerformanceOverlay: React.FC<{ performance: any; error: string | null }> = ({ performance, error }) => {
  if (!performance || performance.totalPipeline === 0) return null;

  return (
    <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded font-mono">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span>Pipeline:</span>
        <span>{performance.totalPipeline.toFixed(1)}ms</span>

        <span>Transform:</span>
        <span>{performance.dataTransform.toFixed(1)}ms</span>

        <span>Scales:</span>
        <span>{performance.scaleGeneration.toFixed(1)}ms</span>

        <span>Layout:</span>
        <span>{performance.layoutCalculation.toFixed(1)}ms</span>

        <span>Render:</span>
        <span>{performance.renderPrep.toFixed(1)}ms</span>

        <span>Memory:</span>
        <span>{performance.memoryUsage.toFixed(1)}MB</span>

        <span>Nodes:</span>
        <span>{performance.nodeCount}</span>

        <span>Cells:</span>
        <span>{performance.cellCount}</span>
      </div>

      {error && (
        <div className="mt-2 pt-2 border-t border-red-400 text-red-300">
          Error: {error}
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
  viewport: Viewport
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

  scaleSystem.x.composite.domain().forEach((colKey, index) => {
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

  scaleSystem.y.composite.domain().forEach((rowKey, index) => {
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

  // Render canvas content when state changes
  useEffect(() => {
    if (!canvasRef.current || !canvasState.renderCommands.cells.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderer = new CanvasRenderer(ctx);

    // Clear canvas
    renderer.clear(canvas.width, canvas.height);

    // Render cells
    canvasState.renderCommands.cells.forEach(cellCommand => {
      const { bounds, style, nodes } = cellCommand;

      renderer.drawCell(
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        style,
        nodes.length
      );
    });

  }, [canvasState.renderCommands]);

  // Render SVG headers when state changes
  useEffect(() => {
    if (!svgRef.current || canvasState.error) return;

    renderSVGHeaders(svgRef.current, canvasState, viewport);
  }, [canvasState, viewport]);

  // Handle mouse interactions
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Simple hit testing - find cell under cursor
    let hoveredCell: string | null = null;

    canvasState.renderCommands.cells.forEach(cellCommand => {
      const { bounds, rowKey, colKey } = cellCommand;

      if (x >= bounds.x && x <= bounds.x + bounds.width &&
          y >= bounds.y && y <= bounds.y + bounds.height) {
        hoveredCell = `${colKey}||${rowKey}`;
      }
    });

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
  }, [canvasState.renderCommands.cells, interactionState.hoveredCell]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked cell
    canvasState.renderCommands.cells.forEach(cellCommand => {
      const { bounds, rowKey, colKey, nodes } = cellCommand;

      if (x >= bounds.x && x <= bounds.x + bounds.width &&
          y >= bounds.y && y <= bounds.y + bounds.height) {

        // Call click handler
        onCellClick?.({
          nodes,
          rowKey,
          colKey
        });

        // Update selection
        const cellKey = `${colKey}||${rowKey}`;
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
    });
  }, [canvasState.renderCommands.cells, onCellClick]);

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
        {/* Performance overlay */}
        {showPerformanceOverlay && (
          <PerformanceOverlay performance={performance} error={error} />
        )}

        {/* Future: Tooltips, accessibility layer, complex controls */}
      </div>
    </div>
  );
};

export default D3Canvas;