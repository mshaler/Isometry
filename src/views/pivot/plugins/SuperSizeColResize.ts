// Isometry v5 — Phase 100 Plan 01 SuperSizeColResize Plugin
// Column resize plugin for the pivot grid overlay.
//
// Design:
//   - Drag right edge of column header to resize a single column
//   - Shift+drag normalizes all visible columns to same width
//   - Double-click resize handle to auto-fit content width
//   - Uses pointer capture for robust drag tracking across mouse movements
//   - Internal colWidths Map persists across renders
//   - transformLayout merges internal colWidths into GridLayout.colWidths
//   - afterRender injects resize handles into column header cells
//
// Requirements: SIZE-01, SIZE-02, SIZE-03

import type { GridLayout, PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

/** Minimum column width in pixels — columns cannot be dragged narrower. */
export const MIN_COL_WIDTH = 48;

/** Breathing room added to measured content width on auto-fit (dblclick). */
export const AUTO_FIT_PADDING = 24;

/** Maximum width auto-fit will produce — prevents unreasonably wide columns. */
export const AUTO_FIT_MAX = 400;

// ---------------------------------------------------------------------------
// Exported pure functions (testable without DOM)
// ---------------------------------------------------------------------------

/**
 * Normalize a column width value by clamping it to the minimum.
 * Values below MIN_COL_WIDTH are clamped up; values at or above pass through.
 */
export function normalizeWidth(width: number): number {
	return Math.max(MIN_COL_WIDTH, width);
}

/**
 * Calculate auto-fit width given a measured content width.
 * Returns min(measured + AUTO_FIT_PADDING, AUTO_FIT_MAX).
 */
export function autoFitWidth(measuredWidth: number): number {
	return Math.min(measuredWidth + AUTO_FIT_PADDING, AUTO_FIT_MAX);
}

// ---------------------------------------------------------------------------
// Internal drag state
// ---------------------------------------------------------------------------

interface DragState {
	colIdx: number;
	startX: number;
	startWidth: number;
	pointerId: number;
}

// ---------------------------------------------------------------------------
// Plugin instance type (extended for test helpers)
// ---------------------------------------------------------------------------

interface SuperSizeColResizeInstance extends PluginHook {
	/** @internal test helper: directly set a column width */
	_colWidths: Map<number, number>;
}

// ---------------------------------------------------------------------------
// Test helper functions (exported for test access)
// ---------------------------------------------------------------------------

/**
 * Test helper: set a column width directly on a plugin instance.
 * Only available in test environments.
 */
export function _setColWidthForTest(plugin: PluginHook, colIdx: number, width: number): void {
	(plugin as SuperSizeColResizeInstance)._colWidths.set(colIdx, width);
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Factory for the supersize.col-resize plugin.
 *
 * Returns a PluginHook whose:
 *   - onPointerEvent: handles drag on .pv-resize-handle--width elements
 *   - transformLayout: merges _colWidths into layout.colWidths
 *   - afterRender: injects resize handles into leaf column headers
 *   - destroy: clears internal state
 */
export function createSuperSizeColResizePlugin(): PluginHook {
	const _colWidths = new Map<number, number>();
	let _dragging: DragState | null = null;
	// Track column keys for shift+drag normalization
	let _colIdxs: number[] = [];

	const plugin: SuperSizeColResizeInstance = {
		_colWidths,

		onPointerEvent(type: string, e: PointerEvent, _ctx: RenderContext): boolean {
			const target = e.target as HTMLElement | null;
			if (!target) return false;

			if (type === 'pointerdown') {
				if (!target.classList.contains('pv-resize-handle--width')) return false;
				const colIdxAttr = target.getAttribute('data-col-idx');
				if (colIdxAttr === null) return false;
				const colIdx = Number(colIdxAttr);

				const startWidth = _colWidths.get(colIdx) ?? 120;
				_dragging = { colIdx, startX: e.clientX, startWidth, pointerId: e.pointerId };
				document.body.style.cursor = 'col-resize';
				try {
					target.setPointerCapture(e.pointerId);
				} catch {
					// jsdom may not support setPointerCapture
				}
				return true;
			}

			if (type === 'pointermove') {
				if (!_dragging) return false;
				const newWidth = Math.max(MIN_COL_WIDTH, _dragging.startWidth + (e.clientX - _dragging.startX));

				if (e.shiftKey) {
					// Normalize all columns to same width
					for (const idx of _colIdxs) {
						_colWidths.set(idx, newWidth);
					}
				} else {
					_colWidths.set(_dragging.colIdx, newWidth);
				}
				return true;
			}

			if (type === 'pointerup') {
				if (!_dragging) return false;
				_dragging = null;
				document.body.style.cursor = '';
				return true;
			}

			if (type === 'dblclick') {
				if (!target.classList.contains('pv-resize-handle--width')) return false;
				const colIdxAttr = target.getAttribute('data-col-idx');
				if (colIdxAttr === null) return false;
				const colIdx = Number(colIdxAttr);

				// Measure max content width of column cells
				const root = (target.closest('[data-pv-overlay]') as HTMLElement | null) ?? target.ownerDocument.body;
				const cells = root.querySelectorAll<HTMLElement>(`[data-col="${colIdx}"]`);
				let maxWidth = 0;
				for (const cell of cells) {
					if (cell.scrollWidth > maxWidth) maxWidth = cell.scrollWidth;
				}
				_colWidths.set(colIdx, autoFitWidth(maxWidth));
				return true;
			}

			return false;
		},

		transformLayout(layout: GridLayout, _ctx: RenderContext): GridLayout {
			for (const [colIdx, width] of _colWidths) {
				layout.colWidths.set(colIdx, width);
			}
			return layout;
		},

		afterRender(root: HTMLElement, ctx: RenderContext): void {
			// Collect visible column count from ctx
			_colIdxs = ctx.visibleCols.map((_, i) => i);

			// Remove existing resize handles first (avoid duplicates on re-render)
			root.querySelectorAll('.pv-resize-handle--width').forEach((el) => el.remove());

			// Inject resize handles into leaf column header cells
			const leafHeaders = root.querySelectorAll<HTMLElement>('.pv-col-span--leaf');
			for (const header of leafHeaders) {
				const colStartAttr = header.getAttribute('data-col-start');
				if (colStartAttr === null) continue;
				const colIdx = Number(colStartAttr) - 1; // Convert to 0-based

				const handle = document.createElement('div');
				handle.className = 'pv-resize-handle pv-resize-handle--width';
				handle.setAttribute('data-col-idx', String(colIdx));
				handle.style.position = 'absolute';

				// Ensure header is positioned
				if (!header.style.position || header.style.position === 'static') {
					header.style.position = 'relative';
				}

				header.appendChild(handle);
			}
		},

		destroy(): void {
			_colWidths.clear();
			_dragging = null;
			_colIdxs = [];
			document.body.style.cursor = '';
		},
	};

	return plugin;
}
