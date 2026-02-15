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

/** SVG group selection */
export type D3GroupSelection<TDatum = unknown> =
  d3.Selection<SVGGElement, TDatum, null, undefined>;

// ============================================================================
// Chart Data Types
// ============================================================================

/** Base chart data interface */
export interface ChartDatum {
  [key: string]: string | number | Date | boolean | null | undefined | unknown;
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
// Utility Types
// ============================================================================

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
 * Use D3GroupSelection for known SVG group elements with typed datum
 */

// ============================================================================
// D3 Component Props Types (consolidated from d3-types.ts)
// ============================================================================

import type { Node } from './node';

/** Props interface for D3ListView component */
export interface D3ListViewProps {
  /** SQL query to execute and observe for live data */
  sql?: string;
  /** Parameters for the SQL query */
  queryParams?: unknown[];
  /** Direct data array (alternative to SQL query) */
  data?: Node[];
  /** Callback when node is clicked */
  onNodeClick?: (node: Node) => void;
}

/** Props interface for D3GridView component */
export interface D3GridViewProps {
  /** SQL query to execute and observe for live data */
  sql?: string;
  /** Parameters for the SQL query */
  queryParams?: unknown[];
  /** Direct data array (alternative to SQL query) */
  data?: Node[];
  /** Callback when node is clicked */
  onNodeClick?: (node: Node) => void;
}