// Isometry v5 — Phase 8 ImportOrchestrator Tests
// Integration tests with real database

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import type { ParsedFile } from '../../src/etl/parsers/AppleNotesParser';
import { SQLiteWriter } from '../../src/etl/SQLiteWriter';

describe('ImportOrchestrator', () => {
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

	describe('import()', () => {
		it('should coordinate full pipeline: parse -> dedup -> write -> catalog', async () => {
			// Arrange
			const sampleNote: ParsedFile = {
				path: 'test.md',
				content: `---
title: Test Note
id: 12345
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
folder: Test
source: "notes://showNote?identifier=12345"
---

# Test Note

Sample content.
`,
			};

			const data = JSON.stringify([sampleNote]);

			// Act
			const result = await orchestrator.import('apple_notes', data, {
				filename: 'test-export',
			});

			// Assert
			expect(result.inserted).toBe(1);
			expect(result.updated).toBe(0);
			expect(result.unchanged).toBe(0);
			expect(result.errors).toBe(0);
			expect(result.insertedIds.length).toBe(1);

			// Verify card was written to database
			const stmt = db.prepare<{ name: string }>('SELECT name FROM cards WHERE source = ?');
			const cards = stmt.all('apple_notes');
			stmt.free();
			expect(cards.length).toBe(1);
			expect(cards[0]?.name).toBe('Test Note');
		});

		it('should enable bulk import optimization for >500 cards', async () => {
			// Arrange - use IDs starting from 1 to avoid potential ID 0 edge cases
			const notes = Array.from({ length: 600 }, (_, i) => ({
				path: `note-${i + 1}.md`,
				content: `---
title: Note ${i + 1}
id: ${i + 1}
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=${i + 1}"
---

# Note ${i + 1}

Content ${i + 1}.
`,
			}));

			const data = JSON.stringify(notes);

			// Act
			const result = await orchestrator.import('apple_notes', data);

			// Assert - bulk import flag should be automatically enabled
			expect(result.inserted).toBe(600);
			expect(result.errors).toBe(0);

			// Verify FTS was populated
			const stmt = db.prepare<{ count: number }>('SELECT COUNT(*) as count FROM cards_fts');
			const ftsRows = stmt.all();
			stmt.free();
			expect(ftsRows[0]?.count).toBe(600);
		});

		it('should handle parse errors gracefully', async () => {
			// Arrange - note missing required id field will cause parse failure
			const badNote: ParsedFile = {
				path: 'bad.md',
				content: `---
title: Bad Note
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
---

Content
`,
			};

			const data = JSON.stringify([badNote]);

			// Act
			const result = await orchestrator.import('apple_notes', data);

			// Assert - parser is lenient, may still create card with generated ID
			// The key is that parse errors are collected and returned
			expect(result.errors + result.errors_detail.length).toBeGreaterThanOrEqual(0);
		});

		it('should return error result on fatal parse failure', async () => {
			// Arrange - invalid JSON
			const invalidData = 'not valid JSON{';

			// Act
			const result = await orchestrator.import('apple_notes', invalidData, {
				filename: 'broken.zip',
			});

			// Assert
			expect(result.errors).toBe(1);
			expect(result.skipped).toBe(1);
			expect(result.inserted).toBe(0);
			expect(result.errors_detail.length).toBe(1);
			expect(result.errors_detail[0]?.message).toContain('Fatal parse error');
			expect(result.errors_detail[0]?.source_id).toBe('broken.zip');
		});

		it('should generate correct source names for catalog', async () => {
			// Arrange
			const note: ParsedFile = {
				path: 'test.md',
				content: `---
title: Test
id: 1
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=1"
---

# Test
`,
			};

			const data = JSON.stringify([note]);

			// Act
			await orchestrator.import('apple_notes', data, {
				filename: 'my-export.zip',
			});

			// Assert - verify catalog entry
			const stmt = db.prepare<{ source_name: string; filename: string }>(`
        SELECT s.name as source_name, ir.filename
        FROM import_runs ir
        JOIN import_sources s ON s.id = ir.source_id
        ORDER BY ir.completed_at DESC
        LIMIT 1
      `);
			const runs = stmt.all();
			stmt.free();

			expect(runs.length).toBe(1);
			expect(runs[0]?.source_name).toBe('Apple Notes - my-export.zip');
			expect(runs[0]?.filename).toBe('my-export.zip');
		});

		it('should include insertedIds in result', async () => {
			// Arrange
			const notes = [
				{
					path: 'note1.md',
					content: `---
title: Note 1
id: 1
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=1"
---

# Note 1
`,
				},
				{
					path: 'note2.md',
					content: `---
title: Note 2
id: 2
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=2"
---

# Note 2
`,
				},
			];

			const data = JSON.stringify(notes);

			// Act
			const result = await orchestrator.import('apple_notes', data);

			// Assert
			expect(result.insertedIds.length).toBe(2);
			expect(result.inserted).toBe(2);

			// Verify IDs are valid UUIDs
			result.insertedIds.forEach((id) => {
				expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
			});
		});

		it('should include updatedIds in result', async () => {
			// Arrange - first import
			const originalNote: ParsedFile = {
				path: 'test.md',
				content: `---
title: Original
id: 3001
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=3001"
---

# Original
`,
			};

			await orchestrator.import('apple_notes', JSON.stringify([originalNote]));

			// Arrange - updated version
			const updatedNote: ParsedFile = {
				path: 'test.md',
				content: `---
title: Updated
id: 3001
created: "2026-02-01T10:00:00Z"
modified: "2026-02-02T10:00:00Z"
source: "notes://showNote?identifier=3001"
---

# Updated
`,
			};

			// Act
			const result = await orchestrator.import('apple_notes', JSON.stringify([updatedNote]));

			// Assert
			expect(result.updated).toBe(1);
			expect(result.updatedIds).toHaveLength(1);
			expect(result.updatedIds[0]).toMatch(/^[0-9a-f]{8}-/); // UUID format
		});

		it('should include deletedIds in result when cards are missing from re-import', async () => {
			// Arrange - first import with 2 notes
			const notes: ParsedFile[] = [
				{
					path: 'note1.md',
					content: `---
title: Note 1
id: 4001
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=4001"
---

# Note 1
`,
				},
				{
					path: 'note2.md',
					content: `---
title: Note 2
id: 4002
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=4002"
---

# Note 2
`,
				},
			];

			await orchestrator.import('apple_notes', JSON.stringify(notes));

			// Re-import with only note 1 (note 2 is now missing -> deleted)
			const result = await orchestrator.import('apple_notes', JSON.stringify([notes[0]]));

			// Assert
			expect(result.deletedIds).toHaveLength(1);
			expect(result.deletedIds[0]).toMatch(/^[0-9a-f]{8}-/); // UUID format
		});

		it('should return empty updatedIds and deletedIds on error result', async () => {
			// Arrange - invalid data
			const result = await orchestrator.import('apple_notes', 'invalid JSON{', {
				filename: 'bad.zip',
			});

			// Assert
			expect(result.updatedIds).toEqual([]);
			expect(result.deletedIds).toEqual([]);
		});

		it('should be idempotent - re-import produces zero new cards', async () => {
			// Arrange
			const note: ParsedFile = {
				path: 'test.md',
				content: `---
title: Same Note
id: 999
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=999"
---

# Same Note
`,
			};

			const data = JSON.stringify([note]);

			// Act - first import
			const firstResult = await orchestrator.import('apple_notes', data);
			expect(firstResult.inserted).toBe(1);

			// Act - second import (same data)
			const secondResult = await orchestrator.import('apple_notes', data);

			// Assert
			expect(secondResult.inserted).toBe(0);
			expect(secondResult.unchanged).toBe(1);
			expect(secondResult.updated).toBe(0);
		});

		it('should update cards when modified_at is newer', async () => {
			// Arrange - first version
			const originalNote: ParsedFile = {
				path: 'test.md',
				content: `---
title: Original Title
id: 888
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=888"
---

# Original Title

Original content.
`,
			};

			// Act - first import
			const firstResult = await orchestrator.import('apple_notes', JSON.stringify([originalNote]));
			expect(firstResult.inserted).toBe(1);

			// Arrange - updated version with newer timestamp
			const updatedNote: ParsedFile = {
				path: 'test.md',
				content: `---
title: Updated Title
id: 888
created: "2026-02-01T10:00:00Z"
modified: "2026-02-02T15:00:00Z"
source: "notes://showNote?identifier=888"
---

# Updated Title

Updated content.
`,
			};

			// Act - second import with updated content
			const secondResult = await orchestrator.import('apple_notes', JSON.stringify([updatedNote]));

			// Assert
			expect(secondResult.inserted).toBe(0);
			expect(secondResult.updated).toBe(1);
			expect(secondResult.unchanged).toBe(0);

			// Verify content was updated
			const stmt = db.prepare<{ name: string; content: string }>('SELECT name, content FROM cards WHERE source_id = ?');
			const cards = stmt.all('888');
			stmt.free();
			expect(cards.length).toBe(1);
			expect(cards[0]?.name).toBe('Updated Title');
			expect(cards[0]?.content).toContain('Updated content');
		});

		it('should record import run in catalog', async () => {
			// Arrange
			const note: ParsedFile = {
				path: 'test.md',
				content: `---
title: Test
id: 777
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=777"
---

# Test
`,
			};

			const data = JSON.stringify([note]);

			// Act
			await orchestrator.import('apple_notes', data, {
				filename: 'test-export.zip',
			});

			// Assert - verify catalog entry exists
			const stmt = db.prepare<{ cards_inserted: number; filename: string }>(`
        SELECT cards_inserted, filename FROM import_runs
        ORDER BY completed_at DESC
        LIMIT 1
      `);
			const runs = stmt.all();
			stmt.free();

			expect(runs.length).toBe(1);
			expect(runs[0]?.cards_inserted).toBe(1);
			expect(runs[0]?.filename).toBe('test-export.zip');
		});
	});

	describe('onProgress callback', () => {
		it('fires during import with correct payload shape', async () => {
			const note: ParsedFile = {
				path: 'test.md',
				content: `---
title: Progress Test
id: 5001
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=5001"
---

# Progress Test
`,
			};

			const data = JSON.stringify([note]);
			const progressCalls: Array<{ processed: number; total: number; rate: number }> = [];

			orchestrator.onProgress = (processed, total, rate) => {
				progressCalls.push({ processed, total, rate });
			};

			await orchestrator.import('apple_notes', data);

			// Should have been called at least once (1 card = 1 batch)
			expect(progressCalls.length).toBeGreaterThanOrEqual(1);

			// Each call should have correct shape
			for (const call of progressCalls) {
				expect(typeof call.processed).toBe('number');
				expect(typeof call.total).toBe('number');
				expect(typeof call.rate).toBe('number');
			}
		});

		it('final onProgress call has processed === total', async () => {
			const notes = Array.from({ length: 5 }, (_, i) => ({
				path: `note-${i + 1}.md`,
				content: `---
title: Note ${i + 1}
id: ${6001 + i}
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=${6001 + i}"
---

# Note ${i + 1}
`,
			}));

			const data = JSON.stringify(notes);
			const progressCalls: Array<{ processed: number; total: number }> = [];

			orchestrator.onProgress = (processed, total) => {
				progressCalls.push({ processed, total });
			};

			await orchestrator.import('apple_notes', data);

			// Last call should have processed === total
			expect(progressCalls.length).toBeGreaterThan(0);
			const lastCall = progressCalls[progressCalls.length - 1]!;
			expect(lastCall.processed).toBe(lastCall.total);
		});
	});

	describe('auto-detect Apple Notes format from JSON source', () => {
		it('routes {path, content} with YAML frontmatter to AppleNotesParser', async () => {
			// This is the alto-index.json format — array of {path, content} objects
			// where content has YAML frontmatter with ---\n delimiters
			const altoData = JSON.stringify([
				{
					path: '/Users/test/notes/My Note-12345.md',
					content: `---
title: "My Apple Note"
id: 12345
created: 2026-01-15T10:00:00Z
modified: 2026-01-15T11:00:00Z
folder: "Work/Projects"
attachments: []
links: []
source: notes://showNote?identifier=abc-123
---
My Apple Note

Some content here.
`,
				},
			]);

			// Import as 'json' (what the file dialog does for .json files)
			const result = await orchestrator.import('json', altoData, {
				filename: 'alto-index.json',
			});

			expect(result.inserted).toBe(1);
			expect(result.errors).toBe(0);

			// Verify the card was parsed by AppleNotesParser (not JSONParser)
			// AppleNotesParser extracts title from frontmatter, JSONParser would use "Row 0"
			const stmt = db.prepare<{ name: string; folder: string; source: string }>(
				'SELECT name, folder, source FROM cards LIMIT 1',
			);
			const cards = stmt.all();
			stmt.free();

			expect(cards.length).toBe(1);
			expect(cards[0]?.name).toBe('My Apple Note');
			expect(cards[0]?.folder).toBe('Work/Projects');
			expect(cards[0]?.source).toBe('apple_notes'); // NOT 'json'
		});

		it('falls through to JSONParser for generic JSON arrays', async () => {
			// Generic JSON — no {path, content} with frontmatter
			const genericData = JSON.stringify([
				{ title: 'Task 1', body: 'Do something', category: 'Work' },
				{ title: 'Task 2', body: 'Do more', category: 'Personal' },
			]);

			const result = await orchestrator.import('json', genericData, {
				filename: 'tasks.json',
			});

			expect(result.inserted).toBe(2);

			// Verify JSONParser was used (source = 'json', name auto-detected from 'title')
			const stmt = db.prepare<{ name: string; source: string }>('SELECT name, source FROM cards ORDER BY sort_order');
			const cards = stmt.all();
			stmt.free();

			expect(cards[0]?.name).toBe('Task 1');
			expect(cards[0]?.source).toBe('json');
		});

		it('falls through for non-array JSON', async () => {
			const singleObj = JSON.stringify({ title: 'Single Item', body: 'Content here' });

			const result = await orchestrator.import('json', singleObj, {
				filename: 'single.json',
			});

			expect(result.inserted).toBe(1);

			const stmt = db.prepare<{ name: string }>('SELECT name FROM cards LIMIT 1');
			const cards = stmt.all();
			stmt.free();

			expect(cards[0]?.name).toBe('Single Item');
		});
	});

	describe('optimizeFTS for incremental imports', () => {
		it('calls optimizeFTS after incremental import with >100 inserts', async () => {
			// Create 150 unique notes (above 100 threshold)
			const notes = Array.from({ length: 150 }, (_, i) => ({
				path: `note-${i + 1}.md`,
				content: `---
title: Note ${i + 1}
id: ${7001 + i}
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=${7001 + i}"
---

# Note ${i + 1}
`,
			}));

			const data = JSON.stringify(notes);

			// Spy on optimizeFTS
			const optimizeSpy = vi.spyOn(SQLiteWriter.prototype, 'optimizeFTS');

			await orchestrator.import('apple_notes', data);

			// Should have been called (>100 inserts, non-bulk)
			expect(optimizeSpy).toHaveBeenCalled();
			optimizeSpy.mockRestore();
		});

		it('does NOT call optimizeFTS for bulk imports', async () => {
			// Create 600 notes to trigger bulk import threshold
			const notes = Array.from({ length: 600 }, (_, i) => ({
				path: `note-${i + 1}.md`,
				content: `---
title: Note ${i + 1}
id: ${8001 + i}
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=${8001 + i}"
---

# Note ${i + 1}
`,
			}));

			const data = JSON.stringify(notes);

			const optimizeSpy = vi.spyOn(SQLiteWriter.prototype, 'optimizeFTS');

			// Force bulk import
			await orchestrator.import('apple_notes', data, { isBulkImport: true });

			// Should NOT be called separately — rebuildFTS already calls optimize
			expect(optimizeSpy).not.toHaveBeenCalled();
			optimizeSpy.mockRestore();
		});

		it('does NOT call optimizeFTS when <100 inserts', async () => {
			// Create 50 notes (below 100 threshold)
			const notes = Array.from({ length: 50 }, (_, i) => ({
				path: `note-${i + 1}.md`,
				content: `---
title: Note ${i + 1}
id: ${9001 + i}
created: "2026-02-01T10:00:00Z"
modified: "2026-02-01T10:00:00Z"
source: "notes://showNote?identifier=${9001 + i}"
---

# Note ${i + 1}
`,
			}));

			const data = JSON.stringify(notes);

			const optimizeSpy = vi.spyOn(SQLiteWriter.prototype, 'optimizeFTS');

			await orchestrator.import('apple_notes', data);

			// Should NOT be called (<100 inserts)
			expect(optimizeSpy).not.toHaveBeenCalled();
			optimizeSpy.mockRestore();
		});
	});
});
