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

import { useMemo, useCallback, useRef } from 'react';
import { SuperStack } from './SuperStack';
import { usePAFV, useSQLiteQuery } from '@/hooks';
import type { Node } from '@/types/node';
import type { LATCHAxis, AxisMapping } from '@/types/pafv';
import './SuperStack.css';
import './SuperGrid.css';

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
  /** Callback when cell is clicked */
  onCellClick?: (node: Node) => void;
  /** Callback when header is clicked */
  onHeaderClick?: (level: number, value: string, axis: LATCHAxis) => void;
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
  onCellClick,
  onHeaderClick
}: SuperGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { state: pafvState } = usePAFV();

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
  const gridLayout = useMemo(() => {
    const xMapping = pafvState.mappings.find((m: AxisMapping) => m.plane === 'x');
    const yMapping = pafvState.mappings.find((m: AxisMapping) => m.plane === 'y');

    return {
      hasColumns: !!xMapping,
      hasRows: !!yMapping,
      columnAxis: xMapping?.axis,
      rowAxis: yMapping?.axis,
      columnFacet: xMapping?.facet,
      rowFacet: yMapping?.facet,
      effectiveMode: mode === 'supergrid' && (!xMapping && !yMapping) ? 'gallery' : mode
    };
  }, [pafvState.mappings, mode]);

  // Group nodes by grid coordinates
  const gridData = useMemo(() => {
    if (!nodes?.length) return { cells: [], columnHeaders: [], rowHeaders: [] };

    const cells = new Map<string, Node[]>();
    const columnValues = new Set<string>();
    const rowValues = new Set<string>();

    nodes.forEach((node: Node) => {
      let colKey = 'default';
      let rowKey = 'default';

      // Extract column value
      if (gridLayout.hasColumns && gridLayout.columnAxis && gridLayout.columnFacet) {
        colKey = extractNodeValue(node, gridLayout.columnAxis, gridLayout.columnFacet);
        columnValues.add(colKey);
      }

      // Extract row value
      if (gridLayout.hasRows && gridLayout.rowAxis && gridLayout.rowFacet) {
        rowKey = extractNodeValue(node, gridLayout.rowAxis, gridLayout.rowFacet);
        rowValues.add(rowKey);
      }

      const cellKey = `${rowKey}:${colKey}`;
      if (!cells.has(cellKey)) {
        cells.set(cellKey, []);
      }
      cells.get(cellKey)!.push(node);
    });

    return {
      cells: Array.from(cells.entries()).map(([key, cellNodes]) => {
        const [rowKey, colKey] = key.split(':');
        return { rowKey, colKey, nodes: cellNodes };
      }),
      columnHeaders: Array.from(columnValues).sort(),
      rowHeaders: Array.from(rowValues).sort()
    };
  }, [nodes, gridLayout]);

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
      {/* Column Headers (Top) */}
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
            gridData.cells.map(cell => (
              <div
                key={`${cell.rowKey}-${cell.colKey}`}
                className="supergrid__cell"
                data-row={cell.rowKey}
                data-col={cell.colKey}
                style={{
                  gridColumn: gridLayout.hasColumns ? gridData.columnHeaders.indexOf(cell.colKey) + 1 : 1,
                  gridRow: gridLayout.hasRows ? gridData.rowHeaders.indexOf(cell.rowKey) + 1 : 1
                }}
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
            ))
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
 * Same logic as SuperStack but centralized for reuse
 */
function extractNodeValue(node: Node, axis: LATCHAxis, facet: string): string {
  switch (axis) {
    case 'location':
      if (facet === 'location_name') return node.locationName || 'Unknown';
      return node.locationName || 'Unknown';

    case 'alphabet':
      if (facet === 'name') return node.name.charAt(0).toUpperCase();
      return node.name.charAt(0).toUpperCase();

    case 'time': {
      const date = new Date(node.createdAt);
      if (facet === 'year') return date.getFullYear().toString();
      if (facet === 'month') return date.toLocaleDateString('en-US', { month: 'long' });
      if (facet === 'quarter') return `Q${Math.floor(date.getMonth() / 3) + 1}`;
      return date.getFullYear().toString();
    }

    case 'category':
      if (facet === 'folder') return node.folder || 'Uncategorized';
      if (facet === 'status') return node.status || 'None';
      return node.folder || 'Uncategorized';

    case 'hierarchy':
      if (facet === 'priority') {
        const p = node.priority || 0;
        if (p >= 3) return 'High';
        if (p >= 2) return 'Medium';
        if (p >= 1) return 'Low';
        return 'None';
      }
      return 'None';

    default:
      return 'Unknown';
  }
}
