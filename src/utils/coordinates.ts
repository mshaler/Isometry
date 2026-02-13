/**
 * coordinates - Re-export for backward compatibility
 *
 * The actual implementation lives in ./coordinate-system/coordinates.ts
 */

export {
  screenToLogical,
  logicalToScreen,
  calculateAxisRange,
  getOriginPreset,
  verifyRoundTrip,
  createCoordinateSystem,
  createD3CoordinateSystem,
  type D3CoordinateSystem,
} from './coordinate-system/coordinates';
