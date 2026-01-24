import type { CoordinateSystem } from '@/components/D3SparsityLayer';

/**
 * Origin Pattern Types for SuperGrid
 *
 * - Anchor: Traditional spreadsheet (origin at top-left)
 * - Bipolar: Semantic matrix (origin at center)
 */
export type OriginPattern = 'anchor' | 'bipolar';

/**
 * Create a coordinate system for SuperGrid rendering
 *
 * This is a placeholder implementation for Phase 2 Wave 1.
 * Full coordinate system with bipolar origin and custom transforms
 * will be implemented in Wave 2.
 *
 * @param pattern - Origin pattern ('anchor' or 'bipolar')
 * @param cellWidth - Width of each cell in pixels
 * @param cellHeight - Height of each cell in pixels
 * @returns CoordinateSystem interface
 */
export function createCoordinateSystem(
  pattern: OriginPattern = 'anchor',
  cellWidth: number = 120,
  cellHeight: number = 60
): CoordinateSystem {
  // For Anchor origin (traditional spreadsheet)
  // Origin is at top-left, all coordinates grow positively
  const originX = pattern === 'anchor' ? 150 : 0; // Offset for row headers
  const originY = pattern === 'anchor' ? 40 : 0;  // Offset for column headers

  return {
    originX,
    originY,
    cellWidth,
    cellHeight,

    /**
     * Convert logical coordinates to screen coordinates
     * Logical: Abstract (x, y) from PAFV mapping
     * Screen: Actual pixel coordinates for SVG rendering
     */
    logicalToScreen(logicalX: number, logicalY: number) {
      if (pattern === 'anchor') {
        // Anchor: Simple offset + scaling
        return {
          x: originX + (logicalX * cellWidth),
          y: originY + (logicalY * cellHeight),
        };
      } else {
        // Bipolar: Center origin (future implementation)
        // For now, same as anchor
        return {
          x: originX + (logicalX * cellWidth),
          y: originY + (logicalY * cellHeight),
        };
      }
    },

    /**
     * Convert screen coordinates to logical coordinates
     * Used for hit-testing and click handling
     */
    screenToLogical(screenX: number, screenY: number) {
      if (pattern === 'anchor') {
        return {
          x: Math.floor((screenX - originX) / cellWidth),
          y: Math.floor((screenY - originY) / cellHeight),
        };
      } else {
        // Bipolar: Future implementation
        return {
          x: Math.floor((screenX - originX) / cellWidth),
          y: Math.floor((screenY - originY) / cellHeight),
        };
      }
    },
  };
}
