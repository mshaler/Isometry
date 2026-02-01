/**
 * Query Cache Integration System
 *
 * Bridges TanStack Query invalidation with existing useCacheInvalidation system.
 * Implements research Pattern 2 for unified cache management across both systems
 * with intelligent tag mapping and hierarchical invalidation.
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCacheInvalidation, CacheTag } from '../hooks/useCacheInvalidation';

/**
 * Enhanced cache invalidation hook that combines TanStack Query with legacy system
 *
 * Maps cache tags to TanStack Query keys and ensures both systems stay synchronized
 */
export function useEnhancedCacheInvalidation() {
  const queryClient = useQueryClient();
  const { invalidate: legacyInvalidate, register: legacyRegister } = useCacheInvalidation();

  /**
   * Unified invalidation function that handles both cache systems
   */
  const invalidate = useCallback((tags: CacheTag[]) => {
    // Invalidate legacy cache system first
    legacyInvalidate(tags);

    // Invalidate TanStack Query cache with tag mapping
    tags.forEach(tag => {
      if (tag === 'nodes') {
        // Invalidate all node-related queries
        queryClient.invalidateQueries({ queryKey: ['nodes'] });
        queryClient.invalidateQueries({ queryKey: ['node'] });
      } else if (tag === 'notebook_cards') {
        // Invalidate all notebook card queries
        queryClient.invalidateQueries({ queryKey: ['cards'] });
        queryClient.invalidateQueries({ queryKey: ['card'] });
      } else if (tag === 'search') {
        // Invalidate all search queries
        queryClient.invalidateQueries({ queryKey: ['search'] });
      } else if (tag === 'metadata') {
        // Invalidate schema and metadata queries
        queryClient.invalidateQueries({ queryKey: ['schema'] });
        queryClient.invalidateQueries({ queryKey: ['metadata'] });
      } else if (tag.startsWith('nodes:')) {
        // Folder-specific node invalidation
        const folder = tag.split(':')[1];
        queryClient.invalidateQueries({ queryKey: ['nodes', folder] });
        queryClient.invalidateQueries({ queryKey: ['nodes', 'folder', folder] });
      } else if (tag.startsWith('node:')) {
        // Specific node invalidation
        const nodeId = tag.split(':')[1];
        queryClient.invalidateQueries({ queryKey: ['node', nodeId] });
        queryClient.invalidateQueries({ queryKey: ['nodes'], exact: false });
      } else if (tag.startsWith('card:')) {
        // Specific card invalidation
        const cardId = tag.split(':')[1];
        queryClient.invalidateQueries({ queryKey: ['card', cardId] });
        queryClient.invalidateQueries({ queryKey: ['cards'], exact: false });
      } else if (tag.startsWith('search:')) {
        // Query-specific search invalidation
        const query = tag.split(':')[1];
        queryClient.invalidateQueries({ queryKey: ['search', query] });
      } else {
        // Generic tag handling - treat as query key prefix
        queryClient.invalidateQueries({ queryKey: [tag] });
      }
    });

    if (import.meta.env.DEV && tags.length > 0) {
      console.log('Enhanced cache invalidation:', {
        tags,
        tanstackInvalidated: true,
        legacyInvalidated: true
      });
    }
  }, [queryClient, legacyInvalidate]);

  /**
   * Register queries with both cache systems for comprehensive tracking
   */
  const register = useCallback((tags: CacheTag[], refetch: () => void) => {
    // Register with legacy system
    const legacyCleanup = legacyRegister(tags, refetch);

    // Note: TanStack Query handles its own registration automatically
    // through useQuery hooks, so we don't need explicit registration

    // Return combined cleanup function
    return () => {
      legacyCleanup();
    };
  }, [legacyRegister]);

  return {
    invalidate,
    register
  };
}

/**
 * Utility functions for creating TanStack Query keys that align with cache tags
 */
export const QueryKeys = {
  // Node-related queries
  allNodes: () => ['nodes'] as const,
  nodesByFolder: (folder?: string) => ['nodes', folder] as const,
  specificNode: (id: string) => ['node', id] as const,
  nodeChildren: (id: string) => ['node', id, 'children'] as const,
  nodeConnections: (id: string) => ['node', id, 'connections'] as const,

  // Card-related queries
  allCards: () => ['cards'] as const,
  specificCard: (id: string) => ['card', id] as const,
  cardsByType: (type: string) => ['cards', 'type', type] as const,

  // Search queries
  search: (query: string) => ['search', query] as const,
  searchSuggestions: (partial: string) => ['search', 'suggestions', partial] as const,

  // Metadata queries
  schema: () => ['schema'] as const,
  metadata: () => ['metadata'] as const,
  analytics: (type: string) => ['analytics', type] as const,

  // Graph queries
  graph: (scope: string) => ['graph', scope] as const,
  graphMetrics: (nodeId?: string) => nodeId ? ['graph', 'metrics', nodeId] : ['graph', 'metrics'] as const,
  graphConnections: (from: string, to?: string) => to ? ['graph', 'connections', from, to] : ['graph', 'connections', from] as const,
} as const;

/**
 * Type-safe query key creation with tag alignment
 */
export type QueryKey = ReturnType<typeof QueryKeys[keyof typeof QueryKeys]>;

/**
 * Helper function to convert cache tags to query key prefixes for bulk invalidation
 */
export function tagsToQueryKeyPrefixes(tags: CacheTag[]): string[][] {
  return tags.map(tag => {
    if (tag === 'nodes') return ['nodes'];
    if (tag === 'notebook_cards') return ['cards'];
    if (tag === 'search') return ['search'];
    if (tag === 'metadata') return ['metadata'];
    if (tag.startsWith('nodes:')) {
      const folder = tag.split(':')[1];
      return ['nodes', folder];
    }
    if (tag.startsWith('node:')) {
      const nodeId = tag.split(':')[1];
      return ['node', nodeId];
    }
    if (tag.startsWith('card:')) {
      const cardId = tag.split(':')[1];
      return ['card', cardId];
    }
    // Fallback: treat tag as query key prefix
    return [tag];
  });
}

/**
 * Utility to invalidate queries by partial key matching
 * Useful for complex invalidation scenarios
 */
export function invalidateQueriesByPrefix(queryClient: ReturnType<typeof useQueryClient>, prefixes: string[][]) {
  prefixes.forEach(prefix => {
    queryClient.invalidateQueries({
      queryKey: prefix,
      exact: false // Match all queries that start with this prefix
    });
  });
}