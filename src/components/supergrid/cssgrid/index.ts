/**
 * SuperGrid CSS Grid Implementation
 *
 * Barrel export for the new CSS Grid-based SuperGrid.
 * This module provides a pure React + CSS Grid alternative to the D3-based SuperGrid.
 */

// Main component
export { SuperGridCSS } from '../SuperGridCSS';
export { SuperGridCSS as default } from '../SuperGridCSS';

// Context and hooks
export { SuperGridCSSProvider, useSuperGridContext, themes, getTheme } from '../SuperGridCSSContext';
export { useGridLayout, getCellKey, parseCellKey } from '../hooks/useGridLayout';

// Utilities
export { computeTreeMetrics, getLeafNodes, getHeaderNodes, findNodeById, findNodeByPath } from '../utils/treeMetrics';
export {
  computeRowHeaderPlacement,
  computeColHeaderPlacement,
  computeDataCellPlacement,
  computeCornerCellPlacement,
  generateGridTemplate,
  placementToStyle,
} from '../utils/gridPlacement';

// Components
export { GridContainer } from '../components/GridContainer';
export { CornerCell } from '../components/CornerCell';
export { RowHeader } from '../components/RowHeader';
export { ColHeader } from '../components/ColHeader';
export { DataCell } from '../components/DataCell';

// Types
export type {
  // Core types
  LATCHAxisType,
  AxisConfig,
  AxisNode,
  DataCell as DataCellType,
  RowPath,
  ColPath,

  // Grid placement
  GridPlacement,
  FlatNode,
  TreeMetrics,

  // Layout types
  HeaderCell,
  CornerCellData,
  DataCellPosition,
  GridLayout,

  // Theme types
  SuperGridTheme,
  SuperGridThemeName,

  // Component props
  SuperGridProps,
  GridContainerProps,
  CornerCellProps,
  RowHeaderProps,
  ColHeaderProps,
  DataCellProps,

  // Context types
  SuperGridContextValue,
} from '../types';
