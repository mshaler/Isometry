/**
 * SuperGridAccessibility - ARIA grid wrapper (A11Y-01)
 *
 * Part of Phase 93 - Polish & Performance
 *
 * Implements W3C ARIA Authoring Practices Guide grid pattern:
 * - role="grid" with aria-rowcount, aria-colcount
 * - Arrow key navigation between cells
 * - Roving tabindex (one focusable cell at a time)
 * - Home/End navigation
 */

import { useRef, useEffect, useCallback, type ReactNode, type RefObject } from 'react';

interface SuperGridAccessibilityProps {
  children: ReactNode;
  /** Total number of rows (including headers) */
  rowCount: number;
  /** Total number of columns (including headers) */
  colCount: number;
  /** Label for screen readers */
  label?: string;
  /** Enable keyboard navigation */
  enableKeyboardNav?: boolean;
  /** Callback when cell receives focus */
  onCellFocus?: (rowIndex: number, colIndex: number) => void;
}

interface GridKeyboardNavOptions {
  enabled: boolean;
  onCellFocus?: (rowIndex: number, colIndex: number) => void;
}

/**
 * useGridKeyboardNavigation - Arrow key navigation for ARIA grid
 *
 * Implements roving tabindex pattern:
 * - Only one cell has tabIndex=0 at a time
 * - Arrow keys move focus between cells
 * - Home/End move to first/last cell in row
 * - Ctrl+Home/End move to first/last cell in grid
 */
export function useGridKeyboardNavigation(
  gridRef: RefObject<HTMLElement>,
  options: GridKeyboardNavOptions
): void {
  const { enabled, onCellFocus } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const grid = gridRef.current;
    if (!grid) return;

    const currentCell = document.activeElement;
    if (!currentCell || !grid.contains(currentCell)) return;

    // Find current position
    const row = currentCell.closest('[role="row"]');
    if (!row) return;

    const cells = Array.from(row.querySelectorAll('[role="gridcell"], [role="rowheader"], [role="columnheader"]'));
    const currentColIndex = cells.indexOf(currentCell as Element);
    const rows = Array.from(grid.querySelectorAll('[role="row"]'));
    const currentRowIndex = rows.indexOf(row as Element);

    let nextCell: Element | null = null;
    let nextRowIndex = currentRowIndex;
    let nextColIndex = currentColIndex;

    switch (event.key) {
      case 'ArrowRight':
        nextColIndex = Math.min(currentColIndex + 1, cells.length - 1);
        nextCell = cells[nextColIndex] || null;
        break;

      case 'ArrowLeft':
        nextColIndex = Math.max(currentColIndex - 1, 0);
        nextCell = cells[nextColIndex] || null;
        break;

      case 'ArrowDown': {
        nextRowIndex = Math.min(currentRowIndex + 1, rows.length - 1);
        const nextRow = rows[nextRowIndex];
        const nextRowCells = nextRow?.querySelectorAll('[role="gridcell"], [role="rowheader"], [role="columnheader"]');
        nextCell = nextRowCells?.[Math.min(currentColIndex, nextRowCells.length - 1)] || null;
        break;
      }

      case 'ArrowUp': {
        nextRowIndex = Math.max(currentRowIndex - 1, 0);
        const prevRow = rows[nextRowIndex];
        const prevRowCells = prevRow?.querySelectorAll('[role="gridcell"], [role="rowheader"], [role="columnheader"]');
        nextCell = prevRowCells?.[Math.min(currentColIndex, prevRowCells.length - 1)] || null;
        break;
      }

      case 'Home':
        if (event.ctrlKey) {
          // Ctrl+Home: first cell in grid
          const firstRow = rows[0];
          const firstRowCells = firstRow?.querySelectorAll('[role="gridcell"], [role="rowheader"], [role="columnheader"]');
          nextCell = firstRowCells?.[0] || null;
          nextRowIndex = 0;
          nextColIndex = 0;
        } else {
          // Home: first cell in current row
          nextCell = cells[0] || null;
          nextColIndex = 0;
        }
        break;

      case 'End':
        if (event.ctrlKey) {
          // Ctrl+End: last cell in grid
          const lastRow = rows[rows.length - 1];
          const lastRowCells = lastRow?.querySelectorAll('[role="gridcell"], [role="rowheader"], [role="columnheader"]');
          nextCell = lastRowCells?.[lastRowCells.length - 1] || null;
          nextRowIndex = rows.length - 1;
          nextColIndex = lastRowCells ? lastRowCells.length - 1 : 0;
        } else {
          // End: last cell in current row
          nextCell = cells[cells.length - 1] || null;
          nextColIndex = cells.length - 1;
        }
        break;

      default:
        return; // Don't prevent default for other keys
    }

    if (nextCell && nextCell !== currentCell) {
      event.preventDefault();

      // Roving tabindex: remove from current, add to next
      (currentCell as HTMLElement).tabIndex = -1;
      (nextCell as HTMLElement).tabIndex = 0;
      (nextCell as HTMLElement).focus();

      // Notify parent of focus change
      onCellFocus?.(nextRowIndex, nextColIndex);
    }
  }, [enabled, gridRef, onCellFocus]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !enabled) return;

    grid.addEventListener('keydown', handleKeyDown);
    return () => grid.removeEventListener('keydown', handleKeyDown);
  }, [gridRef, enabled, handleKeyDown]);
}

/**
 * SuperGridAccessibility - ARIA grid wrapper
 *
 * @example
 * ```tsx
 * <SuperGridAccessibility
 *   rowCount={100}
 *   colCount={10}
 *   label="Data grid with 100 items"
 * >
 *   <GridContent />
 * </SuperGridAccessibility>
 * ```
 */
export function SuperGridAccessibility({
  children,
  rowCount,
  colCount,
  label = 'Data grid with row and column headers',
  enableKeyboardNav = true,
  onCellFocus,
}: SuperGridAccessibilityProps): JSX.Element {
  const gridRef = useRef<HTMLDivElement>(null);

  // Initialize keyboard navigation
  useGridKeyboardNavigation(gridRef, {
    enabled: enableKeyboardNav,
    onCellFocus,
  });

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={label}
      aria-rowcount={rowCount}
      aria-colcount={colCount}
      tabIndex={0}
      className="supergrid-accessible"
    >
      {children}
    </div>
  );
}

/**
 * Helper component for ARIA row
 */
export function GridRow({
  children,
  rowIndex,
}: {
  children: ReactNode;
  rowIndex: number;
}): JSX.Element {
  return (
    <div role="row" aria-rowindex={rowIndex}>
      {children}
    </div>
  );
}

/**
 * Helper component for ARIA grid cell
 */
export function GridCell({
  children,
  colIndex,
  isHeader = false,
  isRowHeader = false,
}: {
  children: ReactNode;
  colIndex: number;
  isHeader?: boolean;
  isRowHeader?: boolean;
}): JSX.Element {
  const role = isHeader ? 'columnheader' : isRowHeader ? 'rowheader' : 'gridcell';

  return (
    <div
      role={role}
      aria-colindex={colIndex}
      tabIndex={-1} // Roving tabindex: -1 by default, 0 when focused
    >
      {children}
    </div>
  );
}
