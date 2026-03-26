// Isometry v5 — Phase 100 Plan 01 SuperSizeUniformResize Plugin
// Uniform cell resize plugin for the pivot grid overlay.
//
// Design:
//   - Drag corner handle to uniformly resize all cells
//   - Scale factor applies to both cellWidth and cellHeight
//   - Clamped to [0.5, 3.0] multiplier range
//   - Uses average of dx and dy for diagonal drag feel
//   - transformLayout applies _scale multiplier to layout.cellWidth and cellHeight
//
// Requirements: SIZE-01

import type { GridLayout, PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCALE_MIN = 0.5;
const SCALE_MAX = 3.0;

// ---------------------------------------------------------------------------
// Internal drag state
// ---------------------------------------------------------------------------

interface DragState {
	startX: number;
	startY: number;
	startScale: number;
	pointerId: number;
}

// ---------------------------------------------------------------------------
// Plugin instance type (extended for test helpers)
// ---------------------------------------------------------------------------

interface SuperSizeUniformResizeInstance extends PluginHook {
	/** @internal test helper: directly set scale */
	_scale: number;
}

// ---------------------------------------------------------------------------
// Test helper functions (exported for test access)
// ---------------------------------------------------------------------------

/**
 * Test helper: set the scale directly on a plugin instance.
 * Only available in test environments.
 */
export function _setScaleForTest(plugin: PluginHook, scale: number): void {
	(plugin as SuperSizeUniformResizeInstance)._scale = scale;
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Factory for the supersize.uniform-resize plugin.
 *
 * Returns a PluginHook whose:
 *   - onPointerEvent: handles drag on .pv-resize-handle--cell corner handle
 *   - transformLayout: applies _scale to layout.cellWidth and cellHeight
 *   - afterRender: injects corner resize handle
 *   - destroy: resets scale to 1.0
 */
export function createSuperSizeUniformResizePlugin(): PluginHook {
	let _scale = 1.0;
	let _dragging: DragState | null = null;

	const plugin: SuperSizeUniformResizeInstance = {
		get _scale() {
			return _scale;
		},
		set _scale(v: number) {
			_scale = v;
		},

		onPointerEvent(type: string, e: PointerEvent, _ctx: RenderContext): boolean {
			const target = e.target as HTMLElement | null;
			if (!target) return false;

			if (type === 'pointerdown') {
				if (!target.classList.contains('pv-resize-handle--cell')) return false;

				_dragging = {
					startX: e.clientX,
					startY: e.clientY,
					startScale: _scale,
					pointerId: e.pointerId,
				};
				document.body.style.cursor = 'nwse-resize';
				try {
					target.setPointerCapture(e.pointerId);
				} catch {
					// jsdom may not support setPointerCapture
				}
				return true;
			}

			if (type === 'pointermove') {
				if (!_dragging) return false;
				const dx = e.clientX - _dragging.startX;
				const dy = e.clientY - _dragging.startY;
				const avgDelta = (dx + dy) / 2;
				const newScale = _dragging.startScale * (1 + avgDelta / 100);
				_scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, newScale));
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
			layout.cellWidth *= _scale;
			layout.cellHeight *= _scale;
			return layout;
		},

		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			// Remove existing cell handle to avoid duplicates
			root.querySelectorAll('.pv-resize-handle--cell').forEach((el) => el.remove());

			// Create corner resize handle at bottom-right of overlay
			const handle = document.createElement('div');
			handle.className = 'pv-resize-handle pv-resize-handle--cell';
			handle.style.position = 'absolute';
			handle.style.right = '0';
			handle.style.bottom = '0';
			root.appendChild(handle);
		},

		destroy(): void {
			_scale = 1.0;
			_dragging = null;
			document.body.style.cursor = '';
		},
	};

	return plugin;
}
