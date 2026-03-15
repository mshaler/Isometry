// Isometry v5 — Phase 50 WCAG Contrast Ratio Calculation
// Pure functions for WCAG 2.1 AA contrast ratio verification.
//
// Implements the W3C relative luminance and contrast ratio formulae:
// https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
//
// Requirements: A11Y-01, A11Y-02

/**
 * Parse hex color (#RRGGBB or #RGB) to [r, g, b] in 0-255 range.
 * Throws on invalid input.
 */
export function parseHex(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	if (h.length === 3) {
		return [parseInt(h[0]! + h[0]!, 16), parseInt(h[1]! + h[1]!, 16), parseInt(h[2]! + h[2]!, 16)];
	}
	if (h.length === 6) {
		return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
	}
	throw new Error(`Invalid hex color: ${hex}`);
}

/**
 * Convert sRGB channel value (0-255) to linear luminance component.
 * Applies inverse gamma correction per the sRGB specification.
 */
export function linearize(c: number): number {
	const s = c / 255;
	return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/**
 * Calculate relative luminance of a hex color per WCAG 2.1.
 * Returns a value between 0 (black) and 1 (white).
 */
export function relativeLuminance(hex: string): number {
	const [r, g, b] = parseHex(hex);
	return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Calculate contrast ratio between two hex colors per WCAG 2.1.
 * Result is always >= 1. Higher values indicate more contrast.
 *
 * WCAG 2.1 AA requirements:
 *   - Normal text: >= 4.5:1
 *   - Large text / UI components: >= 3:1
 */
export function contrastRatio(hex1: string, hex2: string): number {
	const l1 = relativeLuminance(hex1);
	const l2 = relativeLuminance(hex2);
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}
