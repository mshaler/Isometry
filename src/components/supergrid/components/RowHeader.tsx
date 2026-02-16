/**
 * RowHeader Component
 *
 * Renders a row header cell with vertical spanning support.
 */

import React from 'react';
import type { RowHeaderProps } from '../types';
import { useSuperGridContext } from '../SuperGridCSSContext';
import styles from '../styles/SuperGrid.module.css';

/**
 * Row header component for vertical hierarchy display.
 *
 * Features:
 * - Vertical spanning based on leafCount
 * - Depth-based styling
 * - Expandable indicator for nodes with children
 * - Click handling for selection/expansion
 */
export const RowHeader: React.FC<RowHeaderProps> = ({
  node,
  placement,
  depth,
  onClick,
}) => {
  const { theme } = useSuperGridContext();
  const isExpandable = node.expandable || (node.children && node.children.length > 0);

  return (
    <div
      className={`${styles.rowHeader} ${styles[`depth${depth}`] || ''}`}
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
      }}
      role="rowheader"
      onClick={onClick}
      data-expandable={isExpandable}
      data-expanded={node.expanded}
      title={node.label}
    >
      <span className={styles.headerLabel}>{node.label}</span>
      {isExpandable && <span className={styles.expandIcon}>▶</span>}
    </div>
  );
};
