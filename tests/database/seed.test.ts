// tests/database/seed.test.ts
// TDD RED phase: failing tests for the seed utility
// These tests validate the seeding API contract before implementation.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { SEED_CONFIG, type SeedResult, seedDatabase } from './seed';

let db: Database;
let seedResult: SeedResult;

beforeAll(async () => {
	db = new Database();
	await db.initialize();
	// Seed the database once for all tests — this is the unit-under-test
	seedResult = seedDatabase(db);
}, 60_000); // 60s timeout to allow full seeding

afterAll(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// SEED_CONFIG shape
// ---------------------------------------------------------------------------

describe('SEED_CONFIG', () => {
	it('exports cardCount of 10_000', () => {
		expect(SEED_CONFIG.cardCount).toBe(10_000);
	});

	it('exports connectionCount of 50_000', () => {
		expect(SEED_CONFIG.connectionCount).toBe(50_000);
	});

	it('exports avgContentLength of 500', () => {
		expect(SEED_CONFIG.avgContentLength).toBe(500);
	});
});

// ---------------------------------------------------------------------------
// seedDatabase() return value
// ---------------------------------------------------------------------------

describe('seedDatabase() return value', () => {
	it('returns an object with hubCardId string', () => {
		expect(typeof seedResult.hubCardId).toBe('string');
		expect(seedResult.hubCardId.length).toBeGreaterThan(0);
	});

	it('returns hubCardId that is a valid UUID', () => {
		expect(seedResult.hubCardId).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('returns sampleCardIds array with 100 entries', () => {
		expect(Array.isArray(seedResult.sampleCardIds)).toBe(true);
		expect(seedResult.sampleCardIds).toHaveLength(100);
	});

	it('sampleCardIds are all valid UUID strings', () => {
		for (const id of seedResult.sampleCardIds) {
			expect(id).toMatch(/^[0-9a-f-]{36}$/);
		}
	});

	it('hubCardId is included in sampleCardIds (it is the first card)', () => {
		expect(seedResult.sampleCardIds[0]).toBe(seedResult.hubCardId);
	});
});

// ---------------------------------------------------------------------------
// Seeded card count
// ---------------------------------------------------------------------------

describe('seeded card count', () => {
	it('cards table contains exactly 10_000 rows', () => {
		const result = db.exec('SELECT COUNT(*) FROM cards WHERE deleted_at IS NULL');
		const count = result[0]?.values[0]?.[0] as number;
		expect(count).toBe(SEED_CONFIG.cardCount);
	});

	it('cards have varied card_types', () => {
		const result = db.exec('SELECT DISTINCT card_type FROM cards');
		const types = result[0]?.values.flat() as string[];
		// Should have more than one distinct card type (note, task, event, resource, person)
		expect(types.length).toBeGreaterThan(1);
	});

	it('cards have varied folders', () => {
		const result = db.exec('SELECT DISTINCT folder FROM cards WHERE folder IS NOT NULL');
		const folders = result[0]?.values.flat() as string[];
		expect(folders.length).toBeGreaterThan(0);
	});

	it('cards have non-empty names', () => {
		const result = db.exec("SELECT COUNT(*) FROM cards WHERE name IS NULL OR name = ''");
		const emptyNameCount = result[0]?.values[0]?.[0] as number;
		expect(emptyNameCount).toBe(0);
	});

	it('cards have content of approximately average 500 chars', () => {
		const result = db.exec('SELECT AVG(LENGTH(content)) FROM cards WHERE content IS NOT NULL');
		const avgLength = result[0]?.values[0]?.[0] as number;
		// Content should average between 200 and 800 chars given random generation
		expect(avgLength).toBeGreaterThan(200);
		expect(avgLength).toBeLessThan(800);
	});
});

// ---------------------------------------------------------------------------
// Seeded connection count
// ---------------------------------------------------------------------------

describe('seeded connection count', () => {
	it('connections table contains at least 45_000 rows (may skip some duplicates)', () => {
		// INSERT OR IGNORE skips UNIQUE constraint violations, so count may be slightly under 50K
		const result = db.exec('SELECT COUNT(*) FROM connections');
		const count = result[0]?.values[0]?.[0] as number;
		expect(count).toBeGreaterThanOrEqual(45_000);
	});

	it('hubCard has many outgoing connections (at least 150)', () => {
		// Hub card gets ~200 direct connections; some may be skipped due to INSERT OR IGNORE
		const result = db.exec('SELECT COUNT(*) FROM connections WHERE source_id = ?', [seedResult.hubCardId]);
		const count = result[0]?.values[0]?.[0] as number;
		expect(count).toBeGreaterThanOrEqual(150);
	});

	it('FTS search finds seeded content', () => {
		// Cards should contain FTS-searchable words from the WORDS list
		const result = db.exec(
			`SELECT COUNT(*) FROM cards_fts
       JOIN cards c ON c.rowid = cards_fts.rowid
       WHERE cards_fts MATCH 'knowledge'
         AND c.deleted_at IS NULL`,
		);
		const count = result[0]?.values[0]?.[0] as number;
		// At least some cards should have 'knowledge' in their content
		expect(count).toBeGreaterThan(0);
	});
});
