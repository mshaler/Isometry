// Isometry v5 — Phase 55 Plan 01 + Phase 71 Plan 01
// LATCH family classification map for AxisField values.
//
// Requirements: PROP-02, DYNM-01, DYNM-02, DYNM-03, DYNM-04
//
// Design:
//   - Maps all 9 AxisField values to their LATCH family letter
//   - Location (L) has no AxisField members (location fields are FilterField-only)
//   - All constants frozen via Object.freeze for immutability
//   - LATCH_COLORS uses CSS custom property references from design-tokens.css
//
// Phase 71 additions:
//   - toLetter/toFullName bridge between protocol LatchFamily (full name) and UI LatchFamily (letter)
//   - getLatchFamily() delegates to SchemaProvider when wired, falls back to LATCH_FAMILIES_FALLBACK
//   - setLatchSchemaProvider() module-level injection (same pattern as allowlist.ts)

import type { LatchFamily as SchemaLatchFamily } from '../worker/protocol';
import type { SchemaProvider } from './SchemaProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One of the five LATCH information architecture families (UI letter form). */
export type LatchFamily = 'L' | 'A' | 'T' | 'C' | 'H';

// ---------------------------------------------------------------------------
// Phase 71: Mapping bridge between protocol LatchFamily and UI LatchFamily
// ---------------------------------------------------------------------------

/**
 * Maps protocol LatchFamily (full name) to UI LatchFamily (single letter).
 * SchemaProvider.ColumnInfo uses full names; UI components use letters.
 */
const FAMILY_TO_LETTER: Readonly<Record<SchemaLatchFamily, LatchFamily>> = Object.freeze({
	Location: 'L',
	Alphabet: 'A',
	Time: 'T',
	Category: 'C',
	Hierarchy: 'H',
});

/**
 * Maps UI LatchFamily (single letter) to protocol LatchFamily (full name).
 * Reverse mapping for toLetter's inverse.
 */
const LETTER_TO_FAMILY: Readonly<Record<LatchFamily, SchemaLatchFamily>> = Object.freeze({
	L: 'Location',
	A: 'Alphabet',
	T: 'Time',
	C: 'Category',
	H: 'Hierarchy',
});

/**
 * Convert a protocol LatchFamily (full name) to a UI LatchFamily (letter).
 * Example: toLetter('Time') === 'T'
 */
export function toLetter(family: SchemaLatchFamily): LatchFamily {
	return FAMILY_TO_LETTER[family];
}

/**
 * Convert a UI LatchFamily (letter) to a protocol LatchFamily (full name).
 * Example: toFullName('T') === 'Time'
 */
export function toFullName(letter: LatchFamily): SchemaLatchFamily {
	return LETTER_TO_FAMILY[letter];
}

// ---------------------------------------------------------------------------
// Phase 71: SchemaProvider delegation (module-level singleton reference)
// ---------------------------------------------------------------------------

/** Module-level SchemaProvider reference. Null until setLatchSchemaProvider() is called. */
let _schemaProvider: SchemaProvider | null = null;

/**
 * Wire SchemaProvider for dynamic LATCH family lookup.
 * Called from main.ts after `await bridge.isReady` ensures schema is populated.
 *
 * When wired:
 *   - getLatchFamily() looks up field in SchemaProvider.getColumns('cards')
 *   - Returns toLetter(col.latchFamily) when field is found
 *
 * When NOT wired (null):
 *   - getLatchFamily() falls back to LATCH_FAMILIES_FALLBACK
 *
 * Passing null resets delegation (used in tests for cleanup).
 */
export function setLatchSchemaProvider(sp: SchemaProvider | null): void {
	_schemaProvider = sp;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maps each AxisField to its LATCH family (fallback for non-SchemaProvider contexts).
 *
 * Phase 71: Renamed from LATCH_FAMILIES to LATCH_FAMILIES_FALLBACK.
 * Type widened from Record<AxisField, LatchFamily> to Record<string, LatchFamily>
 * since AxisField is now open (string & {}).
 *
 * - Alphabet (A): name
 * - Time (T): created_at, modified_at, due_at
 * - Category (C): folder, status, card_type
 * - Hierarchy (H): priority, sort_order
 *
 * Location (L) has no AxisField members -- location fields
 * (latitude, longitude, location_name) are FilterField-only.
 */
export const LATCH_FAMILIES_FALLBACK: Readonly<Record<string, LatchFamily>> = Object.freeze({
	name: 'A',
	created_at: 'T',
	modified_at: 'T',
	due_at: 'T',
	folder: 'C',
	status: 'C',
	card_type: 'C',
	priority: 'H',
	sort_order: 'H',
});

/**
 * Backward-compat alias for LATCH_FAMILIES_FALLBACK.
 * Phase 71: Re-exported as LATCH_FAMILIES for consumers not yet migrated.
 * Will be removed in DYNM-13 audit once all consumers use getLatchFamily().
 */
export const LATCH_FAMILIES: Readonly<Record<string, LatchFamily>> = LATCH_FAMILIES_FALLBACK;

/** Canonical display order for LATCH families. */
export const LATCH_ORDER: readonly LatchFamily[] = Object.freeze(['L', 'A', 'T', 'C', 'H'] as const);

/** Human-readable labels for each LATCH family. */
export const LATCH_LABELS: Readonly<Record<LatchFamily, string>> = Object.freeze({
	L: 'Location',
	A: 'Alphabet',
	T: 'Time',
	C: 'Category',
	H: 'Hierarchy',
});

/** CSS custom property references for LATCH family colors. */
export const LATCH_COLORS: Readonly<Record<LatchFamily, string>> = Object.freeze({
	L: 'var(--latch-location)',
	A: 'var(--latch-alphabet)',
	T: 'var(--latch-time)',
	C: 'var(--latch-category)',
	H: 'var(--latch-hierarchy)',
});

// ---------------------------------------------------------------------------
// Phase 71: Dynamic LATCH family lookup
// ---------------------------------------------------------------------------

/**
 * Get the UI LatchFamily (letter) for a given field name.
 *
 * When SchemaProvider is wired (setLatchSchemaProvider was called):
 *   - Looks up field in SchemaProvider.getColumns('cards')
 *   - Returns toLetter(col.latchFamily) when found
 *   - Falls back to LATCH_FAMILIES_FALLBACK[field] ?? 'A' if not found in schema
 *
 * When SchemaProvider is NOT wired (null):
 *   - Returns LATCH_FAMILIES_FALLBACK[field] ?? 'A'
 *   - 'A' (Alphabet) is the default for unknown fields
 *
 * @param field - Column name to look up
 * @returns LatchFamily letter ('L', 'A', 'T', 'C', or 'H')
 */
export function getLatchFamily(field: string): LatchFamily {
	if (_schemaProvider?.initialized) {
		const columns = _schemaProvider.getColumns('cards');
		const col = columns.find((c) => c.name === field);
		if (col) {
			return toLetter(col.latchFamily);
		}
	}
	return LATCH_FAMILIES_FALLBACK[field] ?? 'A';
}
