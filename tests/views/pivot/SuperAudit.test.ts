// @vitest-environment jsdom
// Phase 102 Plan 04 + Phase 105 Plan 02 — SuperAudit Plugin Tests
// Tests for SuperAuditOverlay and SuperAuditSource plugins.
//
// Design:
//   - createAuditPluginState() returns shared state with Sets + Map
//   - createSuperAuditOverlayPlugin applies CSS classes based on inserted/updated/deleted Sets
//   - createSuperAuditSourcePlugin sets data-source attribute based on sources Map
//   - Both plugins clean up in destroy()
//
// Requirements: AUDT-01, AUDT-02

import { beforeEach, describe, expect, it } from 'vitest';
import {
	createAuditPluginState,
	createSuperAuditOverlayPlugin,
	type AuditPluginState,
} from '../../../src/views/pivot/plugins/SuperAuditOverlay';
import { createSuperAuditSourcePlugin } from '../../../src/views/pivot/plugins/SuperAuditSource';
import type { RenderContext } from '../../../src/views/pivot/plugins/PluginTypes';
import { makePluginHarness } from './helpers/makePluginHarness';
import { usePlugin } from './helpers/usePlugin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock grid root with .pv-data-cell[data-key] elements.
 * Keys are provided as an array, creating one cell per key.
 */
function makeGrid(keys: string[]): HTMLElement {
	const root = document.createElement('div');
	for (const key of keys) {
		const cell = document.createElement('div');
		cell.className = 'pv-data-cell';
		cell.setAttribute('data-key', key);
		root.appendChild(cell);
	}
	return root;
}

const minimalCtx: RenderContext = {
	rowDimensions: [],
	colDimensions: [],
	visibleRows: [],
	allRows: [],
	visibleCols: [],
	data: new Map(),
	rootEl: document.createElement('div'),
	scrollLeft: 0,
	scrollTop: 0,
	isPluginEnabled: () => false,
};

// ---------------------------------------------------------------------------
// createAuditPluginState
// ---------------------------------------------------------------------------

describe('createAuditPluginState', () => {
	it('returns object with inserted, updated, deleted Sets and sources Map', () => {
		const state = createAuditPluginState();
		expect(state.inserted).toBeInstanceOf(Set);
		expect(state.updated).toBeInstanceOf(Set);
		expect(state.deleted).toBeInstanceOf(Set);
		expect(state.sources).toBeInstanceOf(Map);
	});

	it('returns empty Sets and Map by default', () => {
		const state = createAuditPluginState();
		expect(state.inserted.size).toBe(0);
		expect(state.updated.size).toBe(0);
		expect(state.deleted.size).toBe(0);
		expect(state.sources.size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superaudit.overlay
// ---------------------------------------------------------------------------

describe("Lifecycle — superaudit.overlay", () => {
	it('hook has afterRender and destroy; no transformData or transformLayout', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superaudit.overlay');
		expect(typeof hook.afterRender).toBe('function');
		expect(typeof hook.destroy).toBe('function');
		expect(hook.transformData).toBeUndefined();
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender adds .audit-new to cells whose key is in inserted Set', () => {
		const state = createAuditPluginState();
		state.inserted.add('0:0');
		const root = makeGrid(['0:0', '0:1']);
		const plugin = createSuperAuditOverlayPlugin(state);
		plugin.afterRender!(root, minimalCtx);

		const cell00 = root.querySelector('[data-key="0:0"]')!;
		const cell01 = root.querySelector('[data-key="0:1"]')!;
		expect(cell00.classList.contains('audit-new')).toBe(true);
		expect(cell01.classList.contains('audit-new')).toBe(false);
	});

	it('afterRender adds .audit-modified to cells in updated Set', () => {
		const state = createAuditPluginState();
		state.updated.add('0:1');
		const root = makeGrid(['0:0', '0:1']);
		const plugin = createSuperAuditOverlayPlugin(state);
		plugin.afterRender!(root, minimalCtx);

		const cell01 = root.querySelector('[data-key="0:1"]')!;
		expect(cell01.classList.contains('audit-modified')).toBe(true);
	});

	it('destroy removes all audit overlay classes from cells', () => {
		const state = createAuditPluginState();
		state.inserted.add('0:0');

		const root = makeGrid(['0:0']);
		const plugin = createSuperAuditOverlayPlugin(state);
		document.body.appendChild(root);
		plugin.afterRender!(root, minimalCtx);

		expect(root.querySelector('[data-key="0:0"]')!.classList.contains('audit-new')).toBe(true);

		plugin.destroy!();
		expect(root.querySelector('[data-key="0:0"]')!.classList.contains('audit-new')).toBe(false);

		document.body.removeChild(root);
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superaudit.overlay');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// createSuperAuditOverlayPlugin — full behavioral tests
// ---------------------------------------------------------------------------

describe('createSuperAuditOverlayPlugin — factory and hooks', () => {
	let state: AuditPluginState;

	beforeEach(() => {
		state = createAuditPluginState();
	});

	it('factory returns PluginHook with afterRender and destroy', () => {
		const plugin = createSuperAuditOverlayPlugin(state);
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('afterRender adds .audit-new to cells whose key is in inserted Set', () => {
		state.inserted.add('0:0');
		const root = makeGrid(['0:0', '0:1', '1:0']);
		const plugin = createSuperAuditOverlayPlugin(state);
		plugin.afterRender!(root, minimalCtx);

		const cell00 = root.querySelector('[data-key="0:0"]')!;
		const cell01 = root.querySelector('[data-key="0:1"]')!;
		expect(cell00.classList.contains('audit-new')).toBe(true);
		expect(cell01.classList.contains('audit-new')).toBe(false);
	});

	it('afterRender adds .audit-modified to cells whose key is in updated Set', () => {
		state.updated.add('0:1');
		const root = makeGrid(['0:0', '0:1', '1:0']);
		const plugin = createSuperAuditOverlayPlugin(state);
		plugin.afterRender!(root, minimalCtx);

		const cell01 = root.querySelector('[data-key="0:1"]')!;
		const cell10 = root.querySelector('[data-key="1:0"]')!;
		expect(cell01.classList.contains('audit-modified')).toBe(true);
		expect(cell10.classList.contains('audit-modified')).toBe(false);
	});

	it('afterRender adds .audit-deleted to cells whose key is in deleted Set', () => {
		state.deleted.add('1:0');
		const root = makeGrid(['0:0', '0:1', '1:0']);
		const plugin = createSuperAuditOverlayPlugin(state);
		plugin.afterRender!(root, minimalCtx);

		const cell10 = root.querySelector('[data-key="1:0"]')!;
		const cell00 = root.querySelector('[data-key="0:0"]')!;
		expect(cell10.classList.contains('audit-deleted')).toBe(true);
		expect(cell00.classList.contains('audit-deleted')).toBe(false);
	});

	it('afterRender does NOT add audit classes when all Sets are empty', () => {
		const root = makeGrid(['0:0', '0:1', '1:0']);
		const plugin = createSuperAuditOverlayPlugin(state);
		plugin.afterRender!(root, minimalCtx);

		const cells = root.querySelectorAll('.pv-data-cell');
		for (const cell of cells) {
			expect(cell.classList.contains('audit-new')).toBe(false);
			expect(cell.classList.contains('audit-modified')).toBe(false);
			expect(cell.classList.contains('audit-deleted')).toBe(false);
		}
	});

	it('afterRender removes stale audit classes from cells no longer in any Set', () => {
		// Cell was previously marked as new, but state was cleared
		const root = makeGrid(['0:0']);
		const cell = root.querySelector('[data-key="0:0"]') as HTMLElement;
		cell.classList.add('audit-new');

		const plugin = createSuperAuditOverlayPlugin(state);
		plugin.afterRender!(root, minimalCtx);

		expect(cell.classList.contains('audit-new')).toBe(false);
	});

	it('destroy removes .audit-new, .audit-modified, .audit-deleted from all cells', () => {
		state.inserted.add('0:0');
		state.updated.add('0:1');
		state.deleted.add('1:0');

		const root = makeGrid(['0:0', '0:1', '1:0']);
		const plugin = createSuperAuditOverlayPlugin(state);
		plugin.afterRender!(root, minimalCtx);

		// Verify classes were applied
		expect(root.querySelector('[data-key="0:0"]')!.classList.contains('audit-new')).toBe(true);
		expect(root.querySelector('[data-key="0:1"]')!.classList.contains('audit-modified')).toBe(true);
		expect(root.querySelector('[data-key="1:0"]')!.classList.contains('audit-deleted')).toBe(true);

		// destroy() operates on the document body since no root is stored.
		// We append root to document.body so querySelectorAll works from document.
		document.body.appendChild(root);
		plugin.destroy!();

		expect(root.querySelector('[data-key="0:0"]')!.classList.contains('audit-new')).toBe(false);
		expect(root.querySelector('[data-key="0:1"]')!.classList.contains('audit-modified')).toBe(false);
		expect(root.querySelector('[data-key="1:0"]')!.classList.contains('audit-deleted')).toBe(false);

		document.body.removeChild(root);
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — superaudit.source
// ---------------------------------------------------------------------------

describe("Lifecycle — superaudit.source", () => {
	it('hook has afterRender; no transformData, transformLayout (destroy may be undefined)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superaudit.source');
		expect(typeof hook.afterRender).toBe('function');
		expect(hook.transformData).toBeUndefined();
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender sets data-source attribute on cells in sources Map', () => {
		const state = createAuditPluginState();
		state.sources.set('0:0', 'csv');
		const root = makeGrid(['0:0', '0:1']);
		const plugin = createSuperAuditSourcePlugin(state);
		plugin.afterRender!(root, minimalCtx);

		const cell00 = root.querySelector('[data-key="0:0"]')!;
		const cell01 = root.querySelector('[data-key="0:1"]')!;
		expect(cell00.getAttribute('data-source')).toBe('csv');
		expect(cell01.getAttribute('data-source')).toBeNull();
	});

	it('afterRender adds .audit-source class to cells with source data', () => {
		const state = createAuditPluginState();
		state.sources.set('0:0', 'csv');
		const root = makeGrid(['0:0', '0:1']);
		const plugin = createSuperAuditSourcePlugin(state);
		plugin.afterRender!(root, minimalCtx);

		const cell00 = root.querySelector('[data-key="0:0"]')!;
		const cell01 = root.querySelector('[data-key="0:1"]')!;
		expect(cell00.classList.contains('audit-source')).toBe(true);
		expect(cell01.classList.contains('audit-source')).toBe(false);
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'superaudit.source');
		hook.destroy?.();
		expect(() => hook.destroy?.()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// createSuperAuditSourcePlugin — full behavioral tests
// ---------------------------------------------------------------------------

describe('createSuperAuditSourcePlugin — factory and hooks', () => {
	let state: AuditPluginState;

	beforeEach(() => {
		state = createAuditPluginState();
	});

	it('factory returns PluginHook with afterRender and destroy', () => {
		const plugin = createSuperAuditSourcePlugin(state);
		expect(typeof plugin.afterRender).toBe('function');
		expect(typeof plugin.destroy).toBe('function');
	});

	it('afterRender sets data-source attribute on cells whose key is in sources Map', () => {
		state.sources.set('0:0', 'csv');
		state.sources.set('0:1', 'apple_notes');

		const root = makeGrid(['0:0', '0:1', '1:0']);
		const plugin = createSuperAuditSourcePlugin(state);
		plugin.afterRender!(root, minimalCtx);

		const cell00 = root.querySelector('[data-key="0:0"]')!;
		const cell01 = root.querySelector('[data-key="0:1"]')!;
		const cell10 = root.querySelector('[data-key="1:0"]')!;

		expect(cell00.getAttribute('data-source')).toBe('csv');
		expect(cell01.getAttribute('data-source')).toBe('apple_notes');
		expect(cell10.getAttribute('data-source')).toBeNull();
	});

	it('afterRender adds .audit-source class to cells with source data', () => {
		state.sources.set('0:0', 'csv');

		const root = makeGrid(['0:0', '0:1']);
		const plugin = createSuperAuditSourcePlugin(state);
		plugin.afterRender!(root, minimalCtx);

		const cell00 = root.querySelector('[data-key="0:0"]')!;
		const cell01 = root.querySelector('[data-key="0:1"]')!;

		expect(cell00.classList.contains('audit-source')).toBe(true);
		expect(cell01.classList.contains('audit-source')).toBe(false);
	});

	it('afterRender removes .audit-source and data-source from cells not in sources Map', () => {
		// Cell was previously marked, but state was cleared
		const root = makeGrid(['0:0']);
		const cell = root.querySelector('[data-key="0:0"]') as HTMLElement;
		cell.classList.add('audit-source');
		cell.setAttribute('data-source', 'csv');

		const plugin = createSuperAuditSourcePlugin(state);
		plugin.afterRender!(root, minimalCtx);

		expect(cell.classList.contains('audit-source')).toBe(false);
		expect(cell.getAttribute('data-source')).toBeNull();
	});

	it('destroy removes .audit-source class and data-source attribute from all cells', () => {
		state.sources.set('0:0', 'csv');
		state.sources.set('0:1', 'apple_notes');

		const root = makeGrid(['0:0', '0:1']);
		const plugin = createSuperAuditSourcePlugin(state);
		plugin.afterRender!(root, minimalCtx);

		// Verify applied
		expect(root.querySelector('[data-key="0:0"]')!.classList.contains('audit-source')).toBe(true);
		expect(root.querySelector('[data-key="0:1"]')!.getAttribute('data-source')).toBe('apple_notes');

		document.body.appendChild(root);
		plugin.destroy!();

		expect(root.querySelector('[data-key="0:0"]')!.classList.contains('audit-source')).toBe(false);
		expect(root.querySelector('[data-key="0:1"]')!.getAttribute('data-source')).toBeNull();

		document.body.removeChild(root);
	});
});
