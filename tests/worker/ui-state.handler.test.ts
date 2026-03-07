// Isometry v5 — Phase 4 UI State Handler Tests
// Tests for ui_state CRUD handlers and db:exec generic surface.
//
// Pattern: Uses a real Database instance (no Worker needed).
// Tests run against an in-memory sql.js database with the canonical schema applied.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import {
	handleDbExec,
	handleUiDelete,
	handleUiGet,
	handleUiGetAll,
	handleUiSet,
} from '../../src/worker/handlers/ui-state.handler';

// ---------------------------------------------------------------------------
// Shared setup: fresh DB per test
// ---------------------------------------------------------------------------

let db: Database;

beforeEach(async () => {
	db = new Database();
	await db.initialize();
});

afterEach(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// handleUiSet
// ---------------------------------------------------------------------------

describe('handleUiSet', () => {
	it('inserts a key-value pair into ui_state', () => {
		handleUiSet(db, { key: 'filter', value: '{"filters":[]}' });
		const result = handleUiGet(db, { key: 'filter' });
		expect(result.key).toBe('filter');
		expect(result.value).toBe('{"filters":[]}');
	});

	it('replaces an existing value (INSERT OR REPLACE)', () => {
		handleUiSet(db, { key: 'filter', value: 'old-value' });
		handleUiSet(db, { key: 'filter', value: 'new-value' });
		const result = handleUiGet(db, { key: 'filter' });
		expect(result.value).toBe('new-value');
	});

	it('stores updated_at timestamp on insert', () => {
		handleUiSet(db, { key: 'theme', value: 'dark' });
		const result = handleUiGet(db, { key: 'theme' });
		expect(result.updated_at).toBeTruthy();
		// Should be an ISO 8601 timestamp
		expect(result.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
	});

	it('can store multiple distinct keys', () => {
		handleUiSet(db, { key: 'key1', value: 'val1' });
		handleUiSet(db, { key: 'key2', value: 'val2' });
		const all = handleUiGetAll(db, {});
		expect(all.length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// handleUiGet
// ---------------------------------------------------------------------------

describe('handleUiGet', () => {
	it('returns key, value, and updated_at for an existing key', () => {
		handleUiSet(db, { key: 'filter', value: '{"filters":[]}' });
		const result = handleUiGet(db, { key: 'filter' });
		expect(result.key).toBe('filter');
		expect(result.value).toBe('{"filters":[]}');
		expect(result.updated_at).toBeTruthy();
	});

	it('returns key with null value and null updated_at for nonexistent key', () => {
		const result = handleUiGet(db, { key: 'nonexistent' });
		expect(result.key).toBe('nonexistent');
		expect(result.value).toBeNull();
		expect(result.updated_at).toBeNull();
	});

	it('returns null after deleting a key', () => {
		handleUiSet(db, { key: 'toDelete', value: 'some-value' });
		handleUiDelete(db, { key: 'toDelete' });
		const result = handleUiGet(db, { key: 'toDelete' });
		expect(result.value).toBeNull();
		expect(result.updated_at).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// handleUiDelete
// ---------------------------------------------------------------------------

describe('handleUiDelete', () => {
	it('removes the key-value pair from ui_state', () => {
		handleUiSet(db, { key: 'filter', value: '{"filters":[]}' });
		handleUiDelete(db, { key: 'filter' });
		const result = handleUiGet(db, { key: 'filter' });
		expect(result.value).toBeNull();
	});

	it('does not throw when deleting a nonexistent key', () => {
		expect(() => handleUiDelete(db, { key: 'ghost' })).not.toThrow();
	});

	it('only deletes the targeted key, leaving others intact', () => {
		handleUiSet(db, { key: 'keep', value: 'staying' });
		handleUiSet(db, { key: 'remove', value: 'going' });
		handleUiDelete(db, { key: 'remove' });
		const kept = handleUiGet(db, { key: 'keep' });
		expect(kept.value).toBe('staying');
		const removed = handleUiGet(db, { key: 'remove' });
		expect(removed.value).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// handleUiGetAll
// ---------------------------------------------------------------------------

describe('handleUiGetAll', () => {
	it('returns empty array when ui_state is empty', () => {
		const result = handleUiGetAll(db, {});
		expect(result).toEqual([]);
	});

	it('returns all key-value pairs', () => {
		handleUiSet(db, { key: 'alpha', value: 'a' });
		handleUiSet(db, { key: 'beta', value: 'b' });
		handleUiSet(db, { key: 'gamma', value: 'c' });
		const result = handleUiGetAll(db, {});
		expect(result.length).toBe(3);
		const keys = result.map((r) => r.key).sort();
		expect(keys).toEqual(['alpha', 'beta', 'gamma']);
	});

	it('each row has key, value, and updated_at', () => {
		handleUiSet(db, { key: 'test', value: 'data' });
		const result = handleUiGetAll(db, {});
		expect(result[0]).toHaveProperty('key', 'test');
		expect(result[0]).toHaveProperty('value', 'data');
		expect(result[0]).toHaveProperty('updated_at');
		expect(result[0]!.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
	});
});

// ---------------------------------------------------------------------------
// handleDbExec
// ---------------------------------------------------------------------------

describe('handleDbExec', () => {
	it('executes parameterized SQL and returns change count', async () => {
		// Create a card first so we have something to UPDATE
		const { createCard } = await import('../../src/database/queries/cards');
		const card = createCard(db, { name: 'Original Name' });

		const result = handleDbExec(db, {
			sql: 'UPDATE cards SET name = ? WHERE id = ?',
			params: ['Updated Name', card.id],
		});

		expect(result).toHaveProperty('changes');
		expect(result.changes).toBe(1);
	});

	it('returns 0 changes when UPDATE matches no rows', () => {
		const result = handleDbExec(db, {
			sql: 'UPDATE cards SET name = ? WHERE id = ?',
			params: ['Name', 'nonexistent-id'],
		});

		expect(result.changes).toBe(0);
	});

	it('passes params correctly to db.run()', async () => {
		const { createCard, getCard } = await import('../../src/database/queries/cards');
		const card = createCard(db, { name: 'Before' });

		handleDbExec(db, {
			sql: 'UPDATE cards SET name = ? WHERE id = ?',
			params: ['After', card.id],
		});

		const updated = getCard(db, card.id);
		expect(updated?.name).toBe('After');
	});

	it('executes DELETE and returns correct change count', async () => {
		// Insert a ui_state row then delete it via db:exec
		handleUiSet(db, { key: 'execTest', value: 'value' });

		const result = handleDbExec(db, {
			sql: 'DELETE FROM ui_state WHERE key = ?',
			params: ['execTest'],
		});

		expect(result.changes).toBe(1);
		const check = handleUiGet(db, { key: 'execTest' });
		expect(check.value).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Protocol Type Compilation Tests
// ---------------------------------------------------------------------------

describe('Protocol type shapes (compile-time verification)', () => {
	it('WorkerPayloads ui:get shape is {key: string}', () => {
		// If this compiles, the types are correct
		const payload: import('../../src/worker/protocol').WorkerPayloads['ui:get'] = {
			key: 'test',
		};
		expect(payload.key).toBe('test');
	});

	it('WorkerResponses ui:get shape is {key, value, updated_at}', () => {
		const response: import('../../src/worker/protocol').WorkerResponses['ui:get'] = {
			key: 'test',
			value: null,
			updated_at: null,
		};
		expect(response.key).toBe('test');
		expect(response.value).toBeNull();
	});

	it('WorkerPayloads db:exec shape is {sql: string, params: unknown[]}', () => {
		const payload: import('../../src/worker/protocol').WorkerPayloads['db:exec'] = {
			sql: 'SELECT 1',
			params: [],
		};
		expect(payload.sql).toBe('SELECT 1');
	});

	it('WorkerResponses db:exec shape is {changes: number}', () => {
		const response: import('../../src/worker/protocol').WorkerResponses['db:exec'] = {
			changes: 0,
		};
		expect(response.changes).toBe(0);
	});
});
