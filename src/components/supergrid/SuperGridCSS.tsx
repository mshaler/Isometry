/**
 * SuperGridCSS Component
 *
 * New CSS Grid-based SuperGrid implementation.
 * Pure React + CSS Grid — no D3.js for layout.
 *
 * This is the replacement for the D3-based SuperGrid.tsx.
 * Once validated, this will become the main SuperGrid component.
 */

import React, { useMemo, useCallback } from 'react';
import { useGridLayout, getCellKey } from './hooks/useGridLayout';
import { GridContainer } from './components/GridContainer';
import { CornerCell } from './components/CornerCell';
import { RowHeader } from './components/RowHeader';
import { ColHeader } from './components/ColHeader';
import { DataCell } from './components/DataCell';
import { SuperGridCSSProvider } from './SuperGridCSSContext';
import type { SuperGridProps, DataCell as DataCellType } from './types';
import styles from './styles/SuperGrid.module.css';

/**
 * SuperGridCSS — Polymorphic pivot table with CSS Grid layout.
 *
 * Features:
 * - Hierarchical row and column headers with spanning
 * - Computed CSS Grid layout from tree structures
 * - Theme support (reference, nextstep, modern, dark)
 * - Cell selection and click handling
 * - Custom cell rendering
 *
 * @example
 * ```tsx
 * <SuperGridCSS
 *   rowAxis={categoryAxis}
 *   columnAxis={timeAxis}
 *   data={cells}
 *   theme="modern"
 *   onCellClick={(cell, row, col) => console.log(cell)}
 * />
 * ```
 */
export const SuperGridCSS: React.FC<SuperGridProps> = ({
  rowAxis,
  columnAxis,
  data,
  renderCell,
  theme = 'modern',
  onCellClick,
  onHeaderClick,
  onSelectionChange,
}) => {
  // Compute grid layout from hierarchical data
  const layout = useGridLayout(rowAxis, columnAxis);

  // Build lookup map for data cells by path key
  const dataMap = useMemo(() => {
    const map = new Map<string, DataCellType>();
    for (const cell of data) {
      const key = getCellKey(cell.rowPath, cell.colPath);
      map.set(key, cell);
    }
    return map;
  }, [data]);

  // Get data cell by path
  const getCell = useCallback(
    (rowPath: string[], colPath: string[]) => {
      const key = getCellKey(rowPath, colPath);
      return dataMap.get(key);
    },
    [dataMap]
  );

  // Handle row header click
  const handleRowHeaderClick = useCallback(
    (path: string[]) => {
      onHeaderClick?.('row', path);
    },
    [onHeaderClick]
  );

  // Handle column header click
  const handleColHeaderClick = useCallback(
    (path: string[]) => {
      onHeaderClick?.('column', path);
    },
    [onHeaderClick]
  );

  return (
    <SuperGridCSSProvider
      theme={theme}
      onCellClick={onCellClick}
      onSelectionChange={onSelectionChange}
    >
      <div
        className={styles.superGrid}
        role="grid"
        aria-label="SuperGrid data view"
      >
        <GridContainer
          columns={layout.gridTemplate.columns}
          rows={layout.gridTemplate.rows}
        >
          {/* Corner cells (MiniNav) */}
          {layout.cornerCells.map((cell, i) => (
            <CornerCell
              key={`corner-${i}`}
              placement={cell.placement}
              label={cell.label}
            />
          ))}

          {/* Column headers */}
          {layout.colHeaders.map((header) => (
            <ColHeader
              key={`col-${header.node.id}-${header.depth}`}
              node={header.node}
              placement={header.placement}
              depth={header.depth}
              onClick={() => handleColHeaderClick(header.path)}
            />
          ))}

          {/* Row headers */}
          {layout.rowHeaders.map((header) => (
            <RowHeader
              key={`row-${header.node.id}-${header.depth}`}
              node={header.node}
              placement={header.placement}
              depth={header.depth}
              onClick={() => handleRowHeaderClick(header.path)}
            />
          ))}

          {/* Data cells */}
          {layout.dataCells.map(({ rowLeaf, colLeaf, placement }) => {
            const cell = getCell(rowLeaf.path, colLeaf.path);
            return (
              <DataCell
                key={`data-${rowLeaf.path.join('-')}-${colLeaf.path.join('-')}`}
                placement={placement}
                cell={cell}
                rowPath={rowLeaf.path}
                colPath={colLeaf.path}
                renderCell={renderCell}
              />
            );
          })}
        </GridContainer>
      </div>
    </SuperGridCSSProvider>
  );
};

export default SuperGridCSS;
