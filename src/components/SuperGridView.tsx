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

import { useMemo, useState, useCallback } from 'react';
import { D3SparsityLayer } from './D3SparsityLayer';
import { createCoordinateSystem } from '@/utils/coordinate-system';
import { useFilteredNodes } from '@/hooks/useFilteredNodes';
import { usePAFV } from '@/hooks/usePAFV';
import type { Node } from '@/types/node';
import type { LATCHAxis } from '@/types/pafv';
import type { OriginPattern } from '@/types/coordinates';
import type { ZoomTransform } from '@/hooks/useD3Zoom';

interface SuperGridViewProps {
  /** SQL query to execute for live data (currently unused - using FilterContext instead) */
  sql?: string;
  /** Parameters for the SQL query (currently unused - using FilterContext instead) */
  queryParams?: unknown[];
  /** Callback when node is clicked */
  onNodeClick?: (node: Node) => void;
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
  sql,
  queryParams = [],
  onNodeClick
}: SuperGridViewProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [originPattern, setOriginPattern] = useState<OriginPattern>('anchor');

  // Get PAFV context for axis mappings
  const pafv = usePAFV();
  const pafvState = pafv.state;

  // Use FilterContext for LATCH-based filtering instead of direct database calls
  const { data: nodes, loading, error } = useFilteredNodes();

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

  // Debug LATCH filter integration
  if (process.env.NODE_ENV === 'development') {
    const nodeTypeCounts = nodes ? {
      notes: nodes.filter(n => n.id.startsWith('n')).length,
      contacts: nodes.filter(n => n.id.startsWith('c')).length,
      bookmarks: nodes.filter(n => n.id.startsWith('b')).length,
    } : { notes: 0, contacts: 0, bookmarks: 0 };

    console.log('🎯 SuperGridView LATCH Debug:', {
      totalNodes: nodes?.length || 0,
      nodeTypes: nodeTypeCounts,
      loading,
      error: error?.message,
      xAxis: `${xAxis}/${xFacet}`,
      yAxis: `${yAxis}/${yFacet}`,
      firstNode: nodes?.[0]?.name,
      dataSource: 'FilterContext + useFilteredNodes'
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading SuperGrid from SQLite...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600">
          SuperGrid Database Error: {error}
        </div>
      </div>
    );
  }

  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">
          No data found in SQLite database for SuperGrid
          <br />
          <small>Query: {sql.substring(0, 50)}...</small>
          <br />
          <small>Connection: {connectionState?.quality || 'unknown'}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Status indicator for LATCH filtering */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-sm p-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>{nodes?.length || 0} nodes</span>
          <span className="text-gray-500">|</span>
          <span>LATCH filtered</span>
        </div>
      </div>

      {/* D3 Sparsity Layer with live SQLite data */}
      <D3SparsityLayer
        data={nodes}
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
    </div>
  );
}