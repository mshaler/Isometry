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
  pattern?: any; // OriginPattern type
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
  data?: any;

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