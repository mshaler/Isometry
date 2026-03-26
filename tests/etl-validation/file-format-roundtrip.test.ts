// Isometry v5 -- Phase 112 Export Round-Trip Fidelity Tests
// SC3: Import -> export -> re-import preserves all non-null fields

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../src/database/Database';
import { ExportOrchestrator } from '../../src/etl/ExportOrchestrator';
import { createTestDb, importFileSource } from './helpers';

/**
 * Query all non-deleted cards ordered by name for deterministic comparison.
 */
function queryAllCards(db: Database): Array<Record<string, unknown>> {
	const stmt = db.prepare<Record<string, unknown>>(
		'SELECT * FROM cards WHERE deleted_at IS NULL ORDER BY name',
	);
	const rows = stmt.all();
	stmt.free();
	return rows;
}

describe('JSON round-trip fidelity', () => {
	let db: Database;
	beforeEach(async () => {
		db = await createTestDb();
	});
	afterEach(() => db.close());

	it('import -> export -> re-import preserves name, content, folder, tags', async () => {
		// Step 1: Import a small JSON fixture (inline for determinism)
		const originalJson = JSON.stringify([
			{
				title: 'Round Trip Note',
				body: 'Test content for round trip',
				tags: ['test', 'roundtrip'],
				folder: 'Testing',
				date: '2026-01-15T10:00:00Z',
			},
			{
				title: 'Second Note',
				body: 'More content here',
				tags: ['alpha'],
				folder: 'Work',
				date: '2026-02-20T14:00:00Z',
			},
		]);
		const importResult = await importFileSource(db, 'json', originalJson);
		expect(importResult.inserted).toBe(2);

		// Step 2: Query original cards
		const originalCards = queryAllCards(db);
		expect(originalCards.length).toBe(2);

		// Step 3: Export as JSON
		const exporter = new ExportOrchestrator(db);
		const exportResult = exporter.export('json');
		expect(exportResult.cardCount).toBe(2);

		// Step 4: Reset and re-import
		db.run('DELETE FROM connections');
		db.run('DELETE FROM cards');
		const reimportResult = await importFileSource(db, 'json', exportResult.data);
		expect(reimportResult.inserted).toBe(2);

		// Step 5: Compare field-by-field
		const reimportedCards = queryAllCards(db);
		expect(reimportedCards.length).toBe(2);

		for (let i = 0; i < originalCards.length; i++) {
			const orig = originalCards[i]!;
			const reimported = reimportedCards[i]!;

			expect(reimported['name'], `name mismatch at index ${i}`).toBe(orig['name']);
			expect(reimported['content'], `content mismatch at index ${i}`).toBe(orig['content']);
			expect(reimported['folder'], `folder mismatch at index ${i}`).toBe(orig['folder']);
			// Tags stored as JSON string in sqlite
			expect(reimported['tags'], `tags mismatch at index ${i}`).toBe(orig['tags']);
		}
	});
});

describe('CSV round-trip fidelity', () => {
	let db: Database;
	beforeEach(async () => {
		db = await createTestDb();
	});
	afterEach(() => db.close());

	it('import -> export -> re-import preserves name and content', async () => {
		// Step 1: Import CSV fixture (inline for determinism)
		const csvContent =
			'title,content,tags\nCSV Round Trip,CSV body text,alpha;beta\nCSV Second,More CSV content,gamma';
		const csvData = JSON.stringify([{ path: 'test.csv', content: csvContent }]);
		const importResult = await importFileSource(db, 'csv', csvData);
		expect(importResult.inserted).toBe(2);

		// Step 2: Query original cards
		const originalCards = queryAllCards(db);
		expect(originalCards.length).toBe(2);

		// Step 3: Export as CSV
		const exporter = new ExportOrchestrator(db);
		const exportResult = exporter.export('csv');
		expect(exportResult.cardCount).toBe(2);

		// Step 4: Reset and re-import (wrap exported CSV in ParsedFile[])
		db.run('DELETE FROM connections');
		db.run('DELETE FROM cards');
		const reimportData = JSON.stringify([{ path: 'roundtrip.csv', content: exportResult.data }]);
		const reimportResult = await importFileSource(db, 'csv', reimportData);
		expect(reimportResult.inserted).toBe(2);

		// Step 5: Compare name and content (CSV loses some field fidelity by design)
		const reimportedCards = queryAllCards(db);
		expect(reimportedCards.length).toBe(2);

		for (let i = 0; i < originalCards.length; i++) {
			const orig = originalCards[i]!;
			const reimported = reimportedCards[i]!;

			expect(reimported['name'], `name mismatch at index ${i}`).toBe(orig['name']);
			// Content may have whitespace trimming differences
			const origContent = String(orig['content'] ?? '').trim();
			const reimportedContent = String(reimported['content'] ?? '').trim();
			expect(reimportedContent, `content mismatch at index ${i}`).toBe(origContent);
		}
	});
});

describe('Markdown round-trip fidelity', () => {
	let db: Database;
	beforeEach(async () => {
		db = await createTestDb();
	});
	afterEach(() => db.close());

	it('import -> export -> re-import preserves name, content, and folder', async () => {
		// Step 1: Import markdown fixtures (inline for determinism)
		const mdFiles = [
			{
				path: 'notes/hello.md',
				content:
					'---\ntitle: MD Round Trip\ntags:\n  - test\n  - markdown\nfolder: Notes\ncreated: 2026-01-15T10:00:00Z\n---\n\nThis is the body content for round trip testing.',
			},
			{
				path: 'notes/world.md',
				content:
					'---\ntitle: Second MD Note\ntags:\n  - alpha\ncreated: 2026-02-20T14:00:00Z\n---\n\nMore markdown content.',
			},
		];
		const mdData = JSON.stringify(mdFiles);
		const importResult = await importFileSource(db, 'markdown', mdData);
		expect(importResult.inserted).toBe(2);

		// Step 2: Query original cards
		const originalCards = queryAllCards(db);
		expect(originalCards.length).toBe(2);

		// Step 3: Export as markdown
		const exporter = new ExportOrchestrator(db);
		const exportResult = exporter.export('markdown');
		expect(exportResult.cardCount).toBe(2);

		// Step 4: Reset and re-import
		// Markdown export joins files with '\n\n---\n\n' separator
		// Split and wrap each chunk as ParsedFile
		db.run('DELETE FROM connections');
		db.run('DELETE FROM cards');
		const chunks = exportResult.data.split('\n\n---\n\n');
		// Use directory paths that preserve folder derivation (MarkdownParser extracts folder from path)
		const reimportFiles = chunks.map((chunk, i) => ({
			path: `notes/reimport-${i}.md`,
			content: chunk,
		}));
		const reimportData = JSON.stringify(reimportFiles);
		const reimportResult = await importFileSource(db, 'markdown', reimportData);
		expect(reimportResult.inserted).toBe(2);

		// Step 5: Compare field-by-field
		const reimportedCards = queryAllCards(db);
		expect(reimportedCards.length).toBe(2);

		for (let i = 0; i < originalCards.length; i++) {
			const orig = originalCards[i]!;
			const reimported = reimportedCards[i]!;

			expect(reimported['name'], `name mismatch at index ${i}`).toBe(orig['name']);
			// Content comparison: trim both sides, original may have minor whitespace diffs
			const origContent = String(orig['content'] ?? '').trim();
			const reimportedContent = String(reimported['content'] ?? '').trim();
			expect(reimportedContent, `content mismatch at index ${i}`).toBe(origContent);
			expect(reimported['folder'], `folder mismatch at index ${i}`).toBe(orig['folder']);
		}
	});
});
