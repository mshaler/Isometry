// Isometry v5 -- Phase 112 File-Based Format E2E Tests
// SC1: All 6 parsers through ImportOrchestrator to sql.js
// SC4: Cross-format dedup collision detection

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../src/database/Database';
import {
	createTestDb,
	generateExcelBuffer,
	importFileSource,
	loadFixture,
	loadFixtureJSON,
	queryCardsForSource,
} from './helpers';

describe('JSON parser E2E', () => {
	let db: Database;
	beforeEach(async () => {
		db = await createTestDb();
	});
	afterEach(() => db.close());

	it('imports 100+ cards with correct source tag and non-empty names', async () => {
		const fixture = loadFixture('json-snapshot.json');
		const result = await importFileSource(db, 'json', fixture);

		expect(result.inserted).toBeGreaterThanOrEqual(100);
		expect(result.errors).toBe(0);

		const cards = queryCardsForSource(db, 'json');
		expect(cards.length).toBeGreaterThanOrEqual(100);
		for (const card of cards) {
			expect(card.name.length).toBeGreaterThan(0);
		}
	});
});

describe('Excel parser E2E', () => {
	let db: Database;
	beforeEach(async () => {
		db = await createTestDb();
	});
	afterEach(() => db.close());

	it('imports 100+ cards from XLSX buffer with correct source tag', async () => {
		const rows = loadFixtureJSON<Array<Record<string, unknown>>>('excel-rows.json');
		const buffer = await generateExcelBuffer(rows);
		const result = await importFileSource(db, 'excel', buffer);

		expect(result.inserted).toBeGreaterThanOrEqual(100);
		expect(result.errors).toBe(0);

		const cards = queryCardsForSource(db, 'excel');
		expect(cards.length).toBeGreaterThanOrEqual(100);
		for (const card of cards) {
			expect(card.name.length).toBeGreaterThan(0);
		}
	});
});

describe('CSV parser E2E', () => {
	let db: Database;
	beforeEach(async () => {
		db = await createTestDb();
	});
	afterEach(() => db.close());

	it('imports 100+ cards with correct source tag and non-empty names', async () => {
		const fixture = loadFixture('csv-snapshot.json');
		const result = await importFileSource(db, 'csv', fixture);

		expect(result.inserted).toBeGreaterThanOrEqual(100);
		expect(result.errors).toBe(0);

		const cards = queryCardsForSource(db, 'csv');
		expect(cards.length).toBeGreaterThanOrEqual(100);
		for (const card of cards) {
			expect(card.name.length).toBeGreaterThan(0);
		}
	});
});

describe('Markdown parser E2E', () => {
	let db: Database;
	beforeEach(async () => {
		db = await createTestDb();
	});
	afterEach(() => db.close());

	it('imports 100+ cards with correct source tag and non-empty names', async () => {
		const fixture = loadFixture('markdown-snapshot.json');
		const result = await importFileSource(db, 'markdown', fixture);

		expect(result.inserted).toBeGreaterThanOrEqual(100);
		expect(result.errors).toBe(0);

		const cards = queryCardsForSource(db, 'markdown');
		expect(cards.length).toBeGreaterThanOrEqual(100);
		for (const card of cards) {
			expect(card.name.length).toBeGreaterThan(0);
		}
	});
});

describe('HTML parser E2E', () => {
	let db: Database;
	beforeEach(async () => {
		db = await createTestDb();
	});
	afterEach(() => db.close());

	it('imports cards with correct source tag and non-empty names', async () => {
		const htmlStrings = loadFixtureJSON<string[]>('html-snapshot.json');
		// HTML parser expects string input — ImportOrchestrator wraps single string as [data]
		// Import first HTML string to verify parser works through orchestrator
		const result = await importFileSource(db, 'html', htmlStrings[0]!);

		expect(result.inserted).toBeGreaterThanOrEqual(1);
		expect(result.errors).toBe(0);

		const cards = queryCardsForSource(db, 'html');
		expect(cards.length).toBeGreaterThanOrEqual(1);
		for (const card of cards) {
			expect(card.name.length).toBeGreaterThan(0);
		}
	});

	it('imports multiple HTML pages', async () => {
		const htmlStrings = loadFixtureJSON<string[]>('html-snapshot.json');
		// Import several HTML strings to verify batch behavior
		let totalInserted = 0;
		for (const html of htmlStrings.slice(0, 10)) {
			const result = await importFileSource(db, 'html', html);
			totalInserted += result.inserted;
		}

		expect(totalInserted).toBeGreaterThanOrEqual(10);

		const cards = queryCardsForSource(db, 'html');
		expect(cards.length).toBeGreaterThanOrEqual(10);
		for (const card of cards) {
			expect(card.name.length).toBeGreaterThan(0);
		}
	});
});

describe('Apple Notes parser E2E', () => {
	let db: Database;
	beforeEach(async () => {
		db = await createTestDb();
	});
	afterEach(() => db.close());

	it('imports 100+ cards with correct source tag and non-empty names', async () => {
		const fixture = loadFixture('apple-notes-snapshot.json');
		const result = await importFileSource(db, 'apple_notes', fixture);

		expect(result.inserted).toBeGreaterThanOrEqual(100);
		expect(result.errors).toBe(0);

		const cards = queryCardsForSource(db, 'apple_notes');
		expect(cards.length).toBeGreaterThanOrEqual(100);
		for (const card of cards) {
			expect(card.name.length).toBeGreaterThan(0);
		}
	});
});

describe('Cross-format dedup collision detection', () => {
	let db: Database;
	beforeEach(async () => {
		db = await createTestDb();
	});
	afterEach(() => db.close());

	it('same title from JSON and CSV produces two distinct rows', async () => {
		// Import a minimal JSON fixture with a known title
		const jsonData = JSON.stringify([{ title: 'Shared Title Card', body: 'From JSON source', tags: [] }]);
		const jsonResult = await importFileSource(db, 'json', jsonData);
		expect(jsonResult.inserted).toBe(1);

		// Import a CSV fixture with the same title but different source
		const csvData = JSON.stringify([{ path: 'test.csv', content: 'title,content\nShared Title Card,From CSV source' }]);
		const csvResult = await importFileSource(db, 'csv', csvData);
		expect(csvResult.inserted).toBe(1);

		// Query all cards with this title
		const stmt = db.prepare<{ name: string; source: string }>(
			"SELECT name, source FROM cards WHERE name = 'Shared Title Card' AND deleted_at IS NULL",
		);
		const rows = stmt.all();
		stmt.free();

		// Assert 2 distinct rows with different source values
		expect(rows.length).toBe(2);
		const sources = rows.map((r) => r.source).sort();
		expect(sources).toEqual(['csv', 'json']);
	});
});
