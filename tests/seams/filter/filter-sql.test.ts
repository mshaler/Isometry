/**
 * Isometry v6.1 — Phase 80 Filter-to-SQL Seam Tests
 *
 * Verifies that FilterProvider.compile() produces SQL WHERE fragments that
 * select the correct rows when executed against a real sql.js database.
 * No mocks for the database layer — all queries run against real sql.js.
 *
 * Requirements: FSQL-01, FSQL-02, FSQL-03, FSQL-04, FSQL-05
 *
 * Test lifecycle:
 *   beforeEach: db = await realDb(), providers = makeProviders(db), seed standard 6-card set
 *   afterEach:  providers.coordinator.destroy(), db.close()
 *
 * Seed set:
 *   Alpha   — folder:Work,     status:active,   priority:1, card_type:note
 *   Beta    — folder:Work,     status:done,     priority:2, card_type:task
 *   Gamma   — folder:Personal, status:active,   priority:3, card_type:note
 *   Delta   — folder:Personal, status:archived, priority:4, card_type:event
 *   Epsilon — folder:Work,     status:active,   priority:5, card_type:task
 *   Zeta    — folder:Archive,  status:done,     priority:0, card_type:note, deleted_at set
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

	// Standard 6-card seed set — supports all filter assertions without per-test re-seeding.
	// Zeta is soft-deleted (deleted_at set) and must NEVER appear in any query result.
	seedCards(db, [
		{ name: 'Alpha', folder: 'Work', status: 'active', priority: 1, card_type: 'note' },
		{ name: 'Beta', folder: 'Work', status: 'done', priority: 2, card_type: 'task' },
		{ name: 'Gamma', folder: 'Personal', status: 'active', priority: 3, card_type: 'note' },
		{ name: 'Delta', folder: 'Personal', status: 'archived', priority: 4, card_type: 'event' },
		{ name: 'Epsilon', folder: 'Work', status: 'active', priority: 5, card_type: 'task' },
		{
			name: 'Zeta',
			folder: 'Archive',
			status: 'done',
			priority: 0,
			card_type: 'note',
			deleted_at: '2026-01-01T00:00:00.000Z',
		},
	]);
});

afterEach(() => {
	providers.coordinator.destroy();
	db.close();
});

// ---------------------------------------------------------------------------
// FSQL-01: eq / neq / in / contains / isNull filters
// ---------------------------------------------------------------------------

describe('FSQL-01: eq/neq/in filters', () => {
	it('eq — folder = Work returns Alpha, Beta, Epsilon (Zeta excluded by deleted_at)', () => {
		filter.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Alpha', 'Beta', 'Epsilon']);
	});

	it('neq — status != active returns Beta, Delta (Zeta excluded by deleted_at)', () => {
		filter.addFilter({ field: 'status', operator: 'neq', value: 'active' });
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Beta', 'Delta']);
	});

	it('in — card_type IN [note, event] returns Alpha, Delta, Gamma', () => {
		filter.addFilter({ field: 'card_type', operator: 'in', value: ['note', 'event'] });
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Alpha', 'Delta', 'Gamma']);
	});

	it('contains — name LIKE %a% returns cards with "a" in name (case-insensitive LIKE)', () => {
		filter.addFilter({ field: 'name', operator: 'contains', value: 'a' });
		const names = queryWithFilter(db, filter);
		// Alpha, Beta, Delta, Gamma all contain 'a' (case-insensitive LIKE in SQLite)
		// Epsilon has no 'a' — not returned; Zeta excluded by deleted_at
		expect(names).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
	});

	it('isNull — folder IS NULL returns empty (all live cards have folders)', () => {
		filter.addFilter({ field: 'folder', operator: 'isNull', value: null });
		const names = queryWithFilter(db, filter);
		expect(names).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// FSQL-02: FTS search and FTS+field compound filters
// ---------------------------------------------------------------------------

describe('FSQL-02: FTS search and FTS+field compound', () => {
	it('FTS search only — setSearchQuery("Alpha") returns ["Alpha"]', () => {
		filter.setSearchQuery('Alpha');
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Alpha']);
	});

	it('FTS + field compound — "a" AND folder=Work returns intersection of matching cards', () => {
		// FTS matches cards containing token starting with "a" — could be Alpha, etc.
		// folder=Work narrows to Alpha, Beta, Epsilon
		filter.setSearchQuery('Alpha');
		filter.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
		const names = queryWithFilter(db, filter);
		// Alpha matches FTS "Alpha" AND has folder Work
		expect(names).toEqual(['Alpha']);
	});

	it('FTS no results — setSearchQuery("nonexistent_xyz") returns []', () => {
		filter.setSearchQuery('nonexistent_xyz');
		const names = queryWithFilter(db, filter);
		expect(names).toEqual([]);
	});

	it('compile().where contains both "deleted_at IS NULL" and "rowid IN" for FTS query', () => {
		filter.setSearchQuery('Alpha');
		const { where } = filter.compile();
		expect(where).toContain('deleted_at IS NULL');
		expect(where).toContain('rowid IN');
	});
});

// ---------------------------------------------------------------------------
// FSQL-03: Range and axis filters
// ---------------------------------------------------------------------------

describe('FSQL-03: range and axis filters', () => {
	it('range filter — priority 2..4 returns Beta, Delta, Gamma', () => {
		filter.setRangeFilter('priority', 2, 4);
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Beta', 'Delta', 'Gamma']);
	});

	it('range filter min only — priority >= 3 returns Delta, Epsilon, Gamma', () => {
		filter.setRangeFilter('priority', 3, null);
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Delta', 'Epsilon', 'Gamma']);
	});

	it('axis filter — folder IN [Work, Archive] returns Alpha, Beta, Epsilon (Zeta excluded by deleted_at)', () => {
		filter.setAxisFilter('folder', ['Work', 'Archive']);
		const names = queryWithFilter(db, filter);
		// Zeta is in Archive but is soft-deleted — must not appear
		expect(names).toEqual(['Alpha', 'Beta', 'Epsilon']);
	});

	it('axis + range compound — folder=Work AND priority 1..2 returns Alpha, Beta', () => {
		filter.setAxisFilter('folder', ['Work']);
		filter.setRangeFilter('priority', 1, 2);
		const names = queryWithFilter(db, filter);
		expect(names).toEqual(['Alpha', 'Beta']);
	});
});

// ---------------------------------------------------------------------------
// FSQL-04: Allowlist validation blocks invalid fields
// ---------------------------------------------------------------------------

describe('FSQL-04: allowlist validation', () => {
	it('addFilter with invalid field throws SQL safety violation before SQL executes', () => {
		expect(() => {
			filter.addFilter({ field: 'DROP TABLE cards' as never, operator: 'eq', value: 'x' });
		}).toThrow(/SQL safety violation/);
	});

	it('setAxisFilter with invalid field throws SQL safety violation', () => {
		expect(() => {
			filter.setAxisFilter('bobby_tables', ['x']);
		}).toThrow(/SQL safety violation/);
	});

	it('setRangeFilter with invalid field throws SQL safety violation', () => {
		expect(() => {
			filter.setRangeFilter('1=1; --', 0, 10);
		}).toThrow(/SQL safety violation/);
	});
});

// ---------------------------------------------------------------------------
// FSQL-05: Soft-deleted rows excluded from all filter query results
// ---------------------------------------------------------------------------

describe('FSQL-05: soft-deleted rows excluded', () => {
	it('base compile (no filters) excludes soft-deleted Zeta — returns exactly 5 names', () => {
		const names = queryWithFilter(db, filter);
		expect(names).toHaveLength(5);
		expect(names).not.toContain('Zeta');
	});

	it('eq filter matching deleted card folder returns empty (Zeta is only Archive card)', () => {
		filter.addFilter({ field: 'folder', operator: 'eq', value: 'Archive' });
		const names = queryWithFilter(db, filter);
		expect(names).toEqual([]);
	});

	it('FTS search for deleted card name returns nothing (deleted_at IS NULL excludes Zeta)', () => {
		// The FTS index DOES contain Zeta (trigger fires on INSERT regardless of deleted_at).
		// But compile().where includes "deleted_at IS NULL AND rowid IN (...)" which excludes Zeta.
		filter.setSearchQuery('Zeta');
		const names = queryWithFilter(db, filter);
		expect(names).toEqual([]);
	});
});
