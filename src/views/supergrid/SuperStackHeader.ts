// Isometry v5 — Phase 7 SuperStackHeader
// Nested dimensional header spanning algorithm for SuperGrid.
//
// Design:
//   - buildHeaderCells computes CSS grid-column spanning from stacked PAFV axes
//   - Inputs are axis value tuples (one per leaf column): e.g., [['X','a'], ['X','b'], ['Y','c']]
//   - Run-length encoding collapses consecutive identical values into spanning cells
//   - Collapsed headers: parent gets colSpan=1 and children are omitted from output
//   - Cardinality guard: max 50 leaf columns, excess values merged into 'Other'
//   - buildGridTemplateColumns produces CSS grid-template-columns string with per-column px values
//
// Requirements: REND-02, REND-05, SIZE-01

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum leaf columns before cardinality guard collapses excess into 'Other'. */
export const MAX_LEAF_COLUMNS = 50;

/** Default column width in pixels at 1x zoom (matches SuperZoom.BASE_COL_WIDTH). */
const DEFAULT_COL_WIDTH = 120;

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
	/** \x1f-joined ancestor values at levels 0..(level-1).
	 *  Empty string for level 0. Used to construct parent-aware collapse keys
	 *  that prevent collisions when the same value appears under different parents. */
	parentPath: string;
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
 * @param collapsedSet - Set of 'level\x1fparentPath\x1fvalue' keys for collapsed header groups.
 *   Example: Set(['0\x1f\x1fX']) collapses the 'X' group at level 0 (parentPath empty for level 0).
 * @returns headers: one array of HeaderCell per level, leafCount: visible leaf count.
 */
export function buildHeaderCells(
	axisValues: string[][],
	collapsedSet: Set<string>,
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

	const _leaves: LeafInfo[] = guardedValues.map((tuple) => {
		let visible = true;
		for (let level = 0; level < depth - 1; level++) {
			const parentPath = tuple.slice(0, level).join('\x1f');
			const parentKey = `${level}\x1f${parentPath}\x1f${tuple[level]}`;
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
			const parentPath = tuple.slice(0, level).join('\x1f');
			const key = `${level}\x1f${parentPath}\x1f${tuple[level]}`;
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
			// The parent path for this slot at this level (internal grouping uses \x00)
			const internalParentPath = slot.tuple.slice(0, level).join('\x00');
			// External parent path for collapse key uses \x1f (stored in _collapsedSet)
			const externalParentPath = slot.tuple.slice(0, level).join('\x1f');
			const isCollapsed = collapsedSet.has(`${level}\x1f${externalParentPath}\x1f${currentValue}`);

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
				const nextInternalParentPath = nextSlot.tuple.slice(0, level).join('\x00');
				const nextCollapsedAt = nextSlot.collapsedAtLevel;

				// Only merge if same value AND same parent path AND same collapse state at this level
				if (
					nextValue === currentValue &&
					nextInternalParentPath === internalParentPath &&
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
				parentPath: externalParentPath,
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
 * Produces individual pixel values per column (not repeat() or CSS Custom Properties)
 * so each column has an independent, zoom-scaled width. This enables per-column resize
 * (Phase 20 SuperSize) while preserving zoom scaling via zoomLevel multiplication.
 *
 * Phase 29: The row header area now supports N levels, each 80px wide by default.
 * rowHeaderDepth specifies how many row-header columns to prepend (one per row axis level).
 * rowHeaderLevelWidth controls the width of each header column (default: 80px).
 *
 * @param leafColKeys - Ordered array of leaf column keys (colKey values) from header cells
 * @param colWidths - Map of colKey → base pixel width (pre-zoom). Unknown keys use DEFAULT_COL_WIDTH.
 * @param zoomLevel - Current zoom level multiplier (1.0 = 100%, 2.0 = 200%)
 * @param rowHeaderDepth - Number of row header columns to prepend (default: 1)
 * @param rowHeaderLevelWidth - Width in pixels of each row header column (default: 80)
 * @returns CSS grid-template-columns string with individual px values per column
 *
 * @example
 * buildGridTemplateColumns(['note','task'], new Map(), 1.0) → '80px 120px 120px'
 * buildGridTemplateColumns(['note','task'], new Map(), 1.0, 2) → '80px 80px 120px 120px'
 * buildGridTemplateColumns(['note','task'], new Map(), 1.0, 3) → '80px 80px 80px 120px 120px'
 * buildGridTemplateColumns([], new Map(), 1.0, 2) → '80px 80px'
 * buildGridTemplateColumns(['note','task'], new Map([['note', 200]]), 1.0) → '80px 200px 120px'
 */
export function buildGridTemplateColumns(
	leafColKeys: string[],
	colWidths: Map<string, number>,
	zoomLevel: number,
	rowHeaderDepth = 1,
	rowHeaderLevelWidth = 80,
): string {
	const headerColPart = Array(rowHeaderDepth).fill(`${rowHeaderLevelWidth}px`).join(' ');
	if (leafColKeys.length === 0) {
		return headerColPart;
	}
	const colDefs = leafColKeys.map((key) => {
		const baseWidth = colWidths.get(key) ?? DEFAULT_COL_WIDTH;
		return `${Math.round(baseWidth * zoomLevel)}px`;
	});
	return `${headerColPart} ${colDefs.join(' ')}`;
}
