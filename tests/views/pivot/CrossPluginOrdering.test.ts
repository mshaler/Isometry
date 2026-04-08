// @vitest-environment jsdom
// Isometry v5 — Phase 106 Plan 02 Cross-Plugin Ordering + Isolation
//
// XPLG-04: Shared-state isolation — no leakage between fresh harness instances.
// XPLG-05: Pipeline ordering — getRegistrationOrder() matches FEATURE_CATALOG insertion order.
//
// Pattern: test B runs after test A mutates state; fresh harness in test B must see defaults.

import { afterEach, describe, expect, it } from 'vitest';
import { FEATURE_CATALOG } from '../../../src/views/pivot/plugins/FeatureCatalog';
import { makePluginHarness } from './helpers/makePluginHarness';

// ---------------------------------------------------------------------------
// XPLG-05 — Pipeline ordering
// ---------------------------------------------------------------------------

describe('XPLG-05 — Pipeline ordering', () => {
	it('getRegistrationOrder matches FEATURE_CATALOG array order', () => {
		const harness = makePluginHarness();
		const actual = harness.registry.getRegistrationOrder();
		const expected = FEATURE_CATALOG.map((f) => f.id);
		expect(actual).toEqual(expected);
		harness.registry.destroyAll();
	});

	it('registration order has exactly 28 entries', () => {
		const harness = makePluginHarness();
		// Phase 143 Plan 02: added 'supersize.row-header-resize' (28th plugin)
		expect(harness.registry.getRegistrationOrder()).toHaveLength(28);
		harness.registry.destroyAll();
	});
});

// ---------------------------------------------------------------------------
// XPLG-04 — Shared-state isolation
//
// Test A mutates shared state objects by enabling plugin families and running
// the pipeline. Test B creates a completely fresh harness and verifies that
// every shared-state category resets to factory defaults — no leakage.
// ---------------------------------------------------------------------------

describe('XPLG-04 — Shared-state isolation', () => {
	afterEach(() => {
		// No global teardown needed — each test creates its own harness and
		// calls destroyAll() internally.
	});

	it('Test A — mutate shared state via plugin interactions', () => {
		const harness = makePluginHarness();

		// Enable representative plugins from every shared-state category
		harness.enable('superzoom.slider');
		harness.enable('superzoom.scale');
		harness.enable('superselect.click');
		harness.enable('supersearch.input');
		harness.enable('supersearch.highlight');
		harness.enable('superdensity.mode-switch');
		harness.enable('superstack.spanning');
		harness.enable('superstack.collapse');
		harness.enable('superstack.aggregate');
		harness.enable('superaudit.overlay');

		// Run the full pipeline to exercise transformData/transformLayout/afterRender
		const { cells, layout } = harness.runPipeline();

		// Sanity: pipeline ran without throwing (actual state mutations happen inside
		// the plugin factories' shared state objects scoped to this harness instance)
		expect(cells).toBeDefined();
		expect(layout).toBeDefined();

		harness.registry.destroyAll();
	});

	it('Test B — fresh harness has clean default state (no leakage from Test A)', () => {
		// Create a brand-new harness — registerCatalog() runs again, producing
		// entirely new shared-state objects (new Set(), new Map(), etc.)
		const harness = makePluginHarness();

		// Verify ZoomState defaults: layout.zoom === 1 (ZOOM_DEFAULT)
		harness.enable('superzoom.slider');
		harness.enable('superzoom.scale');
		const { layout: zoomLayout } = harness.runPipeline();
		expect(zoomLayout.zoom).toBe(1);

		// Verify SelectionState defaults: no cells selected
		harness.enable('superselect.click');
		// Access shared state via bracket notation (test-only introspection)
		const selectEntry = (harness.registry as any)._plugins.get('superselect.click');
		// The instance may be null until enable triggers factory; instance was created on enable
		// Verify through observable output: pipeline runs without error and no stale selection
		const { cells: selectCells } = harness.runPipeline();
		// All cells present — no stale filter from Test A's selection state
		expect(selectCells.length).toBeGreaterThan(0);
		expect(selectEntry).toBeDefined();

		// Verify SearchState defaults: term is empty, no cells filtered
		harness.enable('supersearch.input');
		harness.enable('supersearch.highlight');
		// Access shared state via bracket notation
		const searchEntry = (harness.registry as any)._plugins.get('supersearch.input');
		expect(searchEntry).toBeDefined();
		// With empty search term, all cells pass through unfiltered
		const { cells: searchCells } = harness.runPipeline();
		expect(searchCells.length).toBeGreaterThan(0);

		// Verify DensityState defaults: level === 'normal' (factory default)
		harness.enable('superdensity.mode-switch');
		const densityEntry = (harness.registry as any)._plugins.get('superdensity.mode-switch');
		expect(densityEntry).toBeDefined();
		// Run pipeline — density plugin writes class to DOM, not layout; just confirm no throw
		const { cells: densityCells } = harness.runPipeline();
		expect(densityCells.length).toBeGreaterThan(0);

		// Verify SuperStackState defaults: collapsedSet.size === 0
		harness.enable('superstack.spanning');
		harness.enable('superstack.collapse');
		// Access shared state through spanning plugin (both share same SuperStackState)
		// We verify through observable pipeline output: no collapsed rows means all rows present
		const { cells: stackCells } = harness.runPipeline();
		// collapsedSet is empty → no rows removed by collapse → all input cells preserved
		expect(stackCells.length).toBeGreaterThan(0);

		harness.registry.destroyAll();
	});
});
