/**
 * SuperGridView - Unified UI integration for SuperGrid
 *
 * Integrates D3SparsityLayer directly with Unified UI Canvas:
 * - Live SQLite database integration via useLiveQuery
 * - PAFV context for dynamic axis mappings
 * - Unified UI controls compatibility
 * - Performance monitoring
 * - Node click handling
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { D3SparsityLayer } from './D3SparsityLayer';
import { D3Canvas } from './d3/Canvas';
import { createCoordinateSystem } from '@/utils/coordinate-system';
import { useFilteredNodes } from '@/hooks/useFilteredNodes';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { usePAFV } from '@/hooks/usePAFV';
import type { Node } from '@/types/node';
import type { LATCHAxis } from '@/types/pafv';
import type { OriginPattern } from '@/types/coordinates';
import type { ZoomTransform } from '@/hooks/useD3Zoom';

interface SuperGridViewProps {
  /** SQL query to execute for live data */
  sql?: string;
  /** Parameters for the SQL query */
  queryParams?: unknown[];
  /** Callback when node is clicked */
  onNodeClick?: (node: Node) => void;
  /** Render mode: 'sparsity' for D3SparsityLayer, 'canvas' for D3Canvas */
  renderMode?: 'sparsity' | 'canvas';
  /** Enable integration testing with both data sources */
  enableIntegrationTest?: boolean;
}

/**
 * SuperGrid integration for Unified UI Canvas
 *
 * Uses live SQLite database data and integrates with:
 * - useLiveQuery for real-time data updates
 * - PAFVContext for dynamic axis mappings
 * - Unified UI controls (Sidebar filters, Navigator)
 * - Performance monitoring systems
 */
export function SuperGridView({
  sql = "SELECT * FROM nodes WHERE deleted_at IS NULL",
  queryParams = [],
  onNodeClick,
  renderMode = 'sparsity',
  enableIntegrationTest = false
}: SuperGridViewProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [originPattern, setOriginPattern] = useState<OriginPattern>('anchor');
  const [integrationTestResults, setIntegrationTestResults] = useState<{
    filterContext: number;
    liveQuery: number;
    match: boolean;
  } | null>(null);

  // Get PAFV context for axis mappings
  const pafv = usePAFV();
  const pafvState = pafv.state;

  // Primary data source: FilterContext for LATCH-based filtering
  const { data: filterNodes, loading: filterLoading, error: filterError } = useFilteredNodes();

  // Secondary data source: Direct SQL query for integration testing
  const {
    data: queryNodes,
    isLoading: queryLoading,
    error: queryError
  } = useLiveQuery<Node>(sql, {
    queryParams,
    autoStart: enableIntegrationTest || renderMode === 'canvas',
    enableCache: true,
    debounceMs: 100,
    maxResults: 1000,
    onError: (err) => {
      console.error('[SuperGridView] SQL query error:', err);
    }
  });

  // Choose primary data source based on render mode
  const primaryNodes = renderMode === 'canvas' ? queryNodes : filterNodes;
  const primaryLoading = renderMode === 'canvas' ? queryLoading : filterLoading;
  const primaryError = renderMode === 'canvas' ? queryError : filterError;

  // Extract X and Y axis mappings from PAFV state
  const xMapping = pafvState.mappings.find(m => m.plane === 'x');
  const yMapping = pafvState.mappings.find(m => m.plane === 'y');

  const xAxis: LATCHAxis = xMapping?.axis || 'time';
  const xFacet = xMapping?.facet || 'year';
  const yAxis: LATCHAxis = yMapping?.axis || 'category';
  const yFacet = yMapping?.facet || 'tag';

  // Create coordinate system for D3 rendering
  const d3CoordinateSystem = useMemo(() =>
    createCoordinateSystem(originPattern, 120, 60),
    [originPattern]
  );

  // Handle cell clicks - integrate with Canvas onNodeClick
  const handleCellClick = useCallback((node: Node) => {
    onNodeClick?.(node);
    console.log('[SuperGridView] Cell clicked:', node.name);
  }, [onNodeClick]);

  // Handle zoom changes
  const handleZoomChange = useCallback((transform: ZoomTransform) => {
    setZoomLevel(transform.k);
  }, []);

  // Integration test: compare FilterContext vs SQL query data
  useEffect(() => {
    if (enableIntegrationTest && filterNodes && queryNodes) {
      const filterCount = filterNodes.length;
      const queryCount = queryNodes.length;
      const match = filterCount === queryCount;

      setIntegrationTestResults({
        filterContext: filterCount,
        liveQuery: queryCount,
        match
      });

      console.log('[SuperGridView] Integration Test:', {
        filterContext: filterCount,
        liveQuery: queryCount,
        match: match ? '✓ PASS' : '✗ FAIL',
        difference: Math.abs(filterCount - queryCount)
      });
    }
  }, [enableIntegrationTest, filterNodes, queryNodes]);

  // Debug both data sources
  if (process.env.NODE_ENV === 'development') {
    const nodeTypeCounts = primaryNodes ? {
      notes: primaryNodes.filter(n => n.id.startsWith('n')).length,
      contacts: primaryNodes.filter(n => n.id.startsWith('c')).length,
      bookmarks: primaryNodes.filter(n => n.id.startsWith('b')).length,
    } : { notes: 0, contacts: 0, bookmarks: 0 };

    console.log('🎯 SuperGridView Debug:', {
      renderMode,
      primaryNodes: primaryNodes?.length || 0,
      nodeTypes: nodeTypeCounts,
      loading: primaryLoading,
      error: primaryError?.message,
      xAxis: `${xAxis}/${xFacet}`,
      yAxis: `${yAxis}/${yFacet}`,
      firstNode: primaryNodes?.[0]?.name,
      dataSource: renderMode === 'canvas' ? 'SQL Query' : 'FilterContext',
      integrationTest: integrationTestResults
    });
  }

  if (primaryLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">
          Loading SuperGrid from {renderMode === 'canvas' ? 'SQL Query' : 'FilterContext'}...
        </div>
      </div>
    );
  }

  if (primaryError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600">
          SuperGrid {renderMode === 'canvas' ? 'SQL' : 'Filter'} Error: {primaryError.message || primaryError}
        </div>
      </div>
    );
  }

  if (!primaryNodes || primaryNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">
          No data found for SuperGrid
          <br />
          <small>Source: {renderMode === 'canvas' ? 'SQL Query' : 'FilterContext'}</small>
          {sql && renderMode === 'canvas' && (
            <>
              <br />
              <small>Query: {sql.substring(0, 50)}...</small>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Status indicator */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-sm p-2 text-xs">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${renderMode === 'canvas' ? 'bg-green-500' : 'bg-blue-500'}`} />
          <span>{primaryNodes?.length || 0} nodes</span>
          <span className="text-gray-500">|</span>
          <span>{renderMode === 'canvas' ? 'D3 Canvas' : 'Sparsity Layer'}</span>
        </div>
        {integrationTestResults && (
          <div className="mt-1 text-xs text-gray-600">
            Integration: {integrationTestResults.match ? '✓' : '✗'}
            ({integrationTestResults.filterContext} vs {integrationTestResults.liveQuery})
          </div>
        )}
      </div>

      {/* Render mode switch: Canvas vs Sparsity Layer */}
      {renderMode === 'canvas' ? (
        <D3Canvas
          sql={sql}
          queryParams={queryParams}
          onNodeClick={handleCellClick}
          className="w-full h-full"
          enableZoom={true}
          enableBrush={false}
          renderMode="svg"
          maxNodes={1000}
          debounceMs={100}
        />
      ) : (
        <D3SparsityLayer
          data={primaryNodes}
          coordinateSystem={d3CoordinateSystem}
          xAxis={xAxis}
          xAxisFacet={xFacet}
          yAxis={yAxis}
          yAxisFacet={yFacet}
          originPattern={originPattern}
          onCellClick={handleCellClick}
          onZoomChange={handleZoomChange}
          width={window.innerWidth}
          height={window.innerHeight}
        />
      )}
    </div>
  );
}