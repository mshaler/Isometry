// @vitest-environment jsdom
// Isometry v5 — Exhaustive Pairwise Category Coverage
//
// All C(10,2) = 45 category pairs tested through the plugin pipeline.
// Each pair: enable all plugins in both categories → runPipeline() → assert
// cells array returned, layout valid, no throw. Data-driven for compactness.
//
// Categories (10): SuperSort, SuperSearch, SuperSelect, SuperDensity,
//   SuperCalc, SuperScroll, SuperStack, SuperZoom, SuperSize, SuperAudit
//
// Previous coverage (CrossPluginPairs.test.ts): 7 pairs
// This file: all 45 pairs — exhaustive 2-way category coverage

import { afterEach, describe, expect, it } from 'vitest';
import type { PluginHarness } from './helpers/makePluginHarness';
import { makePluginHarness } from './helpers/makePluginHarness';

// ---------------------------------------------------------------------------
// Category → plugin ID mapping
// ---------------------------------------------------------------------------

const CATEGORIES: Record<string, string[]> = {
	SuperSort: ['supersort.header-click', 'supersort.chain'],
	SuperSearch: ['supersearch.input', 'supersearch.highlight'],
	SuperSelect: ['superselect.click', 'superselect.lasso', 'superselect.keyboard'],
	SuperDensity: ['superdensity.mode-switch', 'superdensity.mini-cards', 'superdensity.count-badge'],
	SuperCalc: ['supercalc.footer', 'supercalc.config'],
	SuperScroll: ['superscroll.virtual', 'superscroll.sticky-headers'],
	SuperStack: ['superstack.spanning', 'superstack.collapse', 'superstack.aggregate'],
	SuperZoom: ['superzoom.slider', 'superzoom.scale'],
	SuperSize: ['supersize.col-resize', 'supersize.header-resize', 'supersize.uniform-resize'],
	SuperAudit: ['superaudit.overlay', 'superaudit.source'],
};

const CATEGORY_NAMES = Object.keys(CATEGORIES);

// ---------------------------------------------------------------------------
// Generate all C(10,2) = 45 pairs
// ---------------------------------------------------------------------------

const ALL_PAIRS: [string, string][] = [];
for (let i = 0; i < CATEGORY_NAMES.length; i++) {
	for (let j = i + 1; j < CATEGORY_NAMES.length; j++) {
		ALL_PAIRS.push([CATEGORY_NAMES[i]!, CATEGORY_NAMES[j]!]);
	}
}

// Sanity check: C(10,2) = 45
if (ALL_PAIRS.length !== 45) {
	throw new Error(`Expected 45 pairs, got ${ALL_PAIRS.length}`);
}

// ---------------------------------------------------------------------------
// Representative data (20 rows x 3 cols, nulls, duplicates)
// ---------------------------------------------------------------------------

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
				data.set(key, r === 2 || r === 5 ? 100 : 10 + r * 25);
			} else if (col === 'Score') {
				data.set(key, r * 5);
			} else {
				data.set(key, r);
			}
		}
	}
	return data;
}

// ---------------------------------------------------------------------------
// Exhaustive pairwise tests
// ---------------------------------------------------------------------------

describe('Exhaustive 2-way category pairs (45/45)', () => {
	let harness: PluginHarness;

	afterEach(() => {
		harness?.registry.destroyAll();
	});

	for (const [catA, catB] of ALL_PAIRS) {
		it(`${catA} + ${catB}: pipeline completes, cells array returned, layout valid`, () => {
			harness = makePluginHarness({
				rows: 20,
				cols: ['Category', 'Amount', 'Score'],
				containerHeight: 300,
				data: makeRepresentativeData(),
			});

			// Enable all plugins in category A
			for (const pluginId of CATEGORIES[catA]!) {
				harness.enable(pluginId);
			}

			// Enable all plugins in category B
			for (const pluginId of CATEGORIES[catB]!) {
				harness.enable(pluginId);
			}

			// Pipeline must not throw
			let result: ReturnType<typeof harness.runPipeline> | undefined;
			expect(() => {
				result = harness.runPipeline();
			}, `runPipeline() threw for ${catA} + ${catB}`).not.toThrow();

			// Cells must be a non-undefined array
			expect(Array.isArray(result!.cells)).toBe(true);

			// Layout must have valid positive dimensions
			expect(typeof result!.layout.cellWidth).toBe('number');
			expect(result!.layout.cellWidth).toBeGreaterThan(0);
			expect(typeof result!.layout.headerWidth).toBe('number');
			expect(result!.layout.headerWidth).toBeGreaterThan(0);
			expect(typeof result!.layout.cellHeight).toBe('number');
			expect(result!.layout.cellHeight).toBeGreaterThan(0);
		});
	}
});

// ---------------------------------------------------------------------------
// Verify pair count for documentation
// ---------------------------------------------------------------------------

describe('Pair coverage metadata', () => {
	it('generates exactly 45 pairs from 10 categories', () => {
		expect(ALL_PAIRS.length).toBe(45);
		expect(CATEGORY_NAMES.length).toBe(10);
	});
});
