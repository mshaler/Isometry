/**
 * useFacetValues Hook
 *
 * Phase 100-02 Task 2: React hooks with TanStack Query caching
 *
 * Purpose: Provide cached facet value discovery for UI components.
 * Hooks query the database for available filter values with 5-minute staletime
 * to minimize redundant queries while keeping UI responsive to data changes.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useSQLite } from '../db/SQLiteProvider';
import {
  discoverFacetValues,
  type DiscoveredValue,
  type DiscoveryOptions,
} from '../services/facet-discovery';

/**
 * Generic hook for discovering facet values with caching.
 *
 * @param column - Column name in cards table (folder, status, priority, tags, etc.)
 * @param options - Discovery options (isMultiSelect for JSON arrays)
 * @returns TanStack Query result with data, isLoading, error, refetch
 */
export function useFacetValues(
  column: string,
  options?: DiscoveryOptions
): UseQueryResult<DiscoveredValue[], Error> {
  const { db } = useSQLite();

  return useQuery({
    queryKey: ['facet-values', column, options?.isMultiSelect],
    queryFn: async () => {
      if (!db) return [];
      return discoverFacetValues(db, column, options);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (DISCOVER-04 requirement)
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
    enabled: !!db,
  });
}

/**
 * Convenience hook for discovering folder values.
 * Returns distinct folders from cards table ordered by usage count.
 *
 * @returns TanStack Query result with folder values
 */
export function useFolderValues(): UseQueryResult<DiscoveredValue[], Error> {
  return useFacetValues('folder');
}

/**
 * Convenience hook for discovering status values.
 * Returns distinct statuses from cards table ordered by usage count.
 *
 * @returns TanStack Query result with status values
 */
export function useStatusValues(): UseQueryResult<DiscoveredValue[], Error> {
  return useFacetValues('status');
}

/**
 * Convenience hook for discovering tag values.
 * Uses multi-select mode to explode JSON tag arrays via json_each.
 *
 * @returns TanStack Query result with tag values
 */
export function useTagValues(): UseQueryResult<DiscoveredValue[], Error> {
  return useFacetValues('tags', { isMultiSelect: true });
}
