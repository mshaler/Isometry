/**
 * ColHeader Component
 *
 * Renders a column header cell with horizontal spanning support.
 * Uses sticky positioning to stay fixed during vertical scrolling.
 */

import React from 'react';
import type { ColHeaderProps } from '../types';
import { useSuperGridContext } from '../SuperGridCSSContext';
import styles from '../styles/SuperGrid.module.css';

/** Capitalize first letter of each word, handling underscores and spaces */
function capitalizeLabel(str: string): string {
  return str
    .split(/[_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Header row height in pixels (must match gridPlacement.ts) */
const HEADER_ROW_HEIGHT = 32;

/**
 * Column header component for horizontal hierarchy display.
 *
 * Features:
 * - Horizontal spanning based on leafCount
 * - Depth-based coloring (gradient from L0 to L1+)
 * - Click handling for selection
 * - Sticky positioning for freeze-pane effect
 */
export const ColHeader: React.FC<ColHeaderProps> = ({
  node,
  placement,
  depth,
  onClick,
}) => {
  const { theme } = useSuperGridContext();
  const bg = depth === 0 ? theme.colHeaderL0 : theme.colHeaderL1;

  // Calculate cumulative top position for sticky (depth * row height)
  // Depth 0 = first row (top: 0), Depth 1 = second row (top: 32px), etc.
  const stickyTop = depth * HEADER_ROW_HEIGHT;

  return (
    <div
      className={`${styles.colHeader} ${styles[`depth${depth}`] || ''} iso-grid-col-header ${depth > 0 ? `iso-grid-col-header--depth${depth}` : ''} iso-header`}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
        background: bg,
        borderColor: theme.border,
        color: theme.text,
        fontWeight: depth === 0 ? 600 : 500,
        // Sticky positioning for freeze-pane effect (vertical scroll)
        position: 'sticky',
        top: stickyTop,
      }}
      role="columnheader"
      onClick={onClick}
    >
      <span className={styles.headerLabel}>{capitalizeLabel(node.label)}</span>
    </div>
  );
};
