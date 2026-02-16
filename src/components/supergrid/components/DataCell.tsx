/**
 * DataCell Component
 *
 * Renders a data cell in the grid body.
 */

import React, { useCallback } from 'react';
import type { DataCellProps } from '../types';
import { useSuperGridContext } from '../SuperGridCSSContext';
import { getCellKey } from '../hooks/useGridLayout';
import styles from '../styles/SuperGrid.module.css';

/**
 * Data cell component for displaying values.
 *
 * Features:
 * - Custom cell rendering via renderCell prop
 * - Selection state with visual feedback
 * - Click handling with cell data
 * - Keyboard accessibility (tabIndex)
 */
export const DataCell: React.FC<DataCellProps> = ({
  placement,
  cell,
  rowPath,
  colPath,
  renderCell,
}) => {
  const { theme, onCellClick, selectedCell, setSelectedCell } = useSuperGridContext();

  const cellKey = getCellKey(rowPath, colPath);
  const selectedKey = selectedCell
    ? getCellKey(selectedCell.rowPath, selectedCell.colPath)
    : null;
  const isSelected = cellKey === selectedKey;

  const handleClick = useCallback(() => {
    setSelectedCell({ rowPath, colPath });
    onCellClick?.(cell, rowPath, colPath);
  }, [cell, rowPath, colPath, onCellClick, setSelectedCell]);

  const content = renderCell
    ? renderCell(cell, rowPath, colPath)
    : cell?.value ?? '';

  return (
    <div
      className={styles.dataCell}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
        background: isSelected ? `${theme.data}dd` : theme.data,
        borderColor: theme.border,
        color: theme.text,
        outline: isSelected ? '2px solid #007AFF' : 'none',
        outlineOffset: '-2px',
        zIndex: isSelected ? 1 : 0,
        ...cell?.style,
      }}
      role="gridcell"
      onClick={handleClick}
      tabIndex={0}
      data-selected={isSelected}
    >
      {content}
    </div>
  );
};
