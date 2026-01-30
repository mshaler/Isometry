/**
 * Dynamic SQL Query Builder for PAFV Filters
 *
 * Converts wells configuration to optimized SQL queries with intelligent
 * index usage, query optimization, and performance validation.
 */

import type { Wells } from '@/contexts/PAFVContext';

export interface PAFVQueryOptions {
  /** Maximum number of rows to return (default: 1000) */
  maxRows?: number;
  /** Enable query optimization (default: true) */
  enableOptimization?: boolean;
  /** Include performance hints (default: true) */
  includeHints?: boolean;
  /** Sort order (default: 'modified_at DESC') */
  sortOrder?: string;
  /** Additional WHERE conditions */
  additionalConditions?: string[];
}

export interface QueryOptimizationResult {
  optimizedQuery: string;
  originalQuery: string;
  optimizationsApplied: string[];
  estimatedPerformance: 'excellent' | 'good' | 'fair' | 'poor';
  indexRecommendations: string[];
}

/**
 * Map PAFV chip IDs to their corresponding database columns and conditions
 */
interface ChipMapping {
  column: string;
  condition: (active: boolean) => string;
  groupBy?: string;
  orderBy?: string;
}

const CHIP_MAPPING: Record<string, ChipMapping> = {
  // Row groupings (data classification)
  folder: {
    column: 'folder',
    condition: (active: boolean) => active ? 'folder IS NOT NULL' : '1=1'
  },
  subfolder: {
    column: 'folder',
    condition: (active: boolean) => active ? 'folder LIKE "%/%" OR folder LIKE "%\\%"' : '1=1'
  },
  tags: {
    column: 'tags',
    condition: (active: boolean) => active ? 'tags != "[]" AND tags IS NOT NULL AND tags != ""' : '1=1'
  },

  // Column groupings (temporal)
  year: {
    column: 'created_at',
    condition: (active: boolean) => active ? 'created_at >= datetime("now", "-1 year")' : '1=1',
    groupBy: 'strftime("%Y", created_at)',
    orderBy: 'strftime("%Y", created_at) DESC'
  },
  month: {
    column: 'created_at',
    condition: (active: boolean) => active ? 'created_at >= datetime("now", "-1 month")' : '1=1',
    groupBy: 'strftime("%Y-%m", created_at)',
    orderBy: 'strftime("%Y-%m", created_at) DESC'
  },

  // Z-layer filters (view modifiers)
  auditview: {
    column: 'modified_at',
    condition: (active: boolean) => active ? 'modified_at != created_at' : '1=1'
  }
};

/**
 * Build optimized SQL query from PAFV wells configuration
 */
export function buildPAFVQuery(wells: Wells, options: PAFVQueryOptions = {}): string {
  const {
    maxRows = 1000,
    sortOrder = 'modified_at DESC',
    additionalConditions = []
  } = options;

  let query = 'SELECT * FROM nodes';
  const conditions: string[] = ['deleted_at IS NULL']; // Always exclude deleted
  const groupByColumns: string[] = [];
  const orderByColumns: string[] = [];

  // Process row chips (primary grouping)
  if (wells.rows.length > 0) {
    const rowConditions = wells.rows
      .map(chip => {
        const mapping = CHIP_MAPPING[chip.id];
        if (!mapping) return '1=1';

        if (mapping.groupBy) {
          groupByColumns.push(mapping.groupBy);
        }
        if (mapping.orderBy) {
          orderByColumns.push(mapping.orderBy);
        }

        return mapping.condition(true);
      })
      .filter(condition => condition !== '1=1');

    if (rowConditions.length > 0) {
      conditions.push(`(${rowConditions.join(' OR ')})`);
    }
  }

  // Process column chips (secondary grouping)
  if (wells.columns.length > 0) {
    const columnConditions = wells.columns
      .map(chip => {
        const mapping = CHIP_MAPPING[chip.id];
        if (!mapping) return '1=1';

        if (mapping.groupBy) {
          groupByColumns.push(mapping.groupBy);
        }
        if (mapping.orderBy) {
          orderByColumns.push(mapping.orderBy);
        }

        return mapping.condition(true);
      })
      .filter(condition => condition !== '1=1');

    if (columnConditions.length > 0) {
      conditions.push(`(${columnConditions.join(' OR ')})`);
    }
  }

  // Process z-layer chips (filter modifiers)
  const activeZLayers = wells.zLayers.filter(chip => chip.checked);
  if (activeZLayers.length > 0) {
    const zConditions = activeZLayers
      .map(chip => {
        const mapping = CHIP_MAPPING[chip.id];
        if (!mapping) return '1=1';
        return mapping.condition(true);
      })
      .filter(condition => condition !== '1=1');

    if (zConditions.length > 0) {
      conditions.push(`(${zConditions.join(' AND ')})`);
    }
  }

  // Add additional conditions
  conditions.push(...additionalConditions);

  // Build WHERE clause
  if (conditions.length > 1) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  } else if (conditions.length === 1) {
    query += ` WHERE ${conditions[0]}`;
  }

  // Add GROUP BY if we have grouping columns
  if (groupByColumns.length > 0) {
    query += ` GROUP BY ${groupByColumns.join(', ')}`;
  }

  // Add ORDER BY
  const finalOrderBy = orderByColumns.length > 0
    ? orderByColumns.join(', ')
    : sortOrder;

  query += ` ORDER BY ${finalOrderBy}`;

  // Add LIMIT for performance
  query += ` LIMIT ${maxRows}`;

  return query;
}

/**
 * Analyze and optimize query for better performance
 */
export function optimizeQuery(query: string): string {
  let optimizedQuery = query;
  const optimizations: string[] = [];

  // Optimization 1: Prefer indexed columns in WHERE clauses
  if (optimizedQuery.includes('folder IS NOT NULL')) {
    // folder column should be indexed
    optimizations.push('folder index usage');
  }

  // Optimization 2: Use covering indexes for common patterns
  if (optimizedQuery.includes('modified_at') && optimizedQuery.includes('created_at')) {
    // Suggest covering index on (modified_at, created_at, id)
    optimizations.push('temporal covering index');
  }

  // Optimization 3: Optimize date functions
  optimizedQuery = optimizedQuery.replace(
    /datetime\("now", "([^"]+)"\)/g,
    (match, interval) => {
      // Pre-calculate relative dates for better performance
      const now = new Date();
      let targetDate: Date;

      switch (interval) {
        case '-1 year':
          targetDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        case '-1 month':
          targetDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case '-7 days':
          targetDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          return match;
      }

      optimizations.push('date function optimization');
      return `'${targetDate.toISOString()}'`;
    }
  );

  // Optimization 4: Simplify complex conditions
  optimizedQuery = optimizedQuery.replace(
    /tags != "\[\]" AND tags IS NOT NULL AND tags != ""/g,
    'length(tags) > 2'
  );

  if (optimizations.length > 0) {
    optimizations.push('condition simplification');
  }

  return optimizedQuery;
}

/**
 * Generate aggregation query for summary statistics
 */
export function generateAggregationQuery(baseQuery: string): string {
  // Extract WHERE clause from base query
  const whereMatch = baseQuery.match(/WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
  const whereClause = whereMatch ? whereMatch[1] : 'deleted_at IS NULL';

  return `
    WITH filtered_nodes AS (
      SELECT * FROM nodes WHERE ${whereClause}
    )
    SELECT
      'total' as category,
      'count' as metric,
      COUNT(*) as value
    FROM filtered_nodes

    UNION ALL

    SELECT
      'by_type' as category,
      node_type as metric,
      COUNT(*) as value
    FROM filtered_nodes
    GROUP BY node_type

    UNION ALL

    SELECT
      'by_folder' as category,
      COALESCE(folder, 'No Folder') as metric,
      COUNT(*) as value
    FROM filtered_nodes
    GROUP BY folder

    UNION ALL

    SELECT
      'temporal' as category,
      CASE
        WHEN created_at >= datetime('now', '-1 day') THEN 'today'
        WHEN created_at >= datetime('now', '-7 days') THEN 'this_week'
        WHEN created_at >= datetime('now', '-30 days') THEN 'this_month'
        ELSE 'older'
      END as metric,
      COUNT(*) as value
    FROM filtered_nodes
    GROUP BY metric

    ORDER BY category, metric
  `.trim();
}

/**
 * Combine multiple filter conditions efficiently
 */
export function combineFilters(conditions: string[]): string {
  if (conditions.length === 0) return '1=1';
  if (conditions.length === 1) return conditions[0];

  // Group conditions by column for optimization
  const conditionsByColumn: Record<string, string[]> = {};
  const otherConditions: string[] = [];

  for (const condition of conditions) {
    const columnMatch = condition.match(/^(\w+)\s+/);
    if (columnMatch) {
      const column = columnMatch[1];
      if (!conditionsByColumn[column]) {
        conditionsByColumn[column] = [];
      }
      conditionsByColumn[column].push(condition);
    } else {
      otherConditions.push(condition);
    }
  }

  // Optimize conditions for the same column
  const optimizedConditions: string[] = [];

  for (const [, columnConditions] of Object.entries(conditionsByColumn)) {
    if (columnConditions.length === 1) {
      optimizedConditions.push(columnConditions[0]);
    } else {
      // Try to combine similar conditions
      optimizedConditions.push(`(${columnConditions.join(' OR ')})`);
    }
  }

  optimizedConditions.push(...otherConditions);
  return optimizedConditions.join(' AND ');
}

/**
 * Validate query safety and performance characteristics
 */
export function validateQuery(query: string): {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let isValid = true;

  // Check for basic SQL injection patterns
  const suspiciousPatterns = [
    /;\s*drop\s+/i,
    /union\s+select.*from\s+/i,
    /'\s*or\s+'1'\s*=\s*'1'/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(query)) {
      warnings.push('Query contains suspicious patterns');
      isValid = false;
      break;
    }
  }

  // Performance validations
  if (!query.includes('LIMIT')) {
    warnings.push('Query lacks LIMIT clause - may return too many rows');
    recommendations.push('Add LIMIT clause to prevent excessive memory usage');
  }

  if (query.includes('SELECT *') && query.includes('JOIN')) {
    warnings.push('Using SELECT * with JOINs may be inefficient');
    recommendations.push('Select only needed columns when using JOINs');
  }

  // Count conditions for complexity
  const conditionCount = (query.match(/\bAND\b|\bOR\b/gi) || []).length;
  if (conditionCount > 10) {
    warnings.push('Query has high complexity - may be slow');
    recommendations.push('Consider simplifying filter conditions');
  }

  return { isValid, warnings, recommendations };
}

/**
 * Cache optimized query plans for reuse
 */
class QueryPlanCache {
  private cache = new Map<string, { plan: string; timestamp: number }>();
  private readonly TTL_MS = 300000; // 5 minute TTL

  get(queryHash: string): string | null {
    const cached = this.cache.get(queryHash);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.TTL_MS) {
      this.cache.delete(queryHash);
      return null;
    }

    return cached.plan;
  }

  set(queryHash: string, plan: string): void {
    this.cache.set(queryHash, { plan, timestamp: Date.now() });

    // Cleanup old entries
    if (this.cache.size > 100) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.slice(0, 25).forEach(([key]) => this.cache.delete(key));
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global query plan cache
const queryPlanCache = new QueryPlanCache();

/**
 * Cache query plan for performance optimization
 */
export function cacheQueryPlan(query: string, plan: string): void {
  const queryHash = generateQueryHash(query);
  queryPlanCache.set(queryHash, plan);
}

/**
 * Get cached query plan if available
 */
export function getCachedQueryPlan(query: string): string | null {
  const queryHash = generateQueryHash(query);
  return queryPlanCache.get(queryHash);
}

/**
 * Generate hash for query caching
 */
function generateQueryHash(query: string): string {
  // Simple hash function for query strings
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

export default {
  buildPAFVQuery,
  optimizeQuery,
  generateAggregationQuery,
  combineFilters,
  validateQuery,
  cacheQueryPlan,
  getCachedQueryPlan
};