// Isometry v5 — Phase 9 CSVParser Tests
// Tests for parsing CSV files with BOM handling and column auto-detection

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CSVParser } from '../../../src/etl/parsers/CSVParser';

const fixturesPath = join(__dirname, '../fixtures');

function loadFixture(filename: string): string {
	return readFileSync(join(fixturesPath, filename), 'utf-8');
}

describe('CSVParser', () => {
	describe('Basic parsing', () => {
		it('Test 1: parses CSV with header row, extracts cards', () => {
			const parser = new CSVParser();
			const content = `title,content,tags
"Note 1","First content","tag1"
"Note 2","Second content","tag2"`;

			const result = parser.parse([{ path: 'data.csv', content }]);

			expect(result.cards).toHaveLength(2);
			expect(result.errors).toHaveLength(0);
			expect(result.cards[0]?.name).toBe('Note 1');
			expect(result.cards[1]?.name).toBe('Note 2');
		});
	});

	describe('BOM handling', () => {
		it('Test 2: UTF-8 BOM prefix stripped - first column not corrupted', () => {
			const parser = new CSVParser();
			const content = loadFixture('csv-with-bom.csv');

			// Verify BOM exists in file
			expect(content.charCodeAt(0)).toBe(0xfeff);

			const result = parser.parse([{ path: 'bom.csv', content }]);

			expect(result.cards).toHaveLength(2);
			// First card name should be clean, not "\uFEFFSample Note"
			expect(result.cards[0]?.name).toBe('Sample Note');
		});
	});

	describe('Column auto-detection', () => {
		it('Test 3: auto-detects title/name, content/body, date/created, tags/labels', () => {
			const parser = new CSVParser();
			const content = `name,body,created,labels
"Task 1","Do something","2024-01-01","work"`;

			const result = parser.parse([{ path: 'data.csv', content }]);

			expect(result.cards[0]?.name).toBe('Task 1');
			expect(result.cards[0]?.content).toBe('Do something');
			expect(result.cards[0]?.created_at).toBe('2024-01-01');
			expect(result.cards[0]?.tags).toContain('work');
		});
	});

	describe('Column mapping override', () => {
		it('Test 4: explicit column mapping via options overrides auto-detection', () => {
			const parser = new CSVParser();
			const content = `col1,col2,col3
"Title Here","Content Here","tag1,tag2"`;

			const result = parser.parse([{ path: 'data.csv', content }], {
				columnMapping: {
					name: 'col1',
					content: 'col2',
					tags: 'col3',
				},
			});

			expect(result.cards[0]?.name).toBe('Title Here');
			expect(result.cards[0]?.content).toBe('Content Here');
			expect(result.cards[0]?.tags).toContain('tag1');
		});
	});

	describe('Tag splitting', () => {
		it('Test 5: tags split on comma/semicolon', () => {
			const parser = new CSVParser();
			const content = loadFixture('csv-with-bom.csv');

			const result = parser.parse([{ path: 'data.csv', content }]);

			expect(result.cards[0]?.tags).toEqual(['tag1', 'tag2']);
			expect(result.cards[1]?.tags).toEqual(['work', 'important']);
		});
	});

	describe('Ragged rows', () => {
		it('Test 6: ragged rows (missing columns) padded with nulls, no crash', () => {
			const parser = new CSVParser();
			const content = loadFixture('csv-ragged-rows.csv');

			const result = parser.parse([{ path: 'ragged.csv', content }]);

			expect(result.cards).toHaveLength(3);
			expect(result.errors).toHaveLength(0);

			// Full row
			expect(result.cards[0]?.name).toBe('Full Row');
			expect(result.cards[0]?.tags).toEqual(['tag1']);

			// Missing tags
			expect(result.cards[1]?.name).toBe('Missing Tags');
			expect(result.cards[1]?.tags).toEqual([]);

			// Only title
			expect(result.cards[2]?.name).toBe('Title Only');
			expect(result.cards[2]?.content).toBeNull();
		});
	});

	describe('Empty CSV', () => {
		it('Test 7: empty CSV returns empty result', () => {
			const parser = new CSVParser();
			const content = '';

			const result = parser.parse([{ path: 'empty.csv', content }]);

			expect(result.cards).toHaveLength(0);
			expect(result.connections).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe('TSV support', () => {
		it('Test 8: tab-separated values detected via delimiter auto-detection', () => {
			const parser = new CSVParser();
			const content = `title\tcontent\ttags
"Note 1"\t"Content here"\t"tag1"`;

			const result = parser.parse([{ path: 'data.tsv', content }]);

			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]?.name).toBe('Note 1');
			expect(result.cards[0]?.content).toBe('Content here');
		});
	});

	describe('Quoted fields', () => {
		it('Test 9: quoted fields with embedded commas/newlines handled correctly', () => {
			const parser = new CSVParser();
			const content = `title,content
"Note with, comma","Multi-line
content here"`;

			const result = parser.parse([{ path: 'data.csv', content }]);

			expect(result.cards).toHaveLength(1);
			expect(result.cards[0]?.name).toBe('Note with, comma');
			expect(result.cards[0]?.content).toContain('Multi-line');
		});
	});

	describe('Source ID', () => {
		it('Test 10: source_id = row index as string', () => {
			const parser = new CSVParser();
			const content = `title
"Row 1"
"Row 2"`;

			const result = parser.parse([{ path: 'data.csv', content }]);

			expect(result.cards[0]?.source_id).toBe('data.csv:0');
			expect(result.cards[1]?.source_id).toBe('data.csv:1');
		});
	});

	describe('Edge cases', () => {
		it('handles empty file list', () => {
			const parser = new CSVParser();

			const result = parser.parse([]);

			expect(result.cards).toHaveLength(0);
			expect(result.connections).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});

		it('handles header-only CSV', () => {
			const parser = new CSVParser();
			const content = 'title,content,tags';

			const result = parser.parse([{ path: 'header-only.csv', content }]);

			expect(result.cards).toHaveLength(0);
		});
	});
});
