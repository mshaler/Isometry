import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import type { Node } from '@/types/node';

export interface CoordinateSystem {
  originX: number;
  originY: number;
  cellWidth: number;
  cellHeight: number;
  logicalToScreen: (logicalX: number, logicalY: number) => { x: number; y: number };
  screenToLogical: (screenX: number, screenY: number) => { x: number; y: number };
}

export interface D3SparsityLayerProps {
  data: Node[];
  coordinateSystem: CoordinateSystem;
  onCellClick?: (node: Node) => void;
  width?: number;
  height?: number;
}

/**
 * D3SparsityLayer - z=0 layer of the SuperGrid
 *
 * Renders GridBlocks 2, 3, and 4 (Column Headers, Row Headers, Data Cells) using D3.js + SVG.
 * This is the "data floor" - shows every individual cell without aggregation.
 *
 * Architecture:
 * - z=0: SPARSITY (this layer) - D3 renders raw data
 * - z=1: DENSITY (React) - MiniNav, spanning logic
 * - z=2: OVERLAY (React) - Cards, inspector panels
 */
export function D3SparsityLayer({
  data,
  coordinateSystem,
  onCellClick,
  width = 800,
  height = 600,
}: D3SparsityLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<SVGGElement>(null);

  // Memoize dimensions to avoid unnecessary re-renders
  const dimensions = useMemo(() => ({ width, height }), [width, height]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    const container = d3.select(containerRef.current);

    // Set up SVG dimensions
    svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);

    // Clear previous content (for re-renders)
    container.selectAll('*').remove();

    // Create three nested groups for each GridBlock
    const columnHeadersGroup = container.append('g').attr('class', 'column-headers');
    const rowHeadersGroup = container.append('g').attr('class', 'row-headers');
    const dataCellsGroup = container.append('g').attr('class', 'data-cells');

    // Store groups for child components to use
    // These will be populated by GridBlock2, GridBlock3, GridBlock4 components
    // For now, we create the structure but don't render content yet

  }, [data, coordinateSystem, dimensions, onCellClick]);

  return (
    <svg
      ref={svgRef}
      className="d3-sparsity-layer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 0,
        pointerEvents: 'all',
      }}
    >
      <g ref={containerRef} className="sparsity-container" />
    </svg>
  );
}
