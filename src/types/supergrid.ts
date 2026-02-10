/**
 * SuperGrid types - Main export file for all SuperGrid-related types.
 *
 * This module re-exports types from focused modules to maintain
 * backward compatibility while organizing types by concern.
 *
 * @module types/supergrid
 */

// Re-export core grid types
export type {
  CellPosition,
  AxisRange,
  GridPosition,
  AxisData,
  GridData,
  GridCell,
  GridConfig
} from './grid-core';

// Re-export progressive disclosure types
export type {
  ProgressiveDisclosureConfig,
  ProgressiveDisclosureState,
  LevelGroup,
  LevelPickerTab,
  ZoomControlState,
  ProgressivePerformanceMetrics,
  ProgressiveDisclosureEvents
} from './progressive-disclosure';

export {
  DEFAULT_PROGRESSIVE_CONFIG
} from './progressive-disclosure';

// Re-export dynamic interaction types
export type {
  SuperDynamicConfig,
  AxisSlotConfig,
  DragState,
  DropZone,
  GridReflowOptions,
  AxisChangeEvent,
  DragFeedbackState,
  DynamicInteractionEvents
} from './dynamic-interaction';

export {
  DEFAULT_SUPER_DYNAMIC_CONFIG
} from './dynamic-interaction';

// Additional types that weren't in the core modules
// (These would need to be extracted from the original file if they exist)

/**
 * View state for SuperGrid rendering and interaction
 */
export interface ViewState {
  // View configuration
  currentView: 'grid' | 'kanban' | 'timeline' | 'network';
  gridMode: 'anchor' | 'bipolar';           // Grid coordinate system mode

  // Zoom and pan state
  zoomLevel: number;                        // Current zoom factor
  panOffset: { x: number; y: number };     // Pan offset from origin

  // Selection state
  selectedCells: CellPosition[];            // Selected grid cells
  focusedCell: CellPosition | null;        // Currently focused cell
  selectedCards: string[];                 // Selected card IDs

  // UI state
  isHeadersVisible: boolean;                // Whether headers are shown
  isGridLinesVisible: boolean;              // Whether grid lines are shown
  isDensityControlsVisible: boolean;        // Whether density controls are shown
}

/**
 * Performance metrics for SuperGrid rendering
 */
export interface RenderingMetrics {
  lastRenderTime: number;                   // Time of last render (ms)
  averageRenderTime: number;                // Average render time over recent renders
  cardCount: number;                        // Number of cards rendered
  cellCount: number;                        // Number of cells rendered
  visibleCardCount: number;                 // Number of cards in viewport
  memoryUsageMB: number;                    // Estimated memory usage
  frameRate: number;                        // Current rendering frame rate
}

/**
 * Default configurations for backward compatibility
 */
export const DEFAULT_GRID_CONFIG: GridConfig = {
  columnsPerRow: 5,
  enableHeaders: true,
  enableColumnResizing: false,
  enableProgressiveDisclosure: false,
  enableCartographicZoom: false,
  showEmptyCells: false,
  showCellBorders: true,
  showAxisLabels: true,
  allowCellSelection: true,
  allowMultiSelection: true,
  allowCardDragging: true,
  defaultCellWidth: 200,
  defaultCellHeight: 120,
  defaultPadding: 8
};

export const DEFAULT_VIEW_STATE: ViewState = {
  currentView: 'grid',
  gridMode: 'anchor',
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 },
  selectedCells: [],
  focusedCell: null,
  selectedCards: [],
  isHeadersVisible: true,
  isGridLinesVisible: true,
  isDensityControlsVisible: true
};