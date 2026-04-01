// Isometry v5 — Enrichment Registry Tests

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	getRegisteredEnricherIds,
	registerEnricher,
	runEnrichmentPipeline,
	unregisterEnricher,
} from '../../../src/etl/enrichment/registry';
import type { Enricher } from '../../../src/etl/enrichment/types';
import type { CanonicalCard } from '../../../src/etl/types';

function makeTestEnricher(id: string, appliesTo: Enricher['appliesTo'] = '*'): Enricher & { calls: number } {
	const enricher = {
		id,
		description: `Test enricher ${id}`,
		appliesTo,
		calls: 0,
		enrich(cards: CanonicalCard[]): CanonicalCard[] {
			enricher.calls++;
			return cards;
		},
	};
	return enricher;
}

describe('Enrichment Registry', () => {
	// Clean up test enrichers after each test (don't remove built-in ones)
	const testIds: string[] = [];

	afterEach(() => {
		for (const id of testIds) {
			unregisterEnricher(id);
		}
		testIds.length = 0;
	});

	function registerTest(enricher: Enricher) {
		testIds.push(enricher.id);
		registerEnricher(enricher);
	}

	describe('registerEnricher', () => {
		it('registers an enricher', () => {
			const e = makeTestEnricher('test-reg-1');
			registerTest(e);
			expect(getRegisteredEnricherIds()).toContain('test-reg-1');
		});

		it('rejects duplicate IDs (idempotent)', () => {
			const e1 = makeTestEnricher('test-dup-1');
			const e2 = makeTestEnricher('test-dup-1');
			registerTest(e1);
			registerEnricher(e2); // Should be silently ignored
			// Only one instance
			const ids = getRegisteredEnricherIds().filter((id) => id === 'test-dup-1');
			expect(ids).toHaveLength(1);
		});
	});

	describe('unregisterEnricher', () => {
		it('removes an enricher by ID', () => {
			const e = makeTestEnricher('test-unreg-1');
			registerEnricher(e);
			expect(unregisterEnricher('test-unreg-1')).toBe(true);
			expect(getRegisteredEnricherIds()).not.toContain('test-unreg-1');
		});

		it('returns false for unknown ID', () => {
			expect(unregisterEnricher('nonexistent')).toBe(false);
		});
	});

	describe('runEnrichmentPipeline', () => {
		it('runs all enrichers with appliesTo = *', () => {
			const e = makeTestEnricher('test-run-all');
			registerTest(e);

			runEnrichmentPipeline([], 'apple_notes');
			expect(e.calls).toBe(1);
		});

		it('skips enrichers that do not match source type', () => {
			const e = makeTestEnricher('test-skip-source', ['csv']);
			registerTest(e);

			runEnrichmentPipeline([], 'apple_notes');
			expect(e.calls).toBe(0);
		});

		it('runs enrichers matching specific source type', () => {
			const e = makeTestEnricher('test-match-source', ['apple_notes', 'markdown']);
			registerTest(e);

			runEnrichmentPipeline([], 'apple_notes');
			expect(e.calls).toBe(1);
		});

		it('runs enrichers in registration order', () => {
			const order: string[] = [];
			const e1: Enricher = {
				id: 'test-order-1',
				description: 'First',
				appliesTo: '*',
				enrich(cards) {
					order.push('first');
					return cards;
				},
			};
			const e2: Enricher = {
				id: 'test-order-2',
				description: 'Second',
				appliesTo: '*',
				enrich(cards) {
					order.push('second');
					return cards;
				},
			};
			registerTest(e1);
			registerTest(e2);

			runEnrichmentPipeline([], 'csv');
			expect(order).toEqual(['first', 'second']);
		});

		it('returns the same array reference (in-place mutation)', () => {
			const cards: CanonicalCard[] = [];
			const result = runEnrichmentPipeline(cards, 'json');
			expect(result).toBe(cards);
		});
	});
});
