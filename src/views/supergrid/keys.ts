/**
 * Shared compound key utility for SuperGrid.
 *
 * Single source of truth for all key construction and parsing across
 * SuperGrid, SuperGridSelect, and BBoxCache.
 *
 * Key format decisions (from Phase 28 CONTEXT.md):
 *   - Within-dimension: \x1f (U+001F unit separator) — matches SuperStackHeader parentPath convention
 *   - Cross-dimension:  \x1e (U+001E record separator) — unambiguous boundary between row/col keys
 *   - Null/undefined coercion to 'None' — matches existing SuperGrid convention for row values
 */

import type { CellDatum } from '../../worker/protocol';
import type { AxisMapping } from '../../providers/types';

// ---------------------------------------------------------------------------
// Separator constants — exported for consumers that need the raw characters
// ---------------------------------------------------------------------------

/** U+001F unit separator — joins axis values within a single dimension key. */
export const UNIT_SEP = '\x1f';

/** U+001E record separator — separates the row dimension key from the col dimension key. */
export const RECORD_SEP = '\x1e';

// ---------------------------------------------------------------------------
// buildDimensionKey
// ---------------------------------------------------------------------------

/**
 * Build a compound key for a single dimension (row or col) by joining each
 * axis field value from `cell` with UNIT_SEP (\x1f).
 *
 * - Null or undefined values are coerced to the string `'None'`.
 * - If `axes` is empty, returns an empty string.
 *
 * Examples:
 *   buildDimensionKey({folder:'Work'}, [{field:'folder'}]) → 'Work'
 *   buildDimensionKey({folder:'Work', status:'Active'}, [{field:'folder'},{field:'status'}])
 *     → 'Work\x1fActive'
 *   buildDimensionKey({folder:null}, [{field:'folder'}]) → 'None'
 */
export function buildDimensionKey(
  cell: CellDatum,
  axes: ReadonlyArray<{ field: string }>
): string {
  return axes.map((axis) => String(cell[axis.field] ?? 'None')).join(UNIT_SEP);
}

// ---------------------------------------------------------------------------
// buildCellKey
// ---------------------------------------------------------------------------

/**
 * Build the full compound cell key by combining the row dimension key and
 * the col dimension key, separated by RECORD_SEP (\x1e).
 *
 * Format: `{rowDimKey}\x1e{colDimKey}`
 *
 * Examples:
 *   buildCellKey({folder:'Work', card_type:'note'}, [{field:'folder'}], [{field:'card_type'}])
 *     → 'Work\x1enote'
 *   buildCellKey({folder:'Work', status:'Active', card_type:'note', priority:'High'},
 *     [{field:'folder'},{field:'status'}], [{field:'card_type'},{field:'priority'}])
 *     → 'Work\x1fActive\x1enote\x1fHigh'
 */
export function buildCellKey(
  cell: CellDatum,
  rowAxes: ReadonlyArray<{ field: string }>,
  colAxes: ReadonlyArray<{ field: string }>
): string {
  return buildDimensionKey(cell, rowAxes) + RECORD_SEP + buildDimensionKey(cell, colAxes);
}

// ---------------------------------------------------------------------------
// parseCellKey
// ---------------------------------------------------------------------------

/**
 * Parse a compound cell key into its row and col dimension key components.
 *
 * Splits on the first occurrence of RECORD_SEP (\x1e). Everything before
 * the separator is `rowKey`; everything after is `colKey`.
 *
 * If no separator is found, returns `{ rowKey: cellKey, colKey: '' }`.
 *
 * Examples:
 *   parseCellKey('Work\x1enote')           → { rowKey: 'Work', colKey: 'note' }
 *   parseCellKey('Work\x1fActive\x1eNote\x1fHigh')
 *     → { rowKey: 'Work\x1fActive', colKey: 'Note\x1fHigh' }
 *   parseCellKey('Work')                  → { rowKey: 'Work', colKey: '' }
 */
export function parseCellKey(cellKey: string): { rowKey: string; colKey: string } {
  const idx = cellKey.indexOf(RECORD_SEP);
  if (idx === -1) {
    return { rowKey: cellKey, colKey: '' };
  }
  return {
    rowKey: cellKey.slice(0, idx),
    colKey: cellKey.slice(idx + 1),
  };
}

// ---------------------------------------------------------------------------
// findCellInData
// ---------------------------------------------------------------------------

/**
 * Reverse-lookup: find the CellDatum whose compound key matches `cellKey`.
 *
 * Performs an O(N) scan using buildCellKey for each cell. Acceptable for
 * SuperGrid cell counts (typically hundreds, not millions).
 *
 * Returns `undefined` if no matching cell is found.
 */
export function findCellInData(
  cellKey: string,
  cells: readonly CellDatum[],
  rowAxes: ReadonlyArray<{ field: string }>,
  colAxes: ReadonlyArray<{ field: string }>
): CellDatum | undefined {
  for (const cell of cells) {
    if (buildCellKey(cell, rowAxes, colAxes) === cellKey) {
      return cell;
    }
  }
  return undefined;
}
