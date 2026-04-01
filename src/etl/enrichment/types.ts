// Isometry v5 — Import Enrichment Pipeline Types
// Pure function interface for transforming CanonicalCard[] between Parse and Dedup.
//
// Design:
//   - Enrichers are pure functions: cards in, cards out. No side effects.
//   - Each enricher declares which source types it applies to (or '*' for all).
//   - Enrichers may add fields to cards (e.g., folder_l1..folder_l4 from folder).
//   - Pipeline runs enrichers in registration order.
//   - Enrichers must be idempotent — re-running on already-enriched cards is safe.

import type { CanonicalCard, SourceType } from '../types';

// ---------------------------------------------------------------------------
// Enricher Interface
// ---------------------------------------------------------------------------

/**
 * An enricher transforms an array of CanonicalCards, typically adding
 * derived fields or normalizing existing ones.
 *
 * Enrichers are pure functions — they receive cards and return cards.
 * They may mutate the input array in-place for performance (the pipeline
 * owns the array between parse and dedup).
 */
export interface Enricher {
	/** Unique identifier for this enricher (e.g., 'folder-hierarchy'). */
	readonly id: string;

	/** Human-readable description for logging/debugging. */
	readonly description: string;

	/**
	 * Source types this enricher applies to.
	 * Use '*' to apply to all sources. Use specific source types to limit scope.
	 */
	readonly appliesTo: readonly SourceType[] | '*';

	/**
	 * Transform cards. May mutate in-place for performance.
	 * Must be idempotent — safe to run on already-enriched cards.
	 *
	 * @param cards - Array of parsed canonical cards
	 * @returns Enriched cards (may be same array reference)
	 */
	enrich(cards: CanonicalCard[]): CanonicalCard[];
}

/**
 * Extended CanonicalCard with enrichment-derived fields.
 * These fields are populated by enrichers and written to the database
 * as additional columns (schema migration adds them).
 *
 * CanonicalCard uses [key: string]: unknown for extensibility,
 * but this type documents the known enrichment fields.
 */
export interface EnrichedFields {
	/** Folder hierarchy level 1 (top-level folder) */
	folder_l1: string | null;
	/** Folder hierarchy level 2 */
	folder_l2: string | null;
	/** Folder hierarchy level 3 */
	folder_l3: string | null;
	/** Folder hierarchy level 4 (deepest supported level) */
	folder_l4: string | null;
}

/** All known enrichment field names. Used for SQL column writes. */
export const ENRICHED_FIELD_NAMES: readonly (keyof EnrichedFields)[] = [
	'folder_l1',
	'folder_l2',
	'folder_l3',
	'folder_l4',
] as const;
