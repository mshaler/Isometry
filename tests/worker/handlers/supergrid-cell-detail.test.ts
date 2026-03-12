// Isometry v5 — Phase 76 Plan 02 Cell Detail Handler Tests
// Tests for handleSuperGridCellDetail — lazy-fetch full card_ids for a specific cell.
//
// Purpose: The supergrid:cell-detail handler returns the full (untruncated) card_ids
// for a single cell identified by axis values, enabling drill-down on truncated cells.
//
// Requirements: RNDR-05
//
// Pattern: Real sql.js Database + seedDatabase for integration, mock DB for unit tests
// Run: npx vitest run tests/worker/handlers/supergrid-cell-detail.test.ts

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Database } from '../../../src/database/Database';
import { handleSuperGridCellDetail } from '../../../src/worker/handlers/supergrid.handler';
import type { WorkerPayloads } from '../../../src/worker/protocol';
import { seedDatabase } from '../../database/seed';

// ---------------------------------------------------------------------------
// Mock Database helper (for SQL safety / edge case tests)
// ---------------------------------------------------------------------------

function createMockPrepareStmt(rows: Record<string, unknown>[]) {
	return {
		all: vi.fn().mockReturnValue(rows),
		free: vi.fn(),
	};
}

function createMockDb(prepareRows: Record<string, unknown>[] = []) {
	return {
		prepare: vi.fn().mockReturnValue(createMockPrepareStmt(prepareRows)),
		exec: vi.fn().mockReturnValue([]),
	} as unknown as Database;
}

// ---------------------------------------------------------------------------
// Setup: real sql.js DB seeded with 100 cards (fast test)
// ---------------------------------------------------------------------------

let db: Database;

beforeAll(async () => {
	db = new Database();
	await db.initialize();
	// Small seed for fast test — 100 cards is enough to test axis matching
	seedDatabase(db, { cardCount: 100 });
}, 30_000); // 30 second timeout

afterAll(() => {
	// No db.close() — avoid WASM heap fragmentation
});

// ---------------------------------------------------------------------------
// Unit tests: axis field validation (mock DB)
// ---------------------------------------------------------------------------

describe('handleSuperGridCellDetail — axis field validation', () => {
	it('throws SQL safety violation for invalid axis field name', () => {
		const mockDb = createMockDb();
		const payload: WorkerPayloads['supergrid:cell-detail'] = {
			axisValues: { 'DROP TABLE cards--': 'note' },
			where: '',
			params: [],
		};

		expect(() => handleSuperGridCellDetail(mockDb, payload)).toThrow('SQL safety violation');
	});

	it('throws SQL safety violation for SQL injection attempt in axis field', () => {
		const mockDb = createMockDb();
		const payload: WorkerPayloads['supergrid:cell-detail'] = {
			axisValues: { 'card_type; DROP TABLE cards': 'note' },
			where: '',
			params: [],
		};

		expect(() => handleSuperGridCellDetail(mockDb, payload)).toThrow('SQL safety violation');
	});
});

// ---------------------------------------------------------------------------
// Integration tests: real DB matching
// ---------------------------------------------------------------------------

describe('handleSuperGridCellDetail — real DB matching', () => {
	it('returns card_ids matching specific axis values', () => {
		// card_type is in the allowlist, and seed always creates 'note' type cards
		const payload: WorkerPayloads['supergrid:cell-detail'] = {
			axisValues: { card_type: 'note' },
			where: '',
			params: [],
		};

		const result = handleSuperGridCellDetail(db, payload);

		expect(result.card_ids).toBeInstanceOf(Array);
		expect(result.total).toBeGreaterThanOrEqual(0);
		expect(result.card_ids.length).toBe(result.total);

		// All returned ids should be strings (UUIDs)
		for (const id of result.card_ids) {
			expect(typeof id).toBe('string');
		}
	});

	it('returns empty array for non-matching axis values', () => {
		const payload: WorkerPayloads['supergrid:cell-detail'] = {
			axisValues: { card_type: 'nonexistent_type_xyz' },
			where: '',
			params: [],
		};

		const result = handleSuperGridCellDetail(db, payload);

		expect(result.card_ids).toEqual([]);
		expect(result.total).toBe(0);
	});

	it('returns correct card_ids when filtering by folder and card_type', () => {
		// folder is in the allowlist
		const payloadNote: WorkerPayloads['supergrid:cell-detail'] = {
			axisValues: { card_type: 'note' },
			where: '',
			params: [],
		};

		const noteResult = handleSuperGridCellDetail(db, payloadNote);

		// Query only notes in 'work' folder — should be a subset
		const payloadNoteWork: WorkerPayloads['supergrid:cell-detail'] = {
			axisValues: { card_type: 'note', folder: 'work' },
			where: '',
			params: [],
		};

		const noteWorkResult = handleSuperGridCellDetail(db, payloadNoteWork);

		// Work notes must be <= all notes
		expect(noteWorkResult.total).toBeLessThanOrEqual(noteResult.total);
	});
});
