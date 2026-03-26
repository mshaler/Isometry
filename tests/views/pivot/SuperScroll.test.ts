// @vitest-environment jsdom
// Phase 100 Plan 02 + Phase 105 Plan 02 — SuperScroll plugin tests
// Tests for SuperScrollVirtual and SuperScrollStickyHeaders plugins.
//
// Requirements: SCRL-01, SCRL-02, LIFE-05

import { describe, expect, it } from 'vitest';
import {
	getVisibleRange,
	SCROLL_BUFFER,
	VIRTUALIZATION_THRESHOLD,
} from '../../../src/views/pivot/plugins/SuperScrollVirtual';
import { makePluginHarness } from './helpers/makePluginHarness';
import { mockContainerDimensions } from './helpers/mockContainerDimensions';
import { usePlugin } from './helpers/usePlugin';

// ---------------------------------------------------------------------------
// getVisibleRange (pure function)
// ---------------------------------------------------------------------------

describe('getVisibleRange', () => {
	it('returns { startRow: 0, endRow: min(totalRows, ...) } when scrollTop is 0', () => {
		// scrollTop=0, rowHeight=32, containerHeight=300, totalRows=100
		const { startRow, endRow } = getVisibleRange(0, 32, 300, 100);
		expect(startRow).toBe(0);
		// lastVisible = ceil((0 + 300) / 32) = ceil(9.375) = 10
		// endRow = min(100, 10 + SCROLL_BUFFER) = min(100, 12)
		const expectedEnd = Math.min(100, Math.ceil(300 / 32) + SCROLL_BUFFER);
		expect(endRow).toBe(expectedEnd);
	});

	it('returns correct startRow with buffer when scrollTop > 0', () => {
		// scrollTop=320, rowHeight=32, containerHeight=300, totalRows=100
		const { startRow } = getVisibleRange(320, 32, 300, 100);
		// firstVisible = floor(320/32) = 10
		// startRow = max(0, 10 - SCROLL_BUFFER)
		const expected = Math.max(0, Math.floor(320 / 32) - SCROLL_BUFFER);
		expect(startRow).toBe(expected);
	});

	it('startRow is clamped to 0 (never negative)', () => {
		const { startRow } = getVisibleRange(0, 32, 300, 100);
		expect(startRow).toBeGreaterThanOrEqual(0);
	});

	it('endRow is clamped to totalRows (never exceeds)', () => {
		const { endRow } = getVisibleRange(0, 32, 10000, 50);
		expect(endRow).toBeLessThanOrEqual(50);
	});

	it('SCROLL_BUFFER is 2', () => {
		expect(SCROLL_BUFFER).toBe(2);
	});

	it('VIRTUALIZATION_THRESHOLD is 100', () => {
		expect(VIRTUALIZATION_THRESHOLD).toBe(100);
	});

	it('buffer = 2 rows above and 2 below visible range', () => {
		// scrollTop=320, rowHeight=32, containerHeight=300, totalRows=200
		const { startRow, endRow } = getVisibleRange(320, 32, 300, 200);
		const firstVisible = Math.floor(320 / 32); // 10
		const lastVisible = Math.ceil((320 + 300) / 32); // ceil(19.375) = 20
		expect(startRow).toBe(Math.max(0, firstVisible - 2));
		expect(endRow).toBe(Math.min(200, lastVisible + 2));
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superscroll.virtual
// ---------------------------------------------------------------------------

describe('Lifecycle — superscroll.virtual', () => {
	it('hook has transformData and destroy; no transformLayout', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superscroll.virtual');
		expect(typeof hook.transformData).toBe('function');
		expect(typeof hook.destroy).toBe('function');
		expect(hook.transformLayout).toBeUndefined();
	});

	it('transformData returns all cells when row count is at or below threshold', () => {
		const harness = makePluginHarness({ rows: 50, cols: ['A', 'B', 'C'] });
		const hook = usePlugin(harness, 'superscroll.virtual');
		const { cells } = harness.runPipeline();
		// 50 rows × 3 cols = 150 cells — all should survive
		expect(cells.length).toBe(50 * 3);
	});

	it('transformData filters cells to visible range when row count > threshold', () => {
		const harness = makePluginHarness({ rows: 150, cols: ['A'] });
		const hook = usePlugin(harness, 'superscroll.virtual');
		const { cells } = harness.runPipeline();
		// 150 rows but only a window should be returned
		const uniqueRows = new Set(cells.map((c) => c.rowIdx)).size;
		expect(uniqueRows).toBeLessThan(150);
	});

	it('afterRender does not throw', () => {
		const harness = makePluginHarness({ rows: 150, cols: ['A'] });
		usePlugin(harness, 'superscroll.virtual');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superscroll.virtual');
		expect(() => hook.destroy?.()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superscroll.virtual');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superscroll.virtual — LIFE-05 threshold boundary (VIRTUALIZATION_THRESHOLD = 100)
// ---------------------------------------------------------------------------

describe('Lifecycle — superscroll.virtual — LIFE-05 threshold boundary', () => {
	it('below threshold (99 rows): all cells survive, no windowing', () => {
		const harness = makePluginHarness({ rows: 99, cols: ['A', 'B'] });
		mockContainerDimensions(harness.ctx.rootEl, { clientHeight: 400 });
		usePlugin(harness, 'superscroll.virtual');
		const { cells } = harness.runPipeline();
		// 99 rows × 2 cols = 198 cells — all should survive unchanged
		expect(cells.length).toBe(99 * 2);
	});

	it('below threshold (99 rows): no sentinel spacer elements created', () => {
		const harness = makePluginHarness({ rows: 99, cols: ['A'] });
		mockContainerDimensions(harness.ctx.rootEl, { clientHeight: 400 });
		usePlugin(harness, 'superscroll.virtual');
		harness.runPipeline();
		// Sentinels only appear above threshold — should be absent at 99 rows
		// They are added to the scroll container, not rootEl directly, so rootEl should be clean
		const sentinels = harness.ctx.rootEl.querySelectorAll('.pv-scroll-sentinel-top, .pv-scroll-sentinel-bottom');
		expect(sentinels.length).toBe(0);
	});

	it('above threshold (101 rows): windowing activates, fewer cells returned', () => {
		const harness = makePluginHarness({ rows: 101, cols: ['A', 'B'] });
		mockContainerDimensions(harness.ctx.rootEl, { clientHeight: 400 });
		usePlugin(harness, 'superscroll.virtual');
		const { cells } = harness.runPipeline();
		// 101 rows × 2 cols = 202 cells at max — windowing must filter some
		expect(cells.length).toBeLessThan(101 * 2);
	});

	it('above threshold (101 rows): returned row count is within visible window', () => {
		const harness = makePluginHarness({ rows: 101, cols: ['A'] });
		mockContainerDimensions(harness.ctx.rootEl, { clientHeight: 400 });
		usePlugin(harness, 'superscroll.virtual');
		const { cells } = harness.runPipeline();
		const uniqueRows = new Set(cells.map((c) => c.rowIdx)).size;
		// Should have fewer unique rows than total (windowing active)
		expect(uniqueRows).toBeLessThan(101);
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superscroll.sticky-headers
// ---------------------------------------------------------------------------

describe('Lifecycle — superscroll.sticky-headers', () => {
	it('hook has afterRender and destroy; no transformData or transformLayout', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superscroll.sticky-headers');
		expect(typeof hook.afterRender).toBe('function');
		expect(typeof hook.destroy).toBe('function');
		expect(hook.transformData).toBeUndefined();
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender applies position:sticky to .pv-col-span elements', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'superscroll.sticky-headers');

		const header = document.createElement('div');
		header.className = 'pv-col-span';
		header.setAttribute('data-level', '0');
		harness.ctx.rootEl.appendChild(header);

		harness.runPipeline();
		expect(header.style.position).toBe('sticky');
	});

	it('afterRender sets z-index 20 on sticky headers', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'superscroll.sticky-headers');

		const header = document.createElement('div');
		header.className = 'pv-col-span';
		header.setAttribute('data-level', '0');
		harness.ctx.rootEl.appendChild(header);

		harness.runPipeline();
		expect(header.style.zIndex).toBe('20');
	});

	it('afterRender does not throw when no col-span headers are present', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'superscroll.sticky-headers');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superscroll.sticky-headers');
		expect(() => hook.destroy?.()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superscroll.sticky-headers');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});
});
