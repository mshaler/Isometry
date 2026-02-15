# SuperStack Phase 2: SQL Integration

*Building Headers from Live SQLite Data*

**Version:** 1.0  
**Date:** February 2025  
**Prerequisites:** Phase 1 Complete (Types, Builder, Renderer, Tests)  
**Status:** Ready for Implementation

---

## Executive Summary

Phase 2 connects SuperStack to live SQLite data. Instead of hardcoded mock data, headers will be built from actual `GROUP BY` queries against the cards table. This is where SuperGrid becomes real—users will see their actual data organized by their chosen LATCH facets.

**Deliverables:**
1. `header-discovery.ts` - SQL query builders for extracting unique facet combinations
2. `useSuperStackData.ts` - React hook for data fetching and tree building
3. Integration tests with real sql.js database
4. Demo component showing live data rendering

**Key Challenges:**
- Multi-select facets (tags) require `json_each()` to explode
- Time facets require `strftime()` extraction
- Query must return facet combinations with card counts
- Performance: queries should complete in <100ms for 10K cards

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           React Component                                   │
│                                                                             │
│   const { rowTree, colTree, isLoading } = useSuperStackData({              │
│     rowFacets: [folder, tags],                                              │
│     colFacets: [year, month],                                               │
│     filters: [...]                                                          │
│   });                                                                       │
│                                                                             │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         useSuperStackData Hook                              │
│                                                                             │
│   1. Build SQL query from facet configs                                     │
│   2. Execute query via useDatabaseService                                   │
│   3. Transform rows → HeaderTree (using buildHeaderTree)                    │
│   4. Return trees + loading state                                           │
│                                                                             │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SQL Query Builder                                  │
│                                                                             │
│   buildHeaderDiscoveryQuery(rowFacets, colFacets, filters)                 │
│                                                                             │
│   SELECT                                                                    │
│     folder,                                                                 │
│     json_each.value AS tags,                                               │
│     strftime('%Y', created_at) AS year,                                    │
│     strftime('%m', created_at) AS month,                                   │
│     COUNT(*) AS card_count                                                 │
│   FROM nodes                                                               │
│   CROSS JOIN json_each(nodes.tags)                                         │
│   WHERE deleted_at IS NULL                                                 │
│   GROUP BY folder, tags, year, month                                       │
│   ORDER BY folder, tags, year, month                                       │
│                                                                             │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SQLite (sql.js)                                │
│                                                                             │
│   nodes table with LATCH columns:                                           │
│   - folder, tags (JSON array), status, priority                            │
│   - created_at, modified_at, due_at                                        │
│   - location_name, latitude, longitude                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. SQL Query Builder

### 1.1 Core Query Builder

```typescript
// src/superstack/queries/header-discovery.ts

import type { FacetConfig, QueryRow } from '../types/superstack';

/**
 * Filter configuration for WHERE clauses
 */
export interface QueryFilter {
  facetId: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'in';
  value: string | number | string[] | [number, number];
}

/**
 * Options for query building
 */
export interface QueryOptions {
  /** Include deleted nodes */
  includeDeleted?: boolean;
  /** Limit results (for performance) */
  limit?: number;
  /** Node types to include */
  nodeTypes?: string[];
}

/**
 * Result of query building - includes SQL and parameter bindings
 */
export interface BuiltQuery {
  sql: string;
  params: (string | number)[];
}

/**
 * Build a SQL query to discover all unique facet combinations with card counts.
 * 
 * This query powers SuperStack header discovery - it returns every unique
 * combination of facet values that exists in the data, along with how many
 * cards match each combination.
 * 
 * @param rowFacets - Facets for row headers (e.g., [folder, tags])
 * @param colFacets - Facets for column headers (e.g., [year, month])
 * @param filters - Optional WHERE clause filters
 * @param options - Query options (limit, includeDeleted, etc.)
 * @returns SQL query string and parameter bindings
 * 
 * @example
 * const { sql, params } = buildHeaderDiscoveryQuery(
 *   [COMMON_FACETS.folder, COMMON_FACETS.tags],
 *   [COMMON_FACETS.year, COMMON_FACETS.month],
 *   [{ facetId: 'folder', operator: 'eq', value: 'Work' }]
 * );
 */
export function buildHeaderDiscoveryQuery(
  rowFacets: FacetConfig[],
  colFacets: FacetConfig[],
  filters: QueryFilter[] = [],
  options: QueryOptions = {}
): BuiltQuery {
  const allFacets = [...rowFacets, ...colFacets];
  const params: (string | number)[] = [];
  
  // Track which facets need special handling
  const hasMultiSelect = allFacets.some(f => f.dataType === 'multi_select');
  const multiSelectFacets = allFacets.filter(f => f.dataType === 'multi_select');
  
  // Build SELECT clause
  const selectClauses = allFacets.map(facet => buildSelectClause(facet));
  selectClauses.push('COUNT(*) AS card_count');
  
  // Build FROM clause with json_each JOINs for multi_select
  let fromClause = 'FROM nodes';
  if (hasMultiSelect) {
    // For each multi_select facet, add a CROSS JOIN json_each
    multiSelectFacets.forEach((facet, index) => {
      const alias = `je${index}`;
      fromClause += `\nCROSS JOIN json_each(nodes.${facet.sourceColumn}) AS ${alias}`;
    });
  }
  
  // Build WHERE clause
  const whereClauses: string[] = [];
  
  if (!options.includeDeleted) {
    whereClauses.push('nodes.deleted_at IS NULL');
  }
  
  if (options.nodeTypes && options.nodeTypes.length > 0) {
    const placeholders = options.nodeTypes.map(() => '?').join(', ');
    whereClauses.push(`nodes.node_type IN (${placeholders})`);
    params.push(...options.nodeTypes);
  }
  
  // Add user filters
  filters.forEach(filter => {
    const { clause, filterParams } = buildFilterClause(filter, allFacets);
    if (clause) {
      whereClauses.push(clause);
      params.push(...filterParams);
    }
  });
  
  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join('\n  AND ')}`
    : '';
  
  // Build GROUP BY clause
  const groupByColumns = allFacets.map(facet => {
    if (facet.dataType === 'multi_select') {
      const index = multiSelectFacets.indexOf(facet);
      return `je${index}.value`;
    }
    if (facet.axis === 'T' && facet.timeFormat) {
      return facet.id; // Use the alias
    }
    return facet.sourceColumn;
  });
  
  // Build ORDER BY clause (same as GROUP BY for consistent ordering)
  const orderByColumns = [...groupByColumns];
  
  // Build HAVING clause (only include non-empty results)
  const havingClause = 'HAVING card_count > 0';
  
  // Build LIMIT clause
  const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
  
  // Assemble final query
  const sql = `
SELECT
  ${selectClauses.join(',\n  ')}
${fromClause}
${whereClause}
GROUP BY ${groupByColumns.join(', ')}
${havingClause}
ORDER BY ${orderByColumns.join(', ')}
${limitClause}
  `.trim();
  
  return { sql, params };
}

/**
 * Build SELECT clause for a single facet
 */
function buildSelectClause(facet: FacetConfig): string {
  // Time facets: extract using strftime
  if (facet.axis === 'T' && facet.timeFormat) {
    return `strftime('${facet.timeFormat}', nodes.${facet.sourceColumn}) AS ${facet.id}`;
  }
  
  // Multi-select facets: value comes from json_each
  if (facet.dataType === 'multi_select') {
    // Note: the actual alias (je0, je1, etc.) is handled in the FROM clause
    // Here we just reference it - this will be coordinated with buildHeaderDiscoveryQuery
    return `json_each.value AS ${facet.id}`;
  }
  
  // Regular facets: direct column reference
  if (facet.sourceColumn === facet.id) {
    return `nodes.${facet.sourceColumn}`;
  }
  return `nodes.${facet.sourceColumn} AS ${facet.id}`;
}

/**
 * Build WHERE clause fragment for a single filter
 */
function buildFilterClause(
  filter: QueryFilter,
  allFacets: FacetConfig[]
): { clause: string; filterParams: (string | number)[] } {
  const facet = allFacets.find(f => f.id === filter.facetId);
  if (!facet) {
    return { clause: '', filterParams: [] };
  }
  
  const column = getFilterColumn(facet);
  const filterParams: (string | number)[] = [];
  let clause = '';
  
  switch (filter.operator) {
    case 'eq':
      clause = `${column} = ?`;
      filterParams.push(filter.value as string | number);
      break;
      
    case 'neq':
      clause = `${column} != ?`;
      filterParams.push(filter.value as string | number);
      break;
      
    case 'contains':
      clause = `${column} LIKE ?`;
      filterParams.push(`%${filter.value}%`);
      break;
      
    case 'gt':
      clause = `${column} > ?`;
      filterParams.push(filter.value as number);
      break;
      
    case 'lt':
      clause = `${column} < ?`;
      filterParams.push(filter.value as number);
      break;
      
    case 'gte':
      clause = `${column} >= ?`;
      filterParams.push(filter.value as number);
      break;
      
    case 'lte':
      clause = `${column} <= ?`;
      filterParams.push(filter.value as number);
      break;
      
    case 'between':
      const [min, max] = filter.value as [number, number];
      clause = `${column} BETWEEN ? AND ?`;
      filterParams.push(min, max);
      break;
      
    case 'in':
      const values = filter.value as string[];
      const placeholders = values.map(() => '?').join(', ');
      clause = `${column} IN (${placeholders})`;
      filterParams.push(...values);
      break;
  }
  
  return { clause, filterParams };
}

/**
 * Get the appropriate column reference for filtering
 */
function getFilterColumn(facet: FacetConfig): string {
  if (facet.axis === 'T' && facet.timeFormat) {
    return `strftime('${facet.timeFormat}', nodes.${facet.sourceColumn})`;
  }
  return `nodes.${facet.sourceColumn}`;
}

/**
 * Build a simplified query for a single axis (row or column only).
 * Useful for getting just row headers or just column headers.
 */
export function buildSingleAxisQuery(
  facets: FacetConfig[],
  filters: QueryFilter[] = [],
  options: QueryOptions = {}
): BuiltQuery {
  return buildHeaderDiscoveryQuery(facets, [], filters, options);
}

/**
 * Build a query to get aggregate statistics for the entire dataset.
 * Useful for density calculations and overview stats.
 */
export function buildAggregateQuery(
  filters: QueryFilter[] = [],
  options: QueryOptions = {}
): BuiltQuery {
  const params: (string | number)[] = [];
  
  const whereClauses: string[] = [];
  if (!options.includeDeleted) {
    whereClauses.push('deleted_at IS NULL');
  }
  
  if (options.nodeTypes && options.nodeTypes.length > 0) {
    const placeholders = options.nodeTypes.map(() => '?').join(', ');
    whereClauses.push(`node_type IN (${placeholders})`);
    params.push(...options.nodeTypes);
  }
  
  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';
  
  const sql = `
SELECT
  COUNT(*) AS total_cards,
  COUNT(DISTINCT folder) AS unique_folders,
  MIN(created_at) AS earliest_date,
  MAX(created_at) AS latest_date,
  AVG(priority) AS avg_priority
FROM nodes
${whereClause}
  `.trim();
  
  return { sql, params };
}
```

### 1.2 Query Builder Utilities

```typescript
// src/superstack/queries/query-utils.ts

import type { FacetConfig } from '../types/superstack';
import { COMMON_FACETS } from '../config/superstack-defaults';

/**
 * Create a time facet chain for common time groupings.
 * Returns facets configured for year → quarter → month → week → day.
 */
export function createTimeFacetChain(
  sourceColumn: string = 'created_at',
  levels: ('year' | 'quarter' | 'month' | 'week' | 'day')[] = ['year', 'month']
): FacetConfig[] {
  const timeFormats: Record<string, string> = {
    year: '%Y',
    quarter: '%Y-Q',  // Will need post-processing
    month: '%m',
    week: '%W',
    day: '%d',
  };
  
  return levels.map(level => ({
    ...COMMON_FACETS[level],
    sourceColumn,
    timeFormat: timeFormats[level],
  }));
}

/**
 * Create category facet chain.
 * Common pattern: folder → tags or folder → status → tags
 */
export function createCategoryFacetChain(
  levels: ('folder' | 'status' | 'tags' | 'type')[] = ['folder', 'tags']
): FacetConfig[] {
  return levels.map(level => COMMON_FACETS[level]);
}

/**
 * Validate that facet configurations are compatible with SQL generation.
 */
export function validateFacetConfigs(facets: FacetConfig[]): string[] {
  const errors: string[] = [];
  
  facets.forEach((facet, index) => {
    if (!facet.id) {
      errors.push(`Facet at index ${index} is missing 'id'`);
    }
    if (!facet.sourceColumn) {
      errors.push(`Facet '${facet.id}' is missing 'sourceColumn'`);
    }
    if (facet.axis === 'T' && !facet.timeFormat) {
      errors.push(`Time facet '${facet.id}' is missing 'timeFormat'`);
    }
  });
  
  // Check for duplicate IDs
  const ids = facets.map(f => f.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    errors.push(`Duplicate facet IDs: ${[...new Set(duplicates)].join(', ')}`);
  }
  
  return errors;
}

/**
 * Estimate query complexity for performance warnings.
 * Returns a score from 1-10 (10 being most complex).
 */
export function estimateQueryComplexity(
  rowFacets: FacetConfig[],
  colFacets: FacetConfig[]
): number {
  let score = 0;
  
  const allFacets = [...rowFacets, ...colFacets];
  
  // Base complexity from facet count
  score += Math.min(allFacets.length, 4);
  
  // Multi-select facets add complexity (json_each joins)
  const multiSelectCount = allFacets.filter(f => f.dataType === 'multi_select').length;
  score += multiSelectCount * 2;
  
  // Time facets with formatting add minor complexity
  const timeCount = allFacets.filter(f => f.axis === 'T').length;
  score += timeCount * 0.5;
  
  return Math.min(Math.round(score), 10);
}
```

---

## 2. React Hook for Data Fetching

```typescript
// src/superstack/hooks/useSuperStackData.ts

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDatabaseService } from '@/hooks/database/useDatabaseService';
import type { FacetConfig, HeaderTree, QueryRow } from '../types/superstack';
import { buildHeaderTree } from '../builders/header-tree-builder';
import {
  buildHeaderDiscoveryQuery,
  QueryFilter,
  QueryOptions,
} from '../queries/header-discovery';

/**
 * Configuration for useSuperStackData hook
 */
export interface SuperStackDataConfig {
  /** Facets for row headers */
  rowFacets: FacetConfig[];
  /** Facets for column headers */
  colFacets: FacetConfig[];
  /** Optional filters to apply */
  filters?: QueryFilter[];
  /** Query options */
  options?: QueryOptions;
  /** Disable auto-fetching (for manual control) */
  enabled?: boolean;
  /** Refetch interval in ms (0 = disabled) */
  refetchInterval?: number;
}

/**
 * Return type for useSuperStackData hook
 */
export interface SuperStackDataResult {
  /** Built row header tree */
  rowTree: HeaderTree | null;
  /** Built column header tree */
  colTree: HeaderTree | null;
  /** Raw query results */
  rows: QueryRow[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => Promise<void>;
  /** Last successful fetch timestamp */
  lastFetched: Date | null;
  /** Query execution time in ms */
  queryTime: number | null;
}

/**
 * React hook for fetching and building SuperStack header data.
 * 
 * Handles:
 * - Building SQL query from facet configurations
 * - Executing query via database service
 * - Transforming results into header trees
 * - Loading and error states
 * - Automatic refetching on config changes
 * 
 * @example
 * ```tsx
 * const { rowTree, colTree, isLoading } = useSuperStackData({
 *   rowFacets: [COMMON_FACETS.folder, COMMON_FACETS.tags],
 *   colFacets: [COMMON_FACETS.year, COMMON_FACETS.month],
 *   filters: [{ facetId: 'folder', operator: 'neq', value: 'Trash' }]
 * });
 * ```
 */
export function useSuperStackData(config: SuperStackDataConfig): SuperStackDataResult {
  const db = useDatabaseService();
  
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [queryTime, setQueryTime] = useState<number | null>(null);
  
  const {
    rowFacets,
    colFacets,
    filters = [],
    options = {},
    enabled = true,
    refetchInterval = 0,
  } = config;
  
  // Build query (memoized to prevent unnecessary rebuilds)
  const query = useMemo(() => {
    if (rowFacets.length === 0 && colFacets.length === 0) {
      return null;
    }
    return buildHeaderDiscoveryQuery(rowFacets, colFacets, filters, options);
  }, [rowFacets, colFacets, filters, options]);
  
  // Fetch data function
  const fetchData = useCallback(async () => {
    if (!query || !db.isReady) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    const startTime = performance.now();
    
    try {
      const result = await db.executeQuery<QueryRow>(query.sql, query.params);
      
      const endTime = performance.now();
      setQueryTime(endTime - startTime);
      
      if (result.success && result.data) {
        setRows(result.data);
        setLastFetched(new Date());
      } else {
        throw new Error(result.error || 'Query failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, db]);
  
  // Fetch on mount and when dependencies change
  useEffect(() => {
    if (enabled && query) {
      fetchData();
    }
  }, [enabled, query, fetchData]);
  
  // Optional refetch interval
  useEffect(() => {
    if (refetchInterval > 0 && enabled) {
      const interval = setInterval(fetchData, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [refetchInterval, enabled, fetchData]);
  
  // Build header trees from rows (memoized)
  const rowTree = useMemo(() => {
    if (rows.length === 0 || rowFacets.length === 0) {
      return null;
    }
    return buildHeaderTree(rows, rowFacets, 'row');
  }, [rows, rowFacets]);
  
  const colTree = useMemo(() => {
    if (rows.length === 0 || colFacets.length === 0) {
      return null;
    }
    return buildHeaderTree(rows, colFacets, 'column');
  }, [rows, colFacets]);
  
  return {
    rowTree,
    colTree,
    rows,
    isLoading,
    error,
    refetch: fetchData,
    lastFetched,
    queryTime,
  };
}

/**
 * Lightweight hook for just row headers (single axis)
 */
export function useRowHeaders(
  facets: FacetConfig[],
  filters: QueryFilter[] = []
): Pick<SuperStackDataResult, 'rowTree' | 'isLoading' | 'error' | 'refetch'> {
  const result = useSuperStackData({
    rowFacets: facets,
    colFacets: [],
    filters,
  });
  
  return {
    rowTree: result.rowTree,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Lightweight hook for just column headers (single axis)
 */
export function useColHeaders(
  facets: FacetConfig[],
  filters: QueryFilter[] = []
): Pick<SuperStackDataResult, 'colTree' | 'isLoading' | 'error' | 'refetch'> {
  const result = useSuperStackData({
    rowFacets: [],
    colFacets: facets,
    filters,
  });
  
  return {
    colTree: result.colTree,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}
```

---

## 3. Integration Tests

```typescript
// src/superstack/__tests__/sql-integration.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import initSqlJs, { Database } from 'sql.js';
import {
  buildHeaderDiscoveryQuery,
  buildAggregateQuery,
} from '../queries/header-discovery';
import { buildHeaderTree } from '../builders/header-tree-builder';
import { COMMON_FACETS } from '../config/superstack-defaults';
import type { FacetConfig, QueryRow } from '../types/superstack';

// Test database setup
let SQL: initSqlJs.SqlJsStatic;
let db: Database;

// Sample data for testing
const SAMPLE_NODES = `
INSERT INTO nodes (id, name, folder, tags, status, priority, created_at, node_type) VALUES
  ('n1', 'Meeting Notes Q1', 'Work', '["#meetings", "#planning"]', 'active', 2, '2024-01-15', 'note'),
  ('n2', 'Project Alpha Plan', 'Work', '["#planning", "#projects"]', 'active', 3, '2024-01-20', 'note'),
  ('n3', 'Weekly Standup', 'Work', '["#meetings"]', 'completed', 1, '2024-02-01', 'note'),
  ('n4', 'Budget Review', 'Work', '["#finance", "#planning"]', 'active', 3, '2024-02-15', 'note'),
  ('n5', 'Team Offsite Ideas', 'Work', '["#ideas", "#team"]', 'active', 2, '2024-03-01', 'note'),
  ('n6', 'Journal Entry 1', 'Personal', '["#journal"]', 'active', 1, '2024-01-05', 'note'),
  ('n7', 'Journal Entry 2', 'Personal', '["#journal"]', 'active', 1, '2024-01-12', 'note'),
  ('n8', 'Journal Entry 3', 'Personal', '["#journal"]', 'active', 1, '2024-02-03', 'note'),
  ('n9', 'Book Notes: Thinking Fast', 'Personal', '["#reading", "#books"]', 'active', 2, '2024-02-10', 'note'),
  ('n10', 'Recipe Ideas', 'Personal', '["#ideas", "#cooking"]', 'active', 1, '2024-03-05', 'note'),
  ('n11', 'Archived Note', 'Archive', '["#old"]', 'archived', 0, '2023-06-01', 'note'),
  ('n12', 'Deleted Note', 'Trash', '["#deleted"]', 'deleted', 0, '2024-01-01', 'note');
`;

const SCHEMA = `
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  folder TEXT,
  tags TEXT,  -- JSON array
  status TEXT,
  priority INTEGER DEFAULT 0,
  created_at TEXT,
  modified_at TEXT,
  deleted_at TEXT,
  node_type TEXT DEFAULT 'note'
);
`;

describe('SuperStack SQL Integration', () => {
  beforeEach(async () => {
    // Initialize sql.js
    SQL = await initSqlJs();
    db = new SQL.Database();
    
    // Create schema and insert sample data
    db.run(SCHEMA);
    db.run(SAMPLE_NODES);
    
    // Mark one as deleted
    db.run("UPDATE nodes SET deleted_at = '2024-01-02' WHERE id = 'n12'");
  });
  
  afterEach(() => {
    db.close();
  });
  
  describe('buildHeaderDiscoveryQuery', () => {
    it('builds valid SQL for folder + tags rows, year + month columns', () => {
      const rowFacets: FacetConfig[] = [COMMON_FACETS.folder, COMMON_FACETS.tags];
      const colFacets: FacetConfig[] = [COMMON_FACETS.year, COMMON_FACETS.month];
      
      const { sql, params } = buildHeaderDiscoveryQuery(rowFacets, colFacets);
      
      // Should be valid SQL
      expect(() => db.prepare(sql)).not.toThrow();
      
      // Should contain expected clauses
      expect(sql).toContain('SELECT');
      expect(sql).toContain('folder');
      expect(sql).toContain('json_each');
      expect(sql).toContain("strftime('%Y'");
      expect(sql).toContain("strftime('%m'");
      expect(sql).toContain('GROUP BY');
      expect(sql).toContain('card_count');
    });
    
    it('executes and returns expected results', () => {
      const rowFacets: FacetConfig[] = [COMMON_FACETS.folder];
      const colFacets: FacetConfig[] = [COMMON_FACETS.year, COMMON_FACETS.month];
      
      const { sql, params } = buildHeaderDiscoveryQuery(rowFacets, colFacets);
      const results = db.exec(sql);
      
      expect(results.length).toBe(1);
      expect(results[0].columns).toContain('folder');
      expect(results[0].columns).toContain('year');
      expect(results[0].columns).toContain('month');
      expect(results[0].columns).toContain('card_count');
      
      // Should have multiple rows
      expect(results[0].values.length).toBeGreaterThan(0);
    });
    
    it('excludes deleted nodes by default', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder],
        []
      );
      
      const results = db.exec(sql);
      const folders = results[0].values.map(row => row[0]);
      
      // Trash folder should not appear (deleted_at is set)
      // But Archive should appear
      expect(folders).toContain('Archive');
      expect(folders).not.toContain('Trash');
    });
    
    it('includes deleted nodes when requested', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder],
        [],
        [],
        { includeDeleted: true }
      );
      
      const results = db.exec(sql);
      const folders = results[0].values.map(row => row[0]);
      
      expect(folders).toContain('Trash');
    });
    
    it('handles multi_select facets with json_each', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder, COMMON_FACETS.tags],
        []
      );
      
      const results = db.exec(sql);
      
      // Should have exploded tags
      const tags = results[0].values.map(row => row[1]); // tags is second column
      expect(tags).toContain('#meetings');
      expect(tags).toContain('#planning');
      expect(tags).toContain('#journal');
    });
    
    it('applies filters correctly', () => {
      const { sql, params } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder],
        [],
        [{ facetId: 'folder', operator: 'eq', value: 'Work' }]
      );
      
      // Execute with params
      const stmt = db.prepare(sql);
      stmt.bind(params);
      
      const rows: string[][] = [];
      while (stmt.step()) {
        rows.push(stmt.get() as string[]);
      }
      stmt.free();
      
      // Should only have Work folder
      expect(rows.length).toBe(1);
      expect(rows[0][0]).toBe('Work');
    });
    
    it('returns correct card counts', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder],
        []
      );
      
      const results = db.exec(sql);
      const columns = results[0].columns;
      const cardCountIndex = columns.indexOf('card_count');
      
      // Find Work folder count
      const workRow = results[0].values.find(row => row[0] === 'Work');
      const personalRow = results[0].values.find(row => row[0] === 'Personal');
      
      // Work has 5 nodes, Personal has 5 nodes (excluding deleted)
      expect(workRow?.[cardCountIndex]).toBe(5);
      expect(personalRow?.[cardCountIndex]).toBe(5);
    });
  });
  
  describe('buildHeaderTree with SQL results', () => {
    it('builds correct tree from SQL results', () => {
      const rowFacets: FacetConfig[] = [COMMON_FACETS.folder, COMMON_FACETS.tags];
      const { sql } = buildHeaderDiscoveryQuery(rowFacets, []);
      
      const results = db.exec(sql);
      const columns = results[0].columns;
      
      // Convert to QueryRow format
      const rows: QueryRow[] = results[0].values.map(row => {
        const obj: QueryRow = { card_count: 0 };
        columns.forEach((col, i) => {
          obj[col] = row[i] as string | number;
        });
        return obj;
      });
      
      const tree = buildHeaderTree(rows, rowFacets, 'row');
      
      // Should have folder roots
      expect(tree.roots.length).toBeGreaterThan(0);
      expect(tree.roots.some(r => r.value === 'Work')).toBe(true);
      expect(tree.roots.some(r => r.value === 'Personal')).toBe(true);
      
      // Work folder should have tag children
      const workNode = tree.roots.find(r => r.value === 'Work');
      expect(workNode?.children.length).toBeGreaterThan(0);
      expect(workNode?.children.some(c => c.value === '#meetings')).toBe(true);
    });
    
    it('calculates spans correctly from SQL data', () => {
      const rowFacets: FacetConfig[] = [COMMON_FACETS.folder, COMMON_FACETS.tags];
      const { sql } = buildHeaderDiscoveryQuery(rowFacets, []);
      
      const results = db.exec(sql);
      const columns = results[0].columns;
      
      const rows: QueryRow[] = results[0].values.map(row => {
        const obj: QueryRow = { card_count: 0 };
        columns.forEach((col, i) => {
          obj[col] = row[i] as string | number;
        });
        return obj;
      });
      
      const tree = buildHeaderTree(rows, rowFacets, 'row');
      
      // Parent span should equal sum of children
      tree.roots.forEach(root => {
        if (root.children.length > 0) {
          const childSpanSum = root.children.reduce((sum, c) => sum + c.span, 0);
          expect(root.span).toBe(childSpanSum);
        }
      });
    });
    
    it('accumulates counts correctly from SQL data', () => {
      const rowFacets: FacetConfig[] = [COMMON_FACETS.folder];
      const { sql } = buildHeaderDiscoveryQuery(rowFacets, []);
      
      const results = db.exec(sql);
      const columns = results[0].columns;
      
      const rows: QueryRow[] = results[0].values.map(row => {
        const obj: QueryRow = { card_count: 0 };
        columns.forEach((col, i) => {
          obj[col] = row[i] as string | number;
        });
        return obj;
      });
      
      const tree = buildHeaderTree(rows, rowFacets, 'row');
      
      const workNode = tree.roots.find(r => r.value === 'Work');
      const personalNode = tree.roots.find(r => r.value === 'Personal');
      
      expect(workNode?.aggregate?.count).toBe(5);
      expect(personalNode?.aggregate?.count).toBe(5);
    });
  });
  
  describe('Time facet extraction', () => {
    it('extracts year correctly', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [],
        [COMMON_FACETS.year]
      );
      
      const results = db.exec(sql);
      const years = results[0].values.map(row => row[0]);
      
      expect(years).toContain('2024');
      expect(years).toContain('2023'); // Archive note
    });
    
    it('extracts month correctly', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [],
        [COMMON_FACETS.year, COMMON_FACETS.month]
      );
      
      const results = db.exec(sql);
      const columns = results[0].columns;
      const monthIndex = columns.indexOf('month');
      
      const months = [...new Set(results[0].values.map(row => row[monthIndex]))];
      
      expect(months).toContain('01'); // January
      expect(months).toContain('02'); // February
      expect(months).toContain('03'); // March
    });
  });
  
  describe('Performance', () => {
    it('completes query in reasonable time', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder, COMMON_FACETS.tags],
        [COMMON_FACETS.year, COMMON_FACETS.month]
      );
      
      const start = performance.now();
      db.exec(sql);
      const duration = performance.now() - start;
      
      // Should complete in under 100ms (generous for small dataset)
      expect(duration).toBeLessThan(100);
    });
  });
  
  describe('buildAggregateQuery', () => {
    it('returns correct aggregate stats', () => {
      const { sql } = buildAggregateQuery();
      
      const results = db.exec(sql);
      const columns = results[0].columns;
      const row = results[0].values[0];
      
      const stats: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        stats[col] = row[i];
      });
      
      // Should have 11 active nodes (12 total - 1 deleted)
      expect(stats.total_cards).toBe(11);
      expect(stats.unique_folders).toBe(3); // Work, Personal, Archive
    });
  });
});
```

---

## 4. Demo Component

```typescript
// src/superstack/demos/SuperStackDemo.tsx

import React, { useRef, useEffect, useState } from 'react';
import { useSuperStackData } from '../hooks/useSuperStackData';
import { SuperStackRenderer } from '../renderers/superstack-renderer';
import { COMMON_FACETS, DEFAULT_DIMENSIONS } from '../config/superstack-defaults';
import { recalculateTree } from '../builders/header-tree-builder';
import type { HeaderNode } from '../types/superstack';
import '../styles/superstack.css';

/**
 * Demo component showing SuperStack with live SQL data.
 * 
 * Demonstrates:
 * - Fetching data via useSuperStackData hook
 * - Rendering with SuperStackRenderer
 * - Collapse/expand interactions
 * - Click-to-filter (logs to console)
 */
export function SuperStackDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SuperStackRenderer | null>(null);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Fetch data with folder→tags rows and year→month columns
  const { rowTree, colTree, isLoading, error, queryTime, refetch } = useSuperStackData({
    rowFacets: [COMMON_FACETS.folder, COMMON_FACETS.tags],
    colFacets: [COMMON_FACETS.year, COMMON_FACETS.month],
    filters: [
      // Exclude archived items
      { facetId: 'status', operator: 'neq', value: 'archived' }
    ]
  });
  
  // Initialize renderer
  useEffect(() => {
    if (containerRef.current && !rendererRef.current) {
      rendererRef.current = new SuperStackRenderer(
        containerRef.current,
        DEFAULT_DIMENSIONS
      );
      
      // Set up callbacks
      rendererRef.current.setCallbacks({
        onHeaderClick: handleHeaderClick,
        onHeaderCollapse: handleHeaderCollapse,
      });
    }
    
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);
  
  // Render when data changes
  useEffect(() => {
    if (rendererRef.current && rowTree && colTree) {
      rendererRef.current.render(rowTree, colTree);
    }
  }, [rowTree, colTree]);
  
  // Update selection visual
  useEffect(() => {
    rendererRef.current?.setSelected(selectedId);
  }, [selectedId]);
  
  // Handle header click (for filtering)
  const handleHeaderClick = (node: HeaderNode) => {
    console.log('Header clicked:', {
      value: node.value,
      path: node.path,
      count: node.aggregate?.count,
    });
    setSelectedId(node.id);
  };
  
  // Handle collapse/expand
  const handleHeaderCollapse = (node: HeaderNode) => {
    console.log('Toggle collapse:', node.value, '→', !node.collapsed);
    
    // Toggle and recalculate
    node.collapsed = !node.collapsed;
    
    if (rowTree && node.path[0] && rowTree.roots.some(r => r.id === node.id || r.children.some(c => c.id === node.id))) {
      recalculateTree(rowTree);
    }
    if (colTree && colTree.roots.some(r => r.id === node.id || r.children.some(c => c.id === node.id))) {
      recalculateTree(colTree);
    }
    
    // Re-render
    if (rendererRef.current && rowTree && colTree) {
      rendererRef.current.render(rowTree, colTree);
    }
  };
  
  return (
    <div className="superstack-demo">
      <div className="superstack-demo__header">
        <h2>SuperStack Demo</h2>
        <div className="superstack-demo__stats">
          {isLoading && <span>Loading...</span>}
          {error && <span className="error">Error: {error.message}</span>}
          {queryTime !== null && (
            <span>Query time: {queryTime.toFixed(1)}ms</span>
          )}
          {rowTree && (
            <span>
              Rows: {rowTree.leafCount} | 
              Cols: {colTree?.leafCount || 0}
            </span>
          )}
          <button onClick={refetch}>Refresh</button>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="superstack-demo__container"
        style={{ minHeight: 400, border: '1px solid #ddd' }}
      />
      
      {selectedId && (
        <div className="superstack-demo__selection">
          Selected: {selectedId}
        </div>
      )}
    </div>
  );
}
```

---

## 5. Updated Exports

```typescript
// src/superstack/index.ts (updated)

/**
 * SuperStack Public API
 *
 * SuperStack is the nested header system that transforms SuperGrid
 * from a flat grid into a true dimensional pivot table.
 */

// Types
export type {
  FacetConfig,
  HeaderAggregate,
  HeaderNode,
  HeaderTree,
  QueryRow,
  SuperStackCallbacks,
  SuperStackDimensions,
  SuperStackState,
} from './types/superstack';

// Configuration
export {
  COMMON_FACETS,
  DEFAULT_DIMENSIONS,
  formatLabel,
  getHeaderColor,
  HEADER_COLORS,
  MONTH_NAMES,
} from './config/superstack-defaults';

// Builders
export {
  buildHeaderTree,
  findNodeById,
  flattenTree,
  recalculateTree,
} from './builders/header-tree-builder';

// Queries (NEW in Phase 2)
export {
  buildHeaderDiscoveryQuery,
  buildSingleAxisQuery,
  buildAggregateQuery,
  type QueryFilter,
  type QueryOptions,
  type BuiltQuery,
} from './queries/header-discovery';

export {
  createTimeFacetChain,
  createCategoryFacetChain,
  validateFacetConfigs,
  estimateQueryComplexity,
} from './queries/query-utils';

// Hooks (NEW in Phase 2)
export {
  useSuperStackData,
  useRowHeaders,
  useColHeaders,
  type SuperStackDataConfig,
  type SuperStackDataResult,
} from './hooks/useSuperStackData';

// Renderers
export { SuperStackRenderer } from './renderers/superstack-renderer';

// Styles (import for side effects)
import './styles/superstack.css';
```

---

## 6. File Structure Update

```
src/superstack/
├── __tests__/
│   ├── header-tree-builder.test.ts     # Phase 1 ✅
│   └── sql-integration.test.ts         # Phase 2 NEW
│
├── builders/
│   └── header-tree-builder.ts          # Phase 1 ✅
│
├── config/
│   └── superstack-defaults.ts          # Phase 1 ✅
│
├── demos/                              # Phase 2 NEW
│   └── SuperStackDemo.tsx
│
├── hooks/                              # Phase 2 NEW
│   └── useSuperStackData.ts
│
├── queries/                            # Phase 2 NEW
│   ├── header-discovery.ts
│   └── query-utils.ts
│
├── renderers/
│   └── superstack-renderer.ts          # Phase 1 ✅
│
├── styles/
│   └── superstack.css                  # Phase 1 ✅
│
├── types/
│   └── superstack.ts                   # Phase 1 ✅
│
└── index.ts                            # Updated exports
```

---

## 7. Success Criteria

### Phase 2 Complete When:

| Criterion | Verification |
|-----------|--------------|
| SQL query builds correctly for folder + tags rows | Unit test passes |
| SQL query builds correctly for year + month columns | Unit test passes |
| Multi-select facets (tags) explode via json_each | Integration test passes |
| Time facets extract correctly via strftime | Integration test passes |
| Deleted nodes excluded by default | Integration test passes |
| Filters apply correctly | Integration test passes |
| Card counts are accurate | Integration test passes |
| Trees build correctly from SQL results | Integration test passes |
| Query completes in <100ms | Performance test passes |
| useSuperStackData hook works | Demo component renders |
| Demo shows live data | Manual verification |

### Test Commands

```bash
# Run Phase 2 tests
npm test -- --run src/superstack/__tests__/sql-integration.test.ts

# Run all SuperStack tests
npm test -- --run src/superstack

# Run with coverage
npm test -- --run --coverage src/superstack
```

---

## 8. Implementation Order

1. **Create query files first** (can be tested in isolation)
   - `queries/header-discovery.ts`
   - `queries/query-utils.ts`

2. **Add SQL integration tests** (verify queries work)
   - `__tests__/sql-integration.test.ts`

3. **Create React hook** (depends on queries)
   - `hooks/useSuperStackData.ts`

4. **Create demo component** (depends on hook + renderer)
   - `demos/SuperStackDemo.tsx`

5. **Update exports**
   - `index.ts`

---

## Appendix: Example Query Output

For `rowFacets: [folder, tags]` and `colFacets: [year, month]`:

```sql
SELECT
  nodes.folder,
  je0.value AS tags,
  strftime('%Y', nodes.created_at) AS year,
  strftime('%m', nodes.created_at) AS month,
  COUNT(*) AS card_count
FROM nodes
CROSS JOIN json_each(nodes.tags) AS je0
WHERE nodes.deleted_at IS NULL
GROUP BY folder, je0.value, year, month
HAVING card_count > 0
ORDER BY folder, je0.value, year, month
```

Result:
```
folder   | tags       | year | month | card_count
---------|------------|------|-------|------------
Personal | #books     | 2024 | 02    | 1
Personal | #cooking   | 2024 | 03    | 1
Personal | #ideas     | 2024 | 03    | 1
Personal | #journal   | 2024 | 01    | 2
Personal | #journal   | 2024 | 02    | 1
Personal | #reading   | 2024 | 02    | 1
Work     | #finance   | 2024 | 02    | 1
Work     | #ideas     | 2024 | 03    | 1
Work     | #meetings  | 2024 | 01    | 1
Work     | #meetings  | 2024 | 02    | 1
Work     | #planning  | 2024 | 01    | 2
Work     | #planning  | 2024 | 02    | 1
Work     | #projects  | 2024 | 01    | 1
Work     | #team      | 2024 | 03    | 1
```

This feeds directly into `buildHeaderTree()` to create the nested header structures.

---

*End of Phase 2 Implementation Plan*
