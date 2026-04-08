// @vitest-environment jsdom
// Isometry v5 — Phase 100 Plan 01 SuperZoom Tests
// Tests for SuperZoom plugins: wheel zoom and slider.
//
// Design:
//   - Pure function tests: normalizeWheelDelta, wheelDeltaToScaleFactor
//   - Factory return shape tests (PluginHook interface)
//   - Zoom clamping tests
//   - Shared zoom state sync tests
//   - Phase 105: Lifecycle describe blocks using makePluginHarness/usePlugin
//
// Requirements: ZOOM-01, ZOOM-02

import { describe, expect, it, vi } from 'vitest';
import { makePluginHarness } from './helpers/makePluginHarness';
import { usePlugin } from './helpers/usePlugin';

// ---------------------------------------------------------------------------
// SuperZoomWheel pure function tests
// ---------------------------------------------------------------------------

describe('SuperZoomWheel — normalizeWheelDelta', () => {
	it('deltaMode=0 (pixel) returns capped value at +-24', async () => {
		const { normalizeWheelDelta } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');

		// Small pixel delta passes through
		const small = makeWheelEvent(10, 0);
		expect(normalizeWheelDelta(small)).toBe(10);

		// Large pixel delta capped at 24
		const large = makeWheelEvent(100, 0);
		expect(normalizeWheelDelta(large)).toBe(24);

		// Negative capped at -24
		const negLarge = makeWheelEvent(-100, 0);
		expect(normalizeWheelDelta(negLarge)).toBe(-24);
	});

	it('deltaMode=1 (line) multiplies by 8 then caps at +-24', async () => {
		const { normalizeWheelDelta } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');

		// 1 line × 8 = 8
		const oneLine = makeWheelEvent(1, 1);
		expect(normalizeWheelDelta(oneLine)).toBe(8);

		// 4 lines × 8 = 32, capped at 24
		const fourLines = makeWheelEvent(4, 1);
		expect(normalizeWheelDelta(fourLines)).toBe(24);
	});

	it('deltaMode=2 (page) multiplies by 24 then caps at +-24', async () => {
		const { normalizeWheelDelta } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');

		// 1 page × 24 = 24, exactly at cap
		const onePage = makeWheelEvent(1, 2);
		expect(normalizeWheelDelta(onePage)).toBe(24);

		// 2 pages × 24 = 48, capped at 24
		const twoPages = makeWheelEvent(2, 2);
		expect(normalizeWheelDelta(twoPages)).toBe(24);
	});
});

describe('SuperZoomWheel — wheelDeltaToScaleFactor', () => {
	it('wheelDeltaToScaleFactor(0) returns exactly 1.0', async () => {
		const { wheelDeltaToScaleFactor } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');
		expect(wheelDeltaToScaleFactor(0)).toBe(1.0);
	});

	it('wheelDeltaToScaleFactor(-10) returns value > 1.0 (zoom in)', async () => {
		const { wheelDeltaToScaleFactor } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');
		const factor = wheelDeltaToScaleFactor(-10);
		expect(factor).toBeGreaterThan(1.0);
	});

	it('wheelDeltaToScaleFactor(10) returns value < 1.0 (zoom out)', async () => {
		const { wheelDeltaToScaleFactor } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');
		const factor = wheelDeltaToScaleFactor(10);
		expect(factor).toBeLessThan(1.0);
	});

	it('zoom in then out same distance returns ~1.0 (asymmetric formula)', async () => {
		const { wheelDeltaToScaleFactor } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');
		const zoomIn = wheelDeltaToScaleFactor(-10);
		const zoomOut = wheelDeltaToScaleFactor(10);
		// In × Out should be close to 1.0 (symmetric feel)
		expect(zoomIn * zoomOut).toBeCloseTo(1.0, 1);
	});
});

describe('SuperZoomWheel — constants and exports', () => {
	it('exports ZOOM_MIN=0.5, ZOOM_MAX=3.0, ZOOM_DEFAULT=1.0', async () => {
		const { ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');
		expect(ZOOM_MIN).toBe(0.5);
		expect(ZOOM_MAX).toBe(3.0);
		expect(ZOOM_DEFAULT).toBe(1.0);
	});

	it('createZoomState returns { zoom: 1.0, listeners: Set }', async () => {
		const { createZoomState } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');
		const state = createZoomState();
		expect(state.zoom).toBe(1.0);
		expect(state.listeners).toBeInstanceOf(Set);
	});

	it('factory returns PluginHook with transformLayout, afterRender, destroy', async () => {
		const { createSuperZoomWheelPlugin, createZoomState } = await import(
			'../../../src/views/pivot/plugins/SuperZoomWheel'
		);
		const state = createZoomState();
		const plugin = createSuperZoomWheelPlugin(state);
		expect(typeof plugin.transformLayout).toBe('function');
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('zoom clamped between ZOOM_MIN and ZOOM_MAX in transformLayout', async () => {
		const { createSuperZoomWheelPlugin, createZoomState, ZOOM_MIN, ZOOM_MAX } = await import(
			'../../../src/views/pivot/plugins/SuperZoomWheel'
		);
		const state = createZoomState();
		const plugin = createSuperZoomWheelPlugin(state);

		const layout = {
			headerWidth: 120,
			headerHeight: 40,
			cellWidth: 120,
			cellHeight: 40,
			colWidths: new Map<number, number>(),
			rowHeaderWidths: new Map<number, number>(),
			zoom: 1.0,
		};
		const ctx = makeMinCtx();

		// At default zoom (1.0), layout.zoom should be set to 1.0
		const result = plugin.transformLayout!(layout, ctx);
		expect(result.zoom).toBeGreaterThanOrEqual(ZOOM_MIN);
		expect(result.zoom).toBeLessThanOrEqual(ZOOM_MAX);
	});

	it('transformLayout sets layout.zoom to current zoomState.zoom', async () => {
		const { createSuperZoomWheelPlugin, createZoomState } = await import(
			'../../../src/views/pivot/plugins/SuperZoomWheel'
		);
		const state = createZoomState();
		state.zoom = 1.5;
		const plugin = createSuperZoomWheelPlugin(state);

		const layout = {
			headerWidth: 120,
			headerHeight: 40,
			cellWidth: 100,
			cellHeight: 40,
			colWidths: new Map<number, number>(),
			rowHeaderWidths: new Map<number, number>(),
			zoom: 1.0,
		};
		const ctx = makeMinCtx();
		const result = plugin.transformLayout!(layout, ctx);
		expect(result.zoom).toBe(1.5);
	});
});

// ---------------------------------------------------------------------------
// SuperZoomSlider tests
// ---------------------------------------------------------------------------

describe('SuperZoomSlider', () => {
	it('factory returns PluginHook with afterRender and destroy', async () => {
		const { createSuperZoomSliderPlugin } = await import('../../../src/views/pivot/plugins/SuperZoomSlider');
		const { createZoomState } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');
		const state = createZoomState();
		const plugin = createSuperZoomSliderPlugin(state);
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('afterRender creates slider with min="0.5" max="3" step="0.05"', async () => {
		const { createSuperZoomSliderPlugin } = await import('../../../src/views/pivot/plugins/SuperZoomSlider');
		const { createZoomState } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');

		const state = createZoomState();
		const plugin = createSuperZoomSliderPlugin(state);

		// Create a mock harness sidebar element
		const sidebar = document.createElement('div');
		sidebar.className = 'hns-sidebar';
		document.body.appendChild(sidebar);

		const root = document.createElement('div');
		root.className = 'pv-root';
		document.body.appendChild(root);

		const ctx = makeMinCtx();
		plugin.afterRender!(root, ctx);

		const slider = document.querySelector('.hns-zoom-slider') as HTMLInputElement | null;
		expect(slider).not.toBeNull();
		expect(slider?.min).toBe('0.5');
		expect(slider?.max).toBe('3');
		expect(slider?.step).toBe('0.05');

		// Clean up
		document.body.removeChild(sidebar);
		document.body.removeChild(root);
	});

	it('slider value reflects zoomState.zoom', async () => {
		const { createSuperZoomSliderPlugin } = await import('../../../src/views/pivot/plugins/SuperZoomSlider');
		const { createZoomState } = await import('../../../src/views/pivot/plugins/SuperZoomWheel');

		const state = createZoomState();
		state.zoom = 1.5;
		const plugin = createSuperZoomSliderPlugin(state);

		const sidebar = document.createElement('div');
		sidebar.className = 'hns-sidebar';
		document.body.appendChild(sidebar);

		const root = document.createElement('div');
		root.className = 'pv-root';
		document.body.appendChild(root);

		const ctx = makeMinCtx();
		plugin.afterRender!(root, ctx);

		const slider = document.querySelector('.hns-zoom-slider') as HTMLInputElement | null;
		expect(parseFloat(slider?.value ?? '0')).toBeCloseTo(1.5);

		// Clean up
		plugin.destroy!();
		document.body.removeChild(sidebar);
		document.body.removeChild(root);
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superzoom.slider
// ---------------------------------------------------------------------------

describe('Lifecycle — superzoom.slider', () => {
	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.slider');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook has destroy function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.slider');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook transformData is undefined (slider does not filter cells)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.slider');
		expect(hook.transformData).toBeUndefined();
	});

	it('hook transformLayout is undefined (slider does not mutate layout)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.slider');
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender runs without throwing via pipeline', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'superzoom.slider');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.slider');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.slider');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superzoom.scale (wheel plugin)
// ---------------------------------------------------------------------------

describe('Lifecycle — superzoom.scale', () => {
	it('hook has transformLayout function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.scale');
		expect(typeof hook.transformLayout).toBe('function');
	});

	it('hook has destroy function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.scale');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook afterRender is a function (attaches wheel listener)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.scale');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook transformData is undefined (scale does not filter cells)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.scale');
		expect(hook.transformData).toBeUndefined();
	});

	it('transformLayout sets layout.zoom to current zoom value', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'superzoom.scale');
		const { layout } = harness.runPipeline();
		// Default zoom is 1.0
		expect(layout.zoom).toBe(1.0);
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.scale');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superzoom.scale');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeWheelEvent(deltaY: number, deltaMode: number): WheelEvent {
	return {
		deltaY,
		deltaMode,
		ctrlKey: true,
		preventDefault: () => {},
	} as unknown as WheelEvent;
}

function makeMinCtx() {
	return {
		rowDimensions: [],
		colDimensions: [],
		visibleRows: [],
		allRows: [],
		visibleCols: [],
		data: new Map(),
		cells: [],
		rootEl: document.createElement('div'),
		scrollLeft: 0,
		scrollTop: 0,
		isPluginEnabled: (_id: string) => false,
	};
}
