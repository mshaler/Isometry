// Isometry v5 — Phase 49 Plan 01 (Task 1)
// Tests for multi-theme CSS token system in design-tokens.css.
//
// These tests read the CSS file as text and assert on token structure,
// since the test environment is Node (not jsdom/browser).
//
// Requirements: THME-02, THME-07

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS_PATH = resolve(__dirname, '../../src/styles/design-tokens.css');
const css = readFileSync(CSS_PATH, 'utf-8');

const HTML_PATH = resolve(__dirname, '../../index.html');
const html = readFileSync(HTML_PATH, 'utf-8');

// ---------------------------------------------------------------------------
// Dark palette values match current :root values (no regression)
// ---------------------------------------------------------------------------

describe('design-tokens.css — dark palette (no regression)', () => {
	it(':root block defines --bg-primary as dark color', () => {
		// The :root (or :root, [data-theme="dark"]) block must define --bg-primary: #1a1a2e
		expect(css).toContain('--bg-primary: #1a1a2e');
	});

	it(':root block defines --text-primary as light text', () => {
		expect(css).toContain('--text-primary: #e0e0e0');
	});

	it(':root block defines --accent as blue', () => {
		expect(css).toContain('--accent: #4a9eff');
	});

	it('[data-theme="dark"] selector exists', () => {
		expect(css).toContain('[data-theme="dark"]');
	});
});

// ---------------------------------------------------------------------------
// Light palette defines all tokens
// ---------------------------------------------------------------------------

describe('design-tokens.css — light palette', () => {
	it('[data-theme="light"] block exists', () => {
		expect(css).toContain('[data-theme="light"]');
	});

	it('light palette defines --bg-primary as white/light', () => {
		// Extract the light block and check it has a light --bg-primary
		const lightMatch = css.match(/\[data-theme="light"\]\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
		expect(lightMatch).not.toBeNull();
		const lightBlock = lightMatch![1];
		expect(lightBlock).toContain('--bg-primary:');
		// Should be a light color (not #1a1a2e)
		expect(lightBlock).not.toContain('--bg-primary: #1a1a2e');
	});

	it('light palette defines all core background tokens', () => {
		const lightMatch = css.match(/\[data-theme="light"\]\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
		expect(lightMatch).not.toBeNull();
		const lightBlock = lightMatch![1];
		for (const token of ['--bg-primary', '--bg-secondary', '--bg-card', '--bg-surface']) {
			expect(lightBlock).toContain(token);
		}
	});

	it('light palette defines all text tokens', () => {
		const lightMatch = css.match(/\[data-theme="light"\]\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
		expect(lightMatch).not.toBeNull();
		const lightBlock = lightMatch![1];
		for (const token of ['--text-primary', '--text-secondary', '--text-muted']) {
			expect(lightBlock).toContain(token);
		}
	});

	it('light palette defines accent and status tokens', () => {
		const lightMatch = css.match(/\[data-theme="light"\]\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
		expect(lightMatch).not.toBeNull();
		const lightBlock = lightMatch![1];
		for (const token of ['--accent:', '--accent-hover:', '--danger:']) {
			expect(lightBlock).toContain(token);
		}
	});

	it('light palette defines audit tokens', () => {
		const lightMatch = css.match(/\[data-theme="light"\]\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
		expect(lightMatch).not.toBeNull();
		const lightBlock = lightMatch![1];
		for (const token of ['--audit-new', '--audit-modified', '--audit-deleted']) {
			expect(lightBlock).toContain(token);
		}
	});

	it('light palette defines source provenance tokens', () => {
		const lightMatch = css.match(/\[data-theme="light"\]\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
		expect(lightMatch).not.toBeNull();
		const lightBlock = lightMatch![1];
		for (const token of [
			'--source-apple-notes',
			'--source-markdown',
			'--source-csv',
			'--source-json',
			'--source-excel',
			'--source-html',
			'--source-native-reminders',
			'--source-native-calendar',
			'--source-native-notes',
		]) {
			expect(lightBlock).toContain(token);
		}
	});

	it('light palette defines all derived tokens', () => {
		const lightMatch = css.match(/\[data-theme="light"\]\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
		expect(lightMatch).not.toBeNull();
		const lightBlock = lightMatch![1];
		for (const token of [
			'--danger-bg',
			'--danger-border',
			'--accent-bg',
			'--accent-border',
			'--border-subtle',
			'--border-muted',
			'--overlay-bg',
			'--overlay-shadow',
			'--overlay-shadow-heavy',
			'--cell-hover',
			'--cell-alt',
			'--cell-empty-bg',
			'--selection-bg',
			'--selection-outline',
			'--search-highlight',
			'--search-match-outline',
		]) {
			expect(lightBlock).toContain(token);
		}
	});
});

// ---------------------------------------------------------------------------
// System theme with prefers-color-scheme media query
// ---------------------------------------------------------------------------

describe('design-tokens.css — system theme', () => {
	it('[data-theme="system"] selector exists', () => {
		expect(css).toContain('[data-theme="system"]');
	});

	it('@media (prefers-color-scheme: light) block exists with system selector', () => {
		expect(css).toContain('prefers-color-scheme: light');
		// The media query should contain [data-theme="system"]
		const mediaMatch = css.match(/@media\s*\(\s*prefers-color-scheme:\s*light\s*\)\s*\{([^}]+(?:\{[^}]*\})*)/);
		expect(mediaMatch).not.toBeNull();
		expect(mediaMatch![0]).toContain('[data-theme="system"]');
	});
});

// ---------------------------------------------------------------------------
// Body styled with var() tokens
// ---------------------------------------------------------------------------

describe('design-tokens.css — body styling', () => {
	it('body has background-color set via var(--bg-primary)', () => {
		expect(css).toContain('background-color: var(--bg-primary)');
	});

	it('body has color set via var(--text-primary)', () => {
		expect(css).toContain('color: var(--text-primary)');
	});
});

// ---------------------------------------------------------------------------
// Theme transition CSS
// ---------------------------------------------------------------------------

describe('design-tokens.css — theme transition', () => {
	it('--theme-transition variable defined with 200ms timing', () => {
		expect(css).toContain('--theme-transition:');
		expect(css).toMatch(/200ms/);
	});

	it('.no-theme-transition class disables all transitions', () => {
		expect(css).toContain('.no-theme-transition');
		expect(css).toContain('transition: none !important');
	});
});

// ---------------------------------------------------------------------------
// --drag-over-bg token
// ---------------------------------------------------------------------------

describe('design-tokens.css — drag-over-bg token', () => {
	it('--drag-over-bg token exists in dark palette', () => {
		expect(css).toContain('--drag-over-bg');
	});
});

// ---------------------------------------------------------------------------
// index.html has data-theme="dark" default
// ---------------------------------------------------------------------------

describe('index.html — FOWT prevention', () => {
	it('html element has data-theme="dark" attribute', () => {
		expect(html).toContain('data-theme="dark"');
	});
});

// ---------------------------------------------------------------------------
// SuperGrid --sg-* tokens (CSSB-01)
// ---------------------------------------------------------------------------

describe('design-tokens.css -- SuperGrid --sg-* tokens (CSSB-01)', () => {
	// ---- Dark palette (:root) contains all 9 --sg-* tokens ----
	const darkTokens = [
		'--sg-cell-alt-bg',
		'--sg-header-bg',
		'--sg-gridline',
		'--sg-selection-border',
		'--sg-selection-bg',
	];

	for (const token of darkTokens) {
		it(`dark palette (:root) contains ${token}`, () => {
			// Extract the :root,[data-theme="dark"] block
			const rootMatch = css.match(/:root,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
			expect(rootMatch).not.toBeNull();
			expect(rootMatch![1]).toContain(token);
		});
	}

	// ---- Theme-independent :root tokens ----
	const themeIndependentTokens = [
		'--sg-cell-padding-spreadsheet',
		'--sg-cell-padding-matrix',
		'--sg-cell-font-size',
		'--sg-number-font',
		'--sg-frozen-shadow',
	];

	for (const token of themeIndependentTokens) {
		it(`theme-independent :root contains ${token}`, () => {
			expect(css).toContain(token);
		});
	}

	// ---- Light palette overrides ----
	const lightOverrideTokens = [
		'--sg-cell-alt-bg',
		'--sg-header-bg',
		'--sg-gridline',
		'--sg-selection-border',
		'--sg-selection-bg',
	];

	for (const token of lightOverrideTokens) {
		it(`light palette [data-theme="light"] contains ${token}`, () => {
			const lightMatch = css.match(/\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/);
			expect(lightMatch).not.toBeNull();
			expect(lightMatch![1]).toContain(token);
		});
	}

	// ---- System palette overrides ----
	for (const token of lightOverrideTokens) {
		it(`system palette @media (prefers-color-scheme: light) contains ${token}`, () => {
			const mediaMatch = css.match(/@media\s*\(\s*prefers-color-scheme:\s*light\s*\)\s*\{([\s\S]*?)\n\s*\}/);
			expect(mediaMatch).not.toBeNull();
			expect(mediaMatch![1]).toContain(token);
		});
	}

	// ---- .sg-cell in theme transition selector list ----
	it('.sg-cell is in the theme transition selector list', () => {
		// The transition rule block with body, .card, .data-cell, etc.
		expect(css).toMatch(/\.sg-cell[\s,{]/);
	});
});
