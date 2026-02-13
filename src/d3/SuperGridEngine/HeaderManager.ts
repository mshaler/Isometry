/**
 * SuperGridEngine Header Manager - Manages header structure and progressive disclosure
 */

import type {
  HeaderTree,
  HeaderDescriptor,
  HeaderNode,
  LATCHAxis,
  CellDescriptor,
  GridDimensions,
  ProgressiveState,
  LevelGroup
} from './types';

/**
 * Build a hierarchical tree from multi-level axis values.
 *
 * Takes an array of axis value arrays (e.g., [['Q1', 'Jan', 'Week 1'], ['Q1', 'Jan', 'Week 2'], ...])
 * and constructs a nested HeaderNode tree where:
 * - Root nodes are the unique values at level 0
 * - Each node's children are the unique values at the next level that share the same parent path
 * - Spans are calculated based on the number of leaf descendants
 *
 * @param axisValues Array of string arrays, each representing a path from root to leaf
 * @returns Array of root HeaderNode objects forming the hierarchy
 */
export function buildHeaderHierarchy(axisValues: string[][]): HeaderNode[] {
  if (axisValues.length === 0) {
    return [];
  }

  // Find the maximum depth
  const maxDepth = Math.max(...axisValues.map(v => v.length));

  // Build the tree recursively
  const buildLevel = (
    values: string[][],
    level: number,
    startIdx: number
  ): { nodes: HeaderNode[]; leafCount: number } => {
    if (level >= maxDepth || values.length === 0) {
      return { nodes: [], leafCount: 0 };
    }

    // Group values by their value at this level
    const groups = new Map<string, string[][]>();
    const groupOrder: string[] = [];

    for (const path of values) {
      const key = path[level] ?? '';
      if (!groups.has(key)) {
        groups.set(key, []);
        groupOrder.push(key);
      }
      groups.get(key)!.push(path);
    }

    const nodes: HeaderNode[] = [];
    let currentLeafIdx = startIdx;

    for (const key of groupOrder) {
      const groupValues = groups.get(key)!;

      // Recursively build children
      const childResult = buildLevel(groupValues, level + 1, currentLeafIdx);

      // If no children, this is a leaf node
      const isLeaf = childResult.nodes.length === 0;
      const leafCount = isLeaf ? 1 : childResult.leafCount;

      const node: HeaderNode = {
        value: key,
        level,
        span: leafCount,
        children: childResult.nodes,
        startIndex: currentLeafIdx,
        endIndex: currentLeafIdx + leafCount - 1,
        isCollapsed: false,
      };

      nodes.push(node);
      currentLeafIdx += leafCount;
    }

    const totalLeafCount = nodes.reduce((sum, n) => sum + n.span, 0);
    return { nodes, leafCount: totalLeafCount };
  };

  const result = buildLevel(axisValues, 0, 0);
  return result.nodes;
}

/**
 * Flatten a HeaderNode hierarchy into HeaderDescriptor array with pixel positions.
 *
 * Traverses the tree and calculates x/y/width/height for each node based on:
 * - For columns: x = startIndex * cellSize, width = span * cellSize, y = level * headerDepth
 * - For rows: y = startIndex * cellSize, height = span * cellSize, x = level * headerDepth
 *
 * @param headers Array of root HeaderNode objects
 * @param cellSize Size of each cell (width for columns, height for rows)
 * @param headerDepth Size of each header level (height for columns, width for rows)
 * @param orientation 'column' or 'row' determines position calculation
 * @returns Flat array of HeaderDescriptor with pixel positions
 */
export function calculateHeaderDimensions(
  headers: HeaderNode[],
  cellSize: number,
  headerDepth: number,
  orientation: 'column' | 'row'
): HeaderDescriptor[] {
  const result: HeaderDescriptor[] = [];

  const traverse = (node: HeaderNode) => {
    const position =
      orientation === 'column'
        ? {
            x: node.startIndex * cellSize,
            y: node.level * headerDepth,
            width: node.span * cellSize,
            height: headerDepth,
          }
        : {
            x: node.level * headerDepth,
            y: node.startIndex * cellSize,
            width: headerDepth,
            height: node.span * cellSize,
          };

    const descriptor: HeaderDescriptor = {
      id: `${orientation}_${node.level}_${node.value}_${node.startIndex}`,
      level: node.level,
      depth: node.level, // Same as level for now
      value: node.value,
      axis: 'Category' as LATCHAxis, // Default, can be overridden
      span: node.span,
      position,
      childCount: node.children.length,
      isLeaf: node.children.length === 0,
      startIndex: node.startIndex,
      endIndex: node.endIndex,
    };

    result.push(descriptor);

    for (const child of node.children) {
      traverse(child);
    }
  };

  for (const root of headers) {
    traverse(root);
  }

  return result;
}

/**
 * Parse a pipe-delimited multi-level value into an array.
 * E.g., "Q1|Jan|Week 1" -> ["Q1", "Jan", "Week 1"]
 */
function parseMultiLevelValue(value: string): string[] {
  if (!value || !value.includes('|')) {
    return [value || 'Unassigned'];
  }
  return value.split('|').map(v => v.trim());
}

/**
 * Calculate the maximum depth from an array of multi-level values.
 */
function getMaxDepth(axisValues: string[][]): number {
  if (axisValues.length === 0) return 0;
  return Math.max(...axisValues.map(v => v.length));
}

export class SuperGridHeaderManager {
  constructor(_headerMinWidth: number = 120, _headerMinHeight: number = 40) {
    // Min dimensions stored for future use
  }

  /**
   * Generate header tree from current cells using actual axis values.
   *
   * Per spec: "Extract actual axis values from cells (cell.xValue, cell.yValue)
   * and create headers with real labels"
   *
   * Supports multi-level headers via pipe-delimited values (e.g., "Q1|Jan|Week 1").
   * When multi-level values are detected, builds a nested hierarchy with proper spans.
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

    // Step 2: Sort by grid position
    const sortedXEntries = Array.from(xValueMap.entries()).sort((a, b) => a[0] - b[0]);
    const sortedYEntries = Array.from(yValueMap.entries()).sort((a, b) => a[0] - b[0]);

    // Step 3: Parse multi-level values
    const xAxisValues = sortedXEntries.map(([, value]) => parseMultiLevelValue(value));
    const yAxisValues = sortedYEntries.map(([, value]) => parseMultiLevelValue(value));

    // Step 4: Calculate max depths
    const maxXDepth = getMaxDepth(xAxisValues);
    const maxYDepth = getMaxDepth(yAxisValues);

    // Step 5: Calculate header depth per level
    const columnHeaderDepth = maxXDepth > 1
      ? gridDimensions.headerHeight / maxXDepth
      : gridDimensions.headerHeight;
    const rowHeaderDepth = maxYDepth > 1
      ? gridDimensions.headerWidth / maxYDepth
      : gridDimensions.headerWidth;

    // Step 6: Build hierarchies and calculate dimensions
    let columns: HeaderDescriptor[];
    let rows: HeaderDescriptor[];

    if (maxXDepth > 1) {
      // Multi-level column headers
      const xHierarchy = buildHeaderHierarchy(xAxisValues);
      columns = calculateHeaderDimensions(
        xHierarchy,
        gridDimensions.cellWidth,
        columnHeaderDepth,
        'column'
      );
    } else {
      // Single-level column headers (original behavior)
      columns = sortedXEntries.map(([gridX, xValue], index) => ({
        id: `col_${gridX}_${xValue}`,
        level: 0,
        depth: 0,
        value: xValue || 'Unassigned',
        axis: 'Category' as LATCHAxis,
        span: 1,
        position: {
          x: gridX * gridDimensions.cellWidth,
          y: 0,
          width: gridDimensions.cellWidth,
          height: gridDimensions.headerHeight
        },
        childCount: currentCells.filter(c => c.gridX === gridX).reduce((sum, c) => sum + c.nodeCount, 0),
        isLeaf: true,
        startIndex: index,
        endIndex: index
      }));
    }

    if (maxYDepth > 1) {
      // Multi-level row headers
      const yHierarchy = buildHeaderHierarchy(yAxisValues);
      rows = calculateHeaderDimensions(
        yHierarchy,
        gridDimensions.cellHeight,
        rowHeaderDepth,
        'row'
      );
    } else {
      // Single-level row headers (original behavior)
      rows = sortedYEntries.map(([gridY, yValue], index) => ({
        id: `row_${gridY}_${yValue}`,
        level: 0,
        depth: 0,
        value: yValue || 'Unassigned',
        axis: 'Category' as LATCHAxis,
        span: 1,
        position: {
          x: 0,
          y: gridY * gridDimensions.cellHeight,
          width: gridDimensions.headerWidth,
          height: gridDimensions.cellHeight
        },
        childCount: currentCells.filter(c => c.gridY === gridY).reduce((sum, c) => sum + c.nodeCount, 0),
        isLeaf: true,
        startIndex: index,
        endIndex: index
      }));
    }

    return {
      columns,
      rows,
      maxColumnLevels: maxXDepth,
      maxRowLevels: maxYDepth
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