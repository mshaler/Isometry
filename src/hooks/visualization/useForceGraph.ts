/**
 * useForceGraph Hook
 *
 * React hook for managing force graph data from sql.js database.
 * Queries nodes and edges, transforms to D3-compatible format,
 * and manages selection state.
 */

import { useState, useMemo, useCallback } from 'react';
import { useSQLiteQuery } from '../database/useSQLiteQuery';
import type { GraphNode, GraphLink, EdgeType } from '../../d3/visualizations/network/types';

// ============================================================================
// Hook Types
// ============================================================================

export interface UseForceGraphOptions {
  /** Maximum number of nodes to load (default: 100) */
  maxNodes?: number;
  /** Edge types to include (default: all GRAPH types) */
  edgeTypes?: EdgeType[];
  /** Enable/disable the hook (default: true) */
  enabled?: boolean;
}

export interface UseForceGraphResult {
  /** Transformed graph nodes */
  nodes: GraphNode[];
  /** Transformed graph links */
  links: GraphLink[];
  /** Loading state */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Set selected node */
  setSelectedNodeId: (id: string | null) => void;
  /** Refresh data from database */
  refresh: () => void;
  /** Node count */
  nodeCount: number;
  /** Link count */
  linkCount: number;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: Required<UseForceGraphOptions> = {
  maxNodes: 100,
  edgeTypes: ['LINK', 'NEST', 'SEQUENCE', 'AFFINITY'],
  enabled: true,
};

// ============================================================================
// SQL Queries
// ============================================================================

const NODES_QUERY = `
  SELECT id, name, folder
  FROM nodes
  WHERE deleted_at IS NULL
  LIMIT ?
`;

// Note: We query all edges and filter client-side since sql.js doesn't support
// array parameters elegantly. The node limit keeps this manageable.
const EDGES_QUERY = `
  SELECT id, source_id, target_id, edge_type, COALESCE(weight, 1) as weight
  FROM edges
  WHERE edge_type IN ('LINK', 'NEST', 'SEQUENCE', 'AFFINITY')
`;

// ============================================================================
// Row Types
// ============================================================================

interface NodeRow {
  id: string;
  name: string;
  folder: string | null;
}

interface EdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: string;
  weight: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useForceGraph(options: UseForceGraphOptions = {}): UseForceGraphResult {
  // Merge with defaults
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // SYNC-01: Auto-refresh when database changes via dataVersion dependency
  // useSQLiteQuery includes dataVersion in its dependency array, so when
  // operations.run() increments dataVersion (after INSERT/UPDATE/DELETE),
  // these queries automatically refetch and the graph re-renders.
  const nodesQuery = useSQLiteQuery<NodeRow>(
    NODES_QUERY,
    [opts.maxNodes],
    { enabled: opts.enabled }
  );

  // SYNC-01: Edges also auto-refresh when data changes
  const edgesQuery = useSQLiteQuery<EdgeRow>(
    EDGES_QUERY,
    [],
    { enabled: opts.enabled }
  );

  // Create a Set of loaded node IDs for filtering edges
  const nodeIdSet = useMemo(() => {
    if (!nodesQuery.data) return new Set<string>();
    return new Set(nodesQuery.data.map(n => n.id));
  }, [nodesQuery.data]);

  // Transform nodes to GraphNode format
  const nodes: GraphNode[] = useMemo(() => {
    if (!nodesQuery.data) return [];

    return nodesQuery.data.map(row => ({
      id: row.id,
      label: row.name || 'Untitled',
      group: row.folder || 'default',
    }));
  }, [nodesQuery.data]);

  // Transform and filter edges to GraphLink format
  const links: GraphLink[] = useMemo(() => {
    if (!edgesQuery.data || nodeIdSet.size === 0) return [];

    // Filter to only edges where both source and target are in loaded nodes
    // AND edge type is in the configured types
    return edgesQuery.data
      .filter(row =>
        nodeIdSet.has(row.source_id) &&
        nodeIdSet.has(row.target_id) &&
        opts.edgeTypes.includes(row.edge_type as EdgeType)
      )
      .map(row => ({
        id: row.id,
        source: row.source_id,
        target: row.target_id,
        type: row.edge_type as EdgeType,
        weight: row.weight || 1,
      }));
  }, [edgesQuery.data, nodeIdSet, opts.edgeTypes]);

  // Combined loading state
  const loading = nodesQuery.loading || edgesQuery.loading;

  // Combined error state (prefer nodes error as it's more critical)
  const error = nodesQuery.error || edgesQuery.error;

  // Refresh function
  const refresh = useCallback(() => {
    nodesQuery.refetch();
    edgesQuery.refetch();
  }, [nodesQuery, edgesQuery]);

  return {
    nodes,
    links,
    loading,
    error,
    selectedNodeId,
    setSelectedNodeId,
    refresh,
    nodeCount: nodes.length,
    linkCount: links.length,
  };
}

export default useForceGraph;
