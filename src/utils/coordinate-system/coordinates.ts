/**
 * Coordinate Transformation Utilities for SuperGrid
 *
 * Provides pure functions to convert between screen space (SVG pixels) and
 * logical space (grid coordinates). Supports both Anchor and Bipolar origin patterns.
 *
 * @module utils/coordinates
 */

import type {
  Point,
  CoordinateSystem,
  OriginPattern,
  OriginPreset,
} from '../../types/coordinates';
import type { AxisRange, GridCell } from '../../types/supergrid';

/**
 * Convert screen coordinates (SVG pixel position) to logical grid coordinates.
 *
 * @param screenPoint - Point in SVG screen space (pixels)
 * @param coordinateSystem - Current coordinate system configuration
 * @returns Point in logical grid space (cell coordinates)
 *
 * @example
 * // Anchor mode: top-left origin
 * const screen = { x: 240, y: 120 };
 * const system: CoordinateSystem = {
 *   pattern: 'anchor',
 *   scale: 1.0,
 *   viewportWidth: 1024,
 *   viewportHeight: 768
 * };
 * const logical = screenToLogical(screen, system);
 * // Result: { x: 240, y: 120 } (direct mapping at scale 1.0)
 *
 * @example
 * // Bipolar mode: center origin
 * const screen = { x: 512, y: 384 };
 * const system: CoordinateSystem = {
 *   pattern: 'bipolar',
 *   scale: 1.0,
 *   viewportWidth: 1024,
 *   viewportHeight: 768
 * };
 * const logical = screenToLogical(screen, system);
 * // Result: { x: 0, y: 0 } (center maps to origin)
 */
export function screenToLogical(
  screenPoint: Point,
  coordinateSystem: CoordinateSystem
): Point {
  const { pattern, scale, viewportWidth, viewportHeight } = coordinateSystem;

  // Apply inverse scale first (zoom out the coordinates)
  const scaledX = screenPoint.x / scale;
  const scaledY = screenPoint.y / scale;

  if (pattern === 'anchor') {
    // Anchor: screen space equals logical space (top-left origin)
    return {
      x: scaledX,
      y: scaledY,
    };
  } else {
    // Bipolar: translate so center is (0, 0)
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    return {
      x: scaledX - centerX / scale,
      y: scaledY - centerY / scale,
    };
  }
}

/**
 * Convert logical grid coordinates to screen coordinates (SVG pixel position).
 *
 * @param logicalPoint - Point in logical grid space (cell coordinates)
 * @param coordinateSystem - Current coordinate system configuration
 * @returns Point in SVG screen space (pixels)
 *
 * @example
 * // Anchor mode: cell (2, 3) to screen position
 * const logical = { x: 2, y: 3 };
 * const system: CoordinateSystem = {
 *   pattern: 'anchor',
 *   scale: 1.0,
 *   viewportWidth: 1024,
 *   viewportHeight: 768
 * };
 * const screen = logicalToScreen(logical, system);
 * // Result: { x: 2, y: 3 } (direct mapping)
 *
 * @example
 * // Bipolar mode: origin (0,0) to center
 * const logical = { x: 0, y: 0 };
 * const system: CoordinateSystem = {
 *   pattern: 'bipolar',
 *   scale: 1.0,
 *   viewportWidth: 1024,
 *   viewportHeight: 768
 * };
 * const screen = logicalToScreen(logical, system);
 * // Result: { x: 512, y: 384 } (center of viewport)
 */
export function logicalToScreen(
  logicalPoint: Point,
  coordinateSystem: CoordinateSystem
): Point {
  const { pattern, scale, viewportWidth, viewportHeight } = coordinateSystem;

  if (pattern === 'anchor') {
    // Anchor: logical space equals screen space (top-left origin)
    return {
      x: logicalPoint.x * scale,
      y: logicalPoint.y * scale,
    };
  } else {
    // Bipolar: translate so (0,0) is at center
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    return {
      x: (logicalPoint.x + centerX / scale) * scale,
      y: (logicalPoint.y + centerY / scale) * scale,
    };
  }
}

/**
 * Calculate the min/max range for an axis based on grid cell data.
 *
 * @param cells - Array of grid cells
 * @param axis - Which axis to calculate ('x' or 'y')
 * @returns AxisRange with min, max, and count
 *
 * @example
 * const cells: GridCell[] = [
 *   { position: { x: 0, y: 1 }, value: "A", nodeId: 1, colPath: "a", rowPath: "1" },
 *   { position: { x: 2, y: 1 }, value: "B", nodeId: 2, colPath: "c", rowPath: "1" },
 *   { position: { x: 1, y: 3 }, value: "C", nodeId: 3, colPath: "b", rowPath: "3" },
 * ];
 * const xRange = calculateAxisRange(cells, 'x');
 * // Result: { min: 0, max: 2, count: 3 }
 * const yRange = calculateAxisRange(cells, 'y');
 * // Result: { min: 1, max: 3, count: 3 }
 */
export function calculateAxisRange(
  cells: GridCell[],
  axis: 'x' | 'y'
): AxisRange {
  if (cells.length === 0) {
    return { min: 0, max: 0, count: 0 };
  }

  const values = cells.map((cell) => cell.position[axis]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const count = max - min + 1;

  return { min, max, count };
}

/**
 * Get a preset configuration for a specific origin pattern.
 *
 * @param pattern - The origin pattern to get preset for
 * @returns OriginPreset with default configuration
 *
 * @example
 * const anchorPreset = getOriginPreset('anchor');
 * // Result: {
 * //   pattern: 'anchor',
 * //   initialScale: 1.0,
 * //   description: 'Traditional spreadsheet with top-left origin'
 * // }
 *
 * @example
 * const bipolarPreset = getOriginPreset('bipolar');
 * // Result: {
 * //   pattern: 'bipolar',
 * //   initialScale: 1.0,
 * //   description: 'Semantic matrix with center origin (Eisenhower, BCG)'
 * // }
 */
export function getOriginPreset(pattern: OriginPattern): OriginPreset {
  switch (pattern) {
    case 'anchor':
      return {
        pattern: 'anchor',
        initialScale: 1.0,
        description: 'Traditional spreadsheet with top-left origin',
      };
    case 'bipolar':
      return {
        pattern: 'bipolar',
        initialScale: 1.0,
        description: 'Semantic matrix with center origin (Eisenhower, BCG)',
      };
  }
}

/**
 * Round-trip test: Convert screen → logical → screen and check precision.
 *
 * @param screenPoint - Starting screen point
 * @param coordinateSystem - Coordinate system to test
 * @param tolerance - Maximum allowed difference (default: 0.001)
 * @returns true if round-trip preserves precision within tolerance
 *
 * @example
 * const screen = { x: 100, y: 200 };
 * const system: CoordinateSystem = {
 *   pattern: 'anchor',
 *   scale: 1.0,
 *   viewportWidth: 1024,
 *   viewportHeight: 768
 * };
 * const isPrecise = verifyRoundTrip(screen, system);
 * // Result: true (exact match)
 */
export function verifyRoundTrip(
  screenPoint: Point,
  coordinateSystem: CoordinateSystem,
  tolerance: number = 0.001
): boolean {
  const logical = screenToLogical(screenPoint, coordinateSystem);
  const backToScreen = logicalToScreen(logical, coordinateSystem);

  const deltaX = Math.abs(screenPoint.x - backToScreen.x);
  const deltaY = Math.abs(screenPoint.y - backToScreen.y);

  return deltaX <= tolerance && deltaY <= tolerance;
}
