/**
 * SuperDensityRenderer Types
 */

import type {
  JanusDensityState,
  DensityAggregationResult,
  DensityAggregatedRow,
  RegionDensityConfig
} from '@/types/supergrid';

export interface DensityRenderConfig {
  /** Container dimensions */
  width: number;
  height: number;
  /** Cell sizing */
  cellWidth: number;
  cellHeight: number;
  /** Margins */
  margin: { top: number; right: number; bottom: number; left: number };
  /** Transition duration */
  transitionDuration: number;
  /** Color schemes */
  colorScheme: {
    leaf: string[];
    collapsed: string[];
    sparse: string[];
    populated: string[];
  };
  /** Visual feedback */
  showAggregationIndicators: boolean;
  showPerformanceMetrics: boolean;
  enableHoverDetails: boolean;
}

export interface DensityVisualState {
  mode: 'grid' | 'matrix' | 'hybrid';
  selectedCells: Set<string>;
  hoveredCell: string | null;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  isAnimating: boolean;
  lastRenderTime: number;
  renderCount: number;
}

export interface RendererComponents {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  container: d3.Selection<SVGGElement, unknown, null, undefined>;
  gridGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  overlayGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  tooltipDiv: d3.Selection<HTMLDivElement, unknown, null, undefined>;
}

export interface RendererScales {
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  colorScale: d3.ScaleOrdinal<string, string>;
  sizeScale: d3.ScaleLinear<number, number>;
}

export interface RenderTiming {
  startTime: number;
  endTime: number;
  duration: number;
  cellCount: number;
  mode: string;
}

// Re-export types
export type {
  JanusDensityState,
  DensityAggregationResult,
  DensityAggregatedRow,
  RegionDensityConfig
};