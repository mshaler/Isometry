/**
 * SuperGrid - The Keystone Polymorphic Data Projection Component
 *
 * SuperGrid IS the product - the polymorphic data projection that renders
 * the same LATCH-filtered, GRAPH-connected dataset through PAFV spatial
 * projection as grid, kanban, network, or timeline.
 *
 * Features:
 * - SuperStack: Nested dimensional headers with visual spanning
 * - Grid Continuum: Gallery → List → Kanban → 2D Grid → nD SuperGrid
 * - Janus Density Model: Value (zoom) × Extent (pan) orthogonal controls
 * - Direct sql.js → D3.js rendering with zero serialization
 * - PAFV axis mapping: unknown axis maps to any plane
 *
 * This component replaces 40KB of MessageBridge with direct SQLite access.
 */

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { SuperStack } from './SuperStack';
import { DensityControls } from './DensityControls';
import { usePAFV, useSQLiteQuery } from '@/hooks';
import { useHeaderDiscovery } from '@/hooks/useHeaderDiscovery';
import { useHeaderInteractions } from '@/hooks/useHeaderInteractions';
import { useSQLite } from '@/db/SQLiteProvider';
import { filterEmptyCells, type ExtentMode } from '@/d3/SuperGridEngine/DataManager';
import type { Node } from '@/types/node';
import type { LATCHAxis, AxisMapping } from '@/types/pafv';
import type { CellDescriptor } from '@/d3/SuperGridEngine/types';
import type { FacetConfig } from '@/superstack/types/superstack';
import { GridSqlHeaderAdapter } from '@/d3/grid-rendering/GridSqlHeaderAdapter';
import type { SqlHeaderAdapterConfig } from '@/d3/grid-rendering/GridSqlHeaderAdapter';
import { HeaderKeyboardController } from '@/d3/grid-rendering/HeaderKeyboardController';
import * as d3 from 'd3';
import { superGridLogger } from '@/utils/dev-logger';
import './SuperStack.css';
import './SuperGrid.css';

/**
 * Map AxisMapping (from PAFV) to FacetConfig (for SuperStack).
 * Converts LATCH axis to single-letter format and infers dataType.
 */
function mapAxisMappingToFacetConfig(mapping: AxisMapping): FacetConfig {
  // Map LATCH dimension to FacetConfig axis (single letter)
  const axisMap: Record<LATCHAxis, 'L' | 'A' | 'T' | 'C' | 'H'> = {
    location: 'L',
    alphabet: 'A',
    time: 'T',
    category: 'C',
    hierarchy: 'H',
  };

  // Infer dataType from LATCH dimension
  const dataTypeMap: Record<LATCHAxis, FacetConfig['dataType']> = {
    time: 'date',
    category: 'select',
    hierarchy: 'select',
    alphabet: 'text',
    location: 'text',
  };

  // Infer timeFormat for time facets based on common column names
  let timeFormat: string | undefined;
  if (mapping.axis === 'time') {
    // Default to year for most time columns
    timeFormat = '%Y';
    // Could extend this with column-specific formats:
    // if (mapping.facet.includes('month')) timeFormat = '%B';
    // if (mapping.facet.includes('quarter')) timeFormat = '%Q';
  }

  return {
    id: mapping.facet,
    name: mapping.facet,
    axis: axisMap[mapping.axis],
    sourceColumn: mapping.facet,
    dataType: dataTypeMap[mapping.axis],
    timeFormat,
    sortOrder: 'asc',
  };
}

interface SuperGridProps {
  /** SQL query for nodes data */
  sql?: string;
  /** Query parameters */
  params?: unknown[];
  /** Preloaded nodes to avoid duplicate queries */
  nodes?: Node[];
  /** Grid continuum mode */
  mode?: 'gallery' | 'list' | 'kanban' | 'grid' | 'supergrid';
  /** Enable SuperStack headers */
  enableSuperStack?: boolean;
  /** Enable drag-and-drop axis reordering */
  enableDragDrop?: boolean;
  /** Maximum nesting levels in headers */
  maxHeaderLevels?: number;
  /** Enable density controls UI */
  enableDensityControls?: boolean;
  /** Initial value density level */
  initialValueDensity?: number;
  /** Initial extent density mode */
  initialExtentDensity?: ExtentMode;
  /** Callback when cell is clicked */
  onCellClick?: (node: Node) => void;
  /** Callback when header is clicked */
  onHeaderClick?: (level: number, value: string, axis: LATCHAxis) => void;
  /** Callback when density changes */
  onDensityChange?: (valueDensity: number, extentDensity: ExtentMode) => void;
}

/**
 * SuperGrid: The polymorphic data projection keystone
 *
 * Grid Continuum:
 * - Gallery: 0 explicit axes (icon view)
 * - List: 1 axis (hierarchical list)
 * - Kanban: 1 facet columns
 * - Grid: 2 axes (row × column)
 * - SuperGrid: n axes (nested PAFV headers)
 */
export function SuperGrid({
  sql = "SELECT * FROM nodes WHERE deleted_at IS NULL LIMIT 100",
  params = [],
  nodes: nodesProp,
  mode = 'supergrid',
  enableSuperStack = true,
  enableDragDrop = true,
  maxHeaderLevels = 4,
  enableDensityControls = true,
  initialValueDensity = 0,
  initialExtentDensity = 'dense',
  onCellClick,
  onHeaderClick,
  onDensityChange
}: SuperGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { state: pafvState } = usePAFV();

  // Janus Density State
  const [valueDensity, setValueDensity] = useState(initialValueDensity);
  const [extentDensity, setExtentDensity] = useState<ExtentMode>(initialExtentDensity);

  // Handle density control changes
  const handleValueDensityChange = useCallback((level: number) => {
    setValueDensity(level);
    onDensityChange?.(level, extentDensity);
  }, [extentDensity, onDensityChange]);

  const handleExtentDensityChange = useCallback((mode: ExtentMode) => {
    setExtentDensity(mode);
    onDensityChange?.(valueDensity, mode);
  }, [valueDensity, onDensityChange]);

  // Load nodes from SQLite with direct sql.js access
  const queryEnabled = nodesProp == null;
  const { data: queryNodes, loading: queryLoading, error: queryError } = useSQLiteQuery<Node>(
    sql,
    params,
    { enabled: queryEnabled }
  );
  const nodes = nodesProp ?? queryNodes;
  const loading = queryEnabled ? queryLoading : false;
  const error = queryEnabled ? queryError : null;

  // Determine grid layout based on PAFV mappings and mode
  // Supports stacked facets (multiple mappings per plane)
  const gridLayout = useMemo(() => {
    // Get ALL mappings for each plane (stacked axes support)
    const xMappings = pafvState.mappings.filter((m: AxisMapping) => m.plane === 'x');
    const yMappings = pafvState.mappings.filter((m: AxisMapping) => m.plane === 'y');

    return {
      hasColumns: xMappings.length > 0,
      hasRows: yMappings.length > 0,
      // Single facet (legacy compatibility)
      columnAxis: xMappings[0]?.axis,
      rowAxis: yMappings[0]?.axis,
      columnFacet: xMappings[0]?.facet,
      rowFacet: yMappings[0]?.facet,
      // Stacked facets (multiple per plane)
      columnMappings: xMappings,
      rowMappings: yMappings,
      columnFacets: xMappings.map((m: AxisMapping) => m.facet),
      rowFacets: yMappings.map((m: AxisMapping) => m.facet),
      isColumnStacked: xMappings.length > 1,
      isRowStacked: yMappings.length > 1,
      effectiveMode: mode === 'supergrid' && (xMappings.length === 0 && yMappings.length === 0) ? 'gallery' : mode
    };
  }, [pafvState.mappings, mode]);

  // SQL-driven header discovery (Phase 90-02)
  // Get database instance from SQLiteProvider
  const { db } = useSQLite();

  // Convert PAFV mappings to FacetConfig arrays
  // X-axis (columns) mapping -> columnFacets, Y-axis (rows) mapping -> rowFacets
  const columnFacets = useMemo(() => {
    const xMappings = pafvState.mappings.filter((m: AxisMapping) => m.plane === 'x');
    return xMappings.map(mapAxisMappingToFacetConfig);
  }, [pafvState.mappings]);

  const rowFacets = useMemo(() => {
    const yMappings = pafvState.mappings.filter((m: AxisMapping) => m.plane === 'y');
    return yMappings.map(mapAxisMappingToFacetConfig);
  }, [pafvState.mappings]);

  // Use header discovery hook (SQL-04: loading state, SQL-05: empty datasets)
  const {
    columnTree: discoveredColumnTree,
    rowTree: discoveredRowTree,
    isLoading: headersLoading,
    error: headerError,
    // refresh: refreshHeaders, // Available for manual refresh if needed
  } = useHeaderDiscovery(db, columnFacets, rowFacets);

  // Use header interactions hook for collapse/filter state (Phase 91-01)
  const {
    collapsedIds,
    selectedHeaderId,
    handleHeaderToggle,
    handleHeaderClick: handleInteractionHeaderClick,
    handleHeaderSelect,
    columnTree,
    rowTree,
  } = useHeaderInteractions({
    columnTree: discoveredColumnTree,
    rowTree: discoveredRowTree,
    onFilterChange: (constraints) => {
      // TODO: Wire to FilterContext in Phase 92 (Data Cell Integration)
      // For now, log to console for debugging
      superGridLogger.debug('[SuperGrid] Filter constraints from header click:', constraints);
    },
  });

  // Handle keyboard toggle - determines new collapsed state from collapsedIds (Phase 91-02)
  const handleKeyboardToggle = useCallback((headerId: string) => {
    const isCurrentlyCollapsed = collapsedIds.has(headerId);
    handleHeaderToggle(headerId, !isCurrentlyCollapsed);
  }, [collapsedIds, handleHeaderToggle]);

  // Create GridSqlHeaderAdapter ref for coordinating SQL-driven headers
  const svgRef = useRef<SVGSVGElement>(null);
  const sqlHeaderAdapterRef = useRef<GridSqlHeaderAdapter | null>(null);
  // HeaderKeyboardController ref for keyboard navigation (Phase 91-02)
  const keyboardControllerRef = useRef<HeaderKeyboardController | null>(null);

  // Initialize adapter when SVG ref is available
  useEffect(() => {
    if (svgRef.current && !sqlHeaderAdapterRef.current) {
      const config: SqlHeaderAdapterConfig = {
        rowHeaderWidth: 200, // Default, should match SuperStack config
        headerHeight: 40,
        cellWidth: 160,
        cellHeight: 100,
        padding: 4,
        animationDuration: 300,
        // Phase 91-01: Wire interaction callbacks
        onHeaderToggle: handleHeaderToggle,
        onHeaderFilter: handleInteractionHeaderClick,
        onHeaderSelect: handleHeaderSelect,
      };

      // Cast to SVGElement since GridSqlHeaderAdapter expects base SVGElement
      sqlHeaderAdapterRef.current = new GridSqlHeaderAdapter(
        d3.select(svgRef.current as SVGElement),
        config
      );
    }
  }, [handleHeaderToggle, handleInteractionHeaderClick, handleHeaderSelect]);

  // Update adapter when header trees change
  useEffect(() => {
    if (sqlHeaderAdapterRef.current) {
      sqlHeaderAdapterRef.current.setColumnHeaderTree(columnTree);
      sqlHeaderAdapterRef.current.setRowHeaderTree(rowTree);

      // Render SQL-driven headers if available
      if (sqlHeaderAdapterRef.current.hasSqlDrivenHeaders()) {
        sqlHeaderAdapterRef.current.renderSqlDrivenHeaders();
      }
    }
  }, [columnTree, rowTree]);

  // Update selected header visual highlight (Phase 91-01)
  useEffect(() => {
    if (sqlHeaderAdapterRef.current) {
      sqlHeaderAdapterRef.current.updateSelectedHeader(selectedHeaderId);
    }
  }, [selectedHeaderId]);

  // Initialize HeaderKeyboardController when SVG is ready (Phase 91-02)
  useEffect(() => {
    if (!svgRef.current || !sqlHeaderAdapterRef.current) return;

    const container = d3.select(svgRef.current as SVGElement);

    // Create keyboard controller
    keyboardControllerRef.current = new HeaderKeyboardController(
      container,
      { enableKeyboardNavigation: true },
      {
        onFocusChange: (headerId) => {
          sqlHeaderAdapterRef.current?.updateFocusedHeader(headerId);
        },
        onToggle: (headerId) => {
          handleKeyboardToggle(headerId);
        },
        onSelect: (headerId) => {
          handleHeaderSelect(headerId);
        },
      }
    );

    // Set initial header IDs for navigation
    const headerIds = sqlHeaderAdapterRef.current.getHeaderIds();
    keyboardControllerRef.current.setHeaderIds(headerIds);

    return () => {
      keyboardControllerRef.current?.destroy();
      keyboardControllerRef.current = null;
    };
  }, [handleKeyboardToggle, handleHeaderSelect]);

  // Update header IDs when trees change (Phase 91-02)
  useEffect(() => {
    if (keyboardControllerRef.current && sqlHeaderAdapterRef.current) {
      const headerIds = sqlHeaderAdapterRef.current.getHeaderIds();
      keyboardControllerRef.current.setHeaderIds(headerIds);
    }
  }, [columnTree, rowTree]);

  // Group nodes by grid coordinates
  // Supports stacked facets using composite keys (e.g., "folder|status")
  const gridData = useMemo(() => {
    if (!nodes?.length) {
      return {
        cells: [],
        columnHeaders: [],
        rowHeaders: [],
        isStacked: { columns: false, rows: false }
      };
    }

    const cells = new Map<string, Node[]>();
    const columnValues = new Set<string>();
    const rowValues = new Set<string>();

    nodes.forEach((node: Node) => {
      let colKey = 'default';
      let rowKey = 'default';

      // Extract column value (supports stacked facets)
      if (gridLayout.hasColumns) {
        if (gridLayout.isColumnStacked && gridLayout.columnMappings.length > 0) {
          // Build composite key from all column facets
          colKey = gridLayout.columnMappings
            .map((m: AxisMapping) => extractNodeValue(node, m.axis, m.facet))
            .join('|');
        } else if (gridLayout.columnAxis && gridLayout.columnFacet) {
          colKey = extractNodeValue(node, gridLayout.columnAxis, gridLayout.columnFacet);
        }
        columnValues.add(colKey);
      }

      // Extract row value (supports stacked facets)
      if (gridLayout.hasRows) {
        if (gridLayout.isRowStacked && gridLayout.rowMappings.length > 0) {
          // Build composite key from all row facets
          rowKey = gridLayout.rowMappings
            .map((m: AxisMapping) => extractNodeValue(node, m.axis, m.facet))
            .join('|');
        } else if (gridLayout.rowAxis && gridLayout.rowFacet) {
          rowKey = extractNodeValue(node, gridLayout.rowAxis, gridLayout.rowFacet);
        }
        rowValues.add(rowKey);
      }

      // Use a separator unlikely to appear in axis values (double pipe)
      const cellKey = `${rowKey}||${colKey}`;
      if (!cells.has(cellKey)) {
        cells.set(cellKey, []);
      }
      cells.get(cellKey)!.push(node);
    });

    // Convert to cell descriptors for density filtering
    // Use localeCompare for consistent sorting with SuperStack headers
    const sortedColumns = Array.from(columnValues).sort((a, b) => a.localeCompare(b));
    const sortedRows = Array.from(rowValues).sort((a, b) => a.localeCompare(b));

    const allCells: CellDescriptor[] = Array.from(cells.entries()).map(([key, cellNodes]) => {
      const [rowKey, colKey] = key.split('||');
      return {
        id: `cell-${rowKey}-${colKey}`,
        gridX: sortedColumns.indexOf(colKey),
        gridY: sortedRows.indexOf(rowKey),
        xValue: colKey,
        yValue: rowKey,
        nodeIds: cellNodes.map(n => n.id),
        nodeCount: cellNodes.length,
      };
    });

    // Apply extent density filtering
    const filteredCells = filterEmptyCells(allCells, extentDensity);

    // Map back to display format with original nodes
    const displayCells = filteredCells.map(cell => ({
      rowKey: cell.yValue,
      colKey: cell.xValue,
      nodes: cells.get(`${cell.yValue}||${cell.xValue}`) || []
    }));

    return {
      cells: displayCells,
      columnHeaders: sortedColumns,
      rowHeaders: sortedRows,
      isStacked: {
        columns: gridLayout.isColumnStacked,
        rows: gridLayout.isRowStacked
      }
    };
  }, [nodes, gridLayout, extentDensity]);

  // Handle cell click
  const handleCellClick = useCallback((node: Node) => {
    onCellClick?.(node);
  }, [onCellClick]);

  // Handle header click (filters data)
  const handleHeaderClick = useCallback((level: number, value: string, axis: LATCHAxis) => {
    onHeaderClick?.(level, value, axis);
    // TODO: Apply filter to current query
  }, [onHeaderClick]);

  // Loading state
  if (loading) {
    return (
      <div className="supergrid supergrid--loading">
        <div className="supergrid__loading-spinner" />
        <span>Loading SuperGrid...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="supergrid supergrid--error">
        <div className="supergrid__error-icon">⚠️</div>
        <h3>SuperGrid Error</h3>
        <p>{error.message}</p>
        <details>
          <summary>SQL Query</summary>
          <code>{sql}</code>
        </details>
      </div>
    );
  }

  // Empty state
  if (!nodes?.length) {
    return (
      <div className="supergrid supergrid--empty">
        <div className="supergrid__empty-icon">📊</div>
        <h3>No Data</h3>
        <p>No nodes found for the current query.</p>
        <code>{sql}</code>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className={`supergrid supergrid--${gridLayout.effectiveMode}`}
      data-mode={gridLayout.effectiveMode}
      data-columns={gridLayout.hasColumns}
      data-rows={gridLayout.hasRows}
    >
      {/* Density Controls - Above the grid */}
      {enableDensityControls && (
        <div className="supergrid__density-controls">
          <DensityControls
            valueDensity={valueDensity}
            maxValueLevel={maxHeaderLevels}
            extentDensity={extentDensity}
            onValueDensityChange={handleValueDensityChange}
            onExtentDensityChange={handleExtentDensityChange}
          />
        </div>
      )}

      {/* Header Discovery Loading/Error Indicators (SQL-04, SQL-05) */}
      {headersLoading && (
        <div className="supergrid__header-status supergrid__header-status--loading">
          <span className="supergrid__spinner" />
          <span>Discovering headers...</span>
        </div>
      )}
      {headerError && (
        <div className="supergrid__header-status supergrid__header-status--error">
          <span className="supergrid__error-icon">⚠️</span>
          <span>Header discovery failed: {headerError.message}</span>
        </div>
      )}

      {/* SVG container for SQL-driven headers (hidden, adapter renders into this) */}
      <svg ref={svgRef} className="supergrid__sql-headers" style={{ position: 'absolute', width: 0, height: 0 }}>
        <g className="headers" />
      </svg>

      {/* Corner Cell - Sticky at top-left intersection */}
      {enableSuperStack && gridLayout.hasColumns && gridLayout.hasRows && (
        <div className="supergrid__corner" aria-hidden="true" />
      )}

      {/* Column Headers (Top) - Sticky at top */}
      {enableSuperStack && gridLayout.hasColumns && (
        <div className="supergrid__column-headers">
          <SuperStack
            orientation="horizontal"
            nodes={nodes}
            onHeaderClick={handleHeaderClick}
            enableDragDrop={enableDragDrop}
            maxLevels={maxHeaderLevels}
          />
        </div>
      )}

      <div className="supergrid__content">
        {/* Row Headers (Left) */}
        {enableSuperStack && gridLayout.hasRows && (
          <div className="supergrid__row-headers">
            <SuperStack
              orientation="vertical"
              nodes={nodes}
              onHeaderClick={handleHeaderClick}
              enableDragDrop={enableDragDrop}
              maxLevels={maxHeaderLevels}
            />
          </div>
        )}

        {/* Data Grid */}
        <div
          className="supergrid__data-grid"
          style={{
            gridTemplateColumns: gridLayout.hasColumns
              ? `repeat(${gridData.columnHeaders.length || 1}, 1fr)`
              : '1fr',
            gridTemplateRows: gridLayout.hasRows
              ? `repeat(${gridData.rowHeaders.length || 1}, 1fr)`
              : 'auto'
          }}
        >
          {gridLayout.effectiveMode === 'gallery' ? (
            // Gallery mode: icon view
            nodes.map((node: Node) => (
              <div
                key={node.id}
                className="supergrid__cell supergrid__cell--gallery"
                onClick={() => handleCellClick(node)}
              >
                <div className="supergrid__cell-icon">📄</div>
                <div className="supergrid__cell-title">{node.name}</div>
              </div>
            ))
          ) : (
            // Grid modes: cell-based layout
            gridData.cells.map(cell => {
              // Calculate grid positions (ensure minimum of 1 for valid CSS grid)
              const colIndex = gridData.columnHeaders.indexOf(cell.colKey);
              const rowIndex = gridData.rowHeaders.indexOf(cell.rowKey);
              const gridColumn = gridLayout.hasColumns ? Math.max(1, colIndex + 1) : 1;
              const gridRow = gridLayout.hasRows ? Math.max(1, rowIndex + 1) : 1;

              return (
              <div
                key={`${cell.rowKey}-${cell.colKey}`}
                className="supergrid__cell"
                data-row={cell.rowKey}
                data-col={cell.colKey}
                style={{ gridColumn, gridRow }}
              >
                <div className="supergrid__cell-content">
                  {cell.nodes.length === 1 ? (
                    // Single node
                    <div
                      className="supergrid__node"
                      onClick={() => handleCellClick(cell.nodes[0])}
                    >
                      <div className="supergrid__node-title">{cell.nodes[0].name}</div>
                      <div className="supergrid__node-summary">{cell.nodes[0].summary}</div>
                    </div>
                  ) : (
                    // Multiple nodes (SuperSize: inline cell expansion)
                    <div className="supergrid__multi-node">
                      <div className="supergrid__node-count">
                        {cell.nodes.length} items
                      </div>
                      <div className="supergrid__node-preview">
                        {cell.nodes.slice(0, 3).map(node => (
                          <div
                            key={node.id}
                            className="supergrid__node supergrid__node--preview"
                            onClick={() => handleCellClick(node)}
                          >
                            {node.name}
                          </div>
                        ))}
                        {cell.nodes.length > 3 && (
                          <div className="supergrid__node-more">
                            +{cell.nodes.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>

      {/* Debug Info (Development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="supergrid__debug">
          <details>
            <summary>SuperGrid Debug ({nodes.length} nodes)</summary>
            <pre>{JSON.stringify({ gridLayout, pafvState, gridData: {
              cellCount: gridData.cells.length,
              columnHeaders: gridData.columnHeaders,
              rowHeaders: gridData.rowHeaders
            }}, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

/**
 * Extract value from node for given axis and facet
 * Supports both camelCase (JS) and snake_case (DB) field names
 * Also handles alto-index specific fields (node_type, type, path)
 */
function extractNodeValue(node: Node, axis: LATCHAxis, facet: string): string {
  // Cast to record for dynamic property access
  const record = node as unknown as Record<string, unknown>;

  // Direct field access (handles snake_case from DB and alto-index fields)
  // Try exact facet name first, then common variations
  const directValue = record[facet] ??
    record[facet.replace(/_/g, '')] ??  // node_type -> nodetype
    record[facet.replace(/([A-Z])/g, '_$1').toLowerCase()]; // nodeType -> node_type

  if (directValue !== undefined && directValue !== null && directValue !== '') {
    return String(directValue);
  }

  // Axis-specific extraction with fallbacks
  switch (axis) {
    case 'location':
      if (facet === 'location_name' || facet === 'locationName') {
        return String(record.location_name ?? record.locationName ?? node.locationName ?? 'Unknown');
      }
      return String(record.location ?? node.locationName ?? 'Unknown');

    case 'alphabet':
      if (facet === 'name') {
        const name = String(record.name ?? node.name ?? '');
        return name.charAt(0).toUpperCase() || 'Unknown';
      }
      return (node.name ?? 'U').charAt(0).toUpperCase();

    case 'time': {
      // Support multiple date field names
      const dateStr = String(
        record[facet] ??
        record.created_at ?? record.createdAt ??
        record.modified_at ?? record.modifiedAt ??
        node.createdAt ?? new Date().toISOString()
      );
      const date = new Date(dateStr);

      if (isNaN(date.getTime())) return 'Unknown';

      if (facet === 'year' || facet.includes('year')) return date.getFullYear().toString();
      if (facet === 'month' || facet.includes('month')) return date.toLocaleDateString('en-US', { month: 'long' });
      if (facet === 'quarter' || facet.includes('quarter')) return `Q${Math.floor(date.getMonth() / 3) + 1}`;
      if (facet === 'day' || facet.includes('day')) return date.toLocaleDateString('en-US', { weekday: 'long' });
      return date.getFullYear().toString();
    }

    case 'category':
      // Handle node_type / type (common in alto-index)
      if (facet === 'node_type' || facet === 'type') {
        return String(record.node_type ?? record.type ?? 'Unknown');
      }
      if (facet === 'folder') {
        return String(record.folder ?? node.folder ?? 'Uncategorized');
      }
      if (facet === 'status') {
        return String(record.status ?? node.status ?? 'None');
      }
      if (facet === 'tags') {
        const tags = record.tags ?? node.tags;
        if (Array.isArray(tags)) return tags[0] || 'Untagged';
        if (typeof tags === 'string') return tags.split(',')[0] || 'Untagged';
        return 'Untagged';
      }
      return String(record[facet] ?? node.folder ?? 'Uncategorized');

    case 'hierarchy':
      if (facet === 'priority') {
        const p = Number(record.priority ?? node.priority ?? 0);
        if (p >= 3) return 'High';
        if (p >= 2) return 'Medium';
        if (p >= 1) return 'Low';
        return 'None';
      }
      return String(record[facet] ?? 'None');

    default:
      // Fallback: try direct property access
      return String(record[facet] ?? 'Unknown');
  }
}
