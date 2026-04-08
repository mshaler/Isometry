// @vitest-environment jsdom
// Phase 102 Plan 01 + Phase 105 Plan 02 — SuperDensity Plugin Tests
// Tests for all 3 SuperDensity plugins:
//   - SuperDensityModeSwitch: segmented toolbar, DensityState, CSS class application
//   - SuperDensityMiniCards: compact layout on .pv-data-cell elements
//   - SuperDensityCountBadge: numeric count badge in cells at lowest density
//
// Requirements: DENS-01, DENS-02, DENS-03

import { beforeEach, describe, expect, it } from 'vitest';
import { makePluginHarness } from './helpers/makePluginHarness';
import { usePlugin } from './helpers/usePlugin';

// ---------------------------------------------------------------------------
// DensityState tests
// ---------------------------------------------------------------------------

describe('createDensityState', () => {
	it('returns object with level=normal and empty listeners Set', async () => {
		const { createDensityState } = await import('../../../src/views/pivot/plugins/SuperDensityModeSwitch');
		const state = createDensityState();
		expect(state.level).toBe('normal');
		expect(state.listeners).toBeInstanceOf(Set);
		expect(state.listeners.size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superdensity.mode-switch
// ---------------------------------------------------------------------------

describe('Lifecycle — superdensity.mode-switch', () => {
	it('hook has afterRender and destroy; no transformData or transformLayout', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superdensity.mode-switch');
		expect(typeof hook.afterRender).toBe('function');
		expect(typeof hook.destroy).toBe('function');
		expect(hook.transformData).toBeUndefined();
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender creates .pv-density-toolbar in the DOM', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'superdensity.mode-switch');

		// Add toolbar container that the plugin looks for
		const toolbar = document.createElement('div');
		toolbar.className = 'pv-toolbar';
		harness.ctx.rootEl.appendChild(toolbar);

		harness.runPipeline();
		expect(harness.ctx.rootEl.querySelector('.pv-density-toolbar')).not.toBeNull();
	});

	it('afterRender creates 4 density buttons (Compact, Normal, Comfortable, Spacious)', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'superdensity.mode-switch');

		const toolbar = document.createElement('div');
		toolbar.className = 'pv-toolbar';
		harness.ctx.rootEl.appendChild(toolbar);

		harness.runPipeline();
		const buttons = harness.ctx.rootEl.querySelectorAll('.pv-density-btn');
		expect(buttons.length).toBe(4);
	});

	it('afterRender does not throw without a .pv-toolbar present', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'superdensity.mode-switch');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('destroy removes .pv-density-toolbar from DOM', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superdensity.mode-switch');

		const toolbar = document.createElement('div');
		toolbar.className = 'pv-toolbar';
		harness.ctx.rootEl.appendChild(toolbar);

		harness.runPipeline();
		expect(harness.ctx.rootEl.querySelector('.pv-density-toolbar')).not.toBeNull();
		hook.destroy?.();
		expect(harness.ctx.rootEl.querySelector('.pv-density-toolbar')).toBeNull();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superdensity.mode-switch');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});

	it('afterRender applies pv-density--compact class to root when density is compact', async () => {
		const { createSuperDensityModeSwitchPlugin, createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState();
		densityState.level = 'compact';
		const plugin = createSuperDensityModeSwitchPlugin(densityState);

		const root = document.createElement('div');
		const toolbar = document.createElement('div');
		toolbar.className = 'pv-toolbar';
		root.appendChild(toolbar);

		plugin.afterRender!(root, makeMinimalCtx(root));
		expect(root.classList.contains('pv-density--compact')).toBe(true);
	});

	it('afterRender removes density class from root when density is normal', async () => {
		const { createSuperDensityModeSwitchPlugin, createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState();
		densityState.level = 'compact';
		const plugin = createSuperDensityModeSwitchPlugin(densityState);

		const root = document.createElement('div');
		root.classList.add('pv-density--compact'); // pre-existing class
		const toolbar = document.createElement('div');
		toolbar.className = 'pv-toolbar';
		root.appendChild(toolbar);

		plugin.afterRender!(root, makeMinimalCtx(root));
		expect(root.classList.contains('pv-density--compact')).toBe(true);

		// Switch to normal
		densityState.level = 'normal';
		plugin.afterRender!(root, makeMinimalCtx(root));
		expect(root.classList.contains('pv-density--compact')).toBe(false);
	});

	it('clicking density button changes class on root', async () => {
		const { createSuperDensityModeSwitchPlugin, createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState(); // level = 'normal'
		const plugin = createSuperDensityModeSwitchPlugin(densityState);

		const root = document.createElement('div');
		const toolbar = document.createElement('div');
		toolbar.className = 'pv-toolbar';
		root.appendChild(toolbar);

		plugin.afterRender!(root, makeMinimalCtx(root));
		expect(root.classList.contains('pv-density--compact')).toBe(false);

		// Simulate clicking compact button
		const compactBtn = root.querySelector('[data-density="compact"]') as HTMLButtonElement;
		compactBtn?.click();

		expect(root.classList.contains('pv-density--compact')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superdensity.mini-cards
// ---------------------------------------------------------------------------

describe('Lifecycle — superdensity.mini-cards', () => {
	it('hook has afterRender and destroy; no transformData or transformLayout', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superdensity.mini-cards');
		expect(typeof hook.afterRender).toBe('function');
		expect(typeof hook.destroy).toBe('function');
		expect(hook.transformData).toBeUndefined();
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender adds .pv-cell--mini-card to .pv-data-cell elements when density is compact', async () => {
		const { createSuperDensityMiniCardsPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityMiniCards'
		);
		const { createDensityState } = await import('../../../src/views/pivot/plugins/SuperDensityModeSwitch');
		const densityState = createDensityState();
		densityState.level = 'compact';
		const plugin = createSuperDensityMiniCardsPlugin(densityState);

		const root = makePivotRootWithCells();
		plugin.afterRender!(root, makeMinimalCtx(root));

		const cells = root.querySelectorAll('.pv-data-cell');
		for (const cell of cells) {
			expect(cell.classList.contains('pv-cell--mini-card')).toBe(true);
		}
	});

	it('afterRender does NOT add .pv-cell--mini-card when density is normal', async () => {
		const { createSuperDensityMiniCardsPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityMiniCards'
		);
		const { createDensityState } = await import('../../../src/views/pivot/plugins/SuperDensityModeSwitch');
		const densityState = createDensityState(); // level = 'normal'
		const plugin = createSuperDensityMiniCardsPlugin(densityState);

		const root = makePivotRootWithCells();
		plugin.afterRender!(root, makeMinimalCtx(root));

		const cells = root.querySelectorAll('.pv-data-cell');
		for (const cell of cells) {
			expect(cell.classList.contains('pv-cell--mini-card')).toBe(false);
		}
	});

	it('destroy removes .pv-cell--mini-card from all cells', async () => {
		const { createSuperDensityMiniCardsPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityMiniCards'
		);
		const { createDensityState } = await import('../../../src/views/pivot/plugins/SuperDensityModeSwitch');
		const densityState = createDensityState();
		densityState.level = 'compact';
		const plugin = createSuperDensityMiniCardsPlugin(densityState);

		const root = makePivotRootWithCells();
		plugin.afterRender!(root, makeMinimalCtx(root));

		// Classes added during afterRender
		const cellsBefore = root.querySelectorAll('.pv-data-cell.pv-cell--mini-card');
		expect(cellsBefore.length).toBeGreaterThan(0);

		plugin.destroy!();

		const cellsAfter = root.querySelectorAll('.pv-data-cell.pv-cell--mini-card');
		expect(cellsAfter.length).toBe(0);
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superdensity.mini-cards');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superdensity.count-badge
// ---------------------------------------------------------------------------

describe('Lifecycle — superdensity.count-badge', () => {
	it('hook has afterRender; no transformData, transformLayout (destroy may be undefined)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superdensity.count-badge');
		expect(typeof hook.afterRender).toBe('function');
		expect(hook.transformData).toBeUndefined();
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender adds .pv-count-badge to cells when density is compact', async () => {
		const { createSuperDensityCountBadgePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityCountBadge'
		);
		const { createDensityState } = await import('../../../src/views/pivot/plugins/SuperDensityModeSwitch');
		const densityState = createDensityState();
		densityState.level = 'compact';
		const plugin = createSuperDensityCountBadgePlugin(densityState);

		const root = makePivotRootWithCells(3);
		plugin.afterRender!(root, makeMinimalCtx(root));

		const badges = root.querySelectorAll('.pv-count-badge');
		expect(badges.length).toBeGreaterThan(0);
	});

	it('afterRender does NOT add .pv-count-badge when density is normal', async () => {
		const { createSuperDensityCountBadgePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityCountBadge'
		);
		const { createDensityState } = await import('../../../src/views/pivot/plugins/SuperDensityModeSwitch');
		const densityState = createDensityState(); // level = 'normal'
		const plugin = createSuperDensityCountBadgePlugin(densityState);

		const root = makePivotRootWithCells();
		plugin.afterRender!(root, makeMinimalCtx(root));

		const badges = root.querySelectorAll('.pv-count-badge');
		expect(badges.length).toBe(0);
	});

	it('destroy removes .pv-count-badge from all cells', async () => {
		const { createSuperDensityCountBadgePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityCountBadge'
		);
		const { createDensityState } = await import('../../../src/views/pivot/plugins/SuperDensityModeSwitch');
		const densityState = createDensityState();
		densityState.level = 'compact';
		const plugin = createSuperDensityCountBadgePlugin(densityState);

		const root = makePivotRootWithCells();
		plugin.afterRender!(root, makeMinimalCtx(root));

		plugin.destroy?.();

		const badges = root.querySelectorAll('.pv-count-badge');
		expect(badges.length).toBe(0);
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superdensity.count-badge');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Shared test helpers (used by direct plugin factory tests above)
// ---------------------------------------------------------------------------

function makeMinimalCtx(root: HTMLElement) {
	return {
		rowDimensions: [],
		colDimensions: [],
		visibleRows: [],
		allRows: [],
		visibleCols: [],
		data: new Map(),
		cells: [],
		rootEl: root,
		scrollLeft: 0,
		scrollTop: 0,
		isPluginEnabled: (_id: string) => false,
	};
}

/** Create a minimal pivot root with toolbar and grid wrapper. */
function makePivotRoot(): HTMLElement {
	const root = document.createElement('div');
	root.className = 'pv-root';

	const toolbar = document.createElement('div');
	toolbar.className = 'pv-toolbar';
	root.appendChild(toolbar);

	const wrapper = document.createElement('div');
	wrapper.className = 'pv-grid-wrapper';
	root.appendChild(wrapper);

	return root;
}

/** Create a pivot root with some .pv-data-cell elements in the wrapper. */
function makePivotRootWithCells(childCount = 2): HTMLElement {
	const root = makePivotRoot();
	const wrapper = root.querySelector('.pv-grid-wrapper')!;

	for (let i = 0; i < 3; i++) {
		const cell = document.createElement('div');
		cell.className = 'pv-data-cell';
		// Add some children to count
		for (let j = 0; j < childCount; j++) {
			const child = document.createElement('span');
			child.textContent = `item-${j}`;
			cell.appendChild(child);
		}
		wrapper.appendChild(cell);
	}

	return root;
}
