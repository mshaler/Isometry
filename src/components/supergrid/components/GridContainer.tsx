/**
 * GridContainer Component
 *
 * The CSS Grid container that holds all SuperGrid cells.
 */

import React from 'react';
import type { GridContainerProps } from '../types';
import styles from '../styles/SuperGrid.module.css';

/**
 * Grid container with computed CSS Grid template.
 *
 * This is a pure presentational component that:
 * 1. Sets up display: grid
 * 2. Applies computed gridTemplateColumns/Rows
 * 3. Renders children in the grid context
 */
export const GridContainer: React.FC<GridContainerProps> = ({
  columns,
  rows,
  children,
}) => {
  return (
    <div
      className={styles.gridContainer}
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gridTemplateRows: rows,
      }}
    >
      {children}
    </div>
  );
};
