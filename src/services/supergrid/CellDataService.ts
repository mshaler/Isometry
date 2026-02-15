/**
 * CellDataService - Transform SQL query results into DataCellData for D3 rendering
 *
 * Part of Phase 92 - Data Cell Integration
 * Handles transformation from SQLite rows to grid cell coordinates
 */

import * as d3 from 'd3';
import type { Node } from '@/types/node';
import type { DataCellData, PAFVProjection } from '@/types/grid';

/**
 * Service for transforming SQL results into cell data with logical coordinates
 */
export class CellDataService {
  /**
   * Transform raw SQL rows into DataCellData with logical grid coordinates
   *
   * @param rows - Raw SQL query results (nodes with properties)
   * @param projection - PAFV projection configuration (defines x/y axis facets)
   * @returns Array of DataCellData with logicalX/logicalY positions
   */
  transformToCellData(
    rows: Node[],
    projection: PAFVProjection
  ): DataCellData[] {
    if (!rows || rows.length === 0) {
      return [];
    }

    // Extract facet column names from projection
    const xFacet = projection.xAxis?.facet;
    const yFacet = projection.yAxis?.facet;

    if (!xFacet || !yFacet) {
      // No projection configured - return empty array
      return [];
    }

    // Build value-to-index maps for both axes
    const xValueMap = this.buildValueMap(rows, xFacet);
    const yValueMap = this.buildValueMap(rows, yFacet);

    // Transform each row to DataCellData
    const cells: DataCellData[] = rows.map((node) => {
      // Get facet values from the node
      const xValue = this.getFacetValue(node, xFacet);
      const yValue = this.getFacetValue(node, yFacet);

      // Map to logical coordinates
      const logicalX = xValueMap.get(xValue) ?? 0;
      const logicalY = yValueMap.get(yValue) ?? 0;

      return {
        id: node.id,
        node,
        logicalX,
        logicalY,
        value: node.name || '', // Display text defaults to node name
      };
    });

    return cells;
  }

  /**
   * Build a map from unique facet values to their index positions
   *
   * @param rows - Source data
   * @param facet - Facet column name (e.g., 'folder', 'status', 'created_at')
   * @returns Map from value to index (sorted order)
   */
  private buildValueMap(rows: Node[], facet: string): Map<string, number> {
    // Extract unique values
    const uniqueValues = new Set<string>();
    rows.forEach((node) => {
      const value = this.getFacetValue(node, facet);
      uniqueValues.add(value);
    });

    // Sort values alphabetically (basic sort - will be enhanced in Plan 92-02)
    const sortedValues = Array.from(uniqueValues).sort();

    // Build index map
    const valueMap = new Map<string, number>();
    sortedValues.forEach((value, index) => {
      valueMap.set(value, index);
    });

    return valueMap;
  }

  /**
   * Extract facet value from a node
   *
   * Handles both direct properties (node.folder) and nested properties
   *
   * @param node - The node to extract from
   * @param facet - Facet column name
   * @returns String representation of the value
   */
  private getFacetValue(node: Node, facet: string): string {
    // Get the raw value from the node using unknown cast for dynamic property access
    const rawValue = (node as unknown as Record<string, unknown>)[facet];

    // Convert to string
    if (rawValue === null || rawValue === undefined) {
      return '(none)'; // Placeholder for null/undefined values
    }

    if (typeof rawValue === 'string') {
      return rawValue;
    }

    if (typeof rawValue === 'number') {
      return rawValue.toString();
    }

    if (rawValue instanceof Date) {
      return rawValue.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    // Fallback for other types
    return String(rawValue);
  }

  /**
   * Aggregate cells by position for dense mode rendering
   *
   * When valueDensity is 'collapsed', multiple cells at the same logical position
   * are aggregated into a single cell with count badge.
   *
   * @param cells - Array of individual data cells
   * @returns Array of aggregated cells with sourceNodes and aggregationCount
   */
  aggregateCellsByPosition(cells: DataCellData[]): DataCellData[] {
    if (!cells || cells.length === 0) {
      return [];
    }

    // Group cells by (logicalX, logicalY) position using d3.group
    const groupedByPosition = d3.group(
      cells,
      (d) => d.logicalX,
      (d) => d.logicalY
    );

    const aggregatedCells: DataCellData[] = [];

    // Convert groups to aggregated cells
    groupedByPosition.forEach((yGroups, logicalX) => {
      yGroups.forEach((cellsAtPosition, logicalY) => {
        if (cellsAtPosition.length === 1) {
          // Single cell - no aggregation needed
          aggregatedCells.push(cellsAtPosition[0]);
        } else {
          // Multiple cells - aggregate
          const sourceNodes = cellsAtPosition.map((c) => c.node);
          const aggregatedCell: DataCellData = {
            id: `aggregated-${logicalX}-${logicalY}`,
            node: cellsAtPosition[0].node, // Primary node (first)
            logicalX,
            logicalY,
            value: `${cellsAtPosition.length} items`, // Count as display value
            aggregationCount: cellsAtPosition.length,
            sourceNodes,
          };
          aggregatedCells.push(aggregatedCell);
        }
      });
    });

    return aggregatedCells;
  }
}

/**
 * Standalone transform function for simple usage
 *
 * @param rows - Raw SQL query results
 * @param projection - PAFV projection configuration
 * @returns Array of DataCellData
 */
export function transformToCellData(
  rows: Node[],
  projection: PAFVProjection
): DataCellData[] {
  const service = new CellDataService();
  return service.transformToCellData(rows, projection);
}
