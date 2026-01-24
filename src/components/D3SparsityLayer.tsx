import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { Node } from '@/types/node';
import { useD3Zoom, type ZoomTransform } from '@/hooks/useD3Zoom';
import { renderColumnHeaders } from './GridBlock2_ColumnHeaders';
import { renderRowHeaders } from './GridBlock3_RowHeaders';
import { renderDataCells } from './GridBlock4_DataCells';
import {
  getCellData,
  extractColumnHeaders,
  extractRowHeaders,
} from '@/utils/d3-helpers';

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
  xAxisFacet?: string;
  yAxisFacet?: string;
  onCellClick?: (node: Node) => void;
  onZoomChange?: (transform: ZoomTransform) => void;
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
  xAxisFacet = 'folder',
  yAxisFacet = 'modifiedAt',
  onCellClick,
  onZoomChange,
  width = 800,
  height = 600,
}: D3SparsityLayerProps) {
  const containerRef = useRef<SVGGElement>(null);
  const [zoomTransform, setZoomTransform] = useState<ZoomTransform>({ x: 0, y: 0, k: 1 });

  // Integrate d3-zoom behavior
  const svgRef = useD3Zoom<SVGSVGElement>({
    minZoom: 0.1,
    maxZoom: 10,
    onZoom: (transform) => {
      setZoomTransform(transform);
      onZoomChange?.(transform);
    },
  });

  // Memoize dimensions to avoid unnecessary re-renders
  const dimensions = useMemo(() => ({ width, height }), [width, height]);

  // Prepare grid data from nodes
  const gridData = useMemo(() => {
    if (!data || data.length === 0) {
      return { columns: [], rows: [], cells: [] };
    }

    const columns = extractColumnHeaders(data, xAxisFacet);
    const rows = extractRowHeaders(data, yAxisFacet);
    const cells = data.map(node => getCellData(node, xAxisFacet, yAxisFacet));

    return { columns, rows, cells };
  }, [data, xAxisFacet, yAxisFacet]);

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

    // Render GridBlock 2: Column Headers
    renderColumnHeaders({
      container: columnHeadersGroup,
      columns: gridData.columns,
      coordinateSystem,
      headerHeight: 40,
    });

    // Render GridBlock 3: Row Headers
    renderRowHeaders({
      container: rowHeadersGroup,
      rows: gridData.rows,
      coordinateSystem,
      headerWidth: 150,
    });

    // Render GridBlock 4: Data Cells
    renderDataCells({
      container: dataCellsGroup,
      cells: gridData.cells,
      coordinateSystem,
      onCellClick,
    });

  }, [data, coordinateSystem, dimensions, onCellClick, gridData]);

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
