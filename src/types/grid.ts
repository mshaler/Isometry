/**
 * Grid Types - Shared interfaces for SuperGrid components
 *
 * These types are used across utils, components, and services
 * to maintain proper dependency boundaries.
 */

import type { Node } from './node';

/**
 * Column header data for grid rendering
 */
export interface ColumnHeaderData {
  id: string;
  label: string;
  logicalX: number;
  width: number;
}

/**
 * Row header data for grid rendering
 */
export interface RowHeaderData {
  id: string;
  label: string;
  logicalY: number;
  height: number;
}

/**
 * Data cell representation in the grid
 */
export interface DataCellData {
  id: string;
  node: Node;
  logicalX: number;
  logicalY: number;
  value: string;
}

/**
 * D3 coordinate system for grid positioning
 */
export interface D3CoordinateSystem {
  originX: number;
  originY: number;
  cellWidth: number;
  cellHeight: number;
  pattern?: unknown; // OriginPattern type
  scale?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  logicalToScreen: (logicalX: number, logicalY: number) => { x: number; y: number };
  screenToLogical: (screenX: number, screenY: number) => { x: number; y: number };
}

/**
 * Missing types and constants that need to be defined
 * TODO: Properly implement these based on actual requirements
 */

// Header hierarchy types for SuperStackProgressive
export interface HeaderNode {
  id: string;
  label: string;
  level: number;
  children: HeaderNode[];
  parent?: HeaderNode;
  parentId?: string;
  data?: unknown;

  /** Facet identifier for semantic grouping (e.g., 'year', 'category') */
  facet?: string;

  // Layout properties
  x: number;
  y: number;
  width: number;
  height: number;
  span: number;

  // State properties
  isLeaf: boolean;
  isExpanded: boolean;
  isVisible: boolean;
  count: number;

  // Interaction zones
  clickZones?: {
    expand: { x: number; y: number; width: number; height: number };
    resize: { x: number; y: number; width: number; height: number };
    select: { x: number; y: number; width: number; height: number };
  };

  // Legacy zones (for compatibility)
  labelZone?: { x: number; y: number; width: number; height: number };
  bodyZone?: { x: number; y: number; width: number; height: number };
}

export interface HeaderHierarchy {
  rootNodes: HeaderNode[];
  allNodes: HeaderNode[];
  maxDepth: number;
  totalWidth: number;
  // Extended fields used by HeaderLayoutService
  axis?: string;
  totalHeight?: number;
  expandedNodeIds?: Set<string>;
  collapsedSubtrees?: Set<string>;
  config?: unknown;
  lastUpdated?: number;

  // Helper methods for node lookup (optional -- implemented by concrete classes)
  getNode?: (nodeId: string) => HeaderNode | undefined;
  getChildren?: (nodeId: string) => HeaderNode[];
  getAllNodes?: () => HeaderNode[];
}

// Content alignment enum
export enum ContentAlignment {
  LEFT = 'left',
  RIGHT = 'right',
  CENTER = 'center',
  JUSTIFY = 'justify'
}

// Span configuration for headers
export interface SpanConfig {
  enabled: boolean;
  maxSpan: number;
  autoCollapse: boolean;
}

export const DEFAULT_SPAN_CONFIG: SpanConfig = {
  enabled: true,
  maxSpan: 5,
  autoCollapse: true
};

// Resize configuration for headers
export interface ResizeConfig {
  enabled: boolean;
  minWidth: number;
  maxWidth: number;
  snap: boolean;
}

export const DEFAULT_RESIZE_CONFIG: ResizeConfig = {
  enabled: true,
  minWidth: 60,
  maxWidth: 400,
  snap: true
};

// Grid configuration interface
export interface GridConfig {
  id: string;
  columns: ColumnHeaderData[];
  rows: RowHeaderData[];
  cells: DataCellData[];
  coordinateSystem: D3CoordinateSystem;
  spanConfig: SpanConfig;
  resizeConfig: ResizeConfig;
  contentAlignment: ContentAlignment;
}

// Grid data structure for D3 rendering
export interface GridData {
  config: GridConfig;
  nodes: HeaderNode[];
  headers: HeaderHierarchy;
  data: Node[];
}

// Re-export AxisData from grid-core for backward compatibility
export type { AxisData } from './grid-core';

// ============================================================================
// Resize operation types for header interactions
// ============================================================================

/**
 * Configuration for resize handle rendering
 */
export interface ResizeHandleConfig {
  enabled: boolean;
  minWidth: number;
  maxWidth: number;
  snap: boolean;
  /** Width of the resize handle zone in pixels */
  handleWidth?: number;
  /** Cursor style when hovering the resize handle */
  cursor?: string;
  /** Enable smooth resizing with requestAnimationFrame */
  enableSmoothing?: boolean;
}

/**
 * State of an active resize operation
 */
export interface ResizeOperationState {
  isActive: boolean;
  startX: number;
  startY: number;
  startWidth: number;
  targetNodeId: string;
  affectedNodes: string[];
}

// ============================================================================
// Span calculation types for header layout
// ============================================================================

/**
 * Configuration for span calculation in header layout
 */
export interface SpanCalculationConfig {
  enabled: boolean;
  maxSpan: number;
  autoCollapse: boolean;
  minWidthPerCharacter: number;
  absoluteMinWidth: number;
  absoluteMaxWidth: number;
  dataProportionalWeight: number;
  useEqualFallback: boolean;
  uniformDataThreshold: number;
  iconWidth: number;
  enableCaching: boolean;
}

/**
 * Interface for managing header state
 */
export interface HeaderStateManager {
  getExpandedNodeIds(): Set<string>;
  setNodeExpanded(nodeId: string, expanded: boolean): void;
  isNodeExpanded(nodeId: string): boolean;
  toggleNode(nodeId: string): boolean;
  reset(): void;
}

// ============================================================================
// Cell data types for grid cell rendering
// ============================================================================

/**
 * Data for a single grid cell including its cards
 */
export interface CellData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cards: Node[];
  rowKey: string;
  colKey: string;
  isEmpty: boolean;
  /** Current density level for Janus density model (0-4 scale) */
  densityLevel?: number;
}

/**
 * Type guard for CellData
 */
export function isCellData(obj: unknown): obj is CellData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as CellData).id === 'string' &&
    typeof (obj as CellData).x === 'number' &&
    typeof (obj as CellData).y === 'number' &&
    Array.isArray((obj as CellData).cards)
  );
}

/**
 * Configuration for density morphing transitions
 */
export interface DensityMorphConfig {
  thresholds: {
    singleCard: number;
    multiCard: number;
    aggregate: number;
    /** Card count threshold: sparse -> group transition */
    sparseToGroup: number;
    /** Card count threshold: group -> rollup transition */
    groupToRollup: number;
    /** Card count threshold: rollup -> collapse transition */
    rollupToCollapse: number;
  };
  transitions: {
    duration: number;
    easing: string;
    stagger: number;
  };
  visual: {
    minOpacity: number;
    maxOpacity: number;
    borderRadius: number;
    /** Maximum number of cards visible in a stack */
    cardStackMaxVisible: number;
    /** Pixel offset between stacked cards */
    cardStackOffset: number;
    /** Maximum badge size for count display */
    countBadgeMaxSize: number;
    /** Minimum badge size for count display */
    countBadgeMinSize: number;
  };
}

/**
 * Default density morphing configuration
 */
export const DEFAULT_DENSITY_CONFIG: DensityMorphConfig = {
  thresholds: {
    singleCard: 1,
    multiCard: 5,
    aggregate: 20,
    sparseToGroup: 5,
    groupToRollup: 15,
    rollupToCollapse: 50
  },
  transitions: {
    duration: 300,
    easing: 'ease-in-out',
    stagger: 50
  },
  visual: {
    minOpacity: 0.3,
    maxOpacity: 1.0,
    borderRadius: 4,
    cardStackMaxVisible: 4,
    cardStackOffset: 4,
    countBadgeMaxSize: 32,
    countBadgeMinSize: 16
  }
};

/**
 * State of a cell transition animation
 */
export interface CellTransitionState {
  cellId: string;
  fromMode: string;
  toMode: string;
  progress: number;
  isAnimating: boolean;
  /** Whether a density transition is in progress */
  isTransitioning?: boolean;
  /** Source density level for transition */
  fromDensity?: number;
  /** Target density level for transition */
  toDensity?: number;
  /** Easing function name */
  easing?: string;
  /** Transition duration in ms */
  duration?: number;
}

// ============================================================================
// Virtual grid types for performance optimization
// ============================================================================

/**
 * A virtual grid cell with positioning information
 */
export interface VirtualGridCell {
  rowIndex: number;
  columnIndex: number;
  data: CellData | null;
  isVisible: boolean;
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Configuration for grid layout and virtual scrolling
 */
export interface GridLayoutConfig {
  cellWidth: number;
  cellHeight: number;
  gap: number;
  padding: number;
  virtualScrolling: {
    enabled: boolean;
    overscan: number;
    threshold: number;
  };
}

/**
 * Default grid layout configuration
 */
export const DEFAULT_GRID_LAYOUT: GridLayoutConfig = {
  cellWidth: 200,
  cellHeight: 120,
  gap: 4,
  padding: 8,
  virtualScrolling: {
    enabled: true,
    overscan: 10,
    threshold: 100
  }
};

// ============================================================================
// PAFV Projection types for axis-based grid layout
// ============================================================================

import type { LATCHAxis, Plane } from './pafv';

/**
 * Single axis configuration from PAFV mapping
 */
export interface AxisProjection {
  axis: LATCHAxis;
  facet: string; // Column name in database (e.g., 'created_at', 'folder')
}

/**
 * Complete PAFV projection configuration for SuperGrid
 * Defines which facets map to which visual planes
 */
export interface PAFVProjection {
  xAxis: AxisProjection | null; // Column headers
  yAxis: AxisProjection | null; // Row headers
  colorAxis?: AxisProjection | null; // Future: color encoding
}

/**
 * Cell position computed from PAFV projection
 */
export interface ProjectedCellPosition {
  row: number; // Y-axis index (-1 = unassigned)
  col: number; // X-axis index (-1 = unassigned)
  rowValue: string | null; // Actual facet value for row
  colValue: string | null; // Actual facet value for column
}

/**
 * Generated headers from unique facet values
 */
export interface GridHeaders {
  columns: string[]; // Unique X-axis values
  rows: string[]; // Unique Y-axis values
}

/**
 * Convert AxisMapping array to PAFVProjection
 */
export function mappingsToProjection(
  mappings: Array<{ plane: Plane; axis: LATCHAxis; facet: string }>
): PAFVProjection {
  const xMapping = mappings.find((m) => m.plane === 'x');
  const yMapping = mappings.find((m) => m.plane === 'y');
  const colorMapping = mappings.find((m) => m.plane === 'color');

  return {
    xAxis: xMapping ? { axis: xMapping.axis, facet: xMapping.facet } : null,
    yAxis: yMapping ? { axis: yMapping.axis, facet: yMapping.facet } : null,
    colorAxis: colorMapping
      ? { axis: colorMapping.axis, facet: colorMapping.facet }
      : null,
  };
}