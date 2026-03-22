// @vitest-environment jsdom
// Isometry v5 — Phase 99 Plan 02 SuperStackCollapse Tests
// Tests for the superstack.collapse plugin behavior.
//
// Phase 105: Lifecycle describe blocks using makePluginHarness/usePlugin
//
// Requirements: SSP-07, SSP-08, SSP-09

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	createSuperStackCollapsePlugin,
	type SuperStackState,
} from '../../../src/views/pivot/plugins/SuperStackCollapse';
import { makePluginHarness } from './helpers/makePluginHarness';
import { usePlugin } from './helpers/usePlugin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(keys: string[] = []): SuperStackState {
	return { collapsedSet: new Set(keys) };
}

function makePointerEvent(target: HTMLElement): PointerEvent {
	const e = new PointerEvent('pointerdown', { bubbles: true });
	Object.defineProperty(e, 'target', { value: target });
	return e;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSuperStackCollapsePlugin', () => {
	it('factory returns a PluginHook with afterRender and onPointerEvent and destroy', () => {
		const state = makeState();
		const plugin = createSuperStackCollapsePlugin(state, () => {});
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.onPointerEvent).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	describe('collapsedSet toggle behavior', () => {
		it('starts with the shared state collapsedSet (initially empty)', () => {
			const state = makeState();
			createSuperStackCollapsePlugin(state, () => {});
			expect(state.collapsedSet.size).toBe(0);
		});

		it('toggling a key adds it to collapsedSet via onPointerEvent click', () => {
			const state = makeState();
			const rerender = vi.fn();
			const plugin = createSuperStackCollapsePlugin(state, rerender);
			const ctx = {
				rowDimensions: [],
				colDimensions: [],
				visibleRows: [],
				allRows: [],
				visibleCols: [],
				data: new Map<string, number | null>(),
				rootEl: document.createElement('div'),
				scrollLeft: 0,
				scrollTop: 0,
				isPluginEnabled: () => false,
			};

			// Create a collapsible header element
			const root = document.createElement('div');
			const header = document.createElement('div');
			header.className = 'pv-col-span pv-col-span--collapsible';
			const key = '0\x1f\x1f2024';
			header.setAttribute('data-collapse-key', key);
			root.appendChild(header);

			const e = makePointerEvent(header);
			const consumed = plugin.onPointerEvent!('pointerdown', e, ctx);

			expect(consumed).toBe(true);
			expect(state.collapsedSet.has(key)).toBe(true);
			expect(rerender).toHaveBeenCalledTimes(1);
		});

		it('toggling an already-collapsed key removes it from collapsedSet', () => {
			const key = '0\x1f\x1f2024';
			const state = makeState([key]);
			const rerender = vi.fn();
			const plugin = createSuperStackCollapsePlugin(state, rerender);
			const ctx = {
				rowDimensions: [],
				colDimensions: [],
				visibleRows: [],
				allRows: [],
				visibleCols: [],
				data: new Map<string, number | null>(),
				rootEl: document.createElement('div'),
				scrollLeft: 0,
				scrollTop: 0,
				isPluginEnabled: () => false,
			};

			const header = document.createElement('div');
			header.className = 'pv-col-span pv-col-span--collapsible';
			header.setAttribute('data-collapse-key', key);

			const e = makePointerEvent(header);
			const consumed = plugin.onPointerEvent!('pointerdown', e, ctx);

			expect(consumed).toBe(true);
			expect(state.collapsedSet.has(key)).toBe(false);
			expect(rerender).toHaveBeenCalledTimes(1);
		});
	});

	describe('collapse key format', () => {
		it('level=0, parentPath="", value="2024" => "0\\x1f\\x1f2024"', () => {
			// Key is: `${level}\x1f${parentPath}\x1f${value}`
			const key = `0\x1f\x1f2024`;
			expect(key).toBe('0\x1f\x1f2024');
			// Validate the \x1f separator encoding
			expect(key.charCodeAt(1)).toBe(31); // Unit Separator
			expect(key.charCodeAt(2)).toBe(31); // second \x1f (empty parentPath)
		});

		it('level=1, parentPath="2024", value="Jan" => "1\\x1f2024\\x1fJan"', () => {
			const key = `1\x1f2024\x1fJan`;
			expect(key).toBe('1\x1f2024\x1fJan');
			expect(key.charCodeAt(1)).toBe(31);
			expect(key.split('\x1f')).toEqual(['1', '2024', 'Jan']);
		});
	});

	describe('onPointerEvent', () => {
		it('returns false for non-header targets (no data-collapse-key)', () => {
			const state = makeState();
			const plugin = createSuperStackCollapsePlugin(state, () => {});
			const ctx = {
				rowDimensions: [],
				colDimensions: [],
				visibleRows: [],
				allRows: [],
				visibleCols: [],
				data: new Map<string, number | null>(),
				rootEl: document.createElement('div'),
				scrollLeft: 0,
				scrollTop: 0,
				isPluginEnabled: () => false,
			};

			// Regular div without collapse class or data-collapse-key
			const el = document.createElement('div');
			el.className = 'pv-data-cell';
			const e = makePointerEvent(el);
			const consumed = plugin.onPointerEvent!('pointerdown', e, ctx);
			expect(consumed).toBe(false);
		});

		it('returns false for non-pointerdown event types', () => {
			const state = makeState();
			const plugin = createSuperStackCollapsePlugin(state, () => {});
			const ctx = {
				rowDimensions: [],
				colDimensions: [],
				visibleRows: [],
				allRows: [],
				visibleCols: [],
				data: new Map<string, number | null>(),
				rootEl: document.createElement('div'),
				scrollLeft: 0,
				scrollTop: 0,
				isPluginEnabled: () => false,
			};

			const header = document.createElement('div');
			header.className = 'pv-col-span pv-col-span--collapsible';
			header.setAttribute('data-collapse-key', '0\x1f\x1fA');

			const e = makePointerEvent(header);
			// Test with 'pointermove' — should not consume
			const consumed = plugin.onPointerEvent!('pointermove', e, ctx);
			expect(consumed).toBe(false);
		});

		it('walks up the DOM tree to find the collapsible header', () => {
			const state = makeState();
			const rerender = vi.fn();
			const plugin = createSuperStackCollapsePlugin(state, rerender);
			const ctx = {
				rowDimensions: [],
				colDimensions: [],
				visibleRows: [],
				allRows: [],
				visibleCols: [],
				data: new Map<string, number | null>(),
				rootEl: document.createElement('div'),
				scrollLeft: 0,
				scrollTop: 0,
				isPluginEnabled: () => false,
			};

			// Create nested structure: header > chevron-span (the click target)
			const header = document.createElement('div');
			header.className = 'pv-col-span pv-col-span--collapsible';
			const key = '0\x1f\x1fX';
			header.setAttribute('data-collapse-key', key);

			const chevron = document.createElement('span');
			chevron.className = 'pv-span-chevron';
			chevron.textContent = '▼';
			header.appendChild(chevron);

			// Click on the chevron (not the header)
			const e = makePointerEvent(chevron);
			const consumed = plugin.onPointerEvent!('pointerdown', e, ctx);

			expect(consumed).toBe(true);
			expect(state.collapsedSet.has(key)).toBe(true);
		});
	});

	describe('afterRender', () => {
		it('does not throw on an empty root', () => {
			const state = makeState();
			const plugin = createSuperStackCollapsePlugin(state, () => {});
			const root = document.createElement('div');
			const ctx = {
				rowDimensions: [],
				colDimensions: [],
				visibleRows: [],
				allRows: [],
				visibleCols: [],
				data: new Map<string, number | null>(),
				rootEl: document.createElement('div'),
				scrollLeft: 0,
				scrollTop: 0,
				isPluginEnabled: () => false,
			};
			expect(() => plugin.afterRender!(root, ctx)).not.toThrow();
		});

		it('adds pv-span-chevron elements to collapsible headers', () => {
			const state = makeState();
			const plugin = createSuperStackCollapsePlugin(state, () => {});

			const root = document.createElement('div');
			// Simulate a non-leaf header already in DOM (as set by SuperStackSpans)
			const header = document.createElement('div');
			header.className = 'pv-col-span pv-col-span--collapsible';
			header.setAttribute('data-level', '0');
			header.setAttribute('data-parent-path', '');
			header.textContent = '2024';
			root.appendChild(header);

			const ctx = {
				rowDimensions: [],
				colDimensions: [],
				visibleRows: [],
				allRows: [],
				visibleCols: [],
				data: new Map<string, number | null>(),
				rootEl: document.createElement('div'),
				scrollLeft: 0,
				scrollTop: 0,
				isPluginEnabled: () => false,
			};
			plugin.afterRender!(root, ctx);

			// Should have set data-collapse-key
			expect(header.getAttribute('data-collapse-key')).toBeTruthy();
		});

		it('marks collapsed headers with chevron ▶ and pv-col-span--collapsed class', () => {
			const collapseKey = '0\x1f\x1f2024';
			const state = makeState([collapseKey]);
			const plugin = createSuperStackCollapsePlugin(state, () => {});

			const root = document.createElement('div');
			const header = document.createElement('div');
			header.className = 'pv-col-span pv-col-span--collapsible';
			header.setAttribute('data-level', '0');
			header.setAttribute('data-parent-path', '');
			// Set data-collapse-key so afterRender knows which key this header has
			header.setAttribute('data-collapse-key', collapseKey);
			header.textContent = '2024';
			root.appendChild(header);

			const ctx = {
				rowDimensions: [],
				colDimensions: [],
				visibleRows: [],
				allRows: [],
				visibleCols: [],
				data: new Map<string, number | null>(),
				rootEl: document.createElement('div'),
				scrollLeft: 0,
				scrollTop: 0,
				isPluginEnabled: () => false,
			};
			plugin.afterRender!(root, ctx);

			expect(header.classList.contains('pv-col-span--collapsed')).toBe(true);
			const chevron = header.querySelector('.pv-span-chevron');
			expect(chevron?.textContent).toBe('▶');
		});

		it('marks expanded headers with chevron ▼', () => {
			const state = makeState(); // empty — nothing collapsed
			const plugin = createSuperStackCollapsePlugin(state, () => {});

			const root = document.createElement('div');
			const header = document.createElement('div');
			header.className = 'pv-col-span pv-col-span--collapsible';
			header.setAttribute('data-level', '0');
			header.setAttribute('data-parent-path', '');
			header.setAttribute('data-collapse-key', '0\x1f\x1f2024');
			header.textContent = '2024';
			root.appendChild(header);

			const ctx = {
				rowDimensions: [],
				colDimensions: [],
				visibleRows: [],
				allRows: [],
				visibleCols: [],
				data: new Map<string, number | null>(),
				rootEl: document.createElement('div'),
				scrollLeft: 0,
				scrollTop: 0,
				isPluginEnabled: () => false,
			};
			plugin.afterRender!(root, ctx);

			const chevron = header.querySelector('.pv-span-chevron');
			expect(chevron?.textContent).toBe('▼');
		});
	});

	describe('destroy', () => {
		it('clears the collapsedSet on destroy', () => {
			const state = makeState(['0\x1f\x1f2024', '1\x1f2024\x1fJan']);
			const plugin = createSuperStackCollapsePlugin(state, () => {});
			expect(state.collapsedSet.size).toBe(2);

			plugin.destroy!();
			expect(state.collapsedSet.size).toBe(0);
		});
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superstack.collapse
// ---------------------------------------------------------------------------

describe('Lifecycle — superstack.collapse', () => {
	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superstack.collapse');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook has destroy function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superstack.collapse');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook transformData is undefined (collapse does not filter cells)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superstack.collapse');
		expect(hook.transformData).toBeUndefined();
	});

	it('hook transformLayout is undefined (collapse does not mutate layout)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superstack.collapse');
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender runs without throwing via pipeline', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'superstack.collapse');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superstack.collapse');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superstack.collapse');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});
});
