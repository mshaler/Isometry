// Isometry v5 — Phase 143 Plan 02 SuperSizeRowHeaderResize Plugin
// Row header per-level width resize plugin for the pivot grid overlay.
//
// Design:
//   - Drag right edge of each row header column to resize it independently
//   - Each row dimension level gets its own handle, enabling per-level widths
//   - Clamped to [MIN_ROW_HEADER_WIDTH, MAX_ROW_HEADER_WIDTH] pixel range
//   - Uses pointer capture for robust drag tracking
//   - Internal _widths Map (level → width) persists across renders
//   - transformLayout merges _widths into layout.rowHeaderWidths
//   - afterRender injects resize handles on .pv-row-span elements per unique level
//
// Requirements: VPOL-03

import type { GridLayout, PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

/** Minimum row header width in pixels — cannot be dragged narrower. */
export const MIN_ROW_HEADER_WIDTH = 60;

/** Maximum row header width in pixels — cannot be dragged wider. */
export const MAX_ROW_HEADER_WIDTH = 400;

// ---------------------------------------------------------------------------
// Exported pure functions (testable without DOM)
// ---------------------------------------------------------------------------

/**
 * Clamp a row header width value to [MIN_ROW_HEADER_WIDTH, MAX_ROW_HEADER_WIDTH].
 */
export function clampRowHeaderWidth(width: number): number {
	return Math.max(MIN_ROW_HEADER_WIDTH, Math.min(MAX_ROW_HEADER_WIDTH, width));
}

// ---------------------------------------------------------------------------
// Internal drag state
// ---------------------------------------------------------------------------

interface DragState {
	level: number;
	startX: number;
	startWidth: number;
	pointerId: number;
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Factory for the supersize.row-header-resize plugin.
 *
 * Returns a PluginHook whose:
 *   - onPointerEvent: handles drag on .pv-resize-handle--row-header-width elements
 *   - transformLayout: merges _widths into layout.rowHeaderWidths
 *   - afterRender: injects resize handles on the last .pv-row-span at each unique level
 *   - destroy: clears internal state
 */
export function createSuperSizeRowHeaderResizePlugin(): PluginHook {
	const _widths = new Map<number, number>();
	let _dragging: DragState | null = null;

	return {
		onPointerEvent(type: string, e: PointerEvent, ctx: RenderContext): boolean {
			const target = e.target as HTMLElement | null;
			if (!target) return false;

			if (type === 'pointerdown') {
				if (!target.classList.contains('pv-resize-handle--row-header-width')) return false;
				const levelAttr = target.getAttribute('data-level');
				if (levelAttr === null) return false;
				const level = Number(levelAttr);

				// Start width: use current _widths value or layout headerWidth default
				const startWidth = _widths.get(level) ?? ctx.rootEl.closest('[data-header-width]')
					? Number(ctx.rootEl.closest('[data-header-width]')?.getAttribute('data-header-width')) || 120
					: 120;

				_dragging = { level, startX: e.clientX, startWidth, pointerId: e.pointerId };
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
				const newWidth = clampRowHeaderWidth(_dragging.startWidth + (e.clientX - _dragging.startX));
				_widths.set(_dragging.level, newWidth);
				return true;
			}

			if (type === 'pointerup') {
				if (!_dragging) return false;
				_dragging = null;
				document.body.style.cursor = '';
				return true;
			}

			return false;
		},

		transformLayout(layout: GridLayout, _ctx: RenderContext): GridLayout {
			for (const [level, width] of _widths) {
				layout.rowHeaderWidths.set(level, width);
			}
			return layout;
		},

		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			// Remove existing handles to avoid duplicates on re-render
			root.querySelectorAll('.pv-resize-handle--row-header-width').forEach((el) => el.remove());

			// Find all .pv-row-span elements grouped by level
			// Inject a handle into the last span at each unique level
			const spansByLevel = new Map<number, HTMLElement[]>();
			root.querySelectorAll<HTMLElement>('.pv-row-span').forEach((span) => {
				const levelAttr = span.getAttribute('data-level');
				if (levelAttr === null) return;
				const level = Number(levelAttr);
				let group = spansByLevel.get(level);
				if (!group) {
					group = [];
					spansByLevel.set(level, group);
				}
				group.push(span);
			});

			// Inject one handle per level, appended to the last span at that level
			for (const [level, spans] of spansByLevel) {
				// Pick the last span in document order to append the handle
				const targetSpan = spans[spans.length - 1]!;

				const handle = document.createElement('div');
				handle.className = 'pv-resize-handle pv-resize-handle--row-header-width';
				handle.setAttribute('data-level', String(level));
				handle.style.position = 'absolute';

				if (!targetSpan.style.position || targetSpan.style.position === 'static') {
					targetSpan.style.position = 'relative';
				}

				targetSpan.appendChild(handle);
			}
		},

		destroy(): void {
			_widths.clear();
			_dragging = null;
			document.body.style.cursor = '';
		},
	};
}
