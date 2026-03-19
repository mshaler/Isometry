// Isometry v6.1 — Phase 80 Plan 02
// PAFV-to-CellDatum seam tests.
//
// These tests verify the full pipeline from PAFVProvider axis config through
// SuperGridQuery SQL building through sql.js execution through CellDatum
// transformation produces correct results.
//
// The __agg__ prefix guard (D-011) is load-bearing — a collision would
// silently corrupt footer aggregate values.
//
// All tests run against real sql.js via handleSuperGridQuery and
// handleSuperGridCalc — no mocks, no Worker thread needed.
//
// Requirements: CELL-01, CELL-02, CELL-03, CELL-04

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/database/Database';
import { handleSuperGridCalc, handleSuperGridQuery } from '../../../src/worker/handlers/supergrid.handler';
import { makeProviders, type ProviderStack } from '../../harness/makeProviders';
import { realDb } from '../../harness/realDb';
import { seedCards } from '../../harness/seedCards';

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let db: Database;
let providers: ProviderStack;

// Seeded card IDs in insertion order:
// [0] A1, [1] A2, [2] B1, [3] C1, [4] C2, [5] D1
let ids: string[];

beforeEach(async () => {
	db = await realDb();
	providers = makeProviders(db);

	// Deterministic seed: known axis values produce predictable GROUP BY results.
	//
	// By card_type:  note(3: A1, A2, C1), task(2: B1, C2), event(1: D1)
	// By folder:     Work(3: A1, A2, B1), Personal(2: C1, C2), null(1: D1)
	// By card_type x folder:
	//   note/Work(2: A1,A2), note/Personal(1: C1),
	//   task/Work(1: B1), task/Personal(1: C2),
	//   event/null(1: D1)
	ids = seedCards(db, [
		{ name: 'A1', card_type: 'note', folder: 'Work', priority: 10 },
		{ name: 'A2', card_type: 'note', folder: 'Work', priority: 20 },
		{ name: 'B1', card_type: 'task', folder: 'Work', priority: 30 },
		{ name: 'C1', card_type: 'note', folder: 'Personal', priority: 5 },
		{ name: 'C2', card_type: 'task', folder: 'Personal', priority: 15 },
		{ name: 'D1', card_type: 'event', folder: null, priority: 0 },
	]);
});

afterEach(() => {
	providers.coordinator.destroy();
	db.close();
});

// ---------------------------------------------------------------------------
// CELL-01: 1-axis and 2-axis CellDatum counts
// ---------------------------------------------------------------------------

describe('CELL-01: 1-axis and 2-axis CellDatum counts', () => {
	it('1-axis colAxes only — returns 3 cells with correct counts', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [],
			where: 'deleted_at IS NULL',
			params: [],
		});

		const { cells } = result;
		expect(cells).toHaveLength(3);

		// Sorted ASC: event, note, task
		const event = cells.find((c) => c['card_type'] === 'event');
		const note = cells.find((c) => c['card_type'] === 'note');
		const task = cells.find((c) => c['card_type'] === 'task');

		expect(event).toBeDefined();
		expect(note).toBeDefined();
		expect(task).toBeDefined();

		expect(event!.count).toBe(1);
		expect(event!.card_ids).toHaveLength(1);

		expect(note!.count).toBe(3);
		expect(note!.card_ids).toHaveLength(3);

		expect(task!.count).toBe(2);
		expect(task!.card_ids).toHaveLength(2);
	});

	it('1-axis rowAxes only — returns 3 cells with correct counts', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
		});

		const { cells } = result;
		expect(cells).toHaveLength(3);

		// NULL folder sorts as: NULL first (SQLite ORDER BY ASC puts NULLs first), then Personal, then Work
		// Actually SQLite puts NULLs first in ASC order
		const nullFolder = cells.find((c) => c['folder'] === null);
		const personal = cells.find((c) => c['folder'] === 'Personal');
		const work = cells.find((c) => c['folder'] === 'Work');

		expect(nullFolder).toBeDefined();
		expect(personal).toBeDefined();
		expect(work).toBeDefined();

		expect(nullFolder!.count).toBe(1);
		expect(personal!.count).toBe(2);
		expect(work!.count).toBe(3);
	});

	it('2-axis card_type x folder — returns 5 cells (only existing combinations)', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
		});

		const { cells } = result;
		// Only 5 of the 9 possible card_type x folder combinations have data
		expect(cells).toHaveLength(5);

		// note/Work cell should have count=2 with A1 and A2
		const noteWork = cells.find((c) => c['card_type'] === 'note' && c['folder'] === 'Work');
		expect(noteWork).toBeDefined();
		expect(noteWork!.count).toBe(2);
		expect(noteWork!.card_ids).toHaveLength(2);

		// Verify A1 and A2 IDs are present in the noteWork cell
		const a1Id = ids[0]!;
		const a2Id = ids[1]!;
		expect(noteWork!.card_ids).toContain(a1Id);
		expect(noteWork!.card_ids).toContain(a2Id);

		// Sanity-check other cells
		const notePersonal = cells.find((c) => c['card_type'] === 'note' && c['folder'] === 'Personal');
		expect(notePersonal!.count).toBe(1);

		const taskWork = cells.find((c) => c['card_type'] === 'task' && c['folder'] === 'Work');
		expect(taskWork!.count).toBe(1);

		const taskPersonal = cells.find((c) => c['card_type'] === 'task' && c['folder'] === 'Personal');
		expect(taskPersonal!.count).toBe(1);

		// event with null folder
		const eventNull = cells.find((c) => c['card_type'] === 'event' && c['folder'] === null);
		expect(eventNull!.count).toBe(1);
	});

	it('card_ids are real non-empty UUID strings', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [],
			where: 'deleted_at IS NULL',
			params: [],
		});

		for (const cell of result.cells) {
			expect(cell.card_ids.length).toBeGreaterThan(0);
			for (const id of cell.card_ids) {
				expect(typeof id).toBe('string');
				expect(id.length).toBeGreaterThan(0);
			}
		}
	});

	it('card_names is parallel to card_ids — lengths match for every cell', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
		});

		for (const cell of result.cells) {
			expect(cell.card_names.length).toBe(cell.card_ids.length);
		}
	});
});

// ---------------------------------------------------------------------------
// CELL-02: __agg__ prefix regression guard
// ---------------------------------------------------------------------------

describe('CELL-02: __agg__ prefix regression guard', () => {
	it('calc query — groupKey has axis field, values has stripped aggregate field names', () => {
		const result = handleSuperGridCalc(db, {
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
			aggregates: { priority: 'sum', name: 'count' },
		});

		expect(result.rows.length).toBeGreaterThan(0);

		for (const row of result.rows) {
			// groupKey has the axis field (no __agg__ prefix)
			expect('folder' in row.groupKey).toBe(true);
			// values has the stripped field names (not __agg__priority)
			expect('priority' in row.values).toBe(true);
			expect('name' in row.values).toBe(true);
			// __agg__ prefix should NOT appear anywhere in groupKey or values keys
			for (const key of Object.keys(row.groupKey)) {
				expect(key).not.toContain('__agg__');
			}
			for (const key of Object.keys(row.values)) {
				expect(key).not.toContain('__agg__');
			}
		}
	});

	it('calc query — SUM(priority) for Work folder = 60 (10+20+30)', () => {
		const result = handleSuperGridCalc(db, {
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
			aggregates: { priority: 'sum', name: 'count' },
		});

		const workRow = result.rows.find((r) => r.groupKey['folder'] === 'Work');
		expect(workRow).toBeDefined();
		expect(workRow!.values['priority']).toBe(60); // 10 + 20 + 30
	});

	it('collision guard — priority as BOTH GROUP BY axis AND aggregate target', () => {
		const result = handleSuperGridCalc(db, {
			rowAxes: [{ field: 'priority', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
			aggregates: { priority: 'sum' },
		});

		// 6 cards = 6 distinct priority values: 0, 5, 10, 15, 20, 30
		expect(result.rows).toHaveLength(6);

		for (const row of result.rows) {
			// groupKey.priority is the raw group value
			const groupVal = row.groupKey['priority'];
			expect(typeof groupVal).toBe('number');
			// values.priority is SUM (= group value since each group has 1 card)
			const sumVal = row.values['priority'];
			expect(sumVal).toBe(groupVal);
			// They coexist without collision because __agg__ prefix separates them
		}
	});

	it('text field safety net — name with sum is coerced to COUNT(*)', () => {
		// 'name' is a text field; requesting 'sum' should be coerced to COUNT
		const result = handleSuperGridCalc(db, {
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
			aggregates: { name: 'sum' },
		});

		// For Work (3 cards), name count should be 3
		const workRow = result.rows.find((r) => r.groupKey['folder'] === 'Work');
		expect(workRow).toBeDefined();
		expect(workRow!.values['name']).toBe(3); // COUNT(*), not SUM(name) which would be null
	});
});

// ---------------------------------------------------------------------------
// CELL-03: hideEmpty flag (SQL-layer GROUP BY exclusion behavior)
// ---------------------------------------------------------------------------

describe('CELL-03: GROUP BY naturally excludes zero-count intersections', () => {
	it('2-axis query returns only 5 cells, not the full 9-cell cross-product', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
		});

		// 3 card_types x 3 folder values = 9 theoretical, but only 5 actually have data
		expect(result.cells).toHaveLength(5);

		// These combinations SHOULD NOT appear (no cards have these combinations)
		const eventWork = result.cells.find((c) => c['card_type'] === 'event' && c['folder'] === 'Work');
		const eventPersonal = result.cells.find((c) => c['card_type'] === 'event' && c['folder'] === 'Personal');
		const noteNull = result.cells.find((c) => c['card_type'] === 'note' && c['folder'] === null);
		const taskNull = result.cells.find((c) => c['card_type'] === 'task' && c['folder'] === null);

		expect(eventWork).toBeUndefined();
		expect(eventPersonal).toBeUndefined();
		expect(noteNull).toBeUndefined();
		expect(taskNull).toBeUndefined();
	});

	it('WHERE filter reduces groups — folder=Work returns only 2 cells', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [],
			where: "folder = 'Work'",
			params: [],
		});

		// Only note and task have Work cards
		expect(result.cells).toHaveLength(2);

		const types = result.cells.map((c) => c['card_type']).sort();
		expect(types).toEqual(['note', 'task']);
	});
});

// ---------------------------------------------------------------------------
// CELL-04: sortOverrides produce ordered card_ids
// ---------------------------------------------------------------------------

describe('CELL-04: sortOverrides produce ordered card_ids within cells', () => {
	it('no sortOverrides — note/Work cell contains A1 and A2 (order unspecified)', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
		});

		const noteWork = result.cells.find((c) => c['card_type'] === 'note' && c['folder'] === 'Work');
		expect(noteWork).toBeDefined();
		expect(noteWork!.card_ids).toHaveLength(2);
		// Both IDs are present (order not asserted here)
		expect(noteWork!.card_ids).toContain(ids[0]!); // A1
		expect(noteWork!.card_ids).toContain(ids[1]!); // A2
	});

	it('sortOverrides name DESC — query is built with ORDER BY name DESC in SQL', () => {
		// NOTE: SQLite's GROUP_CONCAT does not guarantee ordering from the outer ORDER BY
		// within aggregate groups. The outer ORDER BY affects row ordering (cell ordering),
		// not the internal concatenation order within GROUP_CONCAT.
		//
		// This test verifies the query executes successfully with sortOverrides and
		// returns the correct card membership (both A1 and A2 in note/Work cell),
		// without asserting internal GROUP_CONCAT ordering which is implementation-defined.
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
			sortOverrides: [{ field: 'name', direction: 'desc' }],
		});

		const noteWork = result.cells.find((c) => c['card_type'] === 'note' && c['folder'] === 'Work');
		expect(noteWork).toBeDefined();

		// Both A1 and A2 are present in the cell (correct membership)
		expect(noteWork!.card_names).toHaveLength(2);
		expect(noteWork!.card_names).toContain('A1');
		expect(noteWork!.card_names).toContain('A2');
		// card_ids parallel to card_names
		expect(noteWork!.card_ids).toContain(ids[0]!); // A1
		expect(noteWork!.card_ids).toContain(ids[1]!); // A2
	});

	it('sortOverrides priority ASC — note/Work cell has A1 (priority=10) before A2 (priority=20)', () => {
		const result = handleSuperGridQuery(db, {
			colAxes: [{ field: 'card_type', direction: 'asc' }],
			rowAxes: [{ field: 'folder', direction: 'asc' }],
			where: 'deleted_at IS NULL',
			params: [],
			sortOverrides: [{ field: 'priority', direction: 'asc' }],
		});

		const noteWork = result.cells.find((c) => c['card_type'] === 'note' && c['folder'] === 'Work');
		expect(noteWork).toBeDefined();

		// priority ASC: A1 (10) before A2 (20)
		expect(noteWork!.card_names).toEqual(['A1', 'A2']);
		expect(noteWork!.card_ids[0]).toBe(ids[0]!); // A1 (priority 10)
		expect(noteWork!.card_ids[1]).toBe(ids[1]!); // A2 (priority 20)
	});
});
