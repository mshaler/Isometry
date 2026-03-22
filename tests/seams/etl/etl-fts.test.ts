// Isometry v6.1 — Phase 83 Plan 01
// ETL-to-FTS5 seam tests.
//
// These tests verify the full pipeline from SQLiteWriter card insertion through
// FTS5 triggers through searchCards() FTS5 MATCH query produces correct results.
//
// Two code paths are tested:
//   - Trigger path: writeCards(cards, false) — each INSERT fires cards_fts_ai trigger
//   - Bulk path: writeCards(cards, true, >500 cards) — disables triggers, rebuilds FTS index
//
// Requirements: EFTS-01, EFTS-02

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/database/Database';
import { SQLiteWriter } from '../../../src/etl/SQLiteWriter';
import type { CanonicalCard } from '../../../src/etl/types';
import { searchCards } from '../../../src/database/queries/search';
import { realDb } from '../../harness/realDb';

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let db: Database;

beforeEach(async () => {
	db = await realDb();
});

afterEach(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// CanonicalCard factory helper
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<CanonicalCard>): CanonicalCard {
	return {
		id: crypto.randomUUID(),
		card_type: 'note',
		name: 'Test Card',
		content: null,
		summary: null,
		latitude: null,
		longitude: null,
		location_name: null,
		created_at: new Date().toISOString(),
		modified_at: new Date().toISOString(),
		due_at: null,
		completed_at: null,
		event_start: null,
		event_end: null,
		folder: null,
		tags: [],
		status: null,
		priority: 0,
		sort_order: 0,
		url: null,
		mime_type: null,
		is_collective: false,
		source: 'test',
		source_id: crypto.randomUUID(),
		source_url: null,
		deleted_at: null,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// EFTS-01: Trigger path — INSERT fires cards_fts_ai → FTS5 searchable
// ---------------------------------------------------------------------------

describe('EFTS-01: trigger path — writeCards(false) produces searchable FTS5 results', () => {
	it('EFTS-01a: 3 cards written via writeCards(false) are findable via searchCards by name', async () => {
		const cards = [
			makeCard({ name: 'Alpha Project' }),
			makeCard({ name: 'Beta Initiative' }),
			makeCard({ name: 'Gamma Research' }),
		];

		const writer = new SQLiteWriter(db);
		await writer.writeCards(cards, false);

		const results = searchCards(db, 'Alpha');
		expect(results).toHaveLength(1);
		expect(results[0]!.card.name).toBe('Alpha Project');
	});

	it('EFTS-01b: cards_fts rowcount matches cards rowcount after trigger-path insert', async () => {
		const cards = [
			makeCard({ name: 'Card One' }),
			makeCard({ name: 'Card Two' }),
			makeCard({ name: 'Card Three' }),
		];

		const writer = new SQLiteWriter(db);
		await writer.writeCards(cards, false);

		const cardCount = db.exec('SELECT count(*) FROM cards WHERE deleted_at IS NULL')[0]!.values[0]![0] as number;
		const ftsCount = db.exec('SELECT count(*) FROM cards_fts')[0]!.values[0]![0] as number;
		expect(ftsCount).toBe(cardCount);
		expect(cardCount).toBe(3);
	});

	it('EFTS-01c: FTS search on content field returns matching card', async () => {
		const cards = [
			makeCard({ name: 'Physics Notes', content: 'quantum physics notes about entanglement' }),
			makeCard({ name: 'History Notes', content: 'ancient rome and the roman empire' }),
		];

		const writer = new SQLiteWriter(db);
		await writer.writeCards(cards, false);

		const results = searchCards(db, 'quantum');
		expect(results).toHaveLength(1);
		expect(results[0]!.card.name).toBe('Physics Notes');
	});

	it('EFTS-01d: FTS search for non-existent term returns empty array', async () => {
		const cards = [
			makeCard({ name: 'Alpha Project' }),
			makeCard({ name: 'Beta Initiative' }),
		];

		const writer = new SQLiteWriter(db);
		await writer.writeCards(cards, false);

		const results = searchCards(db, 'zzz_nonexistent_zzz');
		expect(results).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// EFTS-02: Re-import and bulk import paths
// ---------------------------------------------------------------------------

describe('EFTS-02: re-import and bulk import update FTS5 index correctly', () => {
	it('EFTS-02a: updateCards() updates FTS index — old name returns 0, new name returns 1', async () => {
		const card = makeCard({ name: 'OldProjectName' });

		const writer = new SQLiteWriter(db);
		await writer.writeCards([card], false);

		// Verify old name is searchable before update
		const beforeResults = searchCards(db, 'OldProjectName');
		expect(beforeResults).toHaveLength(1);

		// Update card name via updateCards()
		await writer.updateCards([{ ...card, name: 'NewProjectName' }]);

		// Old name should return 0 results
		const oldResults = searchCards(db, 'OldProjectName');
		expect(oldResults).toHaveLength(0);

		// New name should return 1 result
		const newResults = searchCards(db, 'NewProjectName');
		expect(newResults).toHaveLength(1);
		expect(newResults[0]!.card.name).toBe('NewProjectName');
	});

	it('EFTS-02b: bulk import (501 cards, isBulkImport=true) produces correct FTS index — specific card findable', async () => {
		const cards: CanonicalCard[] = [];
		for (let i = 0; i < 501; i++) {
			cards.push(makeCard({ name: `Card-${i}` }));
		}
		// Last card has a unique searchable name
		cards.push(makeCard({ name: 'UniqueSpecialCard' }));

		const writer = new SQLiteWriter(db);
		await writer.writeCards(cards, true);

		const results = searchCards(db, 'UniqueSpecialCard');
		expect(results).toHaveLength(1);
		expect(results[0]!.card.name).toBe('UniqueSpecialCard');
	});

	it('EFTS-02c: after bulk import, cards_fts rowcount matches cards rowcount', async () => {
		const cards: CanonicalCard[] = [];
		for (let i = 0; i < 501; i++) {
			cards.push(makeCard({ name: `BulkCard-${i}` }));
		}

		const writer = new SQLiteWriter(db);
		await writer.writeCards(cards, true);

		const cardCount = db.exec('SELECT count(*) FROM cards WHERE deleted_at IS NULL')[0]!.values[0]![0] as number;
		const ftsCount = db.exec('SELECT count(*) FROM cards_fts')[0]!.values[0]![0] as number;
		expect(ftsCount).toBe(cardCount);
		expect(cardCount).toBe(501);
	});

	it('EFTS-02d: soft-deleted card is excluded from searchCards() results', async () => {
		const cardA = makeCard({ name: 'ActiveCard' });
		const cardB = makeCard({ name: 'DeletedCard' });

		const writer = new SQLiteWriter(db);
		await writer.writeCards([cardA, cardB], false);

		// Soft-delete cardB via raw SQL
		const deletedAt = new Date().toISOString();
		db.run('UPDATE cards SET deleted_at = ? WHERE id = ?', [deletedAt, cardB.id]);

		// searchCards() JOIN includes AND c.deleted_at IS NULL — deleted card excluded
		const activeResults = searchCards(db, 'ActiveCard');
		expect(activeResults).toHaveLength(1);
		expect(activeResults[0]!.card.name).toBe('ActiveCard');

		const deletedResults = searchCards(db, 'DeletedCard');
		expect(deletedResults).toHaveLength(0);
	});
});
