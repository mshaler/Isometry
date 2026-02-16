/**
 * SuperGrid CSS Grid Types
 *
 * Core data model for the React + CSS Grid SuperGrid implementation.
 * Follows PAFV (Planes → Axes → Facets → Values) model.
 */

import type React from 'react';

// ============================================================================
// LATCH Axis Types
// ============================================================================

/** LATCH axis type: Location, Alphabet, Time, Category, Hierarchy */
export type LATCHAxisType = 'L' | 'A' | 'T' | 'C' | 'H';

/**
 * Configuration for a grid axis (row or column)
 */
export interface AxisConfig {
  /** LATCH axis type */
  type: LATCHAxisType;

  /** Facet being displayed (e.g., 'folder', 'category', 'year_quarter') */
  facet: string;

  /** Hierarchical tree of values */
  tree: AxisNode;
}

/**
 * A node in the axis hierarchy tree
 */
export interface AxisNode {
  /** Display label */
  label: string;

  /** Unique identifier */
  id: string;

  /** Child nodes (if any) */
  children?: AxisNode[];

  /** Leaf count (computed) - used for spanning */
  leafCount?: number;

  /** Is this expandable? (has hidden children) */
  expandable?: boolean;

  /** Is this node currently expanded? */
  expanded?: boolean;
}

// ============================================================================
// Data Cell Types
// ============================================================================

/**
 * A data cell in the grid
 */
export interface DataCell {
  /** Row path: array of IDs from root to leaf */
  rowPath: string[];

  /** Column path: array of IDs from root to leaf */
  colPath: string[];

  /** Cell value (display) */
  value: string | number | null;

  /** Optional: Raw value for calculations */
  rawValue?: unknown;

  /** Optional: Cell-specific styling */
  style?: React.CSSProperties;
}

/** Path from root to a cell coordinate */
export type RowPath = string[];
export type ColPath = string[];

// ============================================================================
// Grid Placement Types
// ============================================================================

/**
 * CSS Grid placement coordinates
 */
export interface GridPlacement {
  gridRowStart: number;
  gridRowEnd: number;
  gridColumnStart: number;
  gridColumnEnd: number;
}

// ============================================================================
// Tree Metrics Types
// ============================================================================

/**
 * Flattened node with computed layout metrics
 */
export interface FlatNode {
  /** Original axis node */
  node: AxisNode;

  /** Depth in tree (0-indexed) */
  depth: number;

  /** First leaf index this node spans */
  leafStart: number;

  /** Number of leaves this node spans */
  leafCount: number;

  /** ID path from root */
  path: string[];

  /** Is this a leaf node? */
  isLeaf: boolean;
}

/**
 * Computed metrics for a tree hierarchy
 */
export interface TreeMetrics {
  /** Maximum depth of the tree (for header row/column count) */
  depth: number;

  /** Total leaf count (for data row/column count) */
  leafCount: number;

  /** Flattened nodes with computed positions */
  flatNodes: FlatNode[];
}

// ============================================================================
// Layout Types
// ============================================================================

/**
 * Header cell with computed placement
 */
export interface HeaderCell {
  /** Original axis node */
  node: AxisNode;

  /** CSS Grid placement */
  placement: GridPlacement;

  /** Depth in hierarchy */
  depth: number;

  /** Path from root */
  path: string[];

  /** Is this a leaf node? */
  isLeaf: boolean;
}

/**
 * Corner cell (MiniNav area)
 */
export interface CornerCellData {
  /** CSS Grid placement */
  placement: GridPlacement;

  /** Display label */
  label: string;

  /** Row index in corner area */
  row: number;

  /** Column index in corner area */
  col: number;
}

/**
 * Data cell position with leaf references
 */
export interface DataCellPosition {
  /** Row leaf node */
  rowLeaf: FlatNode;

  /** Column leaf node */
  colLeaf: FlatNode;

  /** CSS Grid placement */
  placement: GridPlacement;
}

/**
 * Complete grid layout computed from axis configurations
 */
export interface GridLayout {
  /** Row axis metrics */
  rowMetrics: TreeMetrics;

  /** Column axis metrics */
  colMetrics: TreeMetrics;

  /** CSS Grid template strings */
  gridTemplate: {
    columns: string;
    rows: string;
  };

  /** Corner cells */
  cornerCells: CornerCellData[];

  /** Row headers */
  rowHeaders: HeaderCell[];

  /** Column headers */
  colHeaders: HeaderCell[];

  /** Data cell positions */
  dataCells: DataCellPosition[];

  /** Number of row header columns */
  rowHeaderDepth: number;

  /** Number of column header rows */
  colHeaderDepth: number;
}

// ============================================================================
// Theme Types
// ============================================================================

/**
 * SuperGrid theme configuration
 */
export interface SuperGridTheme {
  /** Theme name */
  name: string;

  /** Corner cell background */
  corner: string;

  /** Row header background */
  rowHeader: string;

  /** Column header level 0 background */
  colHeaderL0: string;

  /** Column header level 1+ background */
  colHeaderL1: string;

  /** Data cell background */
  data: string;

  /** Border color */
  border: string;

  /** Text color */
  text: string;
}

/** Available theme names */
export type SuperGridThemeName = 'reference' | 'nextstep' | 'modern' | 'dark';

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * SuperGrid component props
 */
export interface SuperGridProps {
  /** Row axis hierarchy (maps to Y plane) */
  rowAxis: AxisConfig;

  /** Column axis hierarchy (maps to X plane) */
  columnAxis: AxisConfig;

  /** The actual data values */
  data: DataCell[];

  /** Optional: Custom cell renderer */
  renderCell?: (
    cell: DataCell | undefined,
    rowPath: RowPath,
    colPath: ColPath
  ) => React.ReactNode;

  /** Optional: Theme name or custom theme */
  theme?: SuperGridThemeName | SuperGridTheme;

  /** Callback when a data cell is clicked */
  onCellClick?: (
    cell: DataCell | undefined,
    rowPath: RowPath,
    colPath: ColPath
  ) => void;

  /** Callback when a header is clicked */
  onHeaderClick?: (type: 'row' | 'column', path: string[]) => void;

  /** Callback when selection changes */
  onSelectionChange?: (selected: { rowPath: RowPath; colPath: ColPath } | null) => void;
}

/**
 * Grid container props
 */
export interface GridContainerProps {
  columns: string;
  rows: string;
  children: React.ReactNode;
}

/**
 * Corner cell props
 */
export interface CornerCellProps {
  placement: GridPlacement;
  label: string;
}

/**
 * Row header props
 */
export interface RowHeaderProps {
  node: AxisNode;
  placement: GridPlacement;
  depth: number;
  onClick?: () => void;
}

/**
 * Column header props
 */
export interface ColHeaderProps {
  node: AxisNode;
  placement: GridPlacement;
  depth: number;
  onClick?: () => void;
}

/**
 * Data cell props
 */
export interface DataCellProps {
  placement: GridPlacement;
  cell?: DataCell;
  rowPath: RowPath;
  colPath: ColPath;
  renderCell?: (
    cell: DataCell | undefined,
    rowPath: RowPath,
    colPath: ColPath
  ) => React.ReactNode;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * SuperGrid context value
 */
export interface SuperGridContextValue {
  /** Current theme */
  theme: SuperGridTheme;

  /** Cell click handler */
  onCellClick?: (
    cell: DataCell | undefined,
    rowPath: RowPath,
    colPath: ColPath
  ) => void;

  /** Currently selected cell */
  selectedCell: { rowPath: RowPath; colPath: ColPath } | null;

  /** Set selected cell */
  setSelectedCell: (cell: { rowPath: RowPath; colPath: ColPath } | null) => void;
}
