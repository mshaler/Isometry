/**
 * TanStack Query client configuration for intelligent caching
 *
 * Provides smart cache management with TTL, garbage collection, and retry logic
 * following research-recommended patterns for 5-minute staleTime and 10-minute gcTime.
 */

import { QueryClient, QueryClientConfig } from '@tanstack/react-query';

/**
 * Default query configuration following research patterns
 */
const defaultQueryConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Data considered stale after 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Data garbage collected after 10 minutes of being unused
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v4)

      // Refetch when window regains focus for fresh data
      refetchOnWindowFocus: true,

      // Refetch on network reconnection
      refetchOnReconnect: true,

      // Smart retry logic: skip 404s, retry network errors up to 3 times
      retry: (failureCount, error) => {
        // Don't retry 404s or other client errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = error.status as number;
          if (status >= 400 && status < 500) {
            return false; // Client errors shouldn't be retried
          }
        }

        // Retry network/server errors up to 3 times
        return failureCount < 3;
      },

      // Exponential backoff: 1s, 2s, 4s
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Prevent background refetch if data is recent
      refetchOnMount: 'always'
    },

    mutations: {
      // Retry mutations once on network errors
      retry: (failureCount, error) => {
        if (error && typeof error === 'object' && 'status' in error) {
          const status = error.status as number;
          if (status >= 400 && status < 500) {
            return false; // Don't retry client errors
          }
        }
        return failureCount < 1; // Retry once for mutations
      },

      // Shorter retry delay for mutations
      retryDelay: 1000,
    },
  },
};

/**
 * Create query client instance
 */
export const queryClient = new QueryClient(defaultQueryConfig);

/**
 * Query key factory for consistent key generation
 */
export const queryKeys = {
  // Base keys for different data types
  nodes: ['nodes'] as const,
  edges: ['edges'] as const,
  graph: ['graph'] as const,
  search: ['search'] as const,

  // Node-specific queries
  node: (id: string) => [...queryKeys.nodes, id] as const,
  nodesByType: (type: string) => [...queryKeys.nodes, 'by-type', type] as const,
  nodesByFolder: (folder: string) => [...queryKeys.nodes, 'by-folder', folder] as const,
  nodesWithTags: (tags: string[]) => [...queryKeys.nodes, 'with-tags', tags.sort()] as const,

  // Edge-specific queries
  edge: (id: string) => [...queryKeys.edges, id] as const,
  edgesByNode: (nodeId: string) => [...queryKeys.edges, 'by-node', nodeId] as const,
  edgesByType: (type: string) => [...queryKeys.edges, 'by-type', type] as const,

  // Graph queries
  graphStructure: () => [...queryKeys.graph, 'structure'] as const,
  graphNeighbors: (nodeId: string) => [...queryKeys.graph, 'neighbors', nodeId] as const,
  graphPath: (from: string, to: string) => [...queryKeys.graph, 'path', from, to] as const,

  // Search queries
  searchNodes: (query: string) => [...queryKeys.search, 'nodes', query] as const,
  searchFTS: (query: string) => [...queryKeys.search, 'fts', query] as const,

  // Live query keys (SQL-based)
  liveQuery: (sql: string, params: unknown[]) => ['live-query', sql, params] as const,
};

/**
 * Cache invalidation patterns for related queries
 */
export const invalidationPatterns = {
  // Invalidate all node-related queries
  allNodes: () => queryClient.invalidateQueries({ queryKey: queryKeys.nodes }),

  // Invalidate specific node and related queries
  node: (nodeId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.node(nodeId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.edgesByNode(nodeId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.graphNeighbors(nodeId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.graph });
  },

  // Invalidate all edge-related queries
  allEdges: () => queryClient.invalidateQueries({ queryKey: queryKeys.edges }),

  // Invalidate specific edge and related queries
  edge: (edgeId: string, sourceId?: string, targetId?: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.edge(edgeId) });
    if (sourceId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.edgesByNode(sourceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.graphNeighbors(sourceId) });
    }
    if (targetId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.edgesByNode(targetId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.graphNeighbors(targetId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.graph });
  },

  // Invalidate graph structure queries
  graphStructure: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.graph });
  },

  // Invalidate search queries (when content changes)
  search: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.search });
  },

  // Invalidate live queries matching pattern
  liveQueries: (sqlPattern: string) => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return key[0] === 'live-query' && typeof key[1] === 'string' && key[1].includes(sqlPattern);
      }
    });
  },
};

/**
 * Pre-defined query functions for common operations
 */
export const queryFunctions = {
  // Get all nodes
  getAllNodes: () => ({
    queryKey: queryKeys.nodes,
    queryFn: async () => {
      // This will be implemented in the enhanced useLiveQuery
      throw new Error('Use useLiveQuery for database queries');
    },
  }),

  // Get single node
  getNode: (id: string) => ({
    queryKey: queryKeys.node(id),
    queryFn: async () => {
      // This will be implemented in the enhanced useLiveQuery
      throw new Error('Use useLiveQuery for database queries');
    },
  }),

  // Search nodes
  searchNodes: (query: string) => ({
    queryKey: queryKeys.searchNodes(query),
    queryFn: async () => {
      // This will be implemented in the enhanced useLiveQuery
      throw new Error('Use useLiveQuery for database queries');
    },
  }),
};

/**
 * Optimistic update utilities
 */
export const optimisticUpdates = {
  // Update node optimistically
  updateNode: <T>(nodeId: string, update: Partial<T>) => {
    queryClient.setQueryData(queryKeys.node(nodeId), (old: T | undefined) => {
      if (!old) return old;
      return { ...old, ...update };
    });
  },

  // Add node optimistically
  addNode: <T>(node: T) => {
    queryClient.setQueryData(queryKeys.nodes, (old: T[] | undefined) => {
      if (!old) return [node];
      return [...old, node];
    });
  },

  // Remove node optimistically
  removeNode: (nodeId: string) => {
    queryClient.setQueryData(queryKeys.nodes, (old: unknown[] | undefined) => {
      if (!old) return old;
      return old.filter((node: any) => node.id !== nodeId);
    });
  },
};

/**
 * Cache statistics and debugging
 */
export const cacheUtils = {
  // Get cache stats
  getCacheStats: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    return {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
      staleQueries: queries.filter(q => q.isStale()).length,
      cachedQueries: queries.filter(q => q.state.data !== undefined).length,
    };
  },

  // Clear all cache
  clearCache: () => {
    queryClient.clear();
  },

  // Clear specific query type
  clearQueryType: (type: 'nodes' | 'edges' | 'graph' | 'search') => {
    queryClient.removeQueries({ queryKey: queryKeys[type] });
  },

  // Get query by key
  getQuery: (key: unknown[]) => {
    return queryClient.getQueryState(key);
  },
};

/**
 * Development utilities
 */
export const devUtils = {
  // Log all queries
  logQueries: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    console.group('[TanStack Query] Cache Contents');
    queries.forEach(query => {
      console.log({
        key: query.queryKey,
        state: query.state.status,
        dataUpdatedAt: query.state.dataUpdatedAt,
        observers: query.getObserversCount(),
        isStale: query.isStale(),
      });
    });
    console.groupEnd();
  },

  // Force refetch all queries
  refetchAll: () => {
    queryClient.invalidateQueries();
  },
};