/**
 * Coordinate System Utilities
 *
 * Provides coordinate system implementations for SuperGrid rendering,
 * including anchor (top-left origin) and bipolar (center origin) patterns.
 */

// Main coordinate system exports
export {
  createCoordinateSystem,
  calculateLogicalBounds,
  getBipolarQuadrant,
  calculateLogicalDistance,
  coordinateSystemPresets,
  transformCoordinates,
  type CoordinateSystemConfig
} from './coordinate-system';

// D3 coordinate system exports (for hook integrations)
export {
  screenToLogical,
  logicalToScreen,
  calculateAxisRange,
  getOriginPreset,
  verifyRoundTrip,
  createD3CoordinateSystem,
  type D3CoordinateSystem
} from './coordinates';

// Re-export types from the main types module
export type { OriginPattern, OriginPreset } from '../../types/coordinates';

// Cursor position utilities
export {
  getCursorPosition,
  getCursorPositionFast,
  getMenuPosition,
  getCursorBounds,
  type CursorPosition,
  type CursorBounds
} from './cursorPosition';

// Geospatial utilities
export {
  haversineDistance,
  latLngToBounds,
  isPointInRadius,
  isPointInBounds,
  formatDistance,
  type LatLng,
  type BoundingBox
} from './geo-utils';
