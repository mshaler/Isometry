import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import type { Node } from '@/types/node';
import type { LATCHAxis } from '@/types/pafv';
import type { OriginPattern } from '@/types/coordinates';
import { useD3Zoom, type ZoomTransform } from '@/hooks/useD3Zoom';
import { useGridCoordinates, getUniqueAxisValues } from '@/hooks/useGridCoordinates';
import { renderColumnHeaders } from './GridBlock2_ColumnHeaders';
import { renderRowHeaders } from './GridBlock3_RowHeaders';
import { renderDataCells } from './GridBlock4_DataCells';

// D3SparsityLayer-specific coordinate system interface with function methods
export interface D3CoordinateSystem {
  originX: number;
  originY: number;
  cellWidth: number;
  cellHeight: number;
  pattern?: OriginPattern;
  scale?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  logicalToScreen: (logicalX: number, _logicalY: number) => { x: number; y: number };
  screenToLogical: (screenX: number, _screenY: number) => { x: number; y: number };
}

export interface D3SparsityLayerProps {
  data: Node[];
  coordinateSystem: D3CoordinateSystem;
  xAxis?: LATCHAxis;
  xAxisFacet?: string;
  yAxis?: LATCHAxis;
  yAxisFacet?: string;
  originPattern?: OriginPattern;
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
  xAxis = 'category',
  xAxisFacet = 'folder',
  yAxis = 'time',
  yAxisFacet = 'year',
  originPattern = 'anchor',
  onCellClick,
  onZoomChange,
  width = 800,
  height = 600,
}: D3SparsityLayerProps) {
  const containerRef = useRef<SVGGElement>(null);

  // Integrate d3-zoom behavior
  const svgRef = useD3Zoom({
    minZoom: 0.1,
    maxZoom: 10,
    onZoom: onZoomChange,
  });

  // Memoize dimensions to avoid unnecessary re-renders
  const dimensions = useMemo(() => ({ width, height }), [width, height]);

  // Calculate grid coordinates based on PAFV axis mappings
  const coordinates = useGridCoordinates({
    nodes: data,
    xAxis,
    xFacet: xAxisFacet,
    yAxis,
    yFacet: yAxisFacet,
    originPattern,
  });

  // Extract unique column and row headers
  const { columns, rows } = useMemo(() => {
    const cols = getUniqueAxisValues(coordinates, 'x');
    const rws = getUniqueAxisValues(coordinates, 'y');

    return {
      columns: cols.map(c => ({
        id: `col-${c.value}`,
        label: c.label,
        logicalX: c.value,
        width: 1,
      })),
      rows: rws.map(r => ({
        id: `row-${r.value}`,
        label: r.label,
        logicalY: r.value,
        height: 1,
      })),
    };
  }, [coordinates]);

  // Create cell data with calculated coordinates
  const cells = useMemo(() => {
    return data.map(node => {
      const coord = coordinates.get(node.id);
      return {
        id: node.id,
        node,
        logicalX: coord?.x ?? 0,
        logicalY: coord?.y ?? 0,
        value: node.name || node.summary || '(untitled)',
      };
    });
  }, [data, coordinates]);

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
      columns,
      coordinateSystem,
      headerHeight: 40,
    });

    // Render GridBlock 3: Row Headers
    renderRowHeaders({
      container: rowHeadersGroup,
      rows,
      coordinateSystem,
      headerWidth: 150,
    });

    // Render GridBlock 4: Data Cells with smooth transitions
    renderDataCells({
      container: dataCellsGroup,
      cells,
      coordinateSystem,
      onCellClick,
    });

  }, [data, coordinateSystem, dimensions, onCellClick, columns, rows, cells]);

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
