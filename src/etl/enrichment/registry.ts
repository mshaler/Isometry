// Isometry v5 — Enrichment Pipeline Registry
// Manages enricher registration and runs the pipeline on CanonicalCard[].
//
// Design:
//   - Enrichers run in registration order (first registered = first to run).
//   - Source-type filtering: only enrichers matching the source type execute.
//   - Pipeline is a pure function composition — no database access.

import type { CanonicalCard, SourceType } from '../types';
import type { Enricher } from './types';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const _enrichers: Enricher[] = [];

/**
 * Register an enricher. Runs in registration order during pipeline execution.
 * Duplicate IDs are rejected (idempotent — safe to call multiple times).
 */
export function registerEnricher(enricher: Enricher): void {
	if (_enrichers.some((e) => e.id === enricher.id)) return;
	_enrichers.push(enricher);
}

/**
 * Remove an enricher by ID. Returns true if removed, false if not found.
 * Primarily for testing — production code should not need this.
 */
export function unregisterEnricher(id: string): boolean {
	const idx = _enrichers.findIndex((e) => e.id === id);
	if (idx === -1) return false;
	_enrichers.splice(idx, 1);
	return true;
}

/** Returns a snapshot of registered enricher IDs (for testing/debugging). */
export function getRegisteredEnricherIds(): string[] {
	return _enrichers.map((e) => e.id);
}

// ---------------------------------------------------------------------------
// Pipeline Execution
// ---------------------------------------------------------------------------

/**
 * Run all applicable enrichers on a card array.
 *
 * @param cards - Parsed canonical cards (mutated in-place)
 * @param sourceType - The source type being imported (filters enrichers)
 * @returns The enriched cards (same array reference)
 */
export function runEnrichmentPipeline(cards: CanonicalCard[], sourceType: SourceType | string): CanonicalCard[] {
	for (const enricher of _enrichers) {
		if (enricher.appliesTo === '*' || enricher.appliesTo.includes(sourceType as SourceType)) {
			enricher.enrich(cards);
		}
	}
	return cards;
}
