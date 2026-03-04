// Isometry v5 — Phase 7 SuperStackHeader
// Nested dimensional header spanning algorithm for SuperGrid.
//
// Design:
//   - buildHeaderCells computes CSS grid-column spanning from stacked PAFV axes
//   - Inputs are axis value tuples (one per leaf column): e.g., [['X','a'], ['X','b'], ['Y','c']]
//   - Run-length encoding collapses consecutive identical values into spanning cells
//   - Collapsed headers: parent gets colSpan=1 and children are omitted from output
//   - Cardinality guard: max 50 leaf columns, excess values merged into 'Other'
//   - buildGridTemplateColumns produces CSS grid-template-columns string
//
// Requirements: REND-02, REND-05

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum leaf columns before cardinality guard collapses excess into 'Other'. */
export const MAX_LEAF_COLUMNS = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single cell in a dimensional header row.
 *
 * Used by SuperGrid to render CSS Grid column headers with correct spanning.
 * Parent headers span the count of their child leaf columns via grid-column: span N.
 */
export interface HeaderCell {
  /** Axis value label displayed in the header */
  value: string;
  /** Nesting level: 0 = outermost (primary), 1 = secondary, 2 = tertiary */
  level: number;
  /** 1-based CSS grid-column-start position */
  colStart: number;
  /** CSS grid-column: span N — number of leaf columns this header covers */
  colSpan: number;
  /** Whether the user has collapsed this header group */
  isCollapsed: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Apply cardinality guard: if leaf count exceeds MAX_LEAF_COLUMNS, collapse
 * the excess leaf values (from the end of the list) into an 'Other' bucket.
 *
 * Works by truncating the axis values array and replacing the last entry
 * with tuples that share the same parent path but have value 'Other'.
 */
function applyCardinalityGuard(axisValues: string[][]): string[][] {
  if (axisValues.length <= MAX_LEAF_COLUMNS) return axisValues;

  const kept = axisValues.slice(0, MAX_LEAF_COLUMNS - 1);
  // Build an 'Other' tuple with same depth as the input tuples
  const depth = axisValues[0]?.length ?? 1;
  const otherTuple = axisValues[MAX_LEAF_COLUMNS - 1]!.slice(0, depth - 1).concat(['Other']);
  return [...kept, otherTuple];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build header cells for all levels from axis value tuples.
 *
 * @param axisValues - Array of tuples, each representing one leaf column.
 *   Length of tuple = number of levels (1, 2, or 3).
 *   Example: [['X','a'], ['X','b'], ['Y','c']]
 * @param collapsedSet - Set of 'level:value' keys for collapsed header groups.
 *   Example: Set(['0:X']) collapses the 'X' group at level 0.
 * @returns headers: one array of HeaderCell per level, leafCount: visible leaf count.
 */
export function buildHeaderCells(
  axisValues: string[][],
  collapsedSet: Set<string>
): { headers: HeaderCell[][]; leafCount: number } {
  if (axisValues.length === 0) {
    return { headers: [], leafCount: 0 };
  }

  // Apply cardinality guard before any processing
  const guardedValues = applyCardinalityGuard(axisValues);
  const depth = guardedValues[0]!.length;

  // Process leaf columns, tracking which ones are visible (not under a collapsed parent)
  // Build header cells for each level using run-length encoding.

  // Strategy:
  // 1. Walk through guardedValues, tracking the "effective" leaf columns
  //    (some are hidden because an ancestor is collapsed)
  // 2. For each level, detect runs of consecutive identical (parent-path, value) combinations
  //    and emit HeaderCell with colSpan = run length

  // Pre-compute which leaf columns are visible and their cumulative colStart positions
  // A leaf is hidden if any ancestor is collapsed.
  interface LeafInfo {
    tuple: string[];
    isVisible: boolean; // true if all ancestor groups are uncollapsed
  }

  const leaves: LeafInfo[] = guardedValues.map(tuple => {
    let visible = true;
    for (let level = 0; level < depth - 1; level++) {
      const parentKey = `${level}:${tuple[level]}`;
      if (collapsedSet.has(parentKey)) {
        visible = false;
        break;
      }
    }
    return { tuple, isVisible: visible };
  });

  // Count visible leaves — collapsed parent groups contribute 1 visible leaf each.
  // But we also need to track "placeholder" positions for collapsed groups.
  // When a parent is collapsed, all its children are hidden but the parent still takes 1 column.

  // Build a richer representation:
  // Walk through leaf tuples, at each level, group by unique (parent-path + current-value).
  // For collapsed parents, stop descending.

  // For level 0: group consecutive identical values
  // For level 1: group consecutive identical (level0val, level1val) pairs — but skip if level0 collapsed
  // etc.

  const headers: HeaderCell[][] = [];
  for (let level = 0; level < depth; level++) {
    headers.push([]);
  }

  // We need to determine column positions in terms of "visible leaf columns".
  // A visible leaf column is:
  //   - A leaf tuple where no ancestor level is collapsed
  //   - OR a representative "collapsed" position for a collapsed parent group

  // Build the list of visible column slots
  // Each slot = one css grid column; represents either a visible leaf or a collapsed group
  interface Slot {
    tuple: string[];
    collapsedAtLevel: number | null; // which level was the first collapsed ancestor (-1 if none)
  }

  const slots: Slot[] = [];
  let i = 0;
  while (i < guardedValues.length) {
    const tuple = guardedValues[i]!;
    let collapsedAt: number | null = null;

    // Find the first collapsed ancestor
    for (let level = 0; level < depth - 1; level++) {
      const key = `${level}:${tuple[level]}`;
      if (collapsedSet.has(key)) {
        collapsedAt = level;
        break;
      }
    }

    if (collapsedAt === null) {
      // Fully visible leaf — add single slot
      slots.push({ tuple, collapsedAtLevel: null });
      i++;
    } else {
      // This leaf is under a collapsed parent at `collapsedAt`.
      // Skip all consecutive leaves that share the same collapsed ancestor path.
      const collapsePrefix = tuple.slice(0, collapsedAt + 1).join('\x00');
      // Advance i past all tuples with the same prefix at collapsedAt level
      while (i < guardedValues.length) {
        const t = guardedValues[i]!;
        const prefix = t.slice(0, collapsedAt + 1).join('\x00');
        if (prefix === collapsePrefix) {
          i++;
        } else {
          break;
        }
      }
      // Add one representative slot for the collapsed group
      slots.push({ tuple, collapsedAtLevel: collapsedAt });
    }
  }

  const leafCount = slots.length;

  // Now build header cells per level using run-length encoding on the slots
  for (let level = 0; level < depth; level++) {
    const levelCells: HeaderCell[] = [];
    let colStart = 1;
    let j = 0;

    while (j < slots.length) {
      const slot = slots[j]!;
      const currentValue = slot.tuple[level] ?? '';
      // The parent path for this slot at this level
      const parentPath = slot.tuple.slice(0, level).join('\x00');
      const isCollapsed = collapsedSet.has(`${level}:${currentValue}`);

      // If this level is deeper than the collapsed ancestor, skip it
      // (cell belongs to a hidden level, but we still need placeholder logic)
      if (slot.collapsedAtLevel !== null && level > slot.collapsedAtLevel) {
        // This slot's level is below the collapsed ancestor — no cell for this level
        colStart++;
        j++;
        continue;
      }

      // Count run length: consecutive slots with same value AND same parent path at this level
      let runLength = 1;
      while (j + runLength < slots.length) {
        const nextSlot = slots[j + runLength]!;
        const nextValue = nextSlot.tuple[level] ?? '';
        const nextParentPath = nextSlot.tuple.slice(0, level).join('\x00');
        const nextCollapsedAt = nextSlot.collapsedAtLevel;

        // Only merge if same value AND same parent path AND same collapse state at this level
        if (
          nextValue === currentValue &&
          nextParentPath === parentPath &&
          // Both must have same collapse ancestor (or both none)
          nextCollapsedAt === slot.collapsedAtLevel
        ) {
          runLength++;
        } else {
          break;
        }
      }

      levelCells.push({
        value: currentValue,
        level,
        colStart,
        colSpan: runLength,
        isCollapsed,
      });

      colStart += runLength;
      j += runLength;
    }

    headers[level] = levelCells;
  }

  return { headers, leafCount };
}

/**
 * Build the CSS grid-template-columns string for SuperGrid.
 *
 * Uses fixed-width CSS Custom Property columns (not flexible 1fr) so that
 * zoom scaling via --sg-col-width can linearly expand/contract data columns.
 * minmax(60px, 1fr) columns cannot be zoomed — they fill the viewport instead.
 *
 * The row header column stays fixed at rowHeaderWidth (default 160px) regardless
 * of zoom level — labels remain readable as a stable anchor.
 *
 * @param leafCount - Number of visible leaf columns (from buildHeaderCells)
 * @param rowHeaderWidth - Width of the row header area in pixels (default: 160)
 * @returns CSS grid-template-columns string
 *
 * @example
 * buildGridTemplateColumns(3) → '160px repeat(3, var(--sg-col-width, 120px))'
 * buildGridTemplateColumns(0) → '160px'
 */
export function buildGridTemplateColumns(
  leafCount: number,
  rowHeaderWidth = 160
): string {
  if (leafCount === 0) {
    return `${rowHeaderWidth}px`;
  }
  return `${rowHeaderWidth}px repeat(${leafCount}, var(--sg-col-width, 120px))`;
}
