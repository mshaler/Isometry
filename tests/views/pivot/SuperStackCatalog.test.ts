// @vitest-environment jsdom
// Isometry v5 — Phase 101 Plan 02 SuperStack Catalog Migration Tests
// Behavioral tests for superstack.collapse + superstack.aggregate catalog registration.
//
// Design:
//   - Verifies that both superstack plugins are registered in registerCatalog() with
//     real factories (not NOOP stubs)
//   - Verifies that shared SuperStackState is created internally in registerCatalog()
//     so HarnessShell does NOT need to wire them via setFactory overrides
//   - Verifies collapse plugin hooks (afterRender, onPointerEvent, destroy)
//   - Verifies aggregate plugin hooks (afterRender)
//   - Verifies shared state works across both plugins
//
// Requirements: STKM-01, STKM-02

import { beforeEach, describe, expect, it } from 'vitest';
import { PluginRegistry } from '../../../src/views/pivot/plugins/PluginRegistry';
import { registerCatalog } from '../../../src/views/pivot/plugins/FeatureCatalog';
import type { RenderContext } from '../../../src/views/pivot/plugins/PluginTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegistry(): PluginRegistry {
	const reg = new PluginRegistry();
	registerCatalog(reg);
	return reg;
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
// Registration tests
// ---------------------------------------------------------------------------

describe('SuperStack catalog migration — registerCatalog registers real factories', () => {
	let reg: PluginRegistry;

	beforeEach(() => {
		reg = makeRegistry();
	});

	it("'superstack.collapse' is NOT a stub after registerCatalog()", () => {
		const stubs = reg.getStubIds();
		expect(stubs).not.toContain('superstack.collapse');
	});

	it("'superstack.aggregate' is NOT a stub after registerCatalog()", () => {
		const stubs = reg.getStubIds();
		expect(stubs).not.toContain('superstack.aggregate');
	});
});

// ---------------------------------------------------------------------------
// Plugin hook shape tests
// ---------------------------------------------------------------------------

describe('SuperStack catalog migration — plugin hook shapes', () => {
	let reg: PluginRegistry;

	beforeEach(() => {
		reg = makeRegistry();
	});

	it('superstack.collapse plugin instance has afterRender, onPointerEvent, destroy', () => {
		// Enable collapse (will also auto-enable base.grid, base.headers, superstack.spanning)
		reg.enable('superstack.collapse');

		// Access the instance via pipeline — check it processes afterRender without throwing
		const root = document.createElement('div');
		expect(() => reg.runAfterRender(root, minimalCtx)).not.toThrow();

		// Check that onPointerEvent is wired (returns false for non-collapse events)
		const fakeEvent = new PointerEvent('pointermove');
		const result = reg.runOnPointerEvent('pointermove', fakeEvent, minimalCtx);
		expect(result).toBe(false);
	});

	it('superstack.aggregate plugin instance has afterRender', () => {
		// Enable aggregate (depends on collapse → spanning → headers → grid)
		reg.enable('superstack.aggregate');

		// afterRender should not throw with empty context
		const root = document.createElement('div');
		expect(() => reg.runAfterRender(root, minimalCtx)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Shared state tests
// ---------------------------------------------------------------------------

describe('SuperStack catalog migration — shared SuperStackState', () => {
	it('collapse plugin onPointerEvent consumes pointerdown on collapsible header', () => {
		const reg = makeRegistry();
		reg.enable('superstack.collapse');

		// Create a mock DOM with a collapsible header
		const root = document.createElement('div');
		const header = document.createElement('div');
		header.className = 'pv-col-span--collapsible';
		header.setAttribute('data-collapse-key', '0\x1fTest\x1fValue');
		root.appendChild(header);

		// First run afterRender so the collapse plugin processes the header
		reg.runAfterRender(root, minimalCtx);

		// Simulate pointerdown on the header
		const event = new PointerEvent('pointerdown', { bubbles: true });
		Object.defineProperty(event, 'target', { value: header, writable: false });

		const consumed = reg.runOnPointerEvent('pointerdown', event, minimalCtx);
		expect(consumed).toBe(true);
	});

	it('collapse and aggregate share the same SuperStackState (enabling both uses shared state)', () => {
		const reg = makeRegistry();

		// Enable both plugins — they should share the same SuperStackState
		reg.enable('superstack.aggregate'); // this enables all deps including collapse

		// Both plugins are enabled
		expect(reg.isEnabled('superstack.collapse')).toBe(true);
		expect(reg.isEnabled('superstack.aggregate')).toBe(true);

		// Run collapse plugin: set up a collapsible header and trigger pointerdown
		const root = document.createElement('div');
		const header = document.createElement('div');
		header.className = 'pv-col-span--collapsible';
		header.setAttribute('data-collapse-key', '0\x1fParent\x1fGroup');
		root.appendChild(header);

		// afterRender to initialize the collapse plugin state
		reg.runAfterRender(root, minimalCtx);

		// Trigger collapse via pointerdown
		const event = new PointerEvent('pointerdown', { bubbles: true });
		Object.defineProperty(event, 'target', { value: header, writable: false });
		reg.runOnPointerEvent('pointerdown', event, minimalCtx);

		// Run aggregate's afterRender — since collapsedSet has the key,
		// it should process collapsed groups (fast path exits early for empty rows/cols)
		// The important thing: no throw, and aggregate reads the SAME state
		const aggRoot = document.createElement('div');
		const markedCell = document.createElement('div');
		markedCell.setAttribute('data-agg-col', '0\x1fParent\x1fGroup');
		aggRoot.appendChild(markedCell);

		// Add a parent so aggregate cleanup works
		const container = document.createElement('div');
		container.appendChild(aggRoot);

		expect(() => reg.runAfterRender(aggRoot, minimalCtx)).not.toThrow();

		// The marked cell should have pv-agg-cell class (Pass A in aggregate plugin)
		// since the collapsedSet now contains '0\x1fParent\x1fGroup'
		expect(markedCell.classList.contains('pv-agg-cell')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// notifyChange tests
// ---------------------------------------------------------------------------

describe('SuperStack catalog migration — registry.notifyChange()', () => {
	it('registry.notifyChange() triggers onChange listeners', () => {
		const reg = makeRegistry();
		let notified = false;
		reg.onChange(() => {
			notified = true;
		});

		reg.notifyChange();
		expect(notified).toBe(true);
	});
});
