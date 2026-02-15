/**
 * useEmbedData - Live data hook for Isometry embeds
 *
 * Provides reactive data fetching for embedded visualizations.
 * Leverages dataVersion from SQLiteProvider for automatic refetching
 * when database changes occur.
 *
 * @see Phase 98-02: D3.js Visualization Integration
 */
import { useMemo, useCallback } from 'react';
import { useSQLiteQuery, QueryState } from '../database/useSQLiteQuery';
import { EmbedType, EmbedAttributes } from '../../components/notebook/editor/extensions/embed-types';
import { Node, rowToNode } from '../../types/node';

/**
 * Edge data returned from database
 */
export interface Edge {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: string;
  label?: string;
  weight?: number;
  directed?: boolean;
}

/**
 * Result type for embed data queries
 */
export interface EmbedData {
  nodes: Node[];
  edges: Edge[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Options for useEmbedData hook
 */
export interface UseEmbedDataOptions {
  /** Embed type (supergrid, network, timeline) */
  type: EmbedType;
  /** Optional SQL WHERE clause filter */
  filter?: string;
  /** Filter parameters for SQL query */
  filterParams?: unknown[];
  /** Whether to include edges (for network embeds) */
  includeEdges?: boolean;
  /** Maximum number of nodes to return */
  limit?: number;
}

// Transform function defined outside to be stable
const nodeTransform = (rows: Record<string, unknown>[]): Node[] => rows.map(rowToNode);

// Edge transform function
const edgeTransform = (rows: Record<string, unknown>[]): Edge[] =>
  rows.map((row) => ({
    id: String(row.id || ''),
    source_id: String(row.source_id || ''),
    target_id: String(row.target_id || ''),
    edge_type: String(row.edge_type || 'LINK'),
    label: row.label != null ? String(row.label) : undefined,
    weight: typeof row.weight === 'number' ? row.weight : undefined,
    directed: row.directed === 1 || row.directed === true,
  }));

/**
 * Build SQL query based on embed type and options
 */
function buildNodeQuery(options: UseEmbedDataOptions): { sql: string; params: unknown[] } {
  const { type, filter, filterParams = [], limit = 1000 } = options;

  // Base WHERE clause - exclude deleted nodes
  let whereClause = 'deleted_at IS NULL';

  // Add custom filter if provided
  if (filter) {
    whereClause += ` AND (${filter})`;
  }

  // Type-specific ordering
  let orderBy: string;
  switch (type) {
    case 'timeline':
      orderBy = 'created_at ASC, modified_at DESC';
      break;
    case 'network':
      orderBy = 'modified_at DESC';
      break;
    case 'supergrid':
    default:
      orderBy = 'folder, name';
      break;
  }

  const sql = `
    SELECT * FROM nodes
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ?
  `;

  return { sql, params: [...filterParams, limit] };
}

/**
 * Build edge query for network embeds
 */
function buildEdgeQuery(
  nodeIds: string[]
): { sql: string; params: unknown[] } {
  if (nodeIds.length === 0) {
    return { sql: 'SELECT * FROM edges WHERE 1=0', params: [] };
  }

  // Build placeholders for IN clause
  const placeholders = nodeIds.map(() => '?').join(', ');

  const sql = `
    SELECT * FROM edges
    WHERE source_id IN (${placeholders})
      AND target_id IN (${placeholders})
  `;

  // Parameters are used twice (source_id IN and target_id IN)
  return { sql, params: [...nodeIds, ...nodeIds] };
}

/**
 * Hook for fetching embed data with live updates
 *
 * The hook automatically refetches when:
 * - dataVersion changes (database mutation occurred)
 * - filter/filterParams change
 * - type changes
 *
 * @example
 * ```tsx
 * const { nodes, edges, loading, error } = useEmbedData({
 *   type: 'network',
 *   filter: 'folder = ?',
 *   filterParams: ['work'],
 *   includeEdges: true,
 * });
 * ```
 */
export function useEmbedData(options: UseEmbedDataOptions): EmbedData {
  const { type, includeEdges = type === 'network' } = options;

  // Build node query
  const { sql: nodeSql, params: nodeParams } = useMemo(
    () => buildNodeQuery(options),
    [options.type, options.filter, options.filterParams, options.limit]
  );

  // Fetch nodes - useSQLiteQuery uses dataVersion internally for reactivity
  const nodesQuery: QueryState<Node> = useSQLiteQuery<Node>(nodeSql, nodeParams, {
    transform: nodeTransform,
  });

  // Extract node IDs for edge query
  const nodeIds = useMemo(
    () => (nodesQuery.data || []).map((n) => n.id),
    [nodesQuery.data]
  );

  // Build edge query
  const { sql: edgeSql, params: edgeParams } = useMemo(
    () => buildEdgeQuery(nodeIds),
    [nodeIds]
  );

  // Fetch edges (only if needed)
  const edgesQuery: QueryState<Edge> = useSQLiteQuery<Edge>(edgeSql, edgeParams, {
    enabled: includeEdges && nodeIds.length > 0,
    transform: edgeTransform,
  });

  // Combined refetch
  const refetch = useCallback(() => {
    nodesQuery.refetch();
    if (includeEdges) {
      edgesQuery.refetch();
    }
  }, [nodesQuery.refetch, edgesQuery.refetch, includeEdges]);

  return {
    nodes: nodesQuery.data || [],
    edges: includeEdges ? edgesQuery.data || [] : [],
    loading: nodesQuery.loading || (includeEdges && edgesQuery.loading),
    error: nodesQuery.error || edgesQuery.error,
    refetch,
  };
}

/**
 * Convenience hook for SuperGrid embeds
 */
export function useSuperGridData(
  attrs: Partial<EmbedAttributes>
): EmbedData {
  // Extract filter from PAFV attributes
  const filter = useMemo(() => {
    const conditions: string[] = [];

    // Build filter conditions from PAFV attributes
    if (attrs.xAxis === 'category' && attrs.xFacet) {
      // Category filtering via folder/tags
      if (attrs.xFacet === 'folder') {
        // Folder filtering is handled by the facet value, not a WHERE clause
      }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : undefined;
  }, [attrs.xAxis, attrs.xFacet, attrs.yAxis, attrs.yFacet]);

  return useEmbedData({
    type: 'supergrid',
    filter,
    includeEdges: false,
  });
}

/**
 * Convenience hook for Network embeds
 */
export function useNetworkData(
  attrs: Partial<EmbedAttributes>
): EmbedData {
  // Extract filter from attrs if present
  const filter = attrs.sql || '';
  return useEmbedData({
    type: 'network',
    filter,
    includeEdges: true,
    limit: 200, // Network graphs get unwieldy with too many nodes
  });
}

/**
 * Convenience hook for Timeline embeds
 */
export function useTimelineData(
  attrs: Partial<EmbedAttributes>
): EmbedData {
  // Timeline always sorts by time
  const filter = useMemo(() => {
    const facet = attrs.xFacet || 'created_at';
    // Only include nodes that have a timestamp for the selected facet
    return `${facet} IS NOT NULL`;
  }, [attrs.xFacet]);

  return useEmbedData({
    type: 'timeline',
    filter,
    includeEdges: false,
  });
}
