/**
 * CornerCell Component
 *
 * Renders a cell in the top-left corner area (MiniNav).
 */

import React from 'react';
import type { CornerCellProps } from '../types';
import { useSuperGridContext } from '../SuperGridCSSContext';
import styles from '../styles/SuperGrid.module.css';

/**
 * Corner cell component for the MiniNav area.
 *
 * Corner cells occupy the intersection of row header columns
 * and column header rows. Used for navigation controls or labels.
 */
export const CornerCell: React.FC<CornerCellProps> = ({ placement, label }) => {
  const { theme } = useSuperGridContext();

  return (
    <div
      className={styles.cornerCell}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
        background: theme.corner,
        borderColor: theme.border,
        color: theme.text,
      }}
      role="columnheader"
    >
      {label}
    </div>
  );
};
