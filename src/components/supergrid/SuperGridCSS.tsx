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
import type { SuperGridProps, DataCell as DataCellType, GridPlacement } from './types';
import styles from './styles/SuperGrid.module.css';
import { superGridLogger } from '@/utils/dev-logger';

// Temporary feature flag for summary row/column
const SHOW_SUMMARY = true;

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
  // Aggregates multiple cards per cell (pivot table style)
  const dataMap = useMemo(() => {
    const map = new Map<string, DataCellType[]>();
    for (const cell of data) {
      const key = getCellKey(cell.rowPath, cell.colPath);
      const existing = map.get(key);
      if (existing) {
        existing.push(cell);
      } else {
        map.set(key, [cell]);
      }
    }
    // Debug: log data map stats
    if (data.length > 0) {
      const totalCards = Array.from(map.values()).reduce((sum, arr) => sum + arr.length, 0);
      superGridLogger.debug('[SuperGridCSS] dataMap built:', {
        inputCells: data.length,
        uniqueKeys: map.size,
        totalCards,
        sampleKeys: Array.from(map.keys()).slice(0, 5),
      });
    }
    return map;
  }, [data]);

  // Debug: log layout leaf paths and match statistics
  useMemo(() => {
    if (layout.dataCells.length > 0 && data.length > 0) {
      // Check how many layout cells have matching data
      let matchCount = 0;
      let totalMatchedCards = 0;
      const unmatchedSamples: string[] = [];
      const matchedSamples: { key: string; count: number }[] = [];

      for (const dc of layout.dataCells) {
        const key = getCellKey(dc.rowLeaf.path, dc.colLeaf.path);
        const cells = dataMap.get(key);
        if (cells && cells.length > 0) {
          matchCount++;
          totalMatchedCards += cells.length;
          if (matchedSamples.length < 3) matchedSamples.push({ key, count: cells.length });
        } else {
          if (unmatchedSamples.length < 5) unmatchedSamples.push(key);
        }
      }

      // Find unmatched data keys (cards that don't match any header cell)
      const layoutKeys = new Set(layout.dataCells.map(dc => getCellKey(dc.rowLeaf.path, dc.colLeaf.path)));
      const unmatchedDataKeys: string[] = [];
      for (const key of dataMap.keys()) {
        if (!layoutKeys.has(key) && unmatchedDataKeys.length < 5) {
          unmatchedDataKeys.push(key);
        }
      }

      superGridLogger.debug('[SuperGridCSS] MATCH ANALYSIS:', {
        layoutCells: layout.dataCells.length,
        inputCards: data.length,
        cellsWithData: matchCount,
        totalMatchedCards,
        unmatchedCards: data.length - totalMatchedCards,
        matchRate: `${((totalMatchedCards / data.length) * 100).toFixed(1)}%`,
        matchedSamples,
        unmatchedLayoutCells: unmatchedSamples,
        unmatchedDataKeys,
        allLayoutKeys: layout.dataCells.slice(0, 10).map(dc => getCellKey(dc.rowLeaf.path, dc.colLeaf.path)),
        allDataKeys: Array.from(dataMap.keys()).slice(0, 10),
      });
    }
  }, [layout.dataCells, data, dataMap]);

  // Get aggregated data cell by path
  // Returns a single DataCell with count in value, or array in rawValue
  const getCell = useCallback(
    (rowPath: string[], colPath: string[]): DataCellType | undefined => {
      const key = getCellKey(rowPath, colPath);
      const cells = dataMap.get(key);
      if (!cells || cells.length === 0) return undefined;

      // Aggregate: show count, store all cards in rawValue
      return {
        rowPath,
        colPath,
        value: cells.length, // Show count
        rawValue: cells, // Store all cards for drill-down
      };
    },
    [dataMap]
  );

  // Calculate summary data (row totals, column totals, grand total)
  const summaryData = useMemo(() => {
    if (!SHOW_SUMMARY) return null;

    // Get leaf nodes from metrics (in correct order by leafStart)
    const rowLeaves = layout.rowMetrics.flatNodes
      .filter(n => n.isLeaf)
      .sort((a, b) => a.leafStart - b.leafStart);
    const colLeaves = layout.colMetrics.flatNodes
      .filter(n => n.isLeaf)
      .sort((a, b) => a.leafStart - b.leafStart);

    const rowLeafPaths = rowLeaves.map(n => n.path);
    const colLeafPaths = colLeaves.map(n => n.path);

    // Calculate row totals (sum across all columns for each row)
    const rowTotals = new Map<string, number>();
    for (const rowPath of rowLeafPaths) {
      let total = 0;
      for (const colPath of colLeafPaths) {
        const key = getCellKey(rowPath, colPath);
        const cells = dataMap.get(key);
        if (cells) total += cells.length;
      }
      rowTotals.set(getCellKey(rowPath, []), total);
    }

    // Calculate column totals (sum down all rows for each column)
    const colTotals = new Map<string, number>();
    for (const colPath of colLeafPaths) {
      let total = 0;
      for (const rowPath of rowLeafPaths) {
        const key = getCellKey(rowPath, colPath);
        const cells = dataMap.get(key);
        if (cells) total += cells.length;
      }
      colTotals.set(getCellKey([], colPath), total);
    }

    // Calculate grand total
    let grandTotal = 0;
    for (const total of rowTotals.values()) {
      grandTotal += total;
    }

    return { rowTotals, colTotals, grandTotal, rowLeafPaths, colLeafPaths };
  }, [layout.rowMetrics, layout.colMetrics, dataMap]);

  // Extend grid template with summary row/column
  const extendedGridTemplate = useMemo(() => {
    if (!SHOW_SUMMARY) return layout.gridTemplate;

    return {
      columns: `${layout.gridTemplate.columns} 70px`, // Add summary column
      rows: `${layout.gridTemplate.rows} 28px`, // Add summary row
    };
  }, [layout.gridTemplate]);

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
          columns={extendedGridTemplate.columns}
          rows={extendedGridTemplate.rows}
        >
          {/* Corner cells (MiniNav) */}
          {layout.cornerCells.map((cell, i) => (
            <CornerCell
              key={`corner-${i}`}
              placement={cell.placement}
              label={cell.label}
              col={cell.col}
              row={cell.row}
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

          {/* Summary cells (temporary feature) */}
          {SHOW_SUMMARY && summaryData && (
            <>
              {/* Summary column header - "Total" spanning all column header rows */}
              <div
                className={`${styles.colHeader} ${styles.depth0}`}
                style={{
                  gridColumnStart: layout.rowHeaderDepth + layout.colMetrics.leafCount + 1,
                  gridColumnEnd: layout.rowHeaderDepth + layout.colMetrics.leafCount + 2,
                  gridRowStart: 1,
                  gridRowEnd: layout.colHeaderDepth + 1,
                  fontWeight: 600,
                }}
              >
                <span className={styles.headerLabel}>Σ Row</span>
              </div>

              {/* Row total cells - one per row leaf */}
              {summaryData.rowLeafPaths.map((rowPath, rowIndex) => {
                const total = summaryData.rowTotals.get(getCellKey(rowPath, [])) || 0;
                const placement: GridPlacement = {
                  gridRowStart: layout.colHeaderDepth + 1 + rowIndex,
                  gridRowEnd: layout.colHeaderDepth + 2 + rowIndex,
                  gridColumnStart: layout.rowHeaderDepth + layout.colMetrics.leafCount + 1,
                  gridColumnEnd: layout.rowHeaderDepth + layout.colMetrics.leafCount + 2,
                };
                return (
                  <div
                    key={`sum-row-${rowPath.join('-')}`}
                    className={styles.dataCell}
                    style={{
                      ...placement,
                      fontWeight: 600,
                      backgroundColor: '#E8F4FD',
                    }}
                  >
                    {total > 0 ? total : ''}
                  </div>
                );
              })}

              {/* Summary row header - "Total" spanning all row header columns */}
              <div
                className={`${styles.rowHeader} ${styles.depth0}`}
                style={{
                  gridRowStart: layout.colHeaderDepth + layout.rowMetrics.leafCount + 1,
                  gridRowEnd: layout.colHeaderDepth + layout.rowMetrics.leafCount + 2,
                  gridColumnStart: 1,
                  gridColumnEnd: layout.rowHeaderDepth + 1,
                  fontWeight: 600,
                }}
              >
                <span className={styles.headerLabel}>Σ Column</span>
              </div>

              {/* Column total cells - one per column leaf */}
              {summaryData.colLeafPaths.map((colPath, colIndex) => {
                const total = summaryData.colTotals.get(getCellKey([], colPath)) || 0;
                const placement: GridPlacement = {
                  gridRowStart: layout.colHeaderDepth + layout.rowMetrics.leafCount + 1,
                  gridRowEnd: layout.colHeaderDepth + layout.rowMetrics.leafCount + 2,
                  gridColumnStart: layout.rowHeaderDepth + 1 + colIndex,
                  gridColumnEnd: layout.rowHeaderDepth + 2 + colIndex,
                };
                return (
                  <div
                    key={`sum-col-${colPath.join('-')}`}
                    className={styles.dataCell}
                    style={{
                      ...placement,
                      fontWeight: 600,
                      backgroundColor: '#E8F4FD',
                    }}
                  >
                    {total > 0 ? total : ''}
                  </div>
                );
              })}

              {/* Grand total cell - bottom-right corner */}
              <div
                className={styles.dataCell}
                style={{
                  gridRowStart: layout.colHeaderDepth + layout.rowMetrics.leafCount + 1,
                  gridRowEnd: layout.colHeaderDepth + layout.rowMetrics.leafCount + 2,
                  gridColumnStart: layout.rowHeaderDepth + layout.colMetrics.leafCount + 1,
                  gridColumnEnd: layout.rowHeaderDepth + layout.colMetrics.leafCount + 2,
                  fontWeight: 700,
                  backgroundColor: '#D4EDDA',
                }}
              >
                {summaryData.grandTotal}
              </div>
            </>
          )}
        </GridContainer>
      </div>
    </SuperGridCSSProvider>
  );
};

export default SuperGridCSS;
