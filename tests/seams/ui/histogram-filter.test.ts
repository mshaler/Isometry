/**
 * Isometry v6.1 — Phase 82 Seam: HistogramScrubber -> FilterProvider -> SQL
 *
 * Tests the seam between HistogramScrubber output and FilterProvider state,
 * then verifies the SQL round-trip against real sql.js. The test calls
 * FilterProvider.setRangeFilter/clearRangeFilter directly — the provider-side
 * seam that the scrubber drives — and asserts the compiled WHERE clause
 * returns the correct row subset from real sql.js.
 *
 * Strategy: Do NOT instantiate HistogramScrubber directly. The D3 brush
 * pixel-to-data mapping is a rendering concern outside the seam boundary.
 * This test proves the CONTRACT that the histogram fulfills.
 *
 * Requirements: HIST-01, HIST-02
 */

import type { BindParams } from 'sql.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/database/Database';
import type { FilterProvider } from '../../../src/providers/FilterProvider';
import { makeProviders, type ProviderStack } from '../../harness/makeProviders';
import { realDb } from '../../harness/realDb';
import { seedCards } from '../../harness/seedCards';

// ---------------------------------------------------------------------------
// Helper: run compiled filter against db, return sorted names
// ---------------------------------------------------------------------------

function queryWithFilter(db: Database, filter: FilterProvider): string[] {
	const { where, params } = filter.compile();
	const rows = db.exec(`SELECT name FROM cards WHERE ${where} ORDER BY name ASC`, params as BindParams);
	return (rows[0]?.values ?? []).map((r) => r[0] as string);
}

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let db: Database;
let providers: ProviderStack;
let filter: FilterProvider;

beforeEach(async () => {
	db = await realDb();
	providers = makeProviders(db);
	filter = providers.filter;

	// 5 cards with numeric priority AND date due_at for range testing
	seedCards(db, [
		{ name: 'Alpha',   priority: 10, folder: 'Work',     due_at: '2026-01-10T00:00:00Z' },
		{ name: 'Beta',    priority: 20, folder: 'Work',     due_at: '2026-02-15T00:00:00Z' },
		{ name: 'Gamma',   priority: 30, folder: 'Personal', due_at: '2026-03-20T00:00:00Z' },
		{ name: 'Delta',   priority: 40, folder: 'Personal', due_at: '2026-04-25T00:00:00Z' },
		{ name: 'Epsilon', priority: 50, folder: 'Work',     due_at: '2026-05-30T00:00:00Z' },
	]);
});

afterEach(() => {
	providers.coordinator.destroy();
	db.close();
});

// ---------------------------------------------------------------------------
// HIST-01: scrubber drag fires setRangeFilter with correct min/max
// ---------------------------------------------------------------------------

describe('HIST-01: scrubber drag fires setRangeFilter with correct min/max', () => {
	it('setRangeFilter with numeric min/max produces WHERE clause returning correct rows', () => {
		filter.setRangeFilter('priority', 20, 40);
		const compiled = filter.compile();

		// WHERE clause must contain the field name
		expect(compiled.where).toContain('priority');

		// Query returns Beta (20), Gamma (30), Delta (40)
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Beta', 'Delta', 'Gamma']);
	});

	it('setRangeFilter with tight range (single value) returns only that card', () => {
		filter.setRangeFilter('priority', 30, 30);
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Gamma']);
	});

	it('setRangeFilter with full range returns all cards', () => {
		filter.setRangeFilter('priority', 10, 50);
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma']);
	});

	it('setRangeFilter with date field (due_at) produces WHERE clause returning correct rows', () => {
		filter.setRangeFilter('due_at', '2026-02-15T00:00:00Z', '2026-04-25T00:00:00Z');
		const compiled = filter.compile();

		// WHERE clause must contain the field name
		expect(compiled.where).toContain('due_at');

		// Query returns Beta, Gamma, Delta (due_at between Feb and Apr inclusive)
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Beta', 'Delta', 'Gamma']);
	});

	it('setRangeFilter with tight date range (single month) returns only Gamma', () => {
		filter.setRangeFilter('due_at', '2026-03-01T00:00:00Z', '2026-03-31T00:00:00Z');
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Gamma']);
	});
});

// ---------------------------------------------------------------------------
// HIST-02: range filter round-trips to SQL; reset clears filter
// ---------------------------------------------------------------------------

describe('HIST-02: range filter round-trips to SQL; reset clears filter', () => {
	it('full clear round-trip: apply range, verify filtered, clear, verify full', () => {
		filter.setRangeFilter('priority', 10, 20);
		let names = queryWithFilter(db, filter);
		// Alpha (10), Beta (20) — 2 cards
		expect(names).toEqual(['Alpha', 'Beta']);

		filter.clearRangeFilter('priority');
		names = queryWithFilter(db, filter);
		// All 5 cards restored
		expect(names).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma']);
	});

	it('range + axis compound filter returns intersection', () => {
		filter.setRangeFilter('priority', 10, 30);
		filter.setAxisFilter('folder', ['Work']);

		const names = queryWithFilter(db, filter);
		// Work folder AND priority 10-30: Alpha (10, Work), Beta (20, Work)
		// Gamma (30, Personal) is excluded by folder filter
		expect(names).toEqual(['Alpha', 'Beta']);
	});

	it('clearRangeFilter is idempotent (no error when no range exists)', () => {
		// Should not throw when called on fresh filter
		expect(() => filter.clearRangeFilter('priority')).not.toThrow();
		const names = queryWithFilter(db, filter);
		// All 5 cards returned — no filter applied
		expect(names).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma']);
	});

	it('date range clear round-trip: apply, verify filtered, clear, verify full', () => {
		filter.setRangeFilter('due_at', '2026-01-10T00:00:00Z', '2026-02-15T00:00:00Z');
		let names = queryWithFilter(db, filter);
		// Alpha (Jan 10), Beta (Feb 15) — 2 cards
		expect(names).toEqual(['Alpha', 'Beta']);

		filter.clearRangeFilter('due_at');
		names = queryWithFilter(db, filter);
		// All 5 cards restored
		expect(names).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma']);
	});

	it('null selection equivalent: clearRangeFilter after setRangeFilter restores full result', () => {
		// Models scrubber click-without-drag: selection === null → clearRangeFilter
		filter.setRangeFilter('priority', 20, 40);
		let names = queryWithFilter(db, filter);
		expect(names).toEqual(['Beta', 'Delta', 'Gamma']);

		// Null selection equivalent: clear the range filter
		filter.clearRangeFilter('priority');
		names = queryWithFilter(db, filter);
		expect(names).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma']);
	});
});
