// @vitest-environment jsdom
// Isometry v5 — Phase 101 Plan 01 Base Plugin Tests
// Behavioral tests for the 3 base plugin factories: base.grid, base.headers, base.config.
//
// Design:
//   - Factory return shape tests (PluginHook interface — typeof checks)
//   - Lifecycle methods callable without throwing (minimal mock context)
//   - Phase 105: Lifecycle describe blocks using makePluginHarness/usePlugin
//
// Requirements: BASE-01, BASE-02, BASE-03

import { describe, expect, it, vi } from 'vitest';
import { makePluginHarness } from './helpers/makePluginHarness';
import { usePlugin } from './helpers/usePlugin';

// ---------------------------------------------------------------------------
// BaseGrid tests
// ---------------------------------------------------------------------------

describe('BaseGrid', () => {
	it('factory returns PluginHook with afterRender and destroy methods', async () => {
		const { createBaseGridPlugin } = await import('../../../src/views/pivot/plugins/BaseGrid');
		const plugin = createBaseGridPlugin();
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});
});

describe('Lifecycle — base.grid', () => {
	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.grid');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook destroy is a function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.grid');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook transformData is undefined (base.grid does not filter cells)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.grid');
		expect(hook.transformData).toBeUndefined();
	});

	it('hook transformLayout is undefined (base.grid does not mutate layout)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.grid');
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender runs without throwing via pipeline', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'base.grid');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.grid');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.grid');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('no event listeners added (render-only plugin)', () => {
		const harness = makePluginHarness();
		const addSpy = vi.spyOn(harness.ctx.rootEl, 'addEventListener');
		usePlugin(harness, 'base.grid');
		harness.runPipeline();
		expect(addSpy).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// BaseHeaders tests
// ---------------------------------------------------------------------------

describe('BaseHeaders', () => {
	it('factory returns PluginHook with afterRender method', async () => {
		const { createBaseHeadersPlugin } = await import('../../../src/views/pivot/plugins/BaseHeaders');
		const plugin = createBaseHeadersPlugin();
		expect(typeof plugin.afterRender).toBe('function');
	});
});

describe('Lifecycle — base.headers', () => {
	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.headers');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook destroy is undefined (base.headers has no cleanup)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.headers');
		expect(hook.destroy).toBeUndefined();
	});

	it('hook transformData is undefined', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.headers');
		expect(hook.transformData).toBeUndefined();
	});

	it('hook transformLayout is undefined', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.headers');
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender runs without throwing via pipeline', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'base.headers');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('no event listeners added (render-only plugin)', () => {
		const harness = makePluginHarness();
		const addSpy = vi.spyOn(harness.ctx.rootEl, 'addEventListener');
		usePlugin(harness, 'base.headers');
		harness.runPipeline();
		expect(addSpy).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// BaseConfig tests
// ---------------------------------------------------------------------------

describe('BaseConfig', () => {
	it('factory returns PluginHook with afterRender and destroy methods', async () => {
		const { createBaseConfigPlugin } = await import('../../../src/views/pivot/plugins/BaseConfig');
		const plugin = createBaseConfigPlugin();
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});
});

describe('Lifecycle — base.config', () => {
	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.config');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook destroy is a function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.config');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook transformData is undefined', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.config');
		expect(hook.transformData).toBeUndefined();
	});

	it('hook transformLayout is undefined', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.config');
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender runs without throwing via pipeline', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'base.config');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.config');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'base.config');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('no event listeners added (render-only plugin)', () => {
		const harness = makePluginHarness();
		const addSpy = vi.spyOn(harness.ctx.rootEl, 'addEventListener');
		usePlugin(harness, 'base.config');
		harness.runPipeline();
		expect(addSpy).not.toHaveBeenCalled();
	});
});
