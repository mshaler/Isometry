/**
 * SuperGridEngine Data Manager - Handles data transformation and SQL queries
 *
 * SuperDensity Controls (Janus Model):
 * - Value Density (Zoom): Collapse leaf values into parents via SQL GROUP BY
 * - Extent Density (Pan): Hide/show empty cells (dense/sparse/ultra-sparse)
 */

import type { Database } from 'sql.js';
import { devLogger } from '../../utils/logging';
import type { Node, CellDescriptor, GridDimensions } from './types';

/**
 * Extent density modes for cell filtering
 * - dense: Only show populated cells (nodeCount > 0)
 * - sparse: Show populated cells + immediate neighbors
 * - ultra-sparse: Show full Cartesian product (all cells)
 */
export type ExtentMode = 'dense' | 'sparse' | 'ultra-sparse';

/**
 * Generate SQL query with GROUP BY for value density aggregation
 *
 * Value density collapses leaf values into parent levels:
 * - Level 0: No aggregation (leaf values: Jan, Feb, Mar)
 * - Level 1: Collapse to parent (Month -> Quarter: Q1)
 * - Level 2: Collapse to grandparent (Week -> Quarter)
 *
 * @param baseQuery - Original SQL query
 * @param densityLevel - Collapse level (0 = no collapse)
 * @param axisHierarchy - Hierarchy from root to leaf ['quarter', 'month', 'week']
 * @returns Modified query with GROUP BY and aggregations
 */
export function generateDensityQuery(
  baseQuery: string,
  densityLevel: number,
  axisHierarchy: string[]
): string {
  // Level 0 or empty hierarchy = no aggregation
  if (densityLevel === 0 || axisHierarchy.length === 0) {
    return baseQuery;
  }

  // Calculate which level to group by (from the end of hierarchy)
  // Level 1: group by second-to-last (parent of leaf)
  // Level 2: group by third-to-last (grandparent)
  // Clamp to available hierarchy depth
  const groupByIndex = Math.max(
    0,
    axisHierarchy.length - 1 - densityLevel
  );
  const groupByField = axisHierarchy[groupByIndex];

  // Check if query has WHERE clause to determine how to modify
  const hasWhere = baseQuery.toUpperCase().includes('WHERE');
  const upperQuery = baseQuery.toUpperCase();

  // Extract the FROM clause to get the table name
  const fromMatch = upperQuery.match(/FROM\s+(\w+)/);
  const tableName = fromMatch ? baseQuery.substring(fromMatch.index! + 5).match(/\s+(\w+)/)?.[1] || 'nodes' : 'nodes';

  // Build aggregated query preserving original WHERE conditions
  let whereConditions = '';
  if (hasWhere) {
    // Extract everything after WHERE up to ORDER BY, GROUP BY, or end
    const whereMatch = baseQuery.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|$)/i);
    if (whereMatch) {
      whereConditions = `WHERE ${whereMatch[1].trim()}`;
    }
  }

  // Generate aggregated query with COUNT and AVG
  const aggregatedQuery = `SELECT ${groupByField}, COUNT(*) AS node_count, AVG(priority) AS avg_priority FROM ${tableName} ${whereConditions} GROUP BY ${groupByField}`;

  return aggregatedQuery;
}

/**
 * Filter cells based on extent density mode
 *
 * Janus extent density controls how much of the data space to show:
 * - dense: Only populated cells (nodeCount > 0)
 * - sparse: Populated cells + immediate grid neighbors
 * - ultra-sparse: Full Cartesian product (no filtering)
 *
 * @param cells - Array of CellDescriptor to filter
 * @param mode - Extent density mode
 * @returns Filtered array of cells
 */
export function filterEmptyCells(
  cells: CellDescriptor[],
  mode: ExtentMode
): CellDescriptor[] {
  if (cells.length === 0) {
    return [];
  }

  // Ultra-sparse: return all cells (full Cartesian product)
  if (mode === 'ultra-sparse') {
    return cells;
  }

  // Find populated cells
  const populatedCells = cells.filter(c => c.nodeCount > 0);

  // Dense: return only populated cells
  if (mode === 'dense') {
    return populatedCells;
  }

  // Sparse: return populated cells + immediate neighbors
  if (mode === 'sparse') {
    if (populatedCells.length === 0) {
      return [];
    }

    // Build set of populated positions
    const populatedPositions = new Set<string>();
    populatedCells.forEach(c => {
      populatedPositions.add(`${c.gridX},${c.gridY}`);
    });

    // Build set of neighbor positions (adjacent cells)
    const neighborPositions = new Set<string>();
    populatedCells.forEach(c => {
      // Add all 8 neighboring positions (including diagonals)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx !== 0 || dy !== 0) {
            neighborPositions.add(`${c.gridX + dx},${c.gridY + dy}`);
          }
        }
      }
    });

    // Filter cells: include populated + neighbors
    return cells.filter(c => {
      const pos = `${c.gridX},${c.gridY}`;
      return populatedPositions.has(pos) || neighborPositions.has(pos);
    });
  }

  // Default fallback: return all cells
  return cells;
}

/** Shape of a single result set from sql.js db.exec() */
interface SQLResultSet {
  columns: string[];
  values: unknown[][];
}

/** Shape of grid cell data returned from transformSQLToGridData */
interface GridCellData {
  id: string;
  x: unknown;
  y: unknown;
  value: unknown;
  cards: Array<{ id: string; name: string; priority: unknown; status: unknown }>;
  metadata: { avgPriority: unknown; status: unknown; cardCount: unknown };
}

/** Shape of the grid data returned from executeGridQuery */
interface TransformedGridData {
  cells: GridCellData[];
  xAxis: { field: string; values: unknown[]; type: string; range: { min: number; max: number } };
  yAxis: { field: string; values: unknown[]; type: string; range: { min: number; max: number } };
  metadata: { totalCells: number; totalCards: number; queryTime: number };
}

export class SuperGridDataManager {
  private database: Database;
  private cellMinWidth: number;
  private cellMinHeight: number;

  constructor(database: Database, cellMinWidth: number = 120, cellMinHeight: number = 80) {
    this.database = database;
    this.cellMinWidth = cellMinWidth;
    this.cellMinHeight = cellMinHeight;
  }

  /**
   * Transform SQL results to Node array
   */
  transformSQLToNodes(sqlResult: unknown): Node[] {
    const result = sqlResult as SQLResultSet | null | undefined;
    if (!result || !result.values || result.values.length === 0) {
      return [];
    }

    const columns = result.columns;
    return result.values.map((row: unknown[], index: number) => {
      const node: Node = {
        id: String(row[0] || `node_${index}`),
        name: String(row[columns.indexOf('name')] || `Node ${index}`),
        created_at: String(row[columns.indexOf('created_at')] || new Date().toISOString()),
        modified_at: String(row[columns.indexOf('modified_at')] || new Date().toISOString()),
        status: String(row[columns.indexOf('status')] || 'unknown'),
        priority: Number(row[columns.indexOf('priority')] || 0),
        folder: String(row[columns.indexOf('folder')] || 'default'),
        tags: String(row[columns.indexOf('tags')] || '').split(',').filter(Boolean),
      };

      // Add additional columns as dynamic properties
      columns.forEach((col: string, i: number) => {
        if (!['id', 'name', 'created_at', 'modified_at', 'status', 'priority', 'folder', 'tags'].includes(col)) {
          node[col] = row[i];
        }
      });

      return node;
    });
  }

  /**
   * Generate cells from nodes grouped by axis field values
   *
   * Per spec: "Group nodes by xAxisField and yAxisField values,
   * compute gridX/gridY from value-to-index mappings"
   *
   * @param nodes - Array of nodes to position
   * @param xAxisField - Field name for X-axis grouping (e.g., 'node_type')
   * @param yAxisField - Field name for Y-axis grouping (e.g., 'folder')
   * @returns Array of CellDescriptor with proper grid positions
   */
  generateCellsFromNodes(
    nodes: Node[],
    xAxisField: string = 'node_type',
    yAxisField: string = 'folder'
  ): CellDescriptor[] {
    if (nodes.length === 0) return [];

    // Step 1: Extract unique axis values and create index mappings
    const xValues = new Set<string>();
    const yValues = new Set<string>();

    nodes.forEach(node => {
      const record = node as unknown as Record<string, unknown>;
      const xVal = String(record[xAxisField] ?? 'Unassigned');
      const yVal = String(record[yAxisField] ?? 'Unassigned');
      xValues.add(xVal);
      yValues.add(yVal);
    });

    // Step 2: Sort and create value-to-index mappings
    const sortedXValues = Array.from(xValues).sort();
    const sortedYValues = Array.from(yValues).sort();

    const xIndexMap = new Map<string, number>();
    const yIndexMap = new Map<string, number>();

    sortedXValues.forEach((val, idx) => xIndexMap.set(val, idx));
    sortedYValues.forEach((val, idx) => yIndexMap.set(val, idx));

    // Step 3: Group nodes into cells by grid position
    const cellMap = new Map<string, {
      nodes: Node[];
      xValue: string;
      yValue: string;
      gridX: number;
      gridY: number;
    }>();

    nodes.forEach(node => {
      const record = node as unknown as Record<string, unknown>;
      const xVal = String(record[xAxisField] ?? 'Unassigned');
      const yVal = String(record[yAxisField] ?? 'Unassigned');
      const gridX = xIndexMap.get(xVal) ?? 0;
      const gridY = yIndexMap.get(yVal) ?? 0;
      const cellKey = `${gridX}-${gridY}`;

      if (!cellMap.has(cellKey)) {
        cellMap.set(cellKey, {
          nodes: [],
          xValue: xVal,
          yValue: yVal,
          gridX,
          gridY
        });
      }
      cellMap.get(cellKey)!.nodes.push(node);
    });

    // Step 4: Convert to CellDescriptor array
    return Array.from(cellMap.values()).map(cell => {
      const avgPriority = cell.nodes.reduce((sum, n) => sum + (n.priority || 0), 0) / cell.nodes.length;
      const statusCounts: Record<string, number> = {};
      const tagCounts: Record<string, number> = {};

      cell.nodes.forEach(n => {
        const status = n.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        (n.tags || []).forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      return {
        id: `cell_${cell.xValue}-${cell.yValue}`,
        gridX: cell.gridX,
        gridY: cell.gridY,
        xValue: cell.xValue,
        yValue: cell.yValue,
        nodeIds: cell.nodes.map(n => n.id),
        nodeCount: cell.nodes.length,
        aggregateData: {
          avgPriority,
          statusCounts,
          tagCounts
        }
      };
    });
  }

  /**
   * Load data using direct sql.js queries with field-based grid projection
   * This is the core SuperGridV4 method migrated
   */
  async executeGridQuery(
    xAxisField: string,
    yAxisField: string,
    filterClause: string = '',
    groupByClause: string = ''
  ): Promise<any> {
    const startTime = performance.now();

    try {
      // Build the main data query using SuperGridV4 logic
      const whereClause = filterClause ? `WHERE ${filterClause}` : '';
      const groupBy = groupByClause ? `GROUP BY ${groupByClause}` : '';

      // Direct sql.js query - synchronous execution in same memory space
      // Uses cards table (migrated from nodes in Phase 84)
      const dataQuery = `
        SELECT
          ${xAxisField} as x_value,
          ${yAxisField} as y_value,
          COUNT(*) as cell_count,
          GROUP_CONCAT(id) as card_ids,
          GROUP_CONCAT(name, '|') as card_names,
          AVG(priority) as avg_priority,
          status
        FROM cards
        ${whereClause}
        ${groupBy ? groupBy + ', ' + xAxisField + ', ' + yAxisField : `GROUP BY ${xAxisField}, ${yAxisField}`}
        ORDER BY ${yAxisField}, ${xAxisField}
      `;

      devLogger.debug('SuperGridDataManager executing query', {
        queryLength: dataQuery.length
      });
      const result = this.database.exec(dataQuery);

      if (!result[0]?.values) {
        devLogger.warn('SuperGridDataManager: No data returned from query');
        return null;
      }

      // Transform SQL results to SuperGrid format
      return this.transformSQLToGridData(result[0], xAxisField, yAxisField, startTime);

    } catch (error) {
      devLogger.error('SuperGridDataManager data loading failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Transform SQL results to GridData format (migrated from SuperGridV4)
   */
  private transformSQLToGridData(
    sqlResult: unknown,
    xField: string,
    yField: string,
    startTime: number
  ): TransformedGridData {
    const { columns, values } = sqlResult as SQLResultSet;

    // Map column indices
    const colIndices = {
      x: columns.indexOf('x_value'),
      y: columns.indexOf('y_value'),
      count: columns.indexOf('cell_count'),
      cardIds: columns.indexOf('card_ids'),
      cardNames: columns.indexOf('card_names'),
      avgPriority: columns.indexOf('avg_priority'),
      status: columns.indexOf('status')
    };

    // Transform to cells array using SuperGridV4 format
    const cells = values.map((row: unknown[]) => {
      const cardIdsRaw = row[colIndices.cardIds];
      const cardNamesRaw = row[colIndices.cardNames];
      const cardIds = (typeof cardIdsRaw === 'string' ? cardIdsRaw.split(',') : []);
      const cardNames = (typeof cardNamesRaw === 'string' ? cardNamesRaw.split('|') : []);

      return {
        id: `${row[colIndices.x]}-${row[colIndices.y]}`,
        x: row[colIndices.x],
        y: row[colIndices.y],
        value: row[colIndices.count],
        cards: cardIds.map((id: string, i: number) => ({
          id: id.trim(),
          name: cardNames[i]?.trim() || `Card ${id}`,
          priority: row[colIndices.avgPriority] || 1,
          status: row[colIndices.status] || 'active'
        })),
        metadata: {
          avgPriority: row[colIndices.avgPriority],
          status: row[colIndices.status],
          cardCount: row[colIndices.count]
        }
      };
    });

    // Build axis ranges
    const xValues = [...new Set(values.map((row: unknown[]) => row[colIndices.x]))].sort();
    const yValues = [...new Set(values.map((row: unknown[]) => row[colIndices.y]))].sort();

    return {
      cells,
      xAxis: { field: xField, values: xValues, type: 'categorical', range: { min: 0, max: xValues.length - 1 } },
      yAxis: { field: yField, values: yValues, type: 'categorical', range: { min: 0, max: yValues.length - 1 } },
      metadata: {
        totalCells: cells.length,
        totalCards: cells.reduce((sum: number, cell: GridCellData) => sum + cell.cards.length, 0),
        queryTime: performance.now() - startTime
      }
    };
  }

  /**
   * Calculate grid dimensions from current cells
   */
  calculateGridDimensions(
    currentCells: CellDescriptor[], headerMinWidth: number, headerMinHeight: number
  ): GridDimensions {
    const maxX = Math.max(0, ...currentCells.map(c => c.gridX));
    const maxY = Math.max(0, ...currentCells.map(c => c.gridY));

    return {
      rows: maxY + 1,
      cols: maxX + 1,
      cellWidth: this.cellMinWidth,
      cellHeight: this.cellMinHeight,
      headerHeight: headerMinHeight,
      headerWidth: headerMinWidth,
      totalWidth: (maxX + 1) * this.cellMinWidth + headerMinWidth,
      totalHeight: (maxY + 1) * this.cellMinHeight + headerMinHeight
    };
  }

  /**
   * Convert GridData to engine format
   */
  convertGridDataToCells(gridData: TransformedGridData): CellDescriptor[] {
    return gridData.cells.map((cell: GridCellData) => ({
      id: cell.id,
      gridX: gridData.xAxis.values.indexOf(cell.x),
      gridY: gridData.yAxis.values.indexOf(cell.y),
      xValue: String(cell.x),
      yValue: String(cell.y),
      nodeIds: cell.cards.map((c) => c.id),
      nodeCount: cell.cards.length,
      aggregateData: {
        avgPriority: (cell.metadata?.avgPriority as number) || 0,
        statusCounts: { [String(cell.metadata?.status || 'unknown')]: cell.cards.length },
        tagCounts: {}
      }
    }));
  }
}