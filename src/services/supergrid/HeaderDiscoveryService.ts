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
import { superGridLogger } from '../../utils/dev-logger';

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
   * @param nodeType - Optional node_type filter for schema-on-read
   * @returns HeaderTree or null if database unavailable or query fails
   */
  discoverHeaders(
    facets: FacetConfig[],
    axis: 'row' | 'column',
    nodeType?: string
  ): HeaderTree | null {
    if (!this.db || facets.length === 0) {
      superGridLogger.debug(`discoverHeaders(${axis}): no db or empty facets`);
      return null;
    }

    superGridLogger.debug(`discoverHeaders(${axis}):`, {
      facetCount: facets.length,
      facetIds: facets.map(f => f.id),
      facetsWithPathSep: facets.filter(f => f.pathSeparator).map(f => ({ id: f.id, pathSeparator: f.pathSeparator })),
    });

    try {
      // Generate SQL query with ORIGINAL facets to get actual data combinations
      const sql =
        facets.length === 1
          ? buildHeaderDiscoveryQuery(facets[0], nodeType)
          : buildStackedHeaderQuery(facets, nodeType);

      superGridLogger.debug('SQL query:', sql);

      // Execute query (synchronous with sql.js)
      const result = this.db.exec(sql);

      // Empty dataset handling (SQL-05)
      if (!result[0] || result[0].values.length === 0) {
        return this.createEmptyTree(facets, axis);
      }

      // Transform SQL results to QueryRow format
      let rows: QueryRow[] = this.transformSqlResults(result[0], facets);

      superGridLogger.debug(`SQL returned ${rows.length} rows`, { firstRow: rows[0] });

      // Check if any facet uses path separator - expand AFTER getting real data
      // pathLevel facets extract a single level, pathSeparator (without pathLevel) expand to hierarchy
      const pathFacetIndex = facets.findIndex(f => f.pathSeparator && f.pathLevel === undefined);
      const pathLevelFacetIndex = facets.findIndex(f => f.pathSeparator && f.pathLevel !== undefined);
      let finalFacets = facets;

      // Handle pathLevel facets first (extract single level, e.g., subfolder)
      if (pathLevelFacetIndex >= 0) {
        const pathLevelFacet = facets[pathLevelFacetIndex];
        superGridLogger.debug(`Post-processing path level extraction for "${pathLevelFacet.id}" at level ${pathLevelFacet.pathLevel}`);
        rows = this.extractPathLevelInRows(rows, pathLevelFacet);
      }

      // Then handle full path expansion facets
      if (pathFacetIndex >= 0) {
        const pathFacet = facets[pathFacetIndex];
        superGridLogger.debug(`Post-processing path expansion for "${pathFacet.id}"`);
        const expansion = this.expandPathsInRows(rows, facets, pathFacetIndex);
        rows = expansion.rows;
        finalFacets = expansion.facets;
        superGridLogger.debug('Path expansion complete', {
          rowCount: rows.length,
          facetCount: finalFacets.length,
          facetIds: finalFacets.map(f => f.id),
          sampleRow: rows[0]
        });
      }

      // Build header tree from rows
      return buildHeaderTree(rows, finalFacets, axis);
    } catch (error) {
      console.error('[HeaderDiscoveryService] Query failed:', error);
      return null;
    }
  }

  /**
   * Extract a specific path level from rows.
   * For subfolder (pathLevel=1), extracts "Child" from "Parent/Child".
   *
   * @param rows - Query rows with full path values
   * @param facet - Facet with pathLevel specified
   * @returns Transformed rows with extracted path level values
   */
  private extractPathLevelInRows(
    rows: QueryRow[],
    facet: FacetConfig
  ): QueryRow[] {
    const separator = facet.pathSeparator!;
    const level = facet.pathLevel!;

    return rows.map(row => {
      const value = String(row[facet.sourceColumn] ?? '');
      const segments = value.split(separator).filter(s => s.length > 0);

      // Extract the specified level, or empty string if path is too short
      const extractedValue = segments[level] ?? '';

      // Create new row with extracted value in the facet's id column
      const newRow: QueryRow = { ...row };
      newRow[facet.id] = extractedValue;

      return newRow;
    }).filter(row => {
      // Filter out rows where the extracted level is empty
      // (paths that don't have that level)
      const value = row[facet.id];
      return value !== '' && value !== undefined;
    });
  }

  /**
   * Expand path values in rows into multiple level columns.
   * Called AFTER fetching real data to preserve actual combinations.
   *
   * For example, a row with { folder: "BairesDev/MSFT", tags: "Stacey", card_count: 5 }
   * becomes { folder_level_0: "BairesDev", folder_level_1: "MSFT", tags: "Stacey", card_count: 5 }
   *
   * @param rows - Query rows with full path values
   * @param facets - Original facet array
   * @param pathFacetIndex - Index of the path-based facet to expand
   * @returns Object with expanded rows and facets
   */
  private expandPathsInRows(
    rows: QueryRow[],
    facets: FacetConfig[],
    pathFacetIndex: number
  ): { facets: FacetConfig[]; rows: QueryRow[] } {
    const pathFacet = facets[pathFacetIndex];
    const separator = pathFacet.pathSeparator!;
    const maxDepth = pathFacet.maxPathDepth ?? 10;

    if (rows.length === 0) {
      return { facets, rows: [] };
    }

    // Find the maximum depth across all rows
    let actualMaxDepth = 1;
    for (const row of rows) {
      const value = String(row[pathFacet.id] ?? '');
      const segments = value.split(separator).filter(s => s.length > 0);
      actualMaxDepth = Math.max(actualMaxDepth, Math.min(segments.length, maxDepth));
    }

    // Create synthetic facets for each path level with user-friendly names
    // Level 0: "Folder", Level 1: "Subfolder", Level 2+: "Subfolder N"
    const syntheticFacets: FacetConfig[] = [];
    for (let i = 0; i < actualMaxDepth; i++) {
      let levelName: string;
      if (i === 0) {
        levelName = pathFacet.name;
      } else if (i === 1) {
        levelName = `Sub${pathFacet.name.toLowerCase()}`;
      } else {
        levelName = `Sub${pathFacet.name.toLowerCase()} ${i}`;
      }
      syntheticFacets.push({
        ...pathFacet,
        id: `${pathFacet.id}_level_${i}`,
        name: levelName,
        pathSeparator: undefined, // Clear to avoid nested expansion
      });
    }

    // Build expanded facets array: replace original path facet with synthetic facets
    const expandedFacets: FacetConfig[] = [
      ...facets.slice(0, pathFacetIndex),
      ...syntheticFacets,
      ...facets.slice(pathFacetIndex + 1),
    ];

    // Transform rows: split path values into levels, keep all other fields
    const expandedRows: QueryRow[] = rows.map(row => {
      const value = String(row[pathFacet.id] ?? '');
      const segments = value.split(separator).filter(s => s.length > 0);

      // Create new row with all non-path fields preserved
      const expandedRow: QueryRow = { card_count: row.card_count };

      // Copy all non-path-facet fields (like tags)
      for (const key of Object.keys(row)) {
        if (key !== pathFacet.id && key !== 'card_count') {
          expandedRow[key] = row[key];
        }
      }

      // Add split path values for each level
      // Use empty string for levels beyond the path's actual depth (leaf indicator)
      for (let i = 0; i < actualMaxDepth; i++) {
        const segmentValue = segments[i] ?? '';
        expandedRow[syntheticFacets[i].id] = segmentValue;
      }

      return expandedRow;
    });

    superGridLogger.debug('expandPathsInRows', {
      pathFacetId: pathFacet.id,
      separator,
      actualMaxDepth,
      inputRowCount: rows.length,
      outputRowCount: expandedRows.length,
      syntheticFacetIds: syntheticFacets.map(f => f.id),
      sampleInput: rows.slice(0, 2),
      sampleOutput: expandedRows.slice(0, 2),
    });

    return { facets: expandedFacets, rows: expandedRows };
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
