// @vitest-environment jsdom
// Phase 102 Plan 02 + Phase 105 Plan 02 — SuperSearch Plugin Tests
// Tests for SuperSearchInput and SuperSearchHighlight plugins.
//
// Design:
//   - SearchState: shared state between input and highlight plugins
//   - SuperSearchInput: toolbar input with debounced transformData filtering
//   - SuperSearchHighlight: CSS class highlighting on matching cells
//   - transformData filters CellPlacement[] by key match (case-insensitive)
//   - afterRender creates .pv-search-toolbar with input[type="search"]
//   - Highlight adds .search-match to matching cells, opacity 0.35 to non-matching
//
// Requirements: SRCH-01, SRCH-02

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makePluginHarness } from './helpers/makePluginHarness';
import { usePlugin } from './helpers/usePlugin';
import type { CellPlacement } from '../../../src/views/pivot/plugins/PluginTypes';

// ---------------------------------------------------------------------------
// SearchState tests
// ---------------------------------------------------------------------------

describe('createSearchState', () => {
	it('returns { term: "", listeners: Set }', async () => {
		const { createSearchState } = await import(
			'../../../src/views/pivot/plugins/SuperSearchInput'
		);
		const state = createSearchState();
		expect(state.term).toBe('');
		expect(state.listeners).toBeInstanceOf(Set);
		expect(state.listeners.size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — supersearch.input
// ---------------------------------------------------------------------------

describe("Lifecycle — supersearch.input", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('hook has transformData, afterRender, destroy; no transformLayout', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersearch.input');
		expect(typeof hook.transformData).toBe('function');
		expect(typeof hook.afterRender).toBe('function');
		expect(typeof hook.destroy).toBe('function');
		expect(hook.transformLayout).toBeUndefined();
	});

	it('transformData with empty term returns all cells unchanged', async () => {
		const { createSuperSearchInputPlugin, createSearchState } = await import(
			'../../../src/views/pivot/plugins/SuperSearchInput'
		);
		const state = createSearchState();
		const plugin = createSuperSearchInputPlugin(state, () => {});
		const cells: CellPlacement[] = [
			{ key: 'foo|bar', rowIdx: 0, colIdx: 0, value: 1 },
			{ key: 'baz|qux', rowIdx: 1, colIdx: 0, value: 2 },
		];
		const ctx = makeMinimalCtx();
		const result = plugin.transformData!(cells, ctx);
		expect(result).toHaveLength(2);
		expect(result).toEqual(cells);
	});

	it('transformData with term "foo" returns only cells whose key contains "foo" (case-insensitive)', async () => {
		const { createSuperSearchInputPlugin, createSearchState } = await import(
			'../../../src/views/pivot/plugins/SuperSearchInput'
		);
		const state = createSearchState();
		state.term = 'foo';
		const plugin = createSuperSearchInputPlugin(state, () => {});
		const cells: CellPlacement[] = [
			{ key: 'foo|bar', rowIdx: 0, colIdx: 0, value: 1 },
			{ key: 'baz|qux', rowIdx: 1, colIdx: 0, value: 2 },
			{ key: 'FOO|zap', rowIdx: 2, colIdx: 0, value: 3 },
		];
		const ctx = makeMinimalCtx();
		const result = plugin.transformData!(cells, ctx);
		expect(result).toHaveLength(2);
		expect(result[0]!.key).toBe('foo|bar');
		expect(result[1]!.key).toBe('FOO|zap');
	});

	it('afterRender creates .pv-search-toolbar with input[type="search"]', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supersearch.input');

		// The plugin looks for .pv-toolbar to insert into
		const toolbar = document.createElement('div');
		toolbar.className = 'pv-toolbar';
		harness.ctx.rootEl.appendChild(toolbar);

		harness.runPipeline();

		const searchToolbar = harness.ctx.rootEl.querySelector('.pv-search-toolbar');
		expect(searchToolbar).not.toBeNull();
		const input = searchToolbar!.querySelector('input[type="search"]');
		expect(input).not.toBeNull();
	});

	it('afterRender does not throw without .pv-toolbar in root', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supersearch.input');
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('destroy removes .pv-search-toolbar from DOM', async () => {
		const { createSuperSearchInputPlugin, createSearchState } = await import(
			'../../../src/views/pivot/plugins/SuperSearchInput'
		);
		const state = createSearchState();
		const plugin = createSuperSearchInputPlugin(state, () => {});

		const root = document.createElement('div');
		const toolbar = document.createElement('div');
		toolbar.className = 'pv-toolbar';
		root.appendChild(toolbar);
		document.body.appendChild(root);

		plugin.afterRender!(root, makeMinimalCtx(root));
		expect(toolbar.querySelector('.pv-search-toolbar')).not.toBeNull();

		plugin.destroy!();
		expect(toolbar.querySelector('.pv-search-toolbar')).toBeNull();

		document.body.removeChild(root);
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersearch.input');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});

	it('input event with debounce (300ms) updates searchState.term and calls onSearchChange', async () => {
		const { createSuperSearchInputPlugin, createSearchState } = await import(
			'../../../src/views/pivot/plugins/SuperSearchInput'
		);
		const state = createSearchState();
		const onChange = vi.fn();
		const plugin = createSuperSearchInputPlugin(state, onChange);

		const root = document.createElement('div');
		const toolbar = document.createElement('div');
		toolbar.className = 'pv-toolbar';
		root.appendChild(toolbar);
		document.body.appendChild(root);

		plugin.afterRender!(root, makeMinimalCtx(root));

		const input = toolbar.querySelector('input[type="search"]') as HTMLInputElement;
		input.value = 'hello';
		input.dispatchEvent(new Event('input'));

		// Not yet — debounce hasn't fired
		expect(onChange).not.toHaveBeenCalled();
		expect(state.term).toBe('');

		// Advance timers by 300ms
		vi.advanceTimersByTime(300);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(state.term).toBe('hello');

		document.body.removeChild(root);
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — supersearch.highlight
// ---------------------------------------------------------------------------

describe("Lifecycle — supersearch.highlight", () => {
	it('hook has afterRender and destroy; no transformData or transformLayout', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersearch.highlight');
		expect(typeof hook.afterRender).toBe('function');
		expect(typeof hook.destroy).toBe('function');
		expect(hook.transformData).toBeUndefined();
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender with empty term: removes .search-match and resets opacity on all .pv-data-cell elements', async () => {
		const { createSuperSearchHighlightPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSearchHighlight'
		);
		const { createSearchState } = await import(
			'../../../src/views/pivot/plugins/SuperSearchInput'
		);
		const state = createSearchState(); // term is ''
		const plugin = createSuperSearchHighlightPlugin(state);

		const root = document.createElement('div');
		// Create two cells with pre-existing class and opacity
		const cell1 = document.createElement('div');
		cell1.className = 'pv-data-cell search-match';
		cell1.style.opacity = '0.35';
		cell1.textContent = 'Alpha';
		const cell2 = document.createElement('div');
		cell2.className = 'pv-data-cell search-match';
		cell2.style.opacity = '0.35';
		cell2.textContent = 'Beta';
		root.appendChild(cell1);
		root.appendChild(cell2);

		plugin.afterRender!(root, makeMinimalCtx(root));

		// Both should have .search-match removed and opacity reset
		expect(cell1.classList.contains('search-match')).toBe(false);
		expect(cell1.style.opacity).toBe('');
		expect(cell2.classList.contains('search-match')).toBe(false);
		expect(cell2.style.opacity).toBe('');
	});

	it('afterRender adds .search-match to matching cells', async () => {
		const { createSuperSearchHighlightPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSearchHighlight'
		);
		const { createSearchState } = await import(
			'../../../src/views/pivot/plugins/SuperSearchInput'
		);
		const state = createSearchState();
		state.term = 'alpha';
		const plugin = createSuperSearchHighlightPlugin(state);

		const root = document.createElement('div');
		const cell1 = document.createElement('div');
		cell1.className = 'pv-data-cell';
		cell1.textContent = 'Alpha value';
		const cell2 = document.createElement('div');
		cell2.className = 'pv-data-cell';
		cell2.textContent = 'Beta value';
		root.appendChild(cell1);
		root.appendChild(cell2);

		plugin.afterRender!(root, makeMinimalCtx(root));

		expect(cell1.classList.contains('search-match')).toBe(true);
		expect(cell2.classList.contains('search-match')).toBe(false);
	});

	it('afterRender sets opacity 0.35 on non-matching cells when search is active', async () => {
		const { createSuperSearchHighlightPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSearchHighlight'
		);
		const { createSearchState } = await import(
			'../../../src/views/pivot/plugins/SuperSearchInput'
		);
		const state = createSearchState();
		state.term = 'alpha';
		const plugin = createSuperSearchHighlightPlugin(state);

		const root = document.createElement('div');
		const cell1 = document.createElement('div');
		cell1.className = 'pv-data-cell';
		cell1.textContent = 'Alpha value';
		const cell2 = document.createElement('div');
		cell2.className = 'pv-data-cell';
		cell2.textContent = 'Beta value';
		root.appendChild(cell1);
		root.appendChild(cell2);

		plugin.afterRender!(root, makeMinimalCtx(root));

		// Matching cell: no opacity change
		expect(cell1.style.opacity).toBe('');
		// Non-matching: opacity 0.35
		expect(cell2.style.opacity).toBe('0.35');
	});

	it('destroy removes .search-match from all cells and resets opacity', async () => {
		const { createSuperSearchHighlightPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperSearchHighlight'
		);
		const { createSearchState } = await import(
			'../../../src/views/pivot/plugins/SuperSearchInput'
		);
		const state = createSearchState();
		state.term = 'alpha';
		const plugin = createSuperSearchHighlightPlugin(state);

		const root = document.createElement('div');
		const cell1 = document.createElement('div');
		cell1.className = 'pv-data-cell';
		cell1.textContent = 'Alpha value';
		root.appendChild(cell1);
		document.body.appendChild(root);

		plugin.afterRender!(root, makeMinimalCtx(root));
		// Apply highlight first
		cell1.classList.add('search-match');
		cell1.style.opacity = '0.35';

		plugin.destroy!();
		// After destroy, search-match removed and opacity reset across document
		// (destroy cleans up the last root it rendered into)
		// Since destroy operates on document-wide cells, check cell1 is cleaned up
		// Note: destroy without a root traverses document.querySelectorAll
		const allCells = document.querySelectorAll('.pv-data-cell');
		for (const cell of allCells) {
			expect((cell as HTMLElement).classList.contains('search-match')).toBe(false);
			expect((cell as HTMLElement).style.opacity).toBe('');
		}

		document.body.removeChild(root);
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supersearch.highlight');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Shared context factory (used by direct plugin factory tests above)
// ---------------------------------------------------------------------------

function makeMinimalCtx(root?: HTMLElement) {
	return {
		rowDimensions: [],
		colDimensions: [],
		visibleRows: [],
		allRows: [],
		visibleCols: [],
		data: new Map(),
		rootEl: root ?? document.createElement('div'),
		scrollLeft: 0,
		scrollTop: 0,
		isPluginEnabled: (_id: string) => false,
	};
}
