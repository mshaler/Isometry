/**
 * useGridLayout Hook
 *
 * Core layout computation hook for SuperGrid.
 * Computes all grid positions from axis hierarchies using memoization.
 */

import { useMemo } from 'react';
import { computeTreeMetrics, getLeafNodes, getHeaderNodes } from '../utils/treeMetrics';
import {
  computeRowHeaderPlacement,
  computeColHeaderPlacement,
  computeDataCellPlacement,
  computeCornerCellPlacement,
  generateGridTemplate,
} from '../utils/gridPlacement';
import type {
  AxisConfig,
  GridLayout,
  HeaderCell,
  CornerCellData,
  DataCellPosition,
} from '../types';

/**
 * Compute the complete grid layout from row and column axis configurations.
 *
 * This hook:
 * 1. Computes tree metrics for both axes (depth, leaf counts)
 * 2. Generates CSS Grid template strings
 * 3. Creates corner cell, header, and data cell placements
 *
 * All computation is memoized and only recomputes when axes change.
 *
 * @param rowAxis - Row axis configuration (maps to Y plane)
 * @param colAxis - Column axis configuration (maps to X plane)
 * @returns Complete GridLayout with all computed positions
 */
export function useGridLayout(rowAxis: AxisConfig, colAxis: AxisConfig): GridLayout {
  return useMemo(() => {
    // Step 1: Compute metrics for both axes
    const rowMetrics = computeTreeMetrics(rowAxis.tree);
    const colMetrics = computeTreeMetrics(colAxis.tree);

    const rowHeaderDepth = rowMetrics.depth; // C: columns for row headers
    const colHeaderDepth = colMetrics.depth; // R: rows for column headers

    // Step 2: Generate CSS Grid template
    const gridTemplate = generateGridTemplate(rowMetrics, colMetrics);

    // Step 3: Generate corner cells
    const cornerCells: CornerCellData[] = [];
    for (let r = 0; r < colHeaderDepth; r++) {
      for (let c = 0; c < rowHeaderDepth; c++) {
        cornerCells.push({
          placement: computeCornerCellPlacement(r, c),
          label: 'MiniNav',
          row: r,
          col: c,
        });
      }
    }

    // Step 4: Generate row headers
    const rowHeaderNodes = getHeaderNodes(rowMetrics);
    const rowHeaders: HeaderCell[] = rowHeaderNodes.map((fn) => ({
      node: fn.node,
      placement: computeRowHeaderPlacement(fn, colHeaderDepth),
      depth: fn.depth,
      path: fn.path,
      isLeaf: fn.isLeaf,
    }));

    // Step 5: Generate column headers
    const colHeaderNodes = getHeaderNodes(colMetrics);
    const colHeaders: HeaderCell[] = colHeaderNodes.map((fn) => ({
      node: fn.node,
      placement: computeColHeaderPlacement(fn, rowHeaderDepth),
      depth: fn.depth,
      path: fn.path,
      isLeaf: fn.isLeaf,
    }));

    // Step 6: Generate data cell positions
    const rowLeaves = getLeafNodes(rowMetrics);
    const colLeaves = getLeafNodes(colMetrics);

    const dataCells: DataCellPosition[] = [];
    for (let ri = 0; ri < rowLeaves.length; ri++) {
      for (let ci = 0; ci < colLeaves.length; ci++) {
        dataCells.push({
          rowLeaf: rowLeaves[ri],
          colLeaf: colLeaves[ci],
          placement: computeDataCellPlacement(ri, ci, colHeaderDepth, rowHeaderDepth),
        });
      }
    }

    return {
      rowMetrics,
      colMetrics,
      gridTemplate,
      cornerCells,
      rowHeaders,
      colHeaders,
      dataCells,
      rowHeaderDepth,
      colHeaderDepth,
    };
  }, [rowAxis, colAxis]);
}

/**
 * Get a cell key from row and column paths.
 * Used for data lookup and selection tracking.
 */
export function getCellKey(rowPath: string[], colPath: string[]): string {
  return `${rowPath.join('/')}::${colPath.join('/')}`;
}

/**
 * Parse a cell key back into row and column paths.
 */
export function parseCellKey(key: string): { rowPath: string[]; colPath: string[] } | null {
  const parts = key.split('::');
  if (parts.length !== 2) return null;

  return {
    rowPath: parts[0].split('/'),
    colPath: parts[1].split('/'),
  };
}
