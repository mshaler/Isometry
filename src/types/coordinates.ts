/**
 * Coordinate System Types for SuperGrid
 *
 * Provides Cartesian coordinate abstractions for both Anchor (traditional spreadsheet)
 * and Bipolar (semantic matrix) origin patterns.
 *
 * @module types/coordinates
 */

/**
 * A point in 2D space with x and y coordinates.
 *
 * @example
 * const screenPoint: Point = { x: 100, y: 200 };
 * const logicalPoint: Point = { x: 0, y: 0 }; // Center in Bipolar mode
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Origin pattern determines where (0,0) is positioned in the grid.
 *
 * - **Anchor**: Origin at top-left corner (traditional spreadsheet)
 *   - (0,0) = intersection of column/row headers
 *   - All cells have positive coordinates
 *   - Suitable for: spreadsheets, calendars, traditional grids
 *
 * - **Bipolar**: Origin at center (semantic matrix)
 *   - (0,0) = center of viewport
 *   - Cells can have negative coordinates
 *   - Suitable for: Eisenhower Matrix, BCG Matrix, priority grids
 *   - Quadrants have semantic meaning
 *
 * @example
 * // Anchor pattern (spreadsheet)
 * const anchor: OriginPattern = 'anchor';
 * // Cell A1 is at (0, 0)
 * // Cell B2 is at (1, 1)
 *
 * @example
 * // Bipolar pattern (priority matrix)
 * const bipolar: OriginPattern = 'bipolar';
 * // Center cell is at (0, 0)
 * // Urgent+Important (Q1) is at (+x, +y)
 * // Not Urgent+Important (Q2) is at (-x, +y)
 */
export type OriginPattern = 'anchor' | 'bipolar';

/**
 * Configuration for a coordinate system transformation.
 *
 * @property pattern - The origin pattern to use
 * @property scale - Zoom level (1.0 = 100%, 2.0 = 200%, 0.5 = 50%)
 * @property viewportWidth - Width of the viewport in pixels
 * @property viewportHeight - Height of the viewport in pixels
 *
 * @example
 * const config: CoordinateSystem = {
 *   pattern: 'anchor',
 *   scale: 1.0,
 *   viewportWidth: 1024,
 *   viewportHeight: 768
 * };
 */
export interface CoordinateSystem {
  pattern: OriginPattern;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Origin preset configuration with default positioning.
 *
 * @property pattern - The origin pattern type
 * @property initialScale - Starting zoom level
 * @property description - Human-readable description
 *
 * @internal
 */
export interface OriginPreset {
  pattern: OriginPattern;
  initialScale: number;
  description: string;
}
