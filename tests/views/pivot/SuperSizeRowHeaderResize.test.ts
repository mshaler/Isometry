// @vitest-environment jsdom
// Isometry v5 — Phase 143 Plan 02 SuperSizeRowHeaderResize Tests
// Unit tests for the row header per-level resize plugin.
//
// Requirements: VPOL-03

import { describe, expect, it, vi } from 'vitest';
import {
	MIN_ROW_HEADER_WIDTH,
	MAX_ROW_HEADER_WIDTH,
	clampRowHeaderWidth,
	createSuperSizeRowHeaderResizePlugin,
} from '../../../src/views/pivot/plugins/SuperSizeRowHeaderResize';
import { FEATURE_CATALOG } from '../../../src/views/pivot/plugins/FeatureCatalog';
import type { GridLayout, RenderContext } from '../../../src/views/pivot/plugins/PluginTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLayout(overrides: Partial<GridLayout> = {}): GridLayout {
	return {
		headerWidth: 120,
		headerHeight: 36,
		cellWidth: 72,
		cellHeight: 32,
		colWidths: new Map(),
		rowHeaderWidths: new Map(),
		zoom: 1.0,
		...overrides,
	};
}

function makeCtx(overrides: Partial<RenderContext> = {}): RenderContext {
	return {
		rowDimensions: [
			{ id: 'region', type: 'folder' as const, name: 'Region', values: ['North', 'South'] },
			{ id: 'product', type: 'tag' as const, name: 'Product', values: ['A', 'B'] },
		],
		colDimensions: [{ id: 'year', type: 'year' as const, name: 'Year', values: ['2024', '2025'] }],
		visibleRows: [['North', 'A'], ['North', 'B'], ['South', 'A']],
		allRows: [['North', 'A'], ['North', 'B'], ['South', 'A']],
		visibleCols: [['2024'], ['2025']],
		data: new Map(),
		cells: [],
		rootEl: document.createElement('div'),
		scrollLeft: 0,
		scrollTop: 0,
		isPluginEnabled: () => false,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Test 1: clampRowHeaderWidth clamps below MIN (60) to 60
// ---------------------------------------------------------------------------

describe('clampRowHeaderWidth', () => {
	it('clamps values below MIN_ROW_HEADER_WIDTH to MIN', () => {
		expect(clampRowHeaderWidth(0)).toBe(MIN_ROW_HEADER_WIDTH);
		expect(clampRowHeaderWidth(30)).toBe(MIN_ROW_HEADER_WIDTH);
		expect(clampRowHeaderWidth(59)).toBe(MIN_ROW_HEADER_WIDTH);
	});

	// Test 2: clampRowHeaderWidth clamps above MAX (400) to 400
	it('clamps values above MAX_ROW_HEADER_WIDTH to MAX', () => {
		expect(clampRowHeaderWidth(401)).toBe(MAX_ROW_HEADER_WIDTH);
		expect(clampRowHeaderWidth(1000)).toBe(MAX_ROW_HEADER_WIDTH);
	});

	// Test 3: clampRowHeaderWidth passes through values within range
	it('passes through values within [MIN, MAX] range', () => {
		expect(clampRowHeaderWidth(60)).toBe(60);
		expect(clampRowHeaderWidth(120)).toBe(120);
		expect(clampRowHeaderWidth(200)).toBe(200);
		expect(clampRowHeaderWidth(400)).toBe(400);
	});
});

// ---------------------------------------------------------------------------
// Test 4: transformLayout sets rowHeaderWidths entries on GridLayout
// ---------------------------------------------------------------------------

describe('createSuperSizeRowHeaderResizePlugin - transformLayout', () => {
	it('sets rowHeaderWidths entries from internal _widths map', () => {
		const plugin = createSuperSizeRowHeaderResizePlugin();
		const layout = makeLayout();
		const ctx = makeCtx();

		// Simulate a drag that set level 0 = 150, level 1 = 90
		// We do this by triggering pointerdown/pointermove sequences
		const root = document.createElement('div');

		// Inject a fake handle for level 0
		const handle0 = document.createElement('div');
		handle0.className = 'pv-resize-handle pv-resize-handle--row-header-width';
		handle0.setAttribute('data-level', '0');
		root.appendChild(handle0);

		const downEvent0 = new PointerEvent('pointerdown', {
			clientX: 100,
			pointerId: 1,
			bubbles: true,
		});
		Object.defineProperty(downEvent0, 'target', { value: handle0, configurable: true });

		plugin.onPointerEvent!('pointerdown', downEvent0, { ...makeCtx(), rootEl: root });

		const moveEvent0 = new PointerEvent('pointermove', {
			clientX: 130, // delta = +30, startWidth=120 → 150
			pointerId: 1,
			bubbles: true,
		});
		Object.defineProperty(moveEvent0, 'target', { value: handle0, configurable: true });

		plugin.onPointerEvent!('pointermove', moveEvent0, { ...makeCtx(), rootEl: root });

		const upEvent0 = new PointerEvent('pointerup', { pointerId: 1 });
		Object.defineProperty(upEvent0, 'target', { value: handle0, configurable: true });
		plugin.onPointerEvent!('pointerup', upEvent0, { ...makeCtx(), rootEl: root });

		// transformLayout should now have level 0 → 150
		const transformed = plugin.transformLayout!(layout, ctx);
		expect(transformed.rowHeaderWidths.get(0)).toBe(150);
	});

	it('merges _widths into existing rowHeaderWidths without clearing other entries', () => {
		const plugin = createSuperSizeRowHeaderResizePlugin();
		const layout = makeLayout({ rowHeaderWidths: new Map([[2, 80]]) });
		const ctx = makeCtx();

		// No drags yet — transformLayout should preserve existing map entries
		const transformed = plugin.transformLayout!(layout, ctx);
		// The plugin itself doesn't clear the map — it merges into it
		expect(transformed.rowHeaderWidths.get(2)).toBe(80);
	});
});

// ---------------------------------------------------------------------------
// Test 5: afterRender injects resize handles on row span elements
// ---------------------------------------------------------------------------

describe('createSuperSizeRowHeaderResizePlugin - afterRender', () => {
	it('injects .pv-resize-handle--row-header-width handles on .pv-row-span elements per level', () => {
		const plugin = createSuperSizeRowHeaderResizePlugin();
		const root = document.createElement('div');

		// Create .pv-row-span elements at level 0 and level 1
		const span0a = document.createElement('div');
		span0a.className = 'pv-row-span';
		span0a.setAttribute('data-level', '0');
		span0a.style.left = '0px';
		span0a.style.width = '120px';
		root.appendChild(span0a);

		const span0b = document.createElement('div');
		span0b.className = 'pv-row-span';
		span0b.setAttribute('data-level', '0');
		span0b.style.left = '0px';
		span0b.style.width = '120px';
		root.appendChild(span0b);

		const span1a = document.createElement('div');
		span1a.className = 'pv-row-span';
		span1a.setAttribute('data-level', '1');
		span1a.style.left = '120px';
		span1a.style.width = '120px';
		root.appendChild(span1a);

		const ctx = makeCtx({ rootEl: root });
		plugin.afterRender!(root, ctx);

		// Each unique level should get one handle injected into one of its spans
		const handles = root.querySelectorAll('.pv-resize-handle--row-header-width');
		// Should have at least one handle per unique level (2 levels = 2 handles)
		expect(handles.length).toBeGreaterThanOrEqual(2);

		// Handles should have data-level attributes
		const levels = new Set(Array.from(handles).map((h) => h.getAttribute('data-level')));
		expect(levels.has('0')).toBe(true);
		expect(levels.has('1')).toBe(true);
	});

	it('removes existing handles before re-injecting on subsequent afterRender calls', () => {
		const plugin = createSuperSizeRowHeaderResizePlugin();
		const root = document.createElement('div');

		const span = document.createElement('div');
		span.className = 'pv-row-span';
		span.setAttribute('data-level', '0');
		root.appendChild(span);

		const ctx = makeCtx({ rootEl: root });

		// First render
		plugin.afterRender!(root, ctx);
		const firstCount = root.querySelectorAll('.pv-resize-handle--row-header-width').length;
		expect(firstCount).toBeGreaterThanOrEqual(1);

		// Second render — handles should not double up
		plugin.afterRender!(root, ctx);
		const secondCount = root.querySelectorAll('.pv-resize-handle--row-header-width').length;
		expect(secondCount).toBe(firstCount);
	});
});

// ---------------------------------------------------------------------------
// Test 6: onPointerEvent drag flow
// ---------------------------------------------------------------------------

describe('createSuperSizeRowHeaderResizePlugin - drag flow', () => {
	it('pointerdown starts drag, pointermove updates width, pointerup ends drag', () => {
		const plugin = createSuperSizeRowHeaderResizePlugin();
		const root = document.createElement('div');

		const handle = document.createElement('div');
		handle.className = 'pv-resize-handle pv-resize-handle--row-header-width';
		handle.setAttribute('data-level', '1');
		root.appendChild(handle);

		const ctx = makeCtx({ rootEl: root });
		const layout = makeLayout();

		// pointerdown on handle
		const downEvent = new PointerEvent('pointerdown', { clientX: 200, pointerId: 5 });
		Object.defineProperty(downEvent, 'target', { value: handle, configurable: true });
		const consumed = plugin.onPointerEvent!('pointerdown', downEvent, ctx);
		expect(consumed).toBe(true);

		// pointermove: drag right by 50px → new width = 120 + 50 = 170
		const moveEvent = new PointerEvent('pointermove', { clientX: 250, pointerId: 5 });
		Object.defineProperty(moveEvent, 'target', { value: handle, configurable: true });
		plugin.onPointerEvent!('pointermove', moveEvent, ctx);

		// transformLayout should reflect the change
		const transformed = plugin.transformLayout!(layout, ctx);
		expect(transformed.rowHeaderWidths.get(1)).toBe(170);

		// pointerup ends drag
		const upEvent = new PointerEvent('pointerup', { pointerId: 5 });
		Object.defineProperty(upEvent, 'target', { value: handle, configurable: true });
		const upConsumed = plugin.onPointerEvent!('pointerup', upEvent, ctx);
		expect(upConsumed).toBe(true);

		// drag is ended — another move should not update widths
		const staleMove = new PointerEvent('pointermove', { clientX: 400, pointerId: 5 });
		Object.defineProperty(staleMove, 'target', { value: handle, configurable: true });
		plugin.onPointerEvent!('pointermove', staleMove, ctx);

		// Width should still be 170 (not 320)
		const transformedAfter = plugin.transformLayout!(layout, ctx);
		expect(transformedAfter.rowHeaderWidths.get(1)).toBe(170);
	});

	it('pointerdown on non-handle returns false', () => {
		const plugin = createSuperSizeRowHeaderResizePlugin();
		const other = document.createElement('div');
		other.className = 'some-other-element';
		const ctx = makeCtx();

		const downEvent = new PointerEvent('pointerdown', { clientX: 0, pointerId: 1 });
		Object.defineProperty(downEvent, 'target', { value: other, configurable: true });
		expect(plugin.onPointerEvent!('pointerdown', downEvent, ctx)).toBe(false);
	});

	it('clamps width to MIN and MAX during drag', () => {
		const plugin = createSuperSizeRowHeaderResizePlugin();
		const root = document.createElement('div');
		const handle = document.createElement('div');
		handle.className = 'pv-resize-handle pv-resize-handle--row-header-width';
		handle.setAttribute('data-level', '0');
		root.appendChild(handle);

		const ctx = makeCtx({ rootEl: root });
		const layout = makeLayout();

		// Start drag
		const downEvent = new PointerEvent('pointerdown', { clientX: 100, pointerId: 2 });
		Object.defineProperty(downEvent, 'target', { value: handle, configurable: true });
		plugin.onPointerEvent!('pointerdown', downEvent, ctx);

		// Drag far left (beyond MIN)
		const moveLeft = new PointerEvent('pointermove', { clientX: 0, pointerId: 2 });
		Object.defineProperty(moveLeft, 'target', { value: handle, configurable: true });
		plugin.onPointerEvent!('pointermove', moveLeft, ctx);
		const t1 = plugin.transformLayout!(layout, ctx);
		expect(t1.rowHeaderWidths.get(0)).toBe(MIN_ROW_HEADER_WIDTH);

		// Drag far right (beyond MAX)
		const moveRight = new PointerEvent('pointermove', { clientX: 700, pointerId: 2 });
		Object.defineProperty(moveRight, 'target', { value: handle, configurable: true });
		plugin.onPointerEvent!('pointermove', moveRight, ctx);
		const t2 = plugin.transformLayout!(layout, ctx);
		expect(t2.rowHeaderWidths.get(0)).toBe(MAX_ROW_HEADER_WIDTH);
	});
});

// ---------------------------------------------------------------------------
// Test 7: FEATURE_CATALOG includes 'supersize.row-header-resize' entry
// ---------------------------------------------------------------------------

describe('FeatureCatalog - supersize.row-header-resize', () => {
	it('includes supersize.row-header-resize in FEATURE_CATALOG', () => {
		const entry = FEATURE_CATALOG.find((m) => m.id === 'supersize.row-header-resize');
		expect(entry).toBeDefined();
		expect(entry!.category).toBe('SuperSize');
		expect(entry!.dependencies).toContain('base.grid');
	});
});
