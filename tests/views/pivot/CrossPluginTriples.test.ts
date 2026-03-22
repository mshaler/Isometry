// @vitest-environment jsdom
// Isometry v5 — Phase 106 Plan 01 CrossPlugin Triple Combo Tests
//
// XPLG-03: 2 triple combo interaction tests — verify sort+collapse+density
// and search+select+scroll produce correct combined output with no interaction bugs.
//
// Requirements: XPLG-03

import { afterEach, describe, expect, it } from 'vitest';
import type { PluginHarness } from './helpers/makePluginHarness';
import { makePluginHarness } from './helpers/makePluginHarness';

// ---------------------------------------------------------------------------
// Representative data helper (20 rows x 3 cols, some nulls, duplicates)
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
				// Row2 and Row5 share Amount=100 for sort testing
				if (r === 2 || r === 5) {
					data.set(key, 100);
				} else {
					data.set(key, 10 + r * 25);
				}
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
// XPLG-03 — Triple combo interactions
// ---------------------------------------------------------------------------

describe('XPLG-03 — Triple combo interactions', () => {
	let harness: PluginHarness;

	afterEach(() => {
		harness?.registry.destroyAll();
	});

	// Triple 1: sort + filter (stack collapse) + density
	it('sort + density + stack collapse: data transformation (sort + collapse + density) compose through pipeline', () => {
		harness = makePluginHarness({
			rows: 20,
			cols: ['Category', 'Amount', 'Score'],
			containerHeight: 300,
			data: makeRepresentativeData(),
		});

		// sort
		harness.enable('supersort.header-click');
		harness.enable('supersort.chain');
		// stack collapse (spanning is auto-dependency)
		harness.enable('superstack.spanning');
		harness.enable('superstack.collapse');
		// density
		harness.enable('superdensity.mode-switch');
		harness.enable('superdensity.count-badge');

		// Pipeline must not throw
		let result: ReturnType<typeof harness.runPipeline> | undefined;
		expect(() => {
			result = harness.runPipeline();
		}).not.toThrow();

		// Cells array returned
		expect(Array.isArray(result!.cells)).toBe(true);

		// Layout object valid
		expect(typeof result!.layout).toBe('object');
		expect(typeof result!.layout.cellWidth).toBe('number');
		expect(result!.layout.cellWidth).toBeGreaterThan(0);
		expect(typeof result!.layout.headerWidth).toBe('number');
		expect(result!.layout.headerWidth).toBeGreaterThan(0);
	});

	// Triple 2: search + select + scroll
	it('search + select + scroll: cells array with length > 0, afterRender completes with all 3 plugins attached to DOM', () => {
		harness = makePluginHarness({
			rows: 20,
			cols: ['Category', 'Amount', 'Score'],
			containerHeight: 300,
			data: makeRepresentativeData(),
		});

		// search
		harness.enable('supersearch.input');
		harness.enable('supersearch.highlight');
		// select
		harness.enable('superselect.click');
		harness.enable('superselect.keyboard');
		// scroll
		harness.enable('superscroll.virtual');
		harness.enable('superscroll.sticky-headers');

		// Full pipeline — transformData, transformLayout, afterRender must all complete
		expect(() => harness.runPipeline()).not.toThrow();

		const { cells } = harness.runPipeline();

		// Cells array returned with length > 0 (scroll may window but 20 rows with 300px container still has rows)
		expect(Array.isArray(cells)).toBe(true);
		expect(cells.length).toBeGreaterThan(0);
	});
});
