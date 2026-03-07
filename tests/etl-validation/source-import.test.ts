// Isometry v5 -- Phase 47 Source Import Validation Tests
// ETLV-01: All 6 file-based sources import correctly
// ETLV-02: All 3 native sources import correctly

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import type { ParsedFile } from '../../src/etl/parsers/AppleNotesParser';
import type { CanonicalCard } from '../../src/etl/types';
import {
	createTestDb,
	generateExcelBuffer,
	importFileSource,
	importNativeSource,
	loadFixture,
	loadFixtureJSON,
	queryCardsForSource,
	queryConnectionCount,
} from './helpers';

describe('Source Import Validation', () => {
	// -----------------------------------------------------------------------
	// File-based sources (ETLV-01)
	// -----------------------------------------------------------------------
	describe('File-based sources (ETLV-01)', () => {
		// -------------------------------------------------------------------
		// Apple Notes
		// -------------------------------------------------------------------
		describe('Apple Notes', () => {
			let db: Database;

			beforeEach(async () => {
				db = await createTestDb();
			});
			afterEach(() => db.close());

			it('imports 100+ cards with zero errors', async () => {
				const fixture = loadFixture('apple-notes-snapshot.json');
				const result = await importFileSource(db, 'apple_notes', fixture);

				expect(result.inserted).toBeGreaterThanOrEqual(100);
				expect(result.errors).toBe(0);
			});

			it('every card has source = apple_notes', async () => {
				const fixture = loadFixture('apple-notes-snapshot.json');
				await importFileSource(db, 'apple_notes', fixture);

				const cards = queryCardsForSource(db, 'apple_notes');
				expect(cards.length).toBeGreaterThanOrEqual(100);
				for (const card of cards) {
					expect(card.source).toBe('apple_notes');
				}
			});

			it('every card has a non-empty name', async () => {
				const fixture = loadFixture('apple-notes-snapshot.json');
				await importFileSource(db, 'apple_notes', fixture);

				const cards = queryCardsForSource(db, 'apple_notes');
				for (const card of cards) {
					expect(card.name.length).toBeGreaterThan(0);
				}
			});

			it('creates connections from note links', async () => {
				const fixture = loadFixture('apple-notes-snapshot.json');
				const result = await importFileSource(db, 'apple_notes', fixture);

				expect(result.connections_created).toBeGreaterThan(0);
				expect(queryConnectionCount(db)).toBeGreaterThan(0);
			});
		});

		// -------------------------------------------------------------------
		// Markdown
		// -------------------------------------------------------------------
		describe('Markdown', () => {
			let db: Database;

			beforeEach(async () => {
				db = await createTestDb();
			});
			afterEach(() => db.close());

			it('imports 100+ cards with zero errors', async () => {
				const fixture = loadFixture('markdown-snapshot.json');
				const result = await importFileSource(db, 'markdown', fixture);

				expect(result.inserted).toBeGreaterThanOrEqual(100);
				expect(result.errors).toBe(0);
			});

			it('every card has source = markdown', async () => {
				const fixture = loadFixture('markdown-snapshot.json');
				await importFileSource(db, 'markdown', fixture);

				const cards = queryCardsForSource(db, 'markdown');
				expect(cards.length).toBeGreaterThanOrEqual(100);
				for (const card of cards) {
					expect(card.source).toBe('markdown');
				}
			});

			it('every card has a non-empty name', async () => {
				const fixture = loadFixture('markdown-snapshot.json');
				await importFileSource(db, 'markdown', fixture);

				const cards = queryCardsForSource(db, 'markdown');
				for (const card of cards) {
					expect(card.name.length).toBeGreaterThan(0);
				}
			});

			it('tags parsed from frontmatter are present in database', async () => {
				const fixture = loadFixture('markdown-snapshot.json');
				await importFileSource(db, 'markdown', fixture);

				// Query raw tags column to verify tags made it through
				const stmt = db.prepare<{ tags: string }>(
					"SELECT tags FROM cards WHERE source = 'markdown' AND tags != '[]' LIMIT 10",
				);
				const rows = stmt.all();
				stmt.free();

				expect(rows.length).toBeGreaterThan(0);
				// Tags should be JSON array strings
				const firstTags = JSON.parse(rows[0]!.tags);
				expect(Array.isArray(firstTags)).toBe(true);
				expect(firstTags.length).toBeGreaterThan(0);
			});
		});

		// -------------------------------------------------------------------
		// CSV
		// -------------------------------------------------------------------
		describe('CSV', () => {
			let db: Database;

			beforeEach(async () => {
				db = await createTestDb();
			});
			afterEach(() => db.close());

			it('imports 100+ cards with zero errors', async () => {
				const fixture = loadFixture('csv-snapshot.json');
				const result = await importFileSource(db, 'csv', fixture);

				expect(result.inserted).toBeGreaterThanOrEqual(100);
				expect(result.errors).toBe(0);
			});

			it('every card has source = csv', async () => {
				const fixture = loadFixture('csv-snapshot.json');
				await importFileSource(db, 'csv', fixture);

				const cards = queryCardsForSource(db, 'csv');
				expect(cards.length).toBeGreaterThanOrEqual(100);
				for (const card of cards) {
					expect(card.source).toBe('csv');
				}
			});

			it('every card has a non-empty name', async () => {
				const fixture = loadFixture('csv-snapshot.json');
				await importFileSource(db, 'csv', fixture);

				const cards = queryCardsForSource(db, 'csv');
				for (const card of cards) {
					expect(card.name.length).toBeGreaterThan(0);
				}
			});

			it('BOM handled correctly - first column name not corrupted', async () => {
				const fixture = loadFixture('csv-snapshot.json');
				await importFileSource(db, 'csv', fixture);

				// The title column should map correctly despite BOM prefix
				const cards = queryCardsForSource(db, 'csv');
				expect(cards.length).toBeGreaterThanOrEqual(100);
				// Cards with 'CSV Item' prefix should exist (BOM didn't corrupt title column detection)
				const csvCards = cards.filter((c) => c.name.includes('CSV Item'));
				expect(csvCards.length).toBeGreaterThan(0);
				// Name should not start with BOM character
				for (const card of cards) {
					expect(card.name.startsWith('\uFEFF')).toBe(false);
				}
			});
		});

		// -------------------------------------------------------------------
		// JSON
		// -------------------------------------------------------------------
		describe('JSON', () => {
			let db: Database;

			beforeEach(async () => {
				db = await createTestDb();
			});
			afterEach(() => db.close());

			it('imports 100+ cards with zero errors', async () => {
				const fixture = loadFixture('json-snapshot.json');
				const result = await importFileSource(db, 'json', fixture);

				expect(result.inserted).toBeGreaterThanOrEqual(100);
				expect(result.errors).toBe(0);
			});

			it('every card has source = json', async () => {
				const fixture = loadFixture('json-snapshot.json');
				await importFileSource(db, 'json', fixture);

				const cards = queryCardsForSource(db, 'json');
				expect(cards.length).toBeGreaterThanOrEqual(100);
				for (const card of cards) {
					expect(card.source).toBe('json');
				}
			});

			it('every card has a non-empty name', async () => {
				const fixture = loadFixture('json-snapshot.json');
				await importFileSource(db, 'json', fixture);

				const cards = queryCardsForSource(db, 'json');
				for (const card of cards) {
					expect(card.name.length).toBeGreaterThan(0);
				}
			});

			it('fields mapped via HEADER_SYNONYMS (title/name/subject/heading)', async () => {
				const fixture = loadFixture('json-snapshot.json');
				await importFileSource(db, 'json', fixture);

				const cards = queryCardsForSource(db, 'json');
				// All 110 items should produce cards regardless of field name variant
				expect(cards.length).toBeGreaterThanOrEqual(100);
			});
		});

		// -------------------------------------------------------------------
		// Excel
		// -------------------------------------------------------------------
		describe('Excel', () => {
			let db: Database;

			beforeEach(async () => {
				db = await createTestDb();
			});
			afterEach(() => db.close());

			it('imports 100+ cards with zero errors', async () => {
				const rows = loadFixtureJSON<Record<string, unknown>[]>('excel-rows.json');
				const buffer = await generateExcelBuffer(rows);
				const result = await importFileSource(db, 'excel', buffer);

				expect(result.inserted).toBeGreaterThanOrEqual(100);
				expect(result.errors).toBe(0);
			});

			it('every card has source = excel', async () => {
				const rows = loadFixtureJSON<Record<string, unknown>[]>('excel-rows.json');
				const buffer = await generateExcelBuffer(rows);
				await importFileSource(db, 'excel', buffer);

				const cards = queryCardsForSource(db, 'excel');
				expect(cards.length).toBeGreaterThanOrEqual(100);
				for (const card of cards) {
					expect(card.source).toBe('excel');
				}
			});

			it('every card has a non-empty name', async () => {
				const rows = loadFixtureJSON<Record<string, unknown>[]>('excel-rows.json');
				const buffer = await generateExcelBuffer(rows);
				await importFileSource(db, 'excel', buffer);

				const cards = queryCardsForSource(db, 'excel');
				for (const card of cards) {
					expect(card.name.length).toBeGreaterThan(0);
				}
			});
		});

		// -------------------------------------------------------------------
		// HTML
		// -------------------------------------------------------------------
		describe('HTML', () => {
			let db: Database;

			beforeEach(async () => {
				db = await createTestDb();
			});
			afterEach(() => db.close());

			it('imports 100+ cards with zero errors', async () => {
				const htmlStrings = loadFixtureJSON<string[]>('html-snapshot.json');
				// Pass array directly to orchestrator (HTML expects string[])
				const orchestrator = new ImportOrchestrator(db);
				const result = await orchestrator.import('html', htmlStrings as unknown as ParsedFile[]);

				expect(result.inserted).toBeGreaterThanOrEqual(100);
				expect(result.errors).toBe(0);
			});

			it('every card has source = html', async () => {
				const htmlStrings = loadFixtureJSON<string[]>('html-snapshot.json');
				const orchestrator = new ImportOrchestrator(db);
				await orchestrator.import('html', htmlStrings as unknown as ParsedFile[]);

				const cards = queryCardsForSource(db, 'html');
				expect(cards.length).toBeGreaterThanOrEqual(100);
				for (const card of cards) {
					expect(card.source).toBe('html');
				}
			});

			it('every card has a non-empty name', async () => {
				const htmlStrings = loadFixtureJSON<string[]>('html-snapshot.json');
				const orchestrator = new ImportOrchestrator(db);
				await orchestrator.import('html', htmlStrings as unknown as ParsedFile[]);

				const cards = queryCardsForSource(db, 'html');
				for (const card of cards) {
					expect(card.name.length).toBeGreaterThan(0);
				}
			});

			it('no script content in imported cards', async () => {
				const htmlStrings = loadFixtureJSON<string[]>('html-snapshot.json');
				const orchestrator = new ImportOrchestrator(db);
				await orchestrator.import('html', htmlStrings as unknown as ParsedFile[]);

				const stmt = db.prepare<{ content: string }>("SELECT content FROM cards WHERE source = 'html'");
				const rows = stmt.all();
				stmt.free();

				for (const row of rows) {
					if (row.content) {
						expect(row.content).not.toContain('<script>');
					}
				}
			});
		});
	});

	// -----------------------------------------------------------------------
	// Native sources (ETLV-02)
	// -----------------------------------------------------------------------
	describe('Native sources (ETLV-02)', () => {
		// -------------------------------------------------------------------
		// Native Reminders
		// -------------------------------------------------------------------
		describe('Native Reminders', () => {
			let db: Database;

			beforeEach(async () => {
				db = await createTestDb();
			});
			afterEach(() => db.close());

			it('imports 100+ cards with zero errors', async () => {
				const cards = loadFixtureJSON<CanonicalCard[]>('native-reminders.json');
				const result = await importNativeSource(db, 'native_reminders', cards);

				expect(result.inserted).toBeGreaterThanOrEqual(100);
				expect(result.errors).toBe(0);
			});

			it('every card has source = native_reminders', async () => {
				const fixture = loadFixtureJSON<CanonicalCard[]>('native-reminders.json');
				await importNativeSource(db, 'native_reminders', fixture);

				const cards = queryCardsForSource(db, 'native_reminders');
				expect(cards.length).toBeGreaterThanOrEqual(100);
				for (const card of cards) {
					expect(card.source).toBe('native_reminders');
				}
			});

			it('every card has a non-empty name', async () => {
				const fixture = loadFixtureJSON<CanonicalCard[]>('native-reminders.json');
				await importNativeSource(db, 'native_reminders', fixture);

				const cards = queryCardsForSource(db, 'native_reminders');
				for (const card of cards) {
					expect(card.name.length).toBeGreaterThan(0);
				}
			});

			it('due_at preserved for cards that have it', async () => {
				const fixture = loadFixtureJSON<CanonicalCard[]>('native-reminders.json');
				await importNativeSource(db, 'native_reminders', fixture);

				const stmt = db.prepare<{ due_at: string | null }>(
					"SELECT due_at FROM cards WHERE source = 'native_reminders'",
				);
				const rows = stmt.all();
				stmt.free();

				// Fixture has a mix of null and non-null due_at
				const withDueAt = rows.filter((r) => r.due_at !== null);
				const withoutDueAt = rows.filter((r) => r.due_at === null);
				expect(withDueAt.length).toBeGreaterThan(0);
				expect(withoutDueAt.length).toBeGreaterThan(0);
			});
		});

		// -------------------------------------------------------------------
		// Native Calendar
		// -------------------------------------------------------------------
		describe('Native Calendar', () => {
			let db: Database;

			beforeEach(async () => {
				db = await createTestDb();
			});
			afterEach(() => db.close());

			it('imports 100+ cards with zero errors', async () => {
				const cards = loadFixtureJSON<CanonicalCard[]>('native-calendar.json');
				const result = await importNativeSource(db, 'native_calendar', cards);

				expect(result.inserted).toBeGreaterThanOrEqual(100);
				expect(result.errors).toBe(0);
			});

			it('every card has source = native_calendar', async () => {
				const fixture = loadFixtureJSON<CanonicalCard[]>('native-calendar.json');
				await importNativeSource(db, 'native_calendar', fixture);

				const cards = queryCardsForSource(db, 'native_calendar');
				expect(cards.length).toBeGreaterThanOrEqual(100);
				for (const card of cards) {
					expect(card.source).toBe('native_calendar');
				}
			});

			it('every card has a non-empty name', async () => {
				const fixture = loadFixtureJSON<CanonicalCard[]>('native-calendar.json');
				await importNativeSource(db, 'native_calendar', fixture);

				const cards = queryCardsForSource(db, 'native_calendar');
				for (const card of cards) {
					expect(card.name.length).toBeGreaterThan(0);
				}
			});

			it('event cards have event_start and event_end', async () => {
				const fixture = loadFixtureJSON<CanonicalCard[]>('native-calendar.json');
				await importNativeSource(db, 'native_calendar', fixture);

				const stmt = db.prepare<{
					card_type: string;
					event_start: string | null;
					event_end: string | null;
				}>(
					"SELECT card_type, event_start, event_end FROM cards WHERE source = 'native_calendar' AND card_type = 'event'",
				);
				const rows = stmt.all();
				stmt.free();

				expect(rows.length).toBeGreaterThan(0);
				for (const row of rows) {
					expect(row.event_start).not.toBeNull();
					expect(row.event_end).not.toBeNull();
				}
			});
		});

		// -------------------------------------------------------------------
		// Native Notes
		// -------------------------------------------------------------------
		describe('Native Notes', () => {
			let db: Database;

			beforeEach(async () => {
				db = await createTestDb();
			});
			afterEach(() => db.close());

			it('imports 100+ cards with zero errors', async () => {
				const cards = loadFixtureJSON<CanonicalCard[]>('native-notes.json');
				const result = await importNativeSource(db, 'native_notes', cards);

				expect(result.inserted).toBeGreaterThanOrEqual(100);
				expect(result.errors).toBe(0);
			});

			it('every card has source = native_notes', async () => {
				const fixture = loadFixtureJSON<CanonicalCard[]>('native-notes.json');
				await importNativeSource(db, 'native_notes', fixture);

				const cards = queryCardsForSource(db, 'native_notes');
				expect(cards.length).toBeGreaterThanOrEqual(100);
				for (const card of cards) {
					expect(card.source).toBe('native_notes');
				}
			});

			it('every card has a non-empty name', async () => {
				const fixture = loadFixtureJSON<CanonicalCard[]>('native-notes.json');
				await importNativeSource(db, 'native_notes', fixture);

				const cards = queryCardsForSource(db, 'native_notes');
				for (const card of cards) {
					expect(card.name.length).toBeGreaterThan(0);
				}
			});
		});
	});
});
