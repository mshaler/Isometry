// @vitest-environment jsdom
// Isometry v5 — FeatureCatalog Completeness Guard
// PERMANENT GUARD — Do not weaken these assertions.
//
// Design:
//   - Verifies all 27 sub-features are registered after registerCatalog()
//   - Verifies dependency ordering satisfies the catalog's declared graph
//   - Same category as the __agg__ regression guard (D-011)
//
// If a test fails: update the catalog count INTENTIONALLY or fix
// the registration order. Never suppress the failure.

import { beforeEach, describe, expect, it } from 'vitest';
import { PluginRegistry } from '../../../src/views/pivot/plugins/PluginRegistry';
import {
	FEATURE_CATALOG,
	registerCatalog,
} from '../../../src/views/pivot/plugins/FeatureCatalog';

describe('FeatureCatalog completeness — PERMANENT GUARD', () => {
	let reg: PluginRegistry;

	beforeEach(() => {
		reg = new PluginRegistry();
		registerCatalog(reg);
	});

	it('catalog enumerates exactly 27 features across all categories', () => {
		// GUARD: If this fails, a feature was added or removed from the catalog.
		// Update this count intentionally — never suppress the failure.
		expect(FEATURE_CATALOG).toHaveLength(27);
	});

	it('all 27 catalog features are registered after registerCatalog()', () => {
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
				expect(
					depIdx,
					`Dependency '${dep}' must be registered before '${feature.id}'`,
				).toBeLessThan(selfIdx);
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
				expect(
					allIds.has(dep),
					`Feature '${feature.id}' depends on '${dep}' which is not in the catalog`,
				).toBe(true);
			}
		}
	});
});
