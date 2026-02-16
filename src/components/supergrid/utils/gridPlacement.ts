/**
 * CSS Grid Placement Utilities
 *
 * Computes grid-row-start/end and grid-column-start/end values
 * for headers and data cells based on tree metrics.
 */

import type { FlatNode, GridPlacement, TreeMetrics } from '../types';

/**
 * Grid layout options for generating templates.
 */
export interface GridTemplateOptions {
  /** Width of header columns (default: '120px') */
  headerColumnWidth?: string;

  /** Height of header rows (default: '32px') */
  headerRowHeight?: string;

  /** Width of data columns (default: '80px') */
  dataColumnWidth?: string;

  /** Height of data rows (default: '32px') */
  dataRowHeight?: string;
}

/**
 * Compute CSS Grid placement for a ROW header.
 *
 * Row headers span vertically (multiple rows) based on leafCount.
 * They occupy columns based on their depth in the hierarchy.
 *
 * @param flatNode - The flattened node with computed metrics
 * @param colHeaderDepth - Number of column header rows (R)
 * @returns GridPlacement for CSS Grid positioning
 */
export function computeRowHeaderPlacement(
  flatNode: FlatNode,
  colHeaderDepth: number
): GridPlacement {
  // Row headers start after column header rows
  const dataRowStart = colHeaderDepth + 1;

  return {
    // Column position: based on node depth (0 → col 1, 1 → col 2, etc.)
    gridColumnStart: flatNode.depth + 1,
    gridColumnEnd: flatNode.depth + 2,

    // Row position: based on leaf span
    gridRowStart: dataRowStart + flatNode.leafStart,
    gridRowEnd: dataRowStart + flatNode.leafStart + flatNode.leafCount,
  };
}

/**
 * Compute CSS Grid placement for a COLUMN header.
 *
 * Column headers span horizontally (multiple columns) based on leafCount.
 * They occupy rows based on their depth in the hierarchy.
 *
 * @param flatNode - The flattened node with computed metrics
 * @param rowHeaderDepth - Number of row header columns (C)
 * @returns GridPlacement for CSS Grid positioning
 */
export function computeColHeaderPlacement(
  flatNode: FlatNode,
  rowHeaderDepth: number
): GridPlacement {
  // Column headers start after row header columns
  const dataColStart = rowHeaderDepth + 1;

  return {
    // Row position: based on node depth (0 → row 1, 1 → row 2, etc.)
    gridRowStart: flatNode.depth + 1,
    gridRowEnd: flatNode.depth + 2,

    // Column position: based on leaf span
    gridColumnStart: dataColStart + flatNode.leafStart,
    gridColumnEnd: dataColStart + flatNode.leafStart + flatNode.leafCount,
  };
}

/**
 * Compute CSS Grid placement for a DATA cell.
 *
 * Data cells occupy single cells in the data area,
 * positioned after all headers.
 *
 * @param rowLeafIndex - Index of the row leaf (0-based)
 * @param colLeafIndex - Index of the column leaf (0-based)
 * @param colHeaderDepth - Number of column header rows (R)
 * @param rowHeaderDepth - Number of row header columns (C)
 * @returns GridPlacement for CSS Grid positioning
 */
export function computeDataCellPlacement(
  rowLeafIndex: number,
  colLeafIndex: number,
  colHeaderDepth: number,
  rowHeaderDepth: number
): GridPlacement {
  return {
    gridRowStart: colHeaderDepth + 1 + rowLeafIndex,
    gridRowEnd: colHeaderDepth + 2 + rowLeafIndex,
    gridColumnStart: rowHeaderDepth + 1 + colLeafIndex,
    gridColumnEnd: rowHeaderDepth + 2 + colLeafIndex,
  };
}

/**
 * Compute CSS Grid placement for a CORNER cell.
 *
 * Corner cells occupy the top-left area where row headers
 * and column headers intersect.
 *
 * @param row - Row index in corner area (0-based)
 * @param col - Column index in corner area (0-based)
 * @returns GridPlacement for CSS Grid positioning
 */
export function computeCornerCellPlacement(row: number, col: number): GridPlacement {
  return {
    gridRowStart: row + 1,
    gridRowEnd: row + 2,
    gridColumnStart: col + 1,
    gridColumnEnd: col + 2,
  };
}

/**
 * Generate CSS Grid template strings.
 *
 * Creates gridTemplateColumns and gridTemplateRows based on:
 * - Row header depth (number of header columns)
 * - Column header depth (number of header rows)
 * - Row leaf count (number of data rows)
 * - Column leaf count (number of data columns)
 *
 * @param rowMetrics - Metrics for row axis
 * @param colMetrics - Metrics for column axis
 * @param options - Optional sizing configuration
 * @returns Object with columns and rows template strings
 */
export function generateGridTemplate(
  rowMetrics: TreeMetrics,
  colMetrics: TreeMetrics,
  options: GridTemplateOptions = {}
): { columns: string; rows: string } {
  const {
    headerColumnWidth = '100px',
    headerRowHeight = '32px',
    dataColumnWidth = '70px',
    dataRowHeight = '28px',
  } = options;

  // Columns: [rowHeaderDepth header columns] + [colLeafCount data columns]
  const columns = [
    ...Array(rowMetrics.depth).fill(headerColumnWidth),
    ...Array(colMetrics.leafCount).fill(dataColumnWidth),
  ].join(' ');

  // Rows: [colHeaderDepth header rows] + [rowLeafCount data rows]
  const rows = [
    ...Array(colMetrics.depth).fill(headerRowHeight),
    ...Array(rowMetrics.leafCount).fill(dataRowHeight),
  ].join(' ');

  return { columns, rows };
}

/**
 * Convert GridPlacement to inline style object.
 */
export function placementToStyle(placement: GridPlacement): React.CSSProperties {
  return {
    gridRowStart: placement.gridRowStart,
    gridRowEnd: placement.gridRowEnd,
    gridColumnStart: placement.gridColumnStart,
    gridColumnEnd: placement.gridColumnEnd,
  };
}
