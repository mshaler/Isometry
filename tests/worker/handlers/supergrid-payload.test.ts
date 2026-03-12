// Isometry v5 — Phase 76 Plan 02 Payload Truncation Tests
// Tests for supergrid:query card_ids truncation at 20K card scale.
//
// Purpose: At 20K cards, unbounded GROUP_CONCAT card_ids produce large postMessage
// payloads. Truncation to 50 per cell + card_ids_total keeps the common path fast.
//
// Requirements: RNDR-05
//
// Pattern: Real sql.js Database + seedDatabase (same as performance benchmarks)
// Run: npx vitest run tests/worker/handlers/supergrid-payload.test.ts

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../../../src/database/Database';
import { handleSuperGridQuery } from '../../../src/worker/handlers/supergrid.handler';
import type { WorkerPayloads } from '../../../src/worker/protocol';
import { seedDatabase } from '../../database/seed';

// ---------------------------------------------------------------------------
// Setup: real sql.js DB seeded with 20K cards
// ---------------------------------------------------------------------------

let db: Database;

beforeAll(async () => {
	db = new Database();
	await db.initialize();
	// Seed 20K cards — enough to guarantee cells with >50 card_ids on card_type axis
	seedDatabase(db, { cardCount: 20_000 });
}, 120_000); // 2 minute timeout — 20K card seed can be slow

afterAll(() => {
	// No db.close() — avoid WASM heap fragmentation per D-decision
});

// ---------------------------------------------------------------------------
// Test: card_ids truncated to 50 per cell
// ---------------------------------------------------------------------------

describe('supergrid:query payload truncation at 20K cards', () => {
	it('truncates card_ids to 50 per cell for every cell', () => {
		const payload: WorkerPayloads['supergrid:query'] = {
			// Single row axis with high cardinality — groups many cards per cell
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [],
			where: '',
			params: [],
		};

		const result = handleSuperGridQuery(db, payload);

		expect(result.cells.length).toBeGreaterThan(0);

		for (const cell of result.cells) {
			expect(cell.card_ids.length).toBeLessThanOrEqual(50);
		}
	});

	it('sets card_ids_total to reflect the true count before truncation', () => {
		const payload: WorkerPayloads['supergrid:query'] = {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [],
			where: '',
			params: [],
		};

		const result = handleSuperGridQuery(db, payload);

		// At 20K cards with 5 card_types, each cell should have ~4000 cards
		// card_ids_total must be >= card_ids.length (which is capped at 50)
		for (const cell of result.cells) {
			expect(cell.card_ids_total).toBeDefined();
			expect(cell.card_ids_total).toBeGreaterThanOrEqual(cell.card_ids.length);
		}

		// At least one cell must have count > 50 (proving truncation is real)
		const hasTruncatedCell = result.cells.some((cell) => (cell.card_ids_total ?? 0) > 50);
		expect(hasTruncatedCell).toBe(true);
	});

	it('produces payload under 100KB when JSON-stringified at 20K cards', () => {
		const payload: WorkerPayloads['supergrid:query'] = {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: '',
			params: [],
		};

		const result = handleSuperGridQuery(db, payload);
		const payloadSize = JSON.stringify({ cells: result.cells }).length;

		// Must be under 100KB (102400 bytes)
		expect(payloadSize).toBeLessThan(100 * 1024);
	});
});
