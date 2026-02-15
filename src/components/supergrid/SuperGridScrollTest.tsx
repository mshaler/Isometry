/**
 * SuperGridScrollTest - Focused test page for SuperGrid scroll verification
 *
 * Part of Phase 92 - Data Cell Integration (CELL-02)
 * Tests CSS sticky header scroll coordination with alto-index data
 *
 * Features:
 * - Schema-on-read: dynamically detects available metadata fields from Notes
 * - Hierarchical folder headers (splits on "/" for nested stacking)
 * - Only shows axes that have actual data values
 *
 * Access via: http://localhost:5173/?test=sg-scroll
 */

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useSQLite } from '@/db/SQLiteProvider';
import { useSQLiteQuery } from '@/hooks/database/useSQLiteQuery';
import { useAltoIndexImport } from '@/hooks/useAltoIndexImport';
import { SuperGridScrollContainer } from './SuperGridScrollContainer';
import { DataCellRenderer } from '@/d3/grid-rendering/DataCellRenderer';
import { transformToCellData } from '@/services/supergrid/CellDataService';
import { parseFolderHierarchy, calculateHeaderLevels } from './HierarchicalHeaderRenderer';
import type { Node } from '@/types/node';
import type { D3CoordinateSystem, DataCellData, PAFVProjection } from '@/types/grid';

// Cell dimensions for testing
const CELL_WIDTH = 120;
const CELL_HEIGHT = 60;
const HEADER_WIDTH = 200; // Wider for hierarchical folder names
const HEADER_HEIGHT = 40;

/**
 * Schema-on-read field detection
 * Analyzes loaded nodes to find which fields have actual values
 */
interface DetectedField {
  name: string;
  label: string;
  valueCount: number; // Number of distinct values
  sampleValues: string[];
}

function detectAvailableFields(nodes: Node[]): DetectedField[] {
  if (!nodes || nodes.length === 0) return [];

  // Fields to check (matching alto-importer mapping for Notes)
  const fieldsToCheck = [
    { name: 'folder', label: 'Folder' },
    { name: 'created_at', label: 'Created' },
    { name: 'modified_at', label: 'Modified' },
    { name: 'node_type', label: 'Type' },
    { name: 'tags', label: 'Tags' },
  ];

  const detected: DetectedField[] = [];

  for (const field of fieldsToCheck) {
    const values = new Set<string>();

    for (const node of nodes) {
      const value = (node as unknown as Record<string, unknown>)[field.name];
      if (value !== null && value !== undefined && value !== '') {
        // For dates, extract just the date part for grouping
        if (field.name.endsWith('_at') && typeof value === 'string') {
          values.add(value.split('T')[0] || '(none)');
        } else {
          values.add(String(value));
        }
      }
    }

    if (values.size > 0) {
      detected.push({
        name: field.name,
        label: field.label,
        valueCount: values.size,
        sampleValues: Array.from(values).slice(0, 5),
      });
    }
  }

  // Sort by value count (more values = more interesting for axis)
  return detected.sort((a, b) => b.valueCount - a.valueCount);
}

export function SuperGridScrollTest(): JSX.Element {
  const { loading: dbLoading, error: dbError } = useSQLite();

  // Refs for SVG containers
  const columnHeaderRef = useRef<SVGSVGElement>(null);
  const rowHeaderRef = useRef<SVGSVGElement>(null);
  const dataGridRef = useRef<SVGSVGElement>(null);

  // Alto-index import
  const {
    importFromPublic,
    status: importStatus,
    progress: importProgress,
    result: importResult,
  } = useAltoIndexImport();

  // Load only alto-index Notes (exclude sample data and other types)
  const { data: allNodes, loading: nodesLoading } = useSQLiteQuery<Node>(
    `SELECT * FROM nodes
     WHERE deleted_at IS NULL
       AND source = 'alto-index'
       AND node_type = 'notes'
     ORDER BY name ASC`,
    []
  );

  // Track if we've already attempted import this session
  const importAttemptedRef = useRef(false);

  // Auto-import alto-index Notes data on mount
  useEffect(() => {
    if (!dbLoading && !dbError && importStatus === 'idle' && !importAttemptedRef.current) {
      importAttemptedRef.current = true;
      importFromPublic({ clearExisting: true, dataTypes: ['notes'] });
    }
  }, [dbLoading, dbError, importStatus, importFromPublic]);

  // Schema-on-read: detect available fields from loaded data
  const availableFields = useMemo(() => {
    return detectAvailableFields(allNodes || []);
  }, [allNodes]);

  // Dynamic axis state - default to folder (X) and created_at date (Y)
  const [xFacet, setXFacet] = useState<string | null>(null);
  const [yFacet, setYFacet] = useState<string | null>(null);

  // Set initial axes once fields are detected
  useEffect(() => {
    if (availableFields.length > 0 && xFacet === null) {
      // Default X to folder (hierarchical), Y to created_at (temporal)
      const folderField = availableFields.find(f => f.name === 'folder');
      const createdField = availableFields.find(f => f.name === 'created_at');
      const nodeTypeField = availableFields.find(f => f.name === 'node_type');

      setXFacet(folderField?.name || availableFields[0]?.name || 'folder');
      setYFacet(createdField?.name || nodeTypeField?.name || availableFields[1]?.name || 'node_type');
    }
  }, [availableFields, xFacet]);

  // Create projection config (only when axes are set)
  const projection: PAFVProjection = useMemo(() => ({
    xAxis: xFacet ? { facet: xFacet, axis: 'category' } : null,
    yAxis: yFacet ? { facet: yFacet, axis: 'category' } : null,
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

  // Helper to extract and format field values for axis labels
  const extractAxisValue = useCallback((node: Node, facet: string): string => {
    const value = (node as unknown as Record<string, unknown>)[facet];

    if (value === null || value === undefined || value === '') {
      return '(none)';
    }

    // For date fields, extract just the date part (YYYY-MM-DD)
    if (facet.endsWith('_at') && typeof value === 'string') {
      return value.split('T')[0] || '(none)';
    }

    return String(value);
  }, []);

  // Get axis labels - with hierarchical folder support
  const { xLabels, yLabels } = useMemo(() => {
    if (!allNodes || allNodes.length === 0 || !xFacet || !yFacet) {
      return { xLabels: [], yLabels: [] };
    }

    // Extract unique values for each axis
    const xValueSet = new Set<string>();
    const yValueSet = new Set<string>();

    allNodes.forEach((node) => {
      const xVal = extractAxisValue(node, xFacet);
      const yVal = extractAxisValue(node, yFacet);
      xValueSet.add(xVal);
      yValueSet.add(yVal);
    });

    return {
      xLabels: Array.from(xValueSet).sort(),
      yLabels: Array.from(yValueSet).sort(),
    };
  }, [allNodes, xFacet, yFacet, extractAxisValue]);

  // Calculate header depths for hierarchical display
  const { xHeaderDepth, yHeaderDepth: _yHeaderDepth } = useMemo(() => {
    const getDepth = (labels: string[], facet: string | null) => {
      if (facet !== 'folder') return 1;
      const compositeKeys = parseFolderHierarchy(labels);
      const { maxDepth } = calculateHeaderLevels(compositeKeys, 'x');
      return maxDepth;
    };

    return {
      xHeaderDepth: getDepth(xLabels, xFacet),
      yHeaderDepth: getDepth(yLabels, yFacet),
    };
  }, [xLabels, yLabels, xFacet, yFacet]);

  // Calculate effective header dimensions
  const _effectiveHeaderHeight = xFacet === 'folder' ? HEADER_HEIGHT * xHeaderDepth : HEADER_HEIGHT;
  const _effectiveHeaderWidth = yFacet === 'folder' ? HEADER_WIDTH : HEADER_WIDTH;

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

  // Render column headers - hierarchical when folder axis, flat otherwise
  useEffect(() => {
    if (!columnHeaderRef.current || xLabels.length === 0) return;

    const svg = d3.select(columnHeaderRef.current);
    svg.selectAll('*').remove();

    if (xFacet === 'folder') {
      // Use hierarchical rendering for folder paths
      const g = svg.append('g');
      const compositeKeys = parseFolderHierarchy(xLabels);
      const { headers } = calculateHeaderLevels(compositeKeys, 'x');

      // Render hierarchical headers inline
      const levels = new Map<number, typeof headers>();
      headers.forEach(h => {
        if (!levels.has(h.level)) levels.set(h.level, []);
        levels.get(h.level)!.push(h);
      });

      const maxLevel = Math.max(...headers.map(h => h.level));
      const positioned: typeof headers = [];

      // Position leaf headers
      const leafHeaders = levels.get(maxLevel) || [];
      leafHeaders.forEach((header, index) => {
        header.x = index * CELL_WIDTH;
        header.y = maxLevel * HEADER_HEIGHT;
        header.width = CELL_WIDTH - 1;
        header.height = HEADER_HEIGHT - 1;
        positioned.push(header);
      });

      // Position parent headers
      for (let level = maxLevel - 1; level >= 0; level--) {
        const levelHeaders = levels.get(level) || [];
        levelHeaders.forEach(header => {
          const children = positioned.filter(h =>
            h.level === level + 1 && h.parentKey === header.key
          );
          if (children.length > 0) {
            const minX = Math.min(...children.map(c => c.x!));
            const maxX = Math.max(...children.map(c => c.x! + c.width!));
            header.x = minX;
            header.y = level * HEADER_HEIGHT;
            header.width = maxX - minX - 1;
            header.height = HEADER_HEIGHT - 1;
          } else {
            header.x = 0;
            header.y = level * HEADER_HEIGHT;
            header.width = CELL_WIDTH - 1;
            header.height = HEADER_HEIGHT - 1;
          }
          positioned.push(header);
        });
      }

      // Render with D3 join
      g.selectAll<SVGGElement, typeof headers[0]>('.col-header')
        .data(positioned, d => d.key)
        .join(
          enter => {
            const groups = enter.append('g')
              .attr('class', d => `col-header col-header--level-${d.level}`)
              .attr('transform', d => `translate(${d.x}, ${d.y})`);

            groups.append('rect')
              .attr('width', d => d.width!)
              .attr('height', d => d.height!)
              .attr('fill', d => d.level === 0 ? '#e2e8f0' : '#f1f5f9')
              .attr('stroke', d => d.level === 0 ? '#cbd5e1' : '#e2e8f0')
              .attr('rx', 4);

            groups.append('text')
              .attr('x', d => d.width! / 2)
              .attr('y', d => d.height! / 2)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .attr('font-size', d => d.level === 0 ? '11px' : '10px')
              .attr('font-weight', d => d.level === 0 ? '600' : '400')
              .attr('fill', d => d.level === 0 ? '#334155' : '#64748b')
              .text(d => {
                const maxChars = Math.max(8, Math.floor(d.width! / 8));
                return d.value.length > maxChars ? d.value.slice(0, maxChars) + '...' : d.value;
              });

            return groups;
          }
        );
    } else {
      // Flat headers for non-folder axes
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
    }
  }, [xLabels, xFacet]);

  // Render row headers - hierarchical when folder axis, flat otherwise
  useEffect(() => {
    if (!rowHeaderRef.current || yLabels.length === 0) return;

    const svg = d3.select(rowHeaderRef.current);
    svg.selectAll('*').remove();

    if (yFacet === 'folder') {
      // Use hierarchical rendering for folder paths
      const g = svg.append('g');
      const compositeKeys = parseFolderHierarchy(yLabels);
      const { headers } = calculateHeaderLevels(compositeKeys, 'y');

      const levels = new Map<number, typeof headers>();
      headers.forEach(h => {
        if (!levels.has(h.level)) levels.set(h.level, []);
        levels.get(h.level)!.push(h);
      });

      const maxLevel = Math.max(...headers.map(h => h.level));
      const positioned: typeof headers = [];

      // Position leaf headers (rightmost)
      const leafHeaders = levels.get(maxLevel) || [];
      leafHeaders.forEach((header, index) => {
        const levelWidth = HEADER_WIDTH / (maxLevel + 1);
        header.x = maxLevel * levelWidth;
        header.y = index * CELL_HEIGHT;
        header.width = levelWidth - 2;
        header.height = CELL_HEIGHT - 1;
        positioned.push(header);
      });

      // Position parent headers (left to right)
      for (let level = maxLevel - 1; level >= 0; level--) {
        const levelHeaders = levels.get(level) || [];
        const levelWidth = HEADER_WIDTH / (maxLevel + 1);
        levelHeaders.forEach(header => {
          const children = positioned.filter(h =>
            h.level === level + 1 && h.parentKey === header.key
          );
          if (children.length > 0) {
            const minY = Math.min(...children.map(c => c.y!));
            const maxY = Math.max(...children.map(c => c.y! + c.height!));
            header.x = level * levelWidth;
            header.y = minY;
            header.width = levelWidth - 2;
            header.height = maxY - minY - 1;
          } else {
            header.x = level * levelWidth;
            header.y = 0;
            header.width = levelWidth - 2;
            header.height = CELL_HEIGHT - 1;
          }
          positioned.push(header);
        });
      }

      // Render with D3 join
      g.selectAll<SVGGElement, typeof headers[0]>('.row-header')
        .data(positioned, d => d.key)
        .join(
          enter => {
            const groups = enter.append('g')
              .attr('class', d => `row-header row-header--level-${d.level}`)
              .attr('transform', d => `translate(${d.x}, ${d.y})`);

            groups.append('rect')
              .attr('width', d => d.width!)
              .attr('height', d => d.height!)
              .attr('fill', d => d.level === 0 ? '#e2e8f0' : '#f1f5f9')
              .attr('stroke', d => d.level === 0 ? '#cbd5e1' : '#e2e8f0')
              .attr('rx', 4);

            groups.append('text')
              .attr('x', d => d.width! / 2)
              .attr('y', d => d.height! / 2)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .attr('font-size', d => d.level === 0 ? '11px' : '10px')
              .attr('font-weight', d => d.level === 0 ? '600' : '400')
              .attr('fill', d => d.level === 0 ? '#334155' : '#64748b')
              .text(d => {
                const maxChars = Math.max(6, Math.floor(d.width! / 7));
                return d.value.length > maxChars ? d.value.slice(0, maxChars) + '...' : d.value;
              });

            return groups;
          }
        );
    } else {
      // Flat headers for non-folder axes
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
    }
  }, [yLabels, yFacet]);

  // Render data cells with white background
  useEffect(() => {
    if (!dataGridRef.current || cells.length === 0) return;

    const svg = d3.select(dataGridRef.current);
    svg.selectAll('*').remove();

    // Add white background rect
    svg.append('rect')
      .attr('class', 'grid-background')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', contentWidth)
      .attr('height', contentHeight)
      .attr('fill', '#ffffff');

    const g = svg.append('g').attr('class', 'data-cells-container');

    const renderer = new DataCellRenderer(coordinateSystem);
    renderer.render(g as unknown as d3.Selection<SVGGElement, unknown, null, undefined>, cells, {
      onCellClick: (node) => {
        console.log('Cell clicked:', node.name);
      },
    });
  }, [cells, coordinateSystem, contentWidth, contentHeight]);

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

        {/* Import Button - Notes only */}
        <button
          onClick={() => importFromPublic({ clearExisting: true, dataTypes: ['notes'] })}
          disabled={importStatus === 'loading' || importStatus === 'importing'}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {importStatus === 'importing' ? `Importing ${importProgress}%` : 'Import Notes'}
        </button>

        {/* Stats */}
        <div className="text-sm text-gray-600">
          Nodes: {allNodes?.length || 0} |
          Cells: {cells.length} |
          Grid: {xLabels.length} x {yLabels.length}
        </div>

        {/* Dynamic Axis selectors (schema-on-read) */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">X:</label>
          <select
            value={xFacet || ''}
            onChange={(e) => setXFacet(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-white"
            disabled={availableFields.length === 0}
          >
            {availableFields.map((field) => (
              <option key={field.name} value={field.name}>
                {field.label} ({field.valueCount})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Y:</label>
          <select
            value={yFacet || ''}
            onChange={(e) => setYFacet(e.target.value)}
            className="border rounded px-2 py-1 text-sm bg-white"
            disabled={availableFields.length === 0}
          >
            {availableFields.map((field) => (
              <option key={field.name} value={field.name}>
                {field.label} ({field.valueCount})
              </option>
            ))}
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
              headerWidth={_effectiveHeaderWidth}
              headerHeight={_effectiveHeaderHeight}
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
