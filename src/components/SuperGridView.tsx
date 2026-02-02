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

import { useMemo, useState, useCallback, useEffect } from 'react';
import { D3SparsityLayer } from './D3SparsityLayer';
import { createCoordinateSystem } from '@/utils/coordinate-system';
import { useDatabase } from '@/db/DatabaseContext';
import { usePAFV } from '@/hooks/usePAFV';
import type { Node } from '@/types/node';
import type { LATCHAxis } from '@/types/pafv';
import type { OriginPattern } from '@/types/coordinates';
import type { ZoomTransform } from '@/hooks/useD3Zoom';

interface SuperGridViewProps {
  /** SQL query to execute for live data */
  sql: string;
  /** Parameters for the SQL query */
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

  // Direct database query for SuperGrid (bypasses complex live query system)
  // TODO: Revert to useLiveQuery once live data bridge is working properly
  const { execute } = useDatabase();
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive] = useState(false);
  const [connectionState] = useState({ quality: 'static' as const });

  // Execute query directly
  useEffect(() => {
    try {
      setLoading(true);
      setError(null);
      console.log('[SuperGridView] Executing direct SQL query:', sql);
      const results = execute<Node>(sql, queryParams);
      setNodes(results);
      console.log('[SuperGridView] Direct query results:', {
        count: Array.isArray(results) ? results.length : 0,
        firstId: Array.isArray(results) ? results[0]?.id : undefined,
        source: Array.isArray(results) ? (results.length === 100 ? 'FallbackDB (sample-data.ts)' : results.length === 110 ? 'DemoData (useDemoData.ts)' : 'Unknown') : 'Promise or other type'
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('[SuperGridView] Direct query error:', err);
    } finally {
      setLoading(false);
    }
  }, [sql, JSON.stringify(queryParams), execute]);

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

  // Debug live data integration
  if (process.env.NODE_ENV === 'development') {
    console.log('🎯 SuperGridView Live Debug:', {
      nodesCount: nodes?.length || 0,
      isLive,
      connectionQuality: connectionState?.quality,
      loading,
      error: error,
      xAxis: `${xAxis}/${xFacet}`,
      yAxis: `${yAxis}/${yFacet}`,
      firstNode: nodes?.[0]?.name,
      firstNodeId: nodes?.[0]?.id,
      dataSource: nodes?.length === 110 ? 'DEMO_DATA (useDemoData.ts)' : nodes?.length === 100 ? 'REAL_DATA (sample-data.ts)' : 'UNKNOWN',
      sql: sql
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
      {/* Status indicator for live connection */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-sm p-2 text-xs">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span>{nodes.length} nodes</span>
          <span className="text-gray-500">|</span>
          <span>{connectionState?.quality || 'static'}</span>
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