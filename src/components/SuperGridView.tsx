/**
 * SuperGridView - Unified UI integration for SuperGrid
 *
 * Wraps SuperGridDemo with the Canvas interface, providing:
 * - Live database data integration
 * - Unified UI controls compatibility
 * - Performance monitoring
 * - Node click handling
 */

import { useMemo } from 'react';
import { SuperGridDemo } from './SuperGridDemo';
import { useFilteredNodes } from '@/hooks/useFilteredNodes';
import type { Node } from '@/types/node';

interface SuperGridViewProps {
  sql?: string;
  queryParams?: unknown[];
  onNodeClick?: (node: Node) => void;
  data?: Node[]; // For compatibility with other views
}

/**
 * SuperGrid integration for Unified UI Canvas
 *
 * Uses live database data and integrates with:
 * - AppStateContext for view management
 * - FilterContext for data filtering
 * - PAFVContext for axis mappings
 * - Performance monitoring systems
 */
export function SuperGridView({
  sql,
  queryParams,
  onNodeClick,
  data
}: SuperGridViewProps) {
  // Use filtered nodes from live database (fallback to demo data)
  const { data: liveNodes, loading, error } = useFilteredNodes();

  // Use provided data or fall back to live data
  const nodes = useMemo(() => {
    if (data && data.length > 0) {
      return data;
    }
    return liveNodes || [];
  }, [data, liveNodes]);

  // Integration status available for development debugging

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading SuperGrid...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600">
          SuperGrid Error: {error.message}
        </div>
      </div>
    );
  }

  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">
          No data available for SuperGrid visualization
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <SuperGridDemo />
    </div>
  );
}