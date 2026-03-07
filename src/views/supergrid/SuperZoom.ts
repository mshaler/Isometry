// Isometry v5 — SuperZoom
// WheelEvent zoom handler with CSS Custom Property updates for SuperGrid.
//
// Design:
//   - normalizeWheelDelta: normalizes DOM WheelEvent deltaY by deltaMode, caps at +-24
//   - wheelDeltaToScaleFactor: asymmetric scale formula for smooth, natural zoom feel
//   - SuperZoom class: attach/detach/applyZoom/resetZoom lifecycle
//   - Wheel listener: { passive: false } — must intercept ctrlKey pinch gesture
//   - Zoom via CSS Custom Properties only: --sg-col-width, --sg-row-height, --sg-zoom
//   - NOT d3.zoom, NOT CSS transform:scale (overflow:auto conflict is architectural)
//   - Clamped to [ZOOM_MIN, ZOOM_MAX] via SuperPositionProvider.zoomLevel setter
//   - Cmd+0 (metaKey + key='0') resets zoom to 1.0
//
// Requirements: ZOOM-01, ZOOM-03

import { type SuperPositionProvider, ZOOM_DEFAULT } from '../../providers/SuperPositionProvider';

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

/** Base column width in pixels at 1x zoom */
export const BASE_COL_WIDTH = 120;

/** Base row height in pixels at 1x zoom */
export const BASE_ROW_HEIGHT = 40;

/** Multiplier for wheel delta in the scale factor formula — controls zoom speed */
const WHEEL_SCALE_SPEEDUP = 2.0;

// ---------------------------------------------------------------------------
// Exported pure functions (testable without DOM)
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
// SuperZoom class
// ---------------------------------------------------------------------------

/**
 * Manages zoom interaction for SuperGrid via WheelEvent interception and
 * CSS Custom Property updates on the grid element.
 *
 * Usage:
 *   const zoom = new SuperZoom(positionProvider, onZoomChange);
 *   zoom.attach(rootEl, gridEl);   // wire events
 *   zoom.applyZoom();              // apply initial zoom state
 *   // ... user interaction ...
 *   zoom.detach();                 // cleanup on destroy
 */
export class SuperZoom {
	private _rootEl: HTMLElement | null = null;
	private _gridEl: HTMLElement | null = null;
	private readonly _positionProvider: SuperPositionProvider;
	private readonly _onZoomChange: ((zoomLevel: number) => void) | null;
	private _wheelHandler: ((e: WheelEvent) => void) | null = null;
	private _keyHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(positionProvider: SuperPositionProvider, onZoomChange?: (zoomLevel: number) => void) {
		this._positionProvider = positionProvider;
		this._onZoomChange = onZoomChange ?? null;
	}

	/**
	 * Wire event listeners to rootEl and gridEl.
	 *
	 * - Non-passive wheel listener on rootEl (must be non-passive to call preventDefault)
	 * - Keydown listener on document for Cmd+0 reset
	 */
	attach(rootEl: HTMLElement, gridEl: HTMLElement): void {
		this._rootEl = rootEl;
		this._gridEl = gridEl;

		// Wheel handler: intercept ctrlKey (pinch gesture), pass through regular scroll
		this._wheelHandler = (e: WheelEvent) => {
			if (!e.ctrlKey) return; // let regular scroll pass through

			e.preventDefault();

			const normalizedDelta = normalizeWheelDelta(e);
			const scaleFactor = wheelDeltaToScaleFactor(normalizedDelta);
			const currentZoom = this._positionProvider.zoomLevel;
			this._positionProvider.zoomLevel = currentZoom * scaleFactor;

			this.applyZoom();

			if (this._onZoomChange) {
				this._onZoomChange(this._positionProvider.zoomLevel);
			}
		};

		// Keydown handler: Cmd+0 resets zoom to 1.0
		this._keyHandler = (e: KeyboardEvent) => {
			if (e.metaKey && e.key === '0') {
				this.resetZoom();
			}
		};

		rootEl.addEventListener('wheel', this._wheelHandler, { passive: false });
		document.addEventListener('keydown', this._keyHandler);
	}

	/**
	 * Remove event listeners and null element refs.
	 * Safe to call multiple times.
	 */
	detach(): void {
		if (this._rootEl && this._wheelHandler) {
			this._rootEl.removeEventListener('wheel', this._wheelHandler);
		}
		if (this._keyHandler) {
			document.removeEventListener('keydown', this._keyHandler);
		}
		this._rootEl = null;
		this._gridEl = null;
		this._wheelHandler = null;
		this._keyHandler = null;
	}

	/**
	 * Apply current zoom level to the grid element as CSS Custom Properties.
	 *
	 * Sets:
	 *   --sg-col-width:  ${Math.round(BASE_COL_WIDTH * zoomLevel)}px
	 *   --sg-row-height: ${Math.round(BASE_ROW_HEIGHT * zoomLevel)}px
	 *   --sg-zoom:       ${zoomLevel}
	 *
	 * CSS consumers derive font-size, padding, etc. via calc():
	 *   font-size: calc(12px * var(--sg-zoom))
	 *   padding:   calc(4px * var(--sg-zoom))
	 */
	applyZoom(): void {
		if (!this._gridEl) return;

		const zoomLevel = this._positionProvider.zoomLevel;
		const colWidth = Math.round(BASE_COL_WIDTH * zoomLevel);
		const rowHeight = Math.round(BASE_ROW_HEIGHT * zoomLevel);

		this._gridEl.style.setProperty('--sg-col-width', `${colWidth}px`);
		this._gridEl.style.setProperty('--sg-row-height', `${rowHeight}px`);
		this._gridEl.style.setProperty('--sg-zoom', `${zoomLevel}`);
	}

	/**
	 * Reset zoom to 1.0 and apply to CSS Custom Properties.
	 * Called by Cmd+0 keyboard shortcut and by Plan 02 onZoomChange handler.
	 */
	resetZoom(): void {
		this._positionProvider.zoomLevel = ZOOM_DEFAULT;
		this.applyZoom();
	}
}
