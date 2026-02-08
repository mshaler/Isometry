/**
 * Geospatial utility functions for Location filter
 * Haversine distance, bounding box calculations, point-in-radius checks
 */

const EARTH_RADIUS_METERS = 6371000; // Earth radius in meters

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  sw: LatLng; // Southwest corner
  ne: LatLng; // Northeast corner
}

/**
 * Calculate distance between two points using Haversine formula
 * @param point1 First point (lat/lng)
 * @param point2 Second point (lat/lng)
 * @returns Distance in meters
 */
export function haversineDistance(point1: LatLng, point2: LatLng): number {
  const lat1Rad = (point1.lat * Math.PI) / 180;
  const lat2Rad = (point2.lat * Math.PI) / 180;
  const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Convert center point + radius to bounding box
 * @param center Center point (lat/lng)
 * @param radiusMeters Radius in meters
 * @returns Bounding box (SW/NE corners)
 */
export function latLngToBounds(
  center: LatLng,
  radiusMeters: number
): BoundingBox {
  // Convert radius to degrees (approximate)
  const latDelta = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const lngDelta =
    (radiusMeters / (EARTH_RADIUS_METERS * Math.cos((center.lat * Math.PI) / 180))) *
    (180 / Math.PI);

  return {
    sw: {
      lat: center.lat - latDelta,
      lng: center.lng - lngDelta,
    },
    ne: {
      lat: center.lat + latDelta,
      lng: center.lng + lngDelta,
    },
  };
}

/**
 * Check if point is within radius of center
 * @param point Point to check (lat/lng)
 * @param center Center point (lat/lng)
 * @param radiusMeters Radius in meters
 * @returns True if point is within radius
 */
export function isPointInRadius(
  point: LatLng,
  center: LatLng,
  radiusMeters: number
): boolean {
  return haversineDistance(point, center) <= radiusMeters;
}

/**
 * Check if point is within bounding box
 * @param point Point to check (lat/lng)
 * @param bounds Bounding box (SW/NE corners)
 * @returns True if point is within bounds
 */
export function isPointInBounds(point: LatLng, bounds: BoundingBox): boolean {
  return (
    point.lat >= bounds.sw.lat &&
    point.lat <= bounds.ne.lat &&
    point.lng >= bounds.sw.lng &&
    point.lng <= bounds.ne.lng
  );
}

/**
 * Format distance for display (auto-select km/m)
 * @param meters Distance in meters
 * @returns Formatted string (e.g. "2.5 km" or "350 m")
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}
