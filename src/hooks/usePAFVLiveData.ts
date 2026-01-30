/**
 * PAFV Live Data Hook
 *
 * Specialized hook for PAFV-driven live data subscriptions and dynamic query generation.
 * Provides intelligent caching, performance monitoring, and complex filter scenarios.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveData, type LiveDataPerformanceMetrics } from './useLiveData';
import { buildPAFVQuery, optimizeQuery, type PAFVQueryOptions } from '@/utils/query-builder';
import type { Wells } from '@/contexts/PAFVContext';
import type { Node } from '@/types/node';

export interface PAFVQueryMetrics {
  executionTime: number;
  rowsReturned: number;
  cacheHitRate: number;
  queryComplexity: number;
  indexesUsed: string[];
  optimizationScore: number;
  lastExecuted: Date;
}

export interface PAFVLiveDataOptions extends PAFVQueryOptions {
  /** Enable aggregation queries (default: true) */
  includeAggregations?: boolean;
  /** Maximum rows to return (default: 1000) */
  maxRows?: number;
  /** Enable intelligent caching for common filter combinations (default: true) */
  enableSmartCache?: boolean;
  /** Performance monitoring callback */
  onPerformanceUpdate?: (metrics: PAFVQueryMetrics) => void;
}

export interface PAFVLiveDataResult {
  data: Node[];
  aggregations: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  queryText: string;
  performance: PAFVQueryMetrics | null;
}

interface CachedQuery {
  query: string;
  aggregationQuery: string;
  timestamp: number;
  wellsHash: string;
}

/**
 * Generate hash for wells configuration to detect changes
 */
function generateWellsHash(wells: Wells): string {
  const normalized = {
    rows: wells.rows.map(c => `${c.id}:${c.checked || false}`).sort(),
    columns: wells.columns.map(c => `${c.id}:${c.checked || false}`).sort(),
    zLayers: wells.zLayers.filter(c => c.checked).map(c => c.id).sort(),
    available: wells.available.length // Track if chips moved to/from available
  };

  return JSON.stringify(normalized);
}

/**
 * Build aggregation query for summary statistics
 */
function buildAggregationQuery(baseQuery: string): string {
  // Extract the main WHERE clause from the base query
  const whereMatch = baseQuery.match(/WHERE\s+(.+?)\s+ORDER\s+BY/i);
  const whereClause = whereMatch ? whereMatch[1] : 'deleted_at IS NULL';

  return `
    SELECT
      'total_nodes' as metric, COUNT(*) as value
    FROM nodes
    WHERE ${whereClause}

    UNION ALL

    SELECT
      'by_type' as metric,
      node_type || ':' || COUNT(*) as value
    FROM nodes
    WHERE ${whereClause}
    GROUP BY node_type

    UNION ALL

    SELECT
      'by_folder' as metric,
      COALESCE(folder, 'No Folder') || ':' || COUNT(*) as value
    FROM nodes
    WHERE ${whereClause}
    GROUP BY folder

    UNION ALL

    SELECT
      'recent_activity' as metric,
      COUNT(*) as value
    FROM nodes
    WHERE ${whereClause} AND modified_at >= datetime('now', '-7 days')
  `.trim();
}

/**
 * Parse aggregation results into structured data
 */
function parseAggregations(rawData: unknown): Record<string, number> {
  if (!Array.isArray(rawData)) return {};

  const result: Record<string, number> = {};

  for (const row of rawData) {
    if (typeof row === 'object' && row !== null && 'metric' in row && 'value' in row) {
      const metric = String(row.metric);
      const value = Number(row.value) || 0;

      if (metric.includes(':')) {
        // Complex metric like "by_type:note:5"
        const [category, ...parts] = metric.split(':');
        if (parts.length >= 2) {
          const key = parts.slice(0, -1).join(':');
          const count = Number(parts[parts.length - 1]) || value;
          result[`${category}.${key}`] = count;
        }
      } else {
        // Simple metric
        result[metric] = value;
      }
    }
  }

  return result;
}

/**
 * Calculate query complexity score for performance monitoring
 */
function calculateQueryComplexity(query: string): number {
  let complexity = 1;

  // Join complexity
  const joinCount = (query.match(/\bJOIN\b/gi) || []).length;
  complexity += joinCount * 2;

  // Subquery complexity
  const subqueryCount = (query.match(/\bSELECT\b/gi) || []).length - 1;
  complexity += subqueryCount * 3;

  // WHERE conditions
  const conditionCount = (query.match(/\bAND\b|\bOR\b/gi) || []).length;
  complexity += conditionCount;

  // GROUP BY complexity
  if (query.includes('GROUP BY')) complexity += 2;

  // ORDER BY complexity
  if (query.includes('ORDER BY')) complexity += 1;

  return Math.min(complexity, 10); // Cap at 10
}

/**
 * Smart cache for common PAFV query combinations
 */
class PAFVQueryCache {
  private cache = new Map<string, CachedQuery>();
  private readonly TTL_MS = 30000; // 30 second TTL for PAFV queries

  get(wellsHash: string): CachedQuery | null {
    const cached = this.cache.get(wellsHash);
    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.TTL_MS) {
      this.cache.delete(wellsHash);
      return null;
    }

    return cached;
  }

  set(wellsHash: string, query: string, aggregationQuery: string): void {
    this.cache.set(wellsHash, {
      query,
      aggregationQuery,
      timestamp: Date.now(),
      wellsHash
    });

    // Cleanup old entries
    if (this.cache.size > 50) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      // Remove oldest 25%
      const toRemove = entries.slice(0, Math.floor(entries.length * 0.25));
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instance for PAFV queries
const pafvQueryCache = new PAFVQueryCache();

/**
 * Hook for PAFV-driven live data subscriptions
 */
export function usePAFVLiveData(
  wells: Wells,
  options: PAFVLiveDataOptions = {}
): PAFVLiveDataResult {
  const {
    includeAggregations = true,
    maxRows = 1000,
    enableSmartCache = true,
    onPerformanceUpdate,
    ...queryOptions
  } = options;

  const [performance, setPerformance] = useState<PAFVQueryMetrics | null>(null);
  const [aggregations, setAggregations] = useState<Record<string, number>>({});

  // Generate wells hash for caching
  const wellsHash = useMemo(() => generateWellsHash(wells), [wells]);

  // Generate optimized query
  const { query, aggregationQuery } = useMemo(() => {
    // Check smart cache first
    if (enableSmartCache) {
      const cached = pafvQueryCache.get(wellsHash);
      if (cached) {
        return {
          query: cached.query,
          aggregationQuery: cached.aggregationQuery
        };
      }
    }

    // Build new queries
    const baseQuery = buildPAFVQuery(wells, { ...queryOptions, maxRows });
    const optimizedQuery = optimizeQuery(baseQuery);
    const aggQuery = includeAggregations ? buildAggregationQuery(optimizedQuery) : '';

    // Cache the result
    if (enableSmartCache) {
      pafvQueryCache.set(wellsHash, optimizedQuery, aggQuery);
    }

    return {
      query: optimizedQuery,
      aggregationQuery: aggQuery
    };
  }, [wells, wellsHash, queryOptions, maxRows, includeAggregations, enableSmartCache]);

  // Main data subscription
  const dataSubscription = useLiveData<Node[]>(
    query,
    [],
    {
      throttleMs: 100,
      trackPerformance: true,
      onPerformanceUpdate: (metrics: LiveDataPerformanceMetrics) => {
        const pafvMetrics: PAFVQueryMetrics = {
          executionTime: metrics.lastLatency,
          rowsReturned: Array.isArray(dataSubscription.data) ? dataSubscription.data.length : 0,
          cacheHitRate: metrics.cacheHitRate,
          queryComplexity: calculateQueryComplexity(query),
          indexesUsed: [], // TODO: Extract from query plan
          optimizationScore: Math.max(0, 10 - calculateQueryComplexity(query)),
          lastExecuted: new Date()
        };

        setPerformance(pafvMetrics);

        if (onPerformanceUpdate) {
          onPerformanceUpdate(pafvMetrics);
        }
      }
    }
  );

  // Aggregations subscription (if enabled)
  const aggregationsSubscription = useLiveData<unknown[]>(
    aggregationQuery,
    [],
    {
      throttleMs: 200, // Slightly slower for aggregations
      trackPerformance: false,
      enablePolling: false
    }
  );

  // Update aggregations when data changes
  useEffect(() => {
    if (aggregationsSubscription.data) {
      const parsed = parseAggregations(aggregationsSubscription.data);
      setAggregations(parsed);
    }
  }, [aggregationsSubscription.data]);

  // Reset aggregations when query changes
  useEffect(() => {
    setAggregations({});
  }, [query]);

  return {
    data: dataSubscription.data || [],
    aggregations,
    isLoading: dataSubscription.isLoading || (includeAggregations && aggregationsSubscription.isLoading),
    error: dataSubscription.error || aggregationsSubscription.error,
    queryText: query,
    performance
  };
}

/**
 * Utility to clear PAFV query cache
 */
export function clearPAFVCache(): void {
  pafvQueryCache.clear();
}

/**
 * Get PAFV cache statistics
 */
export function getPAFVCacheStats(): { size: number; hitRate: number } {
  return {
    size: pafvQueryCache.size(),
    hitRate: 0 // TODO: Track hit rate
  };
}

export default usePAFVLiveData;