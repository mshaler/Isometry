/**
 * Coordinate System Utilities
 * PAFV spatial projection helpers for SuperGrid
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CoordinateSystem {
  origin: Point2D;
  scale: Point2D;
  bounds: Bounds;
}

/**
 * Create a coordinate system for grid-based layouts
 */
export function createCoordinateSystem(
  width: number,
  height: number,
  gridCols: number,
  gridRows: number
): CoordinateSystem {
  const cellWidth = width / gridCols;
  const cellHeight = height / gridRows;

  return {
    origin: { x: 0, y: 0 },
    scale: { x: cellWidth, y: cellHeight },
    bounds: {
      minX: 0,
      maxX: width,
      minY: 0,
      maxY: height
    }
  };
}

/**
 * Convert grid coordinates to screen coordinates
 */
export function gridToScreen(
  gridX: number,
  gridY: number,
  coordinateSystem: CoordinateSystem
): Point2D {
  return {
    x: coordinateSystem.origin.x + (gridX * coordinateSystem.scale.x),
    y: coordinateSystem.origin.y + (gridY * coordinateSystem.scale.y)
  };
}

/**
 * Convert screen coordinates to grid coordinates
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  coordinateSystem: CoordinateSystem
): Point2D {
  return {
    x: Math.floor((screenX - coordinateSystem.origin.x) / coordinateSystem.scale.x),
    y: Math.floor((screenY - coordinateSystem.origin.y) / coordinateSystem.scale.y)
  };
}

/**
 * Check if a point is within bounds
 */
export function isWithinBounds(point: Point2D, bounds: Bounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

/**
 * Calculate distance between two points
 */
export function distance(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalize a point to [0,1] range within bounds
 */
export function normalize(point: Point2D, bounds: Bounds): Point2D {
  return {
    x: (point.x - bounds.minX) / (bounds.maxX - bounds.minX),
    y: (point.y - bounds.minY) / (bounds.maxY - bounds.minY)
  };
}