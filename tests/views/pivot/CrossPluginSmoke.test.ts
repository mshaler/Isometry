// @vitest-environment jsdom
// Isometry v5 — Phase 106 Plan 01 CrossPlugin Smoke Test
//
// XPLG-01: Full-matrix smoke — all 27 plugins enabled simultaneously run
// the full pipeline without error.
//
// Requirements: XPLG-01

import { describe, expect, it } from 'vitest';
import { FEATURE_CATALOG } from '../../../src/views/pivot/plugins/FeatureCatalog';
import { makePluginHarness } from './helpers/makePluginHarness';

// ---------------------------------------------------------------------------
// Representative data helper
// ---------------------------------------------------------------------------

/** Build a Map<string, number | null> with 20 rows x 3 columns. */
function makeRepresentativeData(): Map<string, number | null> {
	const data = new Map<string, number | null>();
	const cols = ['Category', 'Amount', 'Score'];
	const nullRows = new Set([3, 7, 15]);

	for (let r = 0; r < 20; r++) {
		for (const col of cols) {
			const key = `Row${r}:${col}`;
			if (nullRows.has(r)) {
				data.set(key, null);
			} else if (col === 'Amount') {
				// Duplicates: Row2 and Row5 share Amount=100 (for sort testing)
				if (r === 2 || r === 5) {
					data.set(key, 100);
				} else {
					data.set(key, 10 + r * 25); // varied integers 10..500 range
				}
			} else if (col === 'Score') {
				data.set(key, r * 5);
			} else {
				// Category — use integer index as value
				data.set(key, r);
			}
		}
	}

	return data;
}

// ---------------------------------------------------------------------------
// XPLG-01 — Full-matrix smoke: all 27 plugins enabled
// ---------------------------------------------------------------------------

describe('XPLG-01 — Full-matrix smoke: all 27 plugins enabled', () => {
	it('enables all 27 FEATURE_CATALOG plugins and runs pipeline without error', () => {
		const harness = makePluginHarness({
			rows: 20,
			cols: ['Category', 'Amount', 'Score'],
			containerHeight: 400,
			data: makeRepresentativeData(),
		});

		// Enable every plugin in the catalog
		for (const plugin of FEATURE_CATALOG) {
			expect(() => harness.enable(plugin.id), `enable(${plugin.id}) threw`).not.toThrow();
		}

		// Verify all are enabled (may auto-enable deps, but all are set via the loop)
		expect(harness.registry.getEnabled().length).toBe(FEATURE_CATALOG.length);

		// Run full pipeline — must not throw
		let result: ReturnType<typeof harness.runPipeline> | undefined;
		expect(() => {
			result = harness.runPipeline();
		}, 'runPipeline() with all 27 plugins enabled threw').not.toThrow();

		// Pipeline returns cells as an array
		expect(Array.isArray(result!.cells)).toBe(true);

		// Pipeline returns layout as an object with a numeric cellWidth
		expect(typeof result!.layout).toBe('object');
		expect(typeof result!.layout.cellWidth).toBe('number');
	});

	it('destroyAll() after full-matrix pipeline does not throw', () => {
		const harness = makePluginHarness({
			rows: 20,
			cols: ['Category', 'Amount', 'Score'],
			data: makeRepresentativeData(),
		});

		for (const plugin of FEATURE_CATALOG) {
			harness.enable(plugin.id);
		}

		harness.runPipeline();

		expect(() => harness.registry.destroyAll(), 'destroyAll() threw').not.toThrow();
	});
});
