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