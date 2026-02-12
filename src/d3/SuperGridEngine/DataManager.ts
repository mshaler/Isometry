/**
 * SuperGridEngine Data Manager - Handles data transformation and SQL queries
 */

import type { Database } from 'sql.js';
import { devLogger } from '../../utils/logging';
import type { Node, CellDescriptor, GridDimensions } from './types';

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
      const dataQuery = `
        SELECT
          ${xAxisField} as x_value,
          ${yAxisField} as y_value,
          COUNT(*) as cell_count,
          GROUP_CONCAT(id) as card_ids,
          GROUP_CONCAT(name, '|') as card_names,
          AVG(priority) as avg_priority,
          status
        FROM nodes
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