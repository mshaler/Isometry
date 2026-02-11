/**
 * SuperDensityRenderer - Re-export from modular implementation
 *
 * This file now delegates to the modular SuperDensityRenderer implementation
 * in the SuperDensityRenderer/ directory for better maintainability.
 */

// Re-export from the modular implementation
// Named re-exports for types
export type {
  DensityRenderConfig,
  DensityVisualState,
  DensityAggregationResult,
  DensityAggregatedRow,
  JanusDensityState,
  RenderTiming,
  RendererComponents,
  RendererScales
} from './SuperDensityRenderer/index';

// Import and re-export the class as named export only
import { SuperDensityRenderer } from './SuperDensityRenderer/index';
export { SuperDensityRenderer };