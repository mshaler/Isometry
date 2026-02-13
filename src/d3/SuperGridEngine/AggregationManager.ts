/**
 * AggregationManager - Generates aggregation row for SuperGrid
 *
 * Creates SuperCards at the bottom of the grid showing column counts,
 * sums, or averages. The rightmost cell shows the grand total.
 *
 * Key Behaviors:
 * - One aggregation cell per column
 * - Count values match sum of nodeCount in each column
 * - Total cell in rightmost position
 * - Fixed 32px row height
 * - Configurable aggregation type (count, sum, avg)
 */

import type { CellDescriptor, HeaderDescriptor } from './types';
import type { SuperCard, AggregationType } from './SuperCardRenderer';
import { AGGREGATION_STYLE } from './SuperCardRenderer';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for aggregation row behavior
 */
export interface AggregationConfig {
  /** Type of aggregation to compute */
  type: AggregationType;
  /** Whether aggregation row is enabled */
  enabled: boolean;
}

// ============================================================================
// AggregationManager Class
// ============================================================================

/**
 * AggregationManager - Generates aggregation row SuperCards
 *
 * Responsibilities:
 * - Group cells by column
 * - Calculate count/sum/avg per column
 * - Generate SuperCard array for aggregation row
 * - Position total cell in rightmost column
 */
export class AggregationManager {
  private config: AggregationConfig = {
    type: 'count',
    enabled: true,
  };

  /**
   * Generate aggregation row SuperCards
   *
   * @param cells - All data cells in the grid
   * @param headers - Column headers for width calculation
   * @returns Array of SuperCards for the aggregation row
   */
  generateAggregationRow(
    cells: CellDescriptor[],
    headers: HeaderDescriptor[]
  ): SuperCard[] {
    if (!this.config.enabled) {
      return [];
    }

    const aggregationCards: SuperCard[] = [];

    // Calculate the row position (one below the last data row)
    const maxGridY = cells.length > 0
      ? Math.max(...cells.map(c => c.gridY)) + 1
      : 0;

    // Group cells by column
    const columnGroups = this.groupByColumn(cells);

    // Create aggregation cell for each column
    for (const header of headers) {
      const gridX = header.startIndex;
      const columnCells = columnGroups.get(gridX) || [];
      const count = columnCells.reduce((sum, c) => sum + c.nodeCount, 0);

      aggregationCards.push({
        id: `agg-${gridX}`,
        type: 'aggregation',
        aggregationType: this.config.type,
        aggregationValue: count,
        gridX,
        gridY: maxGridY,
        width: header.position.width,
        height: AGGREGATION_STYLE.height,
      });
    }

    // Calculate grand total
    const total = cells.reduce((sum, c) => sum + c.nodeCount, 0);

    // Add total cell in rightmost position
    aggregationCards.push({
      id: 'agg-total',
      type: 'aggregation',
      aggregationType: this.config.type,
      aggregationValue: total,
      gridX: headers.length,
      gridY: maxGridY,
      width: 80, // Fixed width for total cell
      height: AGGREGATION_STYLE.height,
    });

    return aggregationCards;
  }

  /**
   * Group cells by their column (gridX)
   *
   * @param cells - Array of cell descriptors
   * @returns Map of gridX -> cells in that column
   */
  private groupByColumn(cells: CellDescriptor[]): Map<number, CellDescriptor[]> {
    const groups = new Map<number, CellDescriptor[]>();

    for (const cell of cells) {
      const existing = groups.get(cell.gridX) || [];
      existing.push(cell);
      groups.set(cell.gridX, existing);
    }

    return groups;
  }

  /**
   * Update aggregation configuration
   *
   * @param config - Partial config to merge
   */
  setConfig(config: Partial<AggregationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current aggregation configuration
   */
  getConfig(): AggregationConfig {
    return { ...this.config };
  }
}

export default AggregationManager;
