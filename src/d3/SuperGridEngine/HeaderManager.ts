/**
 * SuperGridEngine Header Manager - Manages header structure and progressive disclosure
 */

import type {
  HeaderTree,
  HeaderDescriptor,
  LATCHAxis,
  CellDescriptor,
  GridDimensions,
  ProgressiveState,
  LevelGroup
} from './types';

export class SuperGridHeaderManager {
  constructor(_headerMinWidth: number = 120, _headerMinHeight: number = 40) {
    // Min dimensions stored for future use
  }

  /**
   * Generate header tree from current cells using actual axis values
   *
   * Per spec: "Extract actual axis values from cells (cell.xValue, cell.yValue)
   * and create headers with real labels"
   */
  generateHeaderTree(currentCells: CellDescriptor[], gridDimensions: GridDimensions): HeaderTree {
    if (currentCells.length === 0) {
      return {
        columns: [],
        rows: [],
        maxColumnLevels: 0,
        maxRowLevels: 0
      };
    }

    // Step 1: Extract unique X and Y values with their grid positions
    const xValueMap = new Map<number, string>(); // gridX -> xValue
    const yValueMap = new Map<number, string>(); // gridY -> yValue

    currentCells.forEach(cell => {
      if (!xValueMap.has(cell.gridX)) {
        xValueMap.set(cell.gridX, cell.xValue);
      }
      if (!yValueMap.has(cell.gridY)) {
        yValueMap.set(cell.gridY, cell.yValue);
      }
    });

    // Step 2: Sort by grid position and create headers with actual values
    const sortedXEntries = Array.from(xValueMap.entries()).sort((a, b) => a[0] - b[0]);
    const sortedYEntries = Array.from(yValueMap.entries()).sort((a, b) => a[0] - b[0]);

    // Step 3: Generate column headers with real axis values
    const columns: HeaderDescriptor[] = sortedXEntries.map(([gridX, xValue]) => ({
      id: `col_${gridX}_${xValue}`,
      level: 0,
      value: xValue || 'Unassigned',
      axis: 'Category' as LATCHAxis, // Default - could be overridden by PAFV config
      span: 1,
      position: {
        x: gridX * gridDimensions.cellWidth,
        y: 0,
        width: gridDimensions.cellWidth,
        height: gridDimensions.headerHeight
      },
      childCount: currentCells.filter(c => c.gridX === gridX).reduce((sum, c) => sum + c.nodeCount, 0),
      isLeaf: true
    }));

    // Step 4: Generate row headers with real axis values
    const rows: HeaderDescriptor[] = sortedYEntries.map(([gridY, yValue]) => ({
      id: `row_${gridY}_${yValue}`,
      level: 0,
      value: yValue || 'Unassigned',
      axis: 'Category' as LATCHAxis, // Default - could be overridden by PAFV config
      span: 1,
      position: {
        x: 0,
        y: gridY * gridDimensions.cellHeight,
        width: gridDimensions.headerWidth,
        height: gridDimensions.cellHeight
      },
      childCount: currentCells.filter(c => c.gridY === gridY).reduce((sum, c) => sum + c.nodeCount, 0),
      isLeaf: true
    }));

    return {
      columns,
      rows,
      maxColumnLevels: 1,
      maxRowLevels: 1
    };
  }

  /**
   * Analyze hierarchy for Progressive Disclosure (migrated from SuperGridV4)
   */
  analyzeHierarchyFromGridData(gridData: unknown): LevelGroup[] {
    const levelGroups: LevelGroup[] = [];
    const totalNodes = (gridData as Record<string, unknown[]>).cells?.length ?? 0;

    if (totalNodes > 50) {
      levelGroups.push({
        id: 'dense-overview',
        name: 'Overview',
        levels: [0, 1],
        description: `Overview of ${totalNodes} items`
      });
    }

    if (totalNodes > 200) {
      levelGroups.push({
        id: 'medium-detail',
        name: 'Medium Detail',
        levels: [0, 1, 2],
        description: `Medium detail view`
      });
    }

    if (totalNodes > 500) {
      levelGroups.push({
        id: 'full-detail',
        name: 'Full Detail',
        levels: [0, 1, 2, 3],
        description: `Full detail view`
      });
    }

    return levelGroups;
  }

  /**
   * Apply Progressive Disclosure filtering (migrated from SuperGridV4)
   */
  applyProgressiveDisclosureToGridData(gridData: unknown, progressiveState: ProgressiveState): unknown {
    // For now, return full data - progressive disclosure logic can be enhanced later
    // This would filter gridData.cells based on progressiveState.visibleLevels
    // and progressiveState.collapsedHeaders

    if (progressiveState.visibleLevels.length === 0) {
      return gridData;
    }

    // Future enhancement: implement actual filtering based on hierarchy levels
    return gridData;
  }

  /**
   * Update header positions after viewport changes
   */
  updateHeaderPositions(
    headerTree: HeaderTree,
    _gridDimensions: GridDimensions,
    _viewportX: number,
    _viewportY: number
  ): HeaderTree {
    // Clone the header tree
    const updatedColumns = headerTree.columns.map(col => ({
      ...col,
      position: {
        ...col.position,
        // Headers stay fixed during viewport changes
        x: col.position.x,
        y: 0
      }
    }));

    const updatedRows = headerTree.rows.map(row => ({
      ...row,
      position: {
        ...row.position,
        x: 0,
        y: row.position.y
      }
    }));

    return {
      ...headerTree,
      columns: updatedColumns,
      rows: updatedRows
    };
  }

  /**
   * Calculate header spanning for nested headers
   */
  calculateHeaderSpanning(headers: HeaderDescriptor[]): HeaderDescriptor[] {
    // This is a placeholder for future nested header implementation
    // For now, all headers have span = 1
    return headers.map(header => ({
      ...header,
      span: 1,
      childCount: 0,
      isLeaf: true
    }));
  }

  /**
   * Get visible headers based on viewport and progressive state
   */
  getVisibleHeaders(
    headerTree: HeaderTree,
    progressiveState: ProgressiveState
  ): { columns: HeaderDescriptor[]; rows: HeaderDescriptor[] } {
    // Filter headers based on visible levels and collapsed state
    const visibleColumns = headerTree.columns.filter(header => {
      if (progressiveState.collapsedHeaders.has(header.id)) {
        return false;
      }
      return progressiveState.visibleLevels.includes(header.level);
    });

    const visibleRows = headerTree.rows.filter(header => {
      if (progressiveState.collapsedHeaders.has(header.id)) {
        return false;
      }
      return progressiveState.visibleLevels.includes(header.level);
    });

    return {
      columns: visibleColumns,
      rows: visibleRows
    };
  }

  /**
   * Toggle header collapse state
   */
  toggleHeaderCollapse(
    headerId: string,
    collapsed: boolean,
    progressiveState: ProgressiveState
  ): ProgressiveState {
    const newCollapsedHeaders = new Set(progressiveState.collapsedHeaders);

    if (collapsed) {
      newCollapsedHeaders.add(headerId);
    } else {
      newCollapsedHeaders.delete(headerId);
    }

    return {
      ...progressiveState,
      collapsedHeaders: newCollapsedHeaders
    };
  }
}