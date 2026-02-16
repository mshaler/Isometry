/**
 * ColHeader Component
 *
 * Renders a column header cell with horizontal spanning support.
 */

import React from 'react';
import type { ColHeaderProps } from '../types';
import { useSuperGridContext } from '../SuperGridCSSContext';
import styles from '../styles/SuperGrid.module.css';

/**
 * Column header component for horizontal hierarchy display.
 *
 * Features:
 * - Horizontal spanning based on leafCount
 * - Depth-based coloring (gradient from L0 to L1+)
 * - Click handling for selection
 */
export const ColHeader: React.FC<ColHeaderProps> = ({
  node,
  placement,
  depth,
  onClick,
}) => {
  const { theme } = useSuperGridContext();
  const bg = depth === 0 ? theme.colHeaderL0 : theme.colHeaderL1;

  return (
    <div
      className={`${styles.colHeader} ${styles[`depth${depth}`] || ''}`}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
        background: bg,
        borderColor: theme.border,
        color: theme.text,
        fontWeight: depth === 0 ? 600 : 500,
      }}
      role="columnheader"
      onClick={onClick}
    >
      <span className={styles.headerLabel}>{node.label}</span>
    </div>
  );
};
