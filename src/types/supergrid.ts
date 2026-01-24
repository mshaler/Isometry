/**
 * SuperGrid-specific types for grid rendering and navigation.
 *
 * SuperGrid uses a 3-layer z-axis architecture:
 * - z=0: Sparsity Layer (D3 SVG rendering)
 * - z=1: Density Layer (React controls)
 * - z=2: Overlay Layer (React cards/modals)
 *
 * @module types/supergrid
 */

import type { Point } from './coordinates';

/**
 * Position of a cell in logical grid coordinates.
 *
 * - In Anchor mode: Both x and y are >= 0
 * - In Bipolar mode: x and y can be negative
 *
 * @example
 * // Anchor mode
 * const cellA1: CellPosition = { x: 0, y: 0 }; // Top-left cell
 * const cellB2: CellPosition = { x: 1, y: 1 };
 *
 * @example
 * // Bipolar mode (Eisenhower Matrix)
 * const urgentImportant: CellPosition = { x: 1, y: 1 };   // Q1
 * const notUrgentImportant: CellPosition = { x: -1, y: 1 }; // Q2
 * const urgentNotImportant: CellPosition = { x: 1, y: -1 }; // Q4
 * const notUrgentNotImportant: CellPosition = { x: -1, y: -1 }; // Q3
 */
export type CellPosition = Point;

/**
 * Range of values for a grid axis (column or row).
 *
 * @property min - Minimum value on this axis
 * @property max - Maximum value on this axis
 * @property count - Number of discrete positions (max - min + 1)
 *
 * @example
 * // Anchor mode: 10 columns (0-9)
 * const colRange: AxisRange = { min: 0, max: 9, count: 10 };
 *
 * @example
 * // Bipolar mode: -5 to +5 (11 positions)
 * const rowRange: AxisRange = { min: -5, max: 5, count: 11 };
 */
export interface AxisRange {
  min: number;
  max: number;
  count: number;
}

/**
 * Data for a single grid cell to be rendered.
 *
 * @property position - Logical coordinates (x, y)
 * @property value - Display value (card title, count, etc.)
 * @property nodeId - Database ID for this cell's node
 * @property colPath - LATCH facet path for column (e.g., "time/2024/Q1")
 * @property rowPath - LATCH facet path for row (e.g., "category/work")
 *
 * @example
 * const cell: GridCell = {
 *   position: { x: 2, y: 1 },
 *   value: "Project Alpha",
 *   nodeId: 42,
 *   colPath: "time/2024/Q1",
 *   rowPath: "category/work"
 * };
 */
export interface GridCell {
  position: CellPosition;
  value: string | number;
  nodeId: number;
  colPath: string;
  rowPath: string;
}

/**
 * Configuration for SuperGrid rendering.
 *
 * @property xAxisRange - Range of x-axis (columns)
 * @property yAxisRange - Range of y-axis (rows)
 * @property cellWidth - Width of each cell in pixels
 * @property cellHeight - Height of each cell in pixels
 * @property headerWidth - Width of row header column
 * @property headerHeight - Height of column header row
 *
 * @example
 * const config: GridConfig = {
 *   xAxisRange: { min: 0, max: 11, count: 12 },
 *   yAxisRange: { min: 0, max: 9, count: 10 },
 *   cellWidth: 120,
 *   cellHeight: 60,
 *   headerWidth: 150,
 *   headerHeight: 40
 * };
 */
export interface GridConfig {
  xAxisRange: AxisRange;
  yAxisRange: AxisRange;
  cellWidth: number;
  cellHeight: number;
  headerWidth: number;
  headerHeight: number;
}
