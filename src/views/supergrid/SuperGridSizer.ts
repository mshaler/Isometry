// Isometry v5 — SuperGridSizer
// Column resize interaction handler for SuperGrid using Pointer Events API.
//
// Design:
//   - Lifecycle pattern mirrors SuperZoom: attach(gridEl) / detach()
//   - addHandleToHeader: appends 8px right-edge drag handle to leaf column headers
//   - Pointer Events setPointerCapture for robust drag tracking (finger-lift safe)
//   - Single-column drag: dx / zoomLevel → base px width, clamped to MIN_COL_WIDTH
//   - Shift+drag: normalizes ALL visible leaf columns to same base width
//   - pointercancel: reverts to pre-drag startWidth (does NOT persist)
//   - dblclick: auto-fits to max(header scrollWidth, widest data cell scrollWidth) + padding
//   - onWidthsChange callback fires on pointerup only (persistence hook)
//   - applyWidths: rebuilds grid-template-columns via buildGridTemplateColumns
//
// Requirements: SIZE-01, SIZE-02, SIZE-03, SIZE-04

import { buildGridTemplateColumns } from './SuperStackHeader';
import { BASE_COL_WIDTH } from './SuperZoom';

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

/** Minimum column width in base px — columns cannot be dragged narrower than this. */
export const MIN_COL_WIDTH = 48;

/** Breathing room added to measured content width on auto-fit (dblclick). */
export const AUTO_FIT_PADDING = 24;

/** Maximum base width auto-fit will produce — prevents unreasonably wide columns. */
export const AUTO_FIT_MAX = 400;

// ---------------------------------------------------------------------------
// Internal drag state
// ---------------------------------------------------------------------------

interface DragState {
	colKey: string;
	startX: number;
	startWidth: number;
	pointerId: number;
}

// ---------------------------------------------------------------------------
// SuperGridSizer class
// ---------------------------------------------------------------------------

/**
 * Manages column resize interaction for SuperGrid.
 *
 * Usage:
 *   const sizer = new SuperGridSizer(
 *     () => positionProvider.zoomLevel,
 *     widths => provider.setColWidths(Object.fromEntries(widths))
 *   );
 *   sizer.attach(gridEl);
 *   // After each _renderCells() call:
 *   sizer.setLeafColKeys(leafColKeys);
 *   // For each leaf column header element:
 *   sizer.addHandleToHeader(headerEl, colKey);
 *   // On destroy:
 *   sizer.detach();
 */
export class SuperGridSizer {
	// ---------------------------------------------------------------------------
	// Private state
	// ---------------------------------------------------------------------------

	/** Base px widths per colKey — stored before zoom multiplication. */
	private _colWidths: Map<string, number> = new Map();

	/** Current ordered leaf column keys — set by SuperGrid after each render. */
	private _leafColKeys: string[] = [];

	/** Grid element reference — set in attach(), nulled in detach(). */
	private _gridEl: HTMLElement | null = null;

	/** Callback to read current zoom from positionProvider. */
	private readonly _getZoomLevel: () => number;

	/** Callback fired on pointerup — triggers PAFVProvider persistence (Tier 2). */
	private readonly _onWidthsChange: ((widths: Map<string, number>) => void) | null;

	/** Active drag state — set in pointerdown, cleared in pointerup/pointercancel. */
	private _dragging: DragState | null = null;

	// ---------------------------------------------------------------------------
	// Constructor
	// ---------------------------------------------------------------------------

	constructor(getZoomLevel: () => number, onWidthsChange?: (widths: Map<string, number>) => void) {
		this._getZoomLevel = getZoomLevel;
		this._onWidthsChange = onWidthsChange ?? null;
	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	/** Store grid element reference for style updates. */
	attach(gridEl: HTMLElement): void {
		this._gridEl = gridEl;
	}

	/** Null grid element reference. Safe to call before attach or multiple times. */
	detach(): void {
		this._gridEl = null;
		this._dragging = null;
	}

	// ---------------------------------------------------------------------------
	// State accessors
	// ---------------------------------------------------------------------------

	/** Returns a defensive copy of the current colWidths map. */
	getColWidths(): Map<string, number> {
		return new Map(this._colWidths);
	}

	/** Stores a defensive copy of the provided map. */
	setColWidths(widths: Map<string, number>): void {
		this._colWidths = new Map(widths);
	}

	/** Clears all per-column widths. */
	resetColWidths(): void {
		this._colWidths = new Map();
	}

	/** Returns the current ordered leaf column keys. */
	getLeafColKeys(): string[] {
		return [...this._leafColKeys];
	}

	/** Sets the current leaf column keys (called by SuperGrid after each render). */
	setLeafColKeys(keys: string[]): void {
		this._leafColKeys = [...keys];
	}

	// ---------------------------------------------------------------------------
	// Handle creation and event wiring
	// ---------------------------------------------------------------------------

	/**
	 * Create an 8px resize handle on the right edge of headerEl and wire Pointer Events.
	 *
	 * Called by SuperGrid._renderCells() for each leaf-level column header element.
	 * The handle is positioned absolutely, so headerEl gets position:relative.
	 *
	 * Events wired:
	 *   pointerdown  → start drag, setPointerCapture, stopPropagation (no collapse)
	 *   pointermove  → update colWidth in real time (with Shift+drag normalize)
	 *   pointerup    → finalize and call onWidthsChange (persist)
	 *   pointercancel → revert to startWidth (no persist)
	 *   dblclick     → auto-fit to content width
	 */
	addHandleToHeader(headerEl: HTMLElement, colKey: string): void {
		// Ensure headerEl is positioned (sticky is already position, but just in case)
		if (!headerEl.style.position || headerEl.style.position === 'static') {
			headerEl.style.position = 'relative';
		}

		// Create the 8px drag handle
		const handle = document.createElement('div');
		handle.className = 'col-resize-handle';
		handle.style.position = 'absolute';
		handle.style.top = '0';
		handle.style.right = '0px';
		handle.style.width = '8px';
		handle.style.height = '100%';
		handle.style.cursor = 'col-resize';
		handle.style.zIndex = '4';
		handle.style.userSelect = 'none';
		handle.style.backgroundColor = 'transparent';

		// ---------------------------------------------------------------------------
		// pointerdown handler — starts drag
		// ---------------------------------------------------------------------------
		const onPointerDown = (e: PointerEvent): void => {
			if (e.button !== 0) return; // left click only

			e.preventDefault(); // prevent text selection
			e.stopPropagation(); // prevent header collapse click

			handle.setPointerCapture(e.pointerId);

			const startWidth = this._colWidths.get(colKey) ?? BASE_COL_WIDTH;
			this._dragging = {
				colKey,
				startX: e.clientX,
				startWidth,
				pointerId: e.pointerId,
			};
		};

		// ---------------------------------------------------------------------------
		// pointermove handler — updates width in real time
		// ---------------------------------------------------------------------------
		const onPointerMove = (e: PointerEvent): void => {
			if (!this._dragging || this._dragging.colKey !== colKey) return;

			const dx = e.clientX - this._dragging.startX;
			const zoomLevel = this._getZoomLevel();
			const newBase = Math.max(MIN_COL_WIDTH, this._dragging.startWidth + dx / zoomLevel);

			if (e.shiftKey) {
				// Normalize all leaf columns to the same base width
				for (const key of this._leafColKeys) {
					// Populate missing keys with BASE_COL_WIDTH before normalizing
					this._colWidths.set(key, newBase);
				}
			} else {
				// Update only the dragged column
				this._colWidths.set(colKey, newBase);
			}

			this._rebuildGridTemplate();
		};

		// ---------------------------------------------------------------------------
		// pointerup handler — finalizes drag and triggers persistence
		// ---------------------------------------------------------------------------
		const onPointerUp = (e: PointerEvent): void => {
			if (!this._dragging || this._dragging.colKey !== colKey) return;

			handle.releasePointerCapture(e.pointerId);
			this._dragging = null;

			// Remove move/up/cancel listeners
			handle.removeEventListener('pointermove', onPointerMove);
			handle.removeEventListener('pointerup', onPointerUp);
			handle.removeEventListener('pointercancel', onPointerCancel);

			// Persist via callback
			if (this._onWidthsChange) {
				this._onWidthsChange(new Map(this._colWidths));
			}
		};

		// ---------------------------------------------------------------------------
		// pointercancel handler — reverts to pre-drag width
		// ---------------------------------------------------------------------------
		const onPointerCancel = (_e: PointerEvent): void => {
			if (!this._dragging || this._dragging.colKey !== colKey) return;

			// Revert to startWidth — do NOT persist
			this._colWidths.set(colKey, this._dragging.startWidth);
			this._dragging = null;

			handle.removeEventListener('pointermove', onPointerMove);
			handle.removeEventListener('pointerup', onPointerUp);
			handle.removeEventListener('pointercancel', onPointerCancel);

			this._rebuildGridTemplate();
			// onWidthsChange intentionally NOT called
		};

		// ---------------------------------------------------------------------------
		// dblclick handler — auto-fit to content
		// ---------------------------------------------------------------------------
		const onDblClick = (e: MouseEvent): void => {
			e.stopPropagation(); // prevent collapse click

			// Measure header label width
			const labelEl = headerEl.querySelector('.col-header-label');
			const labelWidth = (labelEl as HTMLElement | null)?.scrollWidth ?? 0;

			// Measure all data cells for this column (max scrollWidth)
			let maxCellWidth = 0;
			if (this._gridEl) {
				// Use CSS.escape when available (browsers), fallback for jsdom/test environments
				const escapedKey =
					typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(colKey) : colKey.replace(/([^\w-])/g, '\\$1');
				const cells = this._gridEl.querySelectorAll<HTMLElement>(`.data-cell[data-col-key="${escapedKey}"]`);
				for (const cell of cells) {
					if (cell.scrollWidth > maxCellWidth) {
						maxCellWidth = cell.scrollWidth;
					}
				}
			}

			const maxContentWidth = Math.max(labelWidth, maxCellWidth);
			const zoomLevel = this._getZoomLevel();
			const fittedWidth = Math.min(AUTO_FIT_MAX, Math.max(MIN_COL_WIDTH, maxContentWidth + AUTO_FIT_PADDING));
			const baseWidth = fittedWidth / zoomLevel;

			this._colWidths.set(colKey, baseWidth);
			this._rebuildGridTemplate();

			if (this._onWidthsChange) {
				this._onWidthsChange(new Map(this._colWidths));
			}
		};

		// Wire all event listeners
		// pointermove/pointerup/pointercancel are wired directly (always listening,
		// but the handlers guard on _dragging state)
		handle.addEventListener('pointerdown', onPointerDown);
		handle.addEventListener('pointermove', onPointerMove);
		handle.addEventListener('pointerup', onPointerUp);
		handle.addEventListener('pointercancel', onPointerCancel);
		handle.addEventListener('dblclick', onDblClick);

		headerEl.appendChild(handle);
	}

	// ---------------------------------------------------------------------------
	// Width application
	// ---------------------------------------------------------------------------

	/**
	 * Rebuild grid-template-columns on gridEl using buildGridTemplateColumns.
	 * Called after each drag move, pointercancel, and dblclick.
	 *
	 * @param leafColKeys - Ordered leaf column keys (if not provided, uses internal _leafColKeys)
	 * @param zoomLevel - Current zoom level (if not provided, reads from _getZoomLevel())
	 * @param gridEl - Grid element to update (if not provided, uses internal _gridEl)
	 * @param rowHeaderDepth - Row header depth (number of 80px header columns, default: 1)
	 */
	applyWidths(leafColKeys: string[], zoomLevel: number, gridEl: HTMLElement, rowHeaderDepth?: number): void {
		gridEl.style.gridTemplateColumns = buildGridTemplateColumns(
			leafColKeys,
			this._colWidths,
			zoomLevel,
			rowHeaderDepth,
		);
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/**
	 * Rebuild grid-template-columns using internal state.
	 * Called during drag (live resize) and on pointercancel (revert).
	 */
	private _rebuildGridTemplate(): void {
		if (!this._gridEl) return;
		this._gridEl.style.gridTemplateColumns = buildGridTemplateColumns(
			this._leafColKeys,
			this._colWidths,
			this._getZoomLevel(),
		);
	}
}
