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
 * SuperDensitySparsity Unified Aggregation Control System (Section 2.5)
 *
 * The Janus density model provides 4-level unified control for semantic zoom
 * across LATCH dimensions with lossless aggregation and Pan × Zoom independence.
 */

/**
 * 4-Level Janus Density Model
 */
export type DensityLevel = 'value' | 'extent' | 'view' | 'region';

/**
 * Pan/Zoom independence modes
 */
export type ExtentDensityMode = 'sparse' | 'populated-only';
export type ValueDensityMode = 'leaf' | 'collapsed';

/**
 * Janus density state combining orthogonal Pan × Zoom controls
 */
export interface JanusDensityState {
  /** Level 1: Value Density - Per-facet zoom (Jan,Feb,Mar → Q1) */
  valueDensity: ValueDensityMode;

  /** Level 2: Extent Density - Extent pan (hide/show empty rows/columns) */
  extentDensity: ExtentDensityMode;

  /** Level 3: View Density - View selector (spreadsheet ↔ matrix modes) */
  viewDensity: 'spreadsheet' | 'matrix' | 'hybrid';

  /** Level 4: Region Density - Region config (mix sparse + dense columns) */
  regionConfig: RegionDensityConfig[];

  /** Per-axis granularity levels */
  axisGranularity: Record<string, number>;

  /** Lossless aggregation preferences */
  aggregationPreferences: AggregationPreferences;
}

/**
 * Region-specific density configuration for mixed sparse/dense columns
 */
export interface RegionDensityConfig {
  /** Region identifier */
  regionId: string;

  /** LATCH axis this region applies to */
  axis: 'L' | 'A' | 'T' | 'C' | 'H';

  /** Facet within the axis */
  facet: string;

  /** Density mode for this region */
  mode: ExtentDensityMode;

  /** Value aggregation level for this region */
  aggregationLevel: number;

  /** Visual weight/prominence */
  visualWeight: 'light' | 'normal' | 'heavy';
}

/**
 * Lossless aggregation preferences
 */
export interface AggregationPreferences {
  /** Default aggregation function */
  defaultFunction: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'first' | 'last';

  /** Per-facet aggregation overrides */
  facetAggregations: Record<string, AggregationFunction>;

  /** Preserve precision for specific data types */
  preservePrecision: boolean;

  /** Show aggregation source in tooltips */
  showAggregationSource: boolean;
}

/**
 * Aggregation function with metadata
 */
export interface AggregationFunction {
  /** SQL aggregate function */
  sqlFunction: string;

  /** Display format for aggregated values */
  displayFormat: string;

  /** Whether this aggregation is reversible */
  isReversible: boolean;

  /** Tooltip template showing source data */
  sourceTooltipTemplate?: string;
}

/**
 * Density change event with performance metrics
 */
export interface DensityChangeEvent {
  /** Previous density state */
  previousState: JanusDensityState;

  /** New density state */
  newState: JanusDensityState;

  /** Which level was changed */
  changedLevel: DensityLevel;

  /** Performance metrics for the change */
  metrics: DensityPerformanceMetrics;

  /** Whether change preserves data integrity */
  dataIntegrityPreserved: boolean;
}

/**
 * Performance metrics for density operations
 */
export interface DensityPerformanceMetrics {
  /** Time to compute aggregation (ms) */
  aggregationTime: number;

  /** Time to render visual change (ms) */
  renderTime: number;

  /** Total operation time (ms) */
  totalTime: number;

  /** Number of cells affected */
  cellsAffected: number;

  /** Data reduction ratio (compressed/original) */
  compressionRatio: number;

  /** Whether operation met 100ms target */
  withinPerformanceTarget: boolean;
}

/**
 * Density aggregation query result
 */
export interface DensityAggregationResult {
  /** Aggregated data rows */
  data: DensityAggregatedRow[];

  /** Aggregation metadata */
  metadata: DensityAggregationMetadata;

  /** SQL query that was executed */
  executedQuery: string;

  /** Query parameters */
  queryParameters: unknown[];

  /** Performance timing */
  timing: DensityPerformanceMetrics;
}

/**
 * Single aggregated data row
 */
export interface DensityAggregatedRow {
  /** Unique identifier for this aggregated cell */
  cellId: string;

  /** Aggregated value */
  value: unknown;

  /** Display-formatted value */
  displayValue: string;

  /** Source data count */
  sourceCount: number;

  /** Source data IDs for drill-down */
  sourceIds: string[];

  /** Aggregation function used */
  aggregationFunction: string;

  /** LATCH dimension path */
  dimensionPath: string;

  /** Whether this is a leaf or intermediate node */
  isLeaf: boolean;
}

/**
 * Metadata for aggregation operation
 */
export interface DensityAggregationMetadata {
  /** Total rows before aggregation */
  sourceRowCount: number;

  /** Rows after aggregation */
  aggregatedRowCount: number;

  /** Compression ratio achieved */
  compressionRatio: number;

  /** Aggregation accuracy preserved */
  accuracyPreserved: boolean;

  /** LATCH axes involved in aggregation */
  involvedAxes: string[];

  /** Granularity levels used per axis */
  granularityLevels: Record<string, number>;
}

/**
 * Default Janus density configuration
 */
export const DEFAULT_JANUS_DENSITY: JanusDensityState = {
  valueDensity: 'leaf',
  extentDensity: 'populated-only',
  viewDensity: 'spreadsheet',
  regionConfig: [],
  axisGranularity: {},
  aggregationPreferences: {
    defaultFunction: 'count',
    facetAggregations: {},
    preservePrecision: true,
    showAggregationSource: true
  }
};

/**
 * Type guards for density types
 */
export const isJanusDensityState = (obj: any): obj is JanusDensityState => {
  return obj &&
    ['leaf', 'collapsed'].includes(obj.valueDensity) &&
    ['sparse', 'populated-only'].includes(obj.extentDensity) &&
    ['spreadsheet', 'matrix', 'hybrid'].includes(obj.viewDensity) &&
    Array.isArray(obj.regionConfig) &&
    typeof obj.axisGranularity === 'object' &&
    obj.aggregationPreferences;
};

export const isDensityChangeEvent = (obj: any): obj is DensityChangeEvent => {
  return obj &&
    obj.previousState &&
    obj.newState &&
    ['value', 'extent', 'view', 'region'].includes(obj.changedLevel) &&
    obj.metrics &&
    typeof obj.dataIntegrityPreserved === 'boolean';
};

export const isDensityAggregationResult = (obj: any): obj is DensityAggregationResult => {
  return obj &&
    Array.isArray(obj.data) &&
    obj.metadata &&
    typeof obj.executedQuery === 'string' &&
    Array.isArray(obj.queryParameters) &&
    obj.timing;
};

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

/**
 * SuperZoom Cartographic Navigation System (Section 2.4)
 *
 * Implements upper-left anchor zoom behavior following Apple Numbers-style
 * cartographic navigation with boundary constraints and 60fps performance.
 */

/**
 * Zoom anchor modes for different navigation behaviors
 */
export type ZoomAnchorMode = 'upper-left' | 'center' | 'cursor';

/**
 * Configuration for cartographic navigation system
 */
export interface CartographicConfig {
  /** Zoom extent limits [min, max] */
  zoomExtent: [number, number];

  /** Zoom anchor behavior */
  anchorMode: ZoomAnchorMode;

  /** Enable boundary constraint enforcement */
  enableBoundaryConstraints: boolean;

  /** Animation duration for smooth transitions (ms) */
  animationDuration: number;

  /** Enable smooth animation easing */
  enableSmoothing: boolean;

  /** Grid content dimensions */
  gridDimensions: {
    width: number;
    height: number;
  };

  /** Viewport dimensions */
  viewportDimensions: {
    width: number;
    height: number;
  };

  /** Optional dataset identifier for state persistence */
  datasetId?: string;

  /** Elastic bounce-back behavior for boundaries */
  elasticBounds?: {
    enabled: boolean;
    resistance: number; // 0-1, how much resistance near boundaries
    bounceStrength: number; // 0-1, strength of bounce-back
  };
}

/**
 * Current cartographic state
 */
export interface CartographicState {
  /** Current zoom scale */
  scale: number;

  /** Current transform (includes pan offset) */
  transform: {
    x: number;
    y: number;
    k: number; // scale (duplicate for d3.ZoomTransform compatibility)
  };

  /** Current anchor point in grid coordinates */
  anchorPoint: {
    x: number;
    y: number;
  };

  /** Whether currently animating */
  isAnimating: boolean;

  /** Boundary constraint status */
  boundaryStatus: {
    atLeftBoundary: boolean;
    atRightBoundary: boolean;
    atTopBoundary: boolean;
    atBottomBoundary: boolean;
  };

  /** Elastic resistance factor (0-1) when near boundaries */
  elasticResistance?: number;

  /** Integration with other SuperGrid systems */
  densityIntegration?: {
    valueDensity: ValueDensityMode;
    extentDensity: ExtentDensityMode;
  };

  /** Header state integration for boundary calculations */
  headerIntegration?: {
    totalHeight: number;
    isExpanded: boolean;
    levels: number;
  };

  /** Performance metrics */
  performance: {
    lastOperationDuration: number;
    averageFrameRate: number;
    frameDrops: number;
  };

  /** Timestamp of last state change */
  lastUpdated: number;
}

/**
 * Boundary constraints for pan operations
 */
export interface BoundaryConstraints {
  /** Left boundary (grid coordinate) */
  left: number;

  /** Right boundary (grid coordinate) */
  right: number;

  /** Top boundary (grid coordinate) */
  top: number;

  /** Bottom boundary (grid coordinate) */
  bottom: number;

  /** Top offset for headers */
  topOffset: number;

  /** Left offset for row headers */
  leftOffset: number;
}

/**
 * Visual feedback state during operations
 */
export interface CartographicVisualFeedback {
  /** Show boundary indicators */
  showBoundaryIndicators: boolean;

  /** Direction of boundary bounce */
  bounceDirection?: 'left' | 'right' | 'top' | 'bottom';

  /** Elastic resistance visualization */
  resistanceIndicator?: {
    strength: number;
    direction: 'horizontal' | 'vertical';
  };

  /** Pan guides during drag operations */
  showPanGuides?: boolean;

  /** Zoom level indicator */
  zoomLevelIndicator?: {
    visible: boolean;
    scale: number;
    percentage: string;
  };
}

/**
 * Callbacks for cartographic events
 */
export interface CartographicCallbacks {
  /** Called when zoom level changes */
  onZoomChange?: (scale: number, state: CartographicState) => void;

  /** Called when pan position changes */
  onPanChange?: (x: number, y: number, state: CartographicState) => void;

  /** Called when overall state changes */
  onStateChange?: (state: CartographicState) => void;

  /** Called when boundary constraints are hit */
  onBoundaryHit?: (boundary: 'left' | 'right' | 'top' | 'bottom', state: CartographicState) => void;

  /** Called when animation starts/stops */
  onAnimationToggle?: (isAnimating: boolean) => void;
}

/**
 * Performance metrics for cartographic operations
 */
export interface CartographicPerformanceMetrics {
  /** Average operation duration (ms) */
  averageOperationTime: number;

  /** Peak operation duration (worst case) */
  peakOperationTime: number;

  /** Frame rate during animations */
  animationFrameRate: number;

  /** Dropped frames during last operation */
  droppedFrames: number;

  /** Total zoom operations performed */
  totalZoomOperations: number;

  /** Total pan operations performed */
  totalPanOperations: number;

  /** Boundary hits per session */
  boundaryHitsPerSession: number;

  /** Animation interrupt rate */
  animationInterruptRate: number;
}

/**
 * Separate control interface for zoom operations
 */
export interface ZoomControlInterface {
  /** Set absolute zoom level */
  zoomTo: (scale: number) => void;

  /** Zoom in by step increment */
  zoomIn: (step?: number) => void;

  /** Zoom out by step increment */
  zoomOut: (step?: number) => void;

  /** Reset zoom to default (1.0) */
  resetZoom: () => void;

  /** Get current zoom level */
  getCurrentZoom: () => number;

  /** Check if can zoom in further */
  canZoomIn: () => boolean;

  /** Check if can zoom out further */
  canZoomOut: () => boolean;
}

/**
 * Separate control interface for pan operations
 */
export interface PanControlInterface {
  /** Pan to absolute position */
  panTo: (x: number, y: number) => void;

  /** Pan by relative offset */
  panBy: (deltaX: number, deltaY: number) => void;

  /** Reset pan to origin */
  resetPan: () => void;

  /** Get current pan position */
  getCurrentPan: () => { x: number; y: number };

  /** Pan to show specific grid cell */
  panToCell: (cellX: number, cellY: number) => void;

  /** Center viewport on grid content */
  centerOnGrid: () => void;
}

/**
 * Combined cartographic control interface
 */
export interface CartographicControlInterface extends ZoomControlInterface, PanControlInterface {
  /** Get complete current state */
  getState: () => CartographicState;

  /** Restore saved state */
  restoreState: (state: CartographicState) => void;

  /** Get current configuration */
  getConfig: () => CartographicConfig;

  /** Update configuration */
  updateConfig: (config: Partial<CartographicConfig>) => void;

  /** Get boundary constraints */
  getBoundaryConstraints: () => BoundaryConstraints;

  /** Update boundary constraints */
  updateBoundaryConstraints: (constraints: Partial<BoundaryConstraints>) => void;

  /** Get visual feedback state */
  getVisualFeedback: () => CartographicVisualFeedback;

  /** Update density system integration */
  updateDensityState: (densityState: { valueDensity: ValueDensityMode; extentDensity: ExtentDensityMode }) => void;

  /** Update header system integration */
  updateHeaderState: (headerState: { totalHeight: number; isExpanded: boolean; levels: number }) => void;

  /** Get performance metrics */
  getPerformanceMetrics: () => CartographicPerformanceMetrics;

  /** Reset all state to defaults */
  reset: () => void;

  /** Clean up resources */
  destroy: () => void;
}

/**
 * Default cartographic configuration
 */
export const DEFAULT_CARTOGRAPHIC_CONFIG: CartographicConfig = {
  zoomExtent: [0.1, 10],
  anchorMode: 'upper-left',
  enableBoundaryConstraints: true,
  animationDuration: 300,
  enableSmoothing: true,
  gridDimensions: { width: 1000, height: 800 },
  viewportDimensions: { width: 800, height: 600 },
  elasticBounds: {
    enabled: true,
    resistance: 0.3,
    bounceStrength: 0.5
  }
};

/**
 * Type guards for cartographic types
 */
export const isCartographicConfig = (obj: any): obj is CartographicConfig => {
  return obj &&
    Array.isArray(obj.zoomExtent) &&
    obj.zoomExtent.length === 2 &&
    ['upper-left', 'center', 'cursor'].includes(obj.anchorMode) &&
    typeof obj.enableBoundaryConstraints === 'boolean' &&
    typeof obj.animationDuration === 'number' &&
    typeof obj.enableSmoothing === 'boolean' &&
    obj.gridDimensions &&
    typeof obj.gridDimensions.width === 'number' &&
    typeof obj.gridDimensions.height === 'number' &&
    obj.viewportDimensions &&
    typeof obj.viewportDimensions.width === 'number' &&
    typeof obj.viewportDimensions.height === 'number';
};

export const isCartographicState = (obj: any): obj is CartographicState => {
  return obj &&
    typeof obj.scale === 'number' &&
    obj.transform &&
    typeof obj.transform.x === 'number' &&
    typeof obj.transform.y === 'number' &&
    typeof obj.transform.k === 'number' &&
    obj.anchorPoint &&
    typeof obj.anchorPoint.x === 'number' &&
    typeof obj.anchorPoint.y === 'number' &&
    typeof obj.isAnimating === 'boolean' &&
    obj.boundaryStatus &&
    obj.performance &&
    typeof obj.lastUpdated === 'number';
};
