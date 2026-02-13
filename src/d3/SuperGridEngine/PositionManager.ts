/**
 * PositionManager — Tracks logical PAFV coordinates for cards
 *
 * Enables Janus polymorphic view transitions by maintaining logical
 * coordinates that survive axis remapping and filter changes.
 */
import type {
  CellDescriptor,
  Node,
  PAFVConfiguration,
  GridDimensions,
  CardPosition,
  PAFVCoordinate,
} from './types';

/**
 * Derive a CardPosition from a Node based on PAFV configuration.
 * Extracts the logical LATCH values that determine where the card belongs.
 */
export function derivePositionFromNode(
  node: Node,
  pafvConfig: PAFVConfiguration
): CardPosition {
  const extractCoordinate = (
    mapping: PAFVConfiguration['xMapping']
  ): PAFVCoordinate => {
    if (!mapping) {
      return { axis: null, value: null };
    }

    const facet = mapping.facet;
    const value = facet ? (node[facet] as string | number | null) : null;

    return {
      axis: mapping.axis,
      facet,
      value,
    };
  };

  return {
    nodeId: node.id,
    x: extractCoordinate(pafvConfig.xMapping),
    y: extractCoordinate(pafvConfig.yMapping),
    z: extractCoordinate(pafvConfig.zMapping),
    lastUpdated: new Date().toISOString(),
  };
}

export class PositionManager {
  private positions: Map<string, CardPosition> = new Map();
  private customSortOrders: Map<string, string[]> = new Map();
  private xValueIndices: Map<string, number> = new Map();
  private yValueIndices: Map<string, number> = new Map();

  /**
   * Get a stored position by node/cell ID
   */
  getPosition(id: string): CardPosition | undefined {
    return this.positions.get(id);
  }

  /**
   * Manually set a position
   */
  setPosition(id: string, position: CardPosition): void {
    this.positions.set(id, position);
  }

  /**
   * Remove a specific position
   */
  clearPosition(id: string): void {
    this.positions.delete(id);
  }

  /**
   * Remove all positions
   */
  clearAllPositions(): void {
    this.positions.clear();
  }

  /**
   * Calculate and store position from a cell descriptor
   */
  calculatePosition(
    cell: CellDescriptor,
    pafvConfig: PAFVConfiguration
  ): CardPosition {
    const position: CardPosition = {
      nodeId: cell.id,
      x: {
        axis: pafvConfig.xMapping?.axis ?? null,
        facet: pafvConfig.xMapping?.facet,
        value: cell.xValue,
      },
      y: {
        axis: pafvConfig.yMapping?.axis ?? null,
        facet: pafvConfig.yMapping?.facet,
        value: cell.yValue,
      },
      z: {
        axis: pafvConfig.zMapping?.axis ?? null,
        facet: pafvConfig.zMapping?.facet,
        value: null,
      },
      lastUpdated: new Date().toISOString(),
    };

    this.positions.set(cell.id, position);
    return position;
  }

  /**
   * Set value-to-index mapping for an axis
   */
  setValueIndex(axis: 'x' | 'y', value: string, index: number): void {
    if (axis === 'x') {
      this.xValueIndices.set(value, index);
    } else {
      this.yValueIndices.set(value, index);
    }
  }

  /**
   * Update value indices from cell data
   */
  updateValueIndices(cells: CellDescriptor[]): void {
    // Build unique x and y values in order
    const xValues = new Set<string>();
    const yValues = new Set<string>();

    for (const cell of cells) {
      xValues.add(cell.xValue);
      yValues.add(cell.yValue);
    }

    // Assign indices
    let xIndex = 0;
    for (const value of xValues) {
      this.xValueIndices.set(value, xIndex++);
    }

    let yIndex = 0;
    for (const value of yValues) {
      this.yValueIndices.set(value, yIndex++);
    }
  }

  /**
   * Resolve a logical position to grid coordinates
   */
  resolvePosition(
    position: CardPosition,
    _pafvConfig: PAFVConfiguration,
    _gridDimensions: GridDimensions
  ): { gridX: number; gridY: number } {
    const xValue = position.x.value?.toString() ?? '';
    const yValue = position.y.value?.toString() ?? '';

    const gridX = this.xValueIndices.get(xValue) ?? -1;
    const gridY = this.yValueIndices.get(yValue) ?? -1;

    return { gridX, gridY };
  }

  /**
   * Set custom sort order for a group
   */
  setCustomOrder(groupKey: string, nodeIds: string[]): void {
    this.customSortOrders.set(groupKey, [...nodeIds]);
  }

  /**
   * Get custom sort order for a group
   */
  getCustomOrder(groupKey: string): string[] | undefined {
    return this.customSortOrders.get(groupKey);
  }

  /**
   * Recalculate positions for all nodes
   * Reuses existing positions where possible (for filter restoration)
   */
  recalculateAllPositions(
    nodes: Node[],
    pafvConfig: PAFVConfiguration,
    _gridDimensions: GridDimensions
  ): CellDescriptor[] {
    const cellMap = new Map<string, CellDescriptor>();

    for (const node of nodes) {
      // Check for existing position
      let position = this.positions.get(node.id);

      if (!position) {
        // First time: derive from node's LATCH properties
        position = derivePositionFromNode(node, pafvConfig);
        this.positions.set(node.id, position);
      }

      // Create cell key from position values
      const xValue = position.x.value?.toString() ?? '';
      const yValue = position.y.value?.toString() ?? '';
      const cellKey = `${xValue}-${yValue}`;

      // Get or create cell
      let cell = cellMap.get(cellKey);
      if (!cell) {
        cell = {
          id: `cell-${cellMap.size}`,
          gridX: cellMap.size % 10, // Temporary grid position
          gridY: Math.floor(cellMap.size / 10),
          xValue,
          yValue,
          nodeIds: [],
          nodeCount: 0,
        };
        cellMap.set(cellKey, cell);
      }

      // Add node to cell
      cell.nodeIds.push(node.id);
      cell.nodeCount++;
    }

    const cells = Array.from(cellMap.values());

    // Update value indices for resolution
    this.updateValueIndices(cells);

    // Assign final grid positions
    const uniqueXValues = [...new Set(cells.map((c) => c.xValue))].sort();
    const uniqueYValues = [...new Set(cells.map((c) => c.yValue))].sort();

    for (const cell of cells) {
      cell.gridX = uniqueXValues.indexOf(cell.xValue);
      cell.gridY = uniqueYValues.indexOf(cell.yValue);
    }

    return cells;
  }

  /**
   * Serialize position state to JSON
   */
  serializeState(): string {
    const positionsObj: Record<string, CardPosition> = {};
    for (const [key, value] of this.positions) {
      positionsObj[key] = value;
    }

    const sortOrdersObj: Record<string, string[]> = {};
    for (const [key, value] of this.customSortOrders) {
      sortOrdersObj[key] = value;
    }

    return JSON.stringify({
      positions: positionsObj,
      customSortOrders: sortOrdersObj,
    });
  }

  /**
   * Deserialize position state from JSON
   */
  deserializeState(json: string): void {
    try {
      const data = JSON.parse(json);

      this.positions.clear();
      if (data.positions) {
        for (const [key, value] of Object.entries(data.positions)) {
          this.positions.set(key, value as CardPosition);
        }
      }

      this.customSortOrders.clear();
      if (data.customSortOrders) {
        for (const [key, value] of Object.entries(data.customSortOrders)) {
          this.customSortOrders.set(key, value as string[]);
        }
      }
    } catch (e) {
      // Invalid JSON, ignore
      console.warn('PositionManager: Failed to deserialize state', e);
    }
  }
}
