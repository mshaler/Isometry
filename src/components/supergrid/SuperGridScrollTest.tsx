/**
 * SuperGridScrollTest - Focused test page for SuperGrid scroll verification
 *
 * Part of Phase 92 - Data Cell Integration (CELL-02)
 * Tests CSS sticky header scroll coordination with alto-index data
 *
 * Access via: http://localhost:5173/?test=sg-scroll
 */

import { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useSQLite } from '@/db/SQLiteProvider';
import { useSQLiteQuery } from '@/hooks/database/useSQLiteQuery';
import { useAltoIndexImport } from '@/hooks/useAltoIndexImport';
import { SuperGridScrollContainer } from './SuperGridScrollContainer';
import { DataCellRenderer } from '@/d3/grid-rendering/DataCellRenderer';
import { transformToCellData } from '@/services/supergrid/CellDataService';
import type { Node } from '@/types/node';
import type { D3CoordinateSystem, DataCellData, PAFVProjection } from '@/types/grid';

// Cell dimensions for testing
const CELL_WIDTH = 120;
const CELL_HEIGHT = 60;
const HEADER_WIDTH = 150;
const HEADER_HEIGHT = 40;

export function SuperGridScrollTest(): JSX.Element {
  const { loading: dbLoading, error: dbError } = useSQLite();

  // Refs for SVG containers
  const columnHeaderRef = useRef<SVGSVGElement>(null);
  const rowHeaderRef = useRef<SVGSVGElement>(null);
  const dataGridRef = useRef<SVGSVGElement>(null);

  // Projection state
  const [xFacet, setXFacet] = useState('folder');
  const [yFacet, setYFacet] = useState('status');

  // Alto-index import
  const {
    importFromPublic,
    status: importStatus,
    progress: importProgress,
    result: importResult,
  } = useAltoIndexImport();

  // Load all nodes
  const { data: allNodes, loading: nodesLoading } = useSQLiteQuery<Node>(
    `SELECT * FROM nodes WHERE deleted_at IS NULL ORDER BY name ASC`,
    []
  );

  // Auto-import alto-index data on mount when no data exists
  useEffect(() => {
    if (!dbLoading && !dbError && !nodesLoading && importStatus === 'idle') {
      // Check if we need to import (no nodes in database)
      if (!allNodes || allNodes.length === 0) {
        importFromPublic({ clearExisting: true });
      }
    }
  }, [dbLoading, dbError, nodesLoading, allNodes, importStatus, importFromPublic]);

  // Create projection config
  const projection: PAFVProjection = useMemo(() => ({
    xAxis: { facet: xFacet, axis: 'category' },
    yAxis: { facet: yFacet, axis: 'category' },
  }), [xFacet, yFacet]);

  // Transform nodes to cell data
  const cells: DataCellData[] = useMemo(() => {
    if (!allNodes || allNodes.length === 0) return [];
    return transformToCellData(allNodes as Node[], projection);
  }, [allNodes, projection]);

  // Calculate grid dimensions
  const { contentWidth, contentHeight } = useMemo(() => {
    const xValues = new Set(cells.map(c => c.logicalX));
    const yValues = new Set(cells.map(c => c.logicalY));
    const numCols = Math.max(xValues.size, 1);
    const numRows = Math.max(yValues.size, 1);

    return {
      contentWidth: numCols * CELL_WIDTH,
      contentHeight: numRows * CELL_HEIGHT,
    };
  }, [cells]);

  // Get axis labels
  const { xLabels, yLabels } = useMemo(() => {
    if (!allNodes || allNodes.length === 0) {
      return { xLabels: [], yLabels: [] };
    }

    // Extract unique values for each axis
    const xValueSet = new Set<string>();
    const yValueSet = new Set<string>();

    allNodes.forEach((node) => {
      const xVal = (node as unknown as Record<string, unknown>)[xFacet];
      const yVal = (node as unknown as Record<string, unknown>)[yFacet];
      xValueSet.add(xVal !== null && xVal !== undefined ? String(xVal) : '(none)');
      yValueSet.add(yVal !== null && yVal !== undefined ? String(yVal) : '(none)');
    });

    return {
      xLabels: Array.from(xValueSet).sort(),
      yLabels: Array.from(yValueSet).sort(),
    };
  }, [allNodes, xFacet, yFacet]);

  // Create coordinate system
  const coordinateSystem: D3CoordinateSystem = useMemo(() => ({
    originX: 0,
    originY: 0,
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
    viewportWidth: contentWidth,
    viewportHeight: contentHeight,
    logicalToScreen: (logicalX: number, logicalY: number) => ({
      x: logicalX * CELL_WIDTH,
      y: logicalY * CELL_HEIGHT,
    }),
    screenToLogical: (screenX: number, screenY: number) => ({
      x: Math.floor(screenX / CELL_WIDTH),
      y: Math.floor(screenY / CELL_HEIGHT),
    }),
  }), [contentWidth, contentHeight]);

  // Render column headers
  useEffect(() => {
    if (!columnHeaderRef.current || xLabels.length === 0) return;

    const svg = d3.select(columnHeaderRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    xLabels.forEach((label, i) => {
      g.append('rect')
        .attr('x', i * CELL_WIDTH)
        .attr('y', 0)
        .attr('width', CELL_WIDTH - 1)
        .attr('height', HEADER_HEIGHT - 1)
        .attr('fill', '#e5e7eb')
        .attr('stroke', '#d1d5db');

      g.append('text')
        .attr('x', i * CELL_WIDTH + CELL_WIDTH / 2)
        .attr('y', HEADER_HEIGHT / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '500')
        .text(label.length > 12 ? label.slice(0, 12) + '...' : label);
    });
  }, [xLabels]);

  // Render row headers
  useEffect(() => {
    if (!rowHeaderRef.current || yLabels.length === 0) return;

    const svg = d3.select(rowHeaderRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    yLabels.forEach((label, i) => {
      g.append('rect')
        .attr('x', 0)
        .attr('y', i * CELL_HEIGHT)
        .attr('width', HEADER_WIDTH - 1)
        .attr('height', CELL_HEIGHT - 1)
        .attr('fill', '#e5e7eb')
        .attr('stroke', '#d1d5db');

      g.append('text')
        .attr('x', HEADER_WIDTH / 2)
        .attr('y', i * CELL_HEIGHT + CELL_HEIGHT / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '500')
        .text(label.length > 15 ? label.slice(0, 15) + '...' : label);
    });
  }, [yLabels]);

  // Render data cells
  useEffect(() => {
    if (!dataGridRef.current || cells.length === 0) return;

    const svg = d3.select(dataGridRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('class', 'data-cells-container');

    const renderer = new DataCellRenderer(coordinateSystem);
    renderer.render(g as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, cells, {
      onCellClick: (node) => {
        console.log('Cell clicked:', node.name);
      },
    });
  }, [cells, coordinateSystem]);

  // Loading state
  if (dbLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-lg">Loading sql.js database...</div>
      </div>
    );
  }

  // Error state
  if (dbError) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-lg text-red-600">Error: {dbError.message}</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Control Panel */}
      <div className="bg-white border-b p-4 flex items-center gap-6 flex-shrink-0">
        <h1 className="text-lg font-bold">SuperGrid Scroll Test</h1>

        {/* Import Button */}
        <button
          onClick={() => importFromPublic({ clearExisting: true })}
          disabled={importStatus === 'loading' || importStatus === 'importing'}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {importStatus === 'importing' ? `Importing ${importProgress}%` : 'Import Alto-Index'}
        </button>

        {/* Stats */}
        <div className="text-sm text-gray-600">
          Nodes: {allNodes?.length || 0} |
          Cells: {cells.length} |
          Grid: {xLabels.length} x {yLabels.length}
        </div>

        {/* Axis selectors */}
        <div className="flex items-center gap-2">
          <label className="text-sm">X:</label>
          <select
            value={xFacet}
            onChange={(e) => setXFacet(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="folder">Folder</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm">Y:</label>
          <select
            value={yFacet}
            onChange={(e) => setYFacet(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="status">Status</option>
            <option value="folder">Folder</option>
            <option value="priority">Priority</option>
          </select>
        </div>

        {importResult && (
          <span className="text-green-600 text-sm">
            Imported {importResult.imported} nodes
          </span>
        )}
      </div>

      {/* Scroll Test Instructions */}
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 flex-shrink-0">
        <strong>CELL-02 Verification:</strong> Scroll horizontally (row headers stay fixed at left) |
        Scroll vertically (column headers stay fixed at top) |
        Corner stays pinned at (0,0)
      </div>

      {/* SuperGrid Container */}
      <div className="flex-1 p-4 overflow-hidden">
        {cells.length > 0 ? (
          <div className="h-full border rounded shadow-sm bg-white">
            <SuperGridScrollContainer
              columnHeaderRef={columnHeaderRef}
              rowHeaderRef={rowHeaderRef}
              dataGridRef={dataGridRef}
              cornerContent={
                <div className="flex items-center justify-center h-full text-xs text-gray-500 font-medium">
                  {yFacet} / {xFacet}
                </div>
              }
              headerWidth={HEADER_WIDTH}
              headerHeight={HEADER_HEIGHT}
              contentWidth={contentWidth}
              contentHeight={contentHeight}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            {nodesLoading ? 'Loading nodes...' : 'No data. Click "Import Alto-Index" to load test data.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default SuperGridScrollTest;
