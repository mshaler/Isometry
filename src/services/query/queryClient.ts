/**
 * Query Client - TanStack Query Integration
 */

import { QueryClient as TanstackQueryClient } from '@tanstack/react-query';

export interface QueryResult<T = unknown> {
  data: T;
  loading: boolean;
  error: Error | null;
}

// Use the real TanStack QueryClient
export const queryClient = new TanstackQueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Cache utilities for diagnostic and management purposes
export const cacheUtils = {
  getCacheStats: () => ({
    totalQueries: 0,
    activeQueries: 0,
    staleQueries: 0,
    cachedQueries: 0,
    cacheSize: 0,
    hitRate: 100,
    missRate: 0
  }),
  clearCache: () => {
    // Stub implementation
  }
};

// Query key factory for consistent cache key patterns
export const queryKeys = {
  // Node-related keys
  node: (nodeId: string) => ['node', nodeId] as const,
  nodes: ['nodes'] as const,
  nodesByType: (nodeType: string) => ['nodes', 'type', nodeType] as const,
  nodesByFolder: (folder: string) => ['nodes', 'folder', folder] as const,
  nodesWithTags: (tags: string[]) => ['nodes', 'tags', tags] as const,

  // Edge-related keys
  edge: (edgeId: string) => ['edge', edgeId] as const,
  edges: ['edges'] as const,
  edgesByNode: (nodeId: string) => ['edges', 'node', nodeId] as const,
  edgesByType: (edgeType: string) => ['edges', 'type', edgeType] as const,

  // Graph-related keys
  graph: ['graph'] as const,
  graphNeighbors: (nodeId: string) => ['graph', 'neighbors', nodeId] as const,

  // Search keys
  search: ['search'] as const
};
