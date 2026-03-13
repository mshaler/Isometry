// Isometry v5 — Phase 8 SQLiteWriter Tests
// Validates batched database writes with FTS optimization

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import type { ProgressCallback } from '../../src/etl/SQLiteWriter';
import { SQLiteWriter } from '../../src/etl/SQLiteWriter';
import type { CanonicalCard, CanonicalConnection } from '../../src/etl/types';
import { clearTraces, getTraces } from '../../src/profiling/PerfTrace';

describe('SQLiteWriter', () => {
	let db: Database;
	let writer: SQLiteWriter;

	beforeEach(async () => {
		db = new Database();
		await db.initialize();
		writer = new SQLiteWriter(db);
	});

	afterEach(() => {
		db.close();
	});

	describe('card insertion', () => {
		it('inserts cards with all fields correctly', async () => {
			const cards: CanonicalCard[] = [
				createCard('note-1', 'Test Note', {
					content: 'Test content',
					summary: 'Test summary',
					latitude: 37.7749,
					longitude: -122.4194,
					location_name: 'San Francisco',
					folder: 'Work',
					tags: ['important', 'project'],
					status: 'active',
					priority: 5,
					url: 'https://example.com',
					mime_type: 'text/plain',
				}),
			];

			await writer.writeCards(cards);

			const result = db.exec('SELECT * FROM cards WHERE source_id = ?', ['note-1']);
			expect(result[0]!.values).toHaveLength(1);

			const row = result[0]!.values[0]!;
			const columnMap = Object.fromEntries(result[0]!.columns.map((col, i) => [col, row[i]]));

			expect(columnMap['name']).toBe('Test Note');
			expect(columnMap['content']).toBe('Test content');
			expect(columnMap['summary']).toBe('Test summary');
			expect(columnMap['latitude']).toBe(37.7749);
			expect(columnMap['longitude']).toBe(-122.4194);
			expect(columnMap['location_name']).toBe('San Francisco');
			expect(columnMap['folder']).toBe('Work');
			expect(columnMap['status']).toBe('active');
			expect(columnMap['priority']).toBe(5);
			expect(columnMap['url']).toBe('https://example.com');
			expect(columnMap['mime_type']).toBe('text/plain');
		});

		it('JSON-stringifies tags before insert', async () => {
			const cards: CanonicalCard[] = [
				createCard('note-1', 'Tagged Note', {
					tags: ['work', 'urgent', 'meeting'],
				}),
			];

			await writer.writeCards(cards);

			const result = db.exec('SELECT tags FROM cards WHERE source_id = ?', ['note-1']);
			const tags = result[0]!.values[0]![0] as string;

			expect(tags).toBe('["work","urgent","meeting"]');
			expect(JSON.parse(tags)).toEqual(['work', 'urgent', 'meeting']);
		});

		it('handles null/empty tags', async () => {
			const cards: CanonicalCard[] = [createCard('note-1', 'No Tags', { tags: [] })];

			await writer.writeCards(cards);

			const result = db.exec('SELECT tags FROM cards WHERE source_id = ?', ['note-1']);
			const tags = result[0]!.values[0]![0] as string;

			expect(tags).toBe('[]');
		});

		it('converts is_collective boolean to integer', async () => {
			const cards: CanonicalCard[] = [
				createCard('note-1', 'Collective Note', { is_collective: true }),
				createCard('note-2', 'Individual Note', { is_collective: false }),
			];

			await writer.writeCards(cards);

			const result = db.exec('SELECT source_id, is_collective FROM cards ORDER BY source_id');
			expect(result[0]!.values[0]![1]).toBe(1); // note-1: true -> 1
			expect(result[0]!.values[1]![1]).toBe(0); // note-2: false -> 0
		});

		it('handles empty card array', async () => {
			await expect(writer.writeCards([])).resolves.not.toThrow();
		});
	});

	describe('batch processing', () => {
		it('processes cards in 100-card batches', async () => {
			// Create 250 cards to span 3 batches
			const cards: CanonicalCard[] = Array.from({ length: 250 }, (_, i) => createCard(`note-${i}`, `Note ${i}`));

			await writer.writeCards(cards);

			const result = db.exec('SELECT COUNT(*) as count FROM cards');
			expect(result[0]!.values[0]![0]).toBe(250);
		});

		it('yields between batches (setTimeout called)', async () => {
			// Create 150 cards to span 2 batches
			const cards: CanonicalCard[] = Array.from({ length: 150 }, (_, i) => createCard(`note-${i}`, `Note ${i}`));

			// Should complete without blocking
			await writer.writeCards(cards);

			const result = db.exec('SELECT COUNT(*) as count FROM cards');
			expect(result[0]!.values[0]![0]).toBe(150);
		});
	});

	describe('card updates', () => {
		it('updates existing cards', async () => {
			// Insert initial card
			const initialCard = createCard('note-1', 'Original Name', {
				content: 'Original content',
			});
			await writer.writeCards([initialCard]);

			// Update the card
			const updatedCard = createCard('note-1', 'Updated Name', {
				content: 'Updated content',
				folder: 'Updated Folder',
			});
			updatedCard.id = initialCard.id; // Same UUID

			await writer.updateCards([updatedCard]);

			const result = db.exec('SELECT name, content, folder FROM cards WHERE id = ?', [initialCard.id]);
			const row = result[0]!.values[0]!;

			expect(row[0]).toBe('Updated Name');
			expect(row[1]).toBe('Updated content');
			expect(row[2]).toBe('Updated Folder');
		});

		it('processes updates in 100-card batches', async () => {
			// Insert 150 cards
			const cards: CanonicalCard[] = Array.from({ length: 150 }, (_, i) => createCard(`note-${i}`, `Note ${i}`));
			await writer.writeCards(cards);

			// Update all 150 cards
			const updates = cards.map((card) => ({
				...card,
				name: `${card.name} Updated`,
			}));
			await writer.updateCards(updates);

			const result = db.exec('SELECT name FROM cards ORDER BY source_id LIMIT 1');
			expect(result[0]!.values[0]![0]).toBe('Note 0 Updated');
		});

		it('handles empty update array', async () => {
			await expect(writer.updateCards([])).resolves.not.toThrow();
		});
	});

	describe('connection insertion', () => {
		it('inserts connections with INSERT OR IGNORE', async () => {
			// Insert cards first
			const cards: CanonicalCard[] = [createCard('note-1', 'Note 1'), createCard('note-2', 'Note 2')];
			await writer.writeCards(cards);

			const connections: CanonicalConnection[] = [
				{
					id: 'conn-1',
					source_id: cards[0]!.id,
					target_id: cards[1]!.id,
					via_card_id: null,
					label: 'links to',
					weight: 1.0,
					created_at: '2026-03-01T12:00:00Z',
				},
			];

			await writer.writeConnections(connections);

			const result = db.exec('SELECT * FROM connections WHERE id = ?', ['conn-1']);
			expect(result[0]!.values).toHaveLength(1);

			const row = result[0]!.values[0]!;
			const columnMap = Object.fromEntries(result[0]!.columns.map((col, i) => [col, row[i]]));

			expect(columnMap['source_id']).toBe(cards[0]!.id);
			expect(columnMap['target_id']).toBe(cards[1]!.id);
			expect(columnMap['label']).toBe('links to');
			expect(columnMap['weight']).toBe(1.0);
		});

		it('silently drops duplicate connections', async () => {
			const cards: CanonicalCard[] = [createCard('note-1', 'Note 1'), createCard('note-2', 'Note 2')];
			await writer.writeCards(cards);

			const connection: CanonicalConnection = {
				id: 'conn-1',
				source_id: cards[0]!.id,
				target_id: cards[1]!.id,
				via_card_id: null,
				label: 'links to',
				weight: 1.0,
				created_at: '2026-03-01T12:00:00Z',
			};

			// Insert same connection twice
			await writer.writeConnections([connection]);
			await writer.writeConnections([connection]);

			const result = db.exec('SELECT COUNT(*) as count FROM connections');
			expect(result[0]!.values[0]![0]).toBe(1); // Only one inserted
		});

		it('handles empty connection array', async () => {
			await expect(writer.writeConnections([])).resolves.not.toThrow();
		});
	});

	describe('FTS optimization', () => {
		it('disables and restores FTS triggers for bulk imports over 500 cards', async () => {
			// Create 600 cards to trigger FTS optimization
			const cards: CanonicalCard[] = Array.from({ length: 600 }, (_, i) =>
				createCard(`note-${i}`, `Note ${i}`, {
					content: `Content for note ${i}`,
				}),
			);

			await writer.writeCards(cards, true); // isBulkImport = true

			// Verify all cards inserted
			const countResult = db.exec('SELECT COUNT(*) as count FROM cards');
			expect(countResult[0]!.values[0]![0]).toBe(600);

			// Verify FTS index was rebuilt
			const ftsResult = db.exec(`SELECT COUNT(*) as count FROM cards_fts`);
			expect(ftsResult[0]!.values[0]![0]).toBe(600);

			// Verify triggers are restored (try inserting a new card)
			const newCard = createCard('note-new', 'New Note After Bulk', {
				content: 'New content',
			});
			await writer.writeCards([newCard]);

			// FTS should have been updated automatically via trigger
			const ftsAfterResult = db.exec(`SELECT COUNT(*) as count FROM cards_fts`);
			expect(ftsAfterResult[0]!.values[0]![0]).toBe(601);
		});

		it('does not use FTS optimization for imports under 500 cards', async () => {
			// Create 400 cards (below threshold)
			const cards: CanonicalCard[] = Array.from({ length: 400 }, (_, i) =>
				createCard(`note-${i}`, `Note ${i}`, {
					content: `Content ${i}`,
				}),
			);

			await writer.writeCards(cards, true); // isBulkImport = true, but below threshold

			// Verify cards inserted
			const result = db.exec('SELECT COUNT(*) as count FROM cards');
			expect(result[0]!.values[0]![0]).toBe(400);

			// FTS should have been updated via triggers (not bulk rebuild)
			const ftsResult = db.exec(`SELECT COUNT(*) as count FROM cards_fts`);
			expect(ftsResult[0]!.values[0]![0]).toBe(400);
		});

		it('FTS search works after bulk import', async () => {
			// Create 600 cards with searchable content
			const cards: CanonicalCard[] = [
				...Array.from({ length: 599 }, (_, i) => createCard(`note-${i}`, `Note ${i}`)),
				createCard('note-special', 'Special Note', {
					content: 'This note contains the keyword FINDME for testing',
				}),
			];

			await writer.writeCards(cards, true);

			// Search FTS index
			const searchResult = db.exec(`
        SELECT name FROM cards_fts WHERE cards_fts MATCH 'FINDME'
      `);

			expect(searchResult[0]!.values).toHaveLength(1);
			expect(searchResult[0]!.values[0]![0]).toBe('Special Note');
		});
	});

	describe('progress callback', () => {
		it('writeCards calls onProgress callback at batch boundaries', async () => {
			const cards: CanonicalCard[] = Array.from({ length: 250 }, (_, i) => createCard(`note-${i}`, `Note ${i}`));

			const progressCalls: Array<{ processed: number; total: number; rate: number }> = [];
			const onProgress: ProgressCallback = (processed, total, rate) => {
				progressCalls.push({ processed, total, rate });
			};

			await writer.writeCards(cards, false, onProgress);

			// 250 cards = 3 batches: [0..99], [100..199], [200..249]
			expect(progressCalls).toHaveLength(3);
			expect(progressCalls[0]!.processed).toBe(100);
			expect(progressCalls[0]!.total).toBe(250);
			expect(progressCalls[1]!.processed).toBe(200);
			expect(progressCalls[1]!.total).toBe(250);
			expect(progressCalls[2]!.processed).toBe(250);
			expect(progressCalls[2]!.total).toBe(250);
		});

		it('writeCards without onProgress still works', async () => {
			const cards: CanonicalCard[] = Array.from({ length: 150 }, (_, i) => createCard(`note-${i}`, `Note ${i}`));

			// Should work without callback
			await writer.writeCards(cards);

			const result = db.exec('SELECT COUNT(*) as count FROM cards');
			expect(result[0]!.values[0]![0]).toBe(150);
		});

		it('rate calculation produces a positive number', async () => {
			const cards: CanonicalCard[] = Array.from({ length: 200 }, (_, i) => createCard(`note-${i}`, `Note ${i}`));

			const rates: number[] = [];
			const onProgress: ProgressCallback = (_processed, _total, rate) => {
				rates.push(rate);
			};

			await writer.writeCards(cards, false, onProgress);

			// All rates should be non-negative, finite numbers
			for (const rate of rates) {
				expect(Number.isFinite(rate)).toBe(true);
				expect(rate).toBeGreaterThanOrEqual(0);
				expect(Number.isNaN(rate)).toBe(false);
			}
		});
	});

	describe('optimizeFTS', () => {
		it('does not throw on valid database', () => {
			expect(() => writer.optimizeFTS()).not.toThrow();
		});

		it('silently handles failure', () => {
			// Close the database to force FTS optimize to fail
			const closedDb = new Database();
			const closedWriter = new SQLiteWriter(closedDb);
			// Don't initialize — db.run will fail
			expect(() => closedWriter.optimizeFTS()).not.toThrow();
			closedDb.close();
		});
	});

	// Phase 77-01: injectable batchSize + FTS PerfTrace spans
	describe('injectable batchSize (Phase 77-01 - IMPT-01)', () => {
		it('accepts custom batchSize in constructor and uses it for batching', async () => {
			// Create a writer with batchSize=50 and 110 cards → 3 batches not 2
			const smallBatchWriter = new SQLiteWriter(db, 50);
			const cards: CanonicalCard[] = Array.from({ length: 110 }, (_, i) =>
				createCard(`nb-${i}`, `Batch Note ${i}`),
			);

			const batchBoundaries: number[] = [];
			const onProgress: ProgressCallback = (processed, _total, _rate) => {
				batchBoundaries.push(processed);
			};

			await smallBatchWriter.writeCards(cards, false, onProgress);

			// With batchSize=50 and 110 cards: batches at 50, 100, 110 → 3 calls
			expect(batchBoundaries).toHaveLength(3);
			expect(batchBoundaries[0]).toBe(50);
			expect(batchBoundaries[1]).toBe(100);
			expect(batchBoundaries[2]).toBe(110);
		});

		it('default batchSize=100 preserves existing behavior', async () => {
			const cards: CanonicalCard[] = Array.from({ length: 250 }, (_, i) =>
				createCard(`def-${i}`, `Default Note ${i}`),
			);

			const batchBoundaries: number[] = [];
			const onProgress: ProgressCallback = (processed, _total, _rate) => {
				batchBoundaries.push(processed);
			};

			await writer.writeCards(cards, false, onProgress);

			// Default batchSize=100 with 250 cards → batches at 100, 200, 250
			expect(batchBoundaries).toHaveLength(3);
			expect(batchBoundaries[0]).toBe(100);
			expect(batchBoundaries[1]).toBe(200);
			expect(batchBoundaries[2]).toBe(250);
		});
	});

	describe('FTS PerfTrace spans (Phase 77-01 - IMPT-02)', () => {
		beforeEach(() => {
			clearTraces();
		});

		it('records etl:fts:disable trace during bulk import', async () => {
			const cards: CanonicalCard[] = Array.from({ length: 600 }, (_, i) =>
				createCard(`fts-${i}`, `FTS Note ${i}`, { content: `Content ${i}` }),
			);

			await writer.writeCards(cards, true);

			const disableTraces = getTraces('etl:fts:disable');
			expect(disableTraces.length).toBeGreaterThan(0);
			expect(disableTraces[0]!.duration).toBeGreaterThanOrEqual(0);
		});

		it('records etl:fts:rebuild trace during bulk import', async () => {
			const cards: CanonicalCard[] = Array.from({ length: 600 }, (_, i) =>
				createCard(`fts2-${i}`, `FTS Note ${i}`),
			);

			await writer.writeCards(cards, true);

			const rebuildTraces = getTraces('etl:fts:rebuild');
			expect(rebuildTraces.length).toBeGreaterThan(0);
			expect(rebuildTraces[0]!.duration).toBeGreaterThanOrEqual(0);
		});

		it('records etl:fts:restore trace during bulk import', async () => {
			const cards: CanonicalCard[] = Array.from({ length: 600 }, (_, i) =>
				createCard(`fts3-${i}`, `FTS Note ${i}`),
			);

			await writer.writeCards(cards, true);

			const restoreTraces = getTraces('etl:fts:restore');
			expect(restoreTraces.length).toBeGreaterThan(0);
			expect(restoreTraces[0]!.duration).toBeGreaterThanOrEqual(0);
		});

		it('does not record FTS traces for non-bulk imports', async () => {
			clearTraces();
			const cards: CanonicalCard[] = Array.from({ length: 10 }, (_, i) =>
				createCard(`small-${i}`, `Small Note ${i}`),
			);

			await writer.writeCards(cards, false);

			expect(getTraces('etl:fts:disable')).toHaveLength(0);
			expect(getTraces('etl:fts:rebuild')).toHaveLength(0);
			expect(getTraces('etl:fts:restore')).toHaveLength(0);
		});
	});
});

// Helper to create a minimal CanonicalCard with optional overrides
function createCard(sourceId: string, name: string, overrides?: Partial<CanonicalCard>): CanonicalCard {
	const timestamp = '2026-03-01T12:00:00Z';
	return {
		id: `uuid-${sourceId}`,
		card_type: 'note',
		name,
		content: null,
		summary: null,
		latitude: null,
		longitude: null,
		location_name: null,
		created_at: timestamp,
		modified_at: timestamp,
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
		source: 'apple_notes',
		source_id: sourceId,
		source_url: null,
		deleted_at: null,
		...overrides,
	};
}
