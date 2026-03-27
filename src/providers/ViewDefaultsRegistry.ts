// Isometry v10.0 — Phase 131 ViewDefaultsRegistry
// Static per-source-type SuperGrid axis defaults with ordered fallback resolution.
//
// Design:
//   - VIEW_DEFAULTS_REGISTRY is a frozen Map — compile-time constants, zero DB overhead
//   - Each entry maps a source type to priority-ordered colAxes/rowAxes candidate lists
//   - resolveDefaults() validates each candidate through SchemaProvider.isValidColumn()
//     before returning (SGDF-02 requirement)
//   - alto_index_* prefix types use exact 'alto_index' key match (D-07)
//
// Requirements: SGDF-01, SGDF-02, SGDF-03

import type { SchemaProvider } from './SchemaProvider';
import type { AxisMapping, ViewType } from './types';

// ---------------------------------------------------------------------------
// DefaultMapping
// ---------------------------------------------------------------------------

/**
 * Per-source-type default axis candidate lists.
 * Each array is priority-ordered: first valid column wins (D-04).
 */
export interface DefaultMapping {
	/** Priority-ordered fallback list for column axes. First valid wins. */
	colAxes: string[];
	/** Priority-ordered fallback list for row axes. First valid wins. */
	rowAxes: string[];
}

// ---------------------------------------------------------------------------
// VIEW_DEFAULTS_REGISTRY
// ---------------------------------------------------------------------------

/**
 * Frozen static Map from source type key to DefaultMapping.
 * Covers all 9 SourceType values plus 'alto_index' catch-all (D-02, D-06).
 */
export const VIEW_DEFAULTS_REGISTRY: ReadonlyMap<string, DefaultMapping> = Object.freeze(
	new Map<string, DefaultMapping>([
		['apple_notes', { colAxes: ['folder', 'card_type'], rowAxes: ['title', 'name'] }],
		['markdown', { colAxes: ['folder', 'card_type'], rowAxes: ['title', 'name'] }],
		['excel', { colAxes: ['card_type', 'folder'], rowAxes: ['name', 'title'] }],
		['csv', { colAxes: ['card_type', 'folder'], rowAxes: ['name', 'title'] }],
		['json', { colAxes: ['card_type', 'folder'], rowAxes: ['name', 'title'] }],
		['html', { colAxes: ['folder', 'card_type'], rowAxes: ['title', 'name'] }],
		['native_reminders', { colAxes: ['status', 'folder', 'card_type'], rowAxes: ['title', 'name'] }],
		['native_calendar', { colAxes: ['folder', 'card_type'], rowAxes: ['title', 'name'] }],
		['native_notes', { colAxes: ['folder', 'card_type'], rowAxes: ['title', 'name'] }],
		['alto_index', { colAxes: ['company', 'folder', 'card_type'], rowAxes: ['name', 'title'] }],
	]),
);

// ---------------------------------------------------------------------------
// resolveDefaults
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ViewRecommendation (OVDF-01, D-11)
// ---------------------------------------------------------------------------

/** View-specific axis/sort configuration applied after auto-switch (D-10, D-11). */
export interface ViewConfig {
	groupBy?: AxisMapping | null;
	xAxis?: AxisMapping | null;
	yAxis?: AxisMapping | null;
}

export interface ViewRecommendation {
	recommendedView: ViewType;
	/** View-specific axis config applied after switchTo (OVDF-02, D-11). Null when the view needs no extra axis config. */
	viewConfig: ViewConfig | null;
	toastMessage: string;
	tooltipText: string;
}

// ---------------------------------------------------------------------------
// VIEW_RECOMMENDATIONS
// ---------------------------------------------------------------------------

/**
 * Frozen static Map from source type key to ViewRecommendation.
 * Five entries: native_calendar, native_reminders, apple_notes, native_notes, alto_index.
 * Source types not listed here get no recommendation (SuperGrid defaults are sufficient).
 */
export const VIEW_RECOMMENDATIONS: ReadonlyMap<string, ViewRecommendation> = Object.freeze(
	new Map<string, ViewRecommendation>([
		[
			'native_calendar',
			{
				recommendedView: 'timeline',
				viewConfig: { groupBy: { field: 'folder', direction: 'asc' } },
				toastMessage: 'Switched to Timeline \u2014 best view for calendar data.',
				tooltipText: 'Recommended for calendar data',
			},
		],
		[
			'native_reminders',
			{
				recommendedView: 'timeline',
				viewConfig: { groupBy: { field: 'status', direction: 'asc' } },
				toastMessage: 'Switched to Timeline \u2014 best view for reminders.',
				tooltipText: 'Recommended for reminders',
			},
		],
		[
			'apple_notes',
			{
				recommendedView: 'tree',
				viewConfig: null,
				toastMessage: 'Switched to Tree \u2014 best view for Apple Notes.',
				tooltipText: 'Recommended for Apple Notes',
			},
		],
		[
			'native_notes',
			{
				recommendedView: 'tree',
				viewConfig: null,
				toastMessage: 'Switched to Tree \u2014 best view for Notes.',
				tooltipText: 'Recommended for Notes',
			},
		],
		[
			'alto_index',
			{
				recommendedView: 'network',
				viewConfig: null,
				toastMessage: 'Switched to Network \u2014 best view for Alto Index.',
				tooltipText: 'Recommended for Alto Index',
			},
		],
	]),
);

// ---------------------------------------------------------------------------
// resolveRecommendation
// ---------------------------------------------------------------------------

/**
 * Resolve the recommended view for a given source type.
 *
 * Lookup order: exact match first, then startsWith('alto_index') prefix match (D-07).
 * Returns null for source types with no recommendation (SuperGrid defaults suffice).
 */
export function resolveRecommendation(sourceType: string): ViewRecommendation | null {
	return (
		VIEW_RECOMMENDATIONS.get(sourceType) ??
		(sourceType.startsWith('alto_index') ? VIEW_RECOMMENDATIONS.get('alto_index') : null) ??
		null
	);
}

// ---------------------------------------------------------------------------
// resolveDefaults
// ---------------------------------------------------------------------------

/**
 * Resolve source-type-specific SuperGrid axis defaults against the actual schema.
 *
 * Lookup order: exact match first, then startsWith('alto_index') prefix match (D-07).
 * For each axis (col/row): iterate candidates, return first one that passes
 * schema.isValidColumn(candidate, 'cards'). If none valid, return [] for that axis (D-04).
 *
 * Returns empty axes when schema is null or no registry entry matches.
 */
export function resolveDefaults(
	sourceType: string,
	schema: SchemaProvider | null,
): { colAxes: AxisMapping[]; rowAxes: AxisMapping[] } {
	if (schema === null) {
		return { colAxes: [], rowAxes: [] };
	}

	// Exact match first, then alto_index prefix match (D-07)
	const mapping =
		VIEW_DEFAULTS_REGISTRY.get(sourceType) ??
		(sourceType.startsWith('alto_index') ? VIEW_DEFAULTS_REGISTRY.get('alto_index') : undefined);

	if (!mapping) {
		return { colAxes: [], rowAxes: [] };
	}

	const colAxes = resolveAxis(mapping.colAxes, schema);
	const rowAxes = resolveAxis(mapping.rowAxes, schema);
	return { colAxes, rowAxes };
}

/**
 * Find the first valid column from the candidate list.
 * Returns a single-element AxisMapping array, or [] if none are valid.
 */
function resolveAxis(candidates: string[], schema: SchemaProvider): AxisMapping[] {
	for (const candidate of candidates) {
		if (schema.isValidColumn(candidate, 'cards')) {
			return [{ field: candidate, direction: 'asc' }];
		}
	}
	return [];
}
