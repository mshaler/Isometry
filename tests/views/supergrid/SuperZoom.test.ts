// @vitest-environment jsdom
// Isometry v5 — SuperZoom Tests
// Unit tests for wheel/pinch zoom handler with CSS Custom Property updates.
//
// Design:
//   - normalizeWheelDelta: normalizes DOM WheelEvent deltaY by deltaMode
//   - wheelDeltaToScaleFactor: asymmetric scale formula for smooth zoom
//   - SuperZoom class: attach/detach/applyZoom/resetZoom lifecycle
//   - Wheel listener: ctrlKey=true intercepted, ctrlKey=false passes through
//   - CSS Custom Properties: --sg-col-width, --sg-row-height, --sg-zoom on gridEl
//   - Clamped to [ZOOM_MIN=0.5, ZOOM_MAX=3.0] via SuperPositionProvider
//   - Cmd+0 (metaKey + key='0') resets zoom to 1.0
//
// Requirements: ZOOM-01, ZOOM-03

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuperPositionProvider, ZOOM_MAX, ZOOM_MIN } from '../../../src/providers/SuperPositionProvider';
import {
	BASE_COL_WIDTH,
	BASE_ROW_HEIGHT,
	normalizeWheelDelta,
	SuperZoom,
	wheelDeltaToScaleFactor,
} from '../../../src/views/supergrid/SuperZoom';

// ---------------------------------------------------------------------------
// Mock WheelEvent (jsdom may lack it or have incomplete implementation)
// ---------------------------------------------------------------------------

class MockWheelEvent extends Event {
	deltaY: number;
	deltaMode: number;
	ctrlKey: boolean;

	constructor(
		type: string,
		init: {
			deltaY: number;
			deltaMode?: number;
			ctrlKey?: boolean;
			cancelable?: boolean;
		},
	) {
		super(type, { cancelable: init.cancelable ?? true, bubbles: true });
		this.deltaY = init.deltaY;
		this.deltaMode = init.deltaMode ?? 0; // DOM_DELTA_PIXEL
		this.ctrlKey = init.ctrlKey ?? false;
	}
}

// DOM_DELTA constants per WheelEvent spec
const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

// ---------------------------------------------------------------------------
// Tests: normalizeWheelDelta
// ---------------------------------------------------------------------------

describe('normalizeWheelDelta', () => {
	it('handles DOM_DELTA_PIXEL (1:1 passthrough)', () => {
		const event = new MockWheelEvent('wheel', { deltaY: 10, deltaMode: DOM_DELTA_PIXEL });
		expect(normalizeWheelDelta(event as unknown as WheelEvent)).toBe(10);
	});

	it('handles DOM_DELTA_LINE (multiply by 8)', () => {
		const event = new MockWheelEvent('wheel', { deltaY: 3, deltaMode: DOM_DELTA_LINE });
		expect(normalizeWheelDelta(event as unknown as WheelEvent)).toBe(24);
	});

	it('handles DOM_DELTA_PAGE (multiply by 24)', () => {
		const event = new MockWheelEvent('wheel', { deltaY: 1, deltaMode: DOM_DELTA_PAGE });
		expect(normalizeWheelDelta(event as unknown as WheelEvent)).toBe(24);
	});

	it('caps absolute value at 24 for large pixel values', () => {
		const event = new MockWheelEvent('wheel', { deltaY: 500, deltaMode: DOM_DELTA_PIXEL });
		expect(normalizeWheelDelta(event as unknown as WheelEvent)).toBe(24);
	});

	it('caps negative values at -24', () => {
		const event = new MockWheelEvent('wheel', { deltaY: -500, deltaMode: DOM_DELTA_PIXEL });
		expect(normalizeWheelDelta(event as unknown as WheelEvent)).toBe(-24);
	});

	it('preserves sign: negative deltaY (zoom in) returns negative', () => {
		const event = new MockWheelEvent('wheel', { deltaY: -10, deltaMode: DOM_DELTA_PIXEL });
		expect(normalizeWheelDelta(event as unknown as WheelEvent)).toBe(-10);
	});

	it('handles zero deltaY', () => {
		const event = new MockWheelEvent('wheel', { deltaY: 0, deltaMode: DOM_DELTA_PIXEL });
		expect(normalizeWheelDelta(event as unknown as WheelEvent)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Tests: wheelDeltaToScaleFactor
// ---------------------------------------------------------------------------

describe('wheelDeltaToScaleFactor', () => {
	it('returns > 1 for negative deltaY (zoom in)', () => {
		const scale = wheelDeltaToScaleFactor(-10);
		expect(scale).toBeGreaterThan(1);
	});

	it('returns < 1 for positive deltaY (zoom out)', () => {
		const scale = wheelDeltaToScaleFactor(10);
		expect(scale).toBeLessThan(1);
	});

	it('returns exactly 1.0 for zero deltaY', () => {
		const scale = wheelDeltaToScaleFactor(0);
		expect(scale).toBe(1.0);
	});

	it('scale factor is asymmetric: zoom-in and zoom-out are inverses (approx)', () => {
		const scaleIn = wheelDeltaToScaleFactor(-10);
		const scaleOut = wheelDeltaToScaleFactor(10);
		// scaleIn * scaleOut should be approximately 1 (asymmetric formula keeps them close)
		expect(scaleIn * scaleOut).toBeCloseTo(1, 1);
	});

	it('larger magnitude gives larger scale change', () => {
		const scaleSmall = wheelDeltaToScaleFactor(-5);
		const scaleLarge = wheelDeltaToScaleFactor(-20);
		expect(scaleLarge).toBeGreaterThan(scaleSmall);
	});
});

// ---------------------------------------------------------------------------
// Tests: SuperZoom — attach / wheel events
// ---------------------------------------------------------------------------

describe('SuperZoom — attach and wheel events', () => {
	let positionProvider: SuperPositionProvider;
	let superZoom: SuperZoom;
	let rootEl: HTMLElement;
	let gridEl: HTMLElement;

	beforeEach(() => {
		positionProvider = new SuperPositionProvider();
		superZoom = new SuperZoom(positionProvider);
		rootEl = document.createElement('div');
		gridEl = document.createElement('div');
		document.body.appendChild(rootEl);
		document.body.appendChild(gridEl);
		superZoom.attach(rootEl, gridEl);
	});

	afterEach(() => {
		superZoom.detach();
		rootEl.remove();
		gridEl.remove();
	});

	it('attach() wires non-passive wheel listener on rootEl', () => {
		const newZoom = new SuperZoom(positionProvider);
		const newRoot = document.createElement('div');
		const newGrid = document.createElement('div');
		const addEventListenerSpy = vi.spyOn(newRoot, 'addEventListener');
		newZoom.attach(newRoot, newGrid);

		expect(addEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
		newZoom.detach();
		addEventListenerSpy.mockRestore();
	});

	it('wheel event with ctrlKey=true calls preventDefault (pinch intercepted)', () => {
		const event = new MockWheelEvent('wheel', { deltaY: -10, ctrlKey: true, cancelable: true });
		const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
		rootEl.dispatchEvent(event);
		expect(preventDefaultSpy).toHaveBeenCalled();
	});

	it('wheel event with ctrlKey=false does NOT call preventDefault (regular scroll passes through)', () => {
		const event = new MockWheelEvent('wheel', { deltaY: -10, ctrlKey: false, cancelable: true });
		const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
		rootEl.dispatchEvent(event);
		expect(preventDefaultSpy).not.toHaveBeenCalled();
	});

	it('wheel event with ctrlKey=true updates positionProvider.zoomLevel', () => {
		const initialZoom = positionProvider.zoomLevel;
		const event = new MockWheelEvent('wheel', { deltaY: -10, ctrlKey: true });
		rootEl.dispatchEvent(event);
		// Negative deltaY = zoom in → zoomLevel should increase
		expect(positionProvider.zoomLevel).toBeGreaterThan(initialZoom);
	});

	it('zoom level is clamped to ZOOM_MAX=3.0 after repeated zoom-in events', () => {
		// Fire many zoom-in events to push past max
		for (let i = 0; i < 100; i++) {
			const event = new MockWheelEvent('wheel', { deltaY: -24, ctrlKey: true });
			rootEl.dispatchEvent(event);
		}
		expect(positionProvider.zoomLevel).toBe(ZOOM_MAX);
	});

	it('zoom level is clamped to ZOOM_MIN=0.5 after repeated zoom-out events', () => {
		// Fire many zoom-out events to push past min
		for (let i = 0; i < 100; i++) {
			const event = new MockWheelEvent('wheel', { deltaY: 24, ctrlKey: true });
			rootEl.dispatchEvent(event);
		}
		expect(positionProvider.zoomLevel).toBe(ZOOM_MIN);
	});

	it('onZoomChange callback is called on zoom change', () => {
		const onZoomChange = vi.fn();
		const zoomWithCallback = new SuperZoom(positionProvider, onZoomChange);
		const newRoot = document.createElement('div');
		const newGrid = document.createElement('div');
		zoomWithCallback.attach(newRoot, newGrid);

		const event = new MockWheelEvent('wheel', { deltaY: -10, ctrlKey: true });
		newRoot.dispatchEvent(event);

		expect(onZoomChange).toHaveBeenCalled();
		zoomWithCallback.detach();
	});
});

// ---------------------------------------------------------------------------
// Tests: SuperZoom — applyZoom (CSS Custom Properties)
// ---------------------------------------------------------------------------

describe('SuperZoom — applyZoom CSS Custom Properties', () => {
	let positionProvider: SuperPositionProvider;
	let superZoom: SuperZoom;
	let rootEl: HTMLElement;
	let gridEl: HTMLElement;

	beforeEach(() => {
		positionProvider = new SuperPositionProvider();
		superZoom = new SuperZoom(positionProvider);
		rootEl = document.createElement('div');
		gridEl = document.createElement('div');
		document.body.appendChild(rootEl);
		document.body.appendChild(gridEl);
		superZoom.attach(rootEl, gridEl);
	});

	afterEach(() => {
		superZoom.detach();
		rootEl.remove();
		gridEl.remove();
	});

	it('applyZoom sets --sg-col-width on gridEl', () => {
		positionProvider.zoomLevel = 1.0;
		superZoom.applyZoom();
		expect(gridEl.style.getPropertyValue('--sg-col-width')).toBe('120px');
	});

	it('applyZoom sets --sg-row-height on gridEl', () => {
		positionProvider.zoomLevel = 1.0;
		superZoom.applyZoom();
		expect(gridEl.style.getPropertyValue('--sg-row-height')).toBe('40px');
	});

	it('applyZoom at zoomLevel=2.0 sets --sg-col-width to 240px (120*2)', () => {
		positionProvider.zoomLevel = 2.0;
		superZoom.applyZoom();
		expect(gridEl.style.getPropertyValue('--sg-col-width')).toBe('240px');
	});

	it('applyZoom at zoomLevel=2.0 sets --sg-row-height to 80px (40*2)', () => {
		positionProvider.zoomLevel = 2.0;
		superZoom.applyZoom();
		expect(gridEl.style.getPropertyValue('--sg-row-height')).toBe('80px');
	});

	it('applyZoom at zoomLevel=1.0 sets --sg-col-width to 120px', () => {
		positionProvider.zoomLevel = 1.0;
		superZoom.applyZoom();
		expect(gridEl.style.getPropertyValue('--sg-col-width')).toBe('120px');
	});

	it('applyZoom at zoomLevel=1.0 sets --sg-row-height to 40px', () => {
		positionProvider.zoomLevel = 1.0;
		superZoom.applyZoom();
		expect(gridEl.style.getPropertyValue('--sg-row-height')).toBe('40px');
	});

	it('applyZoom sets --sg-zoom CSS Custom Property for font/padding scaling', () => {
		positionProvider.zoomLevel = 1.5;
		superZoom.applyZoom();
		expect(gridEl.style.getPropertyValue('--sg-zoom')).toBe('1.5');
	});

	it('applyZoom at zoomLevel=0.5 sets --sg-col-width to 60px (120*0.5)', () => {
		positionProvider.zoomLevel = 0.5;
		superZoom.applyZoom();
		expect(gridEl.style.getPropertyValue('--sg-col-width')).toBe('60px');
	});

	it('applyZoom at zoomLevel=3.0 sets --sg-col-width to 360px (120*3)', () => {
		positionProvider.zoomLevel = 3.0;
		superZoom.applyZoom();
		expect(gridEl.style.getPropertyValue('--sg-col-width')).toBe('360px');
	});
});

// ---------------------------------------------------------------------------
// Tests: SuperZoom — resetZoom
// ---------------------------------------------------------------------------

describe('SuperZoom — resetZoom', () => {
	let positionProvider: SuperPositionProvider;
	let superZoom: SuperZoom;
	let rootEl: HTMLElement;
	let gridEl: HTMLElement;

	beforeEach(() => {
		positionProvider = new SuperPositionProvider();
		superZoom = new SuperZoom(positionProvider);
		rootEl = document.createElement('div');
		gridEl = document.createElement('div');
		document.body.appendChild(rootEl);
		document.body.appendChild(gridEl);
		superZoom.attach(rootEl, gridEl);
	});

	afterEach(() => {
		superZoom.detach();
		rootEl.remove();
		gridEl.remove();
	});

	it('resetZoom() sets zoom to 1.0', () => {
		positionProvider.zoomLevel = 2.5;
		superZoom.resetZoom();
		expect(positionProvider.zoomLevel).toBe(1.0);
	});

	it('resetZoom() calls applyZoom (CSS properties update to 1x values)', () => {
		positionProvider.zoomLevel = 2.0;
		superZoom.resetZoom();
		expect(gridEl.style.getPropertyValue('--sg-col-width')).toBe('120px');
		expect(gridEl.style.getPropertyValue('--sg-row-height')).toBe('40px');
		expect(gridEl.style.getPropertyValue('--sg-zoom')).toBe('1');
	});
});

// ---------------------------------------------------------------------------
// Tests: SuperZoom — Cmd+0 keyboard shortcut
// ---------------------------------------------------------------------------

describe('SuperZoom — Cmd+0 keyboard shortcut', () => {
	let positionProvider: SuperPositionProvider;
	let superZoom: SuperZoom;
	let rootEl: HTMLElement;
	let gridEl: HTMLElement;

	beforeEach(() => {
		positionProvider = new SuperPositionProvider();
		superZoom = new SuperZoom(positionProvider);
		rootEl = document.createElement('div');
		gridEl = document.createElement('div');
		document.body.appendChild(rootEl);
		document.body.appendChild(gridEl);
		superZoom.attach(rootEl, gridEl);
	});

	afterEach(() => {
		superZoom.detach();
		rootEl.remove();
		gridEl.remove();
	});

	it('Cmd+0 (metaKey + key=0) calls resetZoom', () => {
		positionProvider.zoomLevel = 2.0;
		const event = new KeyboardEvent('keydown', { key: '0', metaKey: true, bubbles: true });
		document.dispatchEvent(event);
		expect(positionProvider.zoomLevel).toBe(1.0);
	});

	it('Cmd+0 only triggers on key=0, not other keys', () => {
		positionProvider.zoomLevel = 2.0;
		const event = new KeyboardEvent('keydown', { key: '1', metaKey: true, bubbles: true });
		document.dispatchEvent(event);
		expect(positionProvider.zoomLevel).toBe(2.0); // unchanged
	});

	it('metaKey alone without key=0 does not reset zoom', () => {
		positionProvider.zoomLevel = 2.0;
		const event = new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true });
		document.dispatchEvent(event);
		expect(positionProvider.zoomLevel).toBe(2.0); // unchanged
	});
});

// ---------------------------------------------------------------------------
// Tests: SuperZoom — detach (no memory leak)
// ---------------------------------------------------------------------------

describe('SuperZoom — detach', () => {
	it('detach() removes wheel event listener (wheel events no longer update zoom)', () => {
		const positionProvider = new SuperPositionProvider();
		const superZoom = new SuperZoom(positionProvider);
		const rootEl = document.createElement('div');
		const gridEl = document.createElement('div');
		document.body.appendChild(rootEl);
		document.body.appendChild(gridEl);
		superZoom.attach(rootEl, gridEl);

		positionProvider.zoomLevel = 1.0;
		superZoom.detach();

		// After detach, wheel events should NOT update zoom
		const event = new MockWheelEvent('wheel', { deltaY: -24, ctrlKey: true });
		rootEl.dispatchEvent(event);
		expect(positionProvider.zoomLevel).toBe(1.0); // unchanged after detach
		rootEl.remove();
		gridEl.remove();
	});

	it('detach() removes keydown listener from document', () => {
		const positionProvider = new SuperPositionProvider();
		const superZoom = new SuperZoom(positionProvider);
		const rootEl = document.createElement('div');
		const gridEl = document.createElement('div');
		document.body.appendChild(rootEl);
		document.body.appendChild(gridEl);
		superZoom.attach(rootEl, gridEl);

		positionProvider.zoomLevel = 2.0;
		superZoom.detach();

		// After detach, Cmd+0 should NOT reset zoom
		const event = new KeyboardEvent('keydown', { key: '0', metaKey: true, bubbles: true });
		document.dispatchEvent(event);
		expect(positionProvider.zoomLevel).toBe(2.0); // unchanged after detach
		rootEl.remove();
		gridEl.remove();
	});
});

// ---------------------------------------------------------------------------
// Tests: BASE_COL_WIDTH and BASE_ROW_HEIGHT exports
// ---------------------------------------------------------------------------

describe('SuperZoom — exported constants', () => {
	it('BASE_COL_WIDTH is 120', () => {
		expect(BASE_COL_WIDTH).toBe(120);
	});

	it('BASE_ROW_HEIGHT is 40', () => {
		expect(BASE_ROW_HEIGHT).toBe(40);
	});
});
