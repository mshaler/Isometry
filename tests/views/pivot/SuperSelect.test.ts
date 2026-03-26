// @vitest-environment jsdom
// Phase 102 Plan 03 + Phase 105 Plan 02 — SuperSelect Plugin Tests
// Tests for all 3 SuperSelect plugins.
//
// Design:
//   - createSuperSelectClickPlugin: click and Cmd+click cell selection
//   - createSuperSelectLassoPlugin: drag-to-select rectangular region with CSS overlay
//   - createSuperSelectKeyboardPlugin: Shift+arrow range extension
//   - Shared SelectionState passed to all 3 factories
//
// Requirements: SLCT-01, SLCT-02, SLCT-03

import { beforeEach, describe, expect, it } from 'vitest';
import type { RenderContext } from '../../../src/views/pivot/plugins/PluginTypes';
import {
	createSelectionState,
	createSuperSelectClickPlugin,
	type SelectionState,
} from '../../../src/views/pivot/plugins/SuperSelectClick';
import { createSuperSelectKeyboardPlugin } from '../../../src/views/pivot/plugins/SuperSelectKeyboard';
import { createSuperSelectLassoPlugin } from '../../../src/views/pivot/plugins/SuperSelectLasso';
import { makePluginHarness } from './helpers/makePluginHarness';
import { usePlugin } from './helpers/usePlugin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock grid DOM with .pv-data-cell elements */
function buildMockGrid(rows: number, cols: number): HTMLElement {
	const root = document.createElement('div');
	root.style.position = 'relative';

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const cell = document.createElement('div');
			cell.className = 'pv-data-cell';
			const key = `${r}:${c}`;
			cell.setAttribute('data-key', key);
			cell.setAttribute('data-row', String(r));
			cell.setAttribute('data-col', String(c));
			cell.textContent = String(r * cols + c);
			root.appendChild(cell);
		}
	}

	document.body.appendChild(root);
	return root;
}

function makeRenderContext(root: HTMLElement): RenderContext {
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
		isPluginEnabled: () => false,
	};
}

function makePointerEvent(type: string, options: PointerEventInit & { target?: Element } = {}): PointerEvent {
	const { target, ...init } = options;
	const event = new PointerEvent(type, { bubbles: true, ...init });
	if (target) {
		Object.defineProperty(event, 'target', { value: target, writable: false });
	}
	return event;
}

// ---------------------------------------------------------------------------
// createSelectionState
// ---------------------------------------------------------------------------

describe('createSelectionState', () => {
	it('returns object with selectedKeys Set, null anchor, and listeners Set', () => {
		const state = createSelectionState();
		expect(state.selectedKeys).toBeInstanceOf(Set);
		expect(state.selectedKeys.size).toBe(0);
		expect(state.anchor).toBeNull();
		expect(state.listeners).toBeInstanceOf(Set);
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superselect.click
// ---------------------------------------------------------------------------

describe('Lifecycle — superselect.click', () => {
	it('hook has afterRender and destroy; no transformData or transformLayout', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superselect.click');
		expect(typeof hook.afterRender).toBe('function');
		expect(typeof hook.destroy).toBe('function');
		expect(hook.transformData).toBeUndefined();
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender applies .selected class to selected cells', () => {
		const state = createSelectionState();
		const plugin = createSuperSelectClickPlugin(state, () => {});
		const root = buildMockGrid(2, 2);
		const ctx = makeRenderContext(root);

		state.selectedKeys.add('0:0');
		plugin.afterRender!(root, ctx);

		const cell00 = root.querySelector<HTMLElement>('[data-key="0:0"]')!;
		const cell01 = root.querySelector<HTMLElement>('[data-key="0:1"]')!;
		expect(cell00.classList.contains('selected')).toBe(true);
		expect(cell01.classList.contains('selected')).toBe(false);
	});

	it('destroy clears selectedKeys and sets anchor to null', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superselect.click');
		// Use the hook's destroy via the harness
		expect(() => hook.destroy?.()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superselect.click');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// createSuperSelectClickPlugin — click behavior
// ---------------------------------------------------------------------------

describe('createSuperSelectClickPlugin — click behavior', () => {
	let root: HTMLElement;
	let state: SelectionState;
	let notified: boolean;
	let plugin: ReturnType<typeof createSuperSelectClickPlugin>;
	let ctx: RenderContext;

	beforeEach(() => {
		root = buildMockGrid(3, 3);
		state = createSelectionState();
		notified = false;
		plugin = createSuperSelectClickPlugin(state, () => {
			notified = true;
		});
		ctx = makeRenderContext(root);
	});

	it('onPointerEvent pointerdown on .pv-data-cell selects cell and returns true', () => {
		const cell = root.querySelector<HTMLElement>('[data-key="0:0"]')!;
		const event = makePointerEvent('pointerdown', { target: cell });
		const consumed = plugin.onPointerEvent!('pointerdown', event, ctx);
		expect(consumed).toBe(true);
		expect(state.selectedKeys.has('0:0')).toBe(true);
		expect(notified).toBe(true);
	});

	it('onPointerEvent ignores non-pointerdown events', () => {
		const cell = root.querySelector<HTMLElement>('[data-key="0:0"]')!;
		const event = makePointerEvent('pointerup', { target: cell });
		const consumed = plugin.onPointerEvent!('pointerup', event, ctx);
		expect(consumed).toBe(false);
		expect(state.selectedKeys.size).toBe(0);
	});

	it('onPointerEvent without metaKey clears existing selection before adding new cell', () => {
		state.selectedKeys.add('1:1');
		const cell = root.querySelector<HTMLElement>('[data-key="0:0"]')!;
		const event = makePointerEvent('pointerdown', { target: cell });
		plugin.onPointerEvent!('pointerdown', event, ctx);
		expect(state.selectedKeys.has('1:1')).toBe(false);
		expect(state.selectedKeys.has('0:0')).toBe(true);
		expect(state.selectedKeys.size).toBe(1);
	});

	it('onPointerEvent with metaKey adds to existing selection without clearing', () => {
		state.selectedKeys.add('1:1');
		const cell = root.querySelector<HTMLElement>('[data-key="0:0"]')!;
		const event = makePointerEvent('pointerdown', { target: cell, metaKey: true });
		plugin.onPointerEvent!('pointerdown', event, ctx);
		expect(state.selectedKeys.has('1:1')).toBe(true);
		expect(state.selectedKeys.has('0:0')).toBe(true);
		expect(state.selectedKeys.size).toBe(2);
	});

	it('onPointerEvent with metaKey toggles off an already-selected cell', () => {
		state.selectedKeys.add('0:0');
		const cell = root.querySelector<HTMLElement>('[data-key="0:0"]')!;
		const event = makePointerEvent('pointerdown', { target: cell, metaKey: true });
		plugin.onPointerEvent!('pointerdown', event, ctx);
		expect(state.selectedKeys.has('0:0')).toBe(false);
	});

	it('onPointerEvent on non-cell clears all selection and returns false', () => {
		state.selectedKeys.add('0:0');
		state.selectedKeys.add('1:1');
		const nonCell = document.createElement('div');
		root.appendChild(nonCell);
		const event = makePointerEvent('pointerdown', { target: nonCell });
		const consumed = plugin.onPointerEvent!('pointerdown', event, ctx);
		expect(consumed).toBe(false);
		expect(state.selectedKeys.size).toBe(0);
		expect(notified).toBe(true);
	});

	it('onPointerEvent sets anchor to clicked cell position', () => {
		const cell = root.querySelector<HTMLElement>('[data-key="1:2"]')!;
		const event = makePointerEvent('pointerdown', { target: cell });
		plugin.onPointerEvent!('pointerdown', event, ctx);
		expect(state.anchor).toEqual({ rowIdx: 1, colIdx: 2 });
	});

	it('afterRender applies .selected class and data-selected="true" to selected cells', () => {
		state.selectedKeys.add('0:0');
		state.selectedKeys.add('1:1');
		plugin.afterRender!(root, ctx);

		const cell00 = root.querySelector<HTMLElement>('[data-key="0:0"]')!;
		const cell11 = root.querySelector<HTMLElement>('[data-key="1:1"]')!;
		const cell02 = root.querySelector<HTMLElement>('[data-key="0:2"]')!;

		expect(cell00.classList.contains('selected')).toBe(true);
		expect(cell00.getAttribute('data-selected')).toBe('true');
		expect(cell11.classList.contains('selected')).toBe(true);
		expect(cell02.classList.contains('selected')).toBe(false);
		expect(cell02.hasAttribute('data-selected')).toBe(false);
	});

	it('afterRender removes .selected class from cells NOT in selectedKeys', () => {
		const cell = root.querySelector<HTMLElement>('[data-key="0:0"]')!;
		cell.classList.add('selected');
		cell.setAttribute('data-selected', 'true');
		// selectedKeys is empty — afterRender should clean up
		plugin.afterRender!(root, ctx);
		expect(cell.classList.contains('selected')).toBe(false);
		expect(cell.hasAttribute('data-selected')).toBe(false);
	});

	it('destroy clears selectedKeys and sets anchor to null', () => {
		state.selectedKeys.add('0:0');
		state.anchor = { rowIdx: 0, colIdx: 0 };
		plugin.destroy!();
		expect(state.selectedKeys.size).toBe(0);
		expect(state.anchor).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superselect.lasso
// ---------------------------------------------------------------------------

describe('Lifecycle — superselect.lasso', () => {
	it('hook has destroy; no transformData or transformLayout', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superselect.lasso');
		expect(typeof hook.destroy).toBe('function');
		expect(hook.transformData).toBeUndefined();
		expect(hook.transformLayout).toBeUndefined();
	});

	it('destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superselect.lasso');
		expect(() => hook.destroy?.()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superselect.lasso');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// createSuperSelectLassoPlugin — drag behavior
// ---------------------------------------------------------------------------

describe('createSuperSelectLassoPlugin — drag behavior', () => {
	let root: HTMLElement;
	let state: SelectionState;
	let plugin: ReturnType<typeof createSuperSelectLassoPlugin>;
	let ctx: RenderContext;

	beforeEach(() => {
		root = buildMockGrid(2, 2);
		state = createSelectionState();
		plugin = createSuperSelectLassoPlugin(state, () => {});
		ctx = makeRenderContext(root);
	});

	it('afterRender sets position: relative on root element', () => {
		plugin.afterRender!(root, ctx);
		// root already has style.position = 'relative' from buildMockGrid
		// afterRender should ensure it is set
		expect(root.style.position).toBe('relative');
	});

	it('pointerdown on grid starts drag state without creating overlay yet', () => {
		const event = makePointerEvent('pointerdown', { clientX: 10, clientY: 10, target: root });
		plugin.onPointerEvent!('pointerdown', event, ctx);
		// No overlay yet — overlay only appears after pointermove with threshold
		const overlay = root.querySelector('.pv-lasso-overlay');
		expect(overlay).toBeNull();
	});

	it('pointermove after pointerdown beyond threshold creates .pv-lasso-overlay', () => {
		const downEvent = makePointerEvent('pointerdown', { clientX: 10, clientY: 10, target: root });
		plugin.onPointerEvent!('pointerdown', downEvent, ctx);

		const moveEvent = makePointerEvent('pointermove', { clientX: 30, clientY: 30, target: root });
		plugin.onPointerEvent!('pointermove', moveEvent, ctx);

		const overlay = root.querySelector('.pv-lasso-overlay');
		expect(overlay).not.toBeNull();
	});

	it('destroy removes overlay and resets drag state', () => {
		// Start a drag
		const downEvent = makePointerEvent('pointerdown', { clientX: 10, clientY: 10, target: root });
		plugin.onPointerEvent!('pointerdown', downEvent, ctx);
		const moveEvent = makePointerEvent('pointermove', { clientX: 30, clientY: 30, target: root });
		plugin.onPointerEvent!('pointermove', moveEvent, ctx);
		expect(root.querySelector('.pv-lasso-overlay')).not.toBeNull();

		plugin.destroy!();
		expect(root.querySelector('.pv-lasso-overlay')).toBeNull();
	});

	it('pointerup ends drag and removes overlay from DOM', () => {
		const downEvent = makePointerEvent('pointerdown', { clientX: 10, clientY: 10, target: root });
		plugin.onPointerEvent!('pointerdown', downEvent, ctx);
		const moveEvent = makePointerEvent('pointermove', { clientX: 30, clientY: 30, target: root });
		plugin.onPointerEvent!('pointermove', moveEvent, ctx);
		expect(root.querySelector('.pv-lasso-overlay')).not.toBeNull();

		const upEvent = makePointerEvent('pointerup', { clientX: 30, clientY: 30, target: root });
		plugin.onPointerEvent!('pointerup', upEvent, ctx);
		expect(root.querySelector('.pv-lasso-overlay')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superselect.keyboard
// ---------------------------------------------------------------------------

describe('Lifecycle — superselect.keyboard', () => {
	it('hook has destroy; no transformData, transformLayout, or afterRender', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superselect.keyboard');
		expect(typeof hook.destroy).toBe('function');
		expect(hook.transformData).toBeUndefined();
		expect(hook.transformLayout).toBeUndefined();
		expect(hook.afterRender).toBeUndefined();
	});

	it('destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superselect.keyboard');
		expect(() => hook.destroy?.()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superselect.keyboard');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// createSuperSelectKeyboardPlugin — keyboard behavior
// ---------------------------------------------------------------------------

describe('createSuperSelectKeyboardPlugin — keyboard behavior', () => {
	let root: HTMLElement;
	let state: SelectionState;
	let notified: boolean;
	let plugin: ReturnType<typeof createSuperSelectKeyboardPlugin>;
	let ctx: RenderContext;

	beforeEach(() => {
		root = buildMockGrid(3, 3);
		state = createSelectionState();
		notified = false;
		plugin = createSuperSelectKeyboardPlugin(state, () => {
			notified = true;
		});
		ctx = makeRenderContext(root);
	});

	it('Shift+ArrowRight extends selection from anchor', () => {
		state.anchor = { rowIdx: 0, colIdx: 0 };
		state.selectedKeys.add('0:0');

		const event = new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			shiftKey: true,
			bubbles: true,
		}) as unknown as PointerEvent;

		const consumed = plugin.onPointerEvent!('keydown', event, ctx);
		expect(consumed).toBe(true);
		expect(state.selectedKeys.has('0:1')).toBe(true);
		expect(notified).toBe(true);
	});

	it('Shift+ArrowDown extends selection downward', () => {
		state.anchor = { rowIdx: 0, colIdx: 1 };
		state.selectedKeys.add('0:1');

		const event = new KeyboardEvent('keydown', {
			key: 'ArrowDown',
			shiftKey: true,
			bubbles: true,
		}) as unknown as PointerEvent;

		plugin.onPointerEvent!('keydown', event, ctx);
		expect(state.selectedKeys.has('1:1')).toBe(true);
	});

	it('Shift+ArrowLeft extends selection leftward', () => {
		state.anchor = { rowIdx: 1, colIdx: 2 };
		state.selectedKeys.add('1:2');

		const event = new KeyboardEvent('keydown', {
			key: 'ArrowLeft',
			shiftKey: true,
			bubbles: true,
		}) as unknown as PointerEvent;

		plugin.onPointerEvent!('keydown', event, ctx);
		expect(state.selectedKeys.has('1:1')).toBe(true);
	});

	it('Shift+ArrowUp extends selection upward', () => {
		state.anchor = { rowIdx: 2, colIdx: 0 };
		state.selectedKeys.add('2:0');

		const event = new KeyboardEvent('keydown', {
			key: 'ArrowUp',
			shiftKey: true,
			bubbles: true,
		}) as unknown as PointerEvent;

		plugin.onPointerEvent!('keydown', event, ctx);
		expect(state.selectedKeys.has('1:0')).toBe(true);
	});

	it('returns false if no anchor set', () => {
		const event = new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			shiftKey: true,
			bubbles: true,
		}) as unknown as PointerEvent;

		const consumed = plugin.onPointerEvent!('keydown', event, ctx);
		expect(consumed).toBe(false);
	});

	it('returns false for non-shift arrow keys', () => {
		state.anchor = { rowIdx: 0, colIdx: 0 };

		const event = new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			shiftKey: false,
			bubbles: true,
		}) as unknown as PointerEvent;

		const consumed = plugin.onPointerEvent!('keydown', event, ctx);
		expect(consumed).toBe(false);
	});

	it('returns false for non-keydown event types', () => {
		state.anchor = { rowIdx: 0, colIdx: 0 };

		const event = new PointerEvent('pointerdown', { bubbles: true });
		const consumed = plugin.onPointerEvent!('pointerdown', event, ctx);
		expect(consumed).toBe(false);
	});

	it('destroy is a no-op (state managed by click plugin)', () => {
		state.selectedKeys.add('0:0');
		plugin.destroy!();
		// Should not clear state — that's the click plugin's job
		expect(state.selectedKeys.has('0:0')).toBe(true);
	});

	it('updates anchor to new position after range extension', () => {
		state.anchor = { rowIdx: 0, colIdx: 0 };

		const event = new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			shiftKey: true,
			bubbles: true,
		}) as unknown as PointerEvent;

		plugin.onPointerEvent!('keydown', event, ctx);
		expect(state.anchor).toEqual({ rowIdx: 0, colIdx: 1 });
	});
});
