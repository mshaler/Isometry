// @vitest-environment jsdom
// Isometry v5 — Phase 104 Plan 01 Plugin Harness Tests
// Tests proving makePluginHarness, usePlugin, and mockContainerDimensions all work.
//
// Design:
//   - makePluginHarness: one-call factory for PluginRegistry + FeatureCatalog + RenderContext
//   - usePlugin: auto-destroy wrapper that calls plugin.destroy() in afterEach
//   - mockContainerDimensions: jsdom layout dimension mocking without per-file prototype patching
//
// Requirements: INFR-01, INFR-02, INFR-03

import { describe, expect, it } from 'vitest';
import { FEATURE_CATALOG } from '../../../../src/views/pivot/plugins/FeatureCatalog';
import { makePluginHarness } from './makePluginHarness';
import { mockContainerDimensions } from './mockContainerDimensions';
import { usePlugin } from './usePlugin';

// ---------------------------------------------------------------------------
// makePluginHarness tests
// ---------------------------------------------------------------------------

describe('makePluginHarness', () => {
	it('returns registry with all 27 plugins registered', () => {
		const harness = makePluginHarness();
		expect(harness.registry.getAll().length).toBe(FEATURE_CATALOG.length);
	});

	it('returns ctx with default 10 visibleRows', () => {
		const harness = makePluginHarness();
		expect(harness.ctx.visibleRows.length).toBe(10);
	});

	it('respects rows override', () => {
		const harness = makePluginHarness({ rows: 5 });
		expect(harness.ctx.visibleRows.length).toBe(5);
	});

	it('respects cols override', () => {
		const harness = makePluginHarness({ cols: ['X', 'Y', 'Z'] });
		expect(harness.ctx.visibleCols.length).toBe(3);
	});

	it('respects containerHeight override', () => {
		const harness = makePluginHarness({ containerHeight: 800 });
		expect(harness.ctx.rootEl.clientHeight).toBe(800);
	});

	it('enable/disable delegates to registry', () => {
		const harness = makePluginHarness();
		harness.enable('supersort.header-click');
		expect(harness.registry.isEnabled('supersort.header-click')).toBe(true);
		harness.disable('supersort.header-click');
		expect(harness.registry.isEnabled('supersort.header-click')).toBe(false);
	});

	it('runPipeline does not throw', () => {
		const harness = makePluginHarness();
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('runPipeline returns cells and layout', () => {
		const harness = makePluginHarness();
		const result = harness.runPipeline();
		expect(result).toHaveProperty('cells');
		expect(result).toHaveProperty('layout');
		expect(Array.isArray(result.cells)).toBe(true);
		expect(typeof result.layout).toBe('object');
	});

	it('visibleRows entries are string arrays', () => {
		const harness = makePluginHarness({ rows: 3 });
		for (const row of harness.ctx.visibleRows) {
			expect(Array.isArray(row)).toBe(true);
		}
	});

	it('allRows equals visibleRows by default', () => {
		const harness = makePluginHarness();
		expect(harness.ctx.allRows.length).toBe(harness.ctx.visibleRows.length);
	});

	it('isPluginEnabled delegates to registry', () => {
		const harness = makePluginHarness();
		harness.enable('supersort.header-click');
		expect(harness.ctx.isPluginEnabled('supersort.header-click')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// usePlugin tests
// ---------------------------------------------------------------------------

describe('usePlugin', () => {
	it('enables plugin and returns PluginHook instance', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.grid');
		expect(hook).toBeDefined();
		expect(typeof hook.afterRender).toBe('function');
	});

	it('plugin is enabled after usePlugin call', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supersort.header-click');
		expect(harness.registry.isEnabled('supersort.header-click')).toBe(true);
	});

	it('returned hook has expected PluginHook shape', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.grid');
		// Should be an object (PluginHook interface)
		expect(typeof hook).toBe('object');
		expect(hook).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// mockContainerDimensions tests
// ---------------------------------------------------------------------------

describe('mockContainerDimensions', () => {
	it('sets clientHeight on element', () => {
		const el = document.createElement('div');
		mockContainerDimensions(el, { clientHeight: 600 });
		expect(el.clientHeight).toBe(600);
	});

	it('sets scrollTop on element', () => {
		const el = document.createElement('div');
		mockContainerDimensions(el, { scrollTop: 100 });
		expect(el.scrollTop).toBe(100);
	});

	it('sets clientWidth on element', () => {
		const el = document.createElement('div');
		mockContainerDimensions(el, { clientWidth: 800 });
		expect(el.clientWidth).toBe(800);
	});

	it('sets scrollLeft on element', () => {
		const el = document.createElement('div');
		mockContainerDimensions(el, { scrollLeft: 50 });
		expect(el.scrollLeft).toBe(50);
	});

	it('sets getBoundingClientRect height and width', () => {
		const el = document.createElement('div');
		mockContainerDimensions(el, { clientHeight: 500, clientWidth: 300 });
		const rect = el.getBoundingClientRect();
		expect(rect.height).toBe(500);
		expect(rect.width).toBe(300);
	});

	it('getBoundingClientRect returns correct bottom based on height', () => {
		const el = document.createElement('div');
		mockContainerDimensions(el, { clientHeight: 400, clientWidth: 200 });
		const rect = el.getBoundingClientRect();
		expect(rect.bottom).toBe(400);
		expect(rect.right).toBe(200);
	});

	it('allows re-mocking (configurable: true)', () => {
		const el = document.createElement('div');
		mockContainerDimensions(el, { clientHeight: 300 });
		expect(el.clientHeight).toBe(300);
		mockContainerDimensions(el, { clientHeight: 600 });
		expect(el.clientHeight).toBe(600);
	});
});
