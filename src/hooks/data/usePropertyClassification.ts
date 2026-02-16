/**
 * usePropertyClassification Hook
 *
 * React hook that provides property classification data for Navigator 1.
 * This is Task 0.2 from the Navigators GSD Plan.
 *
 * Features:
 * - Uses useSQLite to access the database
 * - Calls classifyProperties service to get LATCH+GRAPH buckets
 * - Caches results (property schema rarely changes)
 * - Provides refresh() for when user adds custom facets
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSQLite } from '../../db/SQLiteProvider';
import {
  classifyProperties,
  type PropertyClassification,
} from '../../services/property-classifier';
import type { Database } from 'sql.js';

export interface UsePropertyClassificationResult {
  /** The classified properties by LATCH+GRAPH bucket */
  classification: PropertyClassification | null;
  /** Whether the classification is currently loading */
  isLoading: boolean;
  /** Error message if classification failed */
  error: string | null;
  /** Function to refresh the classification (e.g., after adding facets) */
  refresh: () => void;
}

/**
 * Hook to access property classification for LATCH+GRAPH buckets.
 *
 * This hook reads the facets table and classifies properties into
 * Location, Alphabet, Time, Category, Hierarchy, and GRAPH buckets.
 *
 * @param nodeType - Optional node_type filter for schema-on-read (e.g., 'notes', 'contacts')
 * @returns Classification result with loading/error states and refresh function
 *
 * @example
 * ```tsx
 * function NavigatorPanel() {
 *   const { classification, isLoading, error, refresh } = usePropertyClassification('notes');
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error} />;
 *
 *   return (
 *     <div>
 *       {Object.entries(classification).map(([bucket, properties]) => (
 *         <BucketColumn key={bucket} bucket={bucket} properties={properties} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePropertyClassification(nodeType?: string): UsePropertyClassificationResult {
  const { db, loading: dbLoading, error: dbError } = useSQLite();

  const [classification, setClassification] = useState<PropertyClassification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache reference to prevent unnecessary re-classifications
  // Includes nodeType to ensure re-classification when switching datasets
  const cacheRef = useRef<{
    classification: PropertyClassification | null;
    dataVersion: number;
    nodeType?: string;
  }>({ classification: null, dataVersion: -1, nodeType: undefined });

  // Track data version to know when to refresh
  const { dataVersion } = useSQLite();

  const loadClassification = useCallback(() => {
    if (dbLoading || !db) {
      return;
    }

    // Check cache - if data version AND nodeType haven't changed, use cached result
    if (
      cacheRef.current.dataVersion === dataVersion &&
      cacheRef.current.nodeType === nodeType &&
      cacheRef.current.classification !== null
    ) {
      setClassification(cacheRef.current.classification);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call the classifier service with nodeType filter
      const result = classifyProperties(db as unknown as Database, nodeType);

      // Update cache with nodeType
      cacheRef.current = {
        classification: result,
        dataVersion,
        nodeType,
      };

      setClassification(result);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setClassification(null);
    } finally {
      setIsLoading(false);
    }
  }, [db, dbLoading, dataVersion, nodeType]);

  // Load classification when dependencies change
  useEffect(() => {
    loadClassification();
  }, [loadClassification]);

  // Handle database errors
  useEffect(() => {
    if (dbError) {
      setError(dbError.message);
      setIsLoading(false);
    }
  }, [dbError]);

  // Refresh function that forces reload
  const refresh = useCallback(() => {
    // Invalidate cache
    cacheRef.current = { classification: null, dataVersion: -1 };
    loadClassification();
  }, [loadClassification]);

  return {
    classification,
    isLoading: isLoading || dbLoading,
    error,
    refresh,
  };
}

// Re-export types for convenience
export type { PropertyClassification } from '../../services/property-classifier';
export type {
  ClassifiedProperty,
  PropertyBucket,
  LATCHBucket,
} from '../../services/property-classifier';
