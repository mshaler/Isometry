// Isometry v5 — Phase 100 Plan 01 SuperZoomWheel Plugin
// Wheel zoom plugin for the pivot grid.
//
// Design:
//   - Pure functions ported verbatim from src/views/supergrid/SuperZoom.ts
//   - Ctrl+wheel intercepts and applies zoom to shared zoomState
//   - Cmd+0 resets zoom to ZOOM_DEFAULT
//   - Shared zoomState object enables sync with SuperZoomSlider
//   - Non-passive wheel listener to allow preventDefault()
//   - transformLayout sets layout.zoom and scales cellWidth/cellHeight
//
// Requirements: ZOOM-01, ZOOM-02

import type { GridLayout, PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

/** Minimum zoom multiplier. */
export const ZOOM_MIN = 0.5;

/** Maximum zoom multiplier. */
export const ZOOM_MAX = 3.0;

/** Default zoom level (1x). */
export const ZOOM_DEFAULT = 1.0;

/** Multiplier for wheel delta in the scale factor formula — controls zoom speed. */
const WHEEL_SCALE_SPEEDUP = 2.0;

// ---------------------------------------------------------------------------
// Zoom state type
// ---------------------------------------------------------------------------

export interface ZoomState {
	zoom: number;
	listeners: Set<(zoom: number) => void>;
}

// ---------------------------------------------------------------------------
// Exported pure functions (ported verbatim from SuperZoom.ts)
// ---------------------------------------------------------------------------

/**
 * Normalize a WheelEvent deltaY value by its deltaMode.
 *
 * DOM_DELTA_PIXEL (0): 1:1 passthrough
 * DOM_DELTA_LINE  (1): multiply by 8 (approximate line height)
 * DOM_DELTA_PAGE  (2): multiply by 24 (approximate page scroll)
 *
 * Result is capped at +-24 to prevent excessive zoom jumps.
 */
export function normalizeWheelDelta(e: WheelEvent): number {
	let delta = e.deltaY;

	switch (e.deltaMode) {
		case 1: // DOM_DELTA_LINE
			delta *= 8;
			break;
		case 2: // DOM_DELTA_PAGE
			delta *= 24;
			break;
		// case 0 (DOM_DELTA_PIXEL): no change
	}

	// Cap at +-24 to prevent single-event zoom jumps
	return Math.max(-24, Math.min(24, delta));
}

/**
 * Convert a normalized wheel delta to a zoom scale factor.
 *
 * Uses an asymmetric formula so zoom-in and zoom-out feel balanced:
 *   dy <= 0 (zoom in):  factor = 1 - (WHEEL_SCALE_SPEEDUP * dy) / 100
 *   dy >  0 (zoom out): factor = 1 / (1 + (WHEEL_SCALE_SPEEDUP * dy) / 100)
 *
 * This ensures that zooming in then out the same distance returns to ~1.0.
 * Returns exactly 1.0 for dy=0.
 */
export function wheelDeltaToScaleFactor(dy: number): number {
	if (dy === 0) return 1.0;
	if (dy <= 0) {
		return 1 - (WHEEL_SCALE_SPEEDUP * dy) / 100;
	} else {
		return 1 / (1 + (WHEEL_SCALE_SPEEDUP * dy) / 100);
	}
}

// ---------------------------------------------------------------------------
// Zoom state factory
// ---------------------------------------------------------------------------

/**
 * Create a shared zoom state object for use by both wheel and slider plugins.
 * Both plugins receive the same reference to stay in sync.
 */
export function createZoomState(): ZoomState {
	return { zoom: 1.0, listeners: new Set() };
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Factory for the superzoom.wheel plugin.
 *
 * @param zoomState - Shared zoom state. Create with createZoomState() and pass
 *   the same object to createSuperZoomSliderPlugin() for in-sync zoom display.
 *
 * Returns a PluginHook whose:
 *   - afterRender: attaches non-passive wheel listener and Cmd+0 keydown handler
 *   - transformLayout: sets layout.zoom to zoomState.zoom, scales cellWidth/cellHeight
 *   - destroy: removes event listeners
 */
export function createSuperZoomWheelPlugin(zoomState: ZoomState): PluginHook {
	let _wheelHandler: ((e: WheelEvent) => void) | null = null;
	let _keyHandler: ((e: KeyboardEvent) => void) | null = null;
	let _scrollEl: Element | HTMLElement | null = null;

	return {
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			// Remove existing listeners before re-attaching (afterRender called on each render)
			if (_scrollEl && _wheelHandler) {
				_scrollEl.removeEventListener('wheel', _wheelHandler as EventListener);
			}
			if (_keyHandler) {
				document.removeEventListener('keydown', _keyHandler);
			}

			// Attach wheel listener to scroll container or parent
			_scrollEl = root.closest('.pv-scroll-container') ?? root.parentElement ?? root;

			_wheelHandler = (e: WheelEvent) => {
				if (!e.ctrlKey) return;
				e.preventDefault();

				const normalizedDelta = normalizeWheelDelta(e);
				const scaleFactor = wheelDeltaToScaleFactor(normalizedDelta);
				const newZoom = zoomState.zoom * scaleFactor;
				zoomState.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));

				// Notify listeners (e.g., slider plugin)
				for (const listener of zoomState.listeners) {
					listener(zoomState.zoom);
				}
			};

			// Cmd+0 reset
			_keyHandler = (e: KeyboardEvent) => {
				if (e.metaKey && e.key === '0') {
					zoomState.zoom = ZOOM_DEFAULT;
					for (const listener of zoomState.listeners) {
						listener(zoomState.zoom);
					}
				}
			};

			_scrollEl.addEventListener('wheel', _wheelHandler as EventListener, { passive: false });
			document.addEventListener('keydown', _keyHandler);
		},

		transformLayout(layout: GridLayout, _ctx: RenderContext): GridLayout {
			layout.zoom = zoomState.zoom;
			layout.cellWidth *= zoomState.zoom;
			layout.cellHeight *= zoomState.zoom;
			return layout;
		},

		destroy(): void {
			if (_scrollEl && _wheelHandler) {
				_scrollEl.removeEventListener('wheel', _wheelHandler as EventListener);
			}
			if (_keyHandler) {
				document.removeEventListener('keydown', _keyHandler);
			}
			_wheelHandler = null;
			_keyHandler = null;
			_scrollEl = null;
		},
	};
}
