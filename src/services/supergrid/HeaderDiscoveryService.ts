/**
 * Header Discovery Service
 *
 * Service layer for executing SQL header discovery queries and transforming results
 * into HeaderNode trees. Manages query execution lifecycle and handles edge cases:
 * - Empty datasets (SQL-05): Returns empty HeaderTree with leafCount=0
 * - Loading state (SQL-04): Managed by useHeaderDiscovery hook
 * - Query errors: Returns null and logs error
 *
 * Phase 90-02: Tree Builder from Query Results
 */

import type { Database } from 'sql.js';
import type {
  FacetConfig,
  HeaderTree,
  QueryRow,
} from '../../superstack/types/superstack';
import {
  buildHeaderDiscoveryQuery,
  buildStackedHeaderQuery,
} from '../../db/queries/header-discovery';
import { buildHeaderTree } from '../../superstack/builders/header-tree-builder';

/**
 * Result type for header discovery with loading/error state.
 */
export interface HeaderDiscoveryResult {
  columnTree: HeaderTree | null;
  rowTree: HeaderTree | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Service for SQL-driven header discovery.
 * Executes queries and transforms results into HeaderTree structures.
 */
export class HeaderDiscoveryService {
  private db: Database | null = null;

  /**
   * Set the active database instance.
   */
  setDatabase(db: Database | null): void {
    this.db = db;
  }

  /**
   * Discover headers for given axis facets.
   * Executes SQL query and transforms results into HeaderTree.
   *
   * @param facets - Ordered facet configurations (outermost first)
   * @param axis - 'row' or 'column' for tree orientation
   * @returns HeaderTree or null if database unavailable or query fails
   */
  discoverHeaders(
    facets: FacetConfig[],
    axis: 'row' | 'column'
  ): HeaderTree | null {
    if (!this.db || facets.length === 0) {
      return null;
    }

    try {
      // Generate SQL query based on facet count
      const sql =
        facets.length === 1
          ? buildHeaderDiscoveryQuery(facets[0])
          : buildStackedHeaderQuery(facets);

      // Execute query (synchronous with sql.js)
      const result = this.db.exec(sql);

      // Empty dataset handling (SQL-05)
      if (!result[0] || result[0].values.length === 0) {
        return this.createEmptyTree(facets, axis);
      }

      // Transform SQL results to QueryRow format
      const rows: QueryRow[] = this.transformSqlResults(result[0], facets);

      // Build header tree from rows
      return buildHeaderTree(rows, facets, axis);
    } catch (error) {
      console.error('[HeaderDiscoveryService] Query failed:', error);
      return null;
    }
  }

  /**
   * Create empty header tree for empty datasets (SQL-05).
   * Returns valid tree structure with no data, not null.
   */
  private createEmptyTree(
    facets: FacetConfig[],
    axis: 'row' | 'column'
  ): HeaderTree {
    return {
      axis,
      facets,
      roots: [],
      maxDepth: facets.length,
      leafCount: 0,
      leaves: [],
    };
  }

  /**
   * Transform sql.js results to QueryRow array.
   * Maps column names to facet IDs and ensures card_count is numeric.
   *
   * @param result - sql.js query result with columns and values
   * @param facets - Facet configurations for mapping columns
   * @returns Array of QueryRow objects for tree building
   */
  private transformSqlResults(
    result: { columns: string[]; values: unknown[][] },
    facets: FacetConfig[]
  ): QueryRow[] {
    return result.values.map((row) => {
      const queryRow: QueryRow = { card_count: 0 };

      result.columns.forEach((col, index) => {
        if (col === 'card_count') {
          queryRow.card_count = Number(row[index]);
        } else {
          // Map column to facet id
          // Try multiple matching strategies:
          // 1. Exact column match to facet.id
          // 2. Column matches facet.sourceColumn
          // 3. Column is 'value' (single-facet query)
          // 4. Column matches facet alias pattern (facet_N)
          const facetMatch =
            facets.find((f) => f.id === col) ||
            facets.find((f) => f.sourceColumn === col) ||
            (col === 'value' ? facets[0] : null) ||
            (col.startsWith('facet_')
              ? facets[parseInt(col.replace('facet_', ''), 10)]
              : null);

          if (facetMatch) {
            queryRow[facetMatch.id] = String(row[index] ?? '');
          } else {
            // Fallback: use column name directly
            queryRow[col] = String(row[index] ?? '');
          }
        }
      });

      return queryRow;
    });
  }
}

/**
 * Singleton instance for global use.
 */
export const headerDiscoveryService = new HeaderDiscoveryService();
