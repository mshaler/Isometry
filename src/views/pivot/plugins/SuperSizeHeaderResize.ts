// Isometry v5 — Phase 100 Plan 01 SuperSizeHeaderResize Plugin
// Row header height resize plugin for the pivot grid overlay.
//
// Design:
//   - Drag bottom edge of row header area to resize header height
//   - Clamped to [24, 120] pixel range
//   - Uses pointer capture for robust drag tracking
//   - transformLayout applies _headerHeight override to layout.headerHeight
//   - afterRender injects a resize handle at bottom of header area
//
// Requirements: SIZE-01

import type { GridLayout, PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Exported pure functions (testable without DOM)
// ---------------------------------------------------------------------------

/**
 * Clamp a header height value to the valid range [24, 120].
 */
export function clampHeaderHeight(height: number): number {
	return Math.max(24, Math.min(120, height));
}

// ---------------------------------------------------------------------------
// Internal drag state
// ---------------------------------------------------------------------------

interface DragState {
	startY: number;
	startHeight: number;
	pointerId: number;
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Factory for the supersize.header-resize plugin.
 *
 * Returns a PluginHook whose:
 *   - onPointerEvent: handles drag on .pv-resize-handle--height elements
 *   - transformLayout: applies _headerHeight override to layout.headerHeight
 *   - afterRender: injects resize handle at bottom of header area
 *   - destroy: resets internal state
 */
export function createSuperSizeHeaderResizePlugin(): PluginHook {
	let _headerHeight: number | null = null;
	let _dragging: DragState | null = null;

	return {
		onPointerEvent(type: string, e: PointerEvent, _ctx: RenderContext): boolean {
			const target = e.target as HTMLElement | null;
			if (!target) return false;

			if (type === 'pointerdown') {
				if (!target.classList.contains('pv-resize-handle--height')) return false;

				// Read current header height from layout or use default
				const currentHeight = _headerHeight ?? 40;
				_dragging = {
					startY: e.clientY,
					startHeight: currentHeight,
					pointerId: e.pointerId,
				};
				document.body.style.cursor = 'row-resize';
				try {
					target.setPointerCapture(e.pointerId);
				} catch {
					// jsdom may not support setPointerCapture
				}
				return true;
			}

			if (type === 'pointermove') {
				if (!_dragging) return false;
				const newHeight = clampHeaderHeight(_dragging.startHeight + (e.clientY - _dragging.startY));
				_headerHeight = newHeight;
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
			if (_headerHeight !== null) {
				layout.headerHeight = _headerHeight;
			}
			return layout;
		},

		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			// Remove existing height handle to avoid duplicates
			root.querySelectorAll('.pv-resize-handle--height').forEach((el) => el.remove());

			// Create resize handle at bottom of header area
			const handle = document.createElement('div');
			handle.className = 'pv-resize-handle pv-resize-handle--height';
			handle.style.position = 'absolute';
			root.appendChild(handle);
		},

		destroy(): void {
			_headerHeight = null;
			_dragging = null;
			document.body.style.cursor = '';
		},
	};
}
