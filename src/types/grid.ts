/**
 * Grid Types - Unified CellData Structure for Janus Density Model & Hierarchical Headers
 *
 * This module provides the unified data structure for all grid cells across
 * density levels, supporting the Janus model's orthogonal Pan × Zoom controls,
 * hierarchical PAFV headers, and future Super* feature integration.
 *
 * Architecture: Future-ready with minimal Super* hooks for structural preparation
 * while focusing on immediate Janus density requirements and hierarchical headers.
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
  enableColumnResizing?: boolean;
  enableProgressiveDisclosure?: boolean;
  enableCartographicZoom?: boolean;
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

// ===============================================================
// HIERARCHICAL HEADER TYPES FOR PHASE 36 SUPERGRID HEADERS
// ===============================================================

/**
 * Header node for hierarchical header structures using d3-hierarchy
 *
 * Supports unlimited nesting depth with visual spanning across parent-child relationships.
 * Each node represents a dimension value in the LATCH/PAFV axis hierarchy.
 */
export interface HeaderNode {
  id: string;                     // Unique identifier for the header node
  label: string;                  // Display label for the header
  parentId?: string;              // Parent node ID for hierarchy construction
  facet: string;                  // LATCH facet (location, alphabet, time, category, hierarchy)
  value: any;                     // The actual data value represented
  count: number;                  // Number of data items in this group
  level: number;                  // Depth level in the hierarchy (0 = root)
  span: number;                   // Number of child columns this header spans
  children?: HeaderNode[];        // Child header nodes

  // Visual and interaction state
  isExpanded: boolean;            // Whether children are currently visible
  isLeaf: boolean;                // True if this node has no children

  // Layout calculation properties
  x: number;                      // Calculated x position in header layout
  y: number;                      // Calculated y position in header layout
  width: number;                  // Calculated width for this header cell
  height: number;                 // Calculated height for this header cell

  // Content alignment based on span length and content type
  textAlign: ContentAlignment;    // How to align text within the header cell

  // Click zones for interaction
  labelZone: {                    // Zone for expand/collapse operations (~32px)
    x: number;
    y: number;
    width: number;
    height: number;
  };
  bodyZone: {                     // Zone for data selection (remaining area)
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Complete header hierarchy structure for a grid axis
 *
 * Contains the full tree of header nodes with metadata for rendering
 * and interaction management.
 */
export interface HeaderHierarchy {
  axis: string;                   // LATCH axis (L, A, T, C, H)
  rootNodes: HeaderNode[];        // Top-level header nodes
  allNodes: HeaderNode[];         // Flattened array of all nodes for quick lookup
  maxDepth: number;               // Maximum nesting depth in this hierarchy
  totalWidth: number;             // Total calculated width of all headers
  totalHeight: number;            // Total calculated height of header area

  // State for expand/collapse operations
  expandedNodeIds: Set<string>;   // Set of currently expanded node IDs
  collapsedSubtrees: Set<string>; // Set of collapsed subtree root IDs

  // Configuration for this hierarchy
  config: SpanCalculationConfig;  // Span calculation configuration
  lastUpdated: number;            // Timestamp of last recalculation
}

/**
 * Configuration for hybrid span calculation system
 *
 * User-decided approach: data-proportional + content-based minimums + equal distribution fallback
 */
export interface SpanCalculationConfig {
  // Primary sizing approach: data-proportional
  dataProportionalWeight: number;     // Weight for data count in sizing (0-1)

  // Content-based minimums to prevent illegibility
  minWidthPerCharacter: number;       // Minimum pixels per character in header text
  absoluteMinWidth: number;           // Absolute minimum width for any header
  absoluteMaxWidth: number;           // Maximum width to prevent excessively wide headers

  // Equal distribution fallback
  useEqualFallback: boolean;          // Use equal distribution when data counts are uniform
  uniformDataThreshold: number;       // Coefficient of variation threshold for "uniform" data

  // Content-aware padding
  paddingScale: number;               // Scale factor for padding based on text length
  iconWidth: number;                  // Width reserved for expand/collapse icons

  // Performance optimization
  recalculationThreshold: number;     // Data change threshold requiring recalculation
  enableCaching: boolean;             // Whether to cache span calculations
}

/**
 * Content alignment rules for header text based on span and content type
 *
 * User-decided: center for short spans, left for long spans,
 * numeric right-align, dates left-align
 */
export enum ContentAlignment {
  CENTER = 'center',          // Short spans (1-3 words like 'Q1', 'Jan')
  LEFT = 'left',             // Long spans (multi-word categories)
  RIGHT = 'right',           // Numeric content regardless of span
  DATE_LEFT = 'date-left'    // Date content (special left-align treatment)
}

/**
 * State persistence interface for header expansion/collapse
 *
 * Per-dataset and per-app state persistence as required by user decisions
 */
export interface HeaderStateManager {
  datasetId: string;              // Current dataset identifier
  appInstanceId: string;          // App instance for multi-session support

  // State data
  expandedNodes: Record<string, Set<string>>;    // Per-axis expanded node sets
  userPreferences: {
    defaultExpansionLevel: number;               // Default depth to expand to
    rememberLastState: boolean;                  // Whether to persist between sessions
    autoCollapseThreshold: number;               // Auto-collapse if more than N nodes
  };

  // Persistence methods
  saveState(): void;
  loadState(): void;
  clearState(): void;
  resetToDefaults(): void;
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

/**
 * Default configuration for hierarchical header span calculations
 *
 * Implements the user-decided hybrid approach: data-proportional + content-based minimums + equal fallback
 */
export const DEFAULT_SPAN_CONFIG: SpanCalculationConfig = {
  dataProportionalWeight: 0.7,       // 70% weight to data proportions
  minWidthPerCharacter: 8,            // 8px per character minimum
  absoluteMinWidth: 80,               // 80px absolute minimum width
  absoluteMaxWidth: 300,              // 300px maximum to prevent excessive width
  useEqualFallback: true,             // Enable equal distribution fallback
  uniformDataThreshold: 0.15,         // Use equal if coefficient of variation < 0.15
  paddingScale: 1.2,                  // 20% extra padding for content
  iconWidth: 32,                      // 32px reserved for expand/collapse icon
  recalculationThreshold: 0.1,        // Recalculate if 10% data change
  enableCaching: true                 // Enable calculation caching
};

/**
 * Type guard for HeaderNode validation
 */
export const isHeaderNode = (obj: any): obj is HeaderNode => {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.label === 'string' &&
    typeof obj.facet === 'string' &&
    typeof obj.count === 'number' &&
    typeof obj.level === 'number' &&
    typeof obj.span === 'number' &&
    typeof obj.isExpanded === 'boolean' &&
    typeof obj.isLeaf === 'boolean' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number';
};

/**
 * Type guard for HeaderHierarchy validation
 */
export const isHeaderHierarchy = (obj: any): obj is HeaderHierarchy => {
  return obj &&
    typeof obj.axis === 'string' &&
    Array.isArray(obj.rootNodes) &&
    Array.isArray(obj.allNodes) &&
    typeof obj.maxDepth === 'number' &&
    typeof obj.totalWidth === 'number' &&
    typeof obj.totalHeight === 'number' &&
    obj.expandedNodeIds instanceof Set &&
    obj.collapsedSubtrees instanceof Set;
};

// ===============================================================
// COLUMN RESIZE TYPES FOR PHASE 39 MISSING REQUIREMENT
// ===============================================================

/**
 * Column resize event data for drag operations
 *
 * Provides detailed context for resize operations with performance optimization
 * and state persistence integration.
 */
export interface ColumnResizeEvent {
  nodeId: string;                 // Header node being resized
  originalWidth: number;          // Width before resize operation
  newWidth: number;               // Width after resize operation
  event: MouseEvent;              // Original drag event for context
  deltaX: number;                 // Change in X position
  isComplete: boolean;            // Whether resize operation is complete
}

/**
 * Column width state for persistence across sessions
 *
 * Manages per-dataset and per-app column width preferences with
 * zero-serialization sql.js integration.
 */
export interface ColumnWidthState {
  datasetId: string;              // Dataset identifier for state isolation
  appContext: string;             // App context for multi-session support
  columnWidths: Record<string, number>;  // Column ID to width mapping
  lastUpdated: string;            // ISO timestamp of last update
  version?: number;               // Version for migration support
}

/**
 * Resize handle configuration for column interactions
 *
 * Controls visual and behavioral aspects of column resize handles
 * with 60fps performance optimization.
 */
export interface ResizeHandleConfig {
  edgeDetectionZone: number;      // Pixels from right edge for resize detection (default 4px)
  minColumnWidth: number;         // Minimum allowed column width (default 50px)
  maxColumnWidth?: number;        // Maximum allowed column width (optional)
  animationDuration: number;      // Animation duration in ms (default 0 for RAF)
  cursorChangeThreshold: number;  // Distance threshold for cursor state changes
  enableSmoothing: boolean;       // Whether to use RAF for smooth updates
}

/**
 * Extended HeaderNode interface with resize state
 *
 * Adds resize-specific properties to existing HeaderNode interface
 * without breaking existing functionality.
 */
export interface ResizableHeaderNode extends HeaderNode {
  originalWidth?: number;         // Stored width at resize start for delta calculations
  isResizing?: boolean;           // Current resize state flag
  resizeStartX?: number;          // X coordinate when resize started
  minWidth?: number;              // Node-specific minimum width override
  maxWidth?: number;              // Node-specific maximum width override
}

/**
 * Resize operation state tracking
 *
 * Internal state management for active resize operations
 * with performance monitoring and error recovery.
 */
export interface ResizeOperationState {
  isActive: boolean;              // Whether a resize is currently active
  targetNodeId: string | null;    // Node currently being resized
  startTime: number;              // Timestamp of resize start
  frameCount: number;             // Number of animation frames rendered
  lastFrameTime: number;          // Timestamp of last frame update
  pendingUpdate: {               // Batched update for RAF optimization
    nodeId: string;
    newWidth: number;
  } | null;
}

/**
 * Type guard for ColumnResizeEvent validation
 */
export const isColumnResizeEvent = (obj: any): obj is ColumnResizeEvent => {
  return obj &&
    typeof obj.nodeId === 'string' &&
    typeof obj.originalWidth === 'number' &&
    typeof obj.newWidth === 'number' &&
    obj.event instanceof MouseEvent &&
    typeof obj.deltaX === 'number' &&
    typeof obj.isComplete === 'boolean';
};

/**
 * Type guard for ColumnWidthState validation
 */
export const isColumnWidthState = (obj: any): obj is ColumnWidthState => {
  return obj &&
    typeof obj.datasetId === 'string' &&
    typeof obj.appContext === 'string' &&
    typeof obj.columnWidths === 'object' &&
    obj.columnWidths !== null &&
    typeof obj.lastUpdated === 'string';
};

/**
 * Default resize handle configuration
 *
 * Optimized for 60fps performance with smooth user experience
 */
export const DEFAULT_RESIZE_CONFIG: ResizeHandleConfig = {
  edgeDetectionZone: 4,           // 4px edge detection zone
  minColumnWidth: 50,             // 50px minimum to prevent disappearing columns
  maxColumnWidth: 600,            // 600px maximum to prevent excessive width
  animationDuration: 0,           // Use RAF instead of CSS transitions
  cursorChangeThreshold: 2,       // 2px threshold for cursor changes
  enableSmoothing: true           // Enable RAF-based smoothing
};