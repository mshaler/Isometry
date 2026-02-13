/**
 * useFacetAggregates Hook
 *
 * React hook that provides facet aggregate counts for the Catalog Browser.
 * Returns folder, tag, and status counts, automatically refreshing when data changes.
 *
 * Phase 79-01: Facet aggregate queries for catalog browsing
 *
 * @example
 * ```tsx
 * function CatalogBrowser() {
 *   const { aggregates, isLoading, error } = useFacetAggregates();
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error} />;
 *
 *   return (
 *     <div>
 *       <FolderList folders={aggregates.folders} />
 *       <TagCloud tags={aggregates.tags} />
 *       <StatusCounts statuses={aggregates.statuses} />
 *     </div>
 *   );
 * }
 * ```
 */

import { useMemo } from 'react';
import { useSQLite } from '../../db/SQLiteProvider';
import {
  getAllFacetCounts,
  type FacetCount,
  type AllFacetCounts,
} from '../../db/queries/facet-aggregates';

export interface UseFacetAggregatesResult {
  /** The aggregated facet counts (folders, tags, statuses) */
  aggregates: AllFacetCounts | null;
  /** Whether the aggregates are currently loading */
  isLoading: boolean;
  /** Error message if aggregation failed */
  error: string | null;
}

/**
 * Hook to access facet aggregate counts for the Catalog Browser.
 *
 * Queries the database for folder, tag, and status counts using GROUP BY.
 * Results are automatically refreshed when dataVersion changes (indicating data mutations).
 *
 * @returns Aggregates result with loading/error states
 */
export function useFacetAggregates(): UseFacetAggregatesResult {
  const { db, loading: dbLoading, error: dbError, dataVersion } = useSQLite();

  const result = useMemo((): UseFacetAggregatesResult => {
    // Handle loading state
    if (dbLoading || !db) {
      return {
        aggregates: null,
        isLoading: true,
        error: null,
      };
    }

    // Handle database error
    if (dbError) {
      return {
        aggregates: null,
        isLoading: false,
        error: dbError.message,
      };
    }

    try {
      // Query all facet counts
      const aggregates = getAllFacetCounts(db);

      return {
        aggregates,
        isLoading: false,
        error: null,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        aggregates: null,
        isLoading: false,
        error: errorMessage,
      };
    }
  }, [db, dbLoading, dbError, dataVersion]); // dataVersion ensures refresh on data changes

  return result;
}

// Re-export types for convenience
export type { FacetCount, AllFacetCounts };
