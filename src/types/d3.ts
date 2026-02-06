/**
 * D3 TypeScript Interfaces
 *
 * Comprehensive type definitions for D3.js operations,
 * eliminating all `any` types and providing full type safety.
 */

import * as d3 from 'd3';

// ============================================================================
// Generic D3 Selection Types
// ============================================================================

// D3 Selection type aliases for consistent usage
export type FlexibleSelection<T extends d3.BaseType = d3.BaseType> = d3.Selection<T, unknown, null, undefined>;
export type SVGSelection = FlexibleSelection<SVGSVGElement>;
export type GroupSelection = FlexibleSelection<SVGGElement>;
export type ContainerSelection = FlexibleSelection<d3.BaseType>;

/** Base selection type for any SVG element */
export type D3Selection<TElement extends d3.BaseType = d3.BaseType, TDatum = unknown> =
  d3.Selection<TElement, TDatum, null, undefined>;

/** SVG element selection */
export type D3SVGSelection<TDatum = unknown> =
  d3.Selection<SVGSVGElement, TDatum, null, undefined>;

/** SVG group selection */
export type D3GroupSelection<TDatum = unknown> =
  d3.Selection<SVGGElement, TDatum, null, undefined>;

/** Generic element selection with data binding */
export type D3ElementSelection<TElement extends d3.BaseType, TDatum> =
  d3.Selection<TElement, TDatum, d3.BaseType, unknown>;

// ============================================================================
// Chart Data Types
// ============================================================================

/** Base chart data interface */
export interface ChartDatum {
  [key: string]: string | number | Date | boolean | null | undefined | unknown;
}

/** Network node data */
export interface NetworkNodeDatum extends ChartDatum {
  id: string;
  name?: string;
  group?: string;
  value?: number;
}

/** Network link data */
export interface NetworkLinkDatum extends ChartDatum {
  source: string | NetworkNodeDatum;
  target: string | NetworkNodeDatum;
  weight?: number;
  type?: string;
}

/** Hierarchy node data */
export interface HierarchyDatum extends ChartDatum {
  name: string;
  value?: number;
  children?: HierarchyDatum[];
}

/** Treemap data structure */
export interface TreemapDatum {
  name: string;
  value: number;
  children?: TreemapDatum[];
}

// ============================================================================
// D3 Scale Types
// ============================================================================

/** Union of all scale types used in visualizations */
export type D3Scale =
  | d3.ScaleLinear<number, number>
  | d3.ScaleTime<number, number>
  | d3.ScaleBand<string>
  | d3.ScaleOrdinal<string, string>
  | d3.ScaleSequential<string>
  | d3.ScaleQuantize<string>;

/** Scale accessor function type */
export type ScaleAccessor<T, R = number> = (datum: T) => R | undefined;

/** Color scale specifically typed */
export type D3ColorScale = d3.ScaleOrdinal<string, string>;

// ============================================================================
// Force Simulation Types
// ============================================================================

/** Node datum for D3 force simulation */
export interface SimulationNodeDatum extends d3.SimulationNodeDatum {
  id: string;
  [key: string]: unknown;
}

/** Link datum for D3 force simulation */
export interface SimulationLinkDatum<NodeType extends SimulationNodeDatum = SimulationNodeDatum>
  extends d3.SimulationLinkDatum<NodeType> {
  id?: string;
  [key: string]: unknown;
}

/** Typed force simulation */
export type D3ForceSimulation<NodeType extends SimulationNodeDatum = SimulationNodeDatum> =
  d3.Simulation<NodeType, undefined>;

// ============================================================================
// D3 Generator Types
// ============================================================================

/** Line generator with proper typing */
export type D3LineGenerator<T = ChartDatum> = d3.Line<T>;

/** Area generator with proper typing */
export type D3AreaGenerator<T = ChartDatum> = d3.Area<T>;

/** Arc generator with proper typing */
export type D3ArcGenerator<T = d3.DefaultArcObject> = d3.Arc<unknown, T>;

/** Pie generator with proper typing */
export type D3PieGenerator<T = ChartDatum> = d3.Pie<unknown, T>;

// ============================================================================
// Transition Types
// ============================================================================

/** Generic transition type */
export type D3Transition<TElement extends d3.BaseType = d3.BaseType, TDatum = unknown> =
  d3.Transition<TElement, TDatum, d3.BaseType, unknown>;

/** Transition with specific element and datum types */
export type TypedTransition<TElement extends d3.BaseType, TDatum> =
  d3.Transition<TElement, TDatum, null, undefined>;

// ============================================================================
// Event Handler Types
// ============================================================================

/** Mouse event handler for D3 selections */
export type D3MouseEventHandler<TElement extends d3.BaseType, TDatum> =
  (this: TElement, _event: MouseEvent, d: TDatum) => void;

/** Touch event handler for D3 selections */
export type D3TouchEventHandler<TElement extends d3.BaseType, TDatum> =
  (this: TElement, _event: TouchEvent, d: TDatum) => void;

/** Drag event handler */
export type D3DragEventHandler<TElement extends Element, TDatum> =
  (this: TElement, _event: d3.D3DragEvent<TElement, TDatum, unknown>, d: TDatum) => void;

/** Zoom event handler */
export type D3ZoomEventHandler<TElement extends Element> =
  (this: TElement, _event: d3.D3ZoomEvent<TElement, unknown>) => void;

// ============================================================================
// Axis and Grid Types
// ============================================================================

/** Axis generator type */
export type D3AxisGenerator<Domain> = d3.Axis<Domain>;

/** Tick formatter function */
export type D3TickFormatter<T> = (domainValue: T, _index: number) => string;

// ============================================================================
// Data Join Types
// ============================================================================

/** Enter selection type */
export type D3EnterSelection<TElement extends d3.BaseType, TDatum> =
  d3.Selection<d3.EnterElement, TDatum, TElement, unknown>;

/** Update selection type */
export type D3UpdateSelection<TElement extends d3.BaseType, TDatum> =
  d3.Selection<TElement, TDatum, TElement, unknown>;

/** Exit selection type */
export type D3ExitSelection<TElement extends d3.BaseType, TDatum> =
  d3.Selection<TElement, TDatum, TElement, unknown>;

// ============================================================================
// Layout Types
// ============================================================================

/** Hierarchy node with layout properties */
export interface D3HierarchyNode<T = HierarchyDatum> extends d3.HierarchyNode<T> {
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
}

/** Tree layout node */
export interface D3TreeNode<T = HierarchyDatum> extends d3.HierarchyPointNode<T> {
  // Tree-specific properties
  collapsed?: boolean;
}

/** Treemap node */
export interface D3TreemapNode<T = TreemapDatum> extends d3.HierarchyRectangularNode<T> {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

// ============================================================================
// Drag and Zoom Behavior Types
// ============================================================================

/** Drag behavior type */
export type D3DragBehavior<TElement extends Element, TDatum> =
  d3.DragBehavior<TElement, TDatum, unknown>;

/** Zoom behavior type */
export type D3ZoomBehavior<TElement extends Element> =
  d3.ZoomBehavior<TElement, unknown>;

// Zoom-specific type helpers
export type ZoomBehavior = d3.ZoomBehavior<SVGSVGElement, unknown>;
export type ZoomTransform = d3.ZoomTransform;
export type ZoomSelection = FlexibleSelection<SVGSVGElement>;

// ============================================================================
// Utility Types
// ============================================================================

/** Dimensions interface for chart layouts */
export interface D3ChartDimensions {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/** Color theme interface for charts */
export interface D3ChartTheme {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  background: string;
  border: string;
  grid: string;
  [key: string]: string;
}

/** Accessor function type for extracting values from data */
export type D3Accessor<T, R> = (d: T, i?: number, data?: T[]) => R;

/** Key function for data joins */
export type D3KeyFunction<T> = (d: T, _i: number) => string | number;

// ============================================================================
// Configuration Types
// ============================================================================

/** Chart configuration interface */
export interface D3ChartConfig {
  width?: number;
  height?: number;
  margin?: Partial<D3ChartDimensions['margin']>;
  animate?: boolean;
  duration?: number;
  theme?: D3ChartTheme;
}

/** Axis configuration */
export interface D3AxisConfig {
  scale: D3Scale;
  orientation: 'top' | 'right' | 'bottom' | 'left';
  tickCount?: number;
  tickFormat?: D3TickFormatter<unknown>;
  label?: string;
}

// ============================================================================
// Tooltip Types
// ============================================================================

/** Tooltip data interface */
export interface D3TooltipData {
  title?: string;
  content: string;
  x: number;
  y: number;
}

/** Tooltip selection type */
export type D3TooltipSelection = d3.Selection<HTMLDivElement, D3TooltipData, null, undefined>;

// ============================================================================
// Export utility types for common patterns
// ============================================================================

/** Common chart data with x, y values */
export interface XYChartDatum extends ChartDatum {
  x: number | Date | string;
  y: number;
}

/** Categorical chart data */
export interface CategoricalChartDatum extends ChartDatum {
  category: string;
  value: number;
}

/** Time series data point */
export interface TimeSeriesDatum extends ChartDatum {
  date: Date;
  value: number;
}

// ============================================================================
// Type guards and utilities
// ============================================================================

/** Type guard for checking if a scale has bandwidth method */
export function isScaleBand(scale: D3Scale): scale is d3.ScaleBand<string> {
  return 'bandwidth' in scale && typeof scale.bandwidth === 'function';
}

/** Type guard for checking if a scale has ticks method */
export function isScaleLinear(scale: D3Scale): scale is d3.ScaleLinear<number, number> {
  return 'ticks' in scale && typeof scale.ticks === 'function';
}

/** Type guard for time scale */
export function isScaleTime(scale: D3Scale): scale is d3.ScaleTime<number, number> {
  return 'ticks' in scale && 'nice' in scale;
}

/** Type guard for ordinal scale */
export function isScaleOrdinal(scale: D3Scale): scale is d3.ScaleOrdinal<string, string> {
  return 'domain' in scale && 'range' in scale && !('ticks' in scale);
}

/**
 * Use FlexibleSelection when working with mixed D3 selection types
 * Use specific typed selections (GroupSelection, SVGSelection) when type certainty is required
 *
 * Examples:
 * - FlexibleSelection<d3.BaseType> for containers that may hold any SVG element
 * - GroupSelection for known SVG group elements
 * - SVGSelection for SVG root elements
 * - ContainerSelection for BaseType containers in zoom/drag operations
 */