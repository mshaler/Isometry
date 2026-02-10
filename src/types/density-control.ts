/**
 * Density Control Types - Janus density system
 *
 * Extracted from supergrid.old.ts - contains types for the Janus
 * density model with orthogonal pan/zoom controls.
 */

/**
 * Four-level density hierarchy: Value → Extent → View → Region
 */
export type DensityLevel = 'value' | 'extent' | 'view' | 'region';

/**
 * Extent density modes - how much of the data space to show
 */
export type ExtentDensityMode = 'sparse' | 'populated-only';

/**
 * Value density modes - level of detail for individual values
 */
export type ValueDensityMode = 'leaf' | 'collapsed';

/**
 * Complete Janus density state with orthogonal Pan×Zoom controls.
 *
 * Pan (extent) and Zoom (value) are orthogonal:
 * - Extent density (Pan): ultra-sparse (full Cartesian) ↔ populated-only
 * - Value density (Zoom): leaf values (Jan, Feb, Mar) ↔ collapsed (Q1)
 */
export interface JanusDensityState {
  // Pan axis: data extent coverage
  extentMode: ExtentDensityMode;
  extentLevel: number; // 0-10 scale
  sparsityThreshold: number; // Percentage threshold for showing empty cells

  // Zoom axis: value detail level
  valueMode: ValueDensityMode;
  valueLevel: number; // 0-10 scale
  aggregationThreshold: number; // Item count threshold for aggregation

  // Combined state
  densityLevel: DensityLevel;
  isOptimal: boolean; // Whether current settings provide good UX

  // Performance metrics
  renderTime: number; // Last render time (ms)
  cellCount: number; // Number of rendered cells
  cardCount: number; // Number of rendered cards
}

/**
 * Configuration for region-based density control
 */
export interface RegionDensityConfig {
  enableAdaptiveDensity: boolean;
  regionSize: { width: number; height: number };
  densityThresholds: {
    sparse: number; // Cards per region for sparse mode
    medium: number;
    dense: number;
  };
  aggregationRules: {
    maxCardsPerCell: number;
    preferredAggregations: string[];
  };
  performanceTargets: {
    maxRenderTime: number;
    maxMemoryUsage: number;
  };
}

/**
 * User preferences for aggregation behavior
 */
export interface AggregationPreferences {
  preferredFunctions: AggregationFunction[];
  hideZeroValues: boolean;
  showPercentages: boolean;
  colorCodeValues: boolean;
  enableInteractiveDrillDown: boolean;
}

/**
 * Aggregation function configuration
 */
export interface AggregationFunction {
  id: string;
  name: string;
  function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';
  field: string;
  format?: 'number' | 'currency' | 'percentage';
  isDefault: boolean;
}

/**
 * Event triggered when density changes
 */
export interface DensityChangeEvent {
  oldState: JanusDensityState;
  newState: JanusDensityState;
  trigger: 'user' | 'automatic' | 'performance';
  timestamp: number;
}

/**
 * Performance metrics for density control decisions
 */
export interface DensityPerformanceMetrics {
  currentDensity: DensityLevel;
  renderTime: number;
  memoryUsage: number;
  cardCount: number;
  cellCount: number;
  aggregatedCellCount: number;

  // Thresholds
  renderThreshold: number;
  memoryThreshold: number;

  // Recommendations
  recommendedDensity: DensityLevel;
  shouldOptimize: boolean;
}

/**
 * Result of density aggregation operation
 */
export interface DensityAggregationResult {
  level: DensityLevel;
  rows: DensityAggregatedRow[];
  metadata: DensityAggregationMetadata;
  performance: {
    aggregationTime: number;
    originalRowCount: number;
    aggregatedRowCount: number;
    compressionRatio: number;
  };
}

/**
 * Single row in aggregated density result
 */
export interface DensityAggregatedRow {
  position: { x: number; y: number };
  count: number;
  values: { [field: string]: any };
  aggregations: { [functionId: string]: number };
  originalCards: string[]; // Card IDs that were aggregated
  metadata: {
    density: DensityLevel;
    aggregationMethod: string;
    confidence: number; // 0-1 confidence in aggregation accuracy
  };
}

/**
 * Metadata about density aggregation process
 */
export interface DensityAggregationMetadata {
  sourceQuery: string;
  aggregationFunctions: AggregationFunction[];
  densitySettings: JanusDensityState;
  timestamp: number;
  version: string;

  // Quality metrics
  dataQuality: {
    completeness: number; // 0-1 percentage of non-null values
    consistency: number; // 0-1 measure of data consistency
    accuracy: number; // 0-1 estimated accuracy of aggregations
  };

  // Performance info
  performance: {
    aggregationTime: number;
    memoryUsed: number;
    cacheHits: number;
    cacheMisses: number;
  };
}

/**
 * Default Janus density configuration
 */
export const DEFAULT_JANUS_DENSITY: JanusDensityState = {
  extentMode: 'populated-only',
  extentLevel: 5,
  sparsityThreshold: 0.1,
  valueMode: 'leaf',
  valueLevel: 7,
  aggregationThreshold: 10,
  densityLevel: 'view',
  isOptimal: true,
  renderTime: 0,
  cellCount: 0,
  cardCount: 0
};

// Type guards

export const isJanusDensityState = (obj: any): obj is JanusDensityState => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ['sparse', 'populated-only'].includes(obj.extentMode) &&
    ['leaf', 'collapsed'].includes(obj.valueMode) &&
    typeof obj.extentLevel === 'number' &&
    typeof obj.valueLevel === 'number'
  );
};

export const isDensityChangeEvent = (obj: any): obj is DensityChangeEvent => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    isJanusDensityState(obj.oldState) &&
    isJanusDensityState(obj.newState) &&
    ['user', 'automatic', 'performance'].includes(obj.trigger)
  );
};

export const isDensityAggregationResult = (obj: any): obj is DensityAggregationResult => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ['value', 'extent', 'view', 'region'].includes(obj.level) &&
    Array.isArray(obj.rows) &&
    typeof obj.metadata === 'object'
  );
};