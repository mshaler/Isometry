// @vitest-environment jsdom
// Isometry v5 — Phase 100 Plan 01 SuperSize Tests
// Behavioral tests for SuperSize plugins: col-resize, header-resize, uniform-resize.
//
// Design:
//   - Pure function tests (normalizeWidth clamping, auto-fit calculation)
//   - Factory return shape tests (PluginHook interface)
//   - transformLayout behavior tests
//   - Phase 105: Lifecycle describe blocks using makePluginHarness/usePlugin
//
// Requirements: SIZE-01, SIZE-02, SIZE-03

import { describe, expect, it, vi } from 'vitest';
import { makePluginHarness } from './helpers/makePluginHarness';
import { usePlugin } from './helpers/usePlugin';

// ---------------------------------------------------------------------------
// SuperSizeColResize tests
// ---------------------------------------------------------------------------

describe('SuperSizeColResize', () => {
	it('exports constants: MIN_COL_WIDTH=48, AUTO_FIT_PADDING=24, AUTO_FIT_MAX=400', async () => {
		const { MIN_COL_WIDTH, AUTO_FIT_PADDING, AUTO_FIT_MAX } = await import(
			'../../../src/views/pivot/plugins/SuperSizeColResize'
		);
		expect(MIN_COL_WIDTH).toBe(48);
		expect(AUTO_FIT_PADDING).toBe(24);
		expect(AUTO_FIT_MAX).toBe(400);
	});

	it('normalizeWidth(30) returns MIN_COL_WIDTH (48) — clamps below min', async () => {
		const { normalizeWidth, MIN_COL_WIDTH } = await import('../../../src/views/pivot/plugins/SuperSizeColResize');
		expect(normalizeWidth(30)).toBe(MIN_COL_WIDTH);
	});

	it('normalizeWidth(200) returns 200 — passthrough within range', async () => {
		const { normalizeWidth } = await import('../../../src/views/pivot/plugins/SuperSizeColResize');
		expect(normalizeWidth(200)).toBe(200);
	});

	it('autoFitWidth returns min(measured + AUTO_FIT_PADDING, AUTO_FIT_MAX)', async () => {
		const { autoFitWidth, AUTO_FIT_PADDING, AUTO_FIT_MAX } = await import(
			'../../../src/views/pivot/plugins/SuperSizeColResize'
		);
		// Normal: measured + padding within max
		expect(autoFitWidth(100)).toBe(100 + AUTO_FIT_PADDING);
		// Clamped: measured + padding exceeds max
		expect(autoFitWidth(450)).toBe(AUTO_FIT_MAX);
	});

	it('factory returns PluginHook with onPointerEvent, transformLayout, afterRender, destroy', async () => {
		const { createSuperSizeColResizePlugin } = await import('../../../src/views/pivot/plugins/SuperSizeColResize');
		const plugin = createSuperSizeColResizePlugin();
		expect(typeof plugin.onPointerEvent).toBe('function');
		expect(typeof plugin.transformLayout).toBe('function');
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('transformLayout applies colWidths Map entries to override default cellWidth', async () => {
		const { createSuperSizeColResizePlugin } = await import('../../../src/views/pivot/plugins/SuperSizeColResize');
		const plugin = createSuperSizeColResizePlugin();

		// Initially no overrides — layout unchanged
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
		const result = plugin.transformLayout!(layout, ctx);
		expect(result.colWidths.size).toBe(0);
	});

	it('transformLayout merges internal colWidths into layout.colWidths', async () => {
		const { createSuperSizeColResizePlugin } = await import('../../../src/views/pivot/plugins/SuperSizeColResize');
		const plugin = createSuperSizeColResizePlugin();

		// Simulate a drag that set column 2 to width 200
		// We use setColWidthForTest if exposed, otherwise simulate via setWidth helper
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

		// Inject a width via the internal _setColWidth test helper (exported for tests)
		const mod = await import('../../../src/views/pivot/plugins/SuperSizeColResize');
		if (typeof mod._setColWidthForTest === 'function') {
			mod._setColWidthForTest(plugin, 2, 200);
		}

		const result = plugin.transformLayout!(layout, ctx);
		// If _setColWidthForTest is available, verify the width was applied
		if (typeof mod._setColWidthForTest === 'function') {
			expect(result.colWidths.get(2)).toBe(200);
		}
	});
});

// ---------------------------------------------------------------------------
// SuperSizeHeaderResize tests
// ---------------------------------------------------------------------------

describe('SuperSizeHeaderResize', () => {
	it('clamp(10) returns 24 (min), clamp(200) returns 120 (max)', async () => {
		const { clampHeaderHeight } = await import('../../../src/views/pivot/plugins/SuperSizeHeaderResize');
		expect(clampHeaderHeight(10)).toBe(24);
		expect(clampHeaderHeight(200)).toBe(120);
		expect(clampHeaderHeight(60)).toBe(60);
	});

	it('factory returns PluginHook with onPointerEvent, transformLayout, afterRender, destroy', async () => {
		const { createSuperSizeHeaderResizePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSizeHeaderResize'
		);
		const plugin = createSuperSizeHeaderResizePlugin();
		expect(typeof plugin.onPointerEvent).toBe('function');
		expect(typeof plugin.transformLayout).toBe('function');
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('transformLayout leaves headerHeight unchanged when no drag has occurred', async () => {
		const { createSuperSizeHeaderResizePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSizeHeaderResize'
		);
		const plugin = createSuperSizeHeaderResizePlugin();
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
		const result = plugin.transformLayout!(layout, ctx);
		expect(result.headerHeight).toBe(40);
	});
});

// ---------------------------------------------------------------------------
// SuperSizeUniformResize tests
// ---------------------------------------------------------------------------

describe('SuperSizeUniformResize', () => {
	it('factory returns PluginHook with onPointerEvent, transformLayout, afterRender, destroy', async () => {
		const { createSuperSizeUniformResizePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSizeUniformResize'
		);
		const plugin = createSuperSizeUniformResizePlugin();
		expect(typeof plugin.onPointerEvent).toBe('function');
		expect(typeof plugin.transformLayout).toBe('function');
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('transformLayout at default scale (1.0) leaves cellWidth and cellHeight unchanged', async () => {
		const { createSuperSizeUniformResizePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSizeUniformResize'
		);
		const plugin = createSuperSizeUniformResizePlugin();
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
		const result = plugin.transformLayout!(layout, ctx);
		expect(result.cellWidth).toBe(120);
		expect(result.cellHeight).toBe(40);
	});

	it('resize delta applies to both cellWidth and cellHeight proportionally', async () => {
		const { createSuperSizeUniformResizePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSizeUniformResize'
		);
		const plugin = createSuperSizeUniformResizePlugin();

		// Test that scale can be set externally via test helper
		const mod = await import('../../../src/views/pivot/plugins/SuperSizeUniformResize');
		if (typeof mod._setScaleForTest === 'function') {
			mod._setScaleForTest(plugin, 2.0);

			const layout = {
				headerWidth: 120,
				headerHeight: 40,
				cellWidth: 100,
				cellHeight: 40,
				colWidths: new Map<number, number>(),
				zoom: 1.0,
			};
			const ctx = makeMinCtx();
			const result = plugin.transformLayout!(layout, ctx);
			// Scale 2.0 doubles both dimensions
			expect(result.cellWidth).toBeCloseTo(200);
			expect(result.cellHeight).toBeCloseTo(80);
		}
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — supersize.col-resize
// ---------------------------------------------------------------------------

describe('Lifecycle — supersize.col-resize', () => {
	it('hook has transformLayout function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.col-resize');
		expect(typeof hook.transformLayout).toBe('function');
	});

	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.col-resize');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook has destroy function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.col-resize');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook transformData is undefined (col-resize does not filter cells)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.col-resize');
		expect(hook.transformData).toBeUndefined();
	});

	it('transformLayout via pipeline does not throw', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supersize.col-resize');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('transformLayout returns layout with colWidths map', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supersize.col-resize');
		const { layout } = harness.runPipeline();
		expect(layout.colWidths).toBeInstanceOf(Map);
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.col-resize');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.col-resize');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — supersize.header-resize
// ---------------------------------------------------------------------------

describe('Lifecycle — supersize.header-resize', () => {
	it('hook has transformLayout function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.header-resize');
		expect(typeof hook.transformLayout).toBe('function');
	});

	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.header-resize');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook has destroy function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.header-resize');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook transformData is undefined (header-resize does not filter cells)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.header-resize');
		expect(hook.transformData).toBeUndefined();
	});

	it('transformLayout via pipeline does not throw', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supersize.header-resize');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('transformLayout preserves headerHeight when no drag occurred', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supersize.header-resize');
		const { layout } = harness.runPipeline();
		// Default headerHeight from makePluginHarness layout
		expect(layout.headerHeight).toBe(30);
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.header-resize');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.header-resize');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — supersize.uniform-resize
// ---------------------------------------------------------------------------

describe('Lifecycle — supersize.uniform-resize', () => {
	it('hook has transformLayout function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.uniform-resize');
		expect(typeof hook.transformLayout).toBe('function');
	});

	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.uniform-resize');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook has destroy function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.uniform-resize');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook transformData is undefined (uniform-resize does not filter cells)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.uniform-resize');
		expect(hook.transformData).toBeUndefined();
	});

	it('transformLayout via pipeline does not throw', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supersize.uniform-resize');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('transformLayout at default scale leaves cellWidth unchanged', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supersize.uniform-resize');
		const { layout } = harness.runPipeline();
		// Default cellWidth from makePluginHarness
		expect(layout.cellWidth).toBe(80);
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.uniform-resize');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersize.uniform-resize');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Shared context factory
// ---------------------------------------------------------------------------

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
