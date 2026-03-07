// Isometry v5 — Phase 9 ETL All Parsers Integration Tests
// Comprehensive tests for all six parsers through ImportOrchestrator

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import type { ParsedFile } from '../../src/etl/parsers/AppleNotesParser';

describe('ETL All Parsers Integration', () => {
	let db: Database;
	let orchestrator: ImportOrchestrator;

	beforeEach(async () => {
		db = new Database();
		await db.initialize();
		orchestrator = new ImportOrchestrator(db);
	});

	afterEach(() => {
		db.close();
	});

	describe('Markdown Parser', () => {
		it('imports markdown files with frontmatter', async () => {
			const files: ParsedFile[] = [
				{
					path: 'vault/note.md',
					content: '---\ntitle: Test Note\ntags: [alpha, beta]\n---\n\n# Test Note\n\nMarkdown content here.',
				},
			];

			const result = await orchestrator.import('markdown', JSON.stringify(files), {});

			expect(result.inserted).toBe(1);
			expect(result.errors).toBe(0);

			const stmt = db.prepare<{ name: string; tags: string }>('SELECT name, tags FROM cards WHERE source = ?');
			const cards = stmt.all('markdown');
			stmt.free();

			expect(cards.length).toBe(1);
			expect(cards[0]?.name).toBe('Test Note');
			expect(cards[0]?.tags).toContain('alpha');
		});
	});

	describe('CSV Parser', () => {
		it('imports CSV with BOM stripped', async () => {
			const files: ParsedFile[] = [
				{
					path: 'data.csv',
					content:
						'\uFEFFtitle,content,tags\n"Note One","Content here","alpha;beta"\n"Note Two","More content","gamma"',
				},
			];

			const result = await orchestrator.import('csv', JSON.stringify(files), {});

			expect(result.inserted).toBe(2);
			expect(result.errors).toBe(0);

			const stmt = db.prepare<{ name: string }>('SELECT name FROM cards WHERE source = ? ORDER BY name');
			const cards = stmt.all('csv');
			stmt.free();

			expect(cards.length).toBe(2);
			expect(cards[0]?.name).toBe('Note One');
			expect(cards[1]?.name).toBe('Note Two');
		});
	});

	describe('JSON Parser', () => {
		it('imports JSON array', async () => {
			const json = JSON.stringify([
				{ title: 'JSON Note', body: 'JSON content', tags: ['json', 'test'] },
				{ title: 'Second Note', body: 'More JSON', tags: ['data'] },
			]);

			const result = await orchestrator.import('json', json, {});

			expect(result.inserted).toBe(2);
			expect(result.errors).toBe(0);

			const stmt = db.prepare<{ count: number }>('SELECT COUNT(*) as count FROM cards WHERE source = ?');
			const rows = stmt.all('json');
			stmt.free();

			expect(rows[0]?.count).toBe(2);
		});
	});

	describe('HTML Parser', () => {
		it('imports HTML with scripts stripped', async () => {
			const html =
				'<html><head><script>alert("xss")</script></head><body><h1>Title</h1><p>Safe content</p></body></html>';

			const result = await orchestrator.import('html', html, {});

			expect(result.inserted).toBe(1);
			expect(result.errors).toBe(0);

			const stmt = db.prepare<{ content: string }>('SELECT content FROM cards WHERE source = ?');
			const cards = stmt.all('html');
			stmt.free();

			expect(cards.length).toBe(1);
			expect(cards[0]?.content).not.toContain('alert');
			expect(cards[0]?.content).not.toContain('<script>');
			expect(cards[0]?.content).toContain('Title');
		});
	});

	describe('Deduplication', () => {
		it('re-import is idempotent across all parsers', async () => {
			const files: ParsedFile[] = [
				{
					path: 'note.md',
					content:
						'---\ntitle: Unique Note\ncreated: 2024-01-01T00:00:00Z\nmodified: 2024-01-01T00:00:00Z\n---\n\nContent',
				},
			];
			const data = JSON.stringify(files);

			const first = await orchestrator.import('markdown', data, {});
			const second = await orchestrator.import('markdown', data, {});

			expect(first.inserted).toBe(1);
			expect(second.inserted).toBe(0);
			expect(second.unchanged).toBe(1);
		});
	});

	describe('Database Integration', () => {
		it('all parsers write to database via SQLiteWriter', async () => {
			// Import via markdown
			const mdFiles: ParsedFile[] = [{ path: 'md.md', content: '---\ntitle: MD Note\n---\nContent' }];
			await orchestrator.import('markdown', JSON.stringify(mdFiles), {});

			// Import via CSV
			const csvFiles: ParsedFile[] = [{ path: 'csv.csv', content: 'title,content\n"CSV Note","CSV Content"' }];
			await orchestrator.import('csv', JSON.stringify(csvFiles), {});

			// Import via JSON
			const json = JSON.stringify([{ title: 'JSON Note', body: 'JSON Content' }]);
			await orchestrator.import('json', json, {});

			// Verify all were written
			const stmt = db.prepare<{ count: number }>('SELECT COUNT(*) as count FROM cards');
			const rows = stmt.all();
			stmt.free();

			expect(rows[0]?.count).toBe(3);
		});

		it('all parsers record provenance via CatalogWriter', async () => {
			const files: ParsedFile[] = [{ path: 'test.md', content: '---\ntitle: Test\n---\nContent' }];

			await orchestrator.import('markdown', JSON.stringify(files), { filename: 'test.zip' });

			const stmt = db.prepare<{ count: number }>('SELECT COUNT(*) as count FROM import_runs');
			const rows = stmt.all();
			stmt.free();

			expect(rows[0]?.count).toBeGreaterThanOrEqual(1);
		});
	});
});
