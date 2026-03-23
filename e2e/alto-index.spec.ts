/**
 * Isometry v5 — Phase 110 E2E: Alto-Index Import Pipeline
 *
 * Validates the full alto-index import pipeline end-to-end through Playwright:
 *   1. Type correctness — all 11 subdirectory types map to correct card_type + source
 *   2. Dedup idempotency — re-importing same fixtures produces the same card count
 *   3. FTS5 population — after 500-card import, cards are searchable via FTS5 MATCH
 *   4. Purge-then-replace — alto_index import deletes all pre-existing cards/connections
 *
 * Requirements: ALTO-02, ALTO-03, ALTO-04, ALTO-05
 */

import { test, expect } from '@playwright/test';
import { importAltoIndex, resetDatabase } from './helpers/etl';
import { waitForAppReady, getCardCount } from './helpers/isometry';

// ---------------------------------------------------------------------------
// Alto-index source type mapping (11 production subdirectory types)
// edge-cases.json is excluded — it uses source='alto_edge_cases' (test-only)
// ---------------------------------------------------------------------------

const ALTO_TYPES: Array<{ file: string; expectedCardType: string; source: string }> = [
	{ file: 'notes.json', expectedCardType: 'note', source: 'alto_notes' },
	{ file: 'contacts.json', expectedCardType: 'person', source: 'alto_contacts' },
	{ file: 'calendar.json', expectedCardType: 'event', source: 'alto_calendar' },
	{ file: 'messages.json', expectedCardType: 'message', source: 'alto_messages' },
	{ file: 'books.json', expectedCardType: 'reference', source: 'alto_books' },
	{ file: 'calls.json', expectedCardType: 'event', source: 'alto_calls' },
	{ file: 'safari-history.json', expectedCardType: 'reference', source: 'alto_safari_history' },
	{ file: 'kindle.json', expectedCardType: 'reference', source: 'alto_kindle' },
	{ file: 'reminders.json', expectedCardType: 'task', source: 'alto_reminders' },
	{ file: 'safari-bookmarks.json', expectedCardType: 'reference', source: 'alto_safari_bookmarks' },
	{ file: 'voice-memos.json', expectedCardType: 'media', source: 'alto_voice_memos' },
];

// ---------------------------------------------------------------------------
// Describe block 1: Type correctness (11 types verified in a single test)
// ---------------------------------------------------------------------------

test.describe('Type correctness: 11 alto-index subdirectory types', () => {
	test('all 11 types import with correct card_type and source', async ({ page }) => {
		await waitForAppReady(page);
		await resetDatabase(page);
		await importAltoIndex(page);

		for (const typeInfo of ALTO_TYPES) {
			const result = await page.evaluate(async (source) => {
				const { queryAll } = (window as any).__isometry;
				return queryAll(
					'SELECT card_type, COUNT(*) as cnt FROM cards WHERE source = ? AND deleted_at IS NULL GROUP BY card_type',
					[source],
				);
			}, typeInfo.source);

			const rows = (result as { rows: Array<{ card_type: string; cnt: number }> }).rows;
			expect(rows.length, `No rows for source ${typeInfo.source}`).toBeGreaterThanOrEqual(1);

			const matchingRow = rows.find((r: any) => r.card_type === typeInfo.expectedCardType);
			expect(
				matchingRow,
				`Expected card_type='${typeInfo.expectedCardType}' for source='${typeInfo.source}'`,
			).toBeTruthy();
			expect(matchingRow!.cnt).toBeGreaterThanOrEqual(1);
		}

		// Verify total card count: 250 notes + 10 × 25 other types = 500
		const totalCount = await getCardCount(page);
		expect(totalCount).toBeGreaterThanOrEqual(490);
	});
});

// ---------------------------------------------------------------------------
// Describe block 2: Dedup idempotency
// ---------------------------------------------------------------------------

test.describe('Dedup idempotency', () => {
	test('re-importing same fixtures produces zero net-new cards', async ({ page }) => {
		await waitForAppReady(page);
		await resetDatabase(page);

		// First import
		const firstResult = await importAltoIndex(page);
		const firstCount = await getCardCount(page);
		expect(firstResult.inserted, 'First import must insert cards').toBeGreaterThan(0);

		// Second import (same data) — alto_index purges then re-inserts
		const secondResult = await importAltoIndex(page);
		const secondCount = await getCardCount(page);

		// Purge-then-replace means the same cards are re-inserted; net count must match
		expect(secondCount, 'Card count must be identical after re-import').toBe(firstCount);
		expect(secondResult.inserted, 'Second import must also insert cards (purge-then-replace)').toBeGreaterThan(0);

		// Verify import_sources catalog has an entry for alto_index
		const sourcesResult = await page.evaluate(async () => {
			const { queryAll } = (window as any).__isometry;
			return queryAll('SELECT * FROM import_sources WHERE source_type = ?', ['alto_index']);
		});
		expect(
			(sourcesResult as { rows: unknown[] }).rows.length,
			'import_sources must have an entry for alto_index',
		).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// Describe block 3: FTS5 bulk population
// ---------------------------------------------------------------------------

test.describe('FTS5 bulk rebuild at 501+ cards', () => {
	test('502-card import triggers FTS5 bulk rebuild and cards are searchable', async ({ page }) => {
		await waitForAppReady(page);
		await resetDatabase(page);

		// Import all alto-index fixtures (252 notes + 10 × 25 = 502 cards)
		await importAltoIndex(page);
		const totalCount = await getCardCount(page);

		// Fixtures produce 502 cards — must exceed 500 for isBulkImport=true
		expect(
			totalCount,
			'Total card count must exceed 500 for isBulkImport=true',
		).toBeGreaterThan(500);

		// Verify FTS5 table is populated and searchable.
		// notes.json contains cards named "Note 001", "Note 002", etc.
		const searchResult = await page.evaluate(async () => {
			const { queryAll } = (window as any).__isometry;
			return queryAll(
				"SELECT COUNT(*) as cnt FROM cards_fts WHERE cards_fts MATCH 'Note*'",
				[],
			);
		});

		const ftsCount = ((searchResult as { rows: Array<{ cnt: number }> }).rows[0]?.cnt) ?? 0;
		expect(ftsCount, 'FTS5 search for "Note*" must return at least 1 result').toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Describe block 4: Purge-then-replace behavior
// ---------------------------------------------------------------------------

test.describe('Purge-then-replace behavior', () => {
	test('alto-index import purges pre-existing cards and connections', async ({ page }) => {
		await waitForAppReady(page);
		await resetDatabase(page);

		// Step 1: Seed with non-alto-index data (meryl-streep sample dataset)
		await page.evaluate(async () => {
			const iso = (window as any).__isometry;
			await iso.sampleManager.load('meryl-streep');
			iso.coordinator.scheduleUpdate();
		});
		await page.waitForTimeout(500);

		const seedCount = await getCardCount(page);
		expect(seedCount, 'Sample data must produce cards').toBeGreaterThan(40);

		// Verify connections exist from sample data
		const seedConnections = await page.evaluate(async () => {
			const { queryAll } = (window as any).__isometry;
			return queryAll('SELECT COUNT(*) as cnt FROM connections', []);
		});
		const seedConnCount =
			((seedConnections as { rows: Array<{ cnt: number }> }).rows[0]?.cnt) ?? 0;
		expect(seedConnCount, 'Sample data must produce connections').toBeGreaterThan(0);

		// Step 2: Import alto-index — triggers purge (DELETE FROM connections; DELETE FROM cards)
		await importAltoIndex(page);

		// Step 3: Assert all non-alto-index cards are gone (purge cleared everything)
		const postImportNonAlto = await page.evaluate(async () => {
			const { queryAll } = (window as any).__isometry;
			return queryAll(
				"SELECT COUNT(*) as cnt FROM cards WHERE source NOT LIKE 'alto_%' AND deleted_at IS NULL",
				[],
			);
		});
		const remainingNonAlto =
			((postImportNonAlto as { rows: Array<{ cnt: number }> }).rows[0]?.cnt) ?? 0;
		expect(
			remainingNonAlto,
			'No non-alto-index cards should remain after purge-then-replace',
		).toBe(0);

		// Step 4: Assert connections table was purged
		// alto-index imports produce no connections, so connections count must be 0
		const postConnections = await page.evaluate(async () => {
			const { queryAll } = (window as any).__isometry;
			return queryAll('SELECT COUNT(*) as cnt FROM connections', []);
		});
		const postConnCount =
			((postConnections as { rows: Array<{ cnt: number }> }).rows[0]?.cnt) ?? 0;
		expect(
			postConnCount,
			'Connections must be purged (DELETE FROM connections ran before alto_index import)',
		).toBe(0);

		// Step 5: Assert alto-index cards are present after purge+import
		const altoCardCount = await getCardCount(page);
		expect(
			altoCardCount,
			'Alto-index cards must be present after purge+import',
		).toBeGreaterThan(490);
	});
});
