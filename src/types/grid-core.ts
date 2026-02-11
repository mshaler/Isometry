/**
 * Core grid types for SuperGrid positioning and data structures.
 *
 * These types define the fundamental data structures for grid layout,
 * positioning, and data organization.
 *
 * @module types/grid-core
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
 * Full position in the grid including both logical coordinates and screen offset.
 */
export interface GridPosition {
  cell: CellPosition;  // Logical grid position
  x: number;           // Screen x coordinate
  y: number;           // Screen y coordinate
}

/**
 * Data for a single grid axis (row or column headers).
 */
export interface AxisData {
  axis: 'x' | 'y' | 'z';          // Which axis this represents
  field: string;                  // Data field name (e.g., 'status', 'priority')
  values: string[];               // Unique values for this axis
  isComputed: boolean;            // Whether values are computed/derived
  range?: AxisRange;              // Coordinate range for this axis
}

/**
 * Complete dataset for grid rendering.
 *
 * @example
 * ```typescript
 * const gridData: GridData = {
 *   cards: [
 *     { id: 'card1', name: 'Task A', x: 0, y: 0, status: 'todo', priority: 'high' },
 *     { id: 'card2', name: 'Task B', x: 1, y: 0, status: 'done', priority: 'low' }
 *   ],
 *   xAxis: {
 *     axis: 'x',
 *     field: 'status',
 *     values: ['todo', 'in-progress', 'done'],
 *     isComputed: false,
 *     range: { min: 0, max: 2, count: 3 }
 *   },
 *   yAxis: {
 *     axis: 'y',
 *     field: 'priority',
 *     values: ['low', 'medium', 'high'],
 *     isComputed: false,
 *     range: { min: 0, max: 2, count: 3 }
 *   },
 *   totalWidth: 800,
 *   totalHeight: 600,
 *   lastUpdated: Date.now()
 * };
 * ```
 */
export interface GridData {
  cards: unknown[];                  // Card data (TODO: replace with proper Card type)
  xAxis: AxisData;              // Column axis configuration
  yAxis: AxisData;              // Row axis configuration
  zAxis?: AxisData;             // Optional third axis for 3D grids
  totalWidth: number;           // Total grid width in pixels
  totalHeight: number;          // Total grid height in pixels
  lastUpdated: number;          // Timestamp of last data update

  // Extended properties for V4 rendering
  cells?: GridCell[];           // Pre-computed grid cells
  rows?: unknown[];             // Row data for grid layout
  columns?: AxisData;           // Column axis (alias for xAxis in some views)
  rowAxis?: AxisData;           // Row axis (alias for yAxis in some views)
  metadata?: Record<string, unknown>; // Additional grid metadata
}

/**
 * Single cell in the grid with associated data.
 *
 * Represents the intersection of row and column axes, containing
 * zero or more cards that match the cell's axis values.
 *
 * @example
 * ```typescript
 * const cell: GridCell = {
 *   position: { x: 1, y: 2 },
 *   xValue: 'in-progress',    // Column axis value
 *   yValue: 'high',           // Row axis value
 *   cards: [
 *     { id: 'card3', name: 'Critical task', status: 'in-progress', priority: 'high' }
 *   ],
 *   count: 1,
 *   isEmpty: false,
 *   screenX: 220,
 *   screenY: 200
 * };
 * ```
 */
export interface GridCell {
  position: CellPosition;       // Logical grid coordinates
  xValue: unknown;                  // Value from x-axis for this cell
  yValue: unknown;                  // Value from y-axis for this cell
  zValue?: unknown;                 // Optional z-axis value
  cards: unknown[];                 // Cards in this cell
  count: number;                // Number of cards (cards.length)
  isEmpty: boolean;             // Whether cell has any cards
  screenX: number;              // Screen x position for rendering
  screenY: number;              // Screen y position for rendering

  // Visual state
  isHighlighted?: boolean;      // Whether cell is highlighted
  isSelected?: boolean;         // Whether cell is selected
  isDragTarget?: boolean;       // Whether cell is a valid drag target

  // Metadata
  metadata?: Record<string, unknown>; // Additional cell-specific data
}

/**
 * Configuration for basic grid rendering and behavior.
 *
 * Core grid configuration that doesn't include advanced features
 * like progressive disclosure or dynamic interactions.
 */
export interface GridConfig {
  // Layout
  columnsPerRow: number;                    // Cards per row in gallery view
  enableHeaders: boolean;                   // Show/hide axis headers
  enableColumnResizing: boolean;            // Allow column width adjustment

  // Features
  enableProgressiveDisclosure: boolean;     // Use progressive disclosure for deep hierarchies
  enableCartographicZoom: boolean;          // Use cartographic zoom navigation

  // Visual
  showEmptyCells: boolean;                  // Render empty cells
  showCellBorders: boolean;                 // Show cell border lines
  showAxisLabels: boolean;                  // Show axis field names

  // Behavior
  allowCellSelection: boolean;              // Enable cell selection
  allowMultiSelection: boolean;             // Enable multi-cell selection
  allowCardDragging: boolean;               // Enable card drag & drop

  // Defaults
  defaultCellWidth: number;                 // Default cell width in pixels
  defaultCellHeight: number;                // Default cell height in pixels
  defaultPadding: number;                   // Default spacing between cells

  // Extended properties for SuperGrid module integration
  enableSelection?: boolean;                // Enable card selection (alias for allowCellSelection)
  enableDragDrop?: boolean;                 // Enable drag and drop (alias for allowCardDragging)
  enableKeyboardNavigation?: boolean;       // Enable keyboard navigation
  selectionMode?: 'single' | 'multi';      // Selection mode

  // Cell/header dimensions for V4 rendering
  cellWidth?: number;                       // Cell width in pixels
  cellHeight?: number;                      // Cell height in pixels
  headerWidth?: number;                     // Header width in pixels
  headerHeight?: number;                    // Header height in pixels
}