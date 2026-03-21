// @vitest-environment jsdom
// Isometry v5 — Phase 101 Plan 01 Base Plugin Tests
// Behavioral tests for the 3 base plugin factories: base.grid, base.headers, base.config.
//
// Design:
//   - Factory return shape tests (PluginHook interface — typeof checks)
//   - Lifecycle methods callable without throwing (minimal mock context)
//   - Follows SuperSize.test.ts pattern with dynamic import and makeCtx helper
//
// Requirements: BASE-01, BASE-02, BASE-03

import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Shared minimal RenderContext factory
// ---------------------------------------------------------------------------

function makeCtx() {
	return {
		rowDimensions: [],
		colDimensions: [],
		visibleRows: [],
		visibleCols: [],
		data: new Map(),
		rootEl: document.createElement('div'),
		scrollLeft: 0,
		scrollTop: 0,
		isPluginEnabled: (_id: string) => false,
	};
}

// ---------------------------------------------------------------------------
// BaseGrid tests
// ---------------------------------------------------------------------------

describe('BaseGrid', () => {
	it('factory returns PluginHook with afterRender and destroy methods', async () => {
		const { createBaseGridPlugin } = await import(
			'../../../src/views/pivot/plugins/BaseGrid'
		);
		const plugin = createBaseGridPlugin();
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('afterRender is callable without throwing (minimal mock)', async () => {
		const { createBaseGridPlugin } = await import(
			'../../../src/views/pivot/plugins/BaseGrid'
		);
		const plugin = createBaseGridPlugin();
		const root = document.createElement('div');
		const ctx = makeCtx();
		expect(() => plugin.afterRender!(root, ctx)).not.toThrow();
	});

	it('destroy does not throw', async () => {
		const { createBaseGridPlugin } = await import(
			'../../../src/views/pivot/plugins/BaseGrid'
		);
		const plugin = createBaseGridPlugin();
		expect(() => plugin.destroy!()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// BaseHeaders tests
// ---------------------------------------------------------------------------

describe('BaseHeaders', () => {
	it('factory returns PluginHook with afterRender method', async () => {
		const { createBaseHeadersPlugin } = await import(
			'../../../src/views/pivot/plugins/BaseHeaders'
		);
		const plugin = createBaseHeadersPlugin();
		expect(typeof plugin.afterRender).toBe('function');
	});

	it('afterRender is callable without throwing (minimal mock)', async () => {
		const { createBaseHeadersPlugin } = await import(
			'../../../src/views/pivot/plugins/BaseHeaders'
		);
		const plugin = createBaseHeadersPlugin();
		const root = document.createElement('div');
		const ctx = makeCtx();
		expect(() => plugin.afterRender!(root, ctx)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// BaseConfig tests
// ---------------------------------------------------------------------------

describe('BaseConfig', () => {
	it('factory returns PluginHook with afterRender and destroy methods', async () => {
		const { createBaseConfigPlugin } = await import(
			'../../../src/views/pivot/plugins/BaseConfig'
		);
		const plugin = createBaseConfigPlugin();
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('afterRender is callable without throwing (minimal mock)', async () => {
		const { createBaseConfigPlugin } = await import(
			'../../../src/views/pivot/plugins/BaseConfig'
		);
		const plugin = createBaseConfigPlugin();
		const root = document.createElement('div');
		const ctx = makeCtx();
		expect(() => plugin.afterRender!(root, ctx)).not.toThrow();
	});

	it('destroy does not throw', async () => {
		const { createBaseConfigPlugin } = await import(
			'../../../src/views/pivot/plugins/BaseConfig'
		);
		const plugin = createBaseConfigPlugin();
		expect(() => plugin.destroy!()).not.toThrow();
	});
});
