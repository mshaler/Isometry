// Type definitions barrel export
export * from './node';
export * from './filter';
export * from './view';
export * from './pafv';

// Isometry LPG types
export * from './lpg';

// SuperGrid coordinate system
export * from './coordinates';

// SuperGrid types - exclude DensityLevel to avoid conflict with pafv.ts DensityLevel
// The numeric DensityLevel (1|2|3|4) from pafv.ts is the canonical one used by PAFVContext
export {
  // Grid core types
  type CellPosition,
  type AxisRange,
  type GridPosition,
  type AxisData,
  type GridData,
  type GridCell,
  type GridConfig,
  // Progressive disclosure types
  type ProgressiveDisclosureConfig,
  type ProgressiveDisclosureState,
  type LevelGroup,
  type LevelPickerTab,
  type ZoomControlState,
  type ProgressivePerformanceMetrics,
  type ProgressiveDisclosureEvents,
  DEFAULT_PROGRESSIVE_CONFIG,
  // Dynamic interaction types
  type SuperDynamicConfig,
  type AxisSlotConfig,
  type DragState,
  type DropZone,
  type GridReflowOptions,
  type AxisChangeEvent,
  type DragFeedbackState,
  type DynamicInteractionEvents,
  DEFAULT_SUPER_DYNAMIC_CONFIG,
  // Density control types (excluding DensityLevel)
  type ExtentDensityMode,
  type ValueDensityMode,
  type JanusDensityState,
  type RegionDensityConfig,
  type AggregationPreferences,
  type DensityChangeEvent,
  type DensityPerformanceMetrics,
  type DensityAggregationResult,
  type DensityAggregatedRow,
  type DensityAggregationMetadata,
  DEFAULT_JANUS_DENSITY,
  // Cartographic types
  type CartographicConfig,
  type CartographicState,
  type BoundaryConstraints,
  type CartographicVisualFeedback,
  type CartographicCallbacks,
  type CartographicControlInterface,
  type CartographicPerformanceMetrics,
  DEFAULT_CARTOGRAPHIC_CONFIG,
  // Dynamic axis
  type SuperDynamicMetrics,
  // View state and metrics
  type SuperGridViewState,
  type RenderingMetrics,
  DEFAULT_GRID_CONFIG,
  DEFAULT_VIEW_STATE
} from './supergrid';
