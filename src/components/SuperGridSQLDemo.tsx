/**
 * SuperGridSQLDemo - Complete SuperGrid + sql.js + FTS5 Integration
 *
 * Demonstrates the bridge elimination architecture:
 * - sql.js provides direct SQLite access (no MessageBridge)
 * - FTS5 full-text search integration
 * - PAFV spatial projection from SQL data
 * - D3.js renders everything, React controls configuration
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { SuperGridEngine, type SuperGridConfig, type PAFVConfiguration } from '../d3/SuperGridEngine';
import { useSQLite } from '../db/SQLiteProvider';
import { usePAFVProjection, useSearchProjection, useFacets, useAxisValues } from '../hooks/database/usePAFVProjection';
import { useSQLiteQuery } from '../hooks/database/useSQLiteQuery';
import './SuperGridSQLDemo.css';

// ============================================================================
// Component Props & State Types
// ============================================================================

interface SuperGridSQLDemoProps {
  width?: number;
  height?: number;
  className?: string;
}

interface PAFVControlState {
  xAxis: string;
  yAxis: string;
  zAxis?: string;
  searchQuery: string;
  activeView: 'projection' | 'search' | 'hybrid';
}

// ============================================================================
// Main Component
// ============================================================================

export default function SuperGridSQLDemo({
  width = 800,
  height = 600,
  className = ''
}: SuperGridSQLDemoProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SuperGridEngine | null>(null);

  // sql.js database context
  const { db: database, loading: dbLoading, error: dbError } = useSQLite();

  // PAFV control state
  const [pafvState, setPafvState] = useState<PAFVControlState>({
    xAxis: 'folder',
    yAxis: 'status',
    searchQuery: '',
    activeView: 'projection'
  });

  // SuperGrid configuration - temporarily disabled
  const [gridConfig] = useState({
    width,
    height,
    cellMinWidth: 140,
    cellMinHeight: 100,
    headerMinHeight: 50,
    headerMinWidth: 120,
    enableProgressive: true,
    enableZoomPan: true,
    enableSelection: true,
    animationDuration: 300
  });

  // ============================================================================
  // Data Hooks - Bridge Elimination in Action
  // ============================================================================

  // Get available facets for axis selection
  const { data: facets } = useFacets();

  // Get axis values for dropdowns
  const { data: xAxisValues } = useAxisValues(pafvState.xAxis, !!pafvState.xAxis);
  const { data: yAxisValues } = useAxisValues(pafvState.yAxis, !!pafvState.yAxis);

  // Raw node data for SuperGridEngine (it does its own projection)
  const { data: allNodes, loading: nodesLoading, error: nodesError } = useSQLiteQuery<any>(
    `SELECT * FROM nodes WHERE deleted_at IS NULL ORDER BY modified_at DESC`,
    [],
    { enabled: true }
  );

  // Keep the PAFV projection for metrics display
  const { data: projectionData, loading: projectionLoading, error: projectionError, duration: projectionDuration } = usePAFVProjection({
    xAxis: pafvState.xAxis,
    yAxis: pafvState.yAxis,
    zAxis: pafvState.zAxis,
    filterClause: '1=1'
  }, {
    enabled: pafvState.activeView === 'projection' || pafvState.activeView === 'hybrid'
  });

  // FTS5 search projection (for display metrics)
  const { data: searchData, loading: searchLoading, duration: searchDuration } = useSearchProjection(
    pafvState.searchQuery,
    { xAxis: pafvState.xAxis, yAxis: pafvState.yAxis },
    pafvState.activeView === 'search' || pafvState.activeView === 'hybrid'
  );

  // Legacy search hook for comparison (disabled)
  // const { data: legacySearch, duration: legacyDuration } = useSearchNodes(
  //   pafvState.searchQuery,
  //   false // Disabled - just for performance comparison
  // );

  // ============================================================================
  // SuperGridEngine Lifecycle
  // ============================================================================

  // Initialize SuperGrid engine when database is ready
  useEffect(() => {
    if (!database || !containerRef.current || dbLoading) return;

    console.log('✅ SQL Database loaded successfully!', { database });

    // Create new engine
    engineRef.current = new SuperGridEngine(database, gridConfig);

    // Set up event listeners
    engineRef.current.on('cellClick', ({ cell, nodes }) => {
      console.log('SuperGrid Cell Click:', { cell, nodeCount: nodes.length });
    });

    engineRef.current.on('configChange', (newConfig) => {
      console.log('SuperGrid Config Change:', newConfig);
    });

    // Mount to DOM
    engineRef.current.mount(containerRef.current);

    // Test basic query functionality
    try {
      const result = database.exec('SELECT COUNT(*) as count FROM nodes WHERE deleted_at IS NULL');
      console.log('✅ Sample query result:', result);
    } catch (error) {
      console.error('❌ Query failed:', error);
    }

    // Cleanup on unmount
    return () => {
      if (engineRef.current) {
        engineRef.current.destroyV4();
        engineRef.current = null;
      }
    };
  }, [database, dbLoading, gridConfig]);

  // ============================================================================
  // Data Updates
  // ============================================================================

  // Update SuperGrid with node data when it changes
  useEffect(() => {
    if (!engineRef.current || nodesLoading || !allNodes) return;

    try {
      console.log('🔄 Updating SuperGrid with node data:', {
        nodes: allNodes.length,
        xAxis: pafvState.xAxis,
        yAxis: pafvState.yAxis
      });

      // Update engine with raw node data (SuperGrid does its own projection)
      engineRef.current.setData(allNodes, []);

      // Update axis configuration
      engineRef.current.setAxisMapping({
        xAxis: pafvState.xAxis,
        yAxis: pafvState.yAxis,
        zAxis: pafvState.zAxis
      });

    } catch (error) {
      console.error('❌ SuperGrid data update failed:', error);
    }
  }, [allNodes, pafvState, nodesLoading]);

  // For search mode, we could filter allNodes or use a separate search hook
  // For now, let's keep it simple and always use allNodes since FTS5 isn't available yet

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleAxisChange = useCallback((axis: 'x' | 'y' | 'z', value: string) => {
    setPafvState(prev => ({
      ...prev,
      [`${axis}Axis`]: value
    }));
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setPafvState(prev => ({
      ...prev,
      searchQuery: query,
      activeView: query.length > 0 ? 'search' : 'projection'
    }));
  }, []);

  const handleViewChange = useCallback((view: PAFVControlState['activeView']) => {
    setPafvState(prev => ({
      ...prev,
      activeView: view
    }));
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  if (dbLoading) {
    return (
      <div className={`supergrid-demo loading ${className}`}>
        <div className="loading-message">
          🔄 Initializing sql.js database with FTS5...
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className={`supergrid-demo error ${className}`}>
        <div className="error-message">
          ❌ Database Error: {dbError.message}
        </div>
      </div>
    );
  }

  return (
    <div className={`supergrid-sql-demo ${className}`}>
      {/* Control Panel */}
      <div className="supergrid-controls">
        <div className="controls-section">
          <h3>PAFV Axis Mapping</h3>

          {/* X-Axis Selection */}
          <div className="axis-control">
            <label htmlFor="x-axis">X-Axis (Columns):</label>
            <select
              id="x-axis"
              value={pafvState.xAxis}
              onChange={(e) => handleAxisChange('x', e.target.value)}
            >
              {facets?.map(facet => (
                <option key={facet.id} value={facet.sourceColumn}>
                  {facet.name} ({facet.axis})
                </option>
              ))}
            </select>
            <span className="value-count">
              {xAxisValues?.length || 0} values
            </span>
          </div>

          {/* Y-Axis Selection */}
          <div className="axis-control">
            <label htmlFor="y-axis">Y-Axis (Rows):</label>
            <select
              id="y-axis"
              value={pafvState.yAxis}
              onChange={(e) => handleAxisChange('y', e.target.value)}
            >
              {facets?.map(facet => (
                <option key={facet.id} value={facet.sourceColumn}>
                  {facet.name} ({facet.axis})
                </option>
              ))}
            </select>
            <span className="value-count">
              {yAxisValues?.length || 0} values
            </span>
          </div>
        </div>

        <div className="controls-section">
          <h3>FTS5 Search</h3>

          {/* Search Input */}
          <div className="search-control">
            <input
              type="text"
              placeholder="Search with FTS5 (try: 'project' or 'work')"
              value={pafvState.searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="search-input"
            />
            {searchDuration && (
              <span className="search-performance">
                FTS5: {searchDuration.toFixed(1)}ms
              </span>
            )}
          </div>

          {/* View Mode Selection */}
          <div className="view-mode-control">
            <label>View Mode:</label>
            <div className="view-buttons">
              {(['projection', 'search', 'hybrid'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => handleViewChange(view)}
                  className={pafvState.activeView === view ? 'active' : ''}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="controls-section">
          <h3>Performance Metrics</h3>
          <div className="metrics">
            <div className="metric">
              <span>Projection Query:</span>
              <span>{projectionDuration ? `${projectionDuration.toFixed(1)}ms` : '—'}</span>
            </div>
            <div className="metric">
              <span>Search Query:</span>
              <span>{searchDuration ? `${searchDuration.toFixed(1)}ms` : '—'}</span>
            </div>
            <div className="metric">
              <span>Data Points:</span>
              <span>{projectionData?.length || 0} cells</span>
            </div>
            <div className="metric">
              <span>Search Results:</span>
              <span>{searchData?.length || 0} cells</span>
            </div>
          </div>
        </div>
      </div>

      {/* SuperGrid Container */}
      <div className="supergrid-container">
        <div
          ref={containerRef}
          className="supergrid-canvas"
          style={{ width, height }}
        />

        {/* Loading Overlay */}
        {(projectionLoading || searchLoading) && (
          <div className="grid-loading-overlay">
            <div className="loading-spinner">
              ⚡ Querying sql.js with {pafvState.searchQuery ? 'FTS5' : 'PAFV projection'}...
            </div>
          </div>
        )}

        {/* Error Display */}
        {projectionError && (
          <div className="grid-error-overlay">
            <div className="error-content">
              ❌ Projection Error: {projectionError.message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}