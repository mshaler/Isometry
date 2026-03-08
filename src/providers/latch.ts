// Isometry v5 — Phase 55 Plan 01
// LATCH family classification map for AxisField values.
//
// Requirements: PROP-02
//
// Design:
//   - Maps all 9 AxisField values to their LATCH family letter
//   - Location (L) has no AxisField members (location fields are FilterField-only)
//   - All constants frozen via Object.freeze for immutability
//   - LATCH_COLORS uses CSS custom property references from design-tokens.css

import type { AxisField } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One of the five LATCH information architecture families. */
export type LatchFamily = 'L' | 'A' | 'T' | 'C' | 'H';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maps each AxisField to its LATCH family.
 *
 * - Alphabet (A): name
 * - Time (T): created_at, modified_at, due_at
 * - Category (C): folder, status, card_type
 * - Hierarchy (H): priority, sort_order
 *
 * Location (L) has no AxisField members -- location fields
 * (latitude, longitude, location_name) are FilterField-only.
 */
export const LATCH_FAMILIES: Readonly<Record<AxisField, LatchFamily>> = Object.freeze({
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
