/**
 * SuperGridEngine Data Manager - Handles data transformation and SQL queries
 */

import type { Database } from 'sql.js';
import { devLogger } from '../../utils/logging';
import type { Node, CellDescriptor, GridDimensions } from './types';

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
  transformSQLToNodes(sqlResult: any): Node[] {
    if (!sqlResult || !sqlResult.values || sqlResult.values.length === 0) {
      return [];
    }

    const columns = sqlResult.columns;
    return sqlResult.values.map((row: any[], index: number) => {
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
   * Generate cells from nodes - simple flat grid layout
   */
  generateCellsFromNodes(nodes: Node[]): CellDescriptor[] {
    return nodes.map((node, index) => ({
      id: `cell_${node.id}`,
      gridX: index % 10, // Simple 10-column layout for skeleton
      gridY: Math.floor(index / 10),
      xValue: String(index % 10),
      yValue: String(Math.floor(index / 10)),
      nodeIds: [node.id],
      nodeCount: 1,
      aggregateData: {
        avgPriority: node.priority,
        statusCounts: { [node.status]: 1 },
        tagCounts: (node.tags || []).reduce((acc, tag) => ({ ...acc, [tag]: 1 }), {})
      }
    }));
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
  private transformSQLToGridData(sqlResult: any, xField: string, yField: string, startTime: number): any {
    const { columns, values } = sqlResult;

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
    const cells = values.map((row: any[]) => {
      const cardIds = row[colIndices.cardIds]?.split(',') || [];
      const cardNames = row[colIndices.cardNames]?.split('|') || [];

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
    const xValues = [...new Set(values.map((row: any) => row[colIndices.x]))].sort();
    const yValues = [...new Set(values.map((row: any) => row[colIndices.y]))].sort();

    return {
      cells,
      xAxis: { field: xField, values: xValues, type: 'categorical', range: { min: 0, max: xValues.length - 1 } },
      yAxis: { field: yField, values: yValues, type: 'categorical', range: { min: 0, max: yValues.length - 1 } },
      metadata: {
        totalCells: cells.length,
        totalCards: cells.reduce((sum: number, cell: any) => sum + cell.cards.length, 0),
        queryTime: performance.now() - startTime
      }
    };
  }

  /**
   * Calculate grid dimensions from current cells
   */
  calculateGridDimensions(currentCells: CellDescriptor[], headerMinWidth: number, headerMinHeight: number): GridDimensions {
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
  convertGridDataToCells(gridData: any): CellDescriptor[] {
    return gridData.cells.map((cell: any) => ({
      id: cell.id,
      gridX: gridData.xAxis.values.indexOf(cell.x),
      gridY: gridData.yAxis.values.indexOf(cell.y),
      xValue: String(cell.x),
      yValue: String(cell.y),
      nodeIds: cell.cards.map((c: any) => c.id),
      nodeCount: cell.cards.length,
      aggregateData: {
        avgPriority: cell.metadata?.avgPriority || 0,
        statusCounts: { [cell.metadata?.status || 'unknown']: cell.cards.length },
        tagCounts: {}
      }
    }));
  }
}