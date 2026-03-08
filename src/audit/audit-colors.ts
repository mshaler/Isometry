// Isometry v5 — Audit Color Constants (CSS var() references)
// Color constants and source type mappings for audit overlay rendering.
//
// These reference CSS custom properties defined in design-tokens.css via var().
// Modern browsers (Safari 15.4+) support var() in SVG presentation attributes
// set via D3's .attr(), so these work directly in both HTML and SVG contexts.
// The actual color values are defined in design-tokens.css and adapt to the
// active theme (dark/light/system).
//
// AUDIT_COLORS: 3 change indicators (new/modified/deleted)
// SOURCE_COLORS: 9 source types with theme-adaptive colors
// SOURCE_LABELS: Human-readable names for source types
//
// Requirements: AUDIT-04, AUDIT-05, THME-05

/**
 * Change indicator colors for audit left-border stripe.
 * References CSS custom properties so colors adapt to active theme.
 */
export const AUDIT_COLORS: Record<'new' | 'modified' | 'deleted', string> = {
	new: 'var(--audit-new)',
	modified: 'var(--audit-modified)',
	deleted: 'var(--audit-deleted)',
};

/**
 * Source provenance colors for bottom-border stripe.
 * References CSS custom properties so colors adapt to active theme.
 */
export const SOURCE_COLORS: Record<string, string> = {
	apple_notes: 'var(--source-apple-notes)',
	markdown: 'var(--source-markdown)',
	csv: 'var(--source-csv)',
	json: 'var(--source-json)',
	excel: 'var(--source-excel)',
	html: 'var(--source-html)',
	native_reminders: 'var(--source-native-reminders)',
	native_calendar: 'var(--source-native-calendar)',
	native_notes: 'var(--source-native-notes)',
};

/**
 * Human-readable labels for source types.
 * Used in legend panel and tooltips.
 */
export const SOURCE_LABELS: Record<string, string> = {
	apple_notes: 'Apple Notes',
	markdown: 'Markdown',
	csv: 'CSV',
	json: 'JSON',
	excel: 'Excel',
	html: 'HTML',
	native_reminders: 'Reminders',
	native_calendar: 'Calendar',
	native_notes: 'Notes',
};

/**
 * Get the provenance color for a source type.
 * @returns CSS var() reference string, or null if source type is unknown.
 */
export function getSourceColor(source: string): string | null {
	return SOURCE_COLORS[source] ?? null;
}
