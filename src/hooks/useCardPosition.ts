import { useMemo } from 'react';

export interface CardPosition {
  top: number;
  left: number;
}

export interface CellCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CARD_WIDTH = 400;
const CARD_HEIGHT = 500;
const BUFFER = 8;

/**
 * useCardPosition - Calculate smart card position from cell coordinates
 *
 * Positions the card near the clicked cell while ensuring it stays on screen.
 * Smart positioning logic:
 * - Default: Right and below the cell
 * - If near right edge: Show on left side
 * - If near bottom: Show above instead of below
 * - Always includes 8px buffer from cell edge
 *
 * @param cellCoords - Screen coordinates of the clicked cell
 * @returns CSS position object { top, left }
 */
export function useCardPosition(cellCoords: CellCoordinates | null): CardPosition | null {
  return useMemo(() => {
    if (!cellCoords) return null;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate default position (right and below)
    let left = cellCoords.x + cellCoords.width + BUFFER;
    let top = cellCoords.y;

    // Check if card would go off right edge
    if (left + CARD_WIDTH > viewportWidth) {
      // Show on left side instead
      left = cellCoords.x - CARD_WIDTH - BUFFER;
    }

    // Ensure card doesn't go off left edge
    if (left < BUFFER) {
      left = BUFFER;
    }

    // Check if card would go off bottom edge
    if (top + CARD_HEIGHT > viewportHeight) {
      // Show above the cell instead
      top = cellCoords.y + cellCoords.height - CARD_HEIGHT;
    }

    // Ensure card doesn't go off top edge
    if (top < BUFFER) {
      top = BUFFER;
    }

    return { top, left };
  }, [cellCoords]);
}
