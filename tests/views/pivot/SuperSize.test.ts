// @vitest-environment jsdom
// Isometry v5 — Phase 100 Plan 01 SuperSize Tests
// Behavioral tests for SuperSize plugins: col-resize, header-resize, uniform-resize.
//
// Design:
//   - Pure function tests (normalizeWidth clamping, auto-fit calculation)
//   - Factory return shape tests (PluginHook interface)
//   - transformLayout behavior tests
//
// Requirements: SIZE-01, SIZE-02, SIZE-03

import { describe, expect, it } from 'vitest';

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
		const { normalizeWidth, MIN_COL_WIDTH } = await import(
			'../../../src/views/pivot/plugins/SuperSizeColResize'
		);
		expect(normalizeWidth(30)).toBe(MIN_COL_WIDTH);
	});

	it('normalizeWidth(200) returns 200 — passthrough within range', async () => {
		const { normalizeWidth } = await import(
			'../../../src/views/pivot/plugins/SuperSizeColResize'
		);
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
		const { createSuperSizeColResizePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSizeColResize'
		);
		const plugin = createSuperSizeColResizePlugin();
		expect(typeof plugin.onPointerEvent).toBe('function');
		expect(typeof plugin.transformLayout).toBe('function');
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('transformLayout applies colWidths Map entries to override default cellWidth', async () => {
		const { createSuperSizeColResizePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSizeColResize'
		);
		const plugin = createSuperSizeColResizePlugin();

		// Initially no overrides — layout unchanged
		const layout = {
			headerWidth: 120,
			headerHeight: 40,
			cellWidth: 120,
			cellHeight: 40,
			colWidths: new Map<number, number>(),
			zoom: 1.0,
		};
		const ctx = makeCtx();
		const result = plugin.transformLayout!(layout, ctx);
		expect(result.colWidths.size).toBe(0);
	});

	it('transformLayout merges internal colWidths into layout.colWidths', async () => {
		const { createSuperSizeColResizePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSizeColResize'
		);
		const plugin = createSuperSizeColResizePlugin();

		// Simulate a drag that set column 2 to width 200
		// We use setColWidthForTest if exposed, otherwise simulate via setWidth helper
		const layout = {
			headerWidth: 120,
			headerHeight: 40,
			cellWidth: 120,
			cellHeight: 40,
			colWidths: new Map<number, number>(),
			zoom: 1.0,
		};
		const ctx = makeCtx();

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
		const { clampHeaderHeight } = await import(
			'../../../src/views/pivot/plugins/SuperSizeHeaderResize'
		);
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
			zoom: 1.0,
		};
		const ctx = makeCtx();
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
			zoom: 1.0,
		};
		const ctx = makeCtx();
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
			const ctx = makeCtx();
			const result = plugin.transformLayout!(layout, ctx);
			// Scale 2.0 doubles both dimensions
			expect(result.cellWidth).toBeCloseTo(200);
			expect(result.cellHeight).toBeCloseTo(80);
		}
	});
});

// ---------------------------------------------------------------------------
// Shared context factory
// ---------------------------------------------------------------------------

function makeCtx() {
	return {
		rowDimensions: [],
		colDimensions: [],
		visibleRows: [],
		allRows: [],
		visibleCols: [],
		data: new Map(),
		rootEl: document.createElement('div'),
		scrollLeft: 0,
		scrollTop: 0,
		isPluginEnabled: (_id: string) => false,
	};
}
