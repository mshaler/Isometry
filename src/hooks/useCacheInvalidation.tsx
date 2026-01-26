// ============================================================================
// Cache Invalidation System
// ============================================================================
// Centralized cache invalidation with dependency tracking and tagging
// ============================================================================

import React, { useContext, createContext, useCallback, useRef, useEffect, ReactNode } from 'react';

// Cache invalidation tags for different data types
export type CacheTag =
  | 'nodes'           // All node data
  | 'notebook_cards'  // All notebook card data
  | 'search'          // All search results
  | 'metadata'        // Schema and metadata
  | `nodes:${string}` // Specific node folder
  | `node:${string}`  // Specific node ID
  | `card:${string}`  // Specific card ID
  | string;           // Custom tags

// Function to invalidate cache for specific tags
type InvalidateFn = (tags: CacheTag[]) => void;

// Function to register a query with specific tags
type RegisterFn = (tags: CacheTag[], _refetch: () => void) => () => void; // Returns cleanup function

interface CacheInvalidationContextType {
  invalidate: InvalidateFn;
  register: RegisterFn;
}

const CacheInvalidationContext = createContext<CacheInvalidationContextType | null>(null);

/**
 * Provider component for cache invalidation system
 */
export function CacheInvalidationProvider({ children }: { children: ReactNode }) {
  // Map of tags to registered refetch functions
  const tagsToRefetch = useRef<Map<CacheTag, Set<() => void>>>(new Map());

  const register = useCallback<RegisterFn>((tags, refetch) => {
    // Register the refetch function for each tag
    tags.forEach(tag => {
      if (!tagsToRefetch.current.has(tag)) {
        tagsToRefetch.current.set(tag, new Set());
      }
      tagsToRefetch.current.get(tag)!.add(refetch);
    });

    // Return cleanup function
    return () => {
      tags.forEach(tag => {
        const refetchSet = tagsToRefetch.current.get(tag);
        if (refetchSet) {
          refetchSet.delete(refetch);
          if (refetchSet.size === 0) {
            tagsToRefetch.current.delete(tag);
          }
        }
      });
    };
  }, []);

  const invalidate = useCallback<InvalidateFn>((tags) => {
    const refetchFunctions = new Set<() => void>();

    // Collect all refetch functions for the given tags
    tags.forEach(tag => {
      const refetchSet = tagsToRefetch.current.get(tag);
      if (refetchSet) {
        refetchSet.forEach(fn => refetchFunctions.add(fn));
      }
    });

    // Execute all unique refetch functions
    refetchFunctions.forEach(refetch => {
      try {
        refetch();
      } catch (error) {
        console.error('Error during cache invalidation:', error);
      }
    });

    if (import.meta.env.DEV && refetchFunctions.size > 0) {
      console.log('Cache invalidation:', {
        tags,
        refetchCount: refetchFunctions.size
      });
    }
  }, []);

  return (
    <CacheInvalidationContext.Provider value={{ invalidate, register }}>
      {children}
    </CacheInvalidationContext.Provider>
  );
}

/**
 * Hook to access cache invalidation functions
 */
export function useCacheInvalidation() {
  const context = useContext(CacheInvalidationContext);
  if (!context) {
    throw new Error('useCacheInvalidation must be used within CacheInvalidationProvider');
  }
  return context;
}

/**
 * Hook to register a query for cache invalidation with specific tags
 * @param tags Array of cache tags this query depends on
 * @param refetch Function to refetch the query data
 */
export function useQueryCacheRegistration(tags: CacheTag[], _refetch: () => void) {
  const { register } = useCacheInvalidation();

  const currentRefetch = useRef(_refetch);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastTagsRef = useRef<string>('');

  currentRefetch.current = _refetch;

  // Stable refetch function that always calls the latest refetch
  const stableRefetch = useCallback(() => {
    currentRefetch.current();
  }, []);

  // Create a stable tags key for comparison
  const tagsKey = JSON.stringify(tags.slice().sort());

  // Register/re-register only when tags change
  if (lastTagsRef.current !== tagsKey) {
    // Cleanup previous registration
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    // Register with new tags (only if we have tags)
    if (tags.length > 0) {
      cleanupRef.current = register(tags, stableRefetch);
    }

    lastTagsRef.current = tagsKey;
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run on mount/unmount
}

/**
 * Utility functions to generate cache tags for common patterns
 */
export const CacheTags = {
  allNodes: (): CacheTag[] => ['nodes'],
  allCards: (): CacheTag[] => ['notebook_cards'],
  allSearch: (): CacheTag[] => ['search'],
  allMetadata: (): CacheTag[] => ['metadata'],

  nodesByFolder: (folder?: string): CacheTag[] =>
    folder ? ['nodes', `nodes:${folder}`] : ['nodes'],

  specificNode: (id: string): CacheTag[] =>
    ['nodes', `node:${id}`],

  specificCard: (id: string): CacheTag[] =>
    ['notebook_cards', `card:${id}`],

  searchResults: (query?: string): CacheTag[] =>
    query ? ['search', `search:${query}`] : ['search'],

  // Mutation-triggered invalidations
  nodeCreated: (folder?: string): CacheTag[] => [
    'nodes',
    'search',
    ...(folder ? [`nodes:${folder}`] : [])
  ],

  nodeUpdated: (id: string, folder?: string): CacheTag[] => [
    'nodes',
    'search',
    `node:${id}`,
    ...(folder ? [`nodes:${folder}`] : [])
  ],

  nodeDeleted: (id: string, folder?: string): CacheTag[] => [
    'nodes',
    'search',
    `node:${id}`,
    ...(folder ? [`nodes:${folder}`] : [])
  ],

  cardCreated: (): CacheTag[] => [
    'notebook_cards',
    'search'
  ],

  cardUpdated: (id: string): CacheTag[] => [
    'notebook_cards',
    'search',
    `card:${id}`
  ],

  cardDeleted: (id: string): CacheTag[] => [
    'notebook_cards',
    'search',
    `card:${id}`
  ]
};