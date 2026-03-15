// Isometry v5 — Phase 58 Plan 01 (Task 2)
// Tests for SuperGrid semantic CSS classes in supergrid.css.
//
// These tests read the CSS file as text and assert on class/selector presence,
// since the test environment is Node (not jsdom/browser).
//
// Requirements: CSSB-02, CSSB-04, CSSB-05

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS_PATH = resolve(__dirname, '../../src/styles/supergrid.css');
const css = readFileSync(CSS_PATH, 'utf-8');

// ---------------------------------------------------------------------------
// .sg-cell — base data cell class
// ---------------------------------------------------------------------------

describe('supergrid.css — .sg-cell class (CSSB-02)', () => {
	it('.sg-cell rule exists', () => {
		expect(css).toMatch(/\.sg-cell\s*\{/);
	});

	it('.sg-cell uses var(--sg-gridline) for border', () => {
		const match = css.match(/\.sg-cell\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('var(--sg-gridline)');
	});

	it('.sg-cell uses var(--sg-cell-font-size) for font-size', () => {
		const match = css.match(/\.sg-cell\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('var(--sg-cell-font-size');
	});

	it('.sg-cell has min-height property', () => {
		const match = css.match(/\.sg-cell\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('min-height');
	});
});

// ---------------------------------------------------------------------------
// .sg-header — header cell class
// ---------------------------------------------------------------------------

describe('supergrid.css — .sg-header class (CSSB-02)', () => {
	it('.sg-header rule exists', () => {
		expect(css).toMatch(/\.sg-header\s*\{/);
	});

	it('.sg-header uses var(--sg-header-bg) for background-color', () => {
		const match = css.match(/\.sg-header\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('var(--sg-header-bg)');
	});

	it('.sg-header has font-weight: bold', () => {
		const match = css.match(/\.sg-header\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('font-weight');
	});

	it('.sg-header uses var(--sg-gridline) for border', () => {
		const match = css.match(/\.sg-header\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('var(--sg-gridline)');
	});
});

// ---------------------------------------------------------------------------
// .sg-selected — selection highlight class
// ---------------------------------------------------------------------------

describe('supergrid.css — .sg-selected class (CSSB-02)', () => {
	it('.sg-selected rule exists', () => {
		expect(css).toMatch(/\.sg-selected\s*\{/);
	});

	it('.sg-selected uses var(--sg-selection-bg) for background-color', () => {
		const match = css.match(/\.sg-selected\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('var(--sg-selection-bg)');
	});

	it('.sg-selected uses var(--sg-selection-border) for outline', () => {
		const match = css.match(/\.sg-selected\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('var(--sg-selection-border)');
	});
});

// ---------------------------------------------------------------------------
// .sg-row--alt — zebra striping class
// ---------------------------------------------------------------------------

describe('supergrid.css — .sg-row--alt class (CSSB-04)', () => {
	it('.sg-row--alt rule exists', () => {
		expect(css).toMatch(/\.sg-row--alt\s*\{/);
	});
});

// ---------------------------------------------------------------------------
// .sg-numeric — numeric cell alignment class
// ---------------------------------------------------------------------------

describe('supergrid.css — .sg-numeric class (CSSB-02)', () => {
	it('.sg-numeric rule exists', () => {
		expect(css).toMatch(/\.sg-numeric\s*\{/);
	});

	it('.sg-numeric uses var(--sg-number-font)', () => {
		const match = css.match(/\.sg-numeric\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('var(--sg-number-font)');
	});

	it('.sg-numeric has text-align: right', () => {
		const match = css.match(/\.sg-numeric\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('text-align: right');
	});
});

// ---------------------------------------------------------------------------
// .sg-row-index — row index gutter placeholder (Phase 60)
// ---------------------------------------------------------------------------

describe('supergrid.css — .sg-row-index class (CSSB-02)', () => {
	it('.sg-row-index rule exists', () => {
		expect(css).toMatch(/\.sg-row-index\s*\{/);
	});
});

// ---------------------------------------------------------------------------
// .sg-corner-cell — corner cell placeholder (Phase 60)
// ---------------------------------------------------------------------------

describe('supergrid.css — .sg-corner-cell class (CSSB-02)', () => {
	it('.sg-corner-cell rule exists', () => {
		expect(css).toMatch(/\.sg-corner-cell\s*\{/);
	});
});

// ---------------------------------------------------------------------------
// Mode-scoped padding selectors (CSSB-05)
// ---------------------------------------------------------------------------

describe('supergrid.css — mode-scoped selectors (CSSB-05)', () => {
	it('[data-view-mode="spreadsheet"] .sg-cell selector exists with --sg-cell-padding-spreadsheet', () => {
		expect(css).toContain('[data-view-mode="spreadsheet"] .sg-cell');
		// Extract the scoped block
		const match = css.match(/\[data-view-mode="spreadsheet"\]\s*\.sg-cell\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('--sg-cell-padding-spreadsheet');
	});

	it('[data-view-mode="matrix"] .sg-cell selector exists with --sg-cell-padding-matrix', () => {
		expect(css).toContain('[data-view-mode="matrix"] .sg-cell');
		const match = css.match(/\[data-view-mode="matrix"\]\s*\.sg-cell\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('--sg-cell-padding-matrix');
	});
});

// ---------------------------------------------------------------------------
// Mode-scoped zebra striping (CSSB-04)
// ---------------------------------------------------------------------------

describe('supergrid.css — mode-scoped zebra striping (CSSB-04)', () => {
	it('[data-view-mode="spreadsheet"] .sg-row--alt applies background-color', () => {
		const match = css.match(/\[data-view-mode="spreadsheet"\]\s*\.sg-row--alt\s*\{([^}]+)\}/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain('var(--sg-cell-alt-bg)');
	});

	it('[data-view-mode="matrix"] .sg-row--alt does NOT appear as a rule with background', () => {
		// Matrix mode should NOT have a zebra striping rule
		const match = css.match(/\[data-view-mode="matrix"\]\s*\.sg-row--alt\s*\{([^}]+)\}/);
		// Either the rule does not exist, or it does not set background-color
		if (match) {
			expect(match[1]).not.toContain('background-color');
		}
	});
});
