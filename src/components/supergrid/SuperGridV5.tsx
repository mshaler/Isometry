/**
 * SuperGridV5 - Fully Integrated Polymorphic Data Projection Component
 *
 * The complete SuperGrid implementation with all Super* features integrated
 * through the SuperGridEngine orchestration system. This is the Phase 2
 * version that replaces the original SuperGrid with full Super* integration.
 *
 * Features (All Super* Components):
 * - SuperStack: Nested PAFV headers with visual spanning
 * - SuperDensity: Janus density model (Value × Extent orthogonal controls)
 * - SuperSize: Inline cell expansion with count badges
 * - SuperZoom: Cartographic navigation with pan/zoom
 * - SuperDynamic: Drag-and-drop axis repositioning
 * - SuperCalc: Formula bar with PAFV-aware functions
 * - SuperSearch: Cross-dimensional search with highlighting
 * - SuperAudit: Toggle computed cell visualization
 *
 * Grid Continuum: Gallery → List → Kanban → 2D Grid → nD SuperGrid
 */

import { useMemo, useEffect, useRef, useState } from 'react';
import { SuperGridProvider, useSuperGrid } from '@/contexts/SuperGridContext';
import { usePAFV, useSQLiteQuery } from '@/hooks';
import type { Node } from '@/types/node';
import type { AxisMapping } from '@/types/pafv';
import type { SuperGridConfig, SuperGridEventHandlers } from '@/engine/SuperGridEngine';
import { GridContinuumController } from './GridContinuumController';
import type { GridContinuumMode } from '@/types/view';

// Import all Super* components
import { SuperStack } from './SuperStack';
import { SuperDensity } from './SuperDensity';
import { SuperSize } from './SuperSize';
import { SuperZoom } from './SuperZoom';
import { SuperDynamic } from './SuperDynamic';
import { SuperCalc } from './SuperCalc';
import { SuperSearch } from './SuperSearch';
import { SuperAudit } from './SuperAudit';

// Import styles
import './SuperStack.css';
import './SuperGrid.css';
import './SuperSize.css';
import './SuperZoom.css';

interface SuperGridV5Props {
  /** SQL query for nodes data */
  sql?: string;
  /** Query parameters */
  params?: unknown[];
  /** Grid continuum mode */
  mode?: 'gallery' | 'list' | 'kanban' | 'grid' | 'supergrid';
  /** Configuration for all Super* features */
  superConfig?: Partial<SuperGridConfig>;
  /** Event handlers for Super* interactions */
  eventHandlers?: SuperGridEventHandlers;
  /** CSS class name */
  className?: string;
  /** Enable debug mode */
  debugMode?: boolean;
}

/**
 * SuperGridCore - The core grid component that uses SuperGrid context
 */
function SuperGridCore({
  sql = "SELECT * FROM nodes WHERE deleted_at IS NULL LIMIT 100",
  params = [],
  mode = 'supergrid',
  className = '',
  debugMode = false
}: Omit<SuperGridV5Props, 'superConfig' | 'eventHandlers'>) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { state: pafvState } = usePAFV();

  // Grid Continuum Controller - the polymorphic projection engine
  const [gridController] = useState(() => new GridContinuumController());

  // Initialize controller with mode
  useEffect(() => {
    gridController.setMode(mode as GridContinuumMode);
  }, [gridController, mode]);

  // SuperGrid context
  const {
    state: superState,
    updateNodes,
    updateState,
    isFeatureEnabled,
    getFilteredNodes
  } = useSuperGrid();

  // Load nodes from SQLite with direct sql.js access
  const { data: nodes, loading, error } = useSQLiteQuery<Node>(sql, params);

  // Update SuperGrid engine with new nodes
  useEffect(() => {
    if (nodes) {
      updateNodes(nodes);
    }
  }, [nodes, updateNodes]);

  // Update mode in SuperGrid state
  useEffect(() => {
    updateState({ mode });
  }, [mode, updateState]);

  // Sync PAFV mappings with GridContinuumController
  useEffect(() => {
    const xMapping = pafvState.mappings.find((m: AxisMapping) => m.plane === 'x');
    const yMapping = pafvState.mappings.find((m: AxisMapping) => m.plane === 'y');

    if (xMapping) {
      gridController.setAxisMapping('x', xMapping.axis, xMapping.facet);
    }
    if (yMapping) {
      gridController.setAxisMapping('y', yMapping.axis, yMapping.facet);
    }
  }, [pafvState.mappings, gridController]);

  // Get grid projection from GridContinuumController
  const gridProjection = useMemo(() => {
    if (!nodes?.length) return null;
    return gridController.getProjection(nodes);
  }, [gridController, nodes, mode, pafvState.mappings]);

  // Derive layout from projection (backwards compatibility)
  const gridLayout = useMemo(() => {
    if (!gridProjection) {
      return {
        hasColumns: false,
        hasRows: false,
        columnAxis: null,
        rowAxis: null,
        columnFacet: null,
        rowFacet: null,
        effectiveMode: 'gallery'
      };
    }

    const xMapping = gridProjection.mappings.find(m => m.plane === 'x');
    const yMapping = gridProjection.mappings.find(m => m.plane === 'y');

    return {
      hasColumns: !!xMapping || gridProjection.layout === 'column-groups',
      hasRows: !!yMapping || gridProjection.layout === 'vertical-hierarchy',
      columnAxis: xMapping?.axis || null,
      rowAxis: yMapping?.axis || null,
      columnFacet: xMapping?.facet || null,
      rowFacet: yMapping?.facet || null,
      effectiveMode: gridProjection.mode
    };
  }, [gridProjection]);

  // Get grid data from projection (enhanced with SuperSize support)
  const gridData = useMemo(() => {
    if (!gridProjection) {
      return { cells: [], columnHeaders: [], rowHeaders: [] };
    }

    // Use projection cells directly
    const cells = gridProjection.cells.map(cell => ({
      ...cell,
      rowKey: cell.rowKey || 'default',
      colKey: cell.columnKey || 'default',
      size: cell.size || { width: 120, height: 80 } // Default size from SuperSize config
    }));

    return {
      cells,
      columnHeaders: gridProjection.columns || [],
      rowHeaders: gridProjection.rows || [],
      layout: gridProjection.layout,
      axisCount: gridProjection.axisCount
    };
  }, [gridProjection]);

  // Loading state
  if (loading) {
    return (
      <div className={`supergrid supergrid--loading ${className}`}>
        <div className="supergrid__loading-spinner" />
        <span>Loading SuperGrid...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`supergrid supergrid--error ${className}`}>
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
      <div className={`supergrid supergrid--empty ${className}`}>
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
      className={`supergrid-v5 supergrid--${gridLayout.effectiveMode} ${className}`}
      data-mode={gridLayout.effectiveMode}
      data-columns={gridLayout.hasColumns}
      data-rows={gridLayout.hasRows}
    >
      {/* SuperSearch - Top Level Search */}
      {isFeatureEnabled('enableSuperSearch') && (
        <div className="supergrid__super-search">
          <SuperSearch
            onSearch={(query) => console.log('Search:', query)}
            onHighlight={(cardIds) => console.log('Highlight:', cardIds)}
          />
        </div>
      )}

      {/* SuperCalc - Formula Bar */}
      {isFeatureEnabled('enableSuperCalc') && (
        <div className="supergrid__super-calc">
          <SuperCalc
            onFormulaExecute={(formula, result) => console.log('Formula:', formula, result)}
          />
        </div>
      )}

      {/* SuperZoom Controls */}
      {isFeatureEnabled('enableSuperZoom') && (
        <div className="supergrid__super-zoom-controls">
          <SuperZoom
            width={gridRef.current?.clientWidth || 800}
            height={gridRef.current?.clientHeight || 600}
            gridWidth={gridData.columnHeaders.length * 140}
            gridHeight={gridData.rowHeaders.length * 100}
          />
        </div>
      )}

      {/* Grid Content */}
      <SuperGridContent
        gridLayout={gridLayout}
        gridData={gridData}
        nodes={nodes}
      />

      {/* SuperAudit - Overlay for computed cell highlighting */}
      {isFeatureEnabled('enableSuperAudit') && superState.audit.enabled && (
        <div className="supergrid__super-audit-overlay">
          <SuperAudit
            cellStates={[]}
            currentMode="highlight"
            onModeChange={(mode) => console.log('Audit mode:', mode)}
            onHighlightComputed={(cells) => console.log('Highlight computed:', cells)}
          />
        </div>
      )}

      {/* Debug Info (Development) */}
      {debugMode && process.env.NODE_ENV === 'development' && (
        <div className="supergrid__debug">
          <details>
            <summary>SuperGridV5 Debug ({nodes.length} nodes, {getFilteredNodes().length} filtered)</summary>
            <pre>{JSON.stringify({
              gridLayout,
              gridProjection: gridProjection ? {
                mode: gridProjection.mode,
                axisCount: gridProjection.axisCount,
                layout: gridProjection.layout,
                mappings: gridProjection.mappings,
                cellCount: gridProjection.cells.length,
                columns: gridProjection.columns,
                rows: gridProjection.rows
              } : null,
              pafvState,
              superState: {
                mode: superState.mode,
                features: superState.features,
                searchResults: superState.search.results.length
              },
              gridData: {
                cellCount: gridData.cells.length,
                columnHeaders: gridData.columnHeaders,
                rowHeaders: gridData.rowHeaders,
                layout: gridData.layout,
                axisCount: gridData.axisCount
              }
            }, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

/**
 * SuperGridContent - The main grid content component
 */
interface SuperGridContentProps {
  gridLayout: any;
  gridData: any;
  nodes: Node[];
}

function SuperGridContent({ gridLayout, gridData, nodes }: SuperGridContentProps) {
  const { isFeatureEnabled, state: superState } = useSuperGrid();

  return (
    <>
      {/* Column Headers (Top) with SuperStack */}
      {isFeatureEnabled('enableSuperStack') && gridLayout.hasColumns && (
        <div className="supergrid__column-headers">
          <SuperStack
            orientation="horizontal"
            nodes={nodes}
            enableDragDrop={isFeatureEnabled('enableSuperDynamic')}
          />
        </div>
      )}

      <div className="supergrid__content">
        {/* Row Headers (Left) with SuperStack */}
        {isFeatureEnabled('enableSuperStack') && gridLayout.hasRows && (
          <div className="supergrid__row-headers">
            <SuperStack
              orientation="vertical"
              nodes={nodes}
              enableDragDrop={isFeatureEnabled('enableSuperDynamic')}
            />
          </div>
        )}

        {/* Data Grid with SuperSize and SuperDensity */}
        <div className="supergrid__data-grid-container">
          {/* SuperDensity Controls */}
          {isFeatureEnabled('enableSuperDensity') && (
            <div className="supergrid__super-density">
              <SuperDensity
                nodes={nodes}
                activeAxes={['time', 'category']}
              />
            </div>
          )}

          {/* Main Grid with SuperSize */}
          {isFeatureEnabled('enableSuperSize') ? (
            <SuperSize
              gridData={gridData.cells}
              config={{}}
              className="supergrid__data-grid"
            />
          ) : (
            <div
              className="supergrid__data-grid supergrid__data-grid--basic"
              style={{
                display: 'grid',
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
                    className={`supergrid__cell supergrid__cell--gallery ${
                      superState.search.results.includes(node.id) ? 'supergrid__cell--highlighted' : ''
                    }`}
                  >
                    <div className="supergrid__cell-icon">📄</div>
                    <div className="supergrid__cell-title">{node.name}</div>
                  </div>
                ))
              ) : (
                // Grid modes: cell-based layout
                gridData.cells.map((cell: any) => (
                  <div
                    key={cell.id}
                    className={`supergrid__cell ${
                      cell.nodes.some((n: Node) => superState.search.results.includes(n.id))
                        ? 'supergrid__cell--highlighted' : ''
                    }`}
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
                        <div className="supergrid__node">
                          <div className="supergrid__node-title">{cell.nodes[0].name}</div>
                          <div className="supergrid__node-summary">{cell.nodes[0].summary}</div>
                        </div>
                      ) : (
                        // Multiple nodes (basic count display)
                        <div className="supergrid__multi-node">
                          <div className="supergrid__node-count">
                            {cell.nodes.length} items
                          </div>
                          <div className="supergrid__node-preview">
                            {cell.nodes.slice(0, 2).map((node: Node) => (
                              <div key={node.id} className="supergrid__node supergrid__node--preview">
                                {node.name}
                              </div>
                            ))}
                            {cell.nodes.length > 2 && (
                              <div className="supergrid__node-more">
                                +{cell.nodes.length - 2} more
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
          )}
        </div>
      </div>

      {/* SuperDynamic - Drag and drop overlay */}
      {isFeatureEnabled('enableSuperDynamic') && (
        <SuperDynamic
          xAxis="time"
          yAxis="category"
          onAxisChange={(axis, newValue) => console.log('Axis change:', axis, newValue)}
          availableAxes={[
            { id: 'location', label: 'Location', description: 'Geographic location data' },
            { id: 'alphabet', label: 'Alphabet', description: 'Alphabetical ordering' },
            { id: 'time', label: 'Time', description: 'Temporal data' },
            { id: 'category', label: 'Category', description: 'Categorical grouping' },
            { id: 'hierarchy', label: 'Hierarchy', description: 'Hierarchical structure' }
          ]}
        />
      )}
    </>
  );
}

/**
 * SuperGridV5 - Main component with SuperGridProvider
 */
export function SuperGridV5(props: SuperGridV5Props) {
  const { superConfig = {}, eventHandlers = {}, ...coreProps } = props;

  return (
    <SuperGridProvider
      config={superConfig}
      eventHandlers={eventHandlers}
    >
      <SuperGridCore {...coreProps} />
    </SuperGridProvider>
  );
}


export default SuperGridV5;