/**
 * RowHeader Component
 *
 * Renders a row header cell with vertical spanning support.
 * Uses sticky positioning to stay fixed during horizontal scrolling.
 */

import React from 'react';
import type { RowHeaderProps } from '../types';
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

/**
 * Row header component for vertical hierarchy display.
 *
 * Features:
 * - Vertical spanning based on leafCount
 * - Depth-based styling
 * - Click handling for selection
 * - Sticky positioning for freeze-pane effect
 */
export const RowHeader: React.FC<RowHeaderProps> = ({
  node,
  placement,
  depth,
  onClick,
}) => {
  const { theme } = useSuperGridContext();

  // Calculate cumulative left position for sticky (depth * column width)
  // Depth 0 = first column (left: 0), Depth 1 = second column (left: 100px), etc.
  const stickyLeft = depth * HEADER_COLUMN_WIDTH;

  return (
    <div
      className={`${styles.rowHeader} ${styles[`depth${depth}`] || ''} iso-grid-row-header ${depth > 0 ? `iso-grid-row-header--depth${depth}` : ''} iso-header`}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
        background: theme.rowHeader,
        borderColor: theme.border,
        color: theme.text,
        fontWeight: depth === 0 ? 600 : 500,
        fontSize: depth === 0 ? '13px' : '12px',
        // Sticky positioning for freeze-pane effect (horizontal scroll)
        position: 'sticky',
        left: stickyLeft,
      }}
      role="rowheader"
      onClick={onClick}
      data-expanded={node.expanded}
      title={node.label}
    >
      <span className={styles.headerLabel}>{capitalizeLabel(node.label)}</span>
    </div>
  );
};
