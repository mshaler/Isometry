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

/**
 * Progressive Disclosure Configuration for SuperStack Headers
 *
 * Controls behavior when hierarchical headers exceed visual complexity thresholds.
 * Implements Section 2.1 of SuperGrid specification.
 */
export interface ProgressiveDisclosureConfig {
  maxVisibleLevels: number;          // Maximum header levels visible simultaneously (default: 3)
  autoGroupThreshold: number;        // Header depth threshold triggering progressive disclosure (default: 5)
  semanticGroupingEnabled: boolean;  // Enable semantic grouping (time/location patterns)
  dataGroupingFallback: boolean;     // Enable data density grouping as fallback
  transitionDuration: number;        // Animation duration for level changes (ms)
  lazyLoadingBuffer: number;         // Number of levels to pre-load off-screen
  enableZoomControls: boolean;       // Show zoom in/out controls
  enableLevelPicker: boolean;        // Show level picker tabs
  persistLevelState: boolean;        // Persist selected levels across sessions
}

/**
 * Progressive Disclosure State
 *
 * Tracks current state of progressive disclosure system for persistence
 * and UI coordination between React controls and D3 visualization.
 */
export interface ProgressiveDisclosureState {
  currentLevels: number[];           // Currently visible header levels
  availableLevelGroups: LevelGroup[]; // Computed level groups for navigation
  activeLevelTab: number;            // Active level picker tab index
  zoomLevel: number;                 // Current zoom level (0 = most detailed)
  isTransitioning: boolean;          // Whether level transition is in progress
  lastTransitionTime: number;        // Timestamp of last level change
}

/**
 * Level Group for organizing deep hierarchies
 *
 * Groups related header levels for simplified navigation and visual management.
 * Supports both semantic grouping (time/location patterns) and data density grouping.
 */
export interface LevelGroup {
  id: string;                        // Unique group identifier
  name: string;                      // Display name (e.g., "Time Periods", "Dense Detail")
  type: 'semantic' | 'density';      // Grouping strategy
  levels: number[];                  // Header levels included in this group
  nodeCount: number;                 // Total nodes across all levels in group
  pattern?: string;                  // Semantic pattern name (for semantic groups)
  density?: number;                  // Average node density (for density groups)
  isRecommended?: boolean;           // Whether this group is recommended for current data
}

/**
 * Level Picker Tab State
 *
 * UI state for level picker tabs that allow navigation between level groups.
 * Coordinates with React HeaderLevelPicker component.
 */
export interface LevelPickerTab {
  id: string;                        // Tab identifier
  label: string;                     // Display label for tab
  levels: number[];                  // Header levels shown when tab is active
  nodeCount: number;                 // Total nodes in these levels
  isActive: boolean;                 // Whether tab is currently active
  isRecommended?: boolean;           // Whether this tab is recommended default
  groupType?: 'semantic' | 'density'; // Type of grouping this tab represents
}

/**
 * Zoom Control State
 *
 * State for 3D camera-style zoom controls that provide hierarchical navigation.
 * Enables stairstepping up/down hierarchy levels.
 */
export interface ZoomControlState {
  currentLevel: number;              // Current zoom level (0 = most detailed)
  maxLevel: number;                  // Maximum available zoom level
  canZoomIn: boolean;                // Whether zoom in operation is possible
  canZoomOut: boolean;               // Whether zoom out operation is possible
  levelLabels: string[];             // Human-readable labels for each zoom level
  steppingDirection?: 'up' | 'down'; // Current stepping direction for animations
}

/**
 * Progressive Header Performance Metrics
 *
 * Tracks performance of progressive disclosure system for optimization
 * and user experience monitoring.
 */
export interface ProgressivePerformanceMetrics {
  levelTransitionDuration: number;   // Time for last level transition (ms)
  averageTransitionTime: number;     // Rolling average of transition times
  renderFramesDropped: number;       // Frames dropped during last transition
  lazyLoadingHitRate: number;        // Percentage of requests served from lazy cache
  semanticGroupingAccuracy: number;  // Accuracy of semantic pattern detection
  userLevelNavigationFrequency: number; // Average level changes per session
}

/**
 * Default progressive disclosure configuration
 *
 * Optimized for common use cases with enterprise-grade performance.
 */
export const DEFAULT_PROGRESSIVE_CONFIG: ProgressiveDisclosureConfig = {
  maxVisibleLevels: 3,
  autoGroupThreshold: 5,
  semanticGroupingEnabled: true,
  dataGroupingFallback: true,
  transitionDuration: 300,
  lazyLoadingBuffer: 2,
  enableZoomControls: true,
  enableLevelPicker: true,
  persistLevelState: true
};

/**
 * Type guard for ProgressiveDisclosureState validation
 */
export const isProgressiveDisclosureState = (obj: any): obj is ProgressiveDisclosureState => {
  return obj &&
    Array.isArray(obj.currentLevels) &&
    Array.isArray(obj.availableLevelGroups) &&
    typeof obj.activeLevelTab === 'number' &&
    typeof obj.zoomLevel === 'number' &&
    typeof obj.isTransitioning === 'boolean' &&
    typeof obj.lastTransitionTime === 'number';
};

/**
 * Type guard for LevelGroup validation
 */
export const isLevelGroup = (obj: any): obj is LevelGroup => {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    ['semantic', 'density'].includes(obj.type) &&
    Array.isArray(obj.levels) &&
    typeof obj.nodeCount === 'number';
};

/**
 * SuperDynamic Axis Repositioning Types
 *
 * Section 2.2 of SuperGrid specification: drag-and-drop axis repositioning
 * enabling "any axis maps to any plane" as direct manipulation.
 */

/**
 * Configuration for SuperDynamic axis repositioning system
 */
export interface SuperDynamicConfig {
  /** Canvas dimensions */
  width: number;
  height: number;

  /** Enable real-time reflow preview during drag */
  enableReflowPreview: boolean;

  /** Position and size configuration for each axis slot */
  axisSlots: {
    x: AxisSlotConfig;
    y: AxisSlotConfig;
    z: AxisSlotConfig;
  };

  /** Default options for grid reflow animations */
  defaultReflowOptions: GridReflowOptions;
}

/**
 * Position and size configuration for an axis slot
 */
export interface AxisSlotConfig {
  x: number;          // X position in pixels
  y: number;          // Y position in pixels
  width: number;      // Width in pixels
  height: number;     // Height in pixels
}

/**
 * Current drag operation state
 */
export interface DragState {
  /** Axis being dragged */
  axisId: string;

  /** Slot the axis was dragged from */
  sourceSlot: 'x' | 'y' | 'z';

  /** Mouse position when drag started */
  startPosition: { x: number; y: number };

  /** Current mouse position */
  currentPosition: { x: number; y: number };

  /** Whether drag is currently active */
  isDragging: boolean;

  /** Timestamp when drag started */
  startTime: number;
}

/**
 * Drop zone configuration and state
 */
export interface DropZone {
  /** Slot identifier */
  slot: 'x' | 'y' | 'z';

  /** Position and dimensions */
  bounds: AxisSlotConfig;

  /** Whether zone is currently highlighted */
  isHighlighted: boolean;

  /** Whether zone accepts the current drag */
  acceptsDrag: boolean;
}

/**
 * Grid reflow animation configuration
 */
export interface GridReflowOptions {
  /** Animation duration in milliseconds */
  duration: number;

  /** Easing function type */
  easing: 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';

  /** Enable preview during reflow */
  enablePreview: boolean;

  /** Preserve card selection state */
  preserveSelection: boolean;
}

/**
 * Axis assignment change event
 */
export interface AxisChangeEvent {
  /** Previous axis mapping */
  oldMapping: Record<'x' | 'y' | 'z', string | null>;

  /** New axis mapping */
  newMapping: Record<'x' | 'y' | 'z', string | null>;

  /** Which axis was changed */
  changedAxis: 'x' | 'y' | 'z';

  /** Whether change was from drag-drop or programmatic */
  trigger: 'drag' | 'programmatic';

  /** Performance metrics */
  metrics: {
    reflowDuration: number;
    renderTime: number;
    frameDrops: number;
  };
}

/**
 * Visual feedback state during drag operations
 */
export interface DragFeedbackState {
  /** Ghost element showing dragged axis */
  ghostVisible: boolean;

  /** Drop zone highlighting */
  highlightedZones: ('x' | 'y' | 'z')[];

  /** Connection lines between axis and target */
  showConnectionLines: boolean;

  /** Grid cells affected by potential reflow */
  previewCells: string[];
}

/**
 * Performance tracking for SuperDynamic operations
 */
export interface SuperDynamicMetrics {
  /** Average reflow duration over recent operations */
  averageReflowTime: number;

  /** Peak reflow duration (worst case) */
  peakReflowTime: number;

  /** Frame drops during last reflow */
  lastFrameDrops: number;

  /** Total axis repositioning operations */
  totalRepositions: number;

  /** User interaction patterns */
  interactionPatterns: {
    mostUsedAxisSwaps: Array<{ from: string; to: string; count: number }>;
    averageSessionSwaps: number;
    cancelRate: number; // Percentage of drags cancelled
  };
}

/**
 * Type guards for SuperDynamic types
 */
export const isSuperDynamicConfig = (obj: any): obj is SuperDynamicConfig => {
  return obj &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number' &&
    typeof obj.enableReflowPreview === 'boolean' &&
    obj.axisSlots &&
    obj.axisSlots.x &&
    obj.axisSlots.y &&
    obj.axisSlots.z &&
    obj.defaultReflowOptions;
};

export const isDragState = (obj: any): obj is DragState => {
  return obj &&
    typeof obj.axisId === 'string' &&
    ['x', 'y', 'z'].includes(obj.sourceSlot) &&
    obj.startPosition &&
    obj.currentPosition &&
    typeof obj.isDragging === 'boolean' &&
    typeof obj.startTime === 'number';
};

export const isAxisChangeEvent = (obj: any): obj is AxisChangeEvent => {
  return obj &&
    obj.oldMapping &&
    obj.newMapping &&
    ['x', 'y', 'z'].includes(obj.changedAxis) &&
    ['drag', 'programmatic'].includes(obj.trigger) &&
    obj.metrics;
};
