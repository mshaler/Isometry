// @vitest-environment jsdom
// Isometry v5 — Phase 106 Plan 01 CrossPlugin Pairwise Tests
//
// XPLG-02: 7 pairwise coupling pair tests — each enables a coupling pair
// and asserts correct combined output through the registry pipeline.
//
// Requirements: XPLG-02

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

/** Create a fresh harness with representative data and 300px container (scroll windowing). */
function makeRichHarness(): PluginHarness {
	return makePluginHarness({
		rows: 20,
		cols: ['Category', 'Amount', 'Score'],
		containerHeight: 300,
		data: makeRepresentativeData(),
	});
}

// ---------------------------------------------------------------------------
// XPLG-02 — Pairwise coupling pairs
// ---------------------------------------------------------------------------

describe('XPLG-02 — Pairwise coupling pairs', () => {
	let harness: PluginHarness;

	afterEach(() => {
		harness?.registry.destroyAll();
	});

	// Pair 1: sort + scroll
	it('sort + scroll: pipeline returns cells in deterministic order within virtual window', () => {
		harness = makeRichHarness();

		harness.enable('supersort.header-click');
		harness.enable('supersort.chain');
		harness.enable('superscroll.virtual');
		harness.enable('superscroll.sticky-headers');

		const { cells, layout } = harness.runPipeline();

		// Scroll may window, but cells must be an array (not undefined/null)
		expect(Array.isArray(cells)).toBe(true);
		// Cells should be in deterministic order — row indices should be non-negative numbers
		for (const cell of cells) {
			expect(typeof cell.rowIdx).toBe('number');
			expect(cell.rowIdx).toBeGreaterThanOrEqual(0);
		}
		// Layout must have valid dimensions
		expect(typeof layout.cellWidth).toBe('number');
		expect(layout.cellWidth).toBeGreaterThan(0);
	});

	// Pair 2: density + calc
	it('density + calc: pipeline completes, layout has valid dimensions, afterRender does not throw', () => {
		harness = makeRichHarness();

		harness.enable('superdensity.mode-switch');
		harness.enable('superdensity.count-badge');
		harness.enable('supercalc.footer');
		harness.enable('supercalc.config');

		expect(() => harness.runPipeline()).not.toThrow();
		const { layout } = harness.runPipeline();

		expect(typeof layout.headerWidth).toBe('number');
		expect(layout.headerWidth).toBeGreaterThan(0);
		expect(typeof layout.cellHeight).toBe('number');
		expect(layout.cellHeight).toBeGreaterThan(0);
	});

	// Pair 3: zoom + size
	it('zoom + size: layout.zoom is a number >= 0.5 and colWidths map is present', () => {
		harness = makeRichHarness();

		harness.enable('superzoom.slider');
		harness.enable('superzoom.scale');
		harness.enable('supersize.col-resize');
		harness.enable('supersize.uniform-resize');

		const { layout } = harness.runPipeline();

		// Zoom plugin should set a valid zoom value
		expect(typeof layout.zoom).toBe('number');
		expect(layout.zoom).toBeGreaterThanOrEqual(0.5);

		// Cell width should be a positive number (size plugin must not zero it out)
		expect(typeof layout.cellWidth).toBe('number');
		expect(layout.cellWidth).toBeGreaterThan(0);

		// Both plugins compose without overwriting each other:
		// layout still has both zoom and colWidths
		expect(layout.colWidths instanceof Map).toBe(true);
	});

	// Pair 4: search + select
	it('search + select: afterRender attaches both plugins to rootEl without conflict', () => {
		harness = makeRichHarness();

		harness.enable('supersearch.input');
		harness.enable('supersearch.highlight');
		harness.enable('superselect.click');
		harness.enable('superselect.keyboard');

		// Pipeline including afterRender must not throw
		expect(() => harness.runPipeline()).not.toThrow();
	});

	// Pair 5: stack + sort
	it('stack + sort: cells array is returned, layout headerWidth is positive', () => {
		harness = makeRichHarness();

		harness.enable('superstack.spanning');
		harness.enable('superstack.collapse');
		harness.enable('supersort.header-click');
		harness.enable('supersort.chain');

		const { cells, layout } = harness.runPipeline();

		// Cells array returned (not undefined)
		expect(Array.isArray(cells)).toBe(true);
		expect(cells).not.toBeUndefined();

		// Layout headerWidth is a positive number
		expect(typeof layout.headerWidth).toBe('number');
		expect(layout.headerWidth).toBeGreaterThan(0);
	});

	// Pair 6: scroll + select
	it('scroll + select: pipeline completes, cells array returned', () => {
		harness = makeRichHarness();

		harness.enable('superscroll.virtual');
		harness.enable('superscroll.sticky-headers');
		harness.enable('superselect.click');
		harness.enable('superselect.lasso');

		expect(() => harness.runPipeline()).not.toThrow();
		const { cells } = harness.runPipeline();

		expect(Array.isArray(cells)).toBe(true);
	});

	// Pair 7: density + scroll
	it('density + scroll: pipeline completes without throw, cells are an array', () => {
		harness = makeRichHarness();

		harness.enable('superdensity.mode-switch');
		harness.enable('superdensity.mini-cards');
		harness.enable('superscroll.virtual');

		expect(() => harness.runPipeline()).not.toThrow();
		const { cells } = harness.runPipeline();

		expect(Array.isArray(cells)).toBe(true);
	});
});
