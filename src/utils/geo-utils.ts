/**
 * geo-utils - Re-export for backward compatibility
 *
 * The actual implementation lives in ./coordinate-system/geo-utils.ts
 */

export {
  haversineDistance,
  latLngToBounds,
  isPointInRadius,
  isPointInBounds,
  formatDistance,
  type LatLng,
  type BoundingBox,
} from './coordinate-system/geo-utils';
