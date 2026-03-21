// Isometry v5 — Phase 99 SuperStackSpans Plugin
// SuperStack multi-level header spanning plugin for the pivot overlay.
//
// Design:
//   - Ports the SuperStackHeader.buildHeaderCells() algorithm from Phase 7
//   - Adapts output from CSS Grid positions to absolute-positioned overlay divs
//   - Cardinality guard: MAX_LEAF_COLUMNS = 50 (local constant, self-contained)
//   - Uses afterRender hook to replace default pivot overlay headers with
//     N-level run-length parent-boundary-aware spanning cells
//   - collapse support via collapsedSet (passed from superstack.collapse in Plan 02;
//     Plan 01 always passes an empty Set)
//
// Requirements: SSP-01, SSP-02, SSP-03, SSP-04, SSP-05

import type { GridLayout, PluginHook, RenderContext } from './PluginTypes';
import type { SuperStackState } from './SuperStackCollapse';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum leaf columns before cardinality guard collapses excess into 'Other'. */
export const MAX_LEAF_COLUMNS = 50;

// ---------------------------------------------------------------------------
// HeaderCell type (local adaptation — absolute-positioned overlay output)
// ---------------------------------------------------------------------------

export interface HeaderCell {
	/** Axis value label displayed in the header. */
	value: string;
	/** Nesting level: 0 = outermost (primary), 1 = secondary, ... */
	level: number;
	/** 1-based column start position in leaf column space. */
	colStart: number;
	/** Number of leaf columns this header covers. */
	colSpan: number;
	/** Whether this header group is currently collapsed. */
	isCollapsed: boolean;
	/** \x1f-joined ancestor values at levels 0..(level-1). Empty for level 0. */
	parentPath: string;
}

// ---------------------------------------------------------------------------
// Extended RenderContext with layout sizing (passed from PivotGrid)
// ---------------------------------------------------------------------------

export interface RenderContextWithLayout extends RenderContext {
	layout: GridLayout & {
		headerWidth: number;
		headerHeight: number;
		cellWidth: number;
		cellHeight: number;
	};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Apply cardinality guard: if leaf count exceeds MAX_LEAF_COLUMNS, collapse
 * the excess leaf values (from the end of the list) into an 'Other' bucket.
 *
 * Ported from SuperStackHeader.applyCardinalityGuard().
 */
function applyCardinalityGuard(axisValues: string[][]): string[][] {
	if (axisValues.length <= MAX_LEAF_COLUMNS) return axisValues;

	const kept = axisValues.slice(0, MAX_LEAF_COLUMNS - 1);
	const depth = axisValues[0]?.length ?? 1;
	// Build an 'Other' tuple with same depth as the input tuples
	const otherTuple = axisValues[MAX_LEAF_COLUMNS - 1]!.slice(0, depth - 1).concat(['Other']);
	return [...kept, otherTuple];
}

// ---------------------------------------------------------------------------
// Public API: buildHeaderCells
// ---------------------------------------------------------------------------

/**
 * Build header cells for all levels from axis value tuples.
 *
 * Ported from SuperStackHeader.buildHeaderCells() (Phase 7).
 * Adapted for pivot overlay: outputs HeaderCell[][] with absolute positioning data.
 *
 * @param axisValues - Array of tuples, each representing one leaf column.
 *   Length of tuple = number of levels. Example: [['X','a'], ['X','b'], ['Y','c']]
 * @param collapsedSet - Set of 'level\x1fparentPath\x1fvalue' keys for collapsed headers.
 *   Plan 01: always pass new Set(). Plan 02 (collapse plugin): populates this.
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

	// Initialize headers array
	const headers: HeaderCell[][] = [];
	for (let level = 0; level < depth; level++) {
		headers.push([]);
	}

	// Build "slots" — the list of visible column positions.
	// A slot is either:
	//   - A fully visible leaf (collapsedAtLevel = null)
	//   - A representative for a collapsed group (collapsedAtLevel = N)
	interface Slot {
		tuple: string[];
		collapsedAtLevel: number | null;
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
			// Under a collapsed parent — skip all tuples sharing the same collapse prefix
			const collapsePrefix = tuple.slice(0, collapsedAt + 1).join('\x00');
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

	// Build header cells per level using run-length encoding on the slots
	for (let level = 0; level < depth; level++) {
		const levelCells: HeaderCell[] = [];
		let colStart = 1;
		let j = 0;

		while (j < slots.length) {
			const slot = slots[j]!;
			const currentValue = slot.tuple[level] ?? '';
			// Internal parent path (for grouping — uses \x00)
			const internalParentPath = slot.tuple.slice(0, level).join('\x00');
			// External parent path (for collapse key — uses \x1f, load-bearing from Phase 7)
			const externalParentPath = slot.tuple.slice(0, level).join('\x1f');
			const isCollapsed = collapsedSet.has(
				`${level}\x1f${externalParentPath}\x1f${currentValue}`,
			);

			// If this level is deeper than the collapsed ancestor, skip
			if (slot.collapsedAtLevel !== null && level > slot.collapsedAtLevel) {
				colStart++;
				j++;
				continue;
			}

			// Count run length: consecutive slots with same value AND same parent path
			let runLength = 1;
			while (j + runLength < slots.length) {
				const nextSlot = slots[j + runLength]!;
				const nextValue = nextSlot.tuple[level] ?? '';
				const nextInternalParentPath = nextSlot.tuple.slice(0, level).join('\x00');
				const nextCollapsedAt = nextSlot.collapsedAtLevel;

				if (
					nextValue === currentValue &&
					nextInternalParentPath === internalParentPath &&
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

// ---------------------------------------------------------------------------
// Plugin factory: createSuperStackSpansPlugin
// ---------------------------------------------------------------------------

/**
 * Factory for the superstack.spanning plugin.
 *
 * Returns a PluginHook whose afterRender hook:
 *   1. Clears existing .pv-col-span and .pv-row-span elements from the overlay
 *   2. Re-renders them using the buildHeaderCells algorithm (N-level run-length spans)
 *   3. Applies absolute positioning for column headers (left offset + translateX for scroll)
 *   4. Applies absolute positioning for row headers (top offset + translateY for scroll)
 *
 * Plan 01: collapse is not yet wired — passes empty Set to buildHeaderCells.
 * Plan 02: pass shared SuperStackState so collapsedSet is reflected in spanning output.
 *
 * @param state - Optional shared SuperStackState. If not provided, uses empty Set (Plan 01 compat).
 */
export function createSuperStackSpansPlugin(state?: SuperStackState): PluginHook {
	return {
		afterRender(root: HTMLElement, ctx: RenderContext): void {
			// Access layout sizing — PivotGrid extends RenderContext with layout
			const ctxWithLayout = ctx as RenderContextWithLayout;
			const layout = ctxWithLayout.layout;

			if (!layout) return;

			const {
				headerWidth,
				headerHeight,
				cellWidth,
				cellHeight,
			} = layout;

			const {
				rowDimensions,
				colDimensions,
				visibleRows,
				visibleCols,
				scrollLeft,
				scrollTop,
			} = ctx;

			// Remove existing span headers (plugin replaces them with enhanced versions)
			root.querySelectorAll('.pv-col-span, .pv-row-span').forEach((el) => el.remove());

			const totalRowHeaderWidth = headerWidth * rowDimensions.length;
			const totalColHeaderHeight = headerHeight * colDimensions.length;

			// Use shared collapsedSet if state is provided (Plan 02); fall back to empty Set
			const collapsedSet = state?.collapsedSet ?? new Set<string>();

			// ---- Column headers ----
			if (colDimensions.length > 0 && visibleCols.length > 0) {
				const { headers: colHeaders } = buildHeaderCells(visibleCols, collapsedSet);

				for (const levelCells of colHeaders) {
					for (const cell of levelCells) {
						const isLeaf = cell.level === colDimensions.length - 1;

						const el = document.createElement('div');
						el.className = [
							'pv-col-span',
							isLeaf ? 'pv-col-span--leaf' : '',
							!isLeaf ? 'pv-col-span--collapsible' : '',
							cell.isCollapsed ? 'pv-col-span--collapsed' : '',
						]
							.filter(Boolean)
							.join(' ');

						el.setAttribute('data-level', String(cell.level));

						// Position: left = totalRowHeaderWidth + (colStart - 1) * cellWidth
						const left = totalRowHeaderWidth + (cell.colStart - 1) * cellWidth;
						const top = cell.level * headerHeight;
						const width = cellWidth * cell.colSpan;

						Object.assign(el.style, {
							position: 'absolute',
							left: `${left}px`,
							top: `${top}px`,
							width: `${width}px`,
							height: `${headerHeight}px`,
							zIndex: '11',
							boxSizing: 'border-box',
							transform: `translateX(-${scrollLeft}px)`,
							pointerEvents: 'auto',
						});

						// Inner content
						if (!isLeaf) {
							// Parent header: chevron + label (+ count if collapsed)
							const chevron = document.createElement('span');
							chevron.className = 'pv-span-chevron';
							chevron.textContent = cell.isCollapsed ? '▶' : '▼';

							const label = document.createTextNode(` ${cell.value}`);

							el.appendChild(chevron);
							el.appendChild(label);

							if (cell.isCollapsed) {
								const count = document.createElement('span');
								count.className = 'pv-span-count';
								count.textContent = ` (${cell.colSpan})`;
								el.appendChild(count);
							}
						} else {
							el.textContent = cell.value;
						}

						root.appendChild(el);
					}
				}
			}

			// ---- Row headers ----
			if (rowDimensions.length > 0 && visibleRows.length > 0) {
				const { headers: rowHeaders } = buildHeaderCells(visibleRows, collapsedSet);

				for (const levelCells of rowHeaders) {
					for (const cell of levelCells) {
						const isLeaf = cell.level === rowDimensions.length - 1;

						const el = document.createElement('div');
						el.className = [
							'pv-row-span',
							isLeaf ? 'pv-row-span--leaf' : '',
							!isLeaf ? 'pv-row-span--collapsible' : '',
							cell.isCollapsed ? 'pv-row-span--collapsed' : '',
						]
							.filter(Boolean)
							.join(' ');

						el.setAttribute('data-level', String(cell.level));

						// Position: left = level * headerWidth, top = totalColHeaderHeight + (colStart-1) * cellHeight
						const left = cell.level * headerWidth;
						const top = totalColHeaderHeight + (cell.colStart - 1) * cellHeight;
						const height = cellHeight * cell.colSpan; // colSpan = rowSpan here

						Object.assign(el.style, {
							position: 'absolute',
							left: `${left}px`,
							top: `${top}px`,
							width: `${headerWidth}px`,
							height: `${height}px`,
							zIndex: '12',
							boxSizing: 'border-box',
							transform: `translateY(-${scrollTop}px)`,
							pointerEvents: 'auto',
						});

						// Inner content
						if (!isLeaf) {
							const chevron = document.createElement('span');
							chevron.className = 'pv-span-chevron';
							chevron.textContent = cell.isCollapsed ? '▶' : '▼';

							const label = document.createTextNode(` ${cell.value}`);
							el.appendChild(chevron);
							el.appendChild(label);

							if (cell.isCollapsed) {
								const count = document.createElement('span');
								count.className = 'pv-span-count';
								count.textContent = ` (${cell.colSpan})`;
								el.appendChild(count);
							}
						} else {
							el.textContent = cell.value;
						}

						root.appendChild(el);
					}
				}
			}
		},
	};
}
