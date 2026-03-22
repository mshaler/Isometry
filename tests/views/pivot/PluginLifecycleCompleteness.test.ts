// @vitest-environment jsdom
// Isometry v5 — Phase 105 Plan 02 PluginLifecycle Completeness Guard
//
// PERMANENT GUARD — If a test fails, add lifecycle coverage for the new plugin.
// Never weaken these assertions. Mirror of D-019 FeatureCatalogCompleteness pattern.
//
// Three guard tests:
//   1. All 27 FEATURE_CATALOG plugins run through lifecycle pipeline without error
//   2. Every FEATURE_CATALOG ID has a lifecycle test in a test file (explicit coverage map)
//   3. Double destroy safety for all 27 plugins

import { describe, expect, it } from 'vitest';
import { FEATURE_CATALOG } from '../../../src/views/pivot/plugins/FeatureCatalog';
import { makePluginHarness } from './helpers/makePluginHarness';
import { usePlugin } from './helpers/usePlugin';

// ---------------------------------------------------------------------------
// Explicit coverage map — all 27 plugin IDs mapped to their lifecycle test file
// ---------------------------------------------------------------------------

// PERMANENT GUARD — If a test fails, add lifecycle coverage for the new plugin. Never weaken.
const LIFECYCLE_COVERAGE: Record<string, string> = {
	'base.grid': 'BasePlugins.test.ts',
	'base.headers': 'BasePlugins.test.ts',
	'base.config': 'BasePlugins.test.ts',
	'superstack.spanning': 'SuperStackSpans.test.ts',
	'superstack.collapse': 'SuperStackCollapse.test.ts',
	'superstack.aggregate': 'SuperStackAggregate.test.ts',
	'superzoom.slider': 'SuperZoom.test.ts',
	'superzoom.scale': 'SuperZoom.test.ts',
	'supersize.col-resize': 'SuperSize.test.ts',
	'supersize.header-resize': 'SuperSize.test.ts',
	'supersize.uniform-resize': 'SuperSize.test.ts',
	'supersort.header-click': 'SuperSort.test.ts',
	'supersort.chain': 'SuperSort.test.ts',
	'superscroll.virtual': 'SuperScroll.test.ts',
	'superscroll.sticky-headers': 'SuperScroll.test.ts',
	'supercalc.footer': 'SuperCalc.test.ts',
	'supercalc.config': 'SuperCalc.test.ts',
	'superdensity.mode-switch': 'SuperDensity.test.ts',
	'superdensity.mini-cards': 'SuperDensity.test.ts',
	'superdensity.count-badge': 'SuperDensity.test.ts',
	'supersearch.input': 'SuperSearch.test.ts',
	'supersearch.highlight': 'SuperSearch.test.ts',
	'superselect.click': 'SuperSelect.test.ts',
	'superselect.lasso': 'SuperSelect.test.ts',
	'superselect.keyboard': 'SuperSelect.test.ts',
	'superaudit.overlay': 'SuperAudit.test.ts',
	'superaudit.source': 'SuperAudit.test.ts',
};

// ---------------------------------------------------------------------------
// Guard 1: All 27 plugins run through lifecycle pipeline without error
// ---------------------------------------------------------------------------

describe('27 plugin lifecycle — pipeline smoke test', () => {
	it('all 27 FEATURE_CATALOG plugins run through lifecycle pipeline without error', () => {
		for (const plugin of FEATURE_CATALOG) {
			const harness = makePluginHarness();

			// Enable plugin (auto-enables dependencies)
			expect(() => harness.enable(plugin.id), `enable(${plugin.id}) threw`).not.toThrow();

			// Run pipeline — transformData, transformLayout, afterRender
			expect(() => harness.runPipeline(), `runPipeline with ${plugin.id} enabled threw`).not.toThrow();

			// Disable triggers destroy()
			expect(() => harness.disable(plugin.id), `disable(${plugin.id}) threw`).not.toThrow();
		}
	});
});

// ---------------------------------------------------------------------------
// Guard 2: Coverage map has exactly 27 entries matching FEATURE_CATALOG
// ---------------------------------------------------------------------------

describe('27 plugin lifecycle — coverage map completeness', () => {
	it('LIFECYCLE_COVERAGE map contains exactly 27 entries matching FEATURE_CATALOG', () => {
		const catalogIds = FEATURE_CATALOG.map((f) => f.id);

		// Guard count — update this intentionally when catalog size changes
		expect(Object.keys(LIFECYCLE_COVERAGE)).toHaveLength(27);

		// Every catalog ID must be in the coverage map
		for (const id of catalogIds) {
			expect(
				LIFECYCLE_COVERAGE[id],
				`'${id}' is in FEATURE_CATALOG but missing from LIFECYCLE_COVERAGE map`,
			).toBeDefined();
		}

		// Every coverage map entry must reference a real catalog ID
		for (const id of Object.keys(LIFECYCLE_COVERAGE)) {
			expect(
				catalogIds.includes(id),
				`'${id}' is in LIFECYCLE_COVERAGE but not in FEATURE_CATALOG`,
			).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// Guard 3: Double destroy safety for all 27 plugins
// ---------------------------------------------------------------------------

describe('27 plugin lifecycle — double destroy safety', () => {
	it('calling destroy() twice on any plugin does not throw', () => {
		for (const plugin of FEATURE_CATALOG) {
			const harness = makePluginHarness();
			const hook = usePlugin(harness, plugin.id);

			// First destroy
			expect(
				() => hook.destroy?.(),
				`First destroy() on ${plugin.id} threw`,
			).not.toThrow();

			// Second destroy — must also be safe (null guard test)
			expect(
				() => hook.destroy?.(),
				`Second destroy() on ${plugin.id} threw`,
			).not.toThrow();
		}
	});
});
