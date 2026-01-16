/**
 * CardBoard Component System - Type Definitions
 *
 * Core types aligned with PAFV + LATCH + GRAPH architecture.
 * See: cardboard-architecture-truth.md
 */

import type * as d3 from 'd3';

// ============================================
// LATCH Types (from architecture truth)
// Location, Alphabet, Time, Category, Hierarchy
// ============================================

/** The five fundamental organizing axes */
export type LATCHAxis = 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy';

/** LATCH coordinates for any Value (Node or Edge) */
export interface LATCHCoordinates {
  /** Spatial position - coordinates or named location */
  location?: string | [number, number];
  /** Lexical ordering - name, title, label */
  alphabet?: string;
  /** Temporal position - any date field */
  time?: Date | string;
  /** Taxonomic membership - project, status, tags */
  category?: string | string[];
  /** Ordinal ranking - priority, importance (1-5 typically) */
  hierarchy?: number;
}

// ============================================
// GRAPH Types
// Link, Nest, Sequence, Affinity
// ============================================

/** Edge types in the graph (GRAPH joins, LATCH separates) */
export type GraphEdgeType = 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';

// ============================================
// LPG Types (Labeled Property Graph)
// Nodes + Edges are both "Values" (Cards)
// ============================================

/** Base properties shared by all Values */
export interface BaseValue {
  /** Unique identifier */
  id: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Soft delete timestamp (if deleted) */
  deletedAt?: Date;
  /** LATCH coordinates for this value */
  latch: LATCHCoordinates;
}

/** Node types in CardBoard */
export type NodeType =
  | 'Task'
  | 'Note'
  | 'Person'
  | 'Project'
  | 'Event'
  | 'Resource'
  | 'Custom';

/** A Node value - entities like tasks, people, projects */
export interface NodeValue extends BaseValue {
  type: 'node';
  /** Classification of the node */
  nodeType: NodeType;
  /** Display name */
  name: string;
  /** Rich text content (markdown) */
  content?: string;
  /** Arbitrary properties */
  properties: Record<string, unknown>;
}

/** An Edge value - relationships between nodes */
export interface EdgeValue extends BaseValue {
  type: 'edge';
  /** Type of relationship */
  edgeType: GraphEdgeType;
  /** Source node ID */
  sourceId: string;
  /** Target node ID */
  targetId: string;
  /** Human-readable label */
  label?: string;
  /** Relationship strength (0-1) */
  weight?: number;
  /** Is this a directed relationship? */
  directed: boolean;
  /** Arbitrary properties */
  properties: Record<string, unknown>;
}

/** Union type: all Values are either Nodes or Edges */
export type CardValue = NodeValue | EdgeValue;

/** Type guard for NodeValue */
export function isNode(value: CardValue): value is NodeValue {
  return value.type === 'node';
}

/** Type guard for EdgeValue */
export function isEdge(value: CardValue): value is EdgeValue {
  return value.type === 'edge';
}

// ============================================
// D3 Selection Types
// ============================================

/** Generic D3 selection type */
export type D3Selection<
  GElement extends d3.BaseType = d3.BaseType,
  Datum = unknown,
  PElement extends d3.BaseType = d3.BaseType,
  PDatum = unknown,
> = d3.Selection<GElement, Datum, PElement, PDatum>;

/** D3 transition type */
export type D3Transition<
  GElement extends d3.BaseType = d3.BaseType,
  Datum = unknown,
  PElement extends d3.BaseType = d3.BaseType,
  PDatum = unknown,
> = d3.Transition<GElement, Datum, PElement, PDatum>;

// ============================================
// Component Types
// ============================================

/** Component lifecycle hooks */
export interface ComponentLifecycle<TData> {
  /** Called when component is first created */
  create?: (container: D3Selection<HTMLElement, TData>) => void;
  /** Called on every render */
  render: (selection: D3Selection<HTMLElement, TData>) => void;
  /** Called when data updates */
  update?: (selection: D3Selection<HTMLElement, TData>) => void;
  /** Called when component is removed */
  destroy?: (selection: D3Selection<HTMLElement, TData>) => void;
}

/** Base component function signature */
export type ComponentFunction<TData, TElement extends d3.BaseType = HTMLElement> = (
  selection: D3Selection<TElement, TData>,
) => D3Selection<TElement, TData>;

// ============================================
// View Projection Types (PAFV)
// Planes → Axes → Facets → Values
// ============================================

/** How LATCH axes map to visual planes */
export interface ViewProjection {
  /** Axis mapped to horizontal (x) plane */
  xAxis: LATCHAxis;
  /** Axis mapped to vertical (y) plane */
  yAxis: LATCHAxis;
  /** Optional axis mapped to depth (z) plane - for stacking/layering */
  zAxis?: LATCHAxis;
}

/** Available view types */
export type ViewType = 'grid' | 'kanban' | 'network' | 'timeline' | 'calendar';

/** View configuration */
export interface ViewConfig {
  type: ViewType;
  projection: ViewProjection;
  /** View-specific options */
  options?: Record<string, unknown>;
}

// ============================================
// Event Types
// ============================================

/** CardBoard custom event */
export interface CardboardEvent<TData = unknown> {
  /** Event type name */
  type: string;
  /** The CardValue that triggered the event */
  target: CardValue;
  /** Additional event data */
  data?: TData;
  /** Original DOM event if applicable */
  originalEvent?: Event;
}

/** Event handler function */
export type EventHandler<TData = unknown> = (event: CardboardEvent<TData>) => void;

/** Common event types */
export interface CommonEvents {
  click: EventHandler<{ id: string }>;
  dblclick: EventHandler<{ id: string }>;
  select: EventHandler<{ id: string; selected: boolean }>;
  hover: EventHandler<{ id: string; hovering: boolean }>;
  focus: EventHandler<{ id: string }>;
  blur: EventHandler<{ id: string }>;
}

// ============================================
// Canvas Types
// ============================================

/** Canvas dimensions */
export interface CanvasDimensions {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
}

/** Canvas padding */
export interface CanvasPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Background pattern types */
export type BackgroundPattern = 'solid' | 'dots' | 'grid' | 'none';

// ============================================
// Component Variant Types
// ============================================

/** Card visual variants */
export type CardVariant = 'default' | 'glass' | 'elevated' | 'outline';

/** Button variants */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'success';

/** Size presets */
export type Size = 'sm' | 'md' | 'lg';

// ============================================
// Utility Types
// ============================================

/** Make specific properties required */
export type RequiredProps<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Make specific properties optional */
export type OptionalProps<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Deep partial type */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
