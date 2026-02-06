/**
 * Grid Types - Unified CellData Structure for Janus Density Model
 *
 * This module provides the unified data structure for all grid cells across
 * density levels, supporting the Janus model's orthogonal Pan × Zoom controls
 * and future Super* feature integration.
 *
 * Architecture: Future-ready with minimal Super* hooks for structural preparation
 * while focusing on immediate Janus density requirements.
 */

import { type Node } from './node';

/**
 * Core unified data structure for grid cells
 *
 * Supports all density levels in the Janus model:
 * - Sparse: Individual cards with full details
 * - Dense: Count badges with aggregated information
 * - Smooth morphing transitions between states
 *
 * @interface CellData
 */
export interface CellData {
  // Core data - unified across all density levels
  cards: Node[];
  densityLevel: number;           // 0=sparse, 3=collapsed per Janus model
  aggregationType: 'none' | 'group' | 'rollup';

  // Janus model orthogonal controls (Pan × Zoom)
  panLevel: number;               // Extent control (0=all data, 3=viewport only)
  zoomLevel: number;              // Value control (0=leaf values, 3=summary)

  // Position in grid coordinate system
  row: number;
  column: number;
  x: number;                      // SVG pixel coordinates
  y: number;                      // SVG pixel coordinates

  // Super* feature hooks (minimal implementation, structural preparation)
  selectionCoords?: GridSelectionCoords;
  expansionState?: CellExpansionState;
  eventDelegation?: CellEventHandlers;

  // Additional metadata for transitions and rendering
  transitionState?: CellTransitionState;
  renderMetadata?: CellRenderMetadata;
}

/**
 * Grid data structure for SuperGrid
 */
export interface GridData {
  cards: any[];
  headers: AxisData[];
  dimensions: {
    rows: number;
    columns: number;
  };
}

/**
 * Grid configuration for SuperGrid
 */
export interface GridConfig {
  columnsPerRow?: number;
  enableHeaders?: boolean;
  enableSelection?: boolean;
  enableKeyboardNavigation?: boolean;
}

/**
 * Grid position for layout calculations
 */
export interface GridPosition {
  row: number;
  col: number;
  id: string;
}

/**
 * Axis data for headers
 */
export interface AxisData {
  id: string;
  label: string;
  facet: string;
  value: any;
  count: number;
  span: number;
}

/**
 * Grid selection coordinate system for Super* features
 *
 * Multi-dimensional selection supporting nested headers and depth traversal
 */
export interface GridSelectionCoords {
  row: number;
  col: number;
  depth: number;              // Z-axis depth for nested headers
  spanX?: number;             // Multi-cell selection width
  spanY?: number;             // Multi-cell selection height
  anchorPoint?: 'top-left' | 'center';
}

/**
 * Cell expansion states for SuperSize feature integration
 */
export type CellExpansionState = 'collapsed' | 'inline' | 'modal' | 'preview';

/**
 * Event delegation system for cell interactions
 */
export interface CellEventHandlers {
  onSelect?: (cell: CellData, event: PointerEvent) => void;
  onExpand?: (cell: CellData, expansionType: CellExpansionState) => void;
  onFilter?: (cell: CellData, filterType: 'include' | 'exclude') => void;
  onDrill?: (cell: CellData, direction: 'down' | 'across') => void;
}

/**
 * Cell transition state for morphing animations
 */
export interface CellTransitionState {
  isTransitioning: boolean;
  fromDensity: number;
  toDensity: number;
  progress: number;           // 0-1 animation progress
  easing: 'ease-out' | 'ease-in-out';
  duration: number;           // milliseconds
}

/**
 * Cell rendering metadata for D3.js optimization
 */
export interface CellRenderMetadata {
  lastRendered: number;       // timestamp
  renderCount: number;        // for performance tracking
  isDirty: boolean;           // needs re-render
  cacheKey: string;           // for virtual scrolling cache
  boundingBox?: {             // for collision detection
    width: number;
    height: number;
    x: number;
    y: number;
  };
}

/**
 * Configuration for cell density morphing
 */
export interface DensityMorphConfig {
  thresholds: {
    sparseToGroup: number;    // card count where grouping starts
    groupToRollup: number;    // card count where rollup begins
    rollupToCollapse: number; // card count where full collapse occurs
  };
  transitions: {
    duration: number;         // animation duration in ms
    easing: string;          // CSS easing function
    stagger: number;         // stagger delay between cards
  };
  visual: {
    countBadgeMinSize: number;
    countBadgeMaxSize: number;
    cardStackOffset: number;
    cardStackMaxVisible: number;
  };
}

/**
 * Cell size configuration for different density levels
 */
export interface CellSizeConfig {
  sparse: { width: number; height: number };
  group: { width: number; height: number };
  rollup: { width: number; height: number };
  collapsed: { width: number; height: number };
}

/**
 * Virtual grid cell data for virtual scrolling integration
 */
export interface VirtualGridCell {
  virtualIndex: number;       // Virtual item index from TanStack
  realIndex: number;          // Actual data index
  cellData: CellData;         // The core cell data
  isVisible: boolean;         // Currently in viewport
  estimatedSize: number;      // For virtual scrolling size estimation
}

/**
 * Grid layout configuration
 */
export interface GridLayoutConfig {
  cellSizes: CellSizeConfig;
  morphConfig: DensityMorphConfig;
  virtualScrolling: {
    estimatedCellSize: number;
    overscan: number;
    enableDynamicSizing: boolean;
  };
  performance: {
    maxVisibleCells: number;
    renderBatchSize: number;
    updateThrottle: number;   // ms between updates
  };
}

/**
 * Type guards for cell data validation
 */
export const isCellData = (obj: any): obj is CellData => {
  return obj &&
    Array.isArray(obj.cards) &&
    typeof obj.densityLevel === 'number' &&
    typeof obj.aggregationType === 'string' &&
    typeof obj.panLevel === 'number' &&
    typeof obj.zoomLevel === 'number' &&
    typeof obj.row === 'number' &&
    typeof obj.column === 'number' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number';
};

export const isVirtualGridCell = (obj: any): obj is VirtualGridCell => {
  return obj &&
    typeof obj.virtualIndex === 'number' &&
    typeof obj.realIndex === 'number' &&
    isCellData(obj.cellData) &&
    typeof obj.isVisible === 'boolean' &&
    typeof obj.estimatedSize === 'number';
};

/**
 * Default configurations for immediate use
 */
export const DEFAULT_DENSITY_CONFIG: DensityMorphConfig = {
  thresholds: {
    sparseToGroup: 2,
    groupToRollup: 5,
    rollupToCollapse: 20
  },
  transitions: {
    duration: 200,
    easing: 'ease-out',
    stagger: 50
  },
  visual: {
    countBadgeMinSize: 16,
    countBadgeMaxSize: 32,
    cardStackOffset: 4,
    cardStackMaxVisible: 3
  }
};

export const DEFAULT_CELL_SIZES: CellSizeConfig = {
  sparse: { width: 120, height: 80 },
  group: { width: 100, height: 60 },
  rollup: { width: 80, height: 40 },
  collapsed: { width: 60, height: 30 }
};

export const DEFAULT_GRID_LAYOUT: GridLayoutConfig = {
  cellSizes: DEFAULT_CELL_SIZES,
  morphConfig: DEFAULT_DENSITY_CONFIG,
  virtualScrolling: {
    estimatedCellSize: 80,
    overscan: 10,
    enableDynamicSizing: true
  },
  performance: {
    maxVisibleCells: 1000,
    renderBatchSize: 50,
    updateThrottle: 16  // ~60fps
  }
};