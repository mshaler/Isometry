/**
 * CornerCell Component
 *
 * Renders a cell in the top-left corner area (MiniNav).
 * Uses sticky positioning to stay fixed during scrolling.
 */

import React from 'react';
import type { CornerCellProps } from '../types';
import { useSuperGridContext } from '../SuperGridCSSContext';
import styles from '../styles/SuperGrid.module.css';

/** Capitalize first letter of each word, handling underscores and spaces */
function capitalizeLabel(str: string): string {
  return str
    .split(/[_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Header column width in pixels (must match gridPlacement.ts) */
const HEADER_COLUMN_WIDTH = 100;
/** Header row height in pixels (must match gridPlacement.ts) */
const HEADER_ROW_HEIGHT = 32;

/**
 * Corner cell component for the MiniNav area.
 *
 * Corner cells occupy the intersection of row header columns
 * and column header rows. Used for navigation controls or labels.
 *
 * Uses position: sticky to stay fixed during horizontal/vertical scrolling.
 */
export const CornerCell: React.FC<CornerCellProps> = ({ placement, label, col, row }) => {
  const { theme } = useSuperGridContext();

  // Calculate cumulative left position for sticky (col * column width)
  const stickyLeft = col * HEADER_COLUMN_WIDTH;
  // Calculate cumulative top position for sticky (row * row height)
  const stickyTop = row * HEADER_ROW_HEIGHT;

  return (
    <div
      className={`${styles.cornerCell} iso-grid-corner`}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
        background: theme.corner,
        borderColor: theme.border,
        color: theme.text,
        // Sticky positioning for freeze-pane effect
        position: 'sticky',
        left: stickyLeft,
        top: stickyTop,
        // Z-index based on position: earlier columns/rows on top
        zIndex: 30 - col,
      }}
      role="columnheader"
    >
      {capitalizeLabel(label)}
    </div>
  );
};
