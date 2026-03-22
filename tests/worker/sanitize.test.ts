// Isometry v9.0 — Phase 114 Storage Foundation
// Tests for sanitizeAlgorithmResult utility.
//
// Verifies NaN/Infinity → null conversion for all 6 metric fields
// while leaving non-metric fields and valid numbers untouched.

import { describe, expect, it } from 'vitest';
import { sanitizeAlgorithmResult } from '../../src/worker/utils/sanitize';

describe('sanitizeAlgorithmResult', () => {
	it('passes through normal finite values unchanged', () => {
		const row = {
			card_id: 'abc-123',
			centrality: 0.5,
			pagerank: 0.25,
			community_id: 1,
			clustering_coeff: 0.8,
			sp_depth: 2,
			in_spanning_tree: 1,
		};
		const result = sanitizeAlgorithmResult(row);
		expect(result['centrality']).toBe(0.5);
		expect(result['pagerank']).toBe(0.25);
		expect(result['community_id']).toBe(1);
		expect(result['clustering_coeff']).toBe(0.8);
		expect(result['sp_depth']).toBe(2);
		expect(result['in_spanning_tree']).toBe(1);
	});

	it('converts NaN centrality to null', () => {
		const result = sanitizeAlgorithmResult({ centrality: Number.NaN });
		expect(result['centrality']).toBeNull();
	});

	it('converts NaN pagerank to null', () => {
		const result = sanitizeAlgorithmResult({ pagerank: Number.NaN });
		expect(result['pagerank']).toBeNull();
	});

	it('converts NaN community_id to null', () => {
		const result = sanitizeAlgorithmResult({ community_id: Number.NaN });
		expect(result['community_id']).toBeNull();
	});

	it('converts NaN clustering_coeff to null', () => {
		const result = sanitizeAlgorithmResult({ clustering_coeff: Number.NaN });
		expect(result['clustering_coeff']).toBeNull();
	});

	it('converts NaN sp_depth to null', () => {
		const result = sanitizeAlgorithmResult({ sp_depth: Number.NaN });
		expect(result['sp_depth']).toBeNull();
	});

	it('converts NaN in_spanning_tree to null', () => {
		const result = sanitizeAlgorithmResult({ in_spanning_tree: Number.NaN });
		expect(result['in_spanning_tree']).toBeNull();
	});

	it('converts Infinity centrality to null', () => {
		const result = sanitizeAlgorithmResult({ centrality: Infinity });
		expect(result['centrality']).toBeNull();
	});

	it('converts Infinity pagerank to null', () => {
		const result = sanitizeAlgorithmResult({ pagerank: Infinity });
		expect(result['pagerank']).toBeNull();
	});

	it('converts -Infinity centrality to null', () => {
		const result = sanitizeAlgorithmResult({ centrality: -Infinity });
		expect(result['centrality']).toBeNull();
	});

	it('converts -Infinity clustering_coeff to null', () => {
		const result = sanitizeAlgorithmResult({ clustering_coeff: -Infinity });
		expect(result['clustering_coeff']).toBeNull();
	});

	it('leaves existing null values as null', () => {
		const row = {
			card_id: 'x',
			centrality: null,
			pagerank: null,
			community_id: null,
			clustering_coeff: null,
			sp_depth: null,
			in_spanning_tree: null,
		};
		const result = sanitizeAlgorithmResult(row);
		expect(result['centrality']).toBeNull();
		expect(result['pagerank']).toBeNull();
		expect(result['community_id']).toBeNull();
		expect(result['clustering_coeff']).toBeNull();
		expect(result['sp_depth']).toBeNull();
		expect(result['in_spanning_tree']).toBeNull();
	});

	it('does not modify card_id (non-metric string field)', () => {
		const result = sanitizeAlgorithmResult({ card_id: 'my-card-id', centrality: 0.5 });
		expect(result['card_id']).toBe('my-card-id');
	});

	it('does not modify computed_at (non-metric string field)', () => {
		const result = sanitizeAlgorithmResult({ computed_at: '2026-03-22T00:00:00.000Z', pagerank: 0.1 });
		expect(result['computed_at']).toBe('2026-03-22T00:00:00.000Z');
	});

	it('handles mixed row: some NaN, some valid, some null', () => {
		const row = {
			card_id: 'test-id',
			centrality: Number.NaN,
			pagerank: 0.42,
			community_id: null,
			clustering_coeff: Infinity,
			sp_depth: 3,
			in_spanning_tree: Number.NaN,
			computed_at: '2026-03-22T00:00:00.000Z',
		};
		const result = sanitizeAlgorithmResult(row);
		expect(result['centrality']).toBeNull();
		expect(result['pagerank']).toBe(0.42);
		expect(result['community_id']).toBeNull();
		expect(result['clustering_coeff']).toBeNull();
		expect(result['sp_depth']).toBe(3);
		expect(result['in_spanning_tree']).toBeNull();
		expect(result['card_id']).toBe('test-id');
		expect(result['computed_at']).toBe('2026-03-22T00:00:00.000Z');
	});

	it('returns a new object (does not mutate the input)', () => {
		const input = { centrality: Number.NaN };
		const result = sanitizeAlgorithmResult(input);
		expect(input['centrality']).toBe(Number.NaN); // original unchanged
		expect(result['centrality']).toBeNull();
	});
});
