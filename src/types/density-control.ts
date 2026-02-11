/**
 * Density Control Types - Janus density system
 *
 * Types for the 4-level Janus density model with orthogonal Pan x Zoom
 * controls. Used by SuperDensityService, SuperDensityRenderer,
 * JanusDensityControls, and related components.
 */

/**
 * Four-level density hierarchy: Value -> Extent -> View -> Region
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
 * Complete Janus density state with orthogonal Pan x Zoom controls.
 *
 * Pan (extent) and Zoom (value) are orthogonal:
 * - Extent density (Pan): ultra-sparse (full Cartesian) <-> populated-only
 * - Value density (Zoom): leaf values (Jan, Feb, Mar) <-> collapsed (Q1)
 */
export interface JanusDensityState {
  /** Value density mode: leaf (finest detail) or collapsed (aggregated) */
  valueDensity: ValueDensityMode;
  /** Extent density mode: sparse (show empty cells) or populated-only */
  extentDensity: ExtentDensityMode;
  /** View density mode: e.g. 'spreadsheet', 'matrix', 'hybrid' */
  viewDensity: string;
  /** Region-specific density configurations */
  regionConfig: RegionDensityConfig[];
  /** Per-axis granularity levels (0-3), keyed by LATCH axis letter */
  axisGranularity: Record<string, number>;
  /** Aggregation preferences for collapsed mode */
  aggregationPreferences: AggregationPreferences;
}

/**
 * Configuration for region-based density control.
 * Regions allow mixing sparse + dense columns in the same grid.
 */
export interface RegionDensityConfig {
  /** Unique identifier for this region */
  regionId: string;
  /** LATCH axis this region applies to (e.g. 'T', 'C', 'H') */
  axis: string;
  /** Facet column name (e.g. 'created_at', 'folder') */
  facet: string;
  /** Extent density mode for this region */
  mode: ExtentDensityMode;
  /** Aggregation granularity level (0-3) */
  aggregationLevel: number;
  /** Visual weight: light, normal, or heavy */
  visualWeight: 'light' | 'normal' | 'heavy';
}

/**
 * User preferences for aggregation behavior
 */
export interface AggregationPreferences {
  /** Default aggregation function (e.g. 'count', 'sum', 'avg') */
  defaultFunction: string;
  /** Per-facet aggregation overrides */
  facetAggregations: Record<string, string>;
  /** Whether to preserve full numeric precision */
  preservePrecision: boolean;
  /** Whether to display aggregation source info */
  showAggregationSource: boolean;
}

/**
 * Event triggered when density changes
 */
export interface DensityChangeEvent {
  /** State before the change */
  previousState: JanusDensityState;
  /** State after the change */
  newState: JanusDensityState;
  /** Which density level was changed */
  changedLevel: DensityLevel;
  /** Performance metrics for this change */
  metrics: DensityPerformanceMetrics;
  /** Whether lossless aggregation was maintained */
  dataIntegrityPreserved: boolean;
}

/**
 * Performance metrics for density operations
 */
export interface DensityPerformanceMetrics {
  /** Time spent on SQL aggregation (ms) */
  aggregationTime: number;
  /** Time spent on D3 rendering (ms) */
  renderTime: number;
  /** Total operation time (ms) */
  totalTime: number;
  /** Number of cells affected by the operation */
  cellsAffected: number;
  /** Ratio of aggregated rows to source rows */
  compressionRatio: number;
  /** Whether the operation completed within the performance target */
  withinPerformanceTarget: boolean;
}

/**
 * Result of density aggregation operation
 */
export interface DensityAggregationResult {
  /** Aggregated data rows for rendering */
  data: DensityAggregatedRow[];
  /** Metadata about the aggregation */
  metadata: DensityAggregationMetadata;
  /** The SQL query that was executed */
  executedQuery: string;
  /** Parameters passed to the SQL query */
  queryParameters: unknown[];
  /** Performance timing for this aggregation */
  timing: DensityPerformanceMetrics;
  /** Janus density state used for this aggregation (used by renderer) */
  janusState?: JanusDensityState;
  /** Alias for data, used by renderer */
  aggregatedRows?: DensityAggregatedRow[];
}

/**
 * Single row in aggregated density result
 */
export interface DensityAggregatedRow {
  /** Unique cell identifier */
  cellId: string;
  /** Primary value (count, id, or name) */
  value: unknown;
  /** Formatted display value */
  displayValue: string;
  /** Number of source rows aggregated into this cell */
  sourceCount: number;
  /** IDs of source rows (when available) */
  sourceIds: string[];
  /** Aggregation function used */
  aggregationFunction: string;
  /** LATCH dimension path for this row */
  dimensionPath: string;
  /** Whether this is a leaf-level (non-aggregated) row */
  isLeaf: boolean;
  /** X coordinate for grid/matrix rendering */
  x?: number;
  /** Y coordinate for grid/matrix rendering */
  y?: number;
  /** Display label */
  label?: string;
  /** Sparsity ratio for this cell (0 = fully populated, 1 = fully sparse) */
  sparsityRatio?: number;
  /** Density level for this cell */
  densityLevel?: DensityLevel;
  /** Number of items aggregated (alias for sourceCount, used by renderer) */
  aggregationCount?: number;
  /** Optional metadata for tooltip display */
  metadata?: {
    totalValue?: number;
    averageValue?: number;
    [key: string]: unknown;
  };
}

/**
 * Metadata about density aggregation process
 */
export interface DensityAggregationMetadata {
  /** Number of rows in the source data before aggregation */
  sourceRowCount: number;
  /** Number of rows after aggregation */
  aggregatedRowCount: number;
  /** Ratio of aggregated to source rows */
  compressionRatio: number;
  /** Whether full accuracy was preserved during aggregation */
  accuracyPreserved: boolean;
  /** LATCH axes involved in the aggregation */
  involvedAxes: string[];
  /** Per-axis granularity levels used */
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

// Type guards

export const isJanusDensityState = (obj: unknown): obj is JanusDensityState => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    (o.valueDensity === 'leaf' || o.valueDensity === 'collapsed') &&
    (o.extentDensity === 'sparse' || o.extentDensity === 'populated-only') &&
    typeof o.viewDensity === 'string' &&
    Array.isArray(o.regionConfig) &&
    typeof o.axisGranularity === 'object' &&
    typeof o.aggregationPreferences === 'object'
  );
};

export const isDensityChangeEvent = (obj: unknown): obj is DensityChangeEvent => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    isJanusDensityState(o.previousState) &&
    isJanusDensityState(o.newState) &&
    ['value', 'extent', 'view', 'region'].includes(o.changedLevel as string) &&
    typeof o.metrics === 'object' &&
    typeof o.dataIntegrityPreserved === 'boolean'
  );
};

export const isDensityAggregationResult = (obj: unknown): obj is DensityAggregationResult => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    Array.isArray(o.data) &&
    typeof o.metadata === 'object' &&
    typeof o.executedQuery === 'string' &&
    typeof o.timing === 'object'
  );
};
