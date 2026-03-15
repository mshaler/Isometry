// Isometry v5 — Phase 50 Contrast Ratio Regression Tests
// Validates WCAG 2.1 AA contrast ratios for all design token pairs.
//
// Strategy: Parse design-tokens.css statically to extract hex values,
// then apply the WCAG contrast formula. No browser/jsdom needed.
//
// Requirements: A11Y-01, A11Y-02

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, linearize, parseHex, relativeLuminance } from '../../src/accessibility/contrast';

// ---------------------------------------------------------------------------
// Token extraction from CSS
// ---------------------------------------------------------------------------

const CSS_PATH = path.resolve(__dirname, '../../src/styles/design-tokens.css');
const css = fs.readFileSync(CSS_PATH, 'utf-8');

/**
 * Extract hex token values from a CSS block.
 * Returns a Map of token name -> hex value (e.g. '--text-primary' -> '#e0e0e0').
 */
function extractTokens(block: string): Map<string, string> {
	const tokens = new Map<string, string>();
	const regex = /--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/g;
	for (const match of block.matchAll(regex)) {
		tokens.set(`--${match[1]}`, match[2]!);
	}
	return tokens;
}

/**
 * Extract the dark theme block (:root, [data-theme="dark"]) tokens.
 */
function extractDarkTokens(): Map<string, string> {
	// Match the first block that starts with :root or [data-theme="dark"]
	const darkMatch = css.match(/:root,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
	if (!darkMatch) throw new Error('Could not find dark theme block in design-tokens.css');
	return extractTokens(darkMatch[1]!);
}

/**
 * Extract the light theme block ([data-theme="light"]) tokens.
 */
function extractLightTokens(): Map<string, string> {
	const lightMatch = css.match(/\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/);
	if (!lightMatch) throw new Error('Could not find light theme block in design-tokens.css');
	return extractTokens(lightMatch[1]!);
}

const darkTokens = extractDarkTokens();
const lightTokens = extractLightTokens();

// Helper to get token value or fail
function getToken(tokens: Map<string, string>, name: string): string {
	const value = tokens.get(name);
	if (!value) throw new Error(`Token ${name} not found`);
	return value;
}

// ---------------------------------------------------------------------------
// Formula validation tests
// ---------------------------------------------------------------------------

describe('WCAG Contrast Formula', () => {
	it('parseHex handles #RRGGBB format', () => {
		expect(parseHex('#ffffff')).toEqual([255, 255, 255]);
		expect(parseHex('#000000')).toEqual([0, 0, 0]);
		expect(parseHex('#4a9eff')).toEqual([74, 158, 255]);
	});

	it('parseHex handles #RGB shorthand', () => {
		expect(parseHex('#fff')).toEqual([255, 255, 255]);
		expect(parseHex('#000')).toEqual([0, 0, 0]);
		expect(parseHex('#abc')).toEqual([170, 187, 204]);
	});

	it('parseHex throws on invalid length', () => {
		expect(() => parseHex('#ab')).toThrow('Invalid hex color');
		expect(() => parseHex('#abcde')).toThrow('Invalid hex color');
		expect(() => parseHex('')).toThrow('Invalid hex color');
	});

	it('linearize returns 0 for 0 and ~1 for 255', () => {
		expect(linearize(0)).toBe(0);
		expect(linearize(255)).toBeCloseTo(1.0, 4);
	});

	it('relativeLuminance returns 0 for black and 1 for white', () => {
		expect(relativeLuminance('#000000')).toBeCloseTo(0, 4);
		expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 4);
	});

	it('black on white contrast ratio is 21:1', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
	});

	it('same color returns 1:1', () => {
		expect(contrastRatio('#4a9eff', '#4a9eff')).toBeCloseTo(1, 4);
	});

	it('contrast ratio is symmetric', () => {
		const r1 = contrastRatio('#e0e0e0', '#1a1a2e');
		const r2 = contrastRatio('#1a1a2e', '#e0e0e0');
		expect(r1).toBeCloseTo(r2, 4);
	});
});

// ---------------------------------------------------------------------------
// Dark theme text contrast (4.5:1 minimum)
// ---------------------------------------------------------------------------

describe('Dark Theme — Text Contrast (4.5:1)', () => {
	const textTokens = ['--text-primary', '--text-secondary', '--text-muted'];
	const bgTokens = ['--bg-primary', '--bg-card'];

	for (const text of textTokens) {
		for (const bg of bgTokens) {
			it(`${text} on ${bg} >= 4.5:1`, () => {
				const fg = getToken(darkTokens, text);
				const bgVal = getToken(darkTokens, bg);
				const ratio = contrastRatio(fg, bgVal);
				expect(ratio).toBeGreaterThanOrEqual(4.5);
			});
		}
	}
});

// ---------------------------------------------------------------------------
// Light theme text contrast (4.5:1 minimum)
// ---------------------------------------------------------------------------

describe('Light Theme — Text Contrast (4.5:1)', () => {
	const textTokens = ['--text-primary', '--text-secondary', '--text-muted'];
	const bgTokens = ['--bg-primary', '--bg-card'];

	for (const text of textTokens) {
		for (const bg of bgTokens) {
			it(`${text} on ${bg} >= 4.5:1`, () => {
				const fg = getToken(lightTokens, text);
				const bgVal = getToken(lightTokens, bg);
				const ratio = contrastRatio(fg, bgVal);
				expect(ratio).toBeGreaterThanOrEqual(4.5);
			});
		}
	}
});

// ---------------------------------------------------------------------------
// Dark theme source provenance colors (4.5:1 as text labels)
// ---------------------------------------------------------------------------

describe('Dark Theme — Source Color Contrast (4.5:1)', () => {
	const sourceTokens = [
		'--source-apple-notes',
		'--source-markdown',
		'--source-csv',
		'--source-json',
		'--source-excel',
		'--source-html',
		'--source-native-reminders',
		'--source-native-calendar',
		'--source-native-notes',
	];
	const bgTokens = ['--bg-primary', '--bg-card'];

	for (const src of sourceTokens) {
		for (const bg of bgTokens) {
			it(`${src} on ${bg} >= 4.5:1`, () => {
				const fg = getToken(darkTokens, src);
				const bgVal = getToken(darkTokens, bg);
				const ratio = contrastRatio(fg, bgVal);
				expect(ratio).toBeGreaterThanOrEqual(4.5);
			});
		}
	}
});

// ---------------------------------------------------------------------------
// Light theme source provenance colors (4.5:1 as text labels)
// ---------------------------------------------------------------------------

describe('Light Theme — Source Color Contrast (4.5:1)', () => {
	const sourceTokens = [
		'--source-apple-notes',
		'--source-markdown',
		'--source-csv',
		'--source-json',
		'--source-excel',
		'--source-html',
		'--source-native-reminders',
		'--source-native-calendar',
		'--source-native-notes',
	];
	const bgTokens = ['--bg-primary', '--bg-card'];

	for (const src of sourceTokens) {
		for (const bg of bgTokens) {
			it(`${src} on ${bg} >= 4.5:1`, () => {
				const fg = getToken(lightTokens, src);
				const bgVal = getToken(lightTokens, bg);
				const ratio = contrastRatio(fg, bgVal);
				expect(ratio).toBeGreaterThanOrEqual(4.5);
			});
		}
	}
});

// ---------------------------------------------------------------------------
// Dark theme UI component contrast (3:1 minimum)
// ---------------------------------------------------------------------------

describe('Dark Theme — UI Component Contrast (3:1)', () => {
	const uiTokens = ['--accent', '--danger'];
	const bgTokens = ['--bg-primary', '--bg-card'];

	for (const ui of uiTokens) {
		for (const bg of bgTokens) {
			it(`${ui} on ${bg} >= 3:1`, () => {
				const fg = getToken(darkTokens, ui);
				const bgVal = getToken(darkTokens, bg);
				const ratio = contrastRatio(fg, bgVal);
				expect(ratio).toBeGreaterThanOrEqual(3.0);
			});
		}
	}

	// Audit overlay colors (non-text UI)
	const auditTokens = ['--audit-new', '--audit-modified', '--audit-deleted'];
	for (const audit of auditTokens) {
		it(`${audit} on --bg-card >= 3:1`, () => {
			const fg = getToken(darkTokens, audit);
			const bgVal = getToken(darkTokens, '--bg-card');
			const ratio = contrastRatio(fg, bgVal);
			expect(ratio).toBeGreaterThanOrEqual(3.0);
		});
	}
});

// ---------------------------------------------------------------------------
// Light theme UI component contrast (3:1 minimum)
// ---------------------------------------------------------------------------

describe('Light Theme — UI Component Contrast (3:1)', () => {
	const uiTokens = ['--accent', '--danger'];
	const bgTokens = ['--bg-primary', '--bg-card'];

	for (const ui of uiTokens) {
		for (const bg of bgTokens) {
			it(`${ui} on ${bg} >= 3:1`, () => {
				const fg = getToken(lightTokens, ui);
				const bgVal = getToken(lightTokens, bg);
				const ratio = contrastRatio(fg, bgVal);
				expect(ratio).toBeGreaterThanOrEqual(3.0);
			});
		}
	}

	// Audit overlay colors (non-text UI)
	const auditTokens = ['--audit-new', '--audit-modified', '--audit-deleted'];
	for (const audit of auditTokens) {
		it(`${audit} on --bg-card >= 3:1`, () => {
			const fg = getToken(lightTokens, audit);
			const bgVal = getToken(lightTokens, '--bg-card');
			const ratio = contrastRatio(fg, bgVal);
			expect(ratio).toBeGreaterThanOrEqual(3.0);
		});
	}
});
