import type { D3CoordinateSystem } from '@/components/D3SparsityLayer';
import type { OriginPattern } from '@/types/coordinates';

/**
 * Enhanced coordinate system configuration
 */
export interface CoordinateSystemConfig {
  pattern: OriginPattern;
  cellWidth: number;
  cellHeight: number;
  viewportWidth?: number;
  viewportHeight?: number;
  headerOffsetX?: number;
  headerOffsetY?: number;
}

/**
 * Default viewport dimensions for coordinate system calculations
 */
const DEFAULT_VIEWPORT = {
  width: 1024,
  height: 768
};

/**
 * Default header offsets for anchor pattern
 */
const DEFAULT_HEADERS = {
  offsetX: 150, // Row header width
  offsetY: 40   // Column header height
};

/**
 * Create a coordinate system for SuperGrid rendering
 *
 * Supports both anchor (top-left origin) and bipolar (center origin) patterns.
 * The bipolar system enables semantic matrix layouts with negative coordinates
 * for quadrant-based visualizations (e.g., Eisenhower Matrix, BCG Matrix).
 *
 * @param pattern - Origin pattern ('anchor' or 'bipolar')
 * @param cellWidth - Width of each cell in pixels
 * @param cellHeight - Height of each cell in pixels
 * @param config - Optional configuration for viewport and headers
 * @returns CoordinateSystem interface with projection functions
 */
export function createCoordinateSystem(
  pattern: OriginPattern = 'anchor',
  cellWidth: number = 120,
  cellHeight: number = 60,
  config?: Partial<CoordinateSystemConfig>
): D3CoordinateSystem {
  const fullConfig: CoordinateSystemConfig = {
    pattern,
    cellWidth,
    cellHeight,
    viewportWidth: config?.viewportWidth || DEFAULT_VIEWPORT.width,
    viewportHeight: config?.viewportHeight || DEFAULT_VIEWPORT.height,
    headerOffsetX: config?.headerOffsetX || DEFAULT_HEADERS.offsetX,
    headerOffsetY: config?.headerOffsetY || DEFAULT_HEADERS.offsetY,
    ...config
  };

  // Calculate origin position based on pattern
  let originX: number;
  let originY: number;

  if (pattern === 'anchor') {
    // Anchor: Origin at top-left with header offsets
    originX = fullConfig.headerOffsetX!;
    originY = fullConfig.headerOffsetY!;
  } else {
    // Bipolar: Origin at center of viewport
    originX = fullConfig.viewportWidth! / 2;
    originY = fullConfig.viewportHeight! / 2;
  }

  return {
    originX,
    originY,
    cellWidth,
    cellHeight,
    pattern,
    scale: 1,
    viewportWidth: fullConfig.viewportWidth,
    viewportHeight: fullConfig.viewportHeight,

    /**
     * Convert logical coordinates to screen coordinates
     *
     * Logical coordinates:
     * - Anchor: (0,0) = first data cell, all positive
     * - Bipolar: (0,0) = center cell, can be negative
     *
     * Screen coordinates:
     * - SVG pixel coordinates for rendering
     */
    logicalToScreen(logicalX: number, logicalY: number) {
      if (pattern === 'anchor') {
        // Anchor: Simple offset + scaling
        return {
          x: originX + (logicalX * cellWidth),
          y: originY + (logicalY * cellHeight),
        };
      } else {
        // Bipolar: Center origin with support for negative coordinates
        return {
          x: originX + (logicalX * cellWidth),
          y: originY + (logicalY * cellHeight),
        };
      }
    },

    /**
     * Convert screen coordinates to logical coordinates
     * Used for hit-testing, click handling, and viewport calculations
     */
    screenToLogical(screenX: number, screenY: number) {
      if (pattern === 'anchor') {
        // Anchor: Standard grid calculation
        return {
          x: Math.floor((screenX - originX) / cellWidth),
          y: Math.floor((screenY - originY) / cellHeight),
        };
      } else {
        // Bipolar: Center-based calculation supporting negative coordinates
        return {
          x: Math.floor((screenX - originX) / cellWidth),
          y: Math.floor((screenY - originY) / cellHeight),
        };
      }
    },
  };
}

/**
 * Calculate the logical bounds for a given viewport in screen coordinates
 * Useful for determining which cells are visible and need rendering
 */
export function calculateLogicalBounds(
  coordinateSystem: D3CoordinateSystem,
  viewportBounds: { left: number; top: number; right: number; bottom: number }
) {
  const topLeft = coordinateSystem.screenToLogical(viewportBounds.left, viewportBounds.top);
  const bottomRight = coordinateSystem.screenToLogical(viewportBounds.right, viewportBounds.bottom);

  return {
    minX: Math.min(topLeft.x, bottomRight.x),
    maxX: Math.max(topLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, bottomRight.y),
    maxY: Math.max(topLeft.y, bottomRight.y)
  };
}

/**
 * Get quadrant information for bipolar coordinate systems
 * Returns semantic meaning of coordinate regions for matrix-style layouts
 */
export function getBipolarQuadrant(logicalX: number, logicalY: number): {
  quadrant: 1 | 2 | 3 | 4;
  name: string;
  description: string;
} {
  if (logicalX >= 0 && logicalY >= 0) {
    return {
      quadrant: 1,
      name: 'Q1',
      description: 'Positive X, Positive Y (e.g., Important & Urgent)'
    };
  } else if (logicalX < 0 && logicalY >= 0) {
    return {
      quadrant: 2,
      name: 'Q2',
      description: 'Negative X, Positive Y (e.g., Important & Not Urgent)'
    };
  } else if (logicalX < 0 && logicalY < 0) {
    return {
      quadrant: 3,
      name: 'Q3',
      description: 'Negative X, Negative Y (e.g., Not Important & Not Urgent)'
    };
  } else {
    return {
      quadrant: 4,
      name: 'Q4',
      description: 'Positive X, Negative Y (e.g., Not Important & Urgent)'
    };
  }
}

/**
 * Calculate the distance between two logical points
 * Useful for proximity-based algorithms and spatial analysis
 */
export function calculateLogicalDistance(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  distanceType: 'euclidean' | 'manhattan' = 'euclidean'
): number {
  const deltaX = pointB.x - pointA.x;
  const deltaY = pointB.y - pointA.y;

  if (distanceType === 'manhattan') {
    return Math.abs(deltaX) + Math.abs(deltaY);
  } else {
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }
}

/**
 * Create coordinate system presets for common layouts
 */
export const coordinateSystemPresets = {
  /**
   * Traditional spreadsheet layout
   */
  spreadsheet: (cellWidth = 120, cellHeight = 60) =>
    createCoordinateSystem('anchor', cellWidth, cellHeight),

  /**
   * Eisenhower Matrix (Urgent/Important)
   */
  eisenhowerMatrix: (cellWidth = 160, cellHeight = 120) =>
    createCoordinateSystem('bipolar', cellWidth, cellHeight),

  /**
   * BCG Growth-Share Matrix
   */
  bcgMatrix: (cellWidth = 180, cellHeight = 140) =>
    createCoordinateSystem('bipolar', cellWidth, cellHeight),

  /**
   * Priority Grid (High/Low Impact vs High/Low Effort)
   */
  priorityGrid: (cellWidth = 140, cellHeight = 100) =>
    createCoordinateSystem('bipolar', cellWidth, cellHeight),

  /**
   * Compact grid for high-density data
   */
  compact: (cellWidth = 80, cellHeight = 40) =>
    createCoordinateSystem('anchor', cellWidth, cellHeight),

  /**
   * Large cells for detailed visualization
   */
  detailed: (cellWidth = 200, cellHeight = 150) =>
    createCoordinateSystem('anchor', cellWidth, cellHeight)
};

/**
 * Transform coordinates from one coordinate system to another
 * Useful for switching between anchor and bipolar patterns
 */
export function transformCoordinates(
  logicalPoint: { x: number; y: number },
  fromSystem: D3CoordinateSystem,
  toSystem: D3CoordinateSystem
): { x: number; y: number } {
  // Convert to screen coordinates in source system
  const screenPoint = fromSystem.logicalToScreen(logicalPoint.x, logicalPoint.y);

  // Convert to logical coordinates in target system
  return toSystem.screenToLogical(screenPoint.x, screenPoint.y);
}
