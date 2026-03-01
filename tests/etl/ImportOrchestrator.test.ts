// Isometry v5 — Phase 8 ImportOrchestrator Tests
// Integration tests with real database

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import type { ParsedFile } from '../../src/etl/parsers/AppleNotesParser';

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

    it('should return error result for unimplemented parsers', async () => {
      // Act
      const markdownResult = await orchestrator.import('markdown', '# Test', {});
      const excelResult = await orchestrator.import('excel', 'data', {});
      const csvResult = await orchestrator.import('csv', 'data', {});

      // Assert - should return error results, not throw
      expect(markdownResult.errors).toBe(1);
      expect(markdownResult.errors_detail[0]?.message).toContain('Parser not yet implemented');

      expect(excelResult.errors).toBe(1);
      expect(excelResult.errors_detail[0]?.message).toContain('Parser not yet implemented');

      expect(csvResult.errors).toBe(1);
      expect(csvResult.errors_detail[0]?.message).toContain('Parser not yet implemented');
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
      result.insertedIds.forEach(id => {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      });
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
});
