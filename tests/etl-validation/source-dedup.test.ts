// Isometry v5 -- Phase 47 Dedup Re-Import Regression Tests
// ETLV-05: Re-importing the same data produces zero duplicates
//
// Tests all 9 sources for re-import idempotency:
//   - File sources (6): apple_notes, markdown, csv, json, excel, html
//   - Native sources (3): native_reminders, native_calendar, native_notes
//
// Also validates update detection, deletion detection, and connection dedup.

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
	queryCardCount,
	queryConnectionCount,
} from './helpers';

// ---------------------------------------------------------------------------
// Helpers for source data loading
// ---------------------------------------------------------------------------

/** File sources with their fixture loading strategy */
const FILE_SOURCES = ['apple_notes', 'markdown', 'csv', 'json', 'excel', 'html'] as const;

/** Native sources with their fixture file */
const NATIVE_SOURCES = ['native_reminders', 'native_calendar', 'native_notes'] as const;

const NATIVE_FIXTURE_MAP: Record<string, string> = {
	native_reminders: 'native-reminders.json',
	native_calendar: 'native-calendar.json',
	native_notes: 'native-notes.json',
};

/**
 * Load source data in the format expected by importFileSource().
 * Returns string for most sources, ArrayBuffer for excel.
 */
async function loadSourceData(source: string): Promise<string | ArrayBuffer> {
	switch (source) {
		case 'apple_notes':
			return loadFixture('apple-notes-snapshot.json');
		case 'markdown':
			return loadFixture('markdown-snapshot.json');
		case 'csv':
			return loadFixture('csv-snapshot.json');
		case 'json':
			return loadFixture('json-snapshot.json');
		case 'excel': {
			const rows = loadFixtureJSON<Record<string, unknown>[]>('excel-rows.json');
			return generateExcelBuffer(rows);
		}
		case 'html':
			// HTML needs special handling: generate strings with og:url for stable source_id
			return generateDedupableHtml();
		default:
			throw new Error(`Unknown source: ${source}`);
	}
}

/**
 * Generate HTML strings with og:url meta tags for stable source_id dedup.
 * HTMLParser uses sourceUrl ?? noteId for source_id, so without og:url
 * or canonical link, each parse generates a different UUID source_id.
 */
function generateDedupableHtml(): string {
	const pages: string[] = [];
	for (let i = 1; i <= 110; i++) {
		const title = `HTML Dedup Page ${String(i).padStart(3, '0')}`;
		const ogUrl = `https://example.com/pages/${i}`;
		const body = `<h1>${title}</h1><p>Content for dedup test page ${i}.</p>`;
		const html = `<html><head><title>${title}</title><meta property="og:url" content="${ogUrl}"></head><body>${body}</body></html>`;
		pages.push(html);
	}
	// Return as JSON-stringified array (ImportOrchestrator will handle the cast)
	return JSON.stringify(pages);
}

/**
 * Import HTML data through ImportOrchestrator with proper type handling.
 * HTML source needs special handling because it expects string[] not JSON string.
 */
async function importHtmlSource(db: Database, data: string): Promise<import('../../src/etl/types').ImportResult> {
	const orchestrator = new ImportOrchestrator(db);
	const htmlStrings = JSON.parse(data) as string[];
	return orchestrator.import('html', htmlStrings as unknown as ParsedFile[]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dedup Re-Import Regression (ETLV-05)', () => {
	// -------------------------------------------------------------------
	// File sources: re-import idempotency
	// -------------------------------------------------------------------
	describe.each(FILE_SOURCES.filter((s) => s !== 'html'))('%s: file source re-import', (source) => {
		let db: Database;

		beforeEach(async () => {
			db = await createTestDb();
		});
		afterEach(() => db.close());

		it('re-import produces zero new cards', async () => {
			const data = await loadSourceData(source);
			const first = await importFileSource(db, source, data);
			expect(first.inserted).toBeGreaterThanOrEqual(100);

			const second = await importFileSource(db, source, data);
			expect(second.inserted).toBe(0);
			// Cards are classified as unchanged OR updated (parsers without stable
			// timestamps regenerate modified_at, causing DedupEngine to classify as update).
			// The key invariant is: no new inserts, all cards accounted for.
			expect(second.unchanged + second.updated).toBe(first.inserted);
		});

		it('total card count unchanged after re-import', async () => {
			const data = await loadSourceData(source);
			const _first = await importFileSource(db, source, data);
			const countAfterFirst = queryCardCount(db, source);
			expect(countAfterFirst).toBeGreaterThanOrEqual(100);

			await importFileSource(db, source, data);
			const countAfterSecond = queryCardCount(db, source);

			expect(countAfterSecond).toBe(countAfterFirst);
		});
	});

	// -------------------------------------------------------------------
	// HTML source: re-import idempotency (special handling)
	// -------------------------------------------------------------------
	describe('html: file source re-import', () => {
		let db: Database;

		beforeEach(async () => {
			db = await createTestDb();
		});
		afterEach(() => db.close());

		it('re-import produces zero new cards', async () => {
			const data = generateDedupableHtml();
			const first = await importHtmlSource(db, data);
			expect(first.inserted).toBeGreaterThanOrEqual(100);

			const second = await importHtmlSource(db, data);
			expect(second.inserted).toBe(0);
			// HTML parser regenerates modified_at on each parse, so cards are
			// classified as updated rather than unchanged.
			expect(second.unchanged + second.updated).toBe(first.inserted);
		});

		it('total card count unchanged after re-import', async () => {
			const data = generateDedupableHtml();
			const _first = await importHtmlSource(db, data);
			const countAfterFirst = queryCardCount(db, 'html');
			expect(countAfterFirst).toBeGreaterThanOrEqual(100);

			await importHtmlSource(db, data);
			const countAfterSecond = queryCardCount(db, 'html');

			expect(countAfterSecond).toBe(countAfterFirst);
		});
	});

	// -------------------------------------------------------------------
	// Native sources: re-import idempotency
	// -------------------------------------------------------------------
	describe.each(NATIVE_SOURCES)('%s: native source re-import', (source) => {
		let db: Database;

		beforeEach(async () => {
			db = await createTestDb();
		});
		afterEach(() => db.close());

		it('re-import produces zero new cards', async () => {
			const cards = loadFixtureJSON<CanonicalCard[]>(NATIVE_FIXTURE_MAP[source]!);
			const first = await importNativeSource(db, source, cards);
			expect(first.inserted).toBeGreaterThanOrEqual(100);

			const second = await importNativeSource(db, source, cards);
			expect(second.inserted).toBe(0);
			expect(second.unchanged).toBe(first.inserted);
		});

		it('total card count unchanged after re-import', async () => {
			const cards = loadFixtureJSON<CanonicalCard[]>(NATIVE_FIXTURE_MAP[source]!);
			const _first = await importNativeSource(db, source, cards);
			const countAfterFirst = queryCardCount(db, source);
			expect(countAfterFirst).toBeGreaterThanOrEqual(100);

			await importNativeSource(db, source, cards);
			const countAfterSecond = queryCardCount(db, source);

			expect(countAfterSecond).toBe(countAfterFirst);
		});
	});

	// -------------------------------------------------------------------
	// Update detection
	// -------------------------------------------------------------------
	describe('Update detection', () => {
		let db: Database;

		beforeEach(async () => {
			db = await createTestDb();
		});
		afterEach(() => db.close());

		it('modified cards are classified as updates, not inserts', async () => {
			const cards = loadFixtureJSON<CanonicalCard[]>('native-reminders.json');
			await importNativeSource(db, 'native_reminders', cards);

			// Modify 5 cards' modified_at to be newer + change name
			const modified = cards.map((c, i) =>
				i < 5
					? {
							...c,
							modified_at: '2027-01-01T00:00:00Z',
							name: c.name + ' (updated)',
						}
					: c,
			);
			const result = await importNativeSource(db, 'native_reminders', modified);

			expect(result.updated).toBe(5);
			expect(result.inserted).toBe(0);
			expect(result.unchanged).toBe(cards.length - 5);
		});
	});

	// -------------------------------------------------------------------
	// Deletion detection
	// -------------------------------------------------------------------
	describe('Deletion detection', () => {
		let db: Database;

		beforeEach(async () => {
			db = await createTestDb();
		});
		afterEach(() => db.close());

		it('absent cards are reported in deletedIds', async () => {
			const cards = loadFixtureJSON<CanonicalCard[]>('native-reminders.json');
			await importNativeSource(db, 'native_reminders', cards);

			// Re-import with 5 cards removed
			const subset = cards.slice(5);
			const result = await importNativeSource(db, 'native_reminders', subset);

			expect(result.deletedIds.length).toBe(5);
		});
	});

	// -------------------------------------------------------------------
	// Connection dedup
	// -------------------------------------------------------------------
	describe('Connection dedup', () => {
		let db: Database;

		beforeEach(async () => {
			db = await createTestDb();
		});
		afterEach(() => db.close());

		it('apple_notes re-import does not duplicate connections', async () => {
			const data = loadFixture('apple-notes-snapshot.json');
			const first = await importFileSource(db, 'apple_notes', data);
			const connectionsAfterFirst = queryConnectionCount(db);

			await importFileSource(db, 'apple_notes', data);
			const connectionsAfterSecond = queryConnectionCount(db);

			expect(connectionsAfterSecond).toBe(connectionsAfterFirst);
			expect(first.connections_created).toBeGreaterThan(0);
		});
	});
});
