// Isometry v5 — Phase 37 Audit Color Constants
// Color constants and source type mappings for audit overlay rendering.
//
// IMPORTANT: These hex values MUST match the corresponding CSS custom properties
// in src/styles/design-tokens.css. They are intentionally duplicated because
// some SVG rendering paths set fill/stroke via D3 .attr() which historically
// required literal color values. Modern browsers support var() in SVG attributes
// but this file provides a JS-accessible fallback.
//
// Token mapping:
//   AUDIT_COLORS.new       -> --audit-new (#4ade80)
//   AUDIT_COLORS.modified  -> --audit-modified (#fb923c)
//   AUDIT_COLORS.deleted   -> --audit-deleted (#f87171)
//   SOURCE_COLORS.*        -> --source-* tokens in design-tokens.css
//
// AUDIT_COLORS: 3 change indicators (new/modified/deleted)
// SOURCE_COLORS: 9 source types with muted pastels optimized for dark background
// SOURCE_LABELS: Human-readable names for source types
//
// Requirements: AUDIT-04, AUDIT-05

/**
 * Change indicator colors for audit left-border stripe.
 * Green = new, Orange = modified, Red = deleted.
 */
export const AUDIT_COLORS: Record<'new' | 'modified' | 'deleted', string> = {
	new: '#4ade80',
	modified: '#fb923c',
	deleted: '#f87171',
};

/**
 * Source provenance colors for bottom-border stripe.
 * Muted pastel palette optimized for dark background (--bg-card: #1e1e2e).
 */
export const SOURCE_COLORS: Record<string, string> = {
	apple_notes: '#fbbf24', // warm amber
	markdown: '#a78bfa', // soft purple
	csv: '#34d399', // teal green
	json: '#60a5fa', // sky blue
	excel: '#2dd4bf', // cyan
	html: '#f472b6', // pink
	native_reminders: '#c084fc', // lavender
	native_calendar: '#fcd34d', // yellow gold
	native_notes: '#fdba74', // peach
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
 * @returns Hex color string, or null if source type is unknown.
 */
export function getSourceColor(source: string): string | null {
	return SOURCE_COLORS[source] ?? null;
}
