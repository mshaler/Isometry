// @vitest-environment jsdom
// Isometry v5 — Phase 102 Plan 01 SuperDensity Tests
// Behavioral tests for all 3 SuperDensity plugins:
//   - SuperDensityModeSwitch: segmented toolbar, DensityState, CSS class application
//   - SuperDensityMiniCards: compact layout on .pv-data-cell elements
//   - SuperDensityCountBadge: numeric count badge in cells at lowest density
//
// Requirements: DENS-01, DENS-02, DENS-03

import { beforeEach, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// DensityState tests
// ---------------------------------------------------------------------------

describe('createDensityState', () => {
	it('returns object with level=normal and empty listeners Set', async () => {
		const { createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const state = createDensityState();
		expect(state.level).toBe('normal');
		expect(state.listeners).toBeInstanceOf(Set);
		expect(state.listeners.size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// SuperDensityModeSwitch tests
// ---------------------------------------------------------------------------

describe('SuperDensityModeSwitch', () => {
	it('factory returns PluginHook with afterRender and destroy', async () => {
		const { createSuperDensityModeSwitchPlugin, createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const plugin = createSuperDensityModeSwitchPlugin(createDensityState());
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('afterRender creates .pv-density-toolbar with 4 buttons', async () => {
		const { createSuperDensityModeSwitchPlugin, createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState();
		const plugin = createSuperDensityModeSwitchPlugin(densityState);

		const root = makePivotRoot();
		const ctx = makeCtx(root);
		plugin.afterRender!(root, ctx);

		const toolbar = root.querySelector('.pv-density-toolbar');
		expect(toolbar).not.toBeNull();

		const buttons = toolbar!.querySelectorAll('.pv-density-btn');
		expect(buttons).toHaveLength(4);

		// Verify button labels
		const labels = Array.from(buttons).map((b) => b.textContent);
		expect(labels).toContain('Compact');
		expect(labels).toContain('Normal');
		expect(labels).toContain('Comfortable');
		expect(labels).toContain('Spacious');
	});

	it('clicking a density button updates DensityState.level', async () => {
		const { createSuperDensityModeSwitchPlugin, createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState();
		const plugin = createSuperDensityModeSwitchPlugin(densityState);

		const root = makePivotRoot();
		const ctx = makeCtx(root);
		plugin.afterRender!(root, ctx);

		const buttons = root.querySelectorAll('.pv-density-btn');
		const compactBtn = Array.from(buttons).find((b) => b.textContent === 'Compact') as HTMLButtonElement;
		compactBtn.click();

		expect(densityState.level).toBe('compact');
	});

	it('clicking density button notifies registered listeners', async () => {
		const { createSuperDensityModeSwitchPlugin, createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState();
		const plugin = createSuperDensityModeSwitchPlugin(densityState);

		const root = makePivotRoot();
		const ctx = makeCtx(root);
		plugin.afterRender!(root, ctx);

		let receivedLevel = '';
		densityState.listeners.add((level) => {
			receivedLevel = level;
		});

		const buttons = root.querySelectorAll('.pv-density-btn');
		const spaciousBtn = Array.from(buttons).find((b) => b.textContent === 'Spacious') as HTMLButtonElement;
		spaciousBtn.click();

		expect(receivedLevel).toBe('spacious');
	});

	it('afterRender applies .pv-density-- class to .pv-grid-wrapper (skips normal)', async () => {
		const { createSuperDensityModeSwitchPlugin, createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState();
		const plugin = createSuperDensityModeSwitchPlugin(densityState);

		const root = makePivotRoot();
		const ctx = makeCtx(root);
		plugin.afterRender!(root, ctx);

		// Click compact
		const buttons = root.querySelectorAll('.pv-density-btn');
		const compactBtn = Array.from(buttons).find((b) => b.textContent === 'Compact') as HTMLButtonElement;
		compactBtn.click();

		const wrapper = root.querySelector('.pv-grid-wrapper');
		expect(wrapper!.classList.contains('pv-density--compact')).toBe(true);
		expect(wrapper!.classList.contains('pv-density--normal')).toBe(false);

		// Click normal — class should be removed
		const normalBtn = Array.from(buttons).find((b) => b.textContent === 'Normal') as HTMLButtonElement;
		normalBtn.click();

		expect(wrapper!.classList.contains('pv-density--compact')).toBe(false);
		expect(wrapper!.classList.contains('pv-density--normal')).toBe(false);
	});

	it('destroy removes .pv-density-toolbar from DOM', async () => {
		const { createSuperDensityModeSwitchPlugin, createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState();
		const plugin = createSuperDensityModeSwitchPlugin(densityState);

		const root = makePivotRoot();
		const ctx = makeCtx(root);
		plugin.afterRender!(root, ctx);

		expect(root.querySelector('.pv-density-toolbar')).not.toBeNull();

		plugin.destroy!();

		expect(root.querySelector('.pv-density-toolbar')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// SuperDensityMiniCards tests
// ---------------------------------------------------------------------------

describe('SuperDensityMiniCards', () => {
	it('factory returns PluginHook with afterRender and destroy', async () => {
		const { createSuperDensityMiniCardsPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityMiniCards'
		);
		const { createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const plugin = createSuperDensityMiniCardsPlugin(createDensityState());
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('afterRender adds .pv-cell--mini-card to .pv-data-cell elements when density is compact', async () => {
		const { createSuperDensityMiniCardsPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityMiniCards'
		);
		const { createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState();
		densityState.level = 'compact';
		const plugin = createSuperDensityMiniCardsPlugin(densityState);

		const root = makePivotRootWithCells();
		const ctx = makeCtx(root);
		plugin.afterRender!(root, ctx);

		const cells = root.querySelectorAll('.pv-data-cell');
		for (const cell of cells) {
			expect(cell.classList.contains('pv-cell--mini-card')).toBe(true);
		}
	});

	it('afterRender does NOT add .pv-cell--mini-card when density is normal', async () => {
		const { createSuperDensityMiniCardsPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityMiniCards'
		);
		const { createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState(); // level = 'normal'
		const plugin = createSuperDensityMiniCardsPlugin(densityState);

		const root = makePivotRootWithCells();
		const ctx = makeCtx(root);
		plugin.afterRender!(root, ctx);

		const cells = root.querySelectorAll('.pv-data-cell');
		for (const cell of cells) {
			expect(cell.classList.contains('pv-cell--mini-card')).toBe(false);
		}
	});

	it('destroy removes .pv-cell--mini-card from all cells', async () => {
		const { createSuperDensityMiniCardsPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityMiniCards'
		);
		const { createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState();
		densityState.level = 'compact';
		const plugin = createSuperDensityMiniCardsPlugin(densityState);

		const root = makePivotRootWithCells();
		const ctx = makeCtx(root);
		plugin.afterRender!(root, ctx);

		// Classes added during afterRender
		const cellsBefore = root.querySelectorAll('.pv-data-cell.pv-cell--mini-card');
		expect(cellsBefore.length).toBeGreaterThan(0);

		plugin.destroy!();

		const cellsAfter = root.querySelectorAll('.pv-data-cell.pv-cell--mini-card');
		expect(cellsAfter.length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// SuperDensityCountBadge tests
// ---------------------------------------------------------------------------

describe('SuperDensityCountBadge', () => {
	it('factory returns PluginHook with afterRender and destroy', async () => {
		const { createSuperDensityCountBadgePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityCountBadge'
		);
		const { createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const plugin = createSuperDensityCountBadgePlugin(createDensityState());
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('afterRender adds .pv-count-badge class to cells when density is compact', async () => {
		const { createSuperDensityCountBadgePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityCountBadge'
		);
		const { createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState();
		densityState.level = 'compact';
		const plugin = createSuperDensityCountBadgePlugin(densityState);

		const root = makePivotRootWithCells(3);
		const ctx = makeCtx(root);
		plugin.afterRender!(root, ctx);

		const badges = root.querySelectorAll('.pv-count-badge');
		expect(badges.length).toBeGreaterThan(0);
	});

	it('afterRender does NOT add .pv-count-badge when density is normal', async () => {
		const { createSuperDensityCountBadgePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityCountBadge'
		);
		const { createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState(); // level = 'normal'
		const plugin = createSuperDensityCountBadgePlugin(densityState);

		const root = makePivotRootWithCells();
		const ctx = makeCtx(root);
		plugin.afterRender!(root, ctx);

		const badges = root.querySelectorAll('.pv-count-badge');
		expect(badges.length).toBe(0);
	});

	it('destroy removes .pv-count-badge from all cells', async () => {
		const { createSuperDensityCountBadgePlugin } = await import(
			'../../../src/views/pivot/plugins/SuperDensityCountBadge'
		);
		const { createDensityState } = await import(
			'../../../src/views/pivot/plugins/SuperDensityModeSwitch'
		);
		const densityState = createDensityState();
		densityState.level = 'compact';
		const plugin = createSuperDensityCountBadgePlugin(densityState);

		const root = makePivotRootWithCells();
		const ctx = makeCtx(root);
		plugin.afterRender!(root, ctx);

		plugin.destroy!();

		const badges = root.querySelectorAll('.pv-count-badge');
		expect(badges.length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

function makeCtx(root: HTMLElement) {
	return {
		rowDimensions: [],
		colDimensions: [],
		visibleRows: [],
		allRows: [],
		visibleCols: [],
		data: new Map(),
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
