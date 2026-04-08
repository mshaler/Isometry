// @vitest-environment jsdom
// Isometry v5 — FeatureCatalog Completeness Guard
// PERMANENT GUARD — Do not weaken these assertions.
//
// Registry Completeness Suite pattern (reusable for any registry):
//   1. Presence — every declared item is registered
//   2. Count — exact expected count (catches silent additions/removals)
//   3. Order — dependency/registration order is correct
//   4. Uniqueness — no duplicate IDs
//   5. Referential integrity — all references resolve
//   6. Stub detection — no noop factories remain in production
//
// Same category as the __agg__ regression guard (D-011).
// If a test fails: update the catalog count INTENTIONALLY or fix
// the registration order. Never suppress the failure.

import { beforeEach, describe, expect, it } from 'vitest';
import { FEATURE_CATALOG, registerCatalog } from '../../../src/views/pivot/plugins/FeatureCatalog';
import { PluginRegistry } from '../../../src/views/pivot/plugins/PluginRegistry';

describe('FeatureCatalog completeness — PERMANENT GUARD', () => {
	let reg: PluginRegistry;

	beforeEach(() => {
		reg = new PluginRegistry();
		registerCatalog(reg);
	});

	it('catalog enumerates exactly 28 features across all categories', () => {
		// GUARD: If this fails, a feature was added or removed from the catalog.
		// Update this count intentionally — never suppress the failure.
		// Phase 143 Plan 02: added 'supersize.row-header-resize' (28th plugin)
		expect(FEATURE_CATALOG).toHaveLength(28);
	});

	it('all 28 catalog features are registered after registerCatalog()', () => {
		const expectedIds = FEATURE_CATALOG.map((f) => f.id);
		for (const id of expectedIds) {
			expect(
				reg.getAll().find((m) => m.id === id),
				`Feature '${id}' missing from registry`,
			).toBeDefined();
		}
	});

	it('registered features satisfy dependency order', () => {
		const order = reg.getRegistrationOrder();

		for (const feature of FEATURE_CATALOG) {
			for (const dep of feature.dependencies) {
				const depIdx = order.indexOf(dep);
				const selfIdx = order.indexOf(feature.id);
				expect(depIdx, `Dependency '${dep}' must be registered before '${feature.id}'`).toBeLessThan(selfIdx);
			}
		}
	});

	it('no duplicate feature IDs in catalog', () => {
		const ids = FEATURE_CATALOG.map((f) => f.id);
		const unique = new Set(ids);
		expect(unique.size, 'Duplicate feature IDs detected').toBe(ids.length);
	});

	it('all declared dependencies reference existing catalog features', () => {
		const allIds = new Set(FEATURE_CATALOG.map((f) => f.id));
		for (const feature of FEATURE_CATALOG) {
			for (const dep of feature.dependencies) {
				expect(allIds.has(dep), `Feature '${feature.id}' depends on '${dep}' which is not in the catalog`).toBe(true);
			}
		}
	});

	it('stub detection: getStubIds reports unimplemented plugins', () => {
		const stubs = reg.getStubIds();

		// Plugins with real implementations should NOT appear as stubs.
		// As plugins are implemented, add them here.
		const implemented = [
			// Base (Phase 101 Plan 01)
			'base.grid',
			'base.headers',
			'base.config',
			'superstack.spanning',
			// SuperStack (Phase 101 Plan 02)
			'superstack.collapse',
			'superstack.aggregate',
			// SuperSize (Phase 100 Plan 01)
			'supersize.col-resize',
			'supersize.header-resize',
			'supersize.uniform-resize',
			// SuperZoom (Phase 100 Plan 01)
			'superzoom.slider',
			'superzoom.scale',
			// SuperSort (Phase 100 Plan 02)
			'supersort.header-click',
			'supersort.chain',
			// SuperScroll (Phase 100 Plan 02)
			'superscroll.virtual',
			'superscroll.sticky-headers',
			// SuperCalc (Phase 100 Plan 03)
			'supercalc.footer',
			'supercalc.config',
			// SuperDensity (Phase 102 Plan 01)
			'superdensity.mode-switch',
			'superdensity.mini-cards',
			'superdensity.count-badge',
			// SuperSearch (Phase 102 Plan 02)
			'supersearch.input',
			'supersearch.highlight',
			// SuperSelect (Phase 102 Plan 03)
			'superselect.click',
			'superselect.lasso',
			'superselect.keyboard',
			// SuperAudit (Phase 102 Plan 04)
			'superaudit.overlay',
			'superaudit.source',
			// SuperSize row header resize (Phase 143 Plan 02)
			'supersize.row-header-resize',
		];

		for (const id of implemented) {
			expect(stubs.includes(id), `'${id}' has a real factory but getStubIds() reports it as stub`).toBe(false);
		}

		// PROGRESSION GUARD: As plugins are implemented, update this count
		// downward. When all 28 are implemented, this becomes 0.
		// Current: 28 total - 28 implemented in registerCatalog = 0 stubs
		expect(stubs).toHaveLength(0);
	});
});
