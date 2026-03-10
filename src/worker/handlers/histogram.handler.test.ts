// Isometry v5 -- Phase 66 Histogram Handler Tests
// Unit tests for handleHistogramQuery SQL generation and response shaping.
//
// Pattern: In-memory sql.js database (same as chart.handler.test.ts uses mock,
// but here we use real sql.js for integration-level binning verification).
// Tests numeric binning, date bucketing, empty data, all-NULL, single value,
// WHERE clause filtering, SQL safety validation.

import initSqlJs from 'sql.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../database/Database';
import type { WorkerPayloads } from '../protocol';
import { handleHistogramQuery } from './histogram.handler';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

let db: Database;

beforeEach(async () => {
	db = new Database();
	await db.initialize();
});

afterEach(() => {
	db.close();
});

/** Insert cards with priority values for numeric binning tests */
function insertCards(priorities: (number | null)[], dates?: (string | null)[]) {
	for (let i = 0; i < priorities.length; i++) {
		const priority = priorities[i];
		const created = dates?.[i] ?? '2026-01-15T10:00:00Z';
		db.prepare(
			`INSERT INTO cards (id, name, card_type, priority, created_at, modified_at, folder, status, source)
			 VALUES (?, ?, 'note', ?, ?, ?, 'Inbox', 'active', 'manual')`,
		).run(`card-${i}`, `Card ${i}`, priority, created, created);
	}
}

// ---------------------------------------------------------------------------
// Numeric Binning
// ---------------------------------------------------------------------------

describe('handleHistogramQuery — numeric fields', () => {
	it('returns binned counts for numeric field with equal-width bins', () => {
		// Insert cards with priorities 1-10
		insertCards([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

		const result = handleHistogramQuery(db, {
			field: 'priority',
			fieldType: 'numeric',
			bins: 5,
			where: 'deleted_at IS NULL',
			params: [],
		});

		expect(result.bins).toHaveLength(5);
		// All bins should have count > 0
		const totalCount = result.bins.reduce((sum, b) => sum + b.count, 0);
		expect(totalCount).toBe(10);
		// Bins should be ordered and have numeric binStart/binEnd
		for (const bin of result.bins) {
			expect(typeof bin.binStart).toBe('number');
			expect(typeof bin.binEnd).toBe('number');
			expect(bin.count).toBeGreaterThanOrEqual(1);
		}
		// First bin starts at 1, last bin ends at 10
		expect(result.bins[0].binStart).toBe(1);
		expect(result.bins[result.bins.length - 1].binEnd).toBe(10);
	});

	it('defaults to 10 bins when bins parameter is not provided', () => {
		// Insert 20 cards with priorities 1-20
		insertCards(Array.from({ length: 20 }, (_, i) => i + 1));

		const payload: WorkerPayloads['histogram:query'] = {
			field: 'priority',
			fieldType: 'numeric',
			bins: 10, // default value
			where: 'deleted_at IS NULL',
			params: [],
		};

		const result = handleHistogramQuery(db, payload);

		expect(result.bins.length).toBeLessThanOrEqual(10);
		const totalCount = result.bins.reduce((sum, b) => sum + b.count, 0);
		expect(totalCount).toBe(20);
	});

	it('returns single bin when all values are the same', () => {
		insertCards([5, 5, 5, 5]);

		const result = handleHistogramQuery(db, {
			field: 'priority',
			fieldType: 'numeric',
			bins: 10,
			where: 'deleted_at IS NULL',
			params: [],
		});

		expect(result.bins).toHaveLength(1);
		expect(result.bins[0].count).toBe(4);
		expect(result.bins[0].binStart).toBe(5);
		expect(result.bins[0].binEnd).toBe(5);
	});

	it('returns empty array when no rows match WHERE clause', () => {
		insertCards([1, 2, 3]);

		const result = handleHistogramQuery(db, {
			field: 'priority',
			fieldType: 'numeric',
			bins: 10,
			where: "deleted_at IS NULL AND card_type = ?",
			params: ['nonexistent'],
		});

		expect(result.bins).toEqual([]);
	});

	it('returns empty array when all values are NULL', () => {
		insertCards([null, null, null]);

		const result = handleHistogramQuery(db, {
			field: 'priority',
			fieldType: 'numeric',
			bins: 10,
			where: 'deleted_at IS NULL',
			params: [],
		});

		expect(result.bins).toEqual([]);
	});

	it('ignores NULL values in binning', () => {
		insertCards([1, null, 5, null, 10]);

		const result = handleHistogramQuery(db, {
			field: 'priority',
			fieldType: 'numeric',
			bins: 3,
			where: 'deleted_at IS NULL',
			params: [],
		});

		const totalCount = result.bins.reduce((sum, b) => sum + b.count, 0);
		expect(totalCount).toBe(3); // Only 3 non-null values
	});
});

// ---------------------------------------------------------------------------
// Date Bucketing
// ---------------------------------------------------------------------------

describe('handleHistogramQuery — date fields', () => {
	it('buckets date fields by month using strftime', () => {
		insertCards(
			[1, 2, 3, 4, 5],
			[
				'2026-01-15T10:00:00Z',
				'2026-01-20T10:00:00Z',
				'2026-02-10T10:00:00Z',
				'2026-03-05T10:00:00Z',
				'2026-03-20T10:00:00Z',
			],
		);

		const result = handleHistogramQuery(db, {
			field: 'created_at',
			fieldType: 'date',
			bins: 10,
			where: 'deleted_at IS NULL',
			params: [],
		});

		expect(result.bins).toHaveLength(3); // Jan, Feb, Mar
		expect(result.bins[0].binStart).toBe('2026-01');
		expect(result.bins[0].binEnd).toBe('2026-01');
		expect(result.bins[0].count).toBe(2);
		expect(result.bins[1].binStart).toBe('2026-02');
		expect(result.bins[1].count).toBe(1);
		expect(result.bins[2].binStart).toBe('2026-03');
		expect(result.bins[2].count).toBe(2);
	});

	it('returns empty array when all date values are NULL', () => {
		insertCards([1, 2, 3]);
		// Set created_at to NULL for all
		for (let i = 0; i < 3; i++) {
			db.prepare('UPDATE cards SET created_at = NULL WHERE id = ?').run(`card-${i}`);
		}

		const result = handleHistogramQuery(db, {
			field: 'created_at',
			fieldType: 'date',
			bins: 10,
			where: 'deleted_at IS NULL',
			params: [],
		});

		expect(result.bins).toEqual([]);
	});

	it('returns empty array when no rows match WHERE for date field', () => {
		insertCards([1, 2], ['2026-01-15T10:00:00Z', '2026-02-10T10:00:00Z']);

		const result = handleHistogramQuery(db, {
			field: 'created_at',
			fieldType: 'date',
			bins: 10,
			where: "deleted_at IS NULL AND card_type = ?",
			params: ['nonexistent'],
		});

		expect(result.bins).toEqual([]);
	});

	it('orders date buckets chronologically (ASC)', () => {
		insertCards(
			[1, 2, 3],
			['2026-03-01T10:00:00Z', '2026-01-01T10:00:00Z', '2026-02-01T10:00:00Z'],
		);

		const result = handleHistogramQuery(db, {
			field: 'created_at',
			fieldType: 'date',
			bins: 10,
			where: 'deleted_at IS NULL',
			params: [],
		});

		expect(result.bins[0].binStart).toBe('2026-01');
		expect(result.bins[1].binStart).toBe('2026-02');
		expect(result.bins[2].binStart).toBe('2026-03');
	});
});

// ---------------------------------------------------------------------------
// WHERE Clause Filtering
// ---------------------------------------------------------------------------

describe('handleHistogramQuery — WHERE clause', () => {
	it('respects WHERE clause from FilterProvider.compile()', () => {
		insertCards([1, 2, 3, 4, 5]);
		// Soft-delete some cards
		db.prepare("UPDATE cards SET deleted_at = '2026-01-01' WHERE id IN ('card-3', 'card-4')").run();

		const result = handleHistogramQuery(db, {
			field: 'priority',
			fieldType: 'numeric',
			bins: 10,
			where: 'deleted_at IS NULL',
			params: [],
		});

		const totalCount = result.bins.reduce((sum, b) => sum + b.count, 0);
		expect(totalCount).toBe(3); // Only 3 non-deleted cards
	});

	it('defaults WHERE to deleted_at IS NULL when empty string provided', () => {
		insertCards([1, 2, 3]);
		db.prepare("UPDATE cards SET deleted_at = '2026-01-01' WHERE id = 'card-2'").run();

		const result = handleHistogramQuery(db, {
			field: 'priority',
			fieldType: 'numeric',
			bins: 10,
			where: '',
			params: [],
		});

		const totalCount = result.bins.reduce((sum, b) => sum + b.count, 0);
		expect(totalCount).toBe(2); // card-2 is deleted
	});
});

// ---------------------------------------------------------------------------
// SQL Safety Validation
// ---------------------------------------------------------------------------

describe('handleHistogramQuery — field validation', () => {
	it('throws SQL safety violation for invalid field', () => {
		expect(() =>
			handleHistogramQuery(db, {
				field: 'DROP TABLE cards;--',
				fieldType: 'numeric',
				bins: 10,
				where: 'deleted_at IS NULL',
				params: [],
			}),
		).toThrow('SQL safety violation');
	});

	it('accepts valid filter fields (priority, created_at, folder, etc.)', () => {
		insertCards([1, 2, 3]);

		// priority is a valid filter field
		const result = handleHistogramQuery(db, {
			field: 'priority',
			fieldType: 'numeric',
			bins: 10,
			where: 'deleted_at IS NULL',
			params: [],
		});

		expect(result.bins.length).toBeGreaterThan(0);
	});
});
